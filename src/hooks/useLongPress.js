import { useRef } from "react";

const LONG_PRESS_MS = 450;
const MOVE_TOLERANCE = 8;

// Toque largo: 450ms sin moverse más de 8px (si el dedo se mueve es scroll o
// swipe, y se cancela). El click que el navegador dispara al soltar después
// de un toque largo no debe contar además como "tocar": quien usa el hook
// llama a consumeClick() al principio de su onClick y sale si devuelve true.
export function useLongPress(onLongPress) {
  const timer = useRef(null);
  const start = useRef(null);
  const fired = useRef(false);

  const clear = () => { clearTimeout(timer.current); timer.current = null; };

  return {
    handlers: {
      onPointerDown: (e) => {
        fired.current = false;
        start.current = { x: e.clientX, y: e.clientY };
        clear();
        timer.current = setTimeout(() => {
          fired.current = true;
          navigator.vibrate?.(10);
          onLongPress();
        }, LONG_PRESS_MS);
      },
      onPointerMove: (e) => {
        if (!start.current || !timer.current) return;
        if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > MOVE_TOLERANCE) clear();
      },
      onPointerUp: clear,
      onPointerCancel: clear,
      // sin menú contextual del sistema (Android) al mantener presionado
      onContextMenu: (e) => e.preventDefault(),
    },
    consumeClick: () => {
      if (fired.current) { fired.current = false; return true; }
      return false;
    },
  };
}
