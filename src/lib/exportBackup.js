import { storage } from "./storage.js";
import { localIsoDate } from "./utils.js";

// Trae transactions y categories directamente desde Supabase (no del estado
// local de React) para respaldar siempre lo que realmente quedó guardado,
// y fuerza la descarga de un .json con todo. JSON en vez de CSV: no hay que
// escapar comas/comillas en las descripciones y quedan categorías y
// movimientos juntos en un solo archivo, listos para reimportar a futuro.
export async function exportBackup() {
  const [tx, cats] = await Promise.all([storage.get("transactions"), storage.get("categories")]);
  if (!tx || !cats) throw new Error("No se pudieron leer los datos desde Supabase.");

  const payload = {
    exportedAt: new Date().toISOString(),
    transactions: JSON.parse(tx.value),
    categories: JSON.parse(cats.value),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `gastify-respaldo-${localIsoDate()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
