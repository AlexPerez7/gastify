// Los tres flujos de importación de archivos: cartola de débito (.xls o
// PDF), Excel de la tarjeta CMR y PDF del Estado de Cuenta CMR. Acá viven la
// lectura del archivo, los toasts y el guardado; el armado de filas es puro
// y está en src/lib/importers.js.
import { useState, useCallback, useRef } from "react";
import { readFileWithProgress } from "../lib/readFile.js";
import { saveAccountSettings } from "../lib/accountSettings.js";
import { formatCLP } from "../lib/utils.js";
import {
  bankRowsFromSheet, buildBankImport, evaluateBalanceSync, buildCreditImport, replaceCreditStatement,
  importFailureMessage,
} from "../lib/importers.js";

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const importedSummary = (n) =>
  `${plural(n, "movimiento")} ${n === 1 ? "nuevo" : "nuevos"} ${n === 1 ? "importado" : "importados"}.`;

// filas [fecha, desc, cargo, abono, saldo] de la cartola de débito, sea .xls
// o PDF — xlsx y pdfjs solo se descargan al importar.
async function readBankRows(buf, isPdf) {
  if (isPdf) {
    const { parsePdfRows } = await import("../lib/parsePdfCartola.js");
    return parsePdfRows(buf);
  }
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return bankRowsFromSheet(XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" }));
}

// Candado contra doble importación: si el usuario suelta el archivo dos
// veces antes de que la primera pasada termine de guardar, dos llamadas
// corren en paralelo con la MISMA foto del estado (closures viejas) —
// ninguna ve lo que la otra importó y ambas guardan su lote: duplicados
// reales. Un ref por flujo (el estado de React llegaría tarde) + un flag de
// UI para deshabilitar el botón.
function useImportLock() {
  const ref = useRef(false);
  const [busy, setBusy] = useState(false);
  const acquire = useCallback(() => {
    if (ref.current) return false;
    ref.current = true;
    setBusy(true);
    return true;
  }, []);
  const release = useCallback(() => { ref.current = false; setBusy(false); }, []);
  return { busy, acquire, release };
}

/**
 * @param {ReturnType<typeof import("./useAppData.js").useAppData>} data
 * @param {{ pushToast: Function, updateToast: Function }} toasts
 */
export function useImporters(data, { pushToast, updateToast }) {
  const {
    transactions, creditTransactions, creditStatements, merchantRules, accountSettings, setAccountSettings,
    persistTx, persistCreditTx, persistCreditStatements, lastPersistError,
  } = data;

  // ids agregados por la ÚLTIMA importación de débito — para revisarlos sin
  // buscarlos a mano (banner + filtro "Ver solo estos" en Movimientos).
  const [recentImportIds, setRecentImportIds] = useState([]);
  const bankLock = useImportLock();
  const creditLock = useImportLock();
  const statementLock = useImportLock();

  const persistErrorDetail = () => (lastPersistError.current ? ` (${lastPersistError.current})` : "");

  // ---- cartola de débito (.xls / PDF) --------------------------------------
  const handleFile = useCallback(
    async (file) => {
      if (!bankLock.acquire()) return;
      const toastId = pushToast("loading", "Leyendo archivo…", 0);
      try {
        const isPdf = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
        const buf = await readFileWithProgress(file, (pct) => updateToast(toastId, "loading", "Leyendo archivo…", pct));
        updateToast(toastId, "loading", "Procesando movimientos…");

        const dataRows = await readBankRows(buf, isPdf);
        const { imported, latestRow } = buildBankImport(dataRows, transactions, merchantRules, new Date().toISOString());

        // sin ninguna fila reconocible (ni para importar ni para conciliar)
        if (imported.length === 0 && !latestRow) {
          updateToast(toastId, "error", "No se reconocieron movimientos en este archivo.");
          return;
        }

        // aunque todo ya estuviera importado, el archivo igual puede traer un
        // Saldo útil para conciliar — por eso no se corta acá.
        const persisted = imported.length > 0 ? await persistTx([...transactions, ...imported]) : true;
        if (imported.length > 0 && !persisted) {
          updateToast(toastId, "error", `No se pudieron guardar los movimientos importados. Intenta de nuevo.${persistErrorDetail()}`);
          return;
        }
        // se reemplaza (no se acumula): si esta pasada no trajo nada nuevo, el
        // aviso de la anterior también debe desaparecer.
        setRecentImportIds(imported.map((t) => t.id));

        const { fileLastSyncDate, isHistoric } = evaluateBalanceSync(latestRow.date, accountSettings);
        if (isHistoric) {
          const importedMsg = imported.length > 0 ? importedSummary(imported.length) : "Sin movimientos nuevos (ya estaban todos importados).";
          updateToast(toastId, "warn", `${importedMsg} Saldo sin cambios — este archivo es más antiguo que tu última conciliación.`);
          return;
        }

        const settings = await saveAccountSettings(latestRow.saldo, fileLastSyncDate);
        if (settings && !settings.error) {
          setAccountSettings((prev) => ({ ...prev, ...settings }));
          updateToast(
            toastId,
            "ok",
            imported.length > 0
              ? `Movimientos importados. Saldo conciliado a ${formatCLP(latestRow.saldo)}.`
              : `Archivo procesado (0 nuevos). Saldo conciliado a ${formatCLP(latestRow.saldo)}.`
          );
        } else {
          const importedMsg = imported.length > 0 ? importedSummary(imported.length) : "Archivo procesado, sin movimientos nuevos.";
          const detail = settings?.error ? ` (${settings.error})` : "";
          updateToast(toastId, "warn", `${importedMsg} No se pudo conciliar el saldo automáticamente.${detail}`);
        }
      } catch (e) {
        console.error(e);
        updateToast(toastId, "error", importFailureMessage(e, "No se pudo leer el archivo. ¿Es el .xls de movimientos del banco?", navigator.onLine));
      } finally {
        bankLock.release();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bankLock/lastPersistError son estables (ref + callbacks memoizados)
    [transactions, merchantRules, persistTx, pushToast, updateToast, accountSettings, setAccountSettings]
  );

  // ---- Excel "Movimientos Facturados" de la tarjeta CMR --------------------
  const handleCreditFile = useCallback(
    async (file) => {
      if (!creditLock.acquire()) return;
      const toastId = pushToast("loading", "Leyendo cartola…", 0);
      try {
        const buf = await readFileWithProgress(file, (pct) => updateToast(toastId, "loading", "Leyendo cartola…", pct));
        updateToast(toastId, "loading", "Procesando movimientos…");

        const { parseCreditCardRows } = await import("../lib/parseCreditCardXlsx.js");
        const rows = await parseCreditCardRows(buf);
        if (rows.length === 0) {
          updateToast(toastId, "error", "No se reconocieron movimientos en este archivo.");
          return;
        }

        const { imported } = buildCreditImport(rows, creditTransactions, merchantRules, new Date().toISOString());
        if (imported.length === 0) {
          updateToast(toastId, "ok", "Sin movimientos nuevos (ya estaban todos importados).");
          return;
        }

        const persisted = await persistCreditTx([...creditTransactions, ...imported]);
        if (!persisted) {
          updateToast(toastId, "error", `No se pudieron guardar los movimientos importados. Intenta de nuevo.${persistErrorDetail()}`);
          return;
        }
        updateToast(toastId, "ok", `${plural(imported.length, "movimiento")} ${imported.length === 1 ? "importado" : "importados"}.`);
      } catch (e) {
        console.error(e);
        updateToast(toastId, "error", importFailureMessage(e, 'No se pudo leer el archivo. ¿Es el Excel de "Movimientos Facturados" de CMR?', navigator.onLine));
      } finally {
        creditLock.release();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- creditLock/lastPersistError son estables
    [creditTransactions, merchantRules, persistCreditTx, pushToast, updateToast]
  );

  // ---- PDF Estado de Cuenta CMR (cupo, fechas, totales) --------------------
  const handleCreditStatementFile = useCallback(
    async (file) => {
      if (!statementLock.acquire()) return;
      const toastId = pushToast("loading", "Leyendo estado de cuenta…", 0);
      try {
        const buf = await readFileWithProgress(file, (pct) => updateToast(toastId, "loading", "Leyendo estado de cuenta…", pct));
        updateToast(toastId, "loading", "Procesando…");

        const { parseCreditStatementPdf } = await import("../lib/parseCreditStatementPdf.js");
        const parsed = await parseCreditStatementPdf(buf);
        if (!parsed) {
          updateToast(toastId, "error", "No se pudo leer este PDF. ¿Es el Estado de Cuenta CMR?");
          return;
        }

        const persisted = await persistCreditStatements(replaceCreditStatement(creditStatements, parsed, new Date().toISOString()));
        if (!persisted) {
          updateToast(toastId, "error", `No se pudo guardar el estado de cuenta. Intenta de nuevo.${persistErrorDetail()}`);
          return;
        }
        updateToast(
          toastId, "ok",
          parsed.cupoAvailable != null
            ? `Estado de cuenta actualizado. Cupo disponible: ${formatCLP(parsed.cupoAvailable)}.`
            : "Estado de cuenta actualizado."
        );
      } catch (e) {
        console.error(e);
        updateToast(toastId, "error", importFailureMessage(e, "No se pudo leer el archivo. ¿Es el Estado de Cuenta CMR en PDF?", navigator.onLine));
      } finally {
        statementLock.release();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- statementLock/lastPersistError son estables
    [creditStatements, persistCreditStatements, pushToast, updateToast]
  );

  const clearRecentImports = useCallback(() => setRecentImportIds([]), []);

  return {
    handleFile, isImporting: bankLock.busy,
    handleCreditFile, isImportingCredit: creditLock.busy,
    handleCreditStatementFile, isImportingStatement: statementLock.busy,
    recentImportIds, clearRecentImports,
  };
}
