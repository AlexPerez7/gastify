import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Trash2 } from "lucide-react";
import { TOKENS } from "../lib/constants.js";

// Popover en portal (no absolute anidado) para que no lo recorten los
// contenedores con overflow:hidden que usan las listas de la app.
export function ConfirmDeleteButton({ onConfirm, text = "¿Eliminar?", size = 13, color, title = "Eliminar" }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const btnRef = useRef(null);
  const popRef = useRef(null);

  const openPopover = () => {
    const rect = btnRef.current.getBoundingClientRect();
    setCoords({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (popRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        title={title}
        aria-label={title}
        onClick={(e) => { e.stopPropagation(); openPopover(); }}
        className="bg-none border-0 cursor-pointer p-2"
        style={{ color: color || TOKENS.textFaint }}
      >
        <Trash2 size={size} />
      </button>
      {open && coords && createPortal(
        <div
          ref={popRef}
          className="fixed z-[1000] w-[190px] bg-surface-alt border border-border rounded-[10px] p-2.5"
          style={{ top: coords.top, right: coords.right, boxShadow: "0 10px 28px rgba(0,0,0,0.45)" }}
        >
          <div className="text-xs text-ink mb-2 leading-[1.4]">{text}</div>
          <div className="flex gap-1.5">
            <button
              onClick={() => { setOpen(false); onConfirm(); }}
              className="flex-1 py-1.5 rounded-md border-0 bg-expense text-white text-[11.5px] font-semibold cursor-pointer"
            >
              Eliminar
            </button>
            <button
              onClick={() => setOpen(false)}
              className="flex-1 py-1.5 rounded-md border border-border bg-transparent text-muted text-[11.5px] cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
