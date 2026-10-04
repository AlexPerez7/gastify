import { useEffect, useState } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Diálogos abiertos, el último arriba: solo ese atrapa el Tab (si un diálogo
// abriera otro, el de abajo no debe pelearle el foco).
const stack = [];

// Mantiene el Tab dentro de `ref` mientras está montado, y al cerrarse
// devuelve el foco a donde estaba (el botón que abrió el diálogo), para que
// con teclado no se vuelva al principio de la página.
// - Al abrir, si ningún hijo tomó el foco con autoFocus, lo toma el panel
//   (necesita tabIndex={-1}) y no el primer botón: así no aparece un anillo
//   de foco en la X cada vez que se abre con el mouse.
// - Solo se intercepta Tab, no `focusin`: los popovers en portal
//   (CategorySelect, ConfirmDeleteButton) viven fuera del panel en el DOM y
//   robarles el foco al hacer clic rompería su selección. Un Tab desde ahí
//   vuelve al diálogo.
export function useFocusTrap(ref) {
  // se captura en el primer render y no en el efecto: el autoFocus de un hijo
  // ya movió el foco cuando el efecto corre, y se guardaría el input propio
  const [previous] = useState(() => document.activeElement);

  useEffect(() => {
    const panel = ref.current;
    if (!panel) return;
    stack.push(panel);
    if (!panel.contains(document.activeElement)) panel.focus({ preventScroll: true });

    const onKey = (e) => {
      if (e.key !== "Tab" || stack[stack.length - 1] !== panel) return;
      // getClientRects vacío = oculto (display:none, o un input de archivo
      // escondido detrás de su label): no cuenta como destino del Tab
      const items = [...panel.querySelectorAll(FOCUSABLE)].filter((el) => el.getClientRects().length > 0);
      if (items.length === 0) { e.preventDefault(); panel.focus(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const inside = panel.contains(active) && active !== panel;
      if (e.shiftKey && (!inside || active === first)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (!inside || active === last)) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      stack.splice(stack.indexOf(panel), 1);
      // Solo se devuelve el foco si el diálogo se cerró de verdad: en dev,
      // StrictMode desmonta y vuelve a montar el efecto con el panel todavía
      // en el DOM, y devolverlo ahí le quitaría el foco al autoFocus.
      // previous.isConnected: el disparador pudo desaparecer (ej. se borró la
      // fila que abrió el diálogo); ahí el foco queda donde lo deje el navegador.
      if (!panel.isConnected && previous instanceof HTMLElement && previous.isConnected) {
        previous.focus({ preventScroll: true });
      }
    };
  }, [ref, previous]);
}
