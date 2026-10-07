// Acciones sobre los "catálogos" del usuario: categorías, suscripciones
// declaradas y reglas de comercio. Mismo patrón que useTransactionActions: arma el array
// siguiente y lo persiste con useAppData.
import { useCallback } from "react";
import { PALETTE } from "../lib/constants.js";
import { uid } from "../lib/utils.js";
import { saveMerchantRule, applyRuleToExisting } from "../lib/transactionOps.js";

/** @param {ReturnType<typeof import("./useAppData.js").useAppData>} data */
export function useCatalogActions(data) {
  const {
    categories, transactions, creditTransactions, subscriptions, merchantRules,
    persistCats, persistTx, persistCreditTx, persistSubs, persistRules,
  } = data;

  // patch de una categoría por id
  const patchCategory = useCallback(
    (id, fn) => { persistCats(categories.map((c) => (c.id === id ? { ...c, ...fn(c) } : c))); },
    [categories, persistCats]
  );

  const addCategory = useCallback(
    (label, icon, color, type) => {
      const id = "cat_" + uid();
      const resolvedColor = color || PALETTE[categories.length % PALETTE.length];
      persistCats([...categories, { id, label, color: resolvedColor, icon: icon || "Shapes", type: type === "income" ? "income" : "expense", excludeFromExpense: false, budget: null }]);
      return id;
    },
    [categories, persistCats]
  );
  const renameCategory = useCallback((id, label) => patchCategory(id, () => ({ label })), [patchCategory]);
  const changeCategoryIcon = useCallback((id, icon) => patchCategory(id, () => ({ icon })), [patchCategory]);
  const changeCategoryColor = useCallback((id, color) => patchCategory(id, () => ({ color })), [patchCategory]);
  const changeCategoryType = useCallback(
    (id, type) => patchCategory(id, () => ({ type: type === "income" ? "income" : "expense" })),
    [patchCategory]
  );
  // budget null/0 = sin presupuesto definido para esa categoría
  const changeCategoryBudget = useCallback(
    (id, budget) => patchCategory(id, () => ({ budget: budget > 0 ? budget : null })),
    [patchCategory]
  );
  const toggleCategoryExpense = useCallback(
    (id) => patchCategory(id, (c) => ({ excludeFromExpense: !c.excludeFromExpense })),
    [patchCategory]
  );
  const toggleCategorySavings = useCallback(
    (id) => patchCategory(id, (c) => ({ isSavings: !c.isSavings })),
    [patchCategory]
  );
  // al borrar una categoría, sus movimientos, suscripciones y reglas de
  // comercio pasan a "otros" (una regla apuntando a una categoría que ya no
  // existe seguiría categorizando importaciones hacia la nada)
  const deleteCategory = useCallback(
    (id) => {
      persistCats(categories.filter((c) => c.id !== id));
      persistTx(transactions.map((t) => (t.category === id ? { ...t, category: "otros" } : t)));
      persistSubs(subscriptions.map((s) => (s.category === id ? { ...s, category: "otros" } : s)));
      if (merchantRules.some((r) => r.categoryId === id)) {
        persistRules(merchantRules.map((r) => (r.categoryId === id ? { ...r, categoryId: "otros" } : r)));
      }
    },
    [categories, transactions, subscriptions, merchantRules, persistCats, persistTx, persistSubs, persistRules]
  );

  const addSubscription = useCallback(
    ({ name, amount, category, dayOfMonth, frequency = "monthly", monthOfYear = null, endDate = null }) => {
      persistSubs([
        ...subscriptions,
        { id: "sub_" + uid(), name, amount: Math.abs(amount), category, dayOfMonth, active: true, frequency, monthOfYear, endDate },
      ]);
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

  // ---- reglas de comercio ----------------------------------------------------
  const saveRule = useCallback(
    (rule) => persistRules(saveMerchantRule(merchantRules, rule.id ? rule : { ...rule, id: uid() })),
    [merchantRules, persistRules]
  );
  const deleteRule = useCallback(
    (id) => persistRules(merchantRules.filter((r) => r.id !== id)),
    [merchantRules, persistRules]
  );
  // mismo alcance que "Recordar esto" (ver applyCategoryEdit): en débito solo
  // toca movimientos del banco; en la tarjeta, todos.
  const previewRule = useCallback(
    (rule) => ({
      debit: applyRuleToExisting(transactions, rule, { bankOnly: true }).changed,
      credit: applyRuleToExisting(creditTransactions, rule).changed,
    }),
    [transactions, creditTransactions]
  );
  const applyRule = useCallback(
    async (rule) => {
      const debit = applyRuleToExisting(transactions, rule, { bankOnly: true });
      const credit = applyRuleToExisting(creditTransactions, rule);
      const okDebit = debit.next === transactions || (await persistTx(debit.next));
      const okCredit = credit.next === creditTransactions || (await persistCreditTx(credit.next));
      return okDebit && okCredit;
    },
    [transactions, creditTransactions, persistTx, persistCreditTx]
  );

  return {
    addCategory, renameCategory, changeCategoryIcon, changeCategoryColor, changeCategoryType,
    changeCategoryBudget, toggleCategoryExpense, toggleCategorySavings, deleteCategory,
    addSubscription, updateSubscription, deleteSubscription,
    saveRule, deleteRule, previewRule, applyRule,
  };
}
