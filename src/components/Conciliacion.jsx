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
      style={{
        display: "flex", alignItems: "center", gap: 4, marginBottom: 12, padding: "4px 2px",
        background: "none", border: "none", color: TOKENS.textMuted, fontSize: 12.5, cursor: "pointer",
      }}
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
          <button onClick={() => { const n = reconcileMonth(currentMonth); setResult(n); }} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: TOKENS.accent, color: TOKENS.bg, fontSize: 12.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <ScanLine size={13} /> Conciliar mes
          </button>
        }
      >
        <div style={{ fontSize: 12.5, color: TOKENS.textMuted, marginBottom: 4 }}>
          El reporte del banco es la fuente oficial: compara tus movimientos manuales contra él (mismo monto, hasta 5 días después por la fecha contable del banco) y confirma los que calzan.
        </div>
        {result !== null && (
          <div style={{ fontSize: 12, color: TOKENS.income, marginTop: 6 }}>
            {result > 0 ? `${result} movimiento${result === 1 ? "" : "s"} confirmado${result === 1 ? "" : "s"} en esta pasada.` : "No se encontraron nuevas coincidencias."}
          </div>
        )}
        {!bankExists && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: TOKENS.pending, marginTop: 8 }}>
            <Info size={13} /> Todavía no has importado el reporte del banco de este mes — no se puede confirmar nada hasta que lo subas.
          </div>
        )}
      </Panel>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        {/* min-width:0 en cada celda: por default una celda de grid no se
            achica más allá del contenido de su fila (ej. una descripción
            larga sin salto de línea), así que sin esto la columna con un
            movimiento confirmado se ensanchaba a costa de la otra columna. */}
        <div style={{ minWidth: 0 }}>
          <Panel title={`Confirmados (${confirmed.length})`}>
            {confirmed.length === 0 ? <EmptyNote text="Aún ninguno." /> : confirmed.map((t) => <ReconcileRow key={t.id} t={t} icon={Check} color={TOKENS.income} />)}
          </Panel>
        </div>

        <div style={{ minWidth: 0 }}>
          <Panel title={`Sin reporte del banco (${pendingNoReport.length})`}>
            {pendingNoReport.length === 0 ? <EmptyNote text="—" /> : (
              <>
                <div style={{ fontSize: 11, color: TOKENS.textFaint, marginBottom: 8 }}>Aún no importas el .xls de este mes, así que no se pueden comparar todavía.</div>
                {pendingNoReport.map((t) => <ReconcileRow key={t.id} t={t} icon={null} color={TOKENS.textMuted} />)}
              </>
            )}
          </Panel>
        </div>
      </div>

      {bankExists && pendingMismatch.length > 0 && (
        <Panel title={`⚠ Posible descuadre — no coinciden con el reporte (${pendingMismatch.length})`} right={null}>
          <div style={{ fontSize: 11.5, color: TOKENS.textFaint, marginBottom: 10 }}>
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
              style={{
                display: "flex", alignItems: "center", gap: 5, background: "none", border: "none",
                color: TOKENS.textMuted, fontSize: 12, cursor: "pointer", padding: 4,
              }}
            >
              {showBankOnly ? "Ocultar" : "Mostrar"}
              {showBankOnly ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          }
        >
          <div style={{ fontSize: 11.5, color: TOKENS.textFaint, marginBottom: showBankOnly ? 10 : 0 }}>
            Es normal: son movimientos que solo conoces por la cartola (compras con tarjeta, cargos automáticos, etc.) — no requieren nada de ti.
          </div>
          {showBankOnly && (
            <>
              {bankOnly.slice(0, 8).map((t) => <ReconcileRow key={t.id} t={t} icon={null} color={TOKENS.textMuted} />)}
              {bankOnly.length > 8 && <div style={{ fontSize: 11.5, color: TOKENS.textFaint, marginTop: 6 }}>+ {bankOnly.length - 8} más</div>}
            </>
          )}
        </Panel>
      )}
    </div>
  );
}

function ReconcileRow({ t, icon: Icon, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${TOKENS.border}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, overflow: "hidden", flex: 1, minWidth: 0 }}>
        {Icon && <Icon size={13} color={color} style={{ flexShrink: 0 }} />}
        <span className="mono" style={{ color: TOKENS.textFaint, fontSize: 11, flexShrink: 0 }}>{formatDateDisplay(t.date)}</span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{t.alias || t.description}</span>
      </div>
      <span className="mono" style={{ fontSize: 12, color: t.amount >= 0 ? TOKENS.income : TOKENS.expense, flexShrink: 0, marginLeft: 8 }}>
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
    <div style={{ borderBottom: `1px solid ${TOKENS.border}` }}>
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
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
            padding: "7px 0", background: TOKENS.surface, touchAction: "pan-y", position: "relative",
          }}
          {...(isMobile ? {
            drag: "x",
            dragConstraints: { left: -MISMATCH_SWIPE_WIDTH, right: 0 },
            dragElastic: 0.06,
            animate: swipeControls,
            onDragEnd: handleDragEnd,
          } : {})}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, overflow: "hidden", flex: 1, minWidth: 0 }}>
            <AlertTriangle size={13} color={TOKENS.pending} style={{ flexShrink: 0 }} />
            <span className="mono" style={{ color: TOKENS.textFaint, fontSize: 11 }}>{formatDateDisplay(t.date)}</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.alias || t.description}</span>
          </div>
          <span className="mono" style={{ fontSize: 12, color: t.amount >= 0 ? TOKENS.income : TOKENS.expense, flexShrink: 0 }}>
            {formatCLP(t.amount)}
          </span>
          <div className="tx-actions" style={{ display: "flex", gap: 2, flexShrink: 0 }}>
            <button
              onClick={openEdit}
              title="Corregir fecha o monto"
              aria-label="Corregir fecha o monto"
              style={{ background: "none", border: "none", cursor: "pointer", color: mode === "edit" ? TOKENS.accent : TOKENS.textFaint, padding: 5 }}
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={openLink}
              title="Vincular a mano con un movimiento del banco"
              aria-label="Vincular a mano con un movimiento del banco"
              disabled={bankCandidates.length === 0}
              style={{
                background: "none", border: "none", padding: 5,
                cursor: bankCandidates.length === 0 ? "default" : "pointer",
                color: mode === "link" ? TOKENS.accent : TOKENS.textFaint,
                opacity: bankCandidates.length === 0 ? 0.4 : 1,
              }}
            >
              <Link2 size={13} />
            </button>
          </div>
          <ChevronLeft size={13} className="tx-swipe-hint" />
        </Row>
      </div>

      {mode === "edit" && (
        <div style={{ marginTop: 8, padding: "10px 12px", background: TOKENS.surfaceAlt, borderRadius: 8 }}>
          <div className="form-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <FieldInput label="Fecha" type="date" value={date} onChange={setDate} />
            <FieldInput label="Monto (CLP)" type="number" value={amount} onChange={setAmount} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={saveEdit} style={{ flex: 1, padding: "8px 12px", borderRadius: 7, border: "none", background: TOKENS.accent, color: TOKENS.bg, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
              Guardar
            </button>
            <button onClick={close} aria-label="Cancelar" style={{ padding: 8, borderRadius: 7, border: `1px solid ${TOKENS.border}`, background: "transparent", color: TOKENS.textMuted, cursor: "pointer" }}>
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {mode === "link" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, padding: "10px 12px", background: TOKENS.surfaceAlt, borderRadius: 8, flexWrap: "wrap" }}>
          <select
            value={bankId}
            onChange={(e) => setBankId(e.target.value)}
            style={{ flex: "1 1 220px", padding: "7px 9px", borderRadius: 7, border: `1px solid ${TOKENS.border}`, background: TOKENS.surface, color: TOKENS.text, fontSize: 12.5 }}
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
            style={{
              padding: "8px 12px", borderRadius: 7, border: "none", fontWeight: 600, fontSize: 12,
              background: TOKENS.accent, color: TOKENS.bg, cursor: bankId ? "pointer" : "default", opacity: bankId ? 1 : 0.6,
            }}
          >
            Vincular
          </button>
          <button onClick={close} aria-label="Cancelar" style={{ padding: 8, borderRadius: 7, border: `1px solid ${TOKENS.border}`, background: "transparent", color: TOKENS.textMuted, cursor: "pointer" }}>
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
