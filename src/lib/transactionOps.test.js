import { describe, it, expect } from "vitest";
import {
  makeManualTransaction, makeSubscriptionCharges, upsertMerchantRule, applyCategoryEdit,
  editManualDateAmount, linkTransactionToSubscription,
} from "./transactionOps.js";

const NOW = "2026-08-10T12:00:00.000Z";

describe("makeManualTransaction", () => {
  it("gasto negativo, ingreso positivo", () => {
    const base = { date: "2026-08-01", description: "Pan", amount: 1500, category: "comida" };
    expect(makeManualTransaction({ ...base, type: "expense" }, NOW)).toMatchObject({ amount: -1500, source: "manual", createdAt: NOW });
    expect(makeManualTransaction({ ...base, type: "income" }, NOW).amount).toBe(1500);
  });
});

describe("makeSubscriptionCharges", () => {
  const subs = [
    { id: "s1", name: "Netflix", amount: 9000, category: "suscripciones", dayOfMonth: 5, active: true },
    { id: "s2", name: "Gym", amount: 20000, category: "salud", dayOfMonth: 31, active: true },
    { id: "s3", name: "Vieja", amount: 1, category: "otros", dayOfMonth: 1, active: false },
  ];

  it("solo genera las activas cuyo día ya pasó y que no tienen cargo este mes", () => {
    const res = makeSubscriptionCharges(subs, [], new Date(2026, 7, 10), NOW);
    expect(res.map((t) => t.subscriptionId)).toEqual(["s1"]);
    expect(res[0]).toMatchObject({ date: "2026-08-05", amount: -9000, source: "manual" });
    const again = makeSubscriptionCharges(subs, res, new Date(2026, 7, 10), NOW);
    expect(again).toEqual([]);
  });

  it("día 31 en un mes corto cae el último día", () => {
    const res = makeSubscriptionCharges([subs[1]], [], new Date(2026, 1, 28), NOW);
    expect(res[0].date).toBe("2026-02-28");
  });
});

describe("reglas y edición", () => {
  it("upsertMerchantRule reemplaza sin importar mayúsculas", () => {
    const rules = [{ id: "r1", matchText: "UBER", categoryId: "a", alias: "" }];
    const next = upsertMerchantRule(rules, "uber", "b", "Uber");
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ matchText: "uber", categoryId: "b", alias: "Uber" });
  });

  const list = [
    { id: "1", description: "UBER TRIP", category: "otros", alias: "", source: "bank" },
    { id: "2", description: "Uber trip 2", category: "otros", alias: "x", source: "bank" },
    { id: "3", description: "UBER manual", category: "otros", alias: "", source: "manual" },
  ];

  it("applyCategoryEdit sin regla solo toca el movimiento editado", () => {
    const next = applyCategoryEdit(list, "1", { category: "transporte", alias: "Uber" }, null);
    expect(next.map((t) => t.category)).toEqual(["transporte", "otros", "otros"]);
  });

  it("con regla aplica retroactivo (solo banco en débito) y conserva alias existente", () => {
    const next = applyCategoryEdit(list, "1", { category: "transporte", alias: "" }, "uber", { bankOnly: true });
    expect(next.map((t) => t.category)).toEqual(["transporte", "transporte", "otros"]);
    expect(next[1].alias).toBe("x");
  });
});

describe("editManualDateAmount", () => {
  const list = [{ id: "m", date: "2026-08-01", description: "Pan", amount: -100, key: "k", source: "manual" }];

  it("mantiene el signo y recalcula la clave", () => {
    const [t] = editManualDateAmount(list, "m", { date: "2026-08-02", amount: 150 });
    expect(t).toMatchObject({ date: "2026-08-02", amount: -150 });
    expect(t.key).not.toBe("k");
  });
  it("id inexistente devuelve el mismo array", () => {
    expect(editManualDateAmount(list, "nope", { date: "2026-08-02", amount: 1 })).toBe(list);
  });
});

describe("linkTransactionToSubscription", () => {
  const txs = [{ id: "t", date: "2026-08-19", description: "PARAMOUNT", alias: "Paramount", amount: -6990, category: "suscripciones" }];

  it("crea una suscripción nueva con el día del movimiento", () => {
    const res = linkTransactionToSubscription(txs, [], "t");
    expect(res.newSubscription).toMatchObject({ name: "Paramount", amount: 6990, dayOfMonth: 19, active: true });
    expect(res.transactions[0].subscriptionId).toBe(res.newSubscription.id);
  });
  it("reutiliza una activa equivalente", () => {
    const subs = [{ id: "sub_1", name: "Paramount", amount: 6990, category: "suscripciones", dayOfMonth: 19, active: true }];
    const res = linkTransactionToSubscription(txs, subs, "t");
    expect(res.newSubscription).toBeNull();
    expect(res.transactions[0].subscriptionId).toBe("sub_1");
  });
});
