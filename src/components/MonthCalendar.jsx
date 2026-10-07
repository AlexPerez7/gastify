import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { formatCLP, formatCLPCompact, localIsoDate } from "../lib/utils.js";
import { heatmapThresholds, heatLevel, monthCalendarWeeks, byDateDesc } from "../lib/stats.js";
import { EmptyState } from "./Shared.jsx";

const DOW = ["L", "M", "M", "J", "V", "S", "D"];
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function dayTitle(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${WEEKDAYS[new Date(y, m - 1, d).getDay()]} ${d} de ${MONTHS[m - 1]}`;
}

// Calendario del mes seleccionado: cada día con lo gastado (gasto real) y un
// tono según cuánto — mismos tonos (--heat-*) y umbrales por cuartiles que el
// mapa de actividad, pero calculados sobre los días de ESTE mes. Tocar un día
// muestra sus movimientos abajo, sin salir de Resumen.
export function MonthCalendar({ month, dailySpend, monthTransactions, getCat }) {
  const [selected, setSelected] = useState(null);
  const today = localIsoDate();

  const { weeks, thresholds, hasSpend } = useMemo(() => {
    const w = month ? monthCalendarWeeks(month) : [];
    const values = w.flat().filter(Boolean).map((d) => dailySpend[d] || 0);
    return { weeks: w, thresholds: heatmapThresholds(values), hasSpend: values.some((v) => v > 0) };
  }, [month, dailySpend]);

  // el día elegido solo vale dentro del mes que se está mirando
  const selectedDay = selected && selected.startsWith(month) ? selected : null;
  const dayTx = useMemo(
    () => (selectedDay ? monthTransactions.filter((t) => t.date === selectedDay).sort(byDateDesc) : []),
    [selectedDay, monthTransactions]
  );

  if (!month || !hasSpend) {
    return <EmptyState icon={CalendarDays} title="Sin gastos este mes" text="Cuando haya gastos en el mes, acá vas a ver cuánto se fue cada día." />;
  }

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1" aria-hidden="true">
        {DOW.map((d, i) => <div key={i} className="text-center text-micro text-faint">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1" role="grid" aria-label={`Gasto por día de ${MONTHS[Number(month.slice(5)) - 1]}`}>
        {weeks.flat().map((iso, i) => {
          if (!iso) return <div key={`pad-${i}`} />;
          const spent = dailySpend[iso] || 0;
          const level = heatLevel(spent, thresholds);
          const future = iso > today;
          const isSelected = iso === selectedDay;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => setSelected(isSelected ? null : iso)}
              aria-pressed={isSelected}
              aria-label={`${dayTitle(iso)}: ${spent > 0 ? formatCLP(-spent) : "sin gastos"}`}
              disabled={future}
              className="aspect-square min-w-0 rounded-md border-0 p-1 flex flex-col items-start justify-between text-left disabled:opacity-40 enabled:cursor-pointer"
              style={{
                background: `var(--heat-${level})`,
                color: `var(--heat-text-${level})`,
                boxShadow: isSelected ? "0 0 0 2px var(--c-accent)" : iso === today ? "inset 0 0 0 1.5px var(--c-text-faint)" : "none",
              }}
            >
              <span className="text-caption font-semibold leading-none">{Number(iso.slice(8))}</span>
              {spent > 0 && <span className="mono text-micro leading-none self-end">{formatCLPCompact(spent)}</span>}
            </button>
          );
        })}
      </div>

      {selectedDay && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex justify-between items-baseline mb-1.5">
            <span className="text-body text-ink font-semibold">{dayTitle(selectedDay)}</span>
            <span className="mono text-small text-muted">{formatCLP(-(dailySpend[selectedDay] || 0))}</span>
          </div>
          {dayTx.length === 0 ? (
            <div className="text-small text-faint">Sin movimientos este día.</div>
          ) : (
            <ul className="m-0 p-0 list-none flex flex-col">
              {dayTx.map((t) => {
                const cat = getCat(t.category);
                const Icon = cat.icon;
                return (
                  <li key={t.id} className="flex items-center gap-2 py-1.5 text-body min-w-0">
                    <span
                      className="w-[22px] h-[22px] rounded-md flex items-center justify-center shrink-0"
                      style={{ background: `color-mix(in srgb, ${cat.color} 13%, transparent)` }}
                    >
                      <Icon size={12} color={cat.color} />
                    </span>
                    <span className="flex-1 min-w-0 truncate text-ink">{t.alias || t.description}</span>
                    <span className={`mono shrink-0 ${t.amount >= 0 ? "text-income" : "text-ink"}`}>
                      {t.amount >= 0 ? "+" : ""}{formatCLP(t.amount)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
