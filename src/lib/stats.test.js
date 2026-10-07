import { describe, it, expect } from "vitest";
import {
  listMonths, filterTransactions, computeMonthStats, sumByCategory, computeHeroStat, computeDailySpend,
  computeTotalSavings, computeDynamicBalance, computeReconcileStats, computeMonthHealth,
  heatmapThresholds, heatLevel, computeMonthProjection, computeSavingsRate, computeDayTotals,
} from "./stats.js";

const tx = (o) => ({ source: "bank", matchedId: null, alias: "", category: "otros", description: "", ...o });
const getCat = (id) => ({ label: id.toUpperCase(), color: "#000", icon: null });

describe("listMonths", () => {
  it("meses únicos, más reciente primero", () => {
    expect(listMonths([tx({ date: "2026-07-01" }), tx({ date: "2026-08-01" }), tx({ date: "2026-07-09" })])).toEqual(["2026-08", "2026-07"]);
  });
});

describe("filterTransactions", () => {
  const list = [
    tx({ id: "a", date: "2026-08-01", amount: -10, description: "Uber", createdAt: "2026-08-01T10:00:00Z" }),
    tx({ id: "b", date: "2026-08-01", amount: 50, description: "Sueldo", source: "manual", createdAt: "2026-08-01T12:00:00Z" }),
    tx({ id: "c", date: "2026-08-03", amount: -5, description: "Café", alias: "cafecito" }),
  ];
  const base = { catFilter: "all", txTypeFilter: "all", sourceFilter: "all", search: "" };

  it("ordena por fecha desc y, en el mismo día, por createdAt desc", () => {
    expect(filterTransactions(list, base).map((t) => t.id)).toEqual(["c", "b", "a"]);
  });
  it("filtra por tipo, origen y búsqueda (también en alias)", () => {
    expect(filterTransactions(list, { ...base, txTypeFilter: "income" }).map((t) => t.id)).toEqual(["b"]);
    expect(filterTransactions(list, { ...base, sourceFilter: "bank" }).map((t) => t.id)).toEqual(["c", "a"]);
    expect(filterTransactions(list, { ...base, search: "CAFECI" }).map((t) => t.id)).toEqual(["c"]);
  });
  it("rango de monto por valor absoluto, extremos incluidos", () => {
    expect(filterTransactions(list, { ...base, amountRange: { min: 10, max: null } }).map((t) => t.id)).toEqual(["b", "a"]);
    expect(filterTransactions(list, { ...base, amountRange: { min: 5, max: 10 } }).map((t) => t.id)).toEqual(["c", "a"]);
    expect(filterTransactions(list, { ...base, amountRange: { min: null, max: 4 } })).toEqual([]);
  });
});

describe("gasto real", () => {
  const excluded = new Set(["transferencias"]);
  const list = [
    tx({ date: "2026-08-01", amount: -100, category: "comida" }),
    tx({ date: "2026-08-02", amount: -1000, category: "transferencias" }),
    tx({ date: "2026-08-02", amount: 500, category: "ingreso" }),
  ];

  it("computeMonthStats excluye categorías que no cuentan como gasto", () => {
    expect(computeMonthStats(list, excluded)).toEqual({ income: 500, expense: -100, balance: 400 });
  });
  it("computeDailySpend solo suma gasto real", () => {
    expect(computeDailySpend(list, excluded)).toEqual({ "2026-08-01": 100 });
  });
  it("sumByCategory suma valores absolutos y ordena", () => {
    const res = sumByCategory([tx({ amount: -5, category: "a" }), tx({ amount: -20, category: "b" }), tx({ amount: -5, category: "a" })], getCat);
    expect(res.map((r) => [r.id, r.value, r.name])).toEqual([["b", 20, "B"], ["a", 10, "A"]]);
  });
});

describe("computeHeroStat", () => {
  it("compara contra el mismo tramo de días del mes anterior", () => {
    const daily = { "2026-08-03": 100, "2026-07-02": 40, "2026-07-25": 999 };
    const list = [tx({ date: "2026-07-02", amount: -40 })];
    const res = computeHeroStat(daily, list, "2026-08", new Date(2026, 7, 5));
    expect(res).toMatchObject({ spentSoFar: 100, typicalPace: 40, dayOfMonth: 5, isRealCurrentMonth: true });
  });
  it("mes cerrado usa el mes completo; sin datos previos typicalPace es null", () => {
    const res = computeHeroStat({ "2026-02-27": 10 }, [], "2026-02", new Date(2026, 7, 5));
    expect(res).toMatchObject({ spentSoFar: 10, typicalPace: null, dayOfMonth: 28, isRealCurrentMonth: false });
  });
});

describe("computeDayTotals", () => {
  it("gasto real e ingresos por día; las categorías excluidas no suman gasto", () => {
    const list = [
      tx({ date: "2026-08-01", amount: -100, category: "comida" }),
      tx({ date: "2026-08-01", amount: -50, category: "comida" }),
      tx({ date: "2026-08-01", amount: -1000, category: "transferencias" }),
      tx({ date: "2026-08-01", amount: 500, category: "ingreso" }),
      tx({ date: "2026-08-02", amount: -7, category: "comida" }),
    ];
    expect(computeDayTotals(list, new Set(["transferencias"]))).toEqual({
      "2026-08-01": { expense: 150, income: 500 },
      "2026-08-02": { expense: 7, income: 0 },
    });
  });
});

describe("computeMonthProjection", () => {
  it("gastado hasta hoy + lo que el mes anterior gastó después de este día", () => {
    // julio: 40 hasta el día 5, 300 después (arriendo el 28)
    const daily = { "2026-08-01": 500, "2026-07-02": 40, "2026-07-28": 300 };
    const list = [tx({ date: "2026-07-02", amount: -40 })];
    const hero = computeHeroStat(daily, list, "2026-08", new Date(2026, 7, 5));
    expect(computeMonthProjection(hero, daily)).toEqual({
      estimated: 800, prevMonthTotal: 340, elapsedPct: 16, dayOfMonth: 5, daysInMonth: 31,
    });
  });
  it("null en un mes cerrado o sin datos del mes anterior", () => {
    const daily = { "2026-08-01": 500 };
    expect(computeMonthProjection(computeHeroStat(daily, [], "2026-08", new Date(2026, 7, 5)), daily)).toBeNull();
    const list = [tx({ date: "2026-06-02", amount: -40 })];
    expect(computeMonthProjection(computeHeroStat(daily, list, "2026-07", new Date(2026, 7, 5)), daily)).toBeNull();
  });
});

describe("computeSavingsRate", () => {
  it("fracción del ingreso que no se gastó; null sin ingresos", () => {
    expect(computeSavingsRate({ income: 1000, balance: 250 })).toBe(0.25);
    expect(computeSavingsRate({ income: 1000, balance: -500 })).toBe(-0.5);
    expect(computeSavingsRate({ income: 0, balance: -100 })).toBeNull();
  });
});

describe("saldo y ahorro", () => {
  const settings = { baseBalance: 1000, lastSyncDate: "2026-08-01T12:00:00Z", savingsBase: null, savingsBaseDate: null };

  it("computeDynamicBalance suma solo manuales cargados después del sync", () => {
    const list = [
      tx({ source: "manual", amount: -100, createdAt: "2026-08-02T00:00:00Z" }),
      tx({ source: "manual", amount: -999, createdAt: "2026-07-30T00:00:00Z" }),
      tx({ source: "bank", amount: -999, createdAt: "2026-08-03T00:00:00Z" }),
    ];
    expect(computeDynamicBalance(list, settings)).toBe(900);
    expect(computeDynamicBalance(list, null)).toBeNull();
  });

  it("computeDynamicBalance: fila solo con ahorro base (saldo sin ajustar) da null, no NaN", () => {
    const list = [tx({ source: "manual", amount: -100, createdAt: "2026-08-02T00:00:00Z" })];
    const savingsOnly = { baseBalance: null, lastSyncDate: null, savingsBase: 5000, savingsBaseDate: "2026-08-01T00:00:00Z" };
    expect(computeDynamicBalance(list, savingsOnly)).toBeNull();
    // así queda el estado en memoria tras guardar el ahorro sin fila previa
    expect(computeDynamicBalance(list, { savingsBase: 5000, savingsBaseDate: "2026-08-01T00:00:00Z" })).toBeNull();
  });

  it("computeTotalSavings: null sin categorías de ahorro, histórico sin ancla, ancla + posterior con ancla", () => {
    const cats = [{ id: "ahorro", isSavings: true }];
    const list = [
      tx({ category: "ahorro", amount: -300, createdAt: "2026-07-01T00:00:00Z" }),
      tx({ category: "ahorro", amount: -200, createdAt: "2026-08-05T00:00:00Z" }),
    ];
    expect(computeTotalSavings(list, [], settings)).toBeNull();
    expect(computeTotalSavings(list, cats, settings)).toBe(500);
    expect(computeTotalSavings(list, cats, { ...settings, savingsBase: 10000, savingsBaseDate: "2026-08-01T00:00:00Z" })).toBe(10200);
  });
});

describe("conciliación", () => {
  const list = [
    tx({ id: "m1", source: "manual", date: "2026-08-02", amount: -10 }),
    tx({ id: "b1", date: "2026-08-03", amount: -20, matchedId: "x" }),
    tx({ id: "b2", date: "2026-08-04", amount: -30 }),
    tx({ id: "b3", date: "2026-09-01", amount: -40 }),
  ];

  it("computeReconcileStats separa confirmados, pendientes y candidatos del mes siguiente", () => {
    const r = computeReconcileStats(list, "2026-08");
    expect(r.confirmed.map((t) => t.id)).toEqual(["b1"]);
    expect(r.pendingMismatch.map((t) => t.id)).toEqual(["m1"]);
    expect(r.pendingNoReport).toEqual([]);
    expect(r.linkCandidates.map((t) => t.id)).toEqual(["b2", "b3"]);
    expect(computeReconcileStats(list, undefined)).toBeNull();
  });

  it("computeMonthHealth: warn con manuales pendientes, ok si todo calzó, nada sin manuales", () => {
    expect(computeMonthHealth(list, ["2026-08", "2026-09"])).toEqual({ "2026-08": "warn" });
    expect(computeMonthHealth(list.filter((t) => t.id !== "m1"), ["2026-08"])).toEqual({ "2026-08": "ok" });
  });
});

describe("mapa de actividad", () => {
  it("umbrales por cuartiles: un pago grande no aplana el resto", () => {
    const values = [1000, 2000, 3000, 4000, 5000, 6000, 7000, 500000];
    const th = heatmapThresholds(values);
    expect(th).toEqual([3000, 5000, 7000]);
    expect(heatLevel(1500, th)).toBe(1);
    expect(heatLevel(4000, th)).toBe(2);
    expect(heatLevel(6000, th)).toBe(3);
    expect(heatLevel(500000, th)).toBe(4);
  });
  it("sin gasto es nivel 0; sin datos no hay umbrales", () => {
    expect(heatLevel(0, [1, 2, 3])).toBe(0);
    expect(heatmapThresholds([])).toEqual([]);
    expect(heatLevel(100, [])).toBe(1);
  });
});
