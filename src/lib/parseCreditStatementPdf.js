import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { extractPdfPages, pagesToText, creditStatementFromText } from "./pdfParsing.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

// Estado de Cuenta CMR (PDF) → resumen del ciclo (cupo, fechas, totales), o
// null si no se reconoce. Acá solo se lee el PDF con el pdfjs del navegador;
// el parseo (testeado) vive en pdfParsing.js.
export async function parseCreditStatementPdf(buf) {
  return creditStatementFromText(pagesToText(await extractPdfPages(pdfjsLib, buf)));
}
