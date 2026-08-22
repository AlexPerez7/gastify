import { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from "react";

import { TOKENS, DEFAULT_CATEGORIES, PALETTE, DEFAULT_CATEGORY_ICON, resolveCategoryIcon } from "./lib/constants.js";
import { storage } from "./lib/storage.js";
import { getAccountSettings, saveAccountSettings, saveSavingsBase } from "./lib/accountSettings.js";
import { useToasts } from "./lib/useToasts.js";
import { readFileWithProgress } from "./lib/readFile.js";
import {
  autoCategory, applyMerchantRules, parseClpNumber, parseBankDate,
  makeKey, monthKey, nextMonthKey, uid, computeInsights, formatCLP,
} from "./lib/utils.js";

import { Header, MonthBar, BottomNav } from "./components/Header.jsx";
import { CategoryManager } from "./components/CategoryManager.jsx";
import { Subscriptions } from "./components/Subscriptions.jsx";
import { ToastStack } from "./components/Toast.jsx";
import { ErrorBoundary } from "./components/ErrorBoundary.jsx";
import { Onboarding } from "./components/Onboarding.jsx";
import { AppShellSkeleton, ResumenSkeleton, MovimientosSkeleton } from "./components/Shared.jsx";

// recharts y framer-motion solo hacen falta en sus tabs — se separan en sus
// propios chunks para no pesar la carga inicial (que arranca en Resumen).
const Resumen = lazy(() => import("./components/Resumen.jsx").then((m) => ({ default: m.Resumen })));
const Movimientos = lazy(() => import("./components/Movimientos.jsx").then((m) => ({ default: m.Movimientos })));
const Conciliacion = lazy(() => import("./components/Conciliacion.jsx").then((m) => ({ default: m.Conciliacion })));

const ONBOARDING_KEY = "gastify:onboarding-done";

export default function App({ onSignOut, theme, onToggleTheme }) {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [merchantRules, setMerchantRules] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [accountSettings, setAccountSettings] = useState(null); // { baseBalance, lastSyncDate } | null (todavía no ajustado)
  const [loaded, setLoaded] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [saving, setSaving] = useState(false);
  // cuenta guardados a Supabase todavía en vuelo — se usa para (1) no dejar
  // que el refetch automático de loadAllData (ver más abajo) pise con datos
  // viejos un cambio que se acaba de aplicar localmente pero cuyo guardado
  // todavía no confirma el servidor, y (2) avisar antes de cerrar/recargar
  // la pestaña si hay algo en camino, para no perderlo.
  const pendingSaves = useRef(0);
  const [tab, setTab] = useState("resumen");
  // ids de los movimientos agregados por la ÚLTIMA importación de banco —
  // para que el usuario pueda revisarlos sin tener que buscarlos a mano en
  // la lista completa (ver banner + filtro "Ver solo estos" en Movimientos).
  const [recentImportIds, setRecentImportIds] = useState([]);
  const [monthFilter, setMonthFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [txTypeFilter, setTxTypeFilter] = useState("all");
  const { toasts, push: pushToast, update: updateToast, dismiss: dismissToast } = useToasts();
  const [showManualForm, setShowManualForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  // candado contra doble importación: si el usuario suelta/selecciona el
  // archivo dos veces antes de que la primera pasada termine de guardar,
  // dos llamadas a handleFile corren en paralelo con la MISMA foto de
  // `transactions` (closures viejas) — ninguna ve lo que la otra ya
  // importó, así que ambas arman su propio lote de filas nuevas (con id
  // al azar cada una) y las dos terminan guardándose en Supabase: duplicados
  // reales, aunque el chequeo de "ya existe" en memoria diga que todo bien.
  const importingRef = useRef(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try { return localStorage.getItem(ONBOARDING_KEY) !== "1"; } catch { return false; }
  });
  const dismissOnboarding = useCallback(() => {
    try { localStorage.setItem(ONBOARDING_KEY, "1"); } catch { /* localStorage puede fallar en modo privado */ }
    setShowOnboarding(false);
  }, []);

  // el "+" central del nav inferior vive fuera de la pestaña Movimientos —
  // ambas opciones abren el formulario/modal que ya existen ahí, así que
  // primero cambian a esa pestaña para que se puedan mostrar.
  const openManualEntry = useCallback(() => {
    setTab("movimientos");
    setShowManualForm(true);
  }, []);
  const openImportFlow = useCallback(() => {
    setTab("movimientos");
    setShowImportModal(true);
  }, []);
  // desde el gráfico/leyenda de "Gasto por categoría" o "Ingresos por
  // categoría" en Resumen: salta a Movimientos ya filtrado por esa
  // categoría y por el tipo de movimiento del gráfico donde se hizo clic
  // (mismo mes seleccionado), para no mezclar ingresos y gastos.
  const goToCategoryMovements = useCallback((categoryId, txType = "all") => {
    setCatFilter(categoryId);
    setTxTypeFilter(txType);
    setTab("movimientos");
  }, []);

  const catMap = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, { ...c, icon: resolveCategoryIcon(c) }])),
    [categories]
  );
  const getCat = useCallback((id) => catMap[id] || { id, label: id, color: TOKENS.textFaint, icon: DEFAULT_CATEGORY_ICON }, [catMap]);

  // detalle del último error real de Supabase (RLS, columna inexistente,
  // sesión vencida, etc.) — un ref porque hace falta leerlo justo después de
  // un `await persistTx(...)` puntual (ej. al importar), y el estado de
  // React (`syncError`) no se actualiza a tiempo dentro de la misma función.
  const lastPersistError = useRef(null);

  const beginSave = useCallback(() => { pendingSaves.current += 1; setSaving(true); }, []);
  const endSave = useCallback(() => {
    pendingSaves.current = Math.max(0, pendingSaves.current - 1);
    if (pendingSaves.current === 0) setSaving(false);
  }, []);

  // optimista: aplica el cambio ya, pero si Supabase rechaza el guardado
  // revierte el estado local en vez de dejarlo "aplicado" solo de mentira.
  const persistTx = useCallback(async (next) => {
    const prev = transactions;
    setTransactions(next);
    beginSave();
    const res = await storage.set("transactions", JSON.stringify(next), prev);
    endSave();
    lastPersistError.current = res?.error || null;
    if (!res || res.error) {
      setTransactions(prev);
      const detail = res?.error ? ` (${res.error})` : "";
      setSyncError(`No se pudo guardar en el servidor. Revisa tu conexión — se revirtió el cambio, inténtalo de nuevo.${detail}`);
      return false;
    }
    setSyncError(null);
    return true;
  }, [transactions, beginSave, endSave]);
  const persistCats = useCallback(async (next) => {
    const prev = categories;
    setCategories(next);
    beginSave();
    const res = await storage.set("categories", JSON.stringify(next), prev);
    endSave();
    if (!res || res.error) {
      setCategories(prev);
      const detail = res?.error ? ` (${res.error})` : "";
      setSyncError(`No se pudo guardar en el servidor. Revisa tu conexión — se revirtió el cambio, inténtalo de nuevo.${detail}`);
    } else {
      setSyncError(null);
    }
  }, [categories, beginSave, endSave]);
  const persistRules = useCallback(async (next) => {
    const prev = merchantRules;
    setMerchantRules(next);
    beginSave();
    const res = await storage.set("merchantRules", JSON.stringify(next), prev);
    endSave();
    if (!res || res.error) {
      setMerchantRules(prev);
      const detail = res?.error ? ` (${res.error})` : "";
      setSyncError(`No se pudo guardar en el servidor. Revisa tu conexión — se revirtió el cambio, inténtalo de nuevo.${detail}`);
    } else {
      setSyncError(null);
    }
  }, [merchantRules, beginSave, endSave]);
  const persistSubs = useCallback(async (next) => {
    const prev = subscriptions;
    setSubscriptions(next);
    beginSave();
    const res = await storage.set("subscriptions", JSON.stringify(next), prev);
    endSave();
    if (!res || res.error) {
      setSubscriptions(prev);
      const detail = res?.error ? ` (${res.error})` : "";
      setSyncError(`No se pudo guardar en el servidor. Revisa tu conexión — se revirtió el cambio, inténtalo de nuevo.${detail}`);
    } else {
      setSyncError(null);
    }
  }, [subscriptions, beginSave, endSave]);

  // ---- persistence (Supabase, vía src/lib/storage.js) ----------------------
  const loadAllData = useCallback(async () => {
    const tx = await storage.get("transactions");
    if (tx) setTransactions(JSON.parse(tx.value));

    const cats = await storage.get("categories");
    if (cats) {
      const parsedCats = JSON.parse(cats.value);
      // usuario nuevo, o que quedó sin categorías: sembramos las por defecto
      if (parsedCats.length === 0) await persistCats(DEFAULT_CATEGORIES);
      else setCategories(parsedCats);
    }

    const rules = await storage.get("merchantRules");
    if (rules) setMerchantRules(JSON.parse(rules.value));

    const subs = await storage.get("subscriptions");
    if (subs) setSubscriptions(JSON.parse(subs.value));

    // null es un estado válido acá (usuario que nunca ajustó su saldo),
    // así que no cuenta para el syncError de abajo.
    setAccountSettings(await getAccountSettings());

    if (!tx || !cats || !rules || !subs) {
      setSyncError("No se pudieron cargar todos tus datos. Revisa tu conexión y recarga la página.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- persistCats solo se usa para sembrar defaults, no hace falta re-crear esta función si cambia
  }, []);

  useEffect(() => {
    loadAllData().then(() => setLoaded(true));

    // no hay sync en vivo entre dispositivos/pestañas: los datos se cargan
    // una vez al entrar. Si agregaste un movimiento desde el celular y
    // volvés a una pestaña web que ya tenías abierta, se iba a quedar con
    // los datos viejos hasta recargar la página a mano — esto la refresca
    // sola apenas la pestaña vuelve a estar visible. Si en ese momento hay
    // un guardado en curso (pendingSaves > 0), se salta: si no, esta
    // recarga podría llegar a leer la fila todavía sin el cambio recién
    // hecho y pisar el estado local optimista con datos viejos.
    const onVisible = () => { if (document.visibilityState === "visible" && pendingSaves.current === 0) loadAllData(); };
    document.addEventListener("visibilitychange", onVisible);

    // si hay un guardado en curso y el usuario cierra la pestaña o recarga
    // antes de que termine, el navegador corta el request a mitad de
    // camino — el cambio queda aplicado solo localmente y se pierde apenas
    // vuelve a cargar. Este aviso nativo del navegador da la chance de
    // cancelar y esperar a que termine.
    const onBeforeUnload = (e) => {
      if (pendingSaves.current > 0) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [loadAllData]);

  // genera, una sola vez por sesión, el movimiento manual "pendiente" del mes
  // en curso para cada suscripción activa cuyo día de cobro ya pasó — ese
  // movimiento se concilia después con el cargo real del banco igual que
  // cualquier otro manual (mismo reconcileMonth, mismo match por monto+fecha).
  // No hace backfill de meses anteriores: si la app no se abrió ese mes, el
  // cargo real que llegue del banco igual se categoriza por las reglas de
  // comercio existentes (ver MERCHANT_RULES_DEFAULT), solo queda sin el
  // vínculo subscriptionId.
  const subscriptionChargesRanRef = useRef(false);
  useEffect(() => {
    if (!loaded || subscriptionChargesRanRef.current || subscriptions.length === 0) return;
    subscriptionChargesRanRef.current = true;

    const today = new Date();
    const curMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

    const toGenerate = [];
    for (const sub of subscriptions) {
      if (!sub.active || today.getDate() < sub.dayOfMonth) continue;
      const alreadyExists = transactions.some((t) => t.subscriptionId === sub.id && monthKey(t.date) === curMonthKey);
      if (alreadyExists) continue;
      const date = `${curMonthKey}-${String(Math.min(sub.dayOfMonth, daysInMonth)).padStart(2, "0")}`;
      toGenerate.push({
        id: uid(),
        key: makeKey(date, sub.name, sub.amount, 0),
        date,
        description: sub.name,
        alias: "",
        amount: -Math.abs(sub.amount),
        category: sub.category,
        source: "manual",
        reconciled: false,
        matchedId: null,
        subscriptionId: sub.id,
        createdAt: new Date().toISOString(),
      });
    }
    if (toGenerate.length > 0) persistTx([...transactions, ...toGenerate]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- corre una sola vez por sesión (ref guard); no hace falta re-crear el efecto con cada cambio de transactions/persistTx
  }, [loaded, subscriptions]);

  // ---- import xls/pdf ---------------------------------------------------------
  const handleFile = useCallback(
    async (file) => {
      if (importingRef.current) return;
      importingRef.current = true;
      setIsImporting(true);
      const toastId = pushToast("loading", "Leyendo archivo…", 0);
      try {
        const isPdf = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
        const buf = await readFileWithProgress(file, (pct) => updateToast(toastId, "loading", "Leyendo archivo…", pct));
        updateToast(toastId, "loading", "Procesando movimientos…");

        let dataRows;
        if (isPdf) {
          // solo se descarga al importar una cartola en PDF
          const { parsePdfRows } = await import("./lib/parsePdfCartola.js");
          dataRows = await parsePdfRows(buf);
        } else {
          const XLSX = await import("xlsx"); // solo se descarga al importar un .xls
          const wb = XLSX.read(buf, { type: "array" });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });

          let headerIdx = rows.findIndex((r) => r.some((c) => String(c).trim().toLowerCase() === "fecha"));
          if (headerIdx === -1) headerIdx = 0;
          dataRows = rows.slice(headerIdx + 1).filter((r) => r[0] && String(r[0]).trim() !== "");
        }

        const existingKeys = new Set(transactions.filter((t) => t.source === "bank").map((t) => t.key));
        const imported = [];
        const importedAt = new Date().toISOString();
        // fila con la fecha más reciente del archivo. Se calcula escaneando
        // dataRows (TODAS las filas crudas del Excel, sin filtrar), no el
        // array `imported` — así, si el archivo llega con movimientos que ya
        // estaban todos importados (`imported` queda vacío), el Saldo sigue
        // extrayéndose igual. Sobre empates de fecha (varios movimientos el
        // mismo día), se queda con la PRIMERA que aparece en el archivo: los
        // reportes del banco vienen con el movimiento más reciente arriba,
        // así que la primera fila de esa fecha es la última transacción real
        // de ese día (y su Saldo, el saldo vigente) — quedarse con la última
        // fila del archivo daría el saldo de una transacción anterior ese
        // mismo día, no el saldo actual.
        let latestRow = null;

        for (const r of dataRows) {
          const [fecha, desc, cargo, abono, saldo] = r;
          if (!desc) continue;
          const date = parseBankDate(fecha);
          const cargoN = parseClpNumber(cargo);
          const abonoN = parseClpNumber(abono);
          // "Saldo" viene en formato chileno (ej. "$ 1.569.661") — mismo
          // parser que ya limpia Cargo/Abono: saca $, espacios y puntos de
          // miles para dejar el entero.
          const saldoN = parseClpNumber(saldo);
          if (!latestRow || date > latestRow.date) latestRow = { date, saldo: saldoN };

          // se usa el Saldo (no la descripción) como parte de la clave: el
          // banco no siempre escribe la descripción idéntica entre el .xls y
          // la cartola en PDF (ej. la cartola a veces omite el código de país
          // al final, "CHL"), pero el Saldo resultante de cada movimiento es
          // el mismo en ambos formatos — y al ser un acumulado, es imposible
          // que dos movimientos reales distintos compartan fecha+cargo+abono+
          // saldo salvo que sean el mismo movimiento.
          const key = makeKey(date, String(saldoN), cargoN, abonoN);
          if (existingKeys.has(key)) continue;
          existingKeys.add(key);
          const amount = abonoN > 0 ? abonoN : -cargoN;
          const cleanDesc = String(desc).trim().replace(/\s+/g, " ");
          const rule = applyMerchantRules(cleanDesc, merchantRules);
          imported.push({
            id: uid(),
            key,
            date,
            description: cleanDesc,
            alias: rule ? rule.alias : "",
            amount,
            category: rule ? rule.categoryId : autoCategory(cleanDesc),
            source: "bank",
            reconciled: false,
            matchedId: null,
            // igual que en addManual: la columna real la pone Supabase
            // (default now()) al guardar, esto es solo para que el orden
            // "más reciente arriba" dentro del día ya quede bien en la lista
            // sin esperar a un reload.
            createdAt: importedAt,
          });
        }

        // archivo sin ninguna fila reconocible (ni para importar ni para
        // conciliar) — aquí sí no hay nada que hacer.
        if (imported.length === 0 && !latestRow) {
          updateToast(toastId, "error", "No se reconocieron movimientos en este archivo.");
          return;
        }

        // si todo lo que traía el archivo ya estaba importado no hay nada
        // nuevo que persistir, pero igual puede traer un Saldo útil para
        // conciliar — por eso ya NO se corta aquí como antes.
        const persisted = imported.length > 0 ? await persistTx([...transactions, ...imported]) : true;
        if (imported.length > 0 && !persisted) {
          const detail = lastPersistError.current ? ` (${lastPersistError.current})` : "";
          updateToast(toastId, "error", `No se pudieron guardar los movimientos importados. Intenta de nuevo.${detail}`);
          return;
        }
        // se reemplaza (no se acumula) con lo de esta importación puntual:
        // si esta pasada no trajo nada nuevo, el aviso de la pasada anterior
        // también debe desaparecer.
        setRecentImportIds(imported.map((t) => t.id));

        // candado cronológico: el Saldo del banco solo se aplica si el
        // archivo es igual o más reciente que la última conciliación
        // guardada. Sin esto, subir un archivo viejo (histórico) pisaría un
        // saldo ya actualizado con un valor desactualizado.
        const [y, m, d] = latestRow.date.split("-").map(Number);
        // fin del día de esa fecha: el Saldo del banco es el saldo AL CIERRE
        // de ese día, así que un movimiento manual cargado ese mismo día
        // (antes de importar) ya debería estar reflejado ahí.
        const fileLastSyncDate = new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
        // sin account_settings todavía, o con last_sync_date nulo, es la
        // primera sincronización del usuario: nunca puede ser "histórico"
        // porque no hay nada previo con qué compararlo.
        const isFirstSync = !accountSettings || !accountSettings.lastSyncDate;
        // comparación como objetos Date (no de strings) para no depender del
        // formato exacto en que Supabase devuelve el timestamptz.
        const isHistoric = !isFirstSync && new Date(fileLastSyncDate) < new Date(accountSettings.lastSyncDate);

        if (isHistoric) {
          const importedMsg = imported.length > 0
            ? `${imported.length} movimiento${imported.length === 1 ? "" : "s"} nuevo${imported.length === 1 ? "" : "s"} importado${imported.length === 1 ? "" : "s"}.`
            : "Sin movimientos nuevos (ya estaban todos importados).";
          updateToast(toastId, "warn", `${importedMsg} Saldo sin cambios — este archivo es más antiguo que tu última conciliación.`);
        } else {
          const settings = await saveAccountSettings(latestRow.saldo, fileLastSyncDate);
          if (settings && !settings.error) {
            setAccountSettings((prev) => ({ ...prev, ...settings }));
            updateToast(
              toastId,
              "ok",
              imported.length > 0
                ? `Movimientos importados. Saldo conciliado a ${formatCLP(latestRow.saldo)}.`
                : `Archivo procesado (0 nuevos). Saldo conciliado a ${formatCLP(latestRow.saldo)}.`
            );
          } else {
            const importedMsg = imported.length > 0
              ? `${imported.length} movimiento${imported.length === 1 ? "" : "s"} nuevo${imported.length === 1 ? "" : "s"} importado${imported.length === 1 ? "" : "s"}.`
              : "Archivo procesado, sin movimientos nuevos.";
            const detail = settings?.error ? ` (${settings.error})` : "";
            updateToast(toastId, "warn", `${importedMsg} No se pudo conciliar el saldo automáticamente.${detail}`);
          }
        }
      } catch (e) {
        console.error(e);
        updateToast(toastId, "error", "No se pudo leer el archivo. ¿Es el .xls de movimientos del banco?");
      } finally {
        importingRef.current = false;
        setIsImporting(false);
      }
    },
    [transactions, merchantRules, persistTx, pushToast, updateToast, accountSettings]
  );

  // ---- manual entries ---------------------------------------------------------
  const addManual = useCallback(
    async (entry) => {
      const t = {
        id: uid(),
        key: makeKey(entry.date, entry.description, entry.type === "expense" ? entry.amount : 0, entry.type === "income" ? entry.amount : 0),
        date: entry.date,
        description: entry.description,
        alias: "",
        amount: entry.type === "expense" ? -Math.abs(entry.amount) : Math.abs(entry.amount),
        category: entry.category,
        source: "manual",
        reconciled: false,
        matchedId: null,
        // se manda solo para uso local/optimista — la columna en Supabase la
        // pone la propia base de datos (default now()), esto es nada más
        // para que el saldo dinámico ya lo cuente sin esperar a un reload.
        createdAt: new Date().toISOString(),
      };
      await persistTx([...transactions, t]);
      setShowManualForm(false);
    },
    [transactions, persistTx]
  );

  const deleteTransaction = useCallback((id) => { persistTx(transactions.filter((t) => t.id !== id)); }, [transactions, persistTx]);

  // acciones masivas (bulk): mismo camino que cualquier otro cambio de
  // transactions — persistTx ya diffea contra Supabase (borra lo que falta,
  // upsertea lo que cambió) y hace rollback si el guardado falla, así que
  // aquí solo arma el array `next` y devuelve si funcionó o no.
  const bulkDeleteTransactions = useCallback(
    async (ids) => {
      const idSet = new Set(ids);
      return persistTx(transactions.filter((t) => !idSet.has(t.id)));
    },
    [transactions, persistTx]
  );
  const bulkChangeCategory = useCallback(
    async (ids, categoryId) => {
      const idSet = new Set(ids);
      return persistTx(transactions.map((t) => (idSet.has(t.id) ? { ...t, category: categoryId } : t)));
    },
    [transactions, persistTx]
  );

  // edita un movimiento y, opcionalmente, recuerda una regla de comercio que
  // se aplica retroactivamente a todo lo que ya coincida
  const saveTxEdit = useCallback(
    async (txId, { category, alias, remember, matchText }) => {
      let nextRules = merchantRules;
      if (remember && matchText && matchText.trim()) {
        const mt = matchText.trim();
        const others = merchantRules.filter((r) => r.matchText.toUpperCase() !== mt.toUpperCase());
        nextRules = [...others, { id: uid(), matchText: mt, categoryId: category, alias: alias || "" }];
        await persistRules(nextRules);
      }
      const next = transactions.map((t) => {
        if (t.id === txId) return { ...t, category, alias: alias || "" };
        if (remember && matchText && t.source === "bank" && t.description.toUpperCase().includes(matchText.trim().toUpperCase())) {
          return { ...t, category, alias: alias || t.alias };
        }
        return t;
      });
      await persistTx(next);
    },
    [transactions, merchantRules, persistTx, persistRules]
  );

  // marca/desmarca un movimiento como suscripción desde Movimientos: al
  // marcarlo, crea (o reutiliza si ya existe una activa con el mismo
  // nombre+monto+categoría, para no duplicar al marcar el mismo cobro dos
  // meses distintos) una suscripción declarada con sus datos, y linkea el
  // movimiento a ella — desde ahí aparece en la pestaña Suscripciones y
  // genera su cargo pendiente los meses siguientes. Al desmarcarlo, solo
  // desvincula este movimiento puntual; la suscripción en sí (y otros
  // movimientos ya vinculados a ella) no se tocan.
  const toggleTxSubscription = useCallback(
    (txId, isSubscription) => {
      const tx = transactions.find((t) => t.id === txId);
      if (!tx) return;
      if (!isSubscription) {
        persistTx(transactions.map((t) => (t.id === txId ? { ...t, subscriptionId: null } : t)));
        return;
      }
      const name = tx.alias || tx.description;
      const amount = Math.abs(tx.amount);
      const category = tx.category;
      const dayOfMonth = Number(tx.date.slice(8, 10));
      const existing = subscriptions.find((s) => s.active && s.name === name && s.amount === amount && s.category === category);
      const subId = existing ? existing.id : "sub_" + uid();
      if (!existing) persistSubs([...subscriptions, { id: subId, name, amount, category, dayOfMonth, active: true }]);
      persistTx(transactions.map((t) => (t.id === txId ? { ...t, subscriptionId: subId } : t)));
    },
    [transactions, subscriptions, persistTx, persistSubs]
  );

  // ---- category management ------------------------------------------------------
  const addCategory = useCallback(
    (label, icon, color, type) => {
      const id = "cat_" + uid();
      const resolvedColor = color || PALETTE[categories.length % PALETTE.length];
      persistCats([...categories, { id, label, color: resolvedColor, icon: icon || "Shapes", type: type === "income" ? "income" : "expense", excludeFromExpense: false, budget: null }]);
      return id;
    },
    [categories, persistCats]
  );
  const renameCategory = useCallback((id, label) => { persistCats(categories.map((c) => (c.id === id ? { ...c, label } : c))); }, [categories, persistCats]);
  const changeCategoryIcon = useCallback((id, icon) => { persistCats(categories.map((c) => (c.id === id ? { ...c, icon } : c))); }, [categories, persistCats]);
  const changeCategoryColor = useCallback((id, color) => { persistCats(categories.map((c) => (c.id === id ? { ...c, color } : c))); }, [categories, persistCats]);
  const changeCategoryType = useCallback(
    (id, type) => { persistCats(categories.map((c) => (c.id === id ? { ...c, type: type === "income" ? "income" : "expense" } : c))); },
    [categories, persistCats]
  );
  // budget null/0 = sin presupuesto definido para esa categoría
  const changeCategoryBudget = useCallback(
    (id, budget) => { persistCats(categories.map((c) => (c.id === id ? { ...c, budget: budget > 0 ? budget : null } : c))); },
    [categories, persistCats]
  );
  const toggleCategoryExpense = useCallback(
    (id) => { persistCats(categories.map((c) => (c.id === id ? { ...c, excludeFromExpense: !c.excludeFromExpense } : c))); },
    [categories, persistCats]
  );
  const toggleCategorySavings = useCallback(
    (id) => { persistCats(categories.map((c) => (c.id === id ? { ...c, isSavings: !c.isSavings } : c))); },
    [categories, persistCats]
  );
  const deleteCategory = useCallback(
    (id) => {
      persistCats(categories.filter((c) => c.id !== id));
      persistTx(transactions.map((t) => (t.category === id ? { ...t, category: "otros" } : t)));
      persistSubs(subscriptions.map((s) => (s.category === id ? { ...s, category: "otros" } : s)));
    },
    [categories, transactions, subscriptions, persistCats, persistTx, persistSubs]
  );

  // ---- subscriptions (suscripciones declaradas a mano) ------------------------
  const addSubscription = useCallback(
    ({ name, amount, category, dayOfMonth }) => {
      const sub = { id: "sub_" + uid(), name, amount: Math.abs(amount), category, dayOfMonth, active: true };
      persistSubs([...subscriptions, sub]);
    },
    [subscriptions, persistSubs]
  );
  const updateSubscription = useCallback(
    (id, patch) => { persistSubs(subscriptions.map((s) => (s.id === id ? { ...s, ...patch } : s))); },
    [subscriptions, persistSubs]
  );
  const deleteSubscription = useCallback(
    (id) => { persistSubs(subscriptions.filter((s) => s.id !== id)); },
    [subscriptions, persistSubs]
  );

  // ---- reconciliation ---------------------------------------------------------
  // Conciliar FUSIONA el movimiento manual con el del banco en vez de dejar
  // los dos como filas separadas: si no se hiciera así, el mismo gasto real
  // quedaría contado dos veces en stats/categorías/gráficos (una vez como
  // manual, otra como bancario) apenas el usuario anota algo a mano ANTES de
  // que llegue el reporte del banco — que es justo el caso de uso principal
  // de "agregar movimiento manual". La fila manual se borra y la del banco
  // (la fuente oficial) hereda su categoría y alias, para no perder la
  // categorización que el usuario ya le había puesto a mano.
  const reconcileMonth = useCallback(
    (mKey) => {
      const manuals = transactions.filter((t) => t.source === "manual" && monthKey(t.date) === mKey);
      // el banco anota los traspasos con "fecha contable": si se hicieron
      // después de las 14:00 en día hábil o en día inhábil, quedan
      // registrados el día hábil siguiente — eso puede empujar la fecha del
      // banco al mes calendario siguiente (ej. un traspaso del 31 en la
      // tarde queda con fecha 1 o 2 del mes que sigue), así que también se
      // buscan candidatos ahí, no solo dentro del mismo mes que el manual.
      const nextKey = nextMonthKey(mKey);
      const banks = transactions.filter((t) => t.source === "bank" && (monthKey(t.date) === mKey || monthKey(t.date) === nextKey));

      const bankUpdates = new Map();
      const mergedManualIds = new Set();
      for (const m of manuals) {
        const match = banks.find((b) => {
          if (bankUpdates.has(b.id) || b.matchedId) return false;
          const sameAmount = Math.abs(b.amount - m.amount) < 1;
          // la fecha contable del banco solo se atrasa respecto a la real,
          // nunca se adelanta — la ventana es asimétrica hacia adelante
          // (hasta 5 días, para cubrir fines de semana largos con feriado de
          // por medio) y con un margen chico hacia atrás por si la fecha
          // que anotaste a mano quedó un día después de la real.
          const dDate = (new Date(b.date) - new Date(m.date)) / 86400000;
          return sameAmount && dDate >= -2 && dDate <= 5;
        });
        if (match) {
          bankUpdates.set(match.id, { ...match, matchedId: m.id, category: m.category, alias: m.alias || match.alias, subscriptionId: m.subscriptionId ?? match.subscriptionId });
          mergedManualIds.add(m.id);
        }
      }
      if (mergedManualIds.size === 0) return 0;
      const next = transactions
        .filter((t) => !mergedManualIds.has(t.id))
        .map((t) => bankUpdates.get(t.id) || t);
      persistTx(next);
      return mergedManualIds.size;
    },
    [transactions, persistTx]
  );

  // corrige fecha/monto de un movimiento manual sin salir de Conciliación —
  // pensado para el caso "posible descuadre": casi siempre es un typo en el
  // monto o la fecha. Se recalcula `key` para que siga reflejando los datos
  // reales del movimiento. Solo se llama sobre manuales que TODAVÍA existen
  // como fila propia, así que por definición no están fusionados con nada.
  const editManualEntry = useCallback(
    (txId, { date, amount }) => {
      const target = transactions.find((t) => t.id === txId);
      if (!target) return;
      const isExpense = target.amount < 0;
      const signedAmount = isExpense ? -Math.abs(amount) : Math.abs(amount);
      const next = transactions.map((t) => {
        if (t.id !== txId) return t;
        return {
          ...t,
          date,
          amount: signedAmount,
          key: makeKey(date, t.description, isExpense ? Math.abs(amount) : 0, isExpense ? 0 : Math.abs(amount)),
        };
      });
      persistTx(next);
    },
    [transactions, persistTx]
  );

  // vincula a mano un movimiento manual con uno del banco cuando el calce
  // automático (mismo monto, fecha contable hasta 5 días después) no lo
  // encontró — ej. el banco demoró aún más en procesarlo. Misma fusión que
  // hace reconcileMonth: se borra la fila manual y el banco hereda su
  // categoría y alias.
  const manualMatch = useCallback(
    (manualId, bankId) => {
      const manual = transactions.find((t) => t.id === manualId);
      if (!manual) return;
      const next = transactions
        .filter((t) => t.id !== manualId)
        .map((t) => (t.id === bankId ? { ...t, matchedId: manualId, category: manual.category, alias: manual.alias || t.alias, subscriptionId: manual.subscriptionId ?? t.subscriptionId } : t));
      persistTx(next);
    },
    [transactions, persistTx]
  );

  // ---- derived data -----------------------------------------------------------
  const months = useMemo(() => {
    const s = new Set(transactions.map((t) => monthKey(t.date)));
    return Array.from(s).filter(Boolean).sort().reverse();
  }, [transactions]);

  // al entrar a la app, arrancar en el mes más reciente con datos en vez de
  // "Todo" — solo una vez (así no pisa un cambio de mes que haga el usuario
  // más tarde, ej. si borra los movimientos del mes actual).
  const didSetDefaultMonth = useRef(false);
  useEffect(() => {
    if (!didSetDefaultMonth.current && months.length > 0) {
      didSetDefaultMonth.current = true;
      setMonthFilter(months[0]);
    }
  }, [months]);

  const currentMonth = monthFilter === "all" ? months[0] : monthFilter;

  const monthTx = useMemo(
    () => transactions.filter((t) => monthFilter === "all" || monthKey(t.date) === monthFilter),
    [transactions, monthFilter]
  );

  const filteredTx = useMemo(() => {
    return monthTx
      .filter((t) => catFilter === "all" || t.category === catFilter)
      .filter((t) => txTypeFilter === "all" || (txTypeFilter === "income" ? t.amount > 0 : t.amount < 0))
      .filter((t) => !search || t.description.toLowerCase().includes(search.toLowerCase()) || (t.alias || "").toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        // dentro del mismo día: el que se agregó/importó más recién a la
        // app va arriba, no el orden en que vino en el archivo del banco.
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
  }, [monthTx, catFilter, txTypeFilter, search]);

  // posibles duplicados: un manual y un bancario (nunca dos del mismo
  // origen) con mismo monto (mismo signo) y fecha a menos de 3 días de
  // distancia, sin estar ya vinculados entre sí por la conciliación — el
  // caso típico es anotar algo a mano y que el reporte del banco llegue con
  // una fecha contable distinta, sin calzar dentro de la ventana que usa el
  // matching automático de reconcileMonth. Comparar bancario contra
  // bancario NO sirve acá: servicios con tarifa fija (metro, estacionamiento)
  // generan varios movimientos legítimos con el mismo monto en pocos días, y
  // los duplicados reales de una reimportación ya se filtran aparte por la
  // clave única al importar (ver handleFile). Se agrupa por monto redondeado
  // antes de comparar fechas para no comparar todo contra todo en cuentas
  // con muchos movimientos.
  const duplicateIds = useMemo(() => {
    const byAmount = new Map();
    for (const t of transactions) {
      const key = Math.round(Math.abs(t.amount));
      if (!byAmount.has(key)) byAmount.set(key, []);
      byAmount.get(key).push(t);
    }
    const flagged = new Set();
    for (const group of byAmount.values()) {
      if (group.length < 2) continue;
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const a = group[i], b = group[j];
          if (a.source === b.source) continue;
          if ((a.amount < 0) !== (b.amount < 0)) continue;
          if (a.matchedId === b.id || b.matchedId === a.id) continue;
          const dDays = Math.abs(new Date(a.date) - new Date(b.date)) / 86400000;
          if (dDays <= 3) { flagged.add(a.id); flagged.add(b.id); }
        }
      }
    }
    return flagged;
  }, [transactions]);

  // categorías marcadas "no cuenta como gasto" (ej. transferencias a tus
  // propias cuentas) — se excluyen de todo cálculo de gasto, pero siguen
  // apareciendo normalmente en la lista de movimientos.
  const excludedCategoryIds = useMemo(
    () => new Set(categories.filter((c) => c.excludeFromExpense).map((c) => c.id)),
    [categories]
  );
  const isRealExpense = useCallback((t) => t.amount < 0 && !excludedCategoryIds.has(t.category), [excludedCategoryIds]);

  // Total ahorrado = histórico completo (no solo el mes elegido) de las
  // categorías marcadas como "ahorro": la plata que sale de la cuenta hacia
  // esas categorías se acumula (monto negativo), y si alguna vez vuelve a la
  // cuenta corriente (monto positivo con esa misma categoría) se resta —
  // sigue siendo tuya, solo cambia de lugar. null si el usuario no marcó
  // ninguna categoría todavía, para que el dashboard no muestre $0 confuso.
  const savingsCategoryIds = useMemo(
    () => new Set(categories.filter((c) => c.isSavings).map((c) => c.id)),
    [categories]
  );
  // si el usuario declaró manualmente cuánto tenía ahorrado (ver
  // adjustSavingsBase), ese monto es el ancla y solo se le suma/resta lo
  // que pasó DESPUÉS de esa declaración — igual que dynamicBalance con el
  // saldo, comparando por createdAt (cuándo se cargó el movimiento en la
  // app) para no depender de si la fecha del movimiento cae el mismo día.
  // Sin ancla declarada, se mantiene el cálculo histórico completo de antes.
  const totalSavings = useMemo(() => {
    if (savingsCategoryIds.size === 0) return null;
    const inSavings = transactions.filter((t) => savingsCategoryIds.has(t.category));
    if (accountSettings?.savingsBase == null) {
      return inSavings.reduce((sum, t) => sum - t.amount, 0);
    }
    const sinceTime = new Date(accountSettings.savingsBaseDate).getTime();
    const netSince = inSavings
      .filter((t) => t.createdAt && new Date(t.createdAt).getTime() > sinceTime)
      .reduce((sum, t) => sum - t.amount, 0);
    return accountSettings.savingsBase + netSince;
  }, [transactions, savingsCategoryIds, accountSettings]);

  const stats = useMemo(() => {
    const income = monthTx.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const expense = monthTx.filter(isRealExpense).reduce((s, t) => s + t.amount, 0);
    return { income, expense, balance: income + expense };
  }, [monthTx, isRealExpense]);

  // Saldo actual = base_balance (lo que el usuario confirmó que tenía al
  // ajustar) + los movimientos MANUALES agregados después de ese momento —
  // los importados del banco no suman/restan acá porque ya están reflejados
  // (o lo estarán) en el próximo ajuste manual del saldo. Se compara por
  // createdAt (cuándo se cargó el movimiento), no por date (la fecha del
  // gasto): si ajustás el saldo hoy a las 15:00 y agregás un gasto manual
  // fechado hoy mismo a las 16:00, comparar por `date` no distinguiría cuál
  // pasó primero — createdAt sí.
  const dynamicBalance = useMemo(() => {
    if (!accountSettings) return null;
    const syncTime = new Date(accountSettings.lastSyncDate).getTime();
    const netManualSince = transactions
      .filter((t) => t.source === "manual" && t.createdAt && new Date(t.createdAt).getTime() > syncTime)
      .reduce((sum, t) => sum + t.amount, 0);
    return accountSettings.baseBalance + netManualSince;
  }, [accountSettings, transactions]);

  const adjustBaseBalance = useCallback(async (newBalance) => {
    const result = await saveAccountSettings(newBalance);
    if (result && !result.error) {
      setAccountSettings((prev) => ({ ...prev, ...result }));
      return true;
    }
    return false;
  }, []);

  const adjustSavingsBase = useCallback(async (newSavingsBase) => {
    const result = await saveSavingsBase(newSavingsBase);
    if (result && !result.error) {
      setAccountSettings((prev) => ({ ...prev, ...result }));
      return true;
    }
    return false;
  }, []);

  const byCategory = useMemo(() => {
    const map = {};
    monthTx.filter(isRealExpense).forEach((t) => { map[t.category] = (map[t.category] || 0) + Math.abs(t.amount); });
    return Object.entries(map)
      .map(([id, value]) => ({ id, name: getCat(id).label, value, color: getCat(id).color, icon: getCat(id).icon }))
      .sort((a, b) => b.value - a.value);
  }, [monthTx, getCat, isRealExpense]);

  const byIncomeCategory = useMemo(() => {
    const map = {};
    monthTx.filter((t) => t.amount > 0).forEach((t) => { map[t.category] = (map[t.category] || 0) + t.amount; });
    return Object.entries(map)
      .map(([id, value]) => ({ id, name: getCat(id).label, value, color: getCat(id).color, icon: getCat(id).icon }))
      .sort((a, b) => b.value - a.value);
  }, [monthTx, getCat]);

  const byMonth = useMemo(() => {
    const map = {};
    transactions.forEach((t) => {
      const mk = monthKey(t.date);
      if (!mk) return;
      if (!map[mk]) map[mk] = { month: mk, ingresos: 0, gastos: 0 };
      if (t.amount > 0) map[mk].ingresos += t.amount; else if (isRealExpense(t)) map[mk].gastos += Math.abs(t.amount);
    });
    return Object.values(map).sort((a, b) => (a.month > b.month ? 1 : -1)).slice(-6);
  }, [transactions, isRealExpense]);

  const dailySpend = useMemo(() => {
    const map = {};
    transactions.forEach((t) => {
      if (!t.date || !isRealExpense(t)) return;
      map[t.date] = (map[t.date] || 0) + Math.abs(t.amount);
    });
    return map;
  }, [transactions, isRealExpense]);

  // "hero" del dashboard: TODO lo gastado con fecha en el mes seleccionado
  // (el del filtro de arriba), sin importar el día — el banco a veces le
  // pone fecha del lunes siguiente a movimientos del fin de semana, así que
  // un cargo fechado "mañana" igual cuenta como gasto de ese mes.
  const heroStat = useMemo(() => {
    const now = new Date();
    const realThisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const thisMonthKey = currentMonth || realThisMonthKey;
    const isRealCurrentMonth = thisMonthKey === realThisMonthKey;
    const [y, m] = thisMonthKey.split("-").map(Number);
    // mes en curso: "hasta hoy". Mes ya cerrado: el mes completo (últimO día).
    const dayOfMonth = isRealCurrentMonth ? now.getDate() : new Date(y, m, 0).getDate();

    let spentSoFar = 0;
    for (const [date, amt] of Object.entries(dailySpend)) {
      if (date.slice(0, 7) === thisMonthKey) spentSoFar += amt;
    }

    // "ritmo habitual": mismo tramo (día 1 al día X) pero del mes calendario
    // inmediatamente anterior al seleccionado — "manzanas con manzanas". La
    // versión anterior escalaba el TOTAL del mes por una fracción de días
    // (total * día/díasDelMes), lo que asume gasto parejo día a día y
    // distorsiona el % apenas hay un gasto grande fuera de ese tramo (ej. un
    // pago grande el día 25 "contaba" como si ya hubiera pasado el día 5).
    // Comparar el mismo rango real de fechas evita esa distorsión.
    const prevMonthDate = new Date(y, m - 2, 1);
    const prevMonthKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}`;
    const hasPrevMonthData = transactions.some((t) => monthKey(t.date) === prevMonthKey);

    let typicalPace = null;
    if (hasPrevMonthData) {
      typicalPace = 0;
      for (const [date, amt] of Object.entries(dailySpend)) {
        if (date.slice(0, 7) !== prevMonthKey) continue;
        const day = Number(date.slice(8, 10));
        if (day <= dayOfMonth) typicalPace += amt;
      }
    }

    return { spentSoFar, typicalPace, dayOfMonth, monthKey: thisMonthKey, isRealCurrentMonth };
  }, [dailySpend, transactions, currentMonth]);

  const insights = useMemo(() => {
    const [y, m] = (currentMonth || `${new Date().getFullYear()}-${new Date().getMonth() + 1}`).split("-").map(Number);
    return computeInsights(transactions, excludedCategoryIds, (id) => getCat(id).label, new Date(y, m - 1, 1));
  }, [transactions, excludedCategoryIds, getCat, currentMonth]);

  const reconcileStats = useMemo(() => {
    if (!currentMonth) return null;
    const inMonth = transactions.filter((t) => monthKey(t.date) === currentMonth);
    // los manuales que quedan en pie son, por definición, los que todavía no
    // se conciliaron: al conciliar (automático o "vincular a mano") la fila
    // manual se fusiona en la del banco y desaparece, así que ya no hace
    // falta filtrar por `reconciled` acá.
    const manuals = inMonth.filter((t) => t.source === "manual");
    const banks = inMonth.filter((t) => t.source === "bank");
    const bankExists = banks.length > 0;
    const confirmed = banks.filter((t) => t.matchedId);
    const bankOnly = banks.filter((t) => !t.matchedId);
    // candidatos para vincular a mano un "posible descuadre": además de lo
    // sin vincular de este mes, suma lo del mes siguiente — un traspaso de
    // fin de mes puede quedar con fecha contable ya en el mes que sigue (ver
    // reconcileMonth), así que el banco podría haberlo anotado ahí.
    const nextKey = nextMonthKey(currentMonth);
    const nextMonthBankOnly = transactions.filter((t) => t.source === "bank" && !t.matchedId && monthKey(t.date) === nextKey);
    return {
      manuals, confirmed, bankExists,
      pendingNoReport: bankExists ? [] : manuals,
      pendingMismatch: bankExists ? manuals : [],
      bankOnly,
      linkCandidates: [...bankOnly, ...nextMonthBankOnly],
    };
  }, [transactions, currentMonth]);

  // "salud" de conciliación por mes, para el selector de meses en la
  // pestaña Conciliación (✓ verde: todo lo manual calzó / ⚠ ámbar: hay
  // reporte del banco pero algo manual sigue sin calzar). Sin badge si el
  // mes nunca tuvo movimientos manuales que conciliar, o si aún no se
  // importa el reporte del banco de ese mes (nada que evaluar todavía).
  const monthHealth = useMemo(() => {
    const map = {};
    for (const mk of months) {
      const inMonth = transactions.filter((t) => monthKey(t.date) === mk);
      const manuals = inMonth.filter((t) => t.source === "manual");
      // los que ya se fusionaron con el banco tampoco quedan como manual —
      // sin esto, un mes 100% conciliado (manuals.length === 0) se vería
      // idéntico a un mes que nunca tuvo movimientos manuales.
      const mergedCount = inMonth.filter((t) => t.source === "bank" && t.matchedId).length;
      if (manuals.length === 0 && mergedCount === 0) continue;
      const bankExists = inMonth.some((t) => t.source === "bank");
      if (!bankExists) continue;
      map[mk] = manuals.length > 0 ? "warn" : "ok";
    }
    return map;
  }, [transactions, months]);

  if (!loaded) {
    return <AppShellSkeleton />;
  }

  return (
    <div style={{ background: TOKENS.bg, minHeight: "100vh", color: TOKENS.text, fontFamily: "'Inter', sans-serif" }}>
      <Header tab={tab} setTab={setTab} onSignOut={onSignOut} theme={theme} onToggleTheme={onToggleTheme} saving={saving} />

      <main className="app-main" style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 24px 80px" }}>
        {syncError && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
            background: "var(--tint-expense)", border: `1px solid ${TOKENS.expense}`, color: TOKENS.expense,
            borderRadius: 10, padding: "10px 14px", fontSize: 12.5, marginBottom: 18,
          }}>
            <span>{syncError}</span>
            <button onClick={() => setSyncError(null)} style={{ background: "transparent", border: "none", color: TOKENS.expense, cursor: "pointer", fontSize: 12.5 }}>
              Cerrar
            </button>
          </div>
        )}
        {tab !== "categorias" && tab !== "suscripciones" && (
          <MonthBar
            months={months} monthFilter={monthFilter} setMonthFilter={setMonthFilter}
            monthHealth={tab === "conciliacion" ? monthHealth : undefined}
          />
        )}

        <div key={tab} className="tab-panel">
        {tab === "categorias" && (
          <CategoryManager
            categories={categories} onAdd={addCategory} onRename={renameCategory} onDelete={deleteCategory}
            onIconChange={changeCategoryIcon} onColorChange={changeCategoryColor} onToggleExpense={toggleCategoryExpense}
            onBudgetChange={changeCategoryBudget} onTypeChange={changeCategoryType} onSavingsToggle={toggleCategorySavings}
          />
        )}

        {tab === "suscripciones" && (
          <Subscriptions
            subscriptions={subscriptions} categories={categories}
            onAdd={addSubscription} onUpdate={updateSubscription} onDelete={deleteSubscription}
          />
        )}

        {tab === "resumen" && (
          <ErrorBoundary>
            <Suspense fallback={<ResumenSkeleton />}>
              <Resumen
                stats={stats} byCategory={byCategory} byIncomeCategory={byIncomeCategory} categories={categories} byMonth={byMonth} currentMonth={currentMonth}
                dailySpend={dailySpend} hasTransactions={transactions.length > 0} heroStat={heroStat}
                insights={insights} pushToast={pushToast}
                dynamicBalance={dynamicBalance} lastSyncDate={accountSettings?.lastSyncDate}
                onAdjustBalance={adjustBaseBalance}
                onCategoryClick={goToCategoryMovements}
                totalSavings={totalSavings}
                onAdjustSavings={adjustSavingsBase}
              />
            </Suspense>
          </ErrorBoundary>
        )}

        {tab === "movimientos" && (
          <ErrorBoundary>
            <Suspense fallback={<MovimientosSkeleton />}>
              <Movimientos
                filteredTx={filteredTx}
                hasTransactions={transactions.length > 0}
                categories={categories}
                getCat={getCat}
                search={search} setSearch={setSearch}
                catFilter={catFilter} setCatFilter={setCatFilter}
                txTypeFilter={txTypeFilter} setTxTypeFilter={setTxTypeFilter}
                saveTxEdit={saveTxEdit}
                deleteTransaction={deleteTransaction}
                showManualForm={showManualForm} setShowManualForm={setShowManualForm}
                showImportModal={showImportModal} setShowImportModal={setShowImportModal}
                addManual={addManual}
                onAddCategory={addCategory}
                handleFile={handleFile}
                isImporting={isImporting}
                pushToast={pushToast}
                onBulkDelete={bulkDeleteTransactions}
                onBulkChangeCategory={bulkChangeCategory}
                recentImportIds={recentImportIds}
                onClearRecentImports={() => setRecentImportIds([])}
                duplicateIds={duplicateIds}
                onOpenConciliacion={() => setTab("conciliacion")}
                reconcileStats={reconcileStats}
                onToggleSubscription={toggleTxSubscription}
              />
            </Suspense>
          </ErrorBoundary>
        )}

        {tab === "conciliacion" && (
          <ErrorBoundary>
            <Suspense fallback={<MovimientosSkeleton />}>
              <Conciliacion
                currentMonth={currentMonth} reconcileStats={reconcileStats} reconcileMonth={reconcileMonth}
                onEditManual={editManualEntry} onManualMatch={manualMatch}
                onBack={() => setTab("movimientos")}
              />
            </Suspense>
          </ErrorBoundary>
        )}
        </div>
      </main>

      <BottomNav tab={tab} setTab={setTab} onManual={openManualEntry} onImport={openImportFlow} />
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      {showOnboarding && <Onboarding onDone={dismissOnboarding} />}
    </div>
  );
}
