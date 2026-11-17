import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { storage } from "./storage.js";
import { getAccountSettings } from "./accountSettings.js";
import { exportBackup } from "./exportBackup.js";

vi.mock("./storage.js", () => ({ storage: { get: vi.fn() } }));
vi.mock("./accountSettings.js", () => ({ getAccountSettings: vi.fn() }));

describe("respaldo completo", () => {
  let blob;
  let click;
  const keys = ["transactions", "categories", "merchantRules", "subscriptions", "creditTransactions", "creditStatements"];
  beforeEach(() => {
    vi.clearAllMocks();
    blob = null;
    click = vi.fn();
    vi.stubGlobal("document", { createElement: () => ({ click }) });
    vi.spyOn(URL, "createObjectURL").mockImplementation((value) => { blob = value; return "blob:test"; });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    storage.get.mockImplementation(async (key) => ({ key, value: JSON.stringify([{ id: key }]) }));
    getAccountSettings.mockResolvedValue({ baseBalance: 10000, savingsBase: 20000 });
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it("descarga débito, crédito, categorías, reglas, suscripciones y anclas de saldo", async () => {
    await exportBackup();
    const payload = JSON.parse(await blob.text());
    expect(payload.schemaVersion).toBe(2);
    keys.forEach((key) => expect(payload[key]).toEqual([{ id: key }]));
    expect(payload.accountSettings).toEqual({ baseBalance: 10000, savingsBase: 20000 });
    expect(getAccountSettings).toHaveBeenCalledWith({ throwOnError: true });
    expect(click).toHaveBeenCalledOnce();
  });

  it("acepta que aún no existan ajustes de cuenta", async () => {
    getAccountSettings.mockResolvedValue(null);
    await exportBackup();
    expect(JSON.parse(await blob.text()).accountSettings).toBeNull();
  });

  it("no descarga un respaldo parcial si falla cualquiera de las tablas", async () => {
    for (const failed of keys) {
      storage.get.mockImplementation(async (key) => key === failed ? null : { key, value: "[]" });
      await expect(exportBackup()).rejects.toThrow();
    }
    expect(click).not.toHaveBeenCalled();
    expect(blob).toBeNull();
  });

  it("no presenta un error leyendo saldos como si la cuenta no tuviera ajustes", async () => {
    getAccountSettings.mockRejectedValue(new Error("sin conexión"));
    await expect(exportBackup()).rejects.toThrow("sin conexión");
    expect(click).not.toHaveBeenCalled();
  });
});
