// Estado de datos de la app + persistencia optimista contra Supabase. Es la
// única puerta de escritura: todo cambio pasa por un persist* (aplica local,
// guarda, y revierte si Supabase lo rechaza). Lo usa App.jsx y se lo pasa a
// los hooks de acciones/importación.
import { useState, useEffect, useCallback, useRef } from "react";
import { DEFAULT_CATEGORIES } from "../lib/constants.js";
import { storage } from "../lib/storage.js";
import { getAccountSettings, saveAccountSettings, saveSavingsBase } from "../lib/accountSettings.js";
import { makeSubscriptionCharges } from "../lib/transactionOps.js";

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
  const [accountSettings, setAccountSettings] = useState(null); // AccountSettings | null (todavía no ajustado)
  const [loaded, setLoaded] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [saving, setSaving] = useState(false);

  // guardados a Supabase todavía en vuelo — se usa para (1) no dejar que el
  // refetch automático de loadAllData pise con datos viejos un cambio
  // aplicado localmente pero aún sin confirmar, y (2) avisar antes de
  // cerrar/recargar la pestaña si hay algo en camino.
  const pendingSaves = useRef(0);
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

  // Núcleo optimista compartido por todos los persist*: aplica el cambio ya,
  // y si Supabase lo rechaza revierte el estado local (con `prev`, la foto
  // anterior) en vez de dejarlo "aplicado" solo de mentira. `trackError`
  // guarda el error en lastPersistError para quien lo lee tras un await.
  const runPersist = useCallback(async (storageKey, prev, next, setLocal, { trackError = false } = {}) => {
    setLocal(next);
    beginSave();
    const res = await storage.set(storageKey, JSON.stringify(next), prev);
    endSave();
    if (trackError) lastPersistError.current = res?.error || null;
    if (!res || res.error) {
      setLocal(prev);
      const detail = res?.error ? ` (${res.error})` : "";
      setSyncError(`No se pudo guardar en el servidor. Revisa tu conexión — se revirtió el cambio, inténtalo de nuevo.${detail}`);
      return false;
    }
    setSyncError(null);
    return true;
  }, [beginSave, endSave]);

  const persistTx = useCallback(
    (next) => runPersist("transactions", transactions, next, setTransactions, { trackError: true }),
    [transactions, runPersist]
  );
  const persistCreditTx = useCallback(
    (next) => runPersist("creditTransactions", creditTransactions, next, setCreditTransactions, { trackError: true }),
    [creditTransactions, runPersist]
  );
  const persistCreditStatements = useCallback(
    (next) => runPersist("creditStatements", creditStatements, next, setCreditStatements, { trackError: true }),
    [creditStatements, runPersist]
  );
  const persistCats = useCallback(
    (next) => runPersist("categories", categories, next, setCategories),
    [categories, runPersist]
  );
  const persistRules = useCallback(
    (next) => runPersist("merchantRules", merchantRules, next, setMerchantRules),
    [merchantRules, runPersist]
  );
  const persistSubs = useCallback(
    (next) => runPersist("subscriptions", subscriptions, next, setSubscriptions),
    [subscriptions, runPersist]
  );

  const loadAllData = useCallback(async () => {
    const tx = await storage.get("transactions");
    if (tx) setTransactions(JSON.parse(tx.value));

    const creditTx = await storage.get("creditTransactions");
    if (creditTx) setCreditTransactions(JSON.parse(creditTx.value));

    const creditStmts = await storage.get("creditStatements");
    if (creditStmts) setCreditStatements(JSON.parse(creditStmts.value));

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

    // null es un estado válido (usuario que nunca ajustó su saldo), así que
    // no cuenta para el syncError de abajo.
    setAccountSettings(await getAccountSettings());

    if (!tx || !cats || !rules || !subs || !creditTx || !creditStmts) {
      setSyncError("No se pudieron cargar todos tus datos. Revisa tu conexión y recarga la página.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- persistCats solo se usa para sembrar defaults, no hace falta re-crear esta función si cambia
  }, []);

  useEffect(() => {
    loadAllData().then(() => setLoaded(true));

    // no hay sync en vivo entre dispositivos: se recarga al volver a la
    // pestaña. Se salta si hay un guardado en curso, para no pisar el estado
    // optimista con una lectura que todavía no trae el cambio.
    const onVisible = () => { if (document.visibilityState === "visible" && pendingSaves.current === 0) loadAllData(); };
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
  }, [loadAllData]);

  // genera, una sola vez por sesión, los cargos pendientes de suscripciones
  // del mes en curso (ver makeSubscriptionCharges).
  const subscriptionChargesRanRef = useRef(false);
  useEffect(() => {
    if (!loaded || subscriptionChargesRanRef.current || subscriptions.length === 0) return;
    subscriptionChargesRanRef.current = true;
    const now = new Date();
    const toGenerate = makeSubscriptionCharges(subscriptions, transactions, now, now.toISOString());
    if (toGenerate.length > 0) persistTx([...transactions, ...toGenerate]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- corre una sola vez por sesión (ref guard); no hace falta re-crear el efecto con cada cambio de transactions/persistTx
  }, [loaded, subscriptions]);

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

  return {
    transactions, creditTransactions, creditStatements, categories, merchantRules, subscriptions,
    accountSettings, setAccountSettings, adjustBaseBalance, adjustSavingsBase,
    loaded, saving, syncError, setSyncError, lastPersistError,
    persistTx, persistCreditTx, persistCreditStatements, persistCats, persistRules, persistSubs,
  };
}
