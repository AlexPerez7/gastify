// Transformaciones puras sobre los arrays de movimientos/reglas/suscripciones
// que antes estaban inline en los useCallback de App.jsx. Cada función recibe
// el estado actual y devuelve el siguiente; persistirlo es tarea del hook
// (src/hooks/useTransactionActions.js).
import { makeKey, monthKey, monthKeyOf, uid, localIsoDate } from "./utils.js";

/**
 * @typedef {import("./types.js").Transaction} Transaction
 * @typedef {import("./types.js").MerchantRule} MerchantRule
 * @typedef {import("./types.js").Subscription} Subscription
 */

/**
 * @param {{ date: string, description: string, amount: number, type: "income"|"expense", category: string }} entry
 * @param {string} createdAt  ISO — solo para el optimista; la columna real la pone Supabase
 * @returns {Transaction}
 */
export function makeManualTransaction(entry, createdAt) {
  const isExpense = entry.type === "expense";
  return {
    id: uid(),
    key: makeKey(entry.date, entry.description, isExpense ? entry.amount : 0, isExpense ? 0 : entry.amount),
    date: entry.date,
    description: entry.description,
    alias: "",
    amount: isExpense ? -Math.abs(entry.amount) : Math.abs(entry.amount),
    category: entry.category,
    source: "manual",
    reconciled: false,
    matchedId: null,
    createdAt,
  };
}

/** @typedef {{ type: "income"|"expense", description: string, amount: number, category: string }} EntryTemplate */

// Datos para precargar el formulario "Nuevo movimiento" a partir de un
// movimiento existente ("Duplicar"). Usa el nombre que ve el usuario (alias
// si hay) y el monto sin signo, como lo espera makeManualTransaction.
/** @param {Transaction} t @returns {EntryTemplate} */
export function entryFromTransaction(t) {
  return {
    type: t.amount >= 0 ? "income" : "expense",
    description: t.alias || t.description,
    amount: Math.abs(t.amount),
    category: t.category,
  };
}

// "Frecuentes" del formulario de alta: lo que el usuario anota a mano una y
// otra vez (almuerzo, Uber, pan), para cargarlo con un toque en vez de una
// tabla de plantillas que habría que mantener. Cuenta los manuales de los
// últimos `windowDays` (los del banco no: esos llegan solos; los de
// suscripción tampoco: se generan solos) más los del banco que se fusionaron
// con un manual y conservaron su alias. Agrupa por descripción (sin
// mayúsculas ni espacios extra) y tipo, exige al menos 2 apariciones, y usa
// el monto y la categoría de la vez más reciente (el almuerzo sube de precio).
/**
 * @param {Transaction[]} transactions
 * @param {string} todayIso  "YYYY-MM-DD" (localIsoDate)
 * @param {{ limit?: number, windowDays?: number }} [opts]
 * @returns {(EntryTemplate & { count: number })[]}
 */
export function frequentManualEntries(transactions, todayIso, { limit = 6, windowDays = 90 } = {}) {
  const [y, m, d] = todayIso.split("-").map(Number);
  const since = localIsoDate(new Date(y, m - 1, d - windowDays));
  /** @type {Map<string, { entry: EntryTemplate, count: number, lastDate: string }>} */
  const groups = new Map();
  for (const t of transactions) {
    if (t.subscriptionId || t.date < since || t.date > todayIso) continue;
    const isManual = t.source === "manual";
    const isMergedWithAlias = t.source === "bank" && t.matchedId && t.alias;
    if (!isManual && !isMergedWithAlias) continue;
    const entry = entryFromTransaction(t);
    const norm = entry.description.trim().replace(/\s+/g, " ").toLowerCase();
    if (!norm) continue;
    const key = `${entry.type}|${norm}`;
    const g = groups.get(key);
    if (!g) groups.set(key, { entry, count: 1, lastDate: t.date });
    else {
      g.count += 1;
      if (t.date >= g.lastDate) { g.entry = entry; g.lastDate = t.date; }
    }
  }
  return [...groups.values()]
    .filter((g) => g.count >= 2)
    .sort((a, b) => b.count - a.count || (a.lastDate < b.lastDate ? 1 : -1))
    .slice(0, limit)
    .map((g) => ({ ...g.entry, description: g.entry.description.trim(), count: g.count }));
}

// el movimiento manual "pendiente" del mes en curso para cada suscripción
// activa cuyo día de cobro ya pasó y que todavía no lo tiene. Se concilia
// después con el cargo real del banco como cualquier otro manual. Sin
// backfill de meses anteriores.
/**
 * @param {Subscription[]} subscriptions
 * @param {Transaction[]} transactions
 * @param {Date} today
 * @param {string} createdAt
 * @returns {Transaction[]}  solo los nuevos
 */
export function makeSubscriptionCharges(subscriptions, transactions, today, createdAt) {
  const curMonthKey = monthKeyOf(today);
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  /** @type {Transaction[]} */
  const out = [];
  for (const sub of subscriptions) {
    // un cobro "el 31" en un mes de 30 días (o febrero) cae el último día —
    // se compara contra el día ya ajustado, si no nunca se generaba ese mes.
    const chargeDay = Math.min(sub.dayOfMonth, daysInMonth);
    if (!sub.active || today.getDate() < chargeDay) continue;
    if (transactions.some((t) => t.subscriptionId === sub.id && monthKey(t.date) === curMonthKey)) continue;
    const date = `${curMonthKey}-${String(chargeDay).padStart(2, "0")}`;
    out.push({
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
      createdAt,
    });
  }
  return out;
}

/**
 * Agrega (o reemplaza, si ya había una con el mismo texto) una regla de
 * "memoria de comercio".
 * @param {MerchantRule[]} rules
 * @param {string} matchText  ya sin espacios sobrantes
 * @param {string} categoryId
 * @param {string} alias
 * @returns {MerchantRule[]}
 */
export function upsertMerchantRule(rules, matchText, categoryId, alias) {
  const others = rules.filter((r) => r.matchText.toUpperCase() !== matchText.toUpperCase());
  return [...others, { id: uid(), matchText, categoryId, alias: alias || "" }];
}

/**
 * Cambia categoría/alias de un movimiento y, si `matchText` viene (regla
 * recordada), lo aplica retroactivamente a todo lo que coincida.
 * @template {{id: string, description: string, category: string, alias: string, source?: string}} T
 * @param {T[]} list
 * @param {string} txId
 * @param {{ category: string, alias?: string }} edit
 * @param {string|null} matchText  null = no recordar regla
 * @param {{ bankOnly?: boolean }} [opts]  débito: la regla solo toca movimientos del banco
 * @returns {T[]}
 */
export function applyCategoryEdit(list, txId, { category, alias }, matchText, { bankOnly = false } = {}) {
  const needle = matchText ? matchText.toUpperCase() : null;
  return list.map((t) => {
    if (t.id === txId) return { ...t, category, alias: alias || "" };
    if (needle && (!bankOnly || t.source === "bank") && t.description.toUpperCase().includes(needle)) {
      return { ...t, category, alias: alias || t.alias };
    }
    return t;
  });
}

// corrige fecha/monto de un manual desde Conciliación (casi siempre un typo
// en un "posible descuadre"). Mantiene el signo original y recalcula `key`.
// Devuelve el mismo array si el id no existe.
/**
 * @param {Transaction[]} transactions
 * @param {string} txId
 * @param {{ date: string, amount: number }} patch
 * @returns {Transaction[]}
 */
export function editManualDateAmount(transactions, txId, { date, amount }) {
  const target = transactions.find((t) => t.id === txId);
  if (!target) return transactions;
  const isExpense = target.amount < 0;
  const abs = Math.abs(amount);
  return transactions.map((t) =>
    t.id !== txId
      ? t
      : { ...t, date, amount: isExpense ? -abs : abs, key: makeKey(date, t.description, isExpense ? abs : 0, isExpense ? 0 : abs) }
  );
}

// marcar un movimiento como suscripción: reutiliza una suscripción activa con
// el mismo nombre+monto+categoría (para no duplicar al marcar el mismo cobro
// dos meses distintos) o crea una nueva, y vincula el movimiento a ella.
/**
 * @param {Transaction[]} transactions
 * @param {Subscription[]} subscriptions
 * @param {string} txId
 * @returns {{ transactions: Transaction[], newSubscription: Subscription|null } | null}  null si el id no existe
 */
export function linkTransactionToSubscription(transactions, subscriptions, txId) {
  const tx = transactions.find((t) => t.id === txId);
  if (!tx) return null;
  const name = tx.alias || tx.description;
  const amount = Math.abs(tx.amount);
  const category = tx.category;
  const existing = subscriptions.find((s) => s.active && s.name === name && s.amount === amount && s.category === category);
  const newSubscription = existing
    ? null
    : { id: "sub_" + uid(), name, amount, category, dayOfMonth: Number(tx.date.slice(8, 10)), active: true };
  const subId = existing ? existing.id : newSubscription.id;
  return {
    transactions: transactions.map((t) => (t.id === txId ? { ...t, subscriptionId: subId } : t)),
    newSubscription,
  };
}
