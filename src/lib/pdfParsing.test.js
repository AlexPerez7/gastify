import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { extractPdfPages, cartolaRowsFromPages, pagesToText, creditStatementFromText } from "./pdfParsing.js";
import { parseClpNumber, parseBankDate } from "./utils.js";

// ítem de texto como lo entrega pdfjs (x, y, str)
const it_ = (x, y, str) => ({ x, y, str });

// encabezado de la tabla de una página, con las columnas en las X dadas
const header = (y, { desc = 200, cargo = 400, abono = 480, saldo = 560 } = {}) => [
  it_(50, y, "Fecha"), it_(100, y, "Oficina"), it_(150, y, "Nro Doc"),
  it_(desc, y, "Descripción"), it_(cargo, y, "Cargo"), it_(abono, y, "Abono"), it_(saldo, y, "Saldo"),
];

describe("cartolaRowsFromPages (ítems inventados)", () => {
  it("arma [fecha, desc, cargo, abono, saldo] y clasifica el monto por su X", () => {
    const page = [
      // resumen de saldos antes del encabezado: se ignora aunque traiga fecha y monto
      it_(50, 760, "30/09/2026"), it_(560, 760, "$ 1.000.000"),
      ...header(700),
      // fila de cargo: Oficina y Nro Doc no entran en la descripción;
      // y 680.4 y 679.6 redondean a la misma fila
      it_(50, 680, "05/10/2026"), it_(100, 680, "001"), it_(150, 680.4, "123"),
      it_(200, 679.6, "COMPRA"), it_(240, 680, "LIDER  "), it_(400, 680, "$ 42.000"), it_(560, 680, "$ 958.000"),
      it_(300, 680, "   "), // ítem vacío: se descarta
      // fila de abono
      it_(50, 660, "04/10/2026"), it_(200, 660, "TRANSF DE JUAN"), it_(480, 660, "$ 100.000"), it_(560, 660, "$ 1.000.000"),
      // pie de página: no empieza con fecha
      it_(50, 640, "Página 1 de 2"), it_(560, 640, "$ 0"),
    ];
    expect(cartolaRowsFromPages([page])).toEqual([
      ["05/10/2026", "COMPRA LIDER", "$ 42.000", "", "$ 958.000"],
      ["04/10/2026", "TRANSF DE JUAN", "", "$ 100.000", "$ 1.000.000"],
    ]);
  });

  it("recalcula las columnas en cada página (el encabezado puede moverse)", () => {
    const p1 = [...header(700), it_(50, 680, "05/10/2026"), it_(200, 680, "A"), it_(400, 680, "$ 1"), it_(560, 680, "$ 9")];
    // en la página 2 las columnas están corridas: un monto en x=500, con las
    // X de la página 1 (punto medio (400+480)/2 = 440), sería abono; con las
    // de esta página (punto medio (470+550)/2 = 510) es cargo
    const p2 = [...header(700, { cargo: 470, abono: 550, saldo: 620 }), it_(50, 680, "06/10/2026"), it_(200, 680, "B"), it_(500, 680, "$ 2"), it_(620, 680, "$ 7")];
    expect(cartolaRowsFromPages([p1, p2])).toEqual([
      ["05/10/2026", "A", "$ 1", "", "$ 9"],
      ["06/10/2026", "B", "$ 2", "", "$ 7"],
    ]);
  });

  it("con cargo y abono en la misma fila toma ambos; sin encabezado no hay filas", () => {
    const page = [...header(700), it_(50, 680, "05/10/2026"), it_(200, 680, "X"), it_(400, 680, "$ 5"), it_(480, 680, "$ 3"), it_(560, 680, "$ 8")];
    expect(cartolaRowsFromPages([page])).toEqual([["05/10/2026", "X", "$ 5", "$ 3", "$ 8"]]);
    expect(cartolaRowsFromPages([[it_(50, 680, "05/10/2026"), it_(560, 680, "$ 8")]])).toEqual([]);
  });
});

describe("creditStatementFromText (texto inventado)", () => {
  // el bloque "RESUMEN DE PAGO" de arriba trae etiquetas y valores
  // desordenados: un "Monto Total Facturado a Pagar 999" falso ahí NO debe
  // ganarle al del cuerpo del documento
  const text =
    "RESUMEN DE PAGO • Pagar Hasta • Monto Total Facturado a Pagar 999 • Monto mínimo a pagar 05/09/2026 $234.320 $55.080 " +
    "Fecha Facturación Estado de Cuenta: 20/08/2026 " +
    "I. INFORMACIÓN GENERAL Cupo Compras* 1.000.000 234.320 765.680 Período Facturado 21/07/2026 20/08/2026 " +
    "III. INFORMACIÓN DE PAGO Pagar Hasta 05/09/2026 Monto Total Facturado a Pagar 234.320 Monto Mínimo a Pagar 55.080 ";

  it("lee el resumen del cuerpo, no del bloque desordenado de arriba", () => {
    expect(creditStatementFromText(text)).toEqual({
      statementDate: "2026-08-20", periodFrom: "2026-07-21", periodTo: "2026-08-20", payBy: "2026-09-05",
      totalToPay: 234320, minToPay: 55080, cupoTotal: 1000000, cupoUsed: 234320, cupoAvailable: 765680,
    });
  });

  it("null sin fecha de facturación (no se sabe de qué ciclo es)", () => {
    expect(creditStatementFromText(text.replace("Fecha Facturación Estado de Cuenta: 20/08/2026", ""))).toBeNull();
  });

  it("pagesToText une el texto de las páginas como lo hacía el parser original", () => {
    expect(pagesToText([[it_(0, 0, "a"), it_(0, 0, "b")], [it_(0, 0, "c")]])).toBe("a b c ");
  });
});

// ---- PDF reales ------------------------------------------------------------
// Cartolas/estados de cuenta del usuario en test-fixtures/ (en .gitignore: el
// repo es público y son datos bancarios). Si no están — en CI, o en otra
// máquina — estos tests se saltan. Las aserciones son invariantes que no
// dependen del contenido (no hay montos ni descripciones reales escritos acá).
const FIXTURES = new URL("../../test-fixtures/", import.meta.url);
const debitPdf = new URL("cartola-debito.pdf", FIXTURES);
const cmrPdf = new URL("estado-cuenta-cmr.pdf", FIXTURES);

async function readPages(url) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs"); // build para Node
  return extractPdfPages(pdfjs, readFileSync(url), { verbosity: pdfjs.VerbosityLevel.ERRORS });
}

describe.skipIf(!existsSync(debitPdf))("cartola de débito real (test-fixtures/)", () => {
  it("cada fila tiene fecha válida, descripción y un solo monto (cargo o abono)", async () => {
    const rows = cartolaRowsFromPages(await readPages(debitPdf));
    expect(rows.length).toBeGreaterThan(0);
    for (const [fecha, desc, cargo, abono, saldo] of rows) {
      expect(parseBankDate(fecha)).not.toBeNull();
      expect(desc).not.toBe("");
      expect(!!cargo !== !!abono).toBe(true);
      expect(saldo).toMatch(/^\$\s*[\d.,]+$/);
    }
  });

  it("la cadena de saldos cuadra: saldo anterior − cargo + abono = saldo (el PDF lista lo más reciente primero)", async () => {
    const rows = cartolaRowsFromPages(await readPages(debitPdf)).reverse();
    for (let i = 1; i < rows.length; i++) {
      const [, , cargo, abono, saldo] = rows[i];
      expect(parseClpNumber(rows[i - 1][4]) - parseClpNumber(cargo) + parseClpNumber(abono)).toBe(parseClpNumber(saldo));
    }
  });
}, 30000);

describe.skipIf(!existsSync(cmrPdf))("estado de cuenta CMR real (test-fixtures/)", () => {
  it("encuentra los 9 datos del resumen y son coherentes entre sí", async () => {
    const s = creditStatementFromText(pagesToText(await readPages(cmrPdf)));
    expect(s).not.toBeNull();
    for (const v of Object.values(s)) expect(v).not.toBeNull();
    expect(s.periodFrom < s.periodTo).toBe(true);
    expect(s.payBy > s.statementDate).toBe(true);
    expect(s.minToPay).toBeLessThanOrEqual(s.totalToPay);
    expect(s.cupoUsed + s.cupoAvailable).toBe(s.cupoTotal);
  });
}, 30000);
