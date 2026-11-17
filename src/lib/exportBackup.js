import { storage } from "./storage.js";
import { localIsoDate } from "./utils.js";
import { getAccountSettings } from "./accountSettings.js";

// Lee todas las entidades guardadas. Un error en una sola lectura cancela
// la descarga: un archivo parcial no debe presentarse como respaldo completo.
export async function exportBackup() {
  const keys = ["transactions", "categories", "merchantRules", "subscriptions", "creditTransactions", "creditStatements"];
  const [tables, accountSettings] = await Promise.all([
    Promise.all(keys.map((key) => storage.get(key))),
    getAccountSettings({ throwOnError: true }),
  ]);
  if (tables.some((table) => !table)) throw new Error("No se pudieron leer todos los datos desde Supabase.");

  const payload = {
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    ...Object.fromEntries(tables.map((table, i) => [keys[i], JSON.parse(table.value)])),
    accountSettings,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `gastify-respaldo-${localIsoDate()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
