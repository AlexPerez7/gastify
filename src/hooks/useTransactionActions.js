// Acciones sobre movimientos (débito y crédito) y conciliación. Cada una
// arma el array siguiente con las funciones puras de src/lib y lo persiste
// con el persist* correspondiente de useAppData (optimista + rollback).
import { useCallback } from "react";
import { reconcileMonthTransactions, matchManualToBank } from "../lib/reconcile.js";
import {
  makeManualTransaction, upsertMerchantRule, applyCategoryEdit, editManualDateAmount, linkTransactionToSubscription,
} from "../lib/transactionOps.js";

/**
 * @param {ReturnType<typeof import("./useAppData.js").useAppData>} data
 * @param {{ onManualAdded?: () => void }} [opts]
 */
export function useTransactionActions(data, { onManualAdded } = {}) {
  const {
    transactions, creditTransactions, merchantRules, subscriptions,
    persistTx, persistCreditTx, persistRules, persistSubs,
  } = data;

  // ---- débito: alta, borrado, edición ---------------------------------------
  const addManual = useCallback(
    async (entry) => {
      await persistTx([...transactions, makeManualTransaction(entry, new Date().toISOString())]);
      onManualAdded?.();
    },
    [transactions, persistTx, onManualAdded]
  );

  const deleteTransaction = useCallback((id) => { persistTx(transactions.filter((t) => t.id !== id)); }, [transactions, persistTx]);

  // acciones masivas: mismo camino que cualquier otro cambio — persistTx ya
  // diffea contra Supabase y hace rollback; acá solo se arma `next` y se
  // devuelve si funcionó.
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
  const deleteCreditTransaction = useCallback(
    (id) => { persistCreditTx(creditTransactions.filter((t) => t.id !== id)); },
    [creditTransactions, persistCreditTx]
  );

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
