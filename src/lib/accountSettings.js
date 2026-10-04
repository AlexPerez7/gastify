// account_settings es una tabla de un solo registro por usuario (no una
// lista como transactions/categories), así que no encaja en el patrón
// array-diffing de storage.js — se maneja aparte con get/save directos.
import { supabase } from "./supabaseClient.js";

// Devuelve null tanto si el usuario todavía no ajustó su saldo (no hay fila)
// como si falló la lectura — en ambos casos el dashboard debe mostrar el
// estado "sin ajustar" en vez de romper.
export async function getAccountSettings() {
  try {
    const { data, error } = await supabase
      .from("account_settings")
      .select("base_balance, last_sync_date, savings_base, savings_base_date")
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    // base_balance null = la fila existe solo por el ahorro base; el saldo
    // sigue "sin ajustar" (Number(null) daría un 0 falso)
    return {
      baseBalance: data.base_balance != null ? Number(data.base_balance) : null,
      lastSyncDate: data.last_sync_date,
      savingsBase: data.savings_base != null ? Number(data.savings_base) : null,
      savingsBaseDate: data.savings_base_date,
    };
  } catch (e) {
    console.error("No se pudo leer account_settings desde Supabase", e);
    return null;
  }
}

// lastSyncDate es opcional: el ajuste manual usa "ahora" (default), pero la
// conciliación automática al importar el .xls necesita fijarlo a la fecha
// exacta de la fila más reciente del banco, no al momento de la importación.
export async function saveAccountSettings(baseBalance, lastSyncDate = new Date().toISOString()) {
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    const userId = userData?.user?.id;
    if (!userId) throw new Error("No hay usuario autenticado");

    // create-or-update explícito en dos pasos en vez de upsert: primero
    // intenta actualizar la fila del usuario, y si no existía (0 filas
    // afectadas), recién ahí la crea. Así el ajuste manual funciona sin
    // errores la primera vez que un usuario guarda su saldo, sin necesitar
    // que ya exista una fila en account_settings de antes.
    const { data: updated, error: updateError } = await supabase
      .from("account_settings")
      .update({ base_balance: baseBalance, last_sync_date: lastSyncDate })
      .eq("user_id", userId)
      .select();
    if (updateError) throw updateError;

    if (!updated || updated.length === 0) {
      const { error: insertError } = await supabase
        .from("account_settings")
        .insert({ user_id: userId, base_balance: baseBalance, last_sync_date: lastSyncDate });
      if (insertError) throw insertError;
    }

    return { baseBalance, lastSyncDate };
  } catch (e) {
    console.error("No se pudo guardar account_settings en Supabase", e);
    // se devuelve el mensaje real (no null) para poder mostrárselo al
    // usuario — sin esto, un fallo de Supabase (ej. RLS) queda invisible y
    // solo se ve en la consola del navegador, imposible de revisar en mobile.
    return { error: e.message || String(e) };
  }
}

// mismo patrón que saveAccountSettings (update, y si no había fila todavía
// la crea) pero para el ajuste manual de "Total ahorrado" — un ancla
// independiente del saldo de la cuenta corriente, para que el usuario pueda
// declarar cuánto tenía ahorrado ANTES de empezar a usar la app (lo que ya
// tenía no quedó registrado como movimientos, así que no hay de dónde
// calcularlo solo).
export async function saveSavingsBase(savingsBase, savingsBaseDate = new Date().toISOString()) {
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    const userId = userData?.user?.id;
    if (!userId) throw new Error("No hay usuario autenticado");

    const { data: updated, error: updateError } = await supabase
      .from("account_settings")
      .update({ savings_base: savingsBase, savings_base_date: savingsBaseDate })
      .eq("user_id", userId)
      .select();
    if (updateError) throw updateError;

    if (!updated || updated.length === 0) {
      const { error: insertError } = await supabase
        .from("account_settings")
        .insert({ user_id: userId, savings_base: savingsBase, savings_base_date: savingsBaseDate });
      if (insertError) throw insertError;
    }

    return { savingsBase, savingsBaseDate };
  } catch (e) {
    console.error("No se pudo guardar el ahorro base en Supabase", e);
    return { error: e.message || String(e) };
  }
}
