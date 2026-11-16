// Un solo registro aunque React remonte la app; conserva avisos recibidos
// antes de iniciar sesión. La lógica no depende de React ni de Workbox.
/** @param {{ register: Function, supported: boolean, isOnline: () => boolean,
 * hasController: () => boolean, reload: () => void }} options */
export function createPwaUpdates({ register, supported, isOnline, hasController, reload }) {
  let state = { supported, available: false, checking: false, installing: false,
    dialogOpen: false, message: "", error: "" };
  const listeners = new Set();
  const publish = (patch) => {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  };
  let started = false;
  let registration;
  let activate;
  let activationTimer;
  let reloading = false;
  let resolveRegistration;
  let ready = Promise.resolve(null);
  const available = () => publish({ available: true, dialogOpen: true, message: "", error: "" });
  const finishReload = () => {
    if (reloading) return;
    reloading = true;
    clearTimeout(activationTimer);
    reload();
  };

  function start() {
    if (started || !supported) return;
    started = true;
    ready = new Promise((resolve) => { resolveRegistration = resolve; });
    try {
      activate = register({
        immediate: true,
        onNeedRefresh: available,
        onNeedReload: finishReload,
        onRegisteredSW(_url, value) {
          registration = value;
          resolveRegistration(value);
          if (!value) started = false;
          if (value?.waiting && hasController()) available();
        },
        onRegisterError() { started = false; resolveRegistration(null); },
      });
    } catch { started = false; resolveRegistration(null); }
  }

  async function check({ silent = false } = {}) {
    if (state.checking || state.installing) return;
    if (!silent) publish({ dialogOpen: true, message: "", error: "" });
    if (state.available) return;
    if (!supported || !isOnline()) {
      if (!silent) publish({ error: supported
        ? "Necesitas conexión a internet para buscar actualizaciones."
        : "Las actualizaciones no están disponibles en este navegador." });
      return;
    }
    start();
    publish({ checking: true });
    try {
      let timer;
      try {
        await Promise.race([ready, new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("registro pendiente")), 15000);
        })]);
      } finally { clearTimeout(timer); }
      if (!registration) throw new Error("sin registro");
      await registration.update();
      await waitForInstallation(registration.installing);
      if (registration.waiting && hasController()) available();
      else if (!state.available && !silent) publish({ message: "Ya tienes la última versión de Gastify." });
    } catch {
      if (!silent) publish({ error: "No se pudo buscar la actualización. Revisa tu conexión e inténtalo de nuevo." });
    } finally { publish({ checking: false }); }
  }

  async function install(saving = false) {
    if (saving || !state.available || state.installing) return false;
    publish({ installing: true, error: "" });
    // updateServiceWorker manda SKIP_WAITING; controlling provoca la recarga.
    // Si no llega, se permite reintentar en vez de dejar el popup bloqueado.
    activationTimer = setTimeout(() => {
      publish({ installing: false, error: "No se pudo activar la actualización. Inténtalo de nuevo." });
    }, 15000);
    try { await activate(); return true; }
    catch {
      clearTimeout(activationTimer);
      publish({ installing: false, error: "No se pudo activar la actualización. Inténtalo de nuevo." });
      return false;
    }
  }

  return {
    start, check, install,
    // Workbox puede clasificar updates cercanos al registro como externos.
    // El evento nativo confirma la activación aunque omita onNeedReload.
    controllerChanged() { if (state.installing) finishReload(); },
    getSnapshot: () => state,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    dismiss() { publish({ dialogOpen: false }); },
  };
}

// update() termina antes de descargar el worker: esperar evita afirmar
// "última versión" mientras la actualización todavía se está instalando.
/** @param {ServiceWorker | null} worker */
function waitForInstallation(worker) {
  if (!worker) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const finish = () => {
      if (worker.state === "redundant") done(new Error("instalación fallida"));
      else if (["installed", "activating", "activated"].includes(worker.state)) done();
    };
    const timer = setTimeout(() => done(new Error("instalación pendiente")), 30000);
    const done = (error = null) => {
      clearTimeout(timer);
      worker.removeEventListener("statechange", finish);
      if (error) reject(error);
      else resolve();
    };
    worker.addEventListener("statechange", finish);
    finish();
  });
}
