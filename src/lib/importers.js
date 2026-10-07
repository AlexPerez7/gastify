// Armado de filas nuevas a partir de lo que entregan los parsers (débito
// xls/PDF, Excel CMR, PDF de estado de cuenta). Lógica pura: dedupe por
// clave, categorización y convenciones de signo. La lectura de archivos, los
// toasts y el guardado viven en src/hooks/useImporters.js.
import { autoCategory, applyMerchantRules, parseClpNumber, parseBankDate, makeKey, makeCreditKey, monthKey, uid } from "./utils.js";

/**
 * @typedef {import("./types.js").Transaction} Transaction
 * @typedef {import("./types.js").MerchantRule} MerchantRule
 * @typedef {import("./types.js").CreditTransaction} CreditTransaction
 * @typedef {import("./types.js").CreditStatement} CreditStatement
 * @typedef {import("./types.js").AccountSettings} AccountSettings
 */

/**
 * Filas de datos de la hoja del .xls de débito (salida de sheet_to_json con
 * header: 1): todo lo que viene después de la fila de encabezado que dice
 * "fecha", sin filas vacías.
 * @param {any[][]} rows
 * @returns {any[][]}
 */
export function bankRowsFromSheet(rows) {
  let headerIdx = rows.findIndex((r) => r.some((c) => String(c).trim().toLowerCase() === "fecha"));
  if (headerIdx === -1) headerIdx = 0;
  return rows.slice(headerIdx + 1).filter((r) => r[0] && String(r[0]).trim() !== "");
}

/**
 * Convierte filas [fecha, desc, cargo, abono, saldo] del banco en
 * movimientos nuevos (omite los que ya existen) y detecta la fila más
 * reciente para conciliar el saldo.
 * @param {any[][]} dataRows
 * @param {Transaction[]} transactions  estado actual (para dedupe)
 * @param {MerchantRule[]} merchantRules
 * @param {string} importedAt  ISO
 * @returns {{ imported: Transaction[], latestRow: { date: string, saldo: number } | null }}
 */
export function buildBankImport(dataRows, transactions, merchantRules, importedAt) {
  const existingKeys = new Set(transactions.filter((t) => t.source === "bank").map((t) => t.key));
  /** @type {Transaction[]} */
  const imported = [];
  // fila con la fecha más reciente del archivo. Se calcula sobre TODAS las
  // filas crudas, no sobre `imported` — así, si el archivo ya estaba todo
  // importado, el Saldo igual se extrae. En empates de fecha se queda con la
  // PRIMERA: el banco lista el movimiento más reciente arriba, así que la
  // primera fila de esa fecha trae el saldo vigente al cierre del día.
  let latestRow = null;

  for (const r of dataRows) {
    const [fecha, desc, cargo, abono, saldo] = r;
    if (!desc) continue;
    const date = parseBankDate(fecha);
    // fecha ilegible: se descarta en vez de dejar entrar una `date` inválida
    // que después rompe monthKey/orden/conciliación.
    if (!date) continue;
    const cargoN = parseClpNumber(cargo);
    const abonoN = parseClpNumber(abono);
    const saldoN = parseClpNumber(saldo);
    if (!latestRow || date > latestRow.date) latestRow = { date, saldo: saldoN };

    // la clave usa el Saldo (no la descripción): el banco no escribe la
    // descripción idéntica entre el .xls y la cartola PDF (ej. omite "CHL"),
    // pero el Saldo resultante es el mismo en ambos — y al ser un acumulado,
    // dos movimientos reales distintos no pueden compartir
    // fecha+cargo+abono+saldo.
    const key = makeKey(date, String(saldoN), cargoN, abonoN);
    if (existingKeys.has(key)) continue;
    existingKeys.add(key);
    const cleanDesc = String(desc).trim().replace(/\s+/g, " ");
    const rule = applyMerchantRules(cleanDesc, merchantRules, abonoN > 0 ? abonoN : -cargoN);
    imported.push({
      id: uid(),
      key,
      date,
      description: cleanDesc,
      alias: rule ? rule.alias : "",
      amount: abonoN > 0 ? abonoN : -cargoN,
      category: rule ? rule.categoryId : autoCategory(cleanDesc),
      source: "bank",
      reconciled: false,
      matchedId: null,
      // la columna real la pone Supabase (default now()); esto es para que
      // el orden "más reciente arriba" ya quede bien sin esperar un reload.
      createdAt: importedAt,
    });
  }
  return { imported, latestRow };
}

/**
 * Decide si el Saldo de un archivo puede pisar la última conciliación. El
 * Saldo del banco es el saldo AL CIERRE del día de su fila más reciente, así
 * que la fecha de sync es el fin de ese día (un manual cargado ese mismo día
 * ya debería estar reflejado). Un archivo más viejo que la última
 * conciliación es "histórico" y no debe pisar un saldo ya actualizado.
 * @param {string} latestDate  ISO "YYYY-MM-DD"
 * @param {AccountSettings|null} accountSettings
 * @returns {{ fileLastSyncDate: string, isHistoric: boolean }}
 */
export function evaluateBalanceSync(latestDate, accountSettings) {
  const [y, m, d] = latestDate.split("-").map(Number);
  const fileLastSyncDate = new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
  // sin settings (o sin last_sync_date) es la primera sincronización: nunca
  // puede ser histórica. Se compara como Date para no depender del formato
  // exacto en que Supabase devuelve el timestamptz.
  const isFirstSync = !accountSettings || !accountSettings.lastSyncDate;
  const isHistoric = !isFirstSync && new Date(fileLastSyncDate) < new Date(accountSettings.lastSyncDate);
  return { fileLastSyncDate, isHistoric };
}

/**
 * Movimientos nuevos de la tarjeta CMR a partir de parseCreditCardRows.
 * @param {Array<{date: string, description: string, montoTotal: number, cuotasPendientes: number, valorCuota: number, holder?: string}>} rows
 * @param {CreditTransaction[]} creditTransactions
 * @param {MerchantRule[]} merchantRules
 * @param {string} importedAt
 * @returns {{ statementMonth: string, imported: CreditTransaction[] }}
 */
export function buildCreditImport(rows, creditTransactions, merchantRules, importedAt) {
  // el ciclo no viene explícito en el archivo (FECHA es la fecha de compra
  // original, que se repite en cada cartola para una compra en cuotas), pero
  // la cartola siempre trae al menos un movimiento reciente: el mes de la
  // fecha MÁS RECIENTE es un proxy confiable del ciclo.
  const latestDate = rows.reduce((max, r) => (!max || r.date > max ? r.date : max), /** @type {string} */ (""));
  const statementMonth = latestDate.slice(0, 7);

  const existingKeys = new Set(creditTransactions.map((t) => t.key));
  /** @type {CreditTransaction[]} */
  const imported = [];
  for (const r of rows) {
    // statementMonth es parte de la clave: sin él, la cuota 2 de una compra
    // se vería como "ya importada" (ver makeCreditKey).
    const key = makeCreditKey(statementMonth, r.date, r.description, r.montoTotal, r.cuotasPendientes, r.valorCuota);
    if (existingKeys.has(key)) continue;
    existingKeys.add(key);
    const rule = applyMerchantRules(r.description, merchantRules, -r.valorCuota);
    imported.push({
      id: uid(),
      key,
      statementMonth,
      date: r.date,
      description: r.description,
      alias: rule ? rule.alias : "",
      // CMR reporta VALOR CUOTA positivo (lo cobrado), pero la convención de
      // la app es la del débito: negativo = gasto. Se invierte acá para que
      // la UI no necesite casos especiales.
      amount: -r.valorCuota,
      totalAmount: r.montoTotal,
      installmentsPending: r.cuotasPendientes,
      holder: r.holder,
      category: rule ? rule.categoryId : autoCategory(r.description),
      createdAt: importedAt,
    });
  }
  return { statementMonth, imported };
}

/**
 * Agrega el resumen de un estado de cuenta CMR. Reimportar el mismo ciclo
 * reemplaza la fila anterior en vez de duplicarla (el diff de storage.js
 * borra el id viejo e inserta el nuevo).
 * @param {CreditStatement[]} creditStatements
 * @param {Omit<CreditStatement, "id"|"statementMonth">} parsed
 * @param {string} createdAt
 * @returns {CreditStatement[]}
 */
export function replaceCreditStatement(creditStatements, parsed, createdAt) {
  const statementMonth = monthKey(parsed.statementDate);
  return [
    ...creditStatements.filter((s) => s.statementMonth !== statementMonth),
    { id: uid(), statementMonth, ...parsed, createdAt },
  ];
}
