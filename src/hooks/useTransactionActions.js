// Acciones sobre movimientos (débito y crédito) y conciliación. Cada una
// arma el array siguiente con las funciones puras de src/lib y lo persiste
// con el persist* correspondiente de useAppData (optimista + rollback).
import { useCallback, useRef } from "react";
import { reconcileMonthTransactions, matchManualToBank } from "../lib/reconcile.js";
import {
  makeManualTransaction, upsertMerchantRule, applyCategoryEdit, editManualDateAmount, linkTransactionToSubscription,
} from "../lib/transactionOps.js";

/**
 * @param {ReturnType<typeof import("./useAppData.js").useAppData>} data
 * @param {{ onManualAdded?: () => void, pushToast?: Function }} [opts]
 */
export function useTransactionActions(data, { onManualAdded, pushToast } = {}) {
  const {
    transactions, creditTransactions, merchantRules, subscriptions,
    persistTx, persistCreditTx, persistRules, persistSubs,
  } = data;

  // "Deshacer" corre segundos después, desde un aviso: tiene que reinsertar
  // sobre los datos de ESE momento (y con el persist* de ese momento), no
  // sobre la foto que existía al borrar.
  const latest = useRef(data);
  latest.current = data;

  // Borrar es inmediato y se ofrece "Deshacer": más rápido que confirmar
  // antes, y protege mejor (un error se revierte, una confirmación se acepta
  // por reflejo). Deshacer reinserta las mismas filas — mismo id y mismo
  // createdAt, del que dependen el saldo dinámico y el orden del día.
  // `kind` elige débito ("tx") o tarjeta ("credit").
  const deleteWithUndo = useCallback(
    async (kind, ids) => {
      const idSet = new Set(ids);
      const list = kind === "credit" ? creditTransactions : transactions;
      const persist = kind === "credit" ? persistCreditTx : persistTx;
      const removed = list.filter((t) => idSet.has(t.id));
      if (removed.length === 0) return false;
      const ok = await persist(list.filter((t) => !idSet.has(t.id)));
      if (!ok) return false;
      const n = removed.length;
      pushToast?.("ok", n === 1 ? "Movimiento eliminado." : `${n} movimientos eliminados.`, null, {
        duration: 6000,
        action: {
          label: "Deshacer",
          onClick: async () => {
            const cur = latest.current;
            const curList = kind === "credit" ? cur.creditTransactions : cur.transactions;
            const curPersist = kind === "credit" ? cur.persistCreditTx : cur.persistTx;
            const present = new Set(curList.map((t) => t.id));
            const restored = await curPersist([...curList, ...removed.filter((t) => !present.has(t.id))]);
            if (restored) pushToast?.("ok", n === 1 ? "Movimiento restaurado." : `${n} movimientos restaurados.`);
          },
        },
      });
      return true;
    },
    [transactions, creditTransactions, persistTx, persistCreditTx, pushToast]
  );

  // ---- débito: alta, borrado, edición ---------------------------------------
  const addManual = useCallback(
    async (entry) => {
      await persistTx([...transactions, makeManualTransaction(entry, new Date().toISOString())]);
      onManualAdded?.();
    },
    [transactions, persistTx, onManualAdded]
  );

  const deleteTransaction = useCallback((id) => deleteWithUndo("tx", [id]), [deleteWithUndo]);

  // acciones masivas: mismo camino que cualquier otro cambio — persistTx ya
  // diffea contra Supabase y hace rollback; acá solo se arma `next` y se
  // devuelve si funcionó.
  const bulkDeleteTransactions = useCallback((ids) => deleteWithUndo("tx", ids), [deleteWithUndo]);
  const bulkChangeCategory = useCallback(
    async (ids, categoryId) => {
      const idSet = new Set(ids);
      return persistTx(transactions.map((t) => (idSet.has(t.id) ? { ...t, category: categoryId } : t)));
    },
    [transactions, persistTx]
  );

  // si `remember`, guarda la regla de comercio y la aplica retroactivamente.
  // Débito y crédito comparten merchantRules (muchas descripciones se
  // repiten entre ambas, ej. "FALABELLA.COM").
  const rememberRule = useCallback(
    async ({ category, alias, remember, matchText }) => {
      const mt = remember && matchText ? matchText.trim() : "";
      if (!mt) return null;
      await persistRules(upsertMerchantRule(merchantRules, mt, category, alias));
      return mt;
    },
    [merchantRules, persistRules]
  );

  const saveTxEdit = useCallback(
    async (txId, edit) => {
      const mt = await rememberRule(edit);
      await persistTx(applyCategoryEdit(transactions, txId, edit, mt, { bankOnly: true }));
    },
    [transactions, persistTx, rememberRule]
  );

  // marca/desmarca un movimiento como suscripción. Al desmarcar solo se
  // desvincula este movimiento; la suscripción y otros vinculados quedan.
  const toggleTxSubscription = useCallback(
    (txId, isSubscription) => {
      if (!isSubscription) {
        persistTx(transactions.map((t) => (t.id === txId ? { ...t, subscriptionId: null } : t)));
        return;
      }
      const res = linkTransactionToSubscription(transactions, subscriptions, txId);
      if (!res) return;
      if (res.newSubscription) persistSubs([...subscriptions, res.newSubscription]);
      persistTx(res.transactions);
    },
    [transactions, subscriptions, persistTx, persistSubs]
  );

  // ---- crédito: edición y borrado -------------------------------------------
  const editCreditTxEntry = useCallback(
    async (txId, edit) => {
      const mt = await rememberRule(edit);
      await persistCreditTx(applyCategoryEdit(creditTransactions, txId, edit, mt));
    },
    [creditTransactions, persistCreditTx, rememberRule]
  );
  const deleteCreditTransaction = useCallback((id) => deleteWithUndo("credit", [id]), [deleteWithUndo]);

  // ---- conciliación ---------------------------------------------------------
  // Conciliar FUSIONA el manual con el del banco (algoritmo en
  // src/lib/reconcile.js). Devuelve cuántos se fusionaron, para el toast.
  const reconcileMonth = useCallback(
    (mKey) => {
      const { next, merged } = reconcileMonthTransactions(transactions, mKey);
      if (merged > 0) persistTx(next);
      return merged;
    },
    [transactions, persistTx]
  );

  // corrige fecha/monto de un manual sin salir de Conciliación.
  const editManualEntry = useCallback(
    (txId, patch) => {
      const next = editManualDateAmount(transactions, txId, patch);
      if (next !== transactions) persistTx(next);
    },
    [transactions, persistTx]
  );

  // vínculo manual↔banco cuando el calce automático no lo encontró.
  const manualMatch = useCallback(
    (manualId, bankId) => {
      const next = matchManualToBank(transactions, manualId, bankId);
      if (next !== transactions) persistTx(next);
    },
    [transactions, persistTx]
  );

  return {
    addManual, deleteTransaction, bulkDeleteTransactions, bulkChangeCategory, saveTxEdit, toggleTxSubscription,
    editCreditTxEntry, deleteCreditTransaction,
    reconcileMonth, editManualEntry, manualMatch,
  };
}
