import { useEffect, useState } from "react";
import { motion, useAnimation } from "framer-motion";
import { Check, AlertTriangle, ScanLine, Info, ChevronDown, ChevronUp, ChevronLeft, Pencil, Link2, X } from "lucide-react";
import { TOKENS } from "../lib/constants.js";
import { formatCLP, formatDateDisplay } from "../lib/utils.js";
import { Panel, EmptyNote, EmptyState, FieldInput } from "./Shared.jsx";
import { useIsMobile } from "../lib/useIsMobile.js";

// ancho de los 2 botones (corregir + vincular) revelados al deslizar una
// fila de "posible descuadre" — mismo criterio que las filas de Movimientos.
const MISMATCH_SWIPE_WIDTH = 128;

// Conciliación no tiene tab propia en la nav (se entra desde un botón en
// Movimientos) — este es el camino de vuelta.
function BackToMovimientosButton({ onBack }) {
  if (!onBack) return null;
  return (
    <button
      onClick={onBack}
      className="flex items-center gap-1 mb-3 px-0.5 py-1 bg-transparent border-0 text-muted text-[12.5px] cursor-pointer"
    >
      <ChevronLeft size={14} /> Movimientos
    </button>
  );
}

const MONTH_NAMES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function fmtMonth(m) {
  if (!m) return "";
  const [y, mo] = m.split("-");
  return `${MONTH_NAMES[parseInt(mo, 10) - 1]} ${y}`;
}

export function Conciliacion({ currentMonth, reconcileStats, reconcileMonth, onEditManual, onManualMatch, onBack }) {
  const [result, setResult] = useState(null);
  const [showBankOnly, setShowBankOnly] = useState(false);
  const isMobile = useIsMobile();
  const bankExists = reconcileStats?.bankExists;

  // conciliar es una operación segura de repetir (si no hay nada nuevo que
  // calce, no toca la base de datos) — se corre sola al entrar a un mes con
  // reporte del banco, en vez de obligar a tocar "Conciliar mes" primero.
  useEffect(() => {
    if (!currentMonth || !bankExists) return;
    const n = reconcileMonth(currentMonth);
    if (n > 0) setResult(n);
  }, [currentMonth, bankExists, reconcileMonth]);

  // colapsar la vista de "sin registro manual" al cambiar de mes — es la
  // sección menos accionable, no tiene sentido dejarla abierta de un mes
  // al revisar el siguiente.
  useEffect(() => setShowBankOnly(false), [currentMonth]);

  if (!currentMonth || !reconcileStats) {
    return (
      <div>
        <BackToMovimientosButton onBack={onBack} />
        <EmptyState
          icon={ScanLine}
          title="Nada que conciliar todavía"
          text="Importa movimientos del banco para poder revisar qué coincide con tus registros manuales."
        />
      </div>
    );
  }

  const { confirmed, pendingNoReport, pendingMismatch, bankOnly, linkCandidates } = reconcileStats;

  return (
    <div>
      <BackToMovimientosButton onBack={onBack} />
      <Panel
        title={`Conciliar ${fmtMonth(currentMonth)}`}
        right={
          <button onClick={() => { const n = reconcileMonth(currentMonth); setResult(n); }} className="px-3.5 py-[7px] rounded-lg border-0 bg-accent text-bg text-[12.5px] font-semibold cursor-pointer flex items-center gap-1.5">
            <ScanLine size={13} /> Conciliar mes
          </button>
        }
      >
        <div className="text-[12.5px] text-muted mb-1">
          El reporte del banco es la fuente oficial: compara tus movimientos manuales contra él (mismo monto, hasta 5 días después por la fecha contable del banco) y confirma los que calzan.
        </div>
        {result !== null && (
          <div className="text-xs text-income mt-1.5">
            {result > 0 ? `${result} movimiento${result === 1 ? "" : "s"} confirmado${result === 1 ? "" : "s"} en esta pasada.` : "No se encontraron nuevas coincidencias."}
          </div>
        )}
        {!bankExists && (
          <div className="flex items-center gap-1.5 text-xs text-pending mt-2">
            <Info size={13} /> Todavía no has importado el reporte del banco de este mes — no se puede confirmar nada hasta que lo subas.
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-2 gap-4 mt-4">
        {/* min-width:0 en cada celda: por default una celda de grid no se
            achica más allá del contenido de su fila (ej. una descripción
            larga sin salto de línea), así que sin esto la columna con un
            movimiento confirmado se ensanchaba a costa de la otra columna. */}
        <div className="min-w-0">
          <Panel title={`Confirmados (${confirmed.length})`}>
            {confirmed.length === 0 ? <EmptyNote text="Aún ninguno." /> : confirmed.map((t) => <ReconcileRow key={t.id} t={t} icon={Check} color={TOKENS.income} />)}
          </Panel>
        </div>

        <div className="min-w-0">
          <Panel title={`Sin reporte del banco (${pendingNoReport.length})`}>
            {pendingNoReport.length === 0 ? <EmptyNote text="—" /> : (
              <>
                <div className="text-[11px] text-faint mb-2">Aún no importas el .xls de este mes, así que no se pueden comparar todavía.</div>
                {pendingNoReport.map((t) => <ReconcileRow key={t.id} t={t} icon={null} color={TOKENS.textMuted} />)}
              </>
            )}
          </Panel>
        </div>
      </div>

      {bankExists && pendingMismatch.length > 0 && (
        <Panel title={`⚠ Posible descuadre — no coinciden con el reporte (${pendingMismatch.length})`} right={null}>
          <div className="text-[11.5px] text-faint mb-2.5">
            Ya subiste el reporte de este mes, pero estos movimientos manuales no encontraron un cargo o abono equivalente. Revisa el monto, la fecha, o si el banco aún no procesa ese movimiento.
          </div>
          {pendingMismatch.map((t) => (
            <MismatchRow key={t.id} t={t} bankCandidates={linkCandidates} onEdit={onEditManual} onMatch={onManualMatch} isMobile={isMobile} />
          ))}
        </Panel>
      )}

      {bankOnly.length > 0 && (
        <Panel
          title={`Movimientos del banco sin registro manual (${bankOnly.length})`}
          right={
            <button
              onClick={() => setShowBankOnly((v) => !v)}
              aria-expanded={showBankOnly}
              className="flex items-center gap-[5px] bg-transparent border-0 text-muted text-xs cursor-pointer p-1"
            >
              {showBankOnly ? "Ocultar" : "Mostrar"}
              {showBankOnly ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          }
        >
          <div className={`text-[11.5px] text-faint ${showBankOnly ? "mb-2.5" : "mb-0"}`}>
            Es normal: son movimientos que solo conoces por la cartola (compras con tarjeta, cargos automáticos, etc.) — no requieren nada de ti.
          </div>
          {showBankOnly && (
            <>
              {bankOnly.slice(0, 8).map((t) => <ReconcileRow key={t.id} t={t} icon={null} color={TOKENS.textMuted} />)}
              {bankOnly.length > 8 && <div className="text-[11.5px] text-faint mt-1.5">+ {bankOnly.length - 8} más</div>}
            </>
          )}
        </Panel>
      )}
    </div>
  );
}

function ReconcileRow({ t, icon: Icon, color }) {
  return (
    <div className="flex items-center justify-between py-[7px] border-b border-border">
      <div className="flex items-center gap-2 text-[12.5px] overflow-hidden flex-1 min-w-0">
        {Icon && <Icon size={13} color={color} className="shrink-0" />}
        <span className="mono text-faint text-[11px] shrink-0">{formatDateDisplay(t.date)}</span>
        <span className="overflow-hidden text-ellipsis whitespace-nowrap min-w-0">{t.alias || t.description}</span>
      </div>
      <span className={`mono text-xs shrink-0 ml-2 ${t.amount >= 0 ? "text-income" : "text-expense"}`}>
        {formatCLP(t.amount)}
      </span>
    </div>
  );
}

// fila de "posible descuadre": además de mostrar el movimiento manual,
// deja corregirlo (fecha/monto — el caso más común es un typo) o vincularlo
// a mano con un movimiento del banco cuando el calce automático no lo
// encontró (ej. el banco demoró más días en procesarlo de lo esperado).
function MismatchRow({ t, bankCandidates, onEdit, onMatch, isMobile }) {
  const [mode, setMode] = useState(null); // null | "edit" | "link"
  const [date, setDate] = useState(t.date);
  const [amount, setAmount] = useState(String(Math.abs(t.amount)));
  const [bankId, setBankId] = useState("");
  const swipeControls = useAnimation();
  const closeSwipe = () => swipeControls.start({ x: 0, transition: { duration: 0.18 } });

  const close = () => setMode(null);

  const saveEdit = () => {
    const n = parseFloat(amount);
    if (!date || !n || n <= 0) return;
    onEdit(t.id, { date, amount: n });
    close();
  };

  const confirmMatch = () => {
    if (!bankId) return;
    onMatch(t.id, bankId);
    close();
  };

  const openEdit = () => { closeSwipe(); setMode((m) => (m === "edit" ? null : "edit")); };
  const openLink = () => { closeSwipe(); setMode((m) => (m === "link" ? null : "link")); };

  const handleDragEnd = (_e, info) => {
    if (info.offset.x < -MISMATCH_SWIPE_WIDTH / 2) swipeControls.start({ x: -MISMATCH_SWIPE_WIDTH, transition: { duration: 0.18 } });
    else closeSwipe();
  };

  // el swipe-to-action (como en Movimientos) solo existe en mobile — en
  // desktop la fila es un <div> normal y los botones de editar/vincular
  // quedan visibles siempre (misma fila, con la clase "tx-actions" que ya
  // se oculta en mobile vía CSS).
  const Row = isMobile ? motion.div : "div";

  return (
    <div className="border-b border-border">
      <div className="tx-swipe-clip">
        {isMobile && (
          <div className="tx-swipe-actions" style={{ width: MISMATCH_SWIPE_WIDTH }}>
            <button className="tx-swipe-btn tx-swipe-edit" onClick={openEdit} aria-label="Corregir fecha o monto" title="Corregir">
              <Pencil size={16} />
            </button>
            <button
              className="tx-swipe-btn tx-swipe-link"
              onClick={openLink}
              aria-label="Vincular a mano con un movimiento del banco"
              title="Vincular"
              disabled={bankCandidates.length === 0}
              style={bankCandidates.length === 0 ? { opacity: 0.5, cursor: "default" } : undefined}
            >
              <Link2 size={16} />
            </button>
          </div>
        )}
        <Row
          className="flex items-center justify-between gap-2 py-[7px] bg-surface touch-pan-y relative"
          {...(isMobile ? {
            drag: "x",
            dragConstraints: { left: -MISMATCH_SWIPE_WIDTH, right: 0 },
            dragElastic: 0.06,
            animate: swipeControls,
            onDragEnd: handleDragEnd,
          } : {})}
        >
          <div className="flex items-center gap-2 text-[12.5px] overflow-hidden flex-1 min-w-0">
            <AlertTriangle size={13} color={TOKENS.pending} className="shrink-0" />
            <span className="mono text-faint text-[11px]">{formatDateDisplay(t.date)}</span>
            <span className="overflow-hidden text-ellipsis whitespace-nowrap">{t.alias || t.description}</span>
          </div>
          <span className={`mono text-xs shrink-0 ${t.amount >= 0 ? "text-income" : "text-expense"}`}>
            {formatCLP(t.amount)}
          </span>
          <div className="tx-actions flex gap-0.5 shrink-0">
            <button
              onClick={openEdit}
              title="Corregir fecha o monto"
              aria-label="Corregir fecha o monto"
              className={`bg-transparent border-0 cursor-pointer p-[5px] ${mode === "edit" ? "text-accent" : "text-faint"}`}
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={openLink}
              title="Vincular a mano con un movimiento del banco"
              aria-label="Vincular a mano con un movimiento del banco"
              disabled={bankCandidates.length === 0}
              className={`bg-transparent border-0 p-[5px] disabled:opacity-40 disabled:cursor-default enabled:cursor-pointer ${
                mode === "link" ? "text-accent" : "text-faint"
              }`}
            >
              <Link2 size={13} />
            </button>
          </div>
          <ChevronLeft size={13} className="tx-swipe-hint" />
        </Row>
      </div>

      {mode === "edit" && (
        <div className="mt-2 px-3 py-2.5 bg-surface-alt rounded-lg">
          <div className="form-grid-2 grid grid-cols-2 gap-2 mb-2">
            <FieldInput label="Fecha" type="date" value={date} onChange={setDate} />
            <FieldInput label="Monto (CLP)" type="number" value={amount} onChange={setAmount} />
          </div>
          <div className="flex gap-2">
            <button onClick={saveEdit} className="flex-1 px-3 py-2 rounded-[7px] border-0 bg-accent text-bg font-semibold text-xs cursor-pointer">
              Guardar
            </button>
            <button onClick={close} aria-label="Cancelar" className="p-2 rounded-[7px] border border-border bg-transparent text-muted cursor-pointer">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {mode === "link" && (
        <div className="flex items-center gap-2 mt-2 px-3 py-2.5 bg-surface-alt rounded-lg flex-wrap">
          <select
            value={bankId}
            onChange={(e) => setBankId(e.target.value)}
            className="flex-[1_1_220px] px-[9px] py-[7px] rounded-[7px] border border-border bg-surface text-ink text-[12.5px]"
          >
            <option value="">Elige el movimiento del banco…</option>
            {bankCandidates.map((b) => (
              <option key={b.id} value={b.id}>
                {formatDateDisplay(b.date)} · {b.description} · {formatCLP(b.amount)}
              </option>
            ))}
          </select>
          <button
            onClick={confirmMatch}
            disabled={!bankId}
            className="px-3 py-2 rounded-[7px] border-0 font-semibold text-xs bg-accent text-bg disabled:opacity-60 disabled:cursor-default enabled:cursor-pointer"
          >
            Vincular
          </button>
          <button onClick={close} aria-label="Cancelar" className="p-2 rounded-[7px] border border-border bg-transparent text-muted cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
