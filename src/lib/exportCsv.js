import { storage } from "./storage.js";
import { localIsoDate } from "./utils.js";

function csvEscape(value) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Mismo patrón que exportBackup: trae transactions/categories directamente
// desde Supabase (no del estado local) para que el CSV siempre refleje lo
// que realmente quedó guardado. A diferencia del .json, acá se resuelve
// cada categoría a su nombre (no el id interno) para que sea legible al
// abrirlo en Excel/Sheets, y el monto queda como número plano (sin "$" ni
// separador de miles) para poder sumarlo directo en la planilla.
export async function exportCsv() {
  const [tx, cats] = await Promise.all([storage.get("transactions"), storage.get("categories")]);
  if (!tx || !cats) throw new Error("No se pudieron leer los datos desde Supabase.");

  const transactions = JSON.parse(tx.value);
  const categories = JSON.parse(cats.value);
  const labelById = Object.fromEntries(categories.map((c) => [c.id, c.label]));

  const header = ["Fecha", "Descripción", "Nombre", "Categoría", "Monto", "Fuente", "Conciliado"];
  const rows = transactions
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map((t) => [
      t.date,
      t.description,
      t.alias || "",
      labelById[t.category] || t.category,
      t.amount,
      t.source === "bank" ? "Banco" : "Manual",
      // al conciliar, el registro manual se fusiona en el del banco (que se
      // queda con matchedId) — así que "conciliado" ahora se mira en
      // matchedId, no en el viejo flag `reconciled` (que ya no se usa: un
      // manual que sigue existiendo, por definición, nunca se conciliaba).
      t.matchedId ? "Sí" : "No",
    ]);

  const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
  // BOM al inicio: sin esto, Excel en Windows abre el archivo asumiendo
  // otra codificación y rompe las tildes/ñ.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `gastify-movimientos-${localIsoDate()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
