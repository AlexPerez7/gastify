import { describe, it, expect } from "vitest";
import {
  reconcileMonthTransactions,
  matchManualToBank,
  findDuplicateIds,
} from "./reconcile.js";
import { makeSubscriptionCharges } from "./transactionOps.js";
import { computeReconcileStats } from "./stats.js";

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

  it("no elige arbitrariamente entre dos manuales para el mismo banco", () => {
    const tx = [
      manual({ id: "m1", date: "2026-03-10", amount: -10000, category: "comida" }),
      manual({ id: "m2", date: "2026-03-10", amount: -10000, category: "comida" }),
      bank({ id: "b1", date: "2026-03-11", amount: -10000, category: "otros" }),
    ];
    const { next, merged } = reconcileMonthTransactions(tx, "2026-03");
    expect(merged).toBe(0);
    expect(next).toBe(tx);
  });

  it("no borra el manual ni cambia categorías si hay dos cargos candidatos", () => {
    const tx = [manual({ id: "m", date: "2026-03-10", amount: -15000, category: "comida" }),
      bank({ id: "b1", date: "2026-03-11", amount: -15000, category: "salud" }),
      bank({ id: "b2", date: "2026-03-12", amount: -15000, category: "transporte" })];
    expect(reconcileMonthTransactions(tx, "2026-03")).toEqual({ next: tx, merged: 0 });
    expect(reconcileMonthTransactions([...tx].reverse(), "2026-03").merged).toBe(0);
  });

  it("concilia las parejas inequívocas mientras deja las ambiguas pendientes", () => {
    const tx = [manual({ id: "m1", date: "2026-03-10", amount: -15000 }),
      bank({ id: "b1", date: "2026-03-11", amount: -15000 }),
      bank({ id: "b2", date: "2026-03-12", amount: -15000 }),
      manual({ id: "m2", date: "2026-03-10", amount: -2000 }),
      bank({ id: "b3", date: "2026-03-11", amount: -2000 })];
    const { next, merged } = reconcileMonthTransactions(tx, "2026-03");
    expect(merged).toBe(1);
    expect(next.find((t) => t.id === "m1")).toBe(tx[0]);
    expect(next.find((t) => t.id === "b3").matchedId).toBe("m2");
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
  it("rechaza vínculos de distinto monto o signo también contra bancos sin confirmar", () => {
    const tx = [manual({ id: "m", amount: -15000 }),
      bank({ id: "b", amount: -14000 }), bank({ id: "abono", amount: 15000 })];
    expect(matchManualToBank(tx, "m", "b")).toBe(tx);
    expect(matchManualToBank(tx, "m", "abono")).toBe(tx);
  });
  it("resuelve un manual extra contra un banco ya confirmado sin perder su clasificación ni regenerar la suscripción", () => {
    const confirmed = bank({ id: "b", date: "2026-08-08", amount: -7300,
      key: "banco", description: "CARGO SERVICIO", category: "suscripciones", alias: "Servicio",
      matchedId: "primer-manual", subscriptionId: "s" });
    const extra = manual({ id: "m", date: "2026-08-08", amount: -7300,
      description: "Servicio local", category: "otros" });
    const tx = [confirmed, extra];
    // Entrar a Revisar no absorbe otro manual automáticamente.
    expect(reconcileMonthTransactions(tx, "2026-08").next).toBe(tx);
    expect(computeReconcileStats(tx, "2026-08").linkCandidates).toContain(confirmed);
    // El usuario confirma explícitamente que ambos son el mismo gasto.
    const next = matchManualToBank(tx, "m", "b");
    expect(next).toEqual([confirmed]);
    expect(next[0]).toBe(confirmed);
    expect(next.reduce((sum, t) => sum + t.amount, 0)).toBe(-7300);
    expect(findDuplicateIds(next).size).toBe(0);
    expect(computeReconcileStats(next, "2026-08").pendingMismatch).toEqual([]);
    expect(makeSubscriptionCharges([{ id: "s", name: "Servicio", amount: 7300,
      category: "suscripciones", dayOfMonth: 8, active: true }], next,
      new Date(2026, 7, 10), "2026-08-10T12:00:00Z")).toEqual([]);
    expect(matchManualToBank(next, "m", "b")).toBe(next);
    expect(tx).toHaveLength(2);
  });

  it("no quita un manual contra un confirmado de distinto monto o signo", () => {
    const tx = [manual({ id: "m", amount: -7300 }),
      bank({ id: "b", amount: -8500, matchedId: "previo" }),
      bank({ id: "ingreso", amount: 7300, matchedId: "otro" })];
    expect(matchManualToBank(tx, "m", "b")).toBe(tx);
    expect(matchManualToBank(tx, "m", "ingreso")).toBe(tx);
  });

  it("no permite vincular dos bancos ni dos manuales", () => {
    const tx = [manual({ id: "m1" }), manual({ id: "m2" }), bank({ id: "b1" }), bank({ id: "b2" })];
    expect(matchManualToBank(tx, "m1", "m2")).toBe(tx);
    expect(matchManualToBank(tx, "b1", "b2")).toBe(tx);
    expect(matchManualToBank(tx, "b1", "m1")).toBe(tx);
  });

  it("conserva el vínculo de la primera conciliación y recupera la suscripción si faltaba", () => {
    const tx = [manual({ id: "m", amount: -7300, subscriptionId: "s" }),
      bank({ id: "b", amount: -7300, matchedId: "previo", category: "servicios" })];
    expect(matchManualToBank(tx, "m", "b")).toEqual([
      { ...tx[1], subscriptionId: "s" },
    ]);
  });

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
