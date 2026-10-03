import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Calendar } from "lucide-react";
import { formatCLP } from "../lib/utils.js";
import { heatmapThresholds, heatLevel } from "../lib/stats.js";
import { EmptyState } from "./Shared.jsx";

const MONTH_NAMES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const WEEKDAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const DOW_LABELS = ["Lun", "", "Mié", "", "Vie", "", ""];
const WEEKS = 53;
const CELL = 11;
const GAP = 3;

// niveles de intensidad — tonos sólidos por tema (index.css), no alpha sobre
// TOKENS.expense: mezclar transparencia se ve distinto en fondo claro vs oscuro.
const LEVEL_COLORS = [
  "var(--heat-0)",
  "var(--heat-1)",
  "var(--heat-2)",
  "var(--heat-3)",
  "var(--heat-4)",
];

function toISODate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function describeDay(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const wd = WEEKDAY_NAMES[new Date(y, m - 1, d).getDay()];
  return `${wd.charAt(0).toUpperCase()}${wd.slice(1)} ${d} de ${MONTH_NAMES[m - 1]}`;
}

export function SpendHeatmap({ dailySpend, hasTransactions }) {
  const scrollRef = useRef(null);
  // día elegido: en mobile se toca (no hay hover), en desktop basta pasar el
  // mouse. El valor se muestra en una línea fija bajo la grilla, en vez de un
  // `title` que el teléfono nunca enseña.
  const [selected, setSelected] = useState(null);

  const { weeks, today, thresholds } = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    const todayDow = (t.getDay() + 6) % 7; // 0 = lunes
    const gridEnd = new Date(t);
    gridEnd.setDate(t.getDate() + (6 - todayDow));
    const gridStart = new Date(gridEnd);
    gridStart.setDate(gridEnd.getDate() - WEEKS * 7 + 1);

    const w = [];
    const inWindow = [];
    for (let wi = 0; wi < WEEKS; wi++) {
      const week = [];
      for (let d = 0; d < 7; d++) {
        const day = new Date(gridStart);
        day.setDate(gridStart.getDate() + wi * 7 + d);
        week.push(day);
        if (day <= t) inWindow.push(dailySpend[toISODate(day)] || 0);
      }
      w.push(week);
    }
    return { weeks: w, today: t, thresholds: heatmapThresholds(inWindow) };
  }, [dailySpend]);

  // arranca mostrando lo más reciente (a la derecha): en un teléfono la
  // grilla de un año no cabe, y antes abría en el año pasado con "hoy" fuera
  // de la pantalla.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [hasTransactions]);

  if (!hasTransactions) {
    return (
      <EmptyState
        icon={Calendar}
        title="Sin actividad todavía"
        text="Importa movimientos o agrega gastos para ver tu mapa de actividad diaria."
      />
    );
  }

  const pick = (e) => {
    const iso = e.target?.dataset?.iso;
    if (iso) setSelected(iso);
  };
  const selectedValue = selected ? dailySpend[selected] || 0 : 0;

  return (
    <div>
      <div ref={scrollRef} className="overflow-x-auto overscroll-x-contain pb-1">
        <div className="inline-flex flex-col gap-1">
          <div className="flex" style={{ marginLeft: CELL + GAP + 6 }}>
            {weeks.map((week, wi) => {
              const firstOfMonth = week.find((d) => d.getDate() === 1);
              return (
                <div key={wi} className="text-[10px] text-faint shrink-0" style={{ width: CELL + GAP }}>
                  {firstOfMonth ? MONTH_NAMES[firstOfMonth.getMonth()] : ""}
                </div>
              );
            })}
          </div>
          {/* un solo manejador para toda la grilla (no 371 botones): el día
              sale del data-iso de la celda tocada o bajo el mouse */}
          <div className="flex" style={{ gap: GAP }} onClick={pick} onMouseOver={pick}>
            <div className="flex flex-col mr-1.5 shrink-0" style={{ gap: GAP }}>
              {DOW_LABELS.map((label, i) => (
                <div key={i} className="text-[9px] text-faint" style={{ height: CELL, lineHeight: `${CELL}px` }}>{label}</div>
              ))}
            </div>
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col" style={{ gap: GAP }}>
                {week.map((day, di) => {
                  if (day > today) return <div key={di} style={{ width: CELL, height: CELL }} />;
                  const iso = toISODate(day);
                  const level = heatLevel(dailySpend[iso] || 0, thresholds);
                  return (
                    <div
                      key={di}
                      data-iso={iso}
                      className="rounded-[3px] cursor-pointer"
                      style={{
                        width: CELL,
                        height: CELL,
                        background: LEVEL_COLORS[level],
                        outline: iso === selected ? "2px solid var(--c-text)" : "none",
                        outlineOffset: 1,
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 mt-2.5 min-h-[18px]">
        <div className="text-small text-muted" aria-live="polite">
          {selected ? (
            <>
              {describeDay(selected)} ·{" "}
              <span className={`mono ${selectedValue ? "text-ink" : "text-faint"}`}>
                {selectedValue ? formatCLP(selectedValue) : "sin gastos"}
              </span>
            </>
          ) : (
            <span className="text-faint">Elige un día para ver cuánto gastaste</span>
          )}
        </div>
        <div className="flex items-center gap-1 text-[10.5px] text-faint shrink-0">
          Menos
          {LEVEL_COLORS.map((c, i) => <div key={i} className="w-2.5 h-2.5 rounded-[3px]" style={{ background: c }} />)}
          Más
        </div>
      </div>
    </div>
  );
}
