// Derivados del dashboard y de las listas (stats del mes, gasto por
// categoría, hero, conciliación, crédito…). Vivían como useMemo dentro de
// App.jsx; acá son funciones puras — entra el estado, sale el dato — para
// poder testearlas sin React. src/hooks/useDerivedData.js las memoiza.
import { monthKey, monthKeyOf, prevMonthKey, nextMonthKey } from "./utils.js";

/**
 * @typedef {import("./types.js").Transaction} Transaction
 * @typedef {import("./types.js").Category} Category
 * @typedef {import("./types.js").CreditTransaction} CreditTransaction
 * @typedef {import("./types.js").CreditStatement} CreditStatement
 * @typedef {import("./types.js").AccountSettings} AccountSettings
 */

// orden de las listas: fecha más reciente arriba y, dentro del mismo día,
// el que se agregó/importó más recién a la app — no el orden en que vino en
// el archivo del banco.
/** @param {{date: string, createdAt?: string}} a @param {{date: string, createdAt?: string}} b */
export function byDateDesc(a, b) {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
}

/** @param {Transaction[]} transactions @returns {string[]} meses "YYYY-MM", más reciente primero */
export function listMonths(transactions) {
  const s = new Set(transactions.map((t) => monthKey(t.date)));
  return Array.from(s).filter(Boolean).sort().reverse();
}

// "ciclos" en vez de "meses de movimiento": statementMonth es el mes de la
// cartola (ver buildCreditImport), no el mes calendario de cada fila.
/** @param {CreditTransaction[]} creditTransactions @returns {string[]} */
export function listCreditMonths(creditTransactions) {
  const s = new Set(creditTransactions.map((t) => t.statementMonth));
  return Array.from(s).filter(Boolean).sort().reverse();
}

/** @typedef {{ min: number|null, max: number|null }} AmountRange */
/** @type {AmountRange} */
export const EMPTY_AMOUNT_RANGE = { min: null, max: null };

/** @param {AmountRange} r */
export function isAmountRangeActive(r) {
  return r.min != null || r.max != null;
}

/** @param {Transaction[]} transactions @param {string} monthFilter  "all" o "YYYY-MM" */
export function filterByMonth(transactions, monthFilter) {
  return transactions.filter((t) => monthFilter === "all" || monthKey(t.date) === monthFilter);
}

/**
 * Filtros de la lista de Movimientos (sobre lo ya filtrado por mes), ordenado.
 * El rango de monto compara el valor ABSOLUTO (sin signo), en CLP, con ambos
 * extremos incluidos: "entre 10.000 y 50.000" sirve igual para gastos e
 * ingresos. null en un extremo = sin límite.
 * @param {Transaction[]} monthTx
 * @param {{ catFilter: string, txTypeFilter: string, sourceFilter: string, search: string, amountRange?: AmountRange }} f
 */
export function filterTransactions(monthTx, { catFilter, txTypeFilter, sourceFilter, search, amountRange = EMPTY_AMOUNT_RANGE }) {
  const q = search.toLowerCase();
  const { min, max } = amountRange;
  return monthTx
    .filter((t) => catFilter === "all" || t.category === catFilter)
    .filter((t) => txTypeFilter === "all" || (txTypeFilter === "income" ? t.amount > 0 : t.amount < 0))
    .filter((t) => sourceFilter === "all" || t.source === sourceFilter)
    .filter((t) => (min == null || Math.abs(t.amount) >= min) && (max == null || Math.abs(t.amount) <= max))
    .filter((t) => !search || t.description.toLowerCase().includes(q) || (t.alias || "").toLowerCase().includes(q))
    .sort(byDateDesc);
}

// categorías marcadas "no cuenta como gasto" (ej. transferencias a tus
// propias cuentas) — se excluyen de todo cálculo de gasto, pero siguen
// apareciendo normalmente en la lista de movimientos.
/** @param {Category[]} categories @returns {Set<string>} */
export function excludedCategoryIdsOf(categories) {
  return new Set(categories.filter((c) => c.excludeFromExpense).map((c) => c.id));
}

/** @param {Transaction} t @param {Set<string>} excludedIds */
export function isRealExpense(t, excludedIds) {
  return t.amount < 0 && !excludedIds.has(t.category);
}

/** @param {Transaction[]} monthTx @param {Set<string>} excludedIds */
export function computeMonthStats(monthTx, excludedIds) {
  const income = monthTx.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const expense = monthTx.filter((t) => isRealExpense(t, excludedIds)).reduce((s, t) => s + t.amount, 0);
  return { income, expense, balance: income + expense };
}

/**
 * Suma |amount| por categoría, ordenado de mayor a menor. Quien llama decide
 * qué movimientos entran (gastos reales, o solo ingresos).
 * @param {Transaction[]} txs
 * @param {(id: string) => {label: string, color: string, icon: any}} getCat
 */
export function sumByCategory(txs, getCat) {
  /** @type {Record<string, number>} */
  const map = {};
  for (const t of txs) map[t.category] = (map[t.category] || 0) + Math.abs(t.amount);
  return Object.entries(map)
    .map(([id, value]) => ({ id, name: getCat(id).label, value, color: getCat(id).color, icon: getCat(id).icon }))
    .sort((a, b) => b.value - a.value);
}

/** Ingresos y gastos reales de los últimos 6 meses con datos. @param {Transaction[]} transactions @param {Set<string>} excludedIds */
export function computeByMonth(transactions, excludedIds) {
  /** @type {Record<string, {month: string, ingresos: number, gastos: number}>} */
  const map = {};
  for (const t of transactions) {
    const mk = monthKey(t.date);
    if (!mk) continue;
    if (!map[mk]) map[mk] = { month: mk, ingresos: 0, gastos: 0 };
    if (t.amount > 0) map[mk].ingresos += t.amount;
    else if (isRealExpense(t, excludedIds)) map[mk].gastos += Math.abs(t.amount);
  }
  return Object.values(map).sort((a, b) => (a.month > b.month ? 1 : -1)).slice(-6);
}

/** Gasto real por día ISO. @param {Transaction[]} transactions @param {Set<string>} excludedIds @returns {Record<string, number>} */
export function computeDailySpend(transactions, excludedIds) {
  /** @type {Record<string, number>} */
  const map = {};
  for (const t of transactions) {
    if (!t.date || !isRealExpense(t, excludedIds)) continue;
    map[t.date] = (map[t.date] || 0) + Math.abs(t.amount);
  }
  return map;
}

// "hero" del dashboard: TODO lo gastado con fecha en el mes seleccionado,
// sin importar el día — el banco a veces le pone fecha del lunes siguiente a
// movimientos del fin de semana, así que un cargo fechado "mañana" igual
// cuenta como gasto de ese mes.
//
// "ritmo habitual": mismo tramo (día 1 al día X) pero del mes calendario
// inmediatamente anterior — "manzanas con manzanas". Escalar el TOTAL del mes
// anterior por una fracción de días asumía gasto parejo y distorsionaba el %
// apenas había un gasto grande fuera de ese tramo.
/**
 * @param {Record<string, number>} dailySpend
 * @param {Transaction[]} transactions
 * @param {string|undefined} currentMonth  mes seleccionado (undefined = mes real)
 * @param {Date} [now]
 */
export function computeHeroStat(dailySpend, transactions, currentMonth, now = new Date()) {
  const realThisMonthKey = monthKeyOf(now);
  const thisMonthKey = currentMonth || realThisMonthKey;
  const isRealCurrentMonth = thisMonthKey === realThisMonthKey;
  const [y, m] = thisMonthKey.split("-").map(Number);
  // mes en curso: "hasta hoy". Mes ya cerrado: el mes completo (último día).
  const dayOfMonth = isRealCurrentMonth ? now.getDate() : new Date(y, m, 0).getDate();

  let spentSoFar = 0;
  for (const [date, amt] of Object.entries(dailySpend)) {
    if (date.slice(0, 7) === thisMonthKey) spentSoFar += amt;
  }

  const prevMonth = prevMonthKey(thisMonthKey);
  const hasPrevMonthData = transactions.some((t) => monthKey(t.date) === prevMonth);

  let typicalPace = null;
  if (hasPrevMonthData) {
    typicalPace = 0;
    for (const [date, amt] of Object.entries(dailySpend)) {
      if (date.slice(0, 7) !== prevMonth) continue;
      if (Number(date.slice(8, 10)) <= dayOfMonth) typicalPace += amt;
    }
  }

  return { spentSoFar, typicalPace, dayOfMonth, monthKey: thisMonthKey, isRealCurrentMonth };
}

// Proyección del gasto al cierre del mes en curso: lo gastado hasta hoy + lo
// que el mes anterior gastó DESPUÉS de este mismo día. No es una regla de
// tres (gastado / días × días del mes): con el arriendo pagado el día 1, la
// regla de tres proyectaba el arriendo 30 veces. Así los pagos fijos caen
// donde caen siempre. null si no es el mes real en curso o si no hay datos
// del mes anterior (sin base no se inventa una cifra).
/**
 * @param {ReturnType<typeof computeHeroStat>} heroStat
 * @param {Record<string, number>} dailySpend
 * @returns {{ estimated: number, prevMonthTotal: number, elapsedPct: number, dayOfMonth: number, daysInMonth: number } | null}
 */
export function computeMonthProjection(heroStat, dailySpend) {
  if (!heroStat?.isRealCurrentMonth || heroStat.typicalPace == null) return null;
  const prevMonth = prevMonthKey(heroStat.monthKey);
  let prevMonthTotal = 0;
  for (const [date, amt] of Object.entries(dailySpend)) {
    if (date.slice(0, 7) === prevMonth) prevMonthTotal += amt;
  }
  const [y, m] = heroStat.monthKey.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  return {
    estimated: heroStat.spentSoFar + (prevMonthTotal - heroStat.typicalPace),
    prevMonthTotal,
    elapsedPct: Math.round((heroStat.dayOfMonth / daysInMonth) * 100),
    dayOfMonth: heroStat.dayOfMonth,
    daysInMonth,
  };
}

// Tasa de ahorro del período: qué parte de los ingresos no se gastó
// ((ingresos − gasto real) / ingresos). Puede ser negativa (gastaste más de
// lo que entró). null sin ingresos: dividir por 0 no dice nada útil.
/** @param {{ income: number, balance: number }} stats @returns {number|null} fracción, ej. 0.23 */
export function computeSavingsRate({ income, balance }) {
  if (!(income > 0)) return null;
  return balance / income;
}

// Total ahorrado = histórico completo (no solo el mes elegido) de las
// categorías marcadas como "ahorro": lo que sale hacia esas categorías se
// acumula (monto negativo) y lo que vuelve a la cuenta corriente se resta.
// null si no hay ninguna categoría de ahorro, para no mostrar un $0 confuso.
// Si el usuario declaró un ahorro base (savingsBase), ese monto es el ancla y
// solo se suma lo cargado DESPUÉS (por createdAt, igual que dynamicBalance).
/**
 * @param {Transaction[]} transactions
 * @param {Category[]} categories
 * @param {AccountSettings|null} accountSettings
 * @returns {number|null}
 */
export function computeTotalSavings(transactions, categories, accountSettings) {
  const savingsIds = new Set(categories.filter((c) => c.isSavings).map((c) => c.id));
  if (savingsIds.size === 0) return null;
  const inSavings = transactions.filter((t) => savingsIds.has(t.category));
  if (accountSettings?.savingsBase == null) {
    return inSavings.reduce((sum, t) => sum - t.amount, 0);
  }
  const sinceTime = new Date(accountSettings.savingsBaseDate).getTime();
  const netSince = inSavings
    .filter((t) => t.createdAt && new Date(t.createdAt).getTime() > sinceTime)
    .reduce((sum, t) => sum - t.amount, 0);
  return accountSettings.savingsBase + netSince;
}

// Saldo actual = base_balance (lo que el usuario confirmó, o el Saldo del
// último .xls importado) + los movimientos MANUALES cargados después de ese
// momento — los del banco ya están reflejados en el Saldo. Se compara por
// createdAt (cuándo se cargó), no por date: un gasto manual de hoy a las
// 16:00 tras ajustar el saldo a las 15:00 no se distinguiría por fecha.
/** @param {Transaction[]} transactions @param {AccountSettings|null} accountSettings @returns {number|null} */
export function computeDynamicBalance(transactions, accountSettings) {
  // la fila puede existir solo por el ahorro base, sin saldo ajustado todavía
  if (accountSettings?.baseBalance == null || !accountSettings.lastSyncDate) return null;
  const syncTime = new Date(accountSettings.lastSyncDate).getTime();
  const netManualSince = transactions
    .filter((t) => t.source === "manual" && t.createdAt && new Date(t.createdAt).getTime() > syncTime)
    .reduce((sum, t) => sum + t.amount, 0);
  return accountSettings.baseBalance + netManualSince;
}

/**
 * Datos de la pestaña Conciliación para un mes.
 * @param {Transaction[]} transactions
 * @param {string|undefined} currentMonth
 */
export function computeReconcileStats(transactions, currentMonth) {
  if (!currentMonth) return null;
  const inMonth = transactions.filter((t) => monthKey(t.date) === currentMonth);
  // los manuales que quedan en pie son, por definición, los no conciliados:
  // al conciliar, la fila manual se fusiona en la del banco y desaparece.
  const manuals = inMonth.filter((t) => t.source === "manual");
  const banks = inMonth.filter((t) => t.source === "bank");
  const bankExists = banks.length > 0;
  const confirmed = banks.filter((t) => t.matchedId);
  const bankOnly = banks.filter((t) => !t.matchedId);
  // candidatos para vincular a mano: también lo sin vincular del mes
  // siguiente — un traspaso de fin de mes puede quedar con fecha contable ya
  // en el mes que sigue (ver reconcileMonthTransactions).
  const nextKey = nextMonthKey(currentMonth);
  const nextMonthBankOnly = transactions.filter((t) => t.source === "bank" && !t.matchedId && monthKey(t.date) === nextKey);
  return {
    manuals, confirmed, bankExists,
    pendingNoReport: bankExists ? [] : manuals,
    pendingMismatch: bankExists ? manuals : [],
    bankOnly,
    linkCandidates: [...bankOnly, ...nextMonthBankOnly],
  };
}

// "salud" de conciliación por mes para el selector de meses: "ok" (todo lo
// manual calzó) / "warn" (hay reporte del banco pero algo manual sigue sin
// calzar). Sin entrada si el mes nunca tuvo manuales que conciliar, o si aún
// no se importa el reporte del banco de ese mes.
/** @param {Transaction[]} transactions @param {string[]} months @returns {Record<string, "ok"|"warn">} */
export function computeMonthHealth(transactions, months) {
  /** @type {Record<string, "ok"|"warn">} */
  const map = {};
  for (const mk of months) {
    const inMonth = transactions.filter((t) => monthKey(t.date) === mk);
    const manuals = inMonth.filter((t) => t.source === "manual");
    // los ya fusionados con el banco tampoco quedan como manual — sin esto,
    // un mes 100% conciliado se vería igual a uno sin manuales.
    const mergedCount = inMonth.filter((t) => t.source === "bank" && t.matchedId).length;
    if (manuals.length === 0 && mergedCount === 0) continue;
    if (!inMonth.some((t) => t.source === "bank")) continue;
    map[mk] = manuals.length > 0 ? "warn" : "ok";
  }
  return map;
}

// Umbrales del mapa de actividad por CUARTILES de los días con gasto, no
// proporcionales al máximo: con un solo pago grande (arriendo), el método
// anterior (valor / máximo) dejaba casi todo el año en el nivel más claro.
// Devuelve [q1, q2, q3]; un día con gasto cae en el nivel 1–4 según cuántos
// umbrales supera.
/** @param {number[]} values  montos > 0 de los días con gasto @returns {number[]} */
export function heatmapThresholds(values) {
  const v = values.filter((x) => x > 0).sort((a, b) => a - b);
  if (v.length === 0) return [];
  const at = (p) => v[Math.min(v.length - 1, Math.floor(p * v.length))];
  return [at(0.25), at(0.5), at(0.75)];
}

/** @param {number} value @param {number[]} thresholds @returns {0|1|2|3|4} */
export function heatLevel(value, thresholds) {
  if (!value || value <= 0) return 0;
  let level = 1;
  for (const t of thresholds) if (value > t) level += 1;
  return /** @type {0|1|2|3|4} */ (Math.min(level, 4));
}

/** @param {CreditTransaction[]} creditTransactions @param {string} statementMonth */
export function filterCreditByMonth(creditTransactions, statementMonth) {
  return creditTransactions.filter((t) => t.statementMonth === statementMonth).sort(byDateDesc);
}

// suma con signo (negativo = gasto), normalmente negativa salvo un ciclo con
// más devoluciones/pagos que compras. CreditCard.jsx muestra el absoluto.
/** @param {CreditTransaction[]} creditTx */
export function computeCreditStats(creditTx) {
  const total = creditTx.reduce((s, t) => s + t.amount, 0);
  const pendingCount = creditTx.filter((t) => t.installmentsPending > 0).length;
  return { total, pendingCount };
}

// el ciclo más reciente importado, sin importar qué mes esté seleccionado
// (para la card de la tarjeta en Resumen).
/** @param {CreditStatement[]} creditStatements @returns {CreditStatement|null} */
export function latestCreditStatement(creditStatements) {
  if (creditStatements.length === 0) return null;
  return [...creditStatements].sort((a, b) => (a.statementMonth < b.statementMonth ? 1 : -1))[0];
}
