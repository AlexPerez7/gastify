import { afterEach, describe, expect, it, vi } from "vitest";
import { createPwaUpdates } from "./pwaUpdates.js";

function setup({ online = true, supported = true, controller = true } = {}) {
  let callbacks;
  const registration = { waiting: null, installing: null, update: vi.fn().mockResolvedValue(undefined) };
  const activate = vi.fn().mockResolvedValue(undefined);
  const reload = vi.fn();
  const register = vi.fn((options) => {
    callbacks = options;
    options.onRegisteredSW("/sw.js", registration);
    return activate;
  });
  const updates = createPwaUpdates({ register, supported, isOnline: () => online,
    hasController: () => controller, reload });
  return { updates, registration, activate, reload, register, callbacks: () => callbacks };
}

afterEach(() => vi.useRealTimers());

describe("actualizaciones PWA", () => {
  it("registra una sola vez y confirma que no hay una nueva versión", async () => {
    const { updates, register, registration } = setup();
    updates.start();
    updates.start();
    await updates.check();
    expect(register).toHaveBeenCalledTimes(1);
    expect(registration.update).toHaveBeenCalledTimes(1);
    expect(updates.getSnapshot()).toMatchObject({ dialogOpen: true, checking: false,
      available: false, message: "Ya tienes la última versión de Gastify." });
  });

  it("avisa en segundo plano y espera confirmación antes de activar", async () => {
    vi.useFakeTimers();
    const { updates, callbacks, activate, reload } = setup();
    updates.start();
    callbacks().onNeedRefresh();
    expect(updates.getSnapshot()).toMatchObject({ available: true, dialogOpen: true });
    expect(activate).not.toHaveBeenCalled();
    expect(await updates.install(true)).toBe(false);
    expect(activate).not.toHaveBeenCalled();
    expect(await updates.install()).toBe(true);
    expect(activate).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
    callbacks().onNeedReload();
    updates.controllerChanged();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("recarga al confirmar el controller nativo si Workbox no avisa", async () => {
    vi.useFakeTimers();
    const { updates, callbacks, reload } = setup();
    updates.start();
    updates.controllerChanged();
    expect(reload).not.toHaveBeenCalled();
    callbacks().onNeedRefresh();
    await updates.install();
    updates.controllerChanged();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("Más tarde conserva la actualización y el botón permite reabrirla", async () => {
    const { updates, callbacks, activate, registration } = setup();
    updates.start();
    callbacks().onNeedRefresh();
    updates.dismiss();
    expect(updates.getSnapshot()).toMatchObject({ available: true, dialogOpen: false });
    await updates.check();
    expect(updates.getSnapshot().dialogOpen).toBe(true);
    expect(activate).not.toHaveBeenCalled();
    expect(registration.update).not.toHaveBeenCalled();
  });

  it("no abre popup si la búsqueda automática no encuentra cambios", async () => {
    const { updates } = setup();
    await updates.check({ silent: true });
    expect(updates.getSnapshot()).toMatchObject({ dialogOpen: false, checking: false, message: "" });
  });

  it("explica cuando no hay conexión y no realiza requests", async () => {
    const { updates, register } = setup({ online: false });
    await updates.check();
    expect(updates.getSnapshot()).toMatchObject({ dialogOpen: true, checking: false,
      error: expect.stringContaining("conexión a internet") });
    expect(register).not.toHaveBeenCalled();
  });

  it("maneja un navegador sin service workers", async () => {
    const { updates, register } = setup({ supported: false });
    await updates.check();
    expect(updates.getSnapshot().error).toContain("este navegador");
    expect(register).not.toHaveBeenCalled();
  });

  it("permite reintentar después de un error de red", async () => {
    const { updates, registration } = setup();
    registration.update.mockRejectedValueOnce(new Error("offline"));
    await updates.check();
    expect(updates.getSnapshot()).toMatchObject({ checking: false, error: expect.any(String) });
    await updates.check();
    expect(updates.getSnapshot()).toMatchObject({ error: "", message: expect.stringContaining("última versión") });
  });

  it("espera la descarga antes de anunciar que la actualización está lista", async () => {
    const { updates, registration } = setup();
    const worker = new EventTarget();
    worker.state = "installing";
    registration.installing = worker;
    const pending = updates.check();
    await vi.waitFor(() => expect(registration.update).toHaveBeenCalled());
    expect(updates.getSnapshot()).toMatchObject({ checking: true, message: "" });
    registration.waiting = worker;
    worker.state = "installed";
    worker.dispatchEvent(new Event("statechange"));
    await pending;
    expect(updates.getSnapshot()).toMatchObject({ checking: false, available: true, dialogOpen: true });
  });

  it("la primera instalación no se anuncia como actualización", async () => {
    const { updates, registration } = setup({ controller: false });
    registration.waiting = {};
    await updates.check();
    expect(updates.getSnapshot().available).toBe(false);
  });

  it("detecta una actualización que ya estaba esperando al abrir la app", () => {
    const { updates, registration } = setup();
    registration.waiting = {};
    updates.start();
    expect(updates.getSnapshot()).toMatchObject({ available: true, dialogOpen: true });
  });

  it("permite reintentar una activación fallida sin recargar", async () => {
    vi.useFakeTimers();
    const { updates, callbacks, activate, reload } = setup();
    updates.start();
    callbacks().onNeedRefresh();
    activate.mockRejectedValueOnce(new Error("falló"));
    expect(await updates.install()).toBe(false);
    expect(updates.getSnapshot()).toMatchObject({ installing: false, error: expect.any(String) });
    expect(reload).not.toHaveBeenCalled();
    await updates.install();
    callbacks().onNeedReload();
  });

  it("desbloquea la acción si el worker no confirma su activación", async () => {
    vi.useFakeTimers();
    const { updates, callbacks } = setup();
    updates.start();
    callbacks().onNeedRefresh();
    await updates.install();
    await vi.advanceTimersByTimeAsync(15000);
    expect(updates.getSnapshot()).toMatchObject({ installing: false, error: expect.stringContaining("activar") });
  });
});
