import { X, Upload, PenLine, Tags, ScanLine, CheckSquare, Download, CalendarRange } from "lucide-react";
import { TOKENS } from "../lib/constants.js";

const SECTIONS = [
  {
    icon: Upload,
    title: "Subir movimientos del banco",
    text: "Desde Movimientos → \"Importar Excel\", o el botón + de abajo → \"Subir archivo del banco\", puedes subir el .xls (reportCollection) o la cartola mensual en .pdf de Banco Falabella — la app detecta el formato solo, por la extensión del archivo. Si subes el .xls y el .pdf del mismo período, los movimientos que ya estén importados no se duplican.",
  },
  {
    icon: PenLine,
    title: "Agregar un movimiento manual",
    text: "Para gastos o ingresos que todavía no aparecen en el banco: botón + → \"Manual\", o \"Nuevo registro\" en Movimientos.",
  },
  {
    icon: Tags,
    title: "Categorías",
    text: "Cada movimiento se categoriza solo cuando reconoce el comercio. Toca el lápiz en un movimiento para cambiar su categoría o nombre, y \"recordarlo\" para la próxima vez. En la pestaña Categorías puedes agregar, renombrar, cambiar el ícono, o marcar si una categoría cuenta como gasto en los resúmenes (por ejemplo, transferencias entre tus propias cuentas).",
  },
  {
    icon: ScanLine,
    title: "Conciliación",
    text: "Compara lo que registraste a mano con lo que reportó el banco ese mes, para asegurarte de que no falte ni sobre nada.",
  },
  {
    icon: CheckSquare,
    title: "Selección múltiple",
    text: "En Movimientos, marca varios con el checkbox de la izquierda para borrarlos o cambiarles la categoría todos juntos.",
  },
  {
    icon: CalendarRange,
    title: "Filtro de meses",
    text: "Arriba de Resumen y Movimientos puedes filtrar por mes (agrupados por año) o elegir \"Todo\" para ver el historial completo.",
  },
  {
    icon: Download,
    title: "Respaldo de tus datos",
    text: "El botón \"Descargar respaldo\" en Movimientos genera un archivo .json con todos tus movimientos y categorías.",
  },
];

export function HelpModal({ onClose }) {
  return (
    <div
      onClick={onClose}
      className="modal-backdrop"
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex",
        alignItems: "center", justifyContent: "center", zIndex: 2000, padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-panel"
        style={{
          background: TOKENS.surface, border: `1px solid ${TOKENS.border}`, borderRadius: 16,
          padding: 24, maxWidth: 480, width: "100%", maxHeight: "min(640px, 85vh)",
          display: "flex", flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, flexShrink: 0 }}>
          <div className="display" style={{ fontSize: 16, fontWeight: 600 }}>Cómo usar Gastify</div>
          <button onClick={onClose} aria-label="Cerrar ayuda" title="Cerrar" style={{ background: "none", border: "none", color: TOKENS.textFaint, cursor: "pointer", padding: 4 }}>
            <X size={17} />
          </button>
        </div>

        <div style={{ overflowY: "auto", marginTop: 12, paddingRight: 4 }}>
          {SECTIONS.map(({ icon: Icon, title, text }, i) => (
            <div key={title} style={{ display: "flex", gap: 12, padding: "12px 0", borderTop: i === 0 ? "none" : `1px solid ${TOKENS.border}` }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, background: "var(--tint-accent)", display: "flex",
                alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <Icon size={16} color={TOKENS.accent} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{title}</div>
                <div style={{ fontSize: 12, color: TOKENS.textMuted, lineHeight: 1.5 }}>{text}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
