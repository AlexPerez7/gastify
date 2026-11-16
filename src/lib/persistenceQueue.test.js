import { describe, expect, it, vi } from "vitest";
import { createPersistenceQueue } from "./persistenceQueue.js";

const tx = (id, extra = {}) => ({ id, amount: -1000, category: "otros", ...extra });

function setup(initial = []) {
  const visible = {};
  const calls = [];
  const write = vi.fn((key, value, prev) => new Promise((resolve, reject) => {
    calls.push({ key, next: JSON.parse(value), prev, resolve, reject });
  }));
  const queue = createPersistenceQueue({ write, onChange: (key, rows) => { visible[key] = rows; } });
  queue.acceptLoad("transactions", initial, queue.version("transactions"));
  return { queue, visible, calls, write };
}

describe("persistencia concurrente", () => {
  it("serializa altas desde la misma foto sin borrar la primera", async () => {
    const { queue, visible, calls, write } = setup();
    const a = queue.persist("transactions", [], [tx("a")]);
    const b = queue.persist("transactions", [], [tx("b")]);
    expect(visible.transactions).toEqual([tx("a"), tx("b")]);
    expect(write).toHaveBeenCalledTimes(1);
    calls[0].resolve({ key: "transactions" });
    await a;
    expect(calls[1].prev).toEqual([tx("a")]);
    expect(calls[1].next).toEqual([tx("a"), tx("b")]);
    calls[1].resolve({ key: "transactions" });
    await b;
    expect(visible.transactions).toEqual(calls[1].next);
  });

  it("el fallo de una alta no descarta ni reenvía esa alta al guardar otra", async () => {
    const { queue, visible, calls } = setup();
    const first = [tx("a")];
    const a = queue.persist("transactions", [], first);
    const b = queue.persist("transactions", first, [...first, tx("b")]);
    calls[0].resolve({ error: "sin conexión" });
    expect(await a).toEqual({ error: "sin conexión" });
    expect(visible.transactions).toEqual([tx("b")]);
    expect(calls[1].prev).toEqual([]);
    expect(calls[1].next).toEqual([tx("b")]);
    calls[1].resolve({ key: "transactions" });
    await b;
  });

  it("revierte solo el campo fallido y conserva otra edición de la misma fila", async () => {
    const initial = [tx("a")];
    const first = [tx("a", { category: "comida" })];
    const { queue, visible, calls } = setup(initial);
    const a = queue.persist("transactions", initial, first);
    const b = queue.persist("transactions", first, [{ ...first[0], alias: "Almuerzo" }]);
    calls[0].resolve({ error: "rechazado" });
    await a;
    const expected = [tx("a", { alias: "Almuerzo" })];
    expect(visible.transactions).toEqual(expected);
    expect(calls[1].next).toEqual(expected);
    calls[1].resolve({ key: "transactions" });
    await b;
  });

  it("conserva la última edición del mismo campo si falla la anterior", async () => {
    const initial = [tx("a")];
    const first = [tx("a", { amount: -2000 })];
    const final = [tx("a", { amount: -3000 })];
    const { queue, visible, calls } = setup(initial);
    const a = queue.persist("transactions", initial, first);
    const b = queue.persist("transactions", first, final);
    calls[0].resolve(null);
    await a;
    expect(calls[1].next).toEqual(final);
    calls[1].resolve({ key: "transactions" });
    await b;
    expect(visible.transactions).toEqual(final);
  });

  it("el fallo del segundo guardado conserva el primero confirmado", async () => {
    const { queue, visible, calls } = setup();
    const a = queue.persist("transactions", [], [tx("a")]);
    const b = queue.persist("transactions", [], [tx("b")]);
    calls[0].resolve({ key: "transactions" });
    await a;
    calls[1].resolve({ error: "rechazado" });
    await b;
    expect(visible.transactions).toEqual([tx("a")]);
  });

  it("restaura un borrado fallido sin perder una edición de otra fila", async () => {
    const initial = [tx("a"), tx("b")];
    const { queue, visible, calls } = setup(initial);
    const a = queue.persist("transactions", initial, [tx("b")]);
    const b = queue.persist("transactions", [tx("b")], [tx("b", { amount: -2000 })]);
    calls[0].resolve({ error: "rechazado" });
    await a;
    const expected = [tx("a"), tx("b", { amount: -2000 })];
    expect(calls[1].next).toEqual(expected);
    calls[1].resolve({ key: "transactions" });
    await b;
    expect(visible.transactions).toEqual(expected);
  });

  it("captura excepciones y sigue procesando la cola", async () => {
    const { queue, visible, calls } = setup();
    const a = queue.persist("transactions", [], [tx("a")]);
    const b = queue.persist("transactions", [], [tx("b")]);
    calls[0].reject(new Error("timeout"));
    expect(await a).toMatchObject({ error: "timeout" });
    calls[1].resolve({ key: "transactions" });
    await b;
    expect(visible.transactions).toEqual([tx("b")]);
  });

  it("rechaza editar una alta fallida y no la resucita", async () => {
    const { queue, visible, calls, write } = setup();
    const first = [tx("a")];
    const a = queue.persist("transactions", [], first);
    const b = queue.persist("transactions", first, [tx("a", { amount: -2000 })]);
    calls[0].resolve({ error: "rechazado" });
    await a;
    expect(await b).toMatchObject({ error: expect.stringContaining("no se guardó o ya fue eliminado") });
    expect(write).toHaveBeenCalledTimes(1);
    expect(visible.transactions).toEqual([]);
  });

  it("un borrado confirmado no reaparece por una foto vieja al agregar otra fila", async () => {
    const initial = [tx("a")];
    const { queue, visible, calls } = setup(initial);
    const a = queue.persist("transactions", initial, []);
    const b = queue.persist("transactions", initial, [...initial, tx("b")]);
    calls[0].resolve({ key: "transactions" });
    await a;
    expect(calls[1].next).toEqual([tx("b")]);
    calls[1].resolve({ key: "transactions" });
    await b;
    expect(visible.transactions).toEqual([tx("b")]);
  });

  it("permite guardar tablas independientes en paralelo", async () => {
    const { queue, calls, write } = setup();
    const a = queue.persist("transactions", [], [tx("a")]);
    const b = queue.persist("categories", [], [{ id: "comida", label: "Comida" }]);
    expect(write).toHaveBeenCalledTimes(2);
    calls[1].resolve({ key: "categories" });
    await b;
    calls[0].resolve({ key: "transactions" });
    await a;
  });

  it("rechaza lecturas antiguas durante y después de un guardado", async () => {
    const { queue, visible, calls } = setup();
    const version = queue.version("transactions");
    const a = queue.persist("transactions", [], [tx("a")]);
    const duringSave = queue.version("transactions");
    expect(queue.acceptLoad("transactions", [], version)).toBe(false);
    expect(queue.acceptLoad("transactions", [], queue.version("transactions"))).toBe(false);
    calls[0].resolve({ key: "transactions" });
    await a;
    expect(queue.acceptLoad("transactions", [], version)).toBe(false);
    expect(queue.acceptLoad("transactions", [], duringSave)).toBe(false);
    expect(visible.transactions).toEqual([tx("a")]);
    expect(queue.acceptLoad("transactions", [tx("b")], queue.version("transactions"))).toBe(true);
    expect(visible.transactions).toEqual([tx("b")]);
  });

  it("una lectura aceptada invalida otras respuestas de la misma generación", () => {
    const { queue, visible } = setup();
    const version = queue.version("transactions");
    expect(queue.acceptLoad("transactions", [tx("a")], version)).toBe(true);
    expect(queue.acceptLoad("transactions", [], version)).toBe(false);
    expect(visible.transactions).toEqual([tx("a")]);
  });
});
