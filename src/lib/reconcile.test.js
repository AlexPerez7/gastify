import { describe, it, expect } from "vitest";
import {
  reconcileMonthTransactions,
  matchManualToBank,
  findDuplicateIds,
} from "./reconcile.js";

// helpers para armar transacciones sin repetir todos los campos
const bank = (o) => ({ source: "bank", matchedId: null, alias: "", ...o });
const manual = (o) => ({ source: "manual", matchedId: null, alias: "", ...o });

describe("reconcileMonthTransactions", () => {
  it("fusiona un manual con el cargo del banco del mismo mes y monto, borrando la fila manual", () => {
    const tx = [
      manual({ id: "m1", date: "2026-03-10", amount: -15000, category: "comida", alias: "Almuerzo" }),
      bank({ id: "b1", date: "2026-03-12", amount: -15000, category: "otros" }),
    ];
    const { next, merged } = reconcileMonthTransactions(tx, "2026-03");
    expect(merged).toBe(1);
    expect(next).toHaveLength(1);
    const b1 = next[0];
    expect(b1.id).toBe("b1");
    expect(b1.matchedId).toBe("m1");
    // el banco hereda categoría y alias del manual
    expect(b1.category).toBe("comida");
    expect(b1.alias).toBe("Almuerzo");
  });

  it("calza contra un cargo con fecha contable que ya cayó en el mes siguiente", () => {
    const tx = [
      manual({ id: "m1", date: "2026-03-31", amount: -50000, category: "transferencias" }),
      bank({ id: "b1", date: "2026-04-02", amount: -50000, category: "otros" }),
    ];
    const { next, merged } = reconcileMonthTransactions(tx, "2026-03");
    expect(merged).toBe(1);
    expect(next.find((t) => t.id === "b1").category).toBe("transferencias");
  });

  it("no calza si la diferencia de fecha supera la ventana (+5 días)", () => {
    const tx = [
      manual({ id: "m1", date: "2026-03-10", amount: -15000, category: "comida" }),
      bank({ id: "b1", date: "2026-03-20", amount: -15000, category: "otros" }),
    ];
    const { next, merged } = reconcileMonthTransactions(tx, "2026-03");
    expect(merged).toBe(0);
    expect(next).toBe(tx); // devuelve el mismo array si no hubo cambios
  });

  it("no calza montos distintos", () => {
    const tx = [
      manual({ id: "m1", date: "2026-03-10", amount: -15000, category: "comida" }),
      bank({ id: "b1", date: "2026-03-11", amount: -15500, category: "otros" }),
    ];
    expect(reconcileMonthTransactions(tx, "2026-03").merged).toBe(0);
  });

  it("no reusa un cargo del banco ya vinculado para dos manuales iguales", () => {
    const tx = [
      manual({ id: "m1", date: "2026-03-10", amount: -10000, category: "comida" }),
      manual({ id: "m2", date: "2026-03-10", amount: -10000, category: "comida" }),
      bank({ id: "b1", date: "2026-03-11", amount: -10000, category: "otros" }),
    ];
    const { next, merged } = reconcileMonthTransactions(tx, "2026-03");
    expect(merged).toBe(1);
    // queda un manual sin conciliar + el banco ya fusionado
    expect(next).toHaveLength(2);
    expect(next.filter((t) => t.source === "manual")).toHaveLength(1);
  });

  it("ignora cargos del banco que ya tienen matchedId", () => {
    const tx = [
      manual({ id: "m1", date: "2026-03-10", amount: -10000, category: "comida" }),
      bank({ id: "b1", date: "2026-03-11", amount: -10000, matchedId: "viejo" }),
    ];
    expect(reconcileMonthTransactions(tx, "2026-03").merged).toBe(0);
  });

  it("hereda subscriptionId del manual cuando el banco no tiene", () => {
    const tx = [
      manual({ id: "m1", date: "2026-03-10", amount: -8990, category: "suscripciones", subscriptionId: "sub_x" }),
      bank({ id: "b1", date: "2026-03-11", amount: -8990, category: "otros" }),
    ];
    const { next } = reconcileMonthTransactions(tx, "2026-03");
    expect(next.find((t) => t.id === "b1").subscriptionId).toBe("sub_x");
  });
});

describe("matchManualToBank", () => {
  it("fusiona los dos ids indicados y borra el manual", () => {
    const tx = [
      manual({ id: "m1", date: "2026-03-01", amount: -20000, category: "arriendo", alias: "Depto" }),
      bank({ id: "b1", date: "2026-03-09", amount: -20000, category: "otros" }),
    ];
    const next = matchManualToBank(tx, "m1", "b1");
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ id: "b1", matchedId: "m1", category: "arriendo", alias: "Depto" });
  });

  it("devuelve el array original si algún id no existe", () => {
    const tx = [bank({ id: "b1", date: "2026-03-09", amount: -1000 })];
    expect(matchManualToBank(tx, "noexiste", "b1")).toBe(tx);
  });
});

describe("findDuplicateIds", () => {
  it("marca un manual y un bancario con mismo monto y signo a <=3 días", () => {
    const tx = [
      manual({ id: "m1", date: "2026-03-10", amount: -12000 }),
      bank({ id: "b1", date: "2026-03-12", amount: -12000 }),
    ];
    expect([...findDuplicateIds(tx)].sort()).toEqual(["b1", "m1"]);
  });

  it("no marca dos movimientos del mismo origen aunque coincidan", () => {
    const tx = [
      bank({ id: "b1", date: "2026-03-10", amount: -900 }),
      bank({ id: "b2", date: "2026-03-11", amount: -900 }),
    ];
    expect(findDuplicateIds(tx).size).toBe(0);
  });

  it("no marca si difieren en signo", () => {
    const tx = [
      manual({ id: "m1", date: "2026-03-10", amount: 12000 }),
      bank({ id: "b1", date: "2026-03-11", amount: -12000 }),
    ];
    expect(findDuplicateIds(tx).size).toBe(0);
  });

  it("no marca una pareja ya vinculada por conciliación", () => {
    const tx = [
      manual({ id: "m1", date: "2026-03-10", amount: -12000 }),
      bank({ id: "b1", date: "2026-03-12", amount: -12000, matchedId: "m1" }),
    ];
    expect(findDuplicateIds(tx).size).toBe(0);
  });

  it("no marca si la distancia supera 3 días", () => {
    const tx = [
      manual({ id: "m1", date: "2026-03-10", amount: -12000 }),
      bank({ id: "b1", date: "2026-03-20", amount: -12000 }),
    ];
    expect(findDuplicateIds(tx).size).toBe(0);
  });
});
