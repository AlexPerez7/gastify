// Parseo de los PDF del banco, separado de la lectura con pdfjs para poder
// testearlo: parsePdfCartola.js y parseCreditStatementPdf.js (los que usa la
// app, con el pdfjs del navegador) solo extraen el texto con
// extractPdfPages y le pasan el resultado a estas funciones. Los tests hacen
// lo mismo con el pdfjs "legacy" de Node, sobre ítems inventados y — si
// están en test-fixtures/, que nunca se versiona — sobre PDF reales.
import { parseClpNumber, parseBankDate } from "./utils.js";

/** @typedef {{ x: number, y: number, str: string }} PdfTextItem  str tal cual lo entrega pdfjs (sin trim) */

/**
 * Texto de cada página como ítems con posición. `pdfjsLib` se inyecta: en la
 * app es "pdfjs-dist" (con su worker), en los tests "pdfjs-dist/legacy".
 * @param {any} pdfjsLib
 * @param {ArrayBuffer | Uint8Array} buf
 * @param {object} [docOptions]  extra para getDocument (los tests bajan la verbosidad)
 * @returns {Promise<PdfTextItem[][]>}
 */
export async function extractPdfPages(pdfjsLib, buf, docOptions = {}) {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf), ...docOptions }).promise;
  const pages = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => ({ x: item.transform[4], y: item.transform[5], str: item.str })));
  }
  return pages;
}

const DATE_RE = /^\d{2}\/\d{2}\/\d{4}$/;
const MONEY_RE = /^\$\s*[\d.,]+$/;

/**
 * Filas de la tabla "Detalle de Movimientos" de una cartola PDF de Banco
 * Falabella, con la misma forma [fecha, desc, cargo, abono, saldo] que
 * entrega el .xls — así el resto del flujo de importación no distingue el
 * formato de origen. El texto del PDF no trae columnas (solo texto por
 * posición X/Y), así que hay que reconstruir cada fila por su coordenada Y y
 * clasificar cada monto como Cargo/Abono comparando su X contra la posición
 * de esas columnas en el encabezado de la propia página (se repite en cada
 * página del PDF, por eso se recalcula por página en vez de una vez sola).
 * @param {PdfTextItem[][]} pages
 * @returns {string[][]}
 */
export function cartolaRowsFromPages(pages) {
  const dataRows = [];

  for (const pageItems of pages) {
    const rowsByY = new Map();
    for (const item of pageItems) {
      const str = item.str.trim();
      if (!str) continue;
      const y = Math.round(item.y);
      if (!rowsByY.has(y)) rowsByY.set(y, []);
      rowsByY.get(y).push({ x: item.x, str });
    }
    const ys = Array.from(rowsByY.keys()).sort((a, b) => b - a); // de arriba a abajo (Y del PDF crece hacia arriba)

    let cargoX = null;
    let abonoX = null;
    let descX = null;
    let sawHeader = false;

    for (const y of ys) {
      const items = rowsByY.get(y).sort((a, b) => a.x - b.x);

      if (!sawHeader) {
        const cargoItem = items.find((i) => i.str === "Cargo");
        const abonoItem = items.find((i) => i.str === "Abono");
        const descItem = items.find((i) => i.str.startsWith("Descripci"));
        if (cargoItem && abonoItem && descItem) {
          cargoX = cargoItem.x;
          abonoX = abonoItem.x;
          descX = descItem.x;
          sawHeader = true;
        }
        continue; // todo lo anterior al encabezado es el resumen de saldos, no movimientos
      }

      if (!DATE_RE.test(items[0].str)) continue; // no es una fila de movimiento (footer, etc.)

      const fecha = items[0].str;
      const moneyItems = items.filter((i) => MONEY_RE.test(i.str)).sort((a, b) => a.x - b.x);
      if (moneyItems.length === 0) continue;

      // el monto más a la derecha siempre es el Saldo (columna final); el o
      // los montos restantes son Cargo/Abono — se clasifican por posición X
      // relativa a esas dos columnas en el encabezado de esta página.
      const saldoItem = moneyItems[moneyItems.length - 1];
      const rest = moneyItems.slice(0, -1);
      let cargo = "";
      let abono = "";
      if (rest.length === 1) {
        const mid = (cargoX + abonoX) / 2;
        if (rest[0].x < mid) cargo = rest[0].str; else abono = rest[0].str;
      } else if (rest.length >= 2) {
        cargo = rest[0].str;
        abono = rest[1].str;
      }

      // solo el texto de la columna "Descripción" (se excluyen Oficina y Nro
      // Doc, que van antes) — así la descripción queda igual a la del .xls
      // (que no trae esas columnas) y la deduplicación entre ambos formatos
      // funciona: son la misma clave para el mismo movimiento.
      const descItems = items.filter((i) => i.x >= descX - 5 && !MONEY_RE.test(i.str));
      const desc = descItems.map((i) => i.str).join(" ").replace(/\s+/g, " ").trim();

      dataRows.push([fecha, desc, cargo, abono, saldoItem.str]);
    }
  }

  return dataRows;
}

/** Todo el texto del PDF en orden de extracción, como lo leía el parser original. @param {PdfTextItem[][]} pages */
export function pagesToText(pages) {
  return pages.map((items) => items.map((i) => i.str).join(" ") + " ").join("");
}

const DATE = "(\\d{2}\\/\\d{2}\\/\\d{4})";
const MONEY = "([\\d.,]+)";

/**
 * Resumen del ciclo del Estado de Cuenta CMR — cupo, fechas, totales — NO el
 * detalle de movimientos (eso lo cubre mejor parseCreditCardXlsx.js, una
 * tabla limpia; acá sería más frágil y duplicaría esa lógica en dos formatos).
 *
 * El bloque lateral "RESUMEN DE PAGO" (arriba a la derecha, con el cupón de
 * pago) extrae con pdfjs en un orden engañoso — todas las etiquetas juntas,
 * después todos los valores juntos ("• Pagar Hasta • Monto Total Facturado
 * a Pagar • Monto mínimo a pagar 05/09/2026 $234.320 $55.080") — emparejar
 * por adyacencia ahí daría datos cruzados. Todo lo que necesitamos también
 * aparece limpio, en orden de lectura normal, más abajo en el cuerpo del
 * documento (secciones "I. INFORMACIÓN GENERAL" y "III. INFORMACIÓN DE
 * PAGO"), así que se ignora todo el texto anterior a esa sección.
 * @param {string} fullText
 */
export function creditStatementFromText(fullText) {
  const statementDateMatch = fullText.match(new RegExp(`Fecha Facturaci.n Estado de Cuenta:?\\s*${DATE}`, "i"));
  // sin esta fecha no hay forma de saber a qué ciclo pertenece el resumen —
  // el llamador debe avisarle al usuario en vez de guardar datos a medias.
  if (!statementDateMatch) return null;

  const bodyText = fullText.slice(fullText.indexOf("INFORMACIÓN GENERAL"));

  const period = bodyText.match(new RegExp(`Per.odo Facturado\\s+${DATE}\\s+${DATE}`, "i"));
  const payBy = bodyText.match(new RegExp(`Pagar Hasta\\s+${DATE}`, "i"));
  const cupo = bodyText.match(new RegExp(`Cupo Compras\\*?\\s+${MONEY}\\s+${MONEY}\\s+${MONEY}`, "i"));
  const totalToPay = bodyText.match(new RegExp(`Monto Total Facturado a Pagar\\s+${MONEY}`, "i"));
  const minToPay = bodyText.match(new RegExp(`Monto M.nimo a Pagar\\s+${MONEY}`, "i"));

  return {
    statementDate: parseBankDate(statementDateMatch[1]),
    periodFrom: period ? parseBankDate(period[1]) : null,
    periodTo: period ? parseBankDate(period[2]) : null,
    payBy: payBy ? parseBankDate(payBy[1]) : null,
    totalToPay: totalToPay ? parseClpNumber(totalToPay[1]) : null,
    minToPay: minToPay ? parseClpNumber(minToPay[1]) : null,
    cupoTotal: cupo ? parseClpNumber(cupo[1]) : null,
    cupoUsed: cupo ? parseClpNumber(cupo[2]) : null,
    cupoAvailable: cupo ? parseClpNumber(cupo[3]) : null,
  };
}
