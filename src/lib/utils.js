import { MERCHANT_RULES_DEFAULT, NOISE_TOKENS } from "./constants.js";

export function autoCategory(desc) {
  const d = desc.toUpperCase();
  if (d.includes("ASSERTIVA")) return "ingreso";
  for (const [keys, cat] of MERCHANT_RULES_DEFAULT) {
    if (keys.some((k) => d.includes(k))) return cat;
  }
  if (d.startsWith("TRANSF") || d.includes("TRANSF.") || d.includes("TRANSF ")) return "transferencias";
  return "otros";
}

// Sugiere una "llave de coincidencia" estable para una descripción: quita
// códigos de país, ciudades y ruido numérico al final, para que agrupe
// cargos repetidos del mismo comercio aunque el banco cambie la ciudad.
export function suggestMatchKey(desc) {
  const tokens = desc.toUpperCase().trim().split(/\s+/);
  while (tokens.length > 2) {
    const last = tokens[tokens.length - 1];
    if (NOISE_TOKENS.has(last) || /^\d+$/.test(last) || /^\d{4}-\d{2}-\d{2}$/.test(last)) {
      tokens.pop();
    } else break;
  }
  return tokens.join(" ");
}

export function applyMerchantRules(desc, rules) {
  const d = desc.toUpperCase();
  let best = null;
  for (const r of rules) {
    if (r.matchText && d.includes(r.matchText.toUpperCase())) {
      if (!best || r.matchText.length > best.matchText.length) best = r;
    }
  }
  return best;
}

export function parseClpNumber(raw) {
  if (raw === undefined || raw === null || raw === "") return 0;
  if (typeof raw === "number") return raw;
  const cleaned = String(raw).replace(/\$/g, "").replace(/\s/g, "").replace(/\./g, "").replace(/,/g, ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

// Devuelve una fecha ISO "YYYY-MM-DD", o null si `raw` no es una fecha
// reconocible — antes devolvía el string crudo tal cual, que se colaba como
// `date` inválida y rompía todo cálculo posterior de mes/orden. Quien llama
// debe descartar la fila si esto es null.
export function parseBankDate(raw) {
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw <= 0) return null;
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + raw * 86400000);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const s = String(raw).trim();
  const dmy = s.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  // por si algún origen ya entrega ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

export function makeKey(date, desc, cargo, abono) {
  return [date, desc.trim().toUpperCase().replace(/\s+/g, " "), cargo, abono].join("|");
}

// A diferencia de makeKey (débito, que tiene saldo corrido y cada movimiento
// es único), una compra en cuotas de la tarjeta de crédito aparece en CADA
// cartola mensual siguiente con la MISMA fecha/descripción/monto original —
// solo cambia cuotasPendientes. Sin statementMonth en la clave, la cuota 2
// de una compra se vería como "ya importada" (misma fecha+desc+monto que la
// cuota 1 del mes pasado) y se perdería silenciosamente.
export function makeCreditKey(statementMonth, date, desc, montoTotal, cuotasPendientes, valorCuota) {
  return [statementMonth, date, desc.trim().toUpperCase().replace(/\s+/g, " "), montoTotal, cuotasPendientes, valorCuota].join("|");
}

export function formatCLP(n) {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString("es-CL")}`;
}

export function formatDateDisplay(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

export function monthKey(iso) {
  return iso ? iso.slice(0, 7) : "";
}

// Desplaza una clave de mes "YYYY-MM" en `n` meses (n puede ser negativo) y
// devuelve otra clave "YYYY-MM", cruzando bien el límite de año. Es la única
// forma que debería usarse para hacer aritmética de meses en la app — antes
// estaba repetida a mano (new Date(y, m - 2, 1), etc.) en heroStat, insights
// y conciliación, con el riesgo de off-by-one en cada copia.
export function addMonths(mKey, n) {
  const [y, m] = mKey.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// "2026-01" -> "2026-02". Se usa en conciliación: el banco puede anotar un
// movimiento con "fecha contable" unos días después de la fecha real (ver
// nextMonthKey callers), y eso a veces cruza al mes calendario siguiente.
export function nextMonthKey(mKey) {
  return addMonths(mKey, 1);
}

// "2026-02" -> "2026-01". Complemento de nextMonthKey para las comparaciones
// "este mes vs. el anterior" del dashboard.
export function prevMonthKey(mKey) {
  return addMonths(mKey, -1);
}

// Clave de mes "YYYY-MM" para una fecha (Date). Centraliza el
// `${y}-${String(m+1).padStart(2,"0")}` que estaba disperso.
export function monthKeyOf(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

const WEEKDAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTH_NAMES_LONG = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function toIsoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Encabezado para un grupo de movimientos del mismo día: "Hoy"/"Ayer" para
// los más recientes, si no "Lunes, 3 de agosto".
export function formatDayHeading(iso, today = new Date()) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (iso === toIsoDate(today)) return "Hoy";
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (iso === toIsoDate(yesterday)) return "Ayer";
  const weekday = WEEKDAY_NAMES[date.getDay()];
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${d} de ${MONTH_NAMES_LONG[m - 1]}`;
}

// Agrupa transacciones por fecha preservando el orden de aparición (la lista
// ya llega ordenada por fecha desde App.jsx, así que los grupos también
// quedan ordenados).
export function groupByDate(transactions) {
  const map = new Map();
  for (const t of transactions) {
    if (!map.has(t.date)) map.set(t.date, []);
    map.get(t.date).push(t);
  }
  return Array.from(map.entries()).map(([date, items]) => ({ date, items }));
}

// id único para filas nuevas. Se usa como primary key (junto a user_id) en
// Supabase y se genera en cada dispositivo sin coordinación, así que la
// unicidad tiene que ser real: `crypto.randomUUID()` (disponible en todo
// navegador objetivo bajo https/localhost) da 122 bits de aleatoriedad. El
// fallback con Math.random() solo aplica en contextos sin Web Crypto y
// mantiene un formato parecido al histórico.
export function uid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return (
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10) +
    Date.now().toString(36)
  );
}

// Compara el mes actual con el anterior y arma 0-3 frases sueltas: variación
// total, la categoría que más subió (con piso en $ y % para evitar ruido de
// categorías chicas), y si el mes va en verde. getCatLabel resuelve id->nombre.
export function computeInsights(transactions, excludedCategoryIds, getCatLabel, referenceDate = new Date()) {
  const thisMonthKey = monthKeyOf(referenceDate);
  const prevMonth = prevMonthKey(thisMonthKey);

  // el mes seleccionado puede ser uno ya cerrado, no necesariamente el
  // calendario real — el texto de cada insight cambia de tiempo verbal
  // según corresponda (presente para el mes en curso, pasado para uno viejo).
  const isRealCurrentMonth = thisMonthKey === monthKeyOf(new Date());

  const isExpense = (t) => t.amount < 0 && !excludedCategoryIds.has(t.category);

  const sumByCat = (mk) => {
    const map = {};
    let total = 0;
    for (const t of transactions) {
      if (monthKey(t.date) !== mk || !isExpense(t)) continue;
      const v = Math.abs(t.amount);
      map[t.category] = (map[t.category] || 0) + v;
      total += v;
    }
    return { map, total };
  };

  const cur = sumByCat(thisMonthKey);
  const prev = sumByCat(prevMonth);
  const list = [];
  if (cur.total === 0 && prev.total === 0) return list;

  if (prev.total > 0) {
    const diffPct = ((cur.total - prev.total) / prev.total) * 100;
    const verb = isRealCurrentMonth ? "Llevas gastado" : "Gastaste";
    if (diffPct >= 5) list.push(`${verb} ${Math.round(diffPct)}% más que el mes pasado en total.`);
    else if (diffPct <= -5) list.push(`${verb} ${Math.round(Math.abs(diffPct))}% menos que el mes pasado en total.`);
  }

  let biggest = null;
  for (const catId of Object.keys(cur.map)) {
    const curVal = cur.map[catId];
    const prevVal = prev.map[catId] || 0;
    const delta = curVal - prevVal;
    if (delta <= 0 || curVal < 10000) continue;
    const pct = prevVal > 0 ? (delta / prevVal) * 100 : null;
    if (pct !== null && pct < 15) continue;
    if (!biggest || delta > biggest.delta) biggest = { catId, delta, pct, curVal };
  }
  if (biggest) {
    const label = getCatLabel(biggest.catId);
    list.push(
      biggest.pct === null
        ? `${isRealCurrentMonth ? "Este mes" : "Ese mes"} empezaste a gastar en ${label} (${formatCLP(biggest.curVal)}).`
        : `Gastaste ${Math.round(biggest.pct)}% más en ${label} que el mes pasado.`
    );
  }

  return list.slice(0, 3);
}
