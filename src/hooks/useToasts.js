import { useCallback, useRef, useState } from "react";

let seq = 0;
// = duración de la salida de .toast / .toast-slot en index.css
const EXIT_MS = 150;
// los errores no se cierran solos: suelen traer el detalle real de Supabase
// y en 6 segundos no alcanza a leerse (ni a copiarse) en un teléfono
const LIFESPAN = { ok: 4000, warn: 5500, error: Infinity };

// Avisos flotantes.
// push(type, text, progress?, { action?, duration? }) → id
// - action: { label, onClick } — botón dentro del aviso (ej. "Deshacer");
//   al tocarlo el aviso se cierra y corre onClick.
// - duration: ms antes de cerrarse solo (por defecto según el tipo).
// pause/resume: el temporizador se congela mientras el dedo o el mouse está
// sobre el aviso, para no perder el "Deshacer" justo al ir a tocarlo.
export function useToasts() {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});
  // el setTimeout que saca de la lista a un toast que se está yendo — se
  // cancela si update() lo revive antes (si no, desaparecía igual)
  const removals = useRef({});

  const clearTimer = (id) => {
    clearTimeout(timers.current[id]?.handle);
  };

  const dismiss = useCallback((id) => {
    clearTimer(id);
    delete timers.current[id];
    setToasts((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    clearTimeout(removals.current[id]);
    removals.current[id] = setTimeout(() => {
      delete removals.current[id];
      setToasts((list) => list.filter((t) => t.id !== id));
    }, EXIT_MS);
  }, []);

  const startTimer = useCallback((id, ms) => {
    clearTimer(id);
    if (!Number.isFinite(ms)) { delete timers.current[id]; return; }
    timers.current[id] = { handle: setTimeout(() => dismiss(id), ms), start: Date.now(), remaining: ms };
  }, [dismiss]);

  const scheduleAutoDismiss = useCallback((id, type, duration) => {
    if (type === "loading") { clearTimer(id); delete timers.current[id]; return; }
    startTimer(id, duration ?? LIFESPAN[type] ?? LIFESPAN.ok);
  }, [startTimer]);

  const push = useCallback((type, text, progress = null, { action = null, duration } = {}) => {
    const id = ++seq;
    setToasts((list) => [...list, { id, type, text, progress, action }]);
    scheduleAutoDismiss(id, type, duration);
    return id;
  }, [scheduleAutoDismiss]);

  const update = useCallback((id, type, text, progress = null) => {
    clearTimeout(removals.current[id]);
    delete removals.current[id];
    setToasts((list) => list.map((t) => (t.id === id ? { ...t, type, text, progress, leaving: false } : t)));
    scheduleAutoDismiss(id, type);
  }, [scheduleAutoDismiss]);

  const pause = useCallback((id) => {
    const t = timers.current[id];
    if (!t) return;
    clearTimeout(t.handle);
    t.remaining -= Date.now() - t.start;
  }, []);

  const resume = useCallback((id) => {
    const t = timers.current[id];
    if (!t) return;
    // un mínimo de 1.5s para que no desaparezca apenas se suelta
    startTimer(id, Math.max(t.remaining, 1500));
  }, [startTimer]);

  return { toasts, push, update, dismiss, pause, resume };
}
