// Estado de datos de la app + persistencia optimista contra Supabase. Es la
// única puerta de escritura: todo cambio pasa por un persist* (aplica local,
// guarda, y revierte si Supabase lo rechaza). Lo usa App.jsx y se lo pasa a
// los hooks de acciones/importación.
import { useState, useEffect, useCallback, useRef } from "react";
import { DEFAULT_CATEGORIES } from "../lib/constants.js";
import { storage } from "../lib/storage.js";
import { getAccountSettings, saveAccountSettings, saveSavingsBase } from "../lib/accountSettings.js";
import { makeSubscriptionCharges, reconcileSubscriptionCharges } from "../lib/transactionOps.js";
import { createPersistenceQueue } from "../lib/persistenceQueue.js";
import { removeCategorySafely } from "../lib/catalogOperations.js";

export function useAppData() {
  const [transactions, setTransactions] = useState([]);
  // tarjeta de crédito (CMR) — deliberadamente separada de `transactions`:
  // no entra en stats/dynamicBalance/heroStat/insights/conciliación, para no
  // duplicar el gasto (el pago de la tarjeta ya aparece como cargo real en
  // el débito). Ver toggle Débito/Crédito en Movimientos.jsx.
  const [creditTransactions, setCreditTransactions] = useState([]);
  // resumen del Estado de Cuenta CMR (PDF) — una fila por ciclo.
  const [creditStatements, setCreditStatements] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [merchantRules, setMerchantRules] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [accountSettings, updateAccountSettings] = useState(null);
  const accountVersion = useRef(0);
  const setAccountSettings = useCallback((next) => {
    accountVersion.current += 1;
    updateAccountSettings(next);
  }, []);
  const [subscriptionDataReady, setSubscriptionDataReady] = useState(false);
  const loadVersion = useRef(0);
  const [loaded, setLoaded] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [persistence] = useState(() => {
    const setters = {
      transactions: setTransactions, creditTransactions: setCreditTransactions,
      creditStatements: setCreditStatements, categories: setCategories,
      merchantRules: setMerchantRules, subscriptions: setSubscriptions,
    };
    return createPersistenceQueue({
      write: (key, value, prev) => storage.set(key, value, prev),
      onChange: (key, rows) => setters[key](rows),
    });
  });

  // guardados a Supabase todavía en vuelo — se usa para (1) no dejar que el
  // refetch automático de loadAllData pise con datos viejos un cambio
  // aplicado localmente pero aún sin confirmar, y (2) avisar antes de
  // cerrar/recargar la pestaña si hay algo en camino.
  const pendingSaves = useRef(0);
  const catalogLocked = useRef(false);
  // detalle del último error real de Supabase (RLS, columna inexistente,
  // sesión vencida…) — un ref porque los importadores lo leen justo después
  // de un `await persistX(...)`, y `syncError` no se actualiza a tiempo
  // dentro de la misma función.
  const lastPersistError = useRef(null);

  const beginSave = useCallback(() => { pendingSaves.current += 1; setSaving(true); }, []);
  const endSave = useCallback(() => {
    pendingSaves.current = Math.max(0, pendingSaves.current - 1);
    if (pendingSaves.current === 0) setSaving(false);
  }, []);

  // La cola publica el estado optimista y serializa por tabla. En error
  // descarta esa intención y conserva las ediciones posteriores.
  const runPersist = useCallback(async (storageKey, prev, next, { trackError = false } = {}) => {
    if (catalogLocked.current) {
      setSyncError("Espera a que termine la eliminación de la categoría y vuelve a intentar.");
      return false;
    }
    beginSave();
    const res = await persistence.persist(storageKey, prev, next);
    endSave();
    if (trackError) lastPersistError.current = res?.error || null;
    if (!res || res.error) {
      const detail = res?.error ? ` (${res.error})` : "";
      setSyncError(
        res && "conflict" in res && res.conflict
          ? "El registro cambió en otra sesión. Se descartó este cambio local; vuelve a cargar los datos antes de reintentar."
          : res && "duplicate" in res && res.duplicate
          ? `No se pudo guardar: ya existe un movimiento con la misma clave — se revirtió el cambio.${detail}`
          : `No se pudo guardar en el servidor. Revisa tu conexión — se revirtió el cambio, inténtalo de nuevo.${detail}`
      );
      return false;
    }
    setSyncError(null);
    return true;
  }, [beginSave, endSave, persistence]);

  const persistTx = useCallback(
    (next) => runPersist("transactions", transactions, next, { trackError: true }),
    [transactions, runPersist]
  );
  const persistCreditTx = useCallback(
    (next) => runPersist("creditTransactions", creditTransactions, next, { trackError: true }),
    [creditTransactions, runPersist]
  );
  const persistCreditStatements = useCallback(
    (next) => runPersist("creditStatements", creditStatements, next, { trackError: true }),
    [creditStatements, runPersist]
  );
  const persistCats = useCallback(
    (next) => runPersist("categories", categories, next),
    [categories, runPersist]
  );
  const persistRules = useCallback(
    (next) => runPersist("merchantRules", merchantRules, next),
    [merchantRules, runPersist]
  );
  const persistSubs = useCallback(
    (next) => runPersist("subscriptions", subscriptions, next),
    [subscriptions, runPersist]
  );

  const loadAllData = useCallback(async () => {
    const loadId = ++loadVersion.current;
    setSubscriptionDataReady(false);
    const read = async (key) => {
      const version = persistence.version(key);
      const result = await storage.get(key);
      if (!result) return null;
      const rows = JSON.parse(result.value);
      const accepted = persistence.acceptLoad(key, rows, version);
      // El diff debe partir de las categorías realmente leídas (vacías),
      // no de los defaults que React muestra durante la carga inicial.
      if (accepted && key === "categories" && rows.length === 0) {
        if (!await runPersist(key, [], DEFAULT_CATEGORIES)) return null;
      }
      return result;
    };
    const tx = await read("transactions");

    const creditTx = await read("creditTransactions");

    const creditStmts = await read("creditStatements");

    const cats = await read("categories");

    const rules = await read("merchantRules");

    const subs = await read("subscriptions");

    // Un error de red no es "sin saldo ajustado". Conserva el ancla conocida
    // y no permite que una lectura vieja pise un ajuste hecho mientras carga.
    const settingsVersion = accountVersion.current;
    let settingsFailed = false;
    try {
      const settings = await getAccountSettings({ throwOnError: true });
      if (loadId === loadVersion.current && settingsVersion === accountVersion.current) {
        updateAccountSettings(settings);
      }
    } catch { settingsFailed = true; }
    if (loadId !== loadVersion.current) return;
    const complete = !!tx && !!cats && !!rules && !!subs && !!creditTx && !!creditStmts && !settingsFailed;
    setSubscriptionDataReady(complete);
    if (complete) {
      setDataReady(true);
      setSyncError(null);
    }

    if (!complete) {
      setSyncError("No se pudieron cargar todos tus datos. Revisa tu conexión y recarga la página.");
    }
  }, [persistence, runPersist]);

  const reload = useCallback(async () => {
    setLoaded(false);
    try { await loadAllData(); }
    catch { setSyncError("No se pudieron cargar tus datos. Revisa tu conexión y vuelve a intentar."); }
    finally { setLoaded(true); }
  }, [loadAllData]);

  const removeCategory = useCallback(async (id) => {
    if (catalogLocked.current) return false;
    catalogLocked.current = true;
    beginSave();
    try {
      await persistence.whenIdle();
      const result = await removeCategorySafely({ id,
        read: (key) => persistence.snapshot(key),
        persist: async (key, prev, next) => {
          const saved = await persistence.persist(key, prev, next);
          return !!saved && !saved.error;
        },
        removeAtomic: storage.deleteCategory,
      });
      if (!result.ok) { setSyncError(result.error); return false; }
      if (result.atomic) await loadAllData();
      else setSyncError(null);
      return true;
    } catch {
      setSyncError("No se pudo completar la eliminación de la categoría. Recarga tus datos antes de reintentar.");
      return false;
    } finally { catalogLocked.current = false; endSave(); }
  }, [beginSave, endSave, persistence, loadAllData]);

  useEffect(() => {
    void reload();

    // no hay sync en vivo entre dispositivos: se recarga al volver a la
    // pestaña. Se salta si hay un guardado en curso, para no pisar el estado
    // optimista con una lectura que todavía no trae el cambio.
    const onVisible = () => {
      if (document.visibilityState === "visible" && pendingSaves.current === 0) {
        void loadAllData().catch(() => setSyncError("No se pudieron actualizar tus datos. Revisa tu conexión."));
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    // cerrar/recargar con un guardado en vuelo corta el request y el cambio
    // se pierde — el aviso nativo da la chance de esperar.
    const onBeforeUnload = (e) => {
      if (pendingSaves.current > 0) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [loadAllData, reload]);

  // genera, una sola vez por sesión, los cargos pendientes de suscripciones
  // del mes en curso (ver makeSubscriptionCharges).
  const subscriptionChargesRanRef = useRef(false);
  useEffect(() => {
    if (!loaded || !subscriptionDataReady || subscriptionChargesRanRef.current || subscriptions.length === 0) return;
    subscriptionChargesRanRef.current = true;
    const now = new Date();
    const reconciled = reconcileSubscriptionCharges(subscriptions, transactions);
    const toGenerate = makeSubscriptionCharges(subscriptions, reconciled, now, now.toISOString());
    if (toGenerate.length > 0) persistTx([...reconciled, ...toGenerate]);
    else if (reconciled !== transactions) persistTx(reconciled);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- corre una sola vez por sesión (ref guard); no hace falta re-crear el efecto con cada cambio de transactions/persistTx
  }, [loaded, subscriptionDataReady, subscriptions]);

  const adjustBaseBalance = useCallback(async (newBalance) => {
    accountVersion.current += 1;
    beginSave();
    let result;
    try { result = await saveAccountSettings(newBalance); }
    finally { endSave(); }
    if (result && !result.error) {
      setAccountSettings((prev) => ({ ...prev, ...result }));
      return true;
    }
    return false;
  }, [beginSave, endSave, setAccountSettings]);

  const adjustSavingsBase = useCallback(async (newSavingsBase) => {
    accountVersion.current += 1;
    beginSave();
    let result;
    try { result = await saveSavingsBase(newSavingsBase); }
    finally { endSave(); }
    if (result && !result.error) {
      setAccountSettings((prev) => ({ ...prev, ...result }));
      return true;
    }
    return false;
  }, [beginSave, endSave, setAccountSettings]);

  return {
    transactions, creditTransactions, creditStatements, categories, merchantRules, subscriptions,
    accountSettings, setAccountSettings, adjustBaseBalance, adjustSavingsBase,
    loaded, dataReady, reload, saving, syncError, setSyncError, lastPersistError,
    persistTx, persistCreditTx, persistCreditStatements, persistCats, persistRules, persistSubs, removeCategory,
  };
}
