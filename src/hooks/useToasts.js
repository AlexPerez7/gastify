import { useCallback, useRef, useState } from "react";

let seq = 0;
const EXIT_MS = 200;
const LIFESPAN = { ok: 4000, warn: 5500, error: 6500 };

export function useToasts() {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const clearTimer = (id) => {
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  };

  const dismiss = useCallback((id) => {
    clearTimer(id);
    setToasts((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), EXIT_MS);
  }, []);

  const scheduleAutoDismiss = useCallback((id, type) => {
    clearTimer(id);
    if (type === "loading") return;
    timers.current[id] = setTimeout(() => dismiss(id), LIFESPAN[type] ?? LIFESPAN.ok);
  }, [dismiss]);

  const push = useCallback((type, text, progress = null) => {
    const id = ++seq;
    setToasts((list) => [...list, { id, type, text, progress }]);
    scheduleAutoDismiss(id, type);
    return id;
  }, [scheduleAutoDismiss]);

  const update = useCallback((id, type, text, progress = null) => {
    setToasts((list) => list.map((t) => (t.id === id ? { ...t, type, text, progress, leaving: false } : t)));
    scheduleAutoDismiss(id, type);
  }, [scheduleAutoDismiss]);

  return { toasts, push, update, dismiss };
}
