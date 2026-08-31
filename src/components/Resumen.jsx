import { useRef, useState } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Legend,
} from "recharts";
import { ArrowUpRight, ArrowDownRight, PieChart as PieChartIcon, BarChart3, ImageDown, Loader2, Pencil, X, PiggyBank, CreditCard as CreditCardIcon, ArrowRight } from "lucide-react";
import { TOKENS, resolveCategoryIcon } from "../lib/constants.js";
import { formatCLP, formatDateDisplay } from "../lib/utils.js";
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
  creditStatement, onGoToCredit,
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
      const bg = getComputedStyle(document.documentElement).getPropertyValue("--c-bg").trim();
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
        <div className="flex justify-end mb-3">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-[7px] rounded-lg border border-border bg-surface text-muted text-xs disabled:opacity-70 disabled:cursor-default enabled:cursor-pointer"
          >
            {exporting ? <Loader2 size={13} className="spin" /> : <ImageDown size={13} />}
            {exporting ? "Generando…" : "Guardar resumen"}
          </button>
        </div>
      )}

      <div ref={captureRef}>
      {hasTransactions && <Insights items={insights} />}

      <div className="bg-surface border border-border rounded-[14px] px-6 py-[22px] mb-5 flex justify-between items-start gap-3">
        <div className="min-w-0">
          <div className="text-[12.5px] text-muted mb-1.5">Saldo actual</div>
          <div className="mono text-[34px] font-bold text-accent tracking-[-0.01em] leading-[1.1]">
            {dynamicBalance != null ? formatCLP(dynamicBalance) : "—"}
          </div>
          <div className="text-xs text-faint mt-3">
            {lastSyncDate ? `ajustado el ${formatSyncDate(lastSyncDate)}` : "ajusta tu saldo para verlo actualizado"}
          </div>
        </div>
        <button
          onClick={() => setShowAdjustModal(true)}
          aria-label="Ajustar saldo"
          title="Ajustar saldo"
          className="bg-none border-0 cursor-pointer text-faint p-1 shrink-0"
        >
          <Pencil size={15} />
        </button>
      </div>

      <div className="stagger-fade grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5 mb-6">
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
                className="bg-none border-0 cursor-pointer text-faint p-0"
              >
                <Pencil size={13} />
              </button>
            }
          />
        )}
      </div>

      {/* sección aparte (no en la grilla de arriba, que es todo cuenta
          corriente) — etiqueta propia para que quede claro que es una
          cuenta distinta. Solo aparece si ya se importó al menos un Estado
          de Cuenta CMR, y es puramente informativa: no se suma ni resta a
          ningún cálculo de esta pantalla (Gastos, Balance, saldo). Ver
          App.jsx: latestCreditStatement es el ciclo más reciente, sin
          relación con el mes seleccionado acá arriba. */}
      {creditStatement && (
        <div className="mb-6">
          <div className="text-[11px] text-faint uppercase tracking-[0.03em] font-semibold mb-2">
            Tarjeta de crédito
          </div>
          <button
            onClick={onGoToCredit}
            title="Ver tarjeta de crédito"
            className={`w-full flex items-center justify-between gap-5 flex-wrap bg-surface border border-border rounded-xl px-4 py-3.5 text-left ${
              onGoToCredit ? "cursor-pointer" : "cursor-default"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-surface-alt flex items-center justify-center shrink-0">
                <CreditCardIcon size={15} color={TOKENS.textMuted} />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] text-muted mb-0.5">
                  {creditStatement.payBy ? `Paga hasta ${formatDateDisplay(creditStatement.payBy)}` : "Total facturado"}
                </div>
                <div className="mono text-lg font-semibold text-expense">{formatCLP(creditStatement.totalToPay)}</div>
              </div>
            </div>
            {creditStatement.cupoAvailable != null && (
              <div className="text-right">
                <div className="text-[11px] text-muted mb-0.5">Cupo disponible</div>
                <div className="mono text-sm text-ink">
                  {formatCLP(creditStatement.cupoAvailable)}
                  {creditStatement.cupoTotal != null && <span className="text-faint"> / {formatCLP(creditStatement.cupoTotal)}</span>}
                </div>
              </div>
            )}
            {onGoToCredit && <ArrowRight size={15} color={TOKENS.textFaint} className="shrink-0" />}
          </button>
        </div>
      )}

      <div className="resumen-charts-grid grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4 mb-4">
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
          <div className="flex flex-col gap-3.5">
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
                  className={`bg-none border-0 p-0 text-left w-full ${onCategoryClick ? "cursor-pointer" : "cursor-default"}`}
                >
                  <div className="flex items-center justify-between mb-1.5 text-[12.5px]">
                    <div className="flex items-center gap-[7px] text-ink">
                      <span
                        className="w-[18px] h-[18px] rounded-[5px] flex items-center justify-center shrink-0"
                        style={{ background: `${c.color}22` }}
                      >
                        <CatIcon size={11} color={c.color} />
                      </span>
                      {c.name}
                    </div>
                    <span className={`mono ${over ? "text-expense" : "text-muted"}`}>
                      {formatCLP(c.spent)} <span className="text-faint">/ {formatCLP(c.budget)}</span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-[3px] bg-surface-alt overflow-hidden">
                    <div className="h-full rounded-[3px]" style={{ width: `${pct}%`, background: barColor }} />
                  </div>
                  {over && (
                    <div className="text-[11px] text-expense mt-1">
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
    <div className="flex flex-col gap-3">
      <div className="w-full max-w-[220px] mx-auto">
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
      <div className="flex flex-col gap-[7px]">
        {data.slice(0, 6).map((c) => {
          const CatIcon = c.icon;
          return (
            <button
              key={c.id}
              onClick={() => onCategoryClick?.(c.id)}
              title={`Ver movimientos de ${c.name}`}
              className={`category-legend-row flex items-center justify-between text-[12.5px] bg-none border-0 px-1.5 py-1 -mx-1.5 rounded-[7px] w-[calc(100%+12px)] text-left overflow-hidden ${
                onCategoryClick ? "cursor-pointer" : "cursor-default"
              }`}
            >
              <div className="flex items-center gap-[7px] text-muted min-w-0 overflow-hidden">
                <span
                  className="w-[18px] h-[18px] rounded-[5px] flex items-center justify-center shrink-0"
                  style={{ background: `${c.color}22` }}
                >
                  <CatIcon size={11} color={c.color} />
                </span>
                <span className="overflow-hidden text-ellipsis whitespace-nowrap">{c.name}</span>
              </div>
              <span className="mono text-ink shrink-0 ml-2 whitespace-nowrap">{formatCLP(c.value)}</span>
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
      className="modal-backdrop fixed inset-0 flex items-center justify-center z-[2000] p-5"
      style={{ background: "rgba(0,0,0,0.55)" }}
    >
      <div className="modal-panel bg-surface border border-border rounded-2xl p-[22px] max-w-[360px] w-full">
        <div className="flex justify-between items-center mb-1.5">
          <div className="display text-[14.5px] font-semibold">Ajustar saldo</div>
          <button onClick={onClose} aria-label="Cerrar" title="Cerrar" className="bg-none border-0 text-faint cursor-pointer">
            <X size={16} />
          </button>
        </div>
        <div className="text-xs text-muted mb-3.5 leading-[1.4]">
          Ingresa el saldo real de tu cuenta ahora mismo (el que muestra tu banco). Desde este momento, la app suma o resta tus movimientos manuales para mantenerlo actualizado.
        </div>
        <FieldInput label="Saldo actual (CLP)" type="number" value={value} onChange={setValue} placeholder="0" style={{ marginBottom: 14 }} />
        <button
          onClick={submit}
          disabled={saving || value === ""}
          className="w-full py-2.5 rounded-lg border-0 bg-accent text-bg font-semibold text-[13px] disabled:opacity-70 disabled:cursor-default enabled:cursor-pointer"
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
      className="modal-backdrop fixed inset-0 flex items-center justify-center z-[2000] p-5"
      style={{ background: "rgba(0,0,0,0.55)" }}
    >
      <div className="modal-panel bg-surface border border-border rounded-2xl p-[22px] max-w-[360px] w-full">
        <div className="flex justify-between items-center mb-1.5">
          <div className="display text-[14.5px] font-semibold">Ajustar total ahorrado</div>
          <button onClick={onClose} aria-label="Cerrar" title="Cerrar" className="bg-none border-0 text-faint cursor-pointer">
            <X size={16} />
          </button>
        </div>
        <div className="text-xs text-muted mb-3.5 leading-[1.4]">
          Ingresa lo que ya tienes ahorrado ahora mismo (por ejemplo, si empezaste a ahorrar antes de usar la app). Desde este momento, la app suma o resta arriba de este número lo que pase en tus categorías de ahorro.
        </div>
        <FieldInput label="Total ahorrado (CLP)" type="number" value={value} onChange={setValue} placeholder="0" style={{ marginBottom: 14 }} />
        <button
          onClick={submit}
          disabled={saving || value === ""}
          className="w-full py-2.5 rounded-lg border-0 bg-accent text-bg font-semibold text-[13px] disabled:opacity-70 disabled:cursor-default enabled:cursor-pointer"
        >
          {saving ? "Guardando…" : "Guardar total ahorrado"}
        </button>
      </div>
    </div>
  );
}
