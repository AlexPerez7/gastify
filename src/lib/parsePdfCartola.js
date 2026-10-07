import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { extractPdfPages, cartolaRowsFromPages } from "./pdfParsing.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

// Cartola de débito PDF → filas [fecha, desc, cargo, abono, saldo], igual
// que el .xls. Acá solo se lee el PDF con el pdfjs del navegador; el parseo
// (testeado) vive en pdfParsing.js.
export async function parsePdfRows(buf) {
  return cartolaRowsFromPages(await extractPdfPages(pdfjsLib, buf));
}
