// Reemplaza al localStorage por tablas en Supabase (Postgres + RLS), pero
// mantiene la misma interfaz get/set que usaba App.jsx: cada "key" es en
// realidad una tabla completa, y get/set sincronizan el array JSON contra
// las filas de esa tabla para el usuario autenticado.
import { supabase } from "./supabaseClient.js";

const TABLES = {
  transactions: {
    table: "transactions",
    toRow: (t) => ({
      id: t.id,
      key: t.key,
      date: t.date,
      description: t.description,
      alias: t.alias,
      amount: t.amount,
      category: t.category,
      source: t.source,
      reconciled: t.reconciled,
      matched_id: t.matchedId,
      subscription_id: t.subscriptionId,
    }),
    fromRow: (r) => ({
      id: r.id,
      key: r.key,
      date: r.date,
      description: r.description,
      alias: r.alias,
      amount: Number(r.amount),
      category: r.category,
      source: r.source,
      reconciled: r.reconciled,
      matchedId: r.matched_id,
      subscriptionId: r.subscription_id,
      createdAt: r.created_at,
    }),
  },
  categories: {
    table: "categories",
    toRow: (c) => ({
      id: c.id, label: c.label, color: c.color, icon: c.icon,
      exclude_from_expense: !!c.excludeFromExpense,
      budget: c.budget != null ? c.budget : null,
      type: c.type || null,
      is_savings: !!c.isSavings,
    }),
    fromRow: (r) => ({
      id: r.id, label: r.label, color: r.color, icon: r.icon,
      excludeFromExpense: !!r.exclude_from_expense,
      budget: r.budget != null ? Number(r.budget) : null,
      type: r.type || null,
      isSavings: !!r.is_savings,
    }),
  },
  merchantRules: {
    table: "merchant_rules",
    toRow: (m) => ({ id: m.id, match_text: m.matchText, category_id: m.categoryId, alias: m.alias }),
    fromRow: (r) => ({ id: r.id, matchText: r.match_text, categoryId: r.category_id, alias: r.alias }),
  },
  subscriptions: {
    table: "subscriptions",
    toRow: (s) => ({ id: s.id, name: s.name, amount: s.amount, category_id: s.category, day_of_month: s.dayOfMonth, active: !!s.active }),
    fromRow: (r) => ({ id: r.id, name: r.name, amount: Number(r.amount), category: r.category_id, dayOfMonth: r.day_of_month, active: !!r.active }),
  },
};

// PostgREST (la API que usa Supabase) devuelve como máximo esta cantidad de
// filas por consulta aunque no se pida un límite explícito — sin paginar,
// una cuenta con más de PAGE_SIZE movimientos acumulados (fácil de llegar
// tras varios meses de cartolas) se cargaba incompleta en el cliente, sin
// ningún error visible. Esto hacía que el chequeo de "ya existe" al
// importar fallara para los movimientos que quedaban fuera de esa primera
// página, y el intento de volver a insertarlos chocaba con la restricción
// UNIQUE de la base de datos (el error real, antes oculto, era
// "duplicate key value violates unique constraint ...").
const PAGE_SIZE = 1000;

export const storage = {
  async get(key) {
    const spec = TABLES[key];
    if (!spec) return null;
    try {
      let rows = [];
      let from = 0;
      // eslint-disable-next-line no-constant-condition -- se corta abajo con el break
      while (true) {
        const { data, error } = await supabase.from(spec.table).select("*").range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        rows = rows.concat(data);
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      return { key, value: JSON.stringify(rows.map(spec.fromRow)) };
    } catch (e) {
      console.error(`No se pudo leer "${key}" desde Supabase`, e);
      return null;
    }
  },

  // prevItems: el array (forma de app, no fila cruda) que la propia App ya
  // tenía en memoria antes de este cambio — se usa para diffear localmente
  // en vez de volver a pedirle la tabla completa a Supabase en cada
  // guardado. Es seguro: la app ya trata su estado local como la fuente de
  // verdad (patrón optimista en persistTx/persistCats/persistRules, que
  // revierte si el guardado falla), así que no hace falta reconfirmar
  // contra el servidor antes de escribir.
  async set(key, value, prevItems = []) {
    const spec = TABLES[key];
    if (!spec) return null;
    try {
      const items = JSON.parse(value);
      const existingById = new Map(prevItems.map((item) => [item.id, item]));

      // solo mandamos a upsert lo que es nuevo o realmente cambió — en vez
      // de reenviar la tabla completa en cada guardado.
      const changed = items.filter((item) => {
        const prev = existingById.get(item.id);
        return !prev || !shallowEqual(prev, item);
      });
      const nextIds = new Set(items.map((i) => i.id));
      const toDelete = prevItems.map((i) => i.id).filter((id) => !nextIds.has(id));

      if (changed.length > 0) {
        const { error: upsertError } = await supabase.from(spec.table).upsert(changed.map(spec.toRow));
        if (upsertError) throw upsertError;
      }
      if (toDelete.length > 0) {
        const { error: delError } = await supabase.from(spec.table).delete().in("id", toDelete);
        if (delError) throw delError;
      }
      return { key, value };
    } catch (e) {
      console.error(`No se pudo guardar "${key}" en Supabase`, e);
      // en un choque de restricción UNIQUE, Postgres manda el valor exacto
      // que colisionó en el campo `details` (ej. "Key (user_id, key)=(...)
      // already exists.") — sin esto solo se veía el mensaje genérico, sin
      // ninguna pista de CUÁL fila específica ya existía.
      const detail = [e.message, e.details].filter(Boolean).join(" — ");
      return { key, error: detail || String(e) };
    }
  },
};

function shallowEqual(a, b) {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((k) => a[k] === b[k]);
}
