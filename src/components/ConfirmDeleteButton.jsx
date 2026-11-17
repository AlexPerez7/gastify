import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Trash2 } from "lucide-react";
import { TOKENS } from "../lib/constants.js";

// Popover en portal (no absolute anidado) para que no lo recorten los
// contenedores con overflow:hidden que usan las listas de la app. z por encima
// del Modal (2000), por si se usa dentro de un diálogo.
export function ConfirmDeleteButton({ onConfirm, text = "¿Eliminar?", size = 13, color, title = "Eliminar" }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const confirming = useRef(false);
  const btnRef = useRef(null);
  const popRef = useRef(null);

  const openPopover = () => {
    setError("");
    const rect = btnRef.current.getBoundingClientRect();
    setCoords({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (busy) return;
      if (popRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); if (!busy) setOpen(false); } };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, busy]);

  const confirm = async () => {
    if (confirming.current) return;
    confirming.current = true;
    setBusy(true);
    setError("");
    try {
      const ok = await onConfirm();
      if (ok === false) setError("No se pudo eliminar. Revisa el aviso de error e inténtalo de nuevo.");
      else setOpen(false);
    } catch { setError("No se pudo eliminar. Inténtalo de nuevo."); }
    finally { confirming.current = false; setBusy(false); }
  };

  return (
    <>
      <button
        ref={btnRef}
        title={title}
        aria-label={title}
        onClick={(e) => { e.stopPropagation(); openPopover(); }}
        className="bg-transparent border-0 cursor-pointer p-2"
        style={{ color: color || TOKENS.textFaint }}
      >
        <Trash2 size={size} />
      </button>
      {open && coords && createPortal(
        <div
          ref={popRef}
          className="popover fixed z-[2100] w-[190px] bg-surface-alt border border-border rounded-[10px] p-2.5"
          // alineado al borde derecho del botón y debajo de él: crece desde ahí
          style={{ top: coords.top, right: coords.right, transformOrigin: "top right", boxShadow: "0 10px 28px rgba(0,0,0,0.45)" }}
        >
          <div className="text-small text-ink mb-2 leading-[1.4]">{text}</div>
          <div className="flex gap-1.5">
            <button
              onClick={confirm}
              disabled={busy}
              className="flex-1 py-1.5 rounded-md border-0 bg-expense text-white text-small font-semibold cursor-pointer"
            >
              {busy ? "Eliminando…" : "Eliminar"}
            </button>
            <button
              onClick={() => setOpen(false)}
              disabled={busy}
              className="flex-1 py-1.5 rounded-md border border-border bg-transparent text-muted text-small cursor-pointer"
            >
              Cancelar
            </button>
          </div>
          {error && <p className="text-small text-expense mb-0" role="alert">{error}</p>}
        </div>,
        document.body
      )}
    </>
  );
}
