import { useState } from "react";
import { Upload, Pencil, X, Inbox, CalendarX2, Loader2, Layers, FileText } from "lucide-react";
import { TOKENS } from "../lib/constants.js";
import { formatCLP, formatDateDisplay, suggestMatchKey, groupByDate, formatDayHeading } from "../lib/utils.js";
import { EmptyState, CategorySelect, pillClass } from "./Shared.jsx";
import { ConfirmDeleteButton } from "./ConfirmDeleteButton.jsx";

const MONTH_NAMES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function monthLabel(mk) {
  const [y, m] = mk.split("-");
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}`;
}

// Vista de la tarjeta de crédito (CMR): un ciclo/cartola a la vez, sin
// saldo corrido ni conciliación (no aplican acá, ver App.jsx). Deliberadamente
// más simple que Movimientos (sin swipe, sin selección múltiple) — la lista
// de un ciclo mensual es chica.
export function CreditCard({
  tx, months, currentMonth, onSetMonth, stats, categories, getCat, onAddCategory,
  saveTxEdit, onDelete, onImportFile, isImporting,
  statement, onImportStatementFile, isImportingStatement,
}) {
  const [showImportModal, setShowImportModal] = useState(false);
  const [showStatementModal, setShowStatementModal] = useState(false);
  // "pendiente" (presente) solo tiene sentido real en el ciclo más reciente
  // — en uno viejo, esas cuotas ya se siguieron pagando después.
  const isLatestCycle = months[0] === currentMonth;

  return (
    <div>
      {months.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <div className="chip-scroll-row" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {months.map((m) => (
              <button key={m} onClick={() => onSetMonth(m)} className={pillClass(currentMonth === m)}>
                {monthLabel(m)}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => setShowImportModal(true)}
              disabled={isImporting}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 8,
                border: `1px solid ${TOKENS.border}`, background: TOKENS.surface, color: TOKENS.textMuted,
                fontSize: 12.5, cursor: isImporting ? "default" : "pointer", opacity: isImporting ? 0.6 : 1, whiteSpace: "nowrap",
              }}
            >
              {isImporting ? <Loader2 size={13} className="spin" /> : <Upload size={13} />} Importar cartola CMR
            </button>
            <button
              onClick={() => setShowStatementModal(true)}
              disabled={isImportingStatement}
              title="Trae el cupo, la fecha de pago y el total a pagar — no hace falta para ver los movimientos"
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 8,
                border: `1px solid ${TOKENS.border}`, background: TOKENS.surface, color: TOKENS.textMuted,
                fontSize: 12.5, cursor: isImportingStatement ? "default" : "pointer", opacity: isImportingStatement ? 0.6 : 1, whiteSpace: "nowrap",
              }}
            >
              {isImportingStatement ? <Loader2 size={13} className="spin" /> : <FileText size={13} />} Estado de cuenta (PDF)
            </button>
          </div>
        </div>
      )}

      {months.length > 0 && (
        <div style={{
          background: TOKENS.surface, border: `1px solid ${TOKENS.border}`, borderRadius: 12,
          padding: "14px 16px", marginBottom: 16, display: "flex", gap: 24, flexWrap: "wrap",
        }}>
          <div>
            <div style={{ fontSize: 11, color: TOKENS.textMuted, marginBottom: 4 }}>Total facturado este ciclo</div>
            {statement?.totalToPay != null ? (
              // el Estado de Cuenta es la fuente autoritativa: una compra en
              // cuotas recién registrada aparece en el Excel con su VALOR
              // CUOTA ya calculado aunque todavía no se haya empezado a
              // cobrar (confirmado comparando julio vs agosto reales: la
              // misma compra en cuotas figura en el Excel de julio con
              // $25.485, pero el PDF de julio la muestra en "0 de 3 cuotas"
              // sin monto — recién se empieza a cobrar en agosto) — sumar el
              // Excel a ciegas sobreestima el total en ese caso.
              <div className="mono" style={{ fontSize: 20, fontWeight: 600, color: TOKENS.expense }}>
                {formatCLP(statement.totalToPay)}
              </div>
            ) : (
              <div className="mono" style={{ fontSize: 20, fontWeight: 600, color: stats.total <= 0 ? TOKENS.expense : TOKENS.income }}>
                {formatCLP(Math.abs(stats.total))}
              </div>
            )}
          </div>
          {stats.pendingCount > 0 && (
            <div>
              <div style={{ fontSize: 11, color: TOKENS.textMuted, marginBottom: 4 }}>
                {isLatestCycle ? "Compras con cuotas pendientes" : "Compras con cuotas pendientes (en ese momento)"}
              </div>
              <div className="mono" style={{ fontSize: 20, fontWeight: 600, color: TOKENS.pending }}>{stats.pendingCount}</div>
            </div>
          )}
          {/* solo aparece si ya se importó el Estado de Cuenta (PDF) de este
              ciclo — sin eso, no rompe nada, se ve exactamente igual que
              antes (el detalle de movimientos ya funciona solo con el Excel). */}
          {statement?.cupoAvailable != null && (
            <div>
              <div style={{ fontSize: 11, color: TOKENS.textMuted, marginBottom: 4 }}>Cupo disponible</div>
              <div className="mono" style={{ fontSize: 20, fontWeight: 600, color: TOKENS.text }}>
                {formatCLP(statement.cupoAvailable)}
                {statement.cupoTotal != null && (
                  <span style={{ fontSize: 12, color: TOKENS.textFaint, fontWeight: 400 }}> / {formatCLP(statement.cupoTotal)}</span>
                )}
              </div>
            </div>
          )}
          {statement?.payBy && (
            <div>
              <div style={{ fontSize: 11, color: TOKENS.textMuted, marginBottom: 4 }}>Pagar hasta</div>
              <div className="mono" style={{ fontSize: 20, fontWeight: 600, color: TOKENS.text }}>{formatDateDisplay(statement.payBy)}</div>
              {statement.minToPay != null && (
                <div style={{ fontSize: 10.5, color: TOKENS.textFaint, marginTop: 3 }}>Mínimo: {formatCLP(statement.minToPay)}</div>
              )}
            </div>
          )}
        </div>
      )}

      {showImportModal && (
        <CreditImportModal
          title="Importar cartola CMR"
          accept=".xlsx"
          helpTitle="Subir movimientos facturados"
          helpText="Arrastra el Excel que exporta CMR, o haz clic para elegirlo"
          onClose={() => setShowImportModal(false)}
          onImport={(file) => { onImportFile(file); setShowImportModal(false); }}
        />
      )}

      {showStatementModal && (
        <CreditImportModal
          title="Importar Estado de Cuenta CMR"
          accept=".pdf"
          helpTitle="Subir Estado de Cuenta"
          helpText="Arrastra el PDF que exporta CMR, o haz clic para elegirlo — trae cupo, fecha de pago y totales"
          onClose={() => setShowStatementModal(false)}
          onImport={(file) => { onImportStatementFile(file); setShowStatementModal(false); }}
        />
      )}

      <div style={{ background: TOKENS.surface, border: `1px solid ${TOKENS.border}`, borderRadius: 12, overflow: "hidden" }}>
        {months.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Todavía no hay movimientos de la tarjeta"
            text='Sube el Excel de "Movimientos Facturados" que exporta CMR cada ciclo, para verlos acá.'
            action={
              <button
                onClick={() => setShowImportModal(true)}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 8, border: "none",
                  background: TOKENS.accent, color: TOKENS.bg, fontWeight: 600, fontSize: 13, cursor: "pointer", margin: "0 auto",
                }}
              >
                <Upload size={14} /> Importar cartola CMR
              </button>
            }
          />
        ) : tx.length === 0 ? (
          <EmptyState icon={CalendarX2} title="Sin movimientos en este ciclo" text="Elige otro ciclo arriba, o importa la cartola de este mes." />
        ) : (
          groupByDate(tx).map((group) => (
            <div key={group.date}>
              <div style={{
                padding: "9px 16px", fontSize: 11, fontWeight: 600, color: TOKENS.textFaint,
                textTransform: "uppercase", letterSpacing: "0.03em", background: TOKENS.surfaceAlt,
                borderBottom: `1px solid ${TOKENS.border}`,
              }}>
                {formatDayHeading(group.date)}
              </div>
              {group.items.map((t, i) => (
                <CreditTxRow
                  key={t.id}
                  t={t}
                  isLast={i === group.items.length - 1}
                  categories={categories}
                  getCat={getCat}
                  saveTxEdit={saveTxEdit}
                  onDelete={onDelete}
                  isLatestCycle={isLatestCycle}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CreditTxRow({ t, isLast, categories, getCat, saveTxEdit, onDelete, isLatestCycle }) {
  const [editing, setEditing] = useState(false);
  const cat = getCat(t.category);
  const CatIcon = cat.icon;
  const plural = t.installmentsPending === 1 ? "" : "s";

  return (
    <div style={{ borderBottom: isLast ? "none" : `1px solid ${TOKENS.border}` }}>
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 170px 130px auto", alignItems: "center", gap: 10,
        padding: "11px 16px", background: TOKENS.surface,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, minWidth: 0 }}>
          <span style={{ flex: "1 1 0%", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {t.alias ? (
              <>
                <span style={{ fontWeight: 500 }}>{t.alias}</span>
                <span style={{ color: TOKENS.textFaint, fontSize: 11.5 }}> · {t.description}</span>
              </>
            ) : t.description}
          </span>
          {t.installmentsPending > 0 && (
            <span
              title={
                isLatestCycle
                  ? `Quedan ${t.installmentsPending} cuota${plural} después de esta`
                  : `Quedaban ${t.installmentsPending} cuota${plural} después de esta, al momento de este ciclo — puede que ya se hayan seguido pagando en ciclos más nuevos`
              }
              style={{
                display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, color: TOKENS.pending,
                border: `1px solid ${TOKENS.pending}`, borderRadius: 4, padding: "1px 5px", fontWeight: 600, flexShrink: 0, whiteSpace: "nowrap",
              }}
            >
              <Layers size={9} /> {isLatestCycle ? "quedan" : "quedaban"} {t.installmentsPending}
            </span>
          )}
        </div>
        <div style={{ fontSize: 11.5, color: cat.color, display: "flex", alignItems: "center", gap: 6, overflow: "hidden" }}>
          <span style={{
            width: 20, height: 20, borderRadius: 6, background: `${cat.color}22`, display: "flex",
            alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <CatIcon size={12} color={cat.color} />
          </span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat.label}</span>
        </div>
        <div className="mono" style={{ fontSize: 13, textAlign: "right", fontWeight: 500, color: t.amount >= 0 ? TOKENS.income : TOKENS.expense }}>
          {formatCLP(t.amount)}
        </div>
        <div style={{ display: "flex" }}>
          <button onClick={() => setEditing((v) => !v)} aria-label={editing ? "Cerrar edición" : "Editar movimiento"} title="Editar" style={{ background: "none", border: "none", cursor: "pointer", color: editing ? TOKENS.accent : TOKENS.textFaint, padding: 8 }}>
            <Pencil size={13} />
          </button>
          <ConfirmDeleteButton onConfirm={() => onDelete(t.id)} text="¿Eliminar este movimiento de la tarjeta?" title="Eliminar movimiento" size={13} />
        </div>
      </div>
      {editing && (
        <CreditTxEditPanel
          t={t}
          categories={categories}
          onSave={(payload) => { saveTxEdit(t.id, payload); setEditing(false); }}
          onCancel={() => setEditing(false)}
        />
      )}
    </div>
  );
}

function CreditTxEditPanel({ t, categories, onSave, onCancel }) {
  const [category, setCategory] = useState(t.category);
  const [alias, setAlias] = useState(t.alias || "");
  const [remember, setRemember] = useState(true);
  const [matchText, setMatchText] = useState(suggestMatchKey(t.description));

  return (
    <div style={{ background: TOKENS.surfaceAlt, padding: "14px 16px", borderTop: `1px solid ${TOKENS.border}` }}>
      <div className="form-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 11, color: TOKENS.textFaint, marginBottom: 4 }}>Categoría</div>
          <CategorySelect categories={categories} value={category} onChange={setCategory} placeholder="Elige la categoría correcta…" />
        </div>
        <div>
          <div style={{ fontSize: 11, color: TOKENS.textFaint, marginBottom: 4 }}>Nombre para mostrar (opcional)</div>
          <input value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="Ej: Claude" style={{ width: "100%", padding: "7px 9px", borderRadius: 7, border: `1px solid ${TOKENS.border}`, background: TOKENS.surface, color: TOKENS.text, fontSize: 12.5 }} />
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: TOKENS.textMuted, marginBottom: remember ? 7 : 0, cursor: "pointer" }}>
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Recordar esto para futuros movimientos con una descripción parecida
        </label>
        {remember && (
          <div>
            <div style={{ fontSize: 10.5, color: TOKENS.textFaint, marginBottom: 3 }}>Se aplicará a movimientos (de débito y de esta tarjeta) cuya descripción contenga:</div>
            <input value={matchText} onChange={(e) => setMatchText(e.target.value)} className="mono" style={{ width: "100%", padding: "7px 9px", borderRadius: 7, border: `1px solid ${TOKENS.border}`, background: TOKENS.surface, color: TOKENS.accent, fontSize: 11.5 }} />
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => onSave({ category, alias, remember, matchText })}
          disabled={!category}
          style={{
            padding: "7px 14px", borderRadius: 7, border: "none", background: TOKENS.accent, color: TOKENS.bg,
            fontWeight: 600, fontSize: 12, cursor: category ? "pointer" : "default", opacity: category ? 1 : 0.6,
          }}
        >
          Guardar
        </button>
        <button onClick={onCancel} style={{ padding: "7px 14px", borderRadius: 7, border: `1px solid ${TOKENS.border}`, background: "transparent", color: TOKENS.textMuted, fontSize: 12, cursor: "pointer" }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

// reutilizado tanto para el Excel de movimientos como para el PDF del Estado
// de Cuenta — mismo look, distinto accept/textos.
function CreditImportModal({ title, accept, helpTitle, helpText, onClose, onImport }) {
  const [dragOver, setDragOver] = useState(false);
  const pick = (file) => { if (file) onImport(file); };

  return (
    <div onClick={onClose} className="modal-backdrop" style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 2000, padding: 20,
    }}>
      <div onClick={(e) => e.stopPropagation()} className="modal-panel" style={{
        background: TOKENS.surface, border: `1px solid ${TOKENS.border}`, borderRadius: 16, padding: 22, maxWidth: 420, width: "100%",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div className="display" style={{ fontSize: 14.5, fontWeight: 600 }}>{title}</div>
          <button onClick={onClose} aria-label="Cerrar" title="Cerrar" style={{ background: "none", border: "none", color: TOKENS.textFaint, cursor: "pointer" }}>
            <X size={16} />
          </button>
        </div>

        <label
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); pick(e.dataTransfer.files[0]); }}
          style={{
            border: `1.5px dashed ${dragOver ? TOKENS.accent : TOKENS.border}`, borderRadius: 12, padding: "18px 16px",
            display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
            background: dragOver ? "var(--tint-accent-soft)" : TOKENS.surface,
          }}
        >
          <input type="file" accept={accept} style={{ display: "none" }} onChange={(e) => pick(e.target.files[0])} />
          <div style={{ width: 34, height: 34, borderRadius: 8, background: TOKENS.surfaceAlt, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Upload size={16} color={TOKENS.accent} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{helpTitle}</div>
            <div style={{ fontSize: 11.5, color: TOKENS.textFaint }}>{helpText}</div>
          </div>
        </label>
      </div>
    </div>
  );
}
