import { useRef, useState } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Legend,
} from "recharts";
import { ArrowUpRight, ArrowDownRight, PieChart as PieChartIcon, BarChart3, ImageDown, Loader2, Pencil, X, PiggyBank } from "lucide-react";
import { TOKENS, resolveCategoryIcon } from "../lib/constants.js";
import { formatCLP } from "../lib/utils.js";
import { Panel, EmptyState, StatCard, FieldInput } from "./Shared.jsx";
import { SpendHeatmap } from "./Heatmap.jsx";
import { Insights } from "./Insights.jsx";
import { ErrorBoundary } from "./ErrorBoundary.jsx";

const MONTH_NAMES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function fmtMonth(m) {
  if (!m) return "";
  const [y, mo] = m.split("-");
  return `${MONTH_NAMES[parseInt(mo, 10) - 1]} ${y}`;
}

// lastSyncDate es un timestamp completo (hora incluida), no una fecha simple
// como las que maneja formatDateDisplay — se muestra con el formato local.
function formatSyncDate(iso) {
  return new Date(iso).toLocaleString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// compara lo gastado en lo que va del mes contra el mismo tramo de días del
// mes calendario anterior ("ritmo habitual") — mismo cálculo que antes vivía
// en HeroStat.jsx, ahora como texto simple bajo la tarjeta chica.
function spendPaceSub(heroStat) {
  if (!heroStat || heroStat.typicalPace == null || heroStat.typicalPace <= 0) return "Sin historial suficiente para comparar";
  const diffPct = Math.round(((heroStat.spentSoFar - heroStat.typicalPace) / heroStat.typicalPace) * 100);
  if (diffPct > 5) return `${diffPct}% más que tu ritmo habitual`;
  if (diffPct < -5) return `${Math.abs(diffPct)}% menos que tu ritmo habitual`;
  return "en línea con tu ritmo habitual";
}

export function Resumen({
  stats, byCategory, byIncomeCategory, categories, byMonth, currentMonth, dailySpend, hasTransactions, heroStat, insights, pushToast,
  dynamicBalance, lastSyncDate, onAdjustBalance, onCategoryClick, totalSavings, onAdjustSavings,
}) {
  const captureRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showAdjustSavingsModal, setShowAdjustSavingsModal] = useState(false);

  // solo categorías con presupuesto definido — el gasto puede venir de
  // byCategory (ya calculado para el pie) o ser 0 si todavía no hay
  // movimientos ahí este mes (byCategory no incluye categorías sin gasto).
  const budgetedCategories = (categories || [])
    .filter((c) => c.budget != null && c.budget > 0)
    .map((c) => ({
      id: c.id,
      name: c.label,
      color: c.color,
      icon: resolveCategoryIcon(c),
      budget: c.budget,
      spent: byCategory.find((bc) => bc.id === c.id)?.value || 0,
    }))
    .sort((a, b) => b.spent / b.budget - a.spent / a.budget);

  const handleExport = async () => {
    if (!captureRef.current || exporting) return;
    setExporting(true);
    try {
      const { toPng } = await import("html-to-image"); // solo se descarga al exportar el resumen
      const bg = getComputedStyle(document.documentElement).getPropertyValue("--color-bg").trim();
      const dataUrl = await toPng(captureRef.current, { backgroundColor: bg || undefined, pixelRatio: 2, skipFonts: true });
      const link = document.createElement("a");
      link.download = `resumen-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error(e);
      pushToast?.("error", "No se pudo generar la imagen del resumen.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      {hasTransactions && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <button
            onClick={handleExport}
            disabled={exporting}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8,
              border: `1px solid ${TOKENS.border}`, background: TOKENS.surface, color: TOKENS.textMuted,
              fontSize: 12, cursor: exporting ? "default" : "pointer", opacity: exporting ? 0.7 : 1,
            }}
          >
            {exporting ? <Loader2 size={13} className="spin" /> : <ImageDown size={13} />}
            {exporting ? "Generando…" : "Guardar resumen"}
          </button>
        </div>
      )}

      <div ref={captureRef}>
      {hasTransactions && <Insights items={insights} />}

      <div style={{
        background: TOKENS.surface, border: `1px solid ${TOKENS.border}`, borderRadius: 14,
        padding: "22px 24px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12,
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12.5, color: TOKENS.textMuted, marginBottom: 6 }}>Saldo actual</div>
          <div className="mono" style={{ fontSize: 34, fontWeight: 700, color: TOKENS.accent, letterSpacing: "-0.01em", lineHeight: 1.1 }}>
            {dynamicBalance != null ? formatCLP(dynamicBalance) : "—"}
          </div>
          <div style={{ fontSize: 12, color: TOKENS.textFaint, marginTop: 12 }}>
            {lastSyncDate ? `ajustado el ${formatSyncDate(lastSyncDate)}` : "ajusta tu saldo para verlo actualizado"}
          </div>
        </div>
        <button
          onClick={() => setShowAdjustModal(true)}
          aria-label="Ajustar saldo"
          title="Ajustar saldo"
          style={{ background: "none", border: "none", cursor: "pointer", color: TOKENS.textFaint, padding: 4, flexShrink: 0 }}
        >
          <Pencil size={15} />
        </button>
      </div>

      <div className="stagger-fade" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 24 }}>
        <StatCard
          label={heroStat ? `Gastado en ${fmtMonth(heroStat.monthKey)}${heroStat.isRealCurrentMonth ? ` · día ${heroStat.dayOfMonth}` : ""}` : "Gastado este mes"}
          value={formatCLP(heroStat?.spentSoFar || 0)}
          sub={spendPaceSub(heroStat)}
          icon={ArrowDownRight}
          accent={TOKENS.expense}
        />
        <StatCard label="Ingresos" value={formatCLP(stats.income)} icon={ArrowUpRight} accent={TOKENS.income} />
        <StatCard label="Gastos" value={formatCLP(stats.expense)} icon={ArrowDownRight} accent={TOKENS.expense} />
        <StatCard label="Balance del período" value={formatCLP(stats.balance)} accent={stats.balance >= 0 ? TOKENS.income : TOKENS.expense} />
        {totalSavings != null && (
          <StatCard
            label="Total ahorrado"
            value={formatCLP(totalSavings)}
            icon={PiggyBank}
            accent={TOKENS.income}
            sub="histórico"
            action={
              <button
                onClick={() => setShowAdjustSavingsModal(true)}
                aria-label="Ajustar total ahorrado"
                title="Ajustar total ahorrado"
                style={{ background: "none", border: "none", cursor: "pointer", color: TOKENS.textFaint, padding: 0 }}
              >
                <Pencil size={13} />
              </button>
            }
          />
        )}
      </div>

      <div className="resumen-charts-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, marginBottom: 16 }}>
        <Panel title={`Gasto por categoría${currentMonth ? ` · ${fmtMonth(currentMonth)}` : ""}`}>
          <CategoryDonut
            data={byCategory} onCategoryClick={onCategoryClick ? (id) => onCategoryClick(id, "expense") : undefined}
            emptyIcon={PieChartIcon} emptyTitle="Sin gastos este período"
            emptyText="Los gastos categorizados van a aparecer aquí apenas importes o agregues movimientos."
          />
        </Panel>

        <Panel title={`Ingresos por categoría${currentMonth ? ` · ${fmtMonth(currentMonth)}` : ""}`}>
          <CategoryDonut
            data={byIncomeCategory} onCategoryClick={onCategoryClick ? (id) => onCategoryClick(id, "income") : undefined}
            emptyIcon={PieChartIcon} emptyTitle="Sin ingresos este período"
            emptyText="Los ingresos categorizados van a aparecer aquí apenas importes o agregues movimientos."
          />
        </Panel>

        <Panel title="Últimos 6 meses">
          {byMonth.length === 0 ? (
            <EmptyState icon={BarChart3} title="Sin historial todavía" text="Importa movimientos del banco para ver cómo evoluciona tu gasto mes a mes." />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke={TOKENS.border} vertical={false} />
                <XAxis dataKey="month" tickFormatter={fmtMonth} stroke={TOKENS.textFaint} fontSize={11} />
                <YAxis stroke={TOKENS.textFaint} fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip
                  contentStyle={{ background: TOKENS.surfaceAlt, border: `1px solid ${TOKENS.border}`, borderRadius: 8, fontSize: 12 }}
                  itemStyle={{ color: TOKENS.text }}
                  labelStyle={{ color: TOKENS.text, marginBottom: 2 }}
                  labelFormatter={fmtMonth}
                  formatter={(v) => formatCLP(v)}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="ingresos" fill={TOKENS.income} radius={[3, 3, 0, 0]} />
                <Bar dataKey="gastos" fill={TOKENS.expense} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      {budgetedCategories.length > 0 && (
        <Panel title={`Presupuestos${currentMonth ? ` · ${fmtMonth(currentMonth)}` : ""}`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {budgetedCategories.map((c) => {
              const pct = Math.min(100, (c.spent / c.budget) * 100);
              const over = c.spent > c.budget;
              const barColor = over ? TOKENS.expense : pct >= 75 ? TOKENS.pending : TOKENS.income;
              const CatIcon = c.icon;
              return (
                <button
                  key={c.id}
                  onClick={() => onCategoryClick?.(c.id, "expense")}
                  title={`Ver movimientos de ${c.name}`}
                  style={{ background: "none", border: "none", padding: 0, textAlign: "left", width: "100%", cursor: onCategoryClick ? "pointer" : "default" }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, fontSize: 12.5 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, color: TOKENS.text }}>
                      <span style={{
                        width: 18, height: 18, borderRadius: 5, background: `${c.color}22`, display: "flex",
                        alignItems: "center", justifyContent: "center", flexShrink: 0,
                      }}>
                        <CatIcon size={11} color={c.color} />
                      </span>
                      {c.name}
                    </div>
                    <span className="mono" style={{ color: over ? TOKENS.expense : TOKENS.textMuted }}>
                      {formatCLP(c.spent)} <span style={{ color: TOKENS.textFaint }}>/ {formatCLP(c.budget)}</span>
                    </span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: TOKENS.surfaceAlt, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 3 }} />
                  </div>
                  {over && (
                    <div style={{ fontSize: 11, color: TOKENS.expense, marginTop: 4 }}>
                      {formatCLP(c.spent - c.budget)} sobre el presupuesto
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </Panel>
      )}

      <Panel title="Actividad de gasto diaria">
        <ErrorBoundary>
          <SpendHeatmap dailySpend={dailySpend} hasTransactions={hasTransactions} />
        </ErrorBoundary>
      </Panel>
      </div>

      {showAdjustModal && (
        <AdjustBalanceModal
          currentBalance={dynamicBalance}
          onAdjust={onAdjustBalance}
          onClose={() => setShowAdjustModal(false)}
          pushToast={pushToast}
        />
      )}

      {showAdjustSavingsModal && (
        <AdjustSavingsModal
          currentSavings={totalSavings}
          onAdjust={onAdjustSavings}
          onClose={() => setShowAdjustSavingsModal(false)}
          pushToast={pushToast}
        />
      )}
    </div>
  );
}

// donut + leyenda clickeable — se usa tanto para "Gasto por categoría" como
// "Ingresos por categoría", mismo look para que se puedan comparar a simple
// vista. Siempre en columna (donut arriba, leyenda abajo a todo el ancho):
// con 3 tarjetas por fila en desktop, ponerlas lado a lado dejaba muy poco
// espacio para el nombre de la categoría y el monto se salía del recuadro.
function CategoryDonut({ data, onCategoryClick, emptyIcon, emptyTitle, emptyText }) {
  if (data.length === 0) {
    return <EmptyState icon={emptyIcon} title={emptyTitle} text={emptyText} />;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ width: "100%", maxWidth: 220, margin: "0 auto" }}>
        <ResponsiveContainer width="100%" height={190}>
          <PieChart>
            <Pie
              data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={2}
              onClick={onCategoryClick ? (entry) => onCategoryClick(entry.id) : undefined}
              style={{ cursor: onCategoryClick ? "pointer" : "default" }}
            >
              {data.map((entry) => <Cell key={entry.id} fill={entry.color} stroke={TOKENS.surface} strokeWidth={2} />)}
            </Pie>
            <Tooltip
              contentStyle={{ background: TOKENS.surfaceAlt, border: `1px solid ${TOKENS.border}`, borderRadius: 8, fontSize: 12 }}
              itemStyle={{ color: TOKENS.text }}
              labelStyle={{ color: TOKENS.text }}
              formatter={(v) => formatCLP(v)}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {data.slice(0, 6).map((c) => {
          const CatIcon = c.icon;
          return (
            <button
              key={c.id}
              onClick={() => onCategoryClick?.(c.id)}
              title={`Ver movimientos de ${c.name}`}
              className="category-legend-row"
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12.5,
                background: "none", border: "none", padding: "4px 6px", margin: "0 -6px", borderRadius: 7,
                width: "calc(100% + 12px)", cursor: onCategoryClick ? "pointer" : "default", textAlign: "left",
                overflow: "hidden",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 7, color: TOKENS.textMuted, minWidth: 0, overflow: "hidden" }}>
                <span style={{
                  width: 18, height: 18, borderRadius: 5, background: `${c.color}22`, display: "flex",
                  alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <CatIcon size={11} color={c.color} />
                </span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
              </div>
              <span className="mono" style={{ color: TOKENS.text, flexShrink: 0, marginLeft: 8, whiteSpace: "nowrap" }}>{formatCLP(c.value)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AdjustBalanceModal({ currentBalance, onAdjust, onClose, pushToast }) {
  const [value, setValue] = useState(currentBalance != null ? String(Math.round(currentBalance)) : "");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const n = parseFloat(value);
    if (isNaN(n) || saving) return;
    setSaving(true);
    const ok = await onAdjust(n);
    setSaving(false);
    if (ok) {
      pushToast?.("ok", "Saldo ajustado correctamente.");
      onClose();
    } else {
      pushToast?.("error", "No se pudo ajustar el saldo. Revisa tu conexión e inténtalo de nuevo.");
    }
  };

  return (
    <div
      className="modal-backdrop"
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex",
        alignItems: "center", justifyContent: "center", zIndex: 2000, padding: 20,
      }}
    >
      <div className="modal-panel" style={{ background: TOKENS.surface, border: `1px solid ${TOKENS.border}`, borderRadius: 16, padding: 22, maxWidth: 360, width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div className="display" style={{ fontSize: 14.5, fontWeight: 600 }}>Ajustar saldo</div>
          <button onClick={onClose} aria-label="Cerrar" title="Cerrar" style={{ background: "none", border: "none", color: TOKENS.textFaint, cursor: "pointer" }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ fontSize: 12, color: TOKENS.textMuted, marginBottom: 14, lineHeight: 1.4 }}>
          Ingresa el saldo real de tu cuenta ahora mismo (el que muestra tu banco). Desde este momento, la app suma o resta tus movimientos manuales para mantenerlo actualizado.
        </div>
        <FieldInput label="Saldo actual (CLP)" type="number" value={value} onChange={setValue} placeholder="0" style={{ marginBottom: 14 }} />
        <button
          onClick={submit}
          disabled={saving || value === ""}
          style={{
            width: "100%", padding: "10px 0", borderRadius: 8, border: "none", cursor: saving ? "default" : "pointer",
            background: TOKENS.accent, color: TOKENS.bg, fontWeight: 600, fontSize: 13, opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Guardando…" : "Guardar saldo"}
        </button>
      </div>
    </div>
  );
}

// mismo patrón que AdjustBalanceModal pero para "Total ahorrado": deja
// declarar cuánto ya tenías ahorrado (lo que nunca quedó registrado como
// movimientos, porque pasó antes de usar la app). Desde ese momento, la
// app sigue sumando/restando arriba de ese número con lo que pase en las
// categorías marcadas como ahorro.
function AdjustSavingsModal({ currentSavings, onAdjust, onClose, pushToast }) {
  const [value, setValue] = useState(currentSavings != null ? String(Math.round(currentSavings)) : "");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const n = parseFloat(value);
    if (isNaN(n) || saving) return;
    setSaving(true);
    const ok = await onAdjust(n);
    setSaving(false);
    if (ok) {
      pushToast?.("ok", "Total ahorrado ajustado correctamente.");
      onClose();
    } else {
      pushToast?.("error", "No se pudo ajustar el total ahorrado. Revisa tu conexión e inténtalo de nuevo.");
    }
  };

  return (
    <div
      className="modal-backdrop"
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex",
        alignItems: "center", justifyContent: "center", zIndex: 2000, padding: 20,
      }}
    >
      <div className="modal-panel" style={{ background: TOKENS.surface, border: `1px solid ${TOKENS.border}`, borderRadius: 16, padding: 22, maxWidth: 360, width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div className="display" style={{ fontSize: 14.5, fontWeight: 600 }}>Ajustar total ahorrado</div>
          <button onClick={onClose} aria-label="Cerrar" title="Cerrar" style={{ background: "none", border: "none", color: TOKENS.textFaint, cursor: "pointer" }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ fontSize: 12, color: TOKENS.textMuted, marginBottom: 14, lineHeight: 1.4 }}>
          Ingresa lo que ya tienes ahorrado ahora mismo (por ejemplo, si empezaste a ahorrar antes de usar la app). Desde este momento, la app suma o resta arriba de este número lo que pase en tus categorías de ahorro.
        </div>
        <FieldInput label="Total ahorrado (CLP)" type="number" value={value} onChange={setValue} placeholder="0" style={{ marginBottom: 14 }} />
        <button
          onClick={submit}
          disabled={saving || value === ""}
          style={{
            width: "100%", padding: "10px 0", borderRadius: 8, border: "none", cursor: saving ? "default" : "pointer",
            background: TOKENS.accent, color: TOKENS.bg, fontWeight: 600, fontSize: 13, opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Guardando…" : "Guardar total ahorrado"}
        </button>
      </div>
    </div>
  );
}
