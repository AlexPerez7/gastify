import { Calendar } from "lucide-react";
import { TOKENS } from "../lib/constants.js";
import { formatCLP, formatDateDisplay } from "../lib/utils.js";
import { EmptyState } from "./Shared.jsx";

const MONTH_NAMES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
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

function levelFor(value, max) {
  if (!value || max === 0) return 0;
  const ratio = value / max;
  if (ratio > 0.75) return 4;
  if (ratio > 0.5) return 3;
  if (ratio > 0.25) return 2;
  return 1;
}

export function SpendHeatmap({ dailySpend, hasTransactions }) {
  if (!hasTransactions) {
    return (
      <EmptyState
        icon={Calendar}
        title="Sin actividad todavía"
        text="Importa movimientos o agrega gastos para ver tu mapa de actividad diaria."
      />
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayDow = (today.getDay() + 6) % 7; // 0 = lunes
  const gridEnd = new Date(today);
  gridEnd.setDate(today.getDate() + (6 - todayDow));
  const totalDays = WEEKS * 7;
  const gridStart = new Date(gridEnd);
  gridStart.setDate(gridEnd.getDate() - totalDays + 1);

  const weeks = [];
  for (let w = 0; w < WEEKS; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(gridStart);
      day.setDate(gridStart.getDate() + w * 7 + d);
      week.push(day);
    }
    weeks.push(week);
  }

  const maxVal = Math.max(0, ...Object.values(dailySpend));

  return (
    <div>
      <div className="overflow-x-auto pb-1">
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
          <div className="flex" style={{ gap: GAP }}>
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
                  const value = dailySpend[iso] || 0;
                  const level = levelFor(value, maxVal);
                  return (
                    <div
                      key={di}
                      title={`${formatDateDisplay(iso)} · ${value ? formatCLP(value) : "Sin gastos"}`}
                      className="rounded-[3px]"
                      style={{ width: CELL, height: CELL, background: LEVEL_COLORS[level] }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 justify-end text-[10.5px] text-faint mt-2">
        Menos
        {LEVEL_COLORS.map((c, i) => <div key={i} className="w-2.5 h-2.5 rounded-[3px]" style={{ background: c }} />)}
        Más
      </div>
    </div>
  );
}
