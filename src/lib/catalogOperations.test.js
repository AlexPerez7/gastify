import { describe, expect, it, vi } from "vitest";
import { removeCategorySafely } from "./catalogOperations.js";

function setup() {
  const rows = {
    categories: [{ id: "otros" }, { id: "cat" }],
    transactions: [{ id: "debito", category: "cat" }],
    creditTransactions: [{ id: "credito", category: "cat" }, { id: "otra", category: "distinta" }],
    subscriptions: [{ id: "sub", category: "cat" }],
    merchantRules: [{ id: "regla", categoryId: "cat" }],
  };
  const persist = vi.fn(async (key, _prev, next) => { rows[key] = next; return true; });
  const removeAtomic = vi.fn(async () => ({ unsupported: true }));
  const options = { id: "cat", read: (key) => rows[key], persist, removeAtomic };
  return { rows, persist, removeAtomic, options };
}

describe("eliminación segura de categorías", () => {
  it("reasigna también crédito, conserva otras filas y elimina al final", async () => {
    const { rows, persist, options } = setup();
    expect((await removeCategorySafely(options)).ok).toBe(true);
    expect(persist.mock.calls.map(([key]) => key)).toEqual([
      "transactions", "creditTransactions", "subscriptions", "merchantRules", "categories",
    ]);
    expect(rows.categories).toEqual([{ id: "otros" }]);
    expect(rows.creditTransactions).toEqual([{ id: "credito", category: "otros" }, { id: "otra", category: "distinta" }]);
    expect(rows.merchantRules[0].categoryId).toBe("otros");
  });

  it("conserva la categoría tras un fallo intermedio y permite completar el reintento", async () => {
    const { rows, persist, options } = setup();
    persist.mockImplementationOnce(async (key, _prev, next) => { rows[key] = next; return true; })
      .mockResolvedValueOnce(false);
    expect((await removeCategorySafely(options)).ok).toBe(false);
    expect(rows.categories.some((c) => c.id === "cat")).toBe(true);
    expect(rows.transactions[0].category).toBe("otros");
    expect(rows.creditTransactions[0].category).toBe("cat");
    expect(persist.mock.calls.some(([key]) => key === "categories")).toBe(false);
    expect((await removeCategorySafely(options)).ok).toBe(true);
    expect(rows.categories).toEqual([{ id: "otros" }]);
    expect(rows.creditTransactions[0].category).toBe("otros");
  });

  it("no usa guardados separados cuando la transacción está disponible o falla", async () => {
    const { options, persist, removeAtomic } = setup();
    removeAtomic.mockResolvedValueOnce({ ok: true });
    expect(await removeCategorySafely(options)).toEqual({ ok: true, atomic: true });
    expect(persist).not.toHaveBeenCalled();
    removeAtomic.mockResolvedValueOnce({ error: "conflicto" });
    expect(await removeCategorySafely(options)).toEqual({ ok: false, error: "conflicto" });
    expect(persist).not.toHaveBeenCalled();
  });

  it("protege Otros y no elimina sin categoría de destino", async () => {
    const { options, rows, persist, removeAtomic } = setup();
    expect((await removeCategorySafely({ ...options, id: "otros" })).ok).toBe(false);
    rows.categories = [{ id: "cat" }];
    expect((await removeCategorySafely(options)).ok).toBe(false);
    expect(persist).not.toHaveBeenCalled();
    expect(removeAtomic).not.toHaveBeenCalled();
  });
});
