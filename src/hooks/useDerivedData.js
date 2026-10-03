// Todo lo que se calcula a partir de los datos (filtros, stats, gráficos,
// conciliación, crédito), memoizado. Los cálculos en sí son puros y están en
// src/lib/stats.js; acá solo se conectan con useMemo. También es dueño del
// mes seleccionado (débito y crédito), porque su valor por defecto depende
// de los meses que existen.
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { TOKENS, DEFAULT_CATEGORY_ICON, resolveCategoryIcon } from "../lib/constants.js";
import { findDuplicateIds } from "../lib/reconcile.js";
import { computeInsights, monthKeyOf } from "../lib/utils.js";
import {
  listMonths, listCreditMonths, filterByMonth, filterTransactions, excludedCategoryIdsOf, isRealExpense,
  computeMonthStats, sumByCategory, computeByMonth, computeDailySpend, computeHeroStat, computeTotalSavings,
  computeDynamicBalance, computeReconcileStats, computeMonthHealth, filterCreditByMonth, computeCreditStats,
  latestCreditStatement,
} from "../lib/stats.js";

// elige el primer mes de la lista como valor por defecto, una sola vez — así
// no pisa un cambio de mes que el usuario haga después (ej. si borra los
// movimientos del mes actual).
function useDefaultOnce(list, setValue) {
  const done = useRef(false);
  useEffect(() => {
    if (!done.current && list.length > 0) {
      done.current = true;
      setValue(list[0]);
    }
  }, [list, setValue]);
}

/**
 * @param {ReturnType<typeof import("./useAppData.js").useAppData>} data
 * @param {{ search: string, catFilter: string, txTypeFilter: string, sourceFilter: string }} filters
 */
export function useDerivedData(data, { search, catFilter, txTypeFilter, sourceFilter }) {
  const { transactions, creditTransactions, creditStatements, categories, accountSettings } = data;

  const catMap = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, { ...c, icon: resolveCategoryIcon(c) }])),
    [categories]
  );
  const getCat = useCallback(
    (id) => catMap[id] || { id, label: id, color: TOKENS.textFaint, icon: DEFAULT_CATEGORY_ICON },
    [catMap]
  );

  // ---- débito ---------------------------------------------------------------
  const months = useMemo(() => listMonths(transactions), [transactions]);
  const [monthFilter, setMonthFilter] = useState("all");
  useDefaultOnce(months, setMonthFilter);
  const currentMonth = monthFilter === "all" ? months[0] : monthFilter;

  const monthTx = useMemo(() => filterByMonth(transactions, monthFilter), [transactions, monthFilter]);
  const filteredTx = useMemo(
    () => filterTransactions(monthTx, { catFilter, txTypeFilter, sourceFilter, search }),
    [monthTx, catFilter, txTypeFilter, sourceFilter, search]
  );
  const duplicateIds = useMemo(() => findDuplicateIds(transactions), [transactions]);

  // Resumen siempre muestra UN mes (el seleccionado, o el más reciente si en
  // Movimientos quedó "Todo"): mezclar todo el historial en el dashboard
  // hacía que los títulos "· oct 2026" mintieran y que los presupuestos
  // mensuales se compararan contra el gasto de todos los meses.
  const resumenTx = useMemo(() => (currentMonth ? filterByMonth(transactions, currentMonth) : []), [transactions, currentMonth]);
  const excludedCategoryIds = useMemo(() => excludedCategoryIdsOf(categories), [categories]);
  const stats = useMemo(() => computeMonthStats(resumenTx, excludedCategoryIds), [resumenTx, excludedCategoryIds]);
  const byCategory = useMemo(
    () => sumByCategory(resumenTx.filter((t) => isRealExpense(t, excludedCategoryIds)), getCat),
    [resumenTx, excludedCategoryIds, getCat]
  );
  const byIncomeCategory = useMemo(() => sumByCategory(resumenTx.filter((t) => t.amount > 0), getCat), [resumenTx, getCat]);
  const byMonth = useMemo(() => computeByMonth(transactions, excludedCategoryIds), [transactions, excludedCategoryIds]);
  const dailySpend = useMemo(() => computeDailySpend(transactions, excludedCategoryIds), [transactions, excludedCategoryIds]);
  const heroStat = useMemo(() => computeHeroStat(dailySpend, transactions, currentMonth), [dailySpend, transactions, currentMonth]);
  const insights = useMemo(() => {
    const [y, m] = (currentMonth || monthKeyOf(new Date())).split("-").map(Number);
    return computeInsights(transactions, excludedCategoryIds, (id) => getCat(id).label, new Date(y, m - 1, 1));
  }, [transactions, excludedCategoryIds, getCat, currentMonth]);

  const totalSavings = useMemo(
    () => computeTotalSavings(transactions, categories, accountSettings),
    [transactions, categories, accountSettings]
  );
  const dynamicBalance = useMemo(() => computeDynamicBalance(transactions, accountSettings), [transactions, accountSettings]);

  const reconcileStats = useMemo(() => computeReconcileStats(transactions, currentMonth), [transactions, currentMonth]);
  const monthHealth = useMemo(() => computeMonthHealth(transactions, months), [transactions, months]);

  // ---- crédito --------------------------------------------------------------
  const creditMonths = useMemo(() => listCreditMonths(creditTransactions), [creditTransactions]);
  const [creditMonthFilter, setCreditMonthFilter] = useState("");
  useDefaultOnce(creditMonths, setCreditMonthFilter);
  const currentCreditMonth = creditMonthFilter || creditMonths[0] || "";

  const filteredCreditTx = useMemo(
    () => filterCreditByMonth(creditTransactions, currentCreditMonth),
    [creditTransactions, currentCreditMonth]
  );
  const creditStats = useMemo(() => computeCreditStats(filteredCreditTx), [filteredCreditTx]);
  // undefined si todavía no se importó el PDF de este ciclo — la UI de
  // crédito sigue funcionando solo con el Excel.
  const currentCreditStatement = useMemo(
    () => creditStatements.find((s) => s.statementMonth === currentCreditMonth),
    [creditStatements, currentCreditMonth]
  );
  const latestStatement = useMemo(() => latestCreditStatement(creditStatements), [creditStatements]);

  return {
    getCat,
    months, monthFilter, setMonthFilter, currentMonth,
    filteredTx, duplicateIds,
    stats, byCategory, byIncomeCategory, byMonth, dailySpend, heroStat, insights,
    totalSavings, dynamicBalance, reconcileStats, monthHealth,
    creditMonths, currentCreditMonth, setCreditMonthFilter, filteredCreditTx, creditStats,
    currentCreditStatement, latestCreditStatement: latestStatement,
  };
}
