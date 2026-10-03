import { describe, it, expect } from "vitest";
import { bankRowsFromSheet, buildBankImport, evaluateBalanceSync, buildCreditImport, replaceCreditStatement } from "./importers.js";
import { makeKey } from "./utils.js";

const NOW = "2026-08-10T12:00:00.000Z";

describe("bankRowsFromSheet", () => {
  it("salta el encabezado y las filas vacías", () => {
    const rows = [["Cartola"], ["Fecha", "Descripción", "Cargo", "Abono", "Saldo"], ["01-08-2026", "X", 1, 0, 9], ["", "", "", "", ""]];
    expect(bankRowsFromSheet(rows)).toEqual([["01-08-2026", "X", 1, 0, 9]]);
  });
});

describe("buildBankImport", () => {
  const rows = [
    ["03-08-2026", "UBER EATS  SANTIAGO", "$ 5.000", "", "$ 95.000"],
    ["03-08-2026", "PAGO ANTERIOR", "$ 1.000", "", "$ 100.000"],
    ["01-08-2026", "SUELDO", "", "$ 101.000", "$ 101.000"],
    ["fecha rota", "IGNORADA", "1", "", "1"],
  ];

  it("arma movimientos con signo, categoría y descripción limpia", () => {
    const { imported } = buildBankImport(rows, [], [], NOW);
    expect(imported).toHaveLength(3);
    expect(imported[0]).toMatchObject({ date: "2026-08-03", description: "UBER EATS SANTIAGO", amount: -5000, category: "comida", source: "bank" });
    expect(imported[2]).toMatchObject({ amount: 101000, category: "otros" });
  });

  it("en empate de fecha toma el saldo de la PRIMERA fila (la más reciente)", () => {
    expect(buildBankImport(rows, [], [], NOW).latestRow).toEqual({ date: "2026-08-03", saldo: 95000 });
  });

  it("omite los que ya existen pero igual devuelve el saldo", () => {
    const existing = buildBankImport(rows, [], [], NOW).imported;
    const res = buildBankImport(rows, existing, [], NOW);
    expect(res.imported).toHaveLength(0);
    expect(res.latestRow?.saldo).toBe(95000);
  });

  it("la clave usa el saldo, no la descripción", () => {
    const { imported } = buildBankImport(rows, [], [], NOW);
    expect(imported[0].key).toBe(makeKey("2026-08-03", "95000", 5000, 0));
  });

  it("las reglas del usuario ganan a la categorización automática", () => {
    const rules = [{ id: "r1", matchText: "uber eats", categoryId: "cat_x", alias: "Delivery" }];
    const { imported } = buildBankImport(rows, [], rules, NOW);
    expect(imported[0]).toMatchObject({ category: "cat_x", alias: "Delivery" });
  });
});

describe("evaluateBalanceSync", () => {
  it("primera sincronización nunca es histórica", () => {
    expect(evaluateBalanceSync("2020-01-01", null).isHistoric).toBe(false);
  });
  it("archivo anterior a la última conciliación es histórico", () => {
    const settings = { baseBalance: 0, lastSyncDate: new Date(2026, 7, 5, 23, 59).toISOString() };
    expect(evaluateBalanceSync("2026-08-01", settings).isHistoric).toBe(true);
    expect(evaluateBalanceSync("2026-08-05", settings).isHistoric).toBe(false);
  });
});

describe("buildCreditImport", () => {
  const rows = [
    { date: "2026-08-02", description: "NETFLIX", montoTotal: 9000, cuotasPendientes: 0, valorCuota: 9000 },
    { date: "2026-05-10", description: "TV", montoTotal: 300000, cuotasPendientes: 3, valorCuota: 50000 },
  ];

  it("usa el mes más reciente como ciclo e invierte el signo", () => {
    const { statementMonth, imported } = buildCreditImport(rows, [], [], NOW);
    expect(statementMonth).toBe("2026-08");
    expect(imported[1]).toMatchObject({ statementMonth: "2026-08", amount: -50000, totalAmount: 300000, installmentsPending: 3 });
  });

  it("la misma compra en cuotas en el ciclo siguiente NO se toma como duplicada", () => {
    const aug = buildCreditImport(rows, [], [], NOW).imported;
    const sepRows = [{ ...rows[1], cuotasPendientes: 2 }, { date: "2026-09-01", description: "X", montoTotal: 1, cuotasPendientes: 0, valorCuota: 1 }];
    const sep = buildCreditImport(sepRows, aug, [], NOW).imported;
    expect(sep.map((t) => t.description)).toEqual(["TV", "X"]);
  });
});

describe("replaceCreditStatement", () => {
  it("reimportar el mismo ciclo reemplaza la fila", () => {
    const first = replaceCreditStatement([], { statementDate: "2026-08-20", cupoTotal: 1 }, NOW);
    const second = replaceCreditStatement(first, { statementDate: "2026-08-21", cupoTotal: 2 }, NOW);
    expect(second).toHaveLength(1);
    expect(second[0]).toMatchObject({ statementMonth: "2026-08", cupoTotal: 2 });
  });
});
