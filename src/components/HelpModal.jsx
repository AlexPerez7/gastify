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
      className="modal-backdrop fixed inset-0 flex items-center justify-center z-[2000] p-5"
      style={{ background: "rgba(0,0,0,0.55)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-panel bg-surface border border-border rounded-2xl p-6 max-w-[480px] w-full flex flex-col"
        style={{ maxHeight: "min(640px, 85vh)" }}
      >
        <div className="flex justify-between items-center mb-1 shrink-0">
          <div className="display text-base font-semibold">Cómo usar Gastify</div>
          <button onClick={onClose} aria-label="Cerrar ayuda" title="Cerrar" className="bg-none border-0 text-faint cursor-pointer p-1">
            <X size={17} />
          </button>
        </div>

        <div className="overflow-y-auto mt-3 pr-1">
          {SECTIONS.map(({ icon: Icon, title, text }, i) => (
            <div key={title} className={`flex gap-3 py-3 ${i === 0 ? "" : "border-t border-border"}`}>
              <div className="w-8 h-8 rounded-lg bg-tint-accent flex items-center justify-center shrink-0">
                <Icon size={16} color={TOKENS.accent} />
              </div>
              <div>
                <div className="text-[13px] font-semibold mb-[3px]">{title}</div>
                <div className="text-xs text-muted leading-[1.5]">{text}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
