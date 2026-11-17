import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), upsert: vi.fn(), remove: vi.fn() }));
vi.mock("./supabaseClient.js", () => ({ supabase: { rpc: mocks.rpc, from: mocks.from } }));

let storage;
const tx = (id, patch = {}) => ({ id, key: id, date: "2026-08-01", description: "Prueba",
  amount: -1000, category: "otros", source: "manual", createdAt: "2026-08-01T10:00:00Z", ...patch });
beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.rpc.mockResolvedValue({ error: null });
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.remove.mockResolvedValue({ error: null });
  mocks.from.mockReturnValue({ upsert: mocks.upsert, delete: () => ({ in: mocks.remove }) });
  ({ storage } = await import("./storage.js"));
});

describe("persistencia atómica compatible", () => {
  it("distingue un borrado transaccional no instalado de un fallo real", async () => {
    mocks.rpc.mockResolvedValueOnce({ error: { code: "PGRST202", message: "Could not find gastify_delete_category" } });
    expect(await storage.deleteCategory("cat")).toEqual({ unsupported: true });
    mocks.rpc.mockResolvedValueOnce({ error: { code: "42501", message: "sin permiso" } });
    expect(await storage.deleteCategory("cat")).toEqual({ error: "sin permiso" });
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("manda altas, cambios, borrados y sus versiones previas en una sola operación", async () => {
    const prev = [tx("a"), tx("b"), tx("sin-cambio")];
    const next = [{ ...prev[0], alias: "Nuevo" }, tx("c"), prev[2]];
    expect((await storage.set("transactions", JSON.stringify(next), prev)).error).toBeUndefined();
    const [name, args] = mocks.rpc.mock.calls[0];
    expect(name).toBe("gastify_write_table");
    expect(args.p_upserts.map((r) => r.id)).toEqual(["a", "c"]);
    expect(args.p_expected.map((r) => r.id)).toEqual(["a", "b"]);
    expect(args.p_deletes).toEqual(["b"]);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("un conflicto o fallo de red no se reintenta por el camino sin protección", async () => {
    for (const code of ["40001", "42501", "PGRST504"]) {
      mocks.rpc.mockResolvedValueOnce({ error: { code, message: "No se guardó" } });
      const result = await storage.set("transactions", JSON.stringify([tx("a")]), []);
      expect(result.error).toContain("No se guardó");
      expect(result.conflict).toBe(code === "40001");
    }
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("usa compatibilidad únicamente cuando falta la función y recuerda esa condición", async () => {
    mocks.rpc.mockResolvedValueOnce({ error: { code: "PGRST202", message: "Could not find public.gastify_write_table" } });
    await storage.set("transactions", JSON.stringify([tx("a")]), [tx("b")]);
    expect(mocks.upsert).toHaveBeenCalledOnce();
    expect(mocks.remove).toHaveBeenCalledWith("id", ["b"]);
    await storage.set("transactions", JSON.stringify([tx("c")]), []);
    expect(mocks.rpc).toHaveBeenCalledOnce();
    expect(mocks.upsert).toHaveBeenCalledTimes(2);
  });

  it("no escribe si no hay cambios y rechaza claves duplicadas antes de enviar", async () => {
    const prev = [tx("a")];
    await storage.set("transactions", JSON.stringify(prev), prev);
    expect((await storage.set("transactions", JSON.stringify([tx("a"), tx("b", { key: "a" })]), [])).duplicate).toBe(true);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
