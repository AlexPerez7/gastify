import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { parseClpNumber, parseBankDate } from "./utils.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

const DATE = "(\\d{2}\\/\\d{2}\\/\\d{4})";
const MONEY = "([\\d.,]+)";

// Extrae del Estado de Cuenta CMR (PDF) solo el resumen del ciclo — cupo,
// fechas, totales — NO el detalle de movimientos (eso lo cubre mejor
// parseCreditCardXlsx.js, una tabla limpia; acá sería más frágil y
// duplicaría esa lógica en dos formatos).
//
// El bloque lateral "RESUMEN DE PAGO" (arriba a la derecha, con el cupón de
// pago) extrae con pdfjs en un orden engañoso — todas las etiquetas juntas,
// después todos los valores juntos ("• Pagar Hasta • Monto Total Facturado
// a Pagar • Monto mínimo a pagar 05/09/2026 $234.320 $55.080") — emparejar
// por adyacencia ahí daría datos cruzados. Todo lo que necesitamos también
// aparece limpio, en orden de lectura normal, más abajo en el cuerpo del
// documento (secciones "I. INFORMACIÓN GENERAL" y "III. INFORMACIÓN DE
// PAGO"), así que se ignora todo el texto anterior a esa sección.
export async function parseCreditStatementPdf(buf) {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  let fullText = "";
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    fullText += content.items.map((i) => i.str).join(" ") + " ";
  }

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
