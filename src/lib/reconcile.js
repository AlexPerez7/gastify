// Lógica pura de conciliación entre movimientos manuales y los del banco.
// Vivía embebida como useCallback dentro de App.jsx, lo que la hacía
// imposible de testear pese a ser el código que más afecta la plata (fusiona
// filas, hereda categorías, borra manuales). Acá no hay React ni Supabase:
// entra un array de transacciones, sale el array resultante.
import { monthKey, nextMonthKey } from "./utils.js";

/** @typedef {import("./types.js").Transaction} Transaction */

// Conciliar FUSIONA el movimiento manual con el del banco en vez de dejar los
// dos como filas separadas: si no, el mismo gasto real quedaría contado dos
// veces (una como manual, otra como bancario) apenas el usuario anota algo a
// mano antes de que llegue el reporte del banco. La fila manual se borra y la
// del banco (fuente oficial) hereda su categoría, alias y subscriptionId.
//
// Devuelve { next, merged }: `next` es el array de transacciones ya
// conciliado, `merged` cuántas parejas se fusionaron (0 si no hubo ninguna,
// en cuyo caso `next` es === al array original).
/**
 * @param {Transaction[]} transactions
 * @param {string} mKey  clave de mes "YYYY-MM"
 * @returns {{ next: Transaction[], merged: number }}
 */
export function reconcileMonthTransactions(transactions, mKey) {
  const manuals = transactions.filter((t) => t.source === "manual" && monthKey(t.date) === mKey);
  // el banco anota los traspasos con "fecha contable": hechos después de las
  // 14:00 en día hábil, o en día inhábil, quedan registrados el día hábil
  // siguiente — eso puede empujar la fecha del banco al mes calendario
  // siguiente, así que también se buscan candidatos ahí.
  const nextKey = nextMonthKey(mKey);
  const banks = transactions.filter(
    (t) => t.source === "bank" && (monthKey(t.date) === mKey || monthKey(t.date) === nextKey)
  );

  const bankUpdates = new Map();
  const mergedManualIds = new Set();
  for (const m of manuals) {
    const match = banks.find((b) => {
      if (bankUpdates.has(b.id) || b.matchedId) return false;
      const sameAmount = Math.abs(b.amount - m.amount) < 1;
      // la fecha contable del banco solo se atrasa respecto a la real, nunca
      // se adelanta — ventana asimétrica hacia adelante (hasta 5 días, para
      // cubrir fines de semana largos con feriado) y un margen chico hacia
      // atrás por si la fecha anotada a mano quedó un día después de la real.
      const dDate = (new Date(b.date).getTime() - new Date(m.date).getTime()) / 86400000;
      return sameAmount && dDate >= -2 && dDate <= 5;
    });
    if (match) {
      bankUpdates.set(match.id, {
        ...match,
        matchedId: m.id,
        category: m.category,
        alias: m.alias || match.alias,
        subscriptionId: m.subscriptionId ?? match.subscriptionId,
      });
      mergedManualIds.add(m.id);
    }
  }
  if (mergedManualIds.size === 0) return { next: transactions, merged: 0 };
  const next = transactions
    .filter((t) => !mergedManualIds.has(t.id))
    .map((t) => bankUpdates.get(t.id) || t);
  return { next, merged: mergedManualIds.size };
}

// Vincula a mano un movimiento manual con uno del banco cuando el calce
// automático no lo encontró. Misma fusión que reconcileMonthTransactions: se
// borra la fila manual y el banco hereda su categoría/alias/subscriptionId.
// Devuelve el array resultante (=== al original si algún id no existe).
/**
 * @param {Transaction[]} transactions
 * @param {string} manualId
 * @param {string} bankId
 * @returns {Transaction[]}
 */
export function matchManualToBank(transactions, manualId, bankId) {
  const manual = transactions.find((t) => t.id === manualId);
  const bank = transactions.find((t) => t.id === bankId);
  if (!manual || !bank) return transactions;
  return transactions
    .filter((t) => t.id !== manualId)
    .map((t) =>
      t.id === bankId
        ? {
            ...t,
            matchedId: manualId,
            category: manual.category,
            alias: manual.alias || t.alias,
            subscriptionId: manual.subscriptionId ?? t.subscriptionId,
          }
        : t
    );
}

// Posibles duplicados: un manual y un bancario (nunca dos del mismo origen)
// con mismo monto (mismo signo) y fecha a menos de 3 días, sin estar ya
// vinculados por la conciliación. Comparar bancario contra bancario no sirve:
// servicios con tarifa fija (metro, estacionamiento) generan varios
// movimientos legítimos con el mismo monto en pocos días, y los duplicados
// reales de una reimportación ya se filtran por la clave única al importar.
// Se agrupa por monto redondeado antes de comparar fechas para no comparar
// todo contra todo en cuentas con muchos movimientos.
/**
 * @param {Transaction[]} transactions
 * @returns {Set<string>}  ids marcados como posible duplicado
 */
export function findDuplicateIds(transactions) {
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
        const dDays = Math.abs(new Date(a.date).getTime() - new Date(b.date).getTime()) / 86400000;
        if (dDays <= 3) { flagged.add(a.id); flagged.add(b.id); }
      }
    }
  }
  return flagged;
}
