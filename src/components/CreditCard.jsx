import { useMemo, useState } from "react";
import { Upload, Pencil, Inbox, CalendarX2, Loader2, Layers, FileText, Trash2 } from "lucide-react";
import { TOKENS } from "../lib/constants.js";
import { formatCLP, formatDateDisplay, suggestMatchKey, groupByDate } from "../lib/utils.js";
import { EmptyState, CategorySelect, Modal, ClassicRowContent, DayHeader } from "./Shared.jsx";
import { computeDayTotals } from "../lib/stats.js";
import { pillClass, BTN_PRIMARY, BTN_GHOST } from "./classes.js";
import { ConfirmDeleteButton } from "./ConfirmDeleteButton.jsx";
import { useIsMobile } from "../hooks/useIsMobile.js";

// la tarjeta no tiene categorías "no cuenta como gasto": todo cargo suma
const NO_EXCLUDED = new Set();

const MONTH_NAMES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function monthLabel(mk) {
  const [y, m] = mk.split("-");
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}`;
}

// Vista de la tarjeta de crédito (CMR): un ciclo/cartola a la vez, sin
// saldo corrido ni conciliación (no aplican acá, ver App.jsx). Deliberadamente
// más simple que Movimientos (sin swipe, sin selección múltiple) — la lista
// de un ciclo mensual es chica. En mobile usa la misma fila "Clásica".
export function CreditCard({
  tx, months, currentMonth, onSetMonth, stats, categories, getCat,
  saveTxEdit, onDelete, onImportFile, isImporting,
  statement, onImportStatementFile, isImportingStatement,
}) {
  const [showImportModal, setShowImportModal] = useState(false);
  const [showStatementModal, setShowStatementModal] = useState(false);
  // "pendiente" (presente) solo tiene sentido real en el ciclo más reciente
  // — en uno viejo, esas cuotas ya se siguieron pagando después.
  const isLatestCycle = months[0] === currentMonth;
  const dayTotals = useMemo(() => computeDayTotals(tx, NO_EXCLUDED), [tx]);
  const isMobile = useIsMobile();

  return (
    <div>
      {months.length > 0 && (
        <div className="flex items-center justify-between gap-2.5 mb-4 flex-wrap">
          <div className="chip-scroll-row flex gap-2 flex-wrap">
            {months.map((m) => (
              <button key={m} onClick={() => onSetMonth(m)} className={pillClass(currentMonth === m)}>
                {monthLabel(m)}
              </button>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setShowImportModal(true)}
              disabled={isImporting}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-surface text-muted text-body whitespace-nowrap disabled:opacity-60 disabled:cursor-default enabled:cursor-pointer"
            >
              {isImporting ? <Loader2 size={13} className="spin" /> : <Upload size={13} />} Importar cartola CMR
            </button>
            <button
              onClick={() => setShowStatementModal(true)}
              disabled={isImportingStatement}
              title="Trae el cupo, la fecha de pago y el total a pagar — no hace falta para ver los movimientos"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-surface text-muted text-body whitespace-nowrap disabled:opacity-60 disabled:cursor-default enabled:cursor-pointer"
            >
              {isImportingStatement ? <Loader2 size={13} className="spin" /> : <FileText size={13} />} Estado de cuenta (PDF)
            </button>
          </div>
        </div>
      )}

      {months.length > 0 && (
        <div className="bg-surface border border-border rounded-xl px-4 py-3.5 mb-4 flex gap-6 flex-wrap">
          <div>
            <div className="text-caption text-muted mb-1">Total facturado este ciclo</div>
            {statement?.totalToPay != null ? (
              // el Estado de Cuenta es la fuente autoritativa: una compra en
              // cuotas recién registrada aparece en el Excel con su VALOR
              // CUOTA ya calculado aunque todavía no se haya empezado a
              // cobrar (confirmado comparando julio vs agosto reales: la
              // misma compra en cuotas figura en el Excel de julio con
              // $25.485, pero el PDF de julio la muestra en "0 de 3 cuotas"
              // sin monto — recién se empieza a cobrar en agosto) — sumar el
              // Excel a ciegas sobreestima el total en ese caso.
              <div className="mono text-xl font-semibold text-expense">
                {formatCLP(statement.totalToPay)}
              </div>
            ) : (
              <div className={`mono text-xl font-semibold ${stats.total <= 0 ? "text-expense" : "text-income"}`}>
                {formatCLP(Math.abs(stats.total))}
              </div>
            )}
          </div>
          {stats.pendingCount > 0 && (
            <div>
              <div className="text-caption text-muted mb-1">
                {isLatestCycle ? "Compras con cuotas pendientes" : "Compras con cuotas pendientes (en ese momento)"}
              </div>
              <div className="mono text-xl font-semibold text-pending">{stats.pendingCount}</div>
            </div>
          )}
          {/* solo aparece si ya se importó el Estado de Cuenta (PDF) de este
              ciclo — sin eso, no rompe nada, se ve exactamente igual que
              antes (el detalle de movimientos ya funciona solo con el Excel). */}
          {statement?.cupoAvailable != null && (
            <div>
              <div className="text-caption text-muted mb-1">Cupo disponible</div>
              <div className="mono text-xl font-semibold text-ink">
                {formatCLP(statement.cupoAvailable)}
                {statement.cupoTotal != null && (
                  <span className="text-small text-faint font-normal"> / {formatCLP(statement.cupoTotal)}</span>
                )}
              </div>
            </div>
          )}
          {statement?.payBy && (
            <div>
              <div className="text-caption text-muted mb-1">Pagar hasta</div>
              <div className="mono text-xl font-semibold text-ink">{formatDateDisplay(statement.payBy)}</div>
              {statement.minToPay != null && (
                <div className="text-micro text-faint mt-[3px]">Mínimo: {formatCLP(statement.minToPay)}</div>
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

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {months.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Todavía no hay movimientos de la tarjeta"
            text='Sube el Excel de "Movimientos Facturados" que exporta CMR cada ciclo, para verlos acá.'
            action={
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-1.5 px-4 py-[9px] rounded-lg border-0 bg-accent text-bg font-semibold text-body cursor-pointer mx-auto"
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
              {/* tarjeta: sin categorías excluidas (no hay traspasos propios acá) */}
              <DayHeader date={group.date} totals={dayTotals[group.date]} />
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
                  isMobile={isMobile}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CreditTxRow({ t, isLast, categories, getCat, saveTxEdit, onDelete, isLatestCycle, isMobile }) {
  const [editing, setEditing] = useState(false);
  const cat = getCat(t.category);
  const CatIcon = cat.icon;
  const plural = t.installmentsPending === 1 ? "" : "s";
  const installmentsTitle = isLatestCycle
    ? `Quedan ${t.installmentsPending} cuota${plural} después de esta`
    : `Quedaban ${t.installmentsPending} cuota${plural} después de esta, al momento de este ciclo — puede que ya se hayan seguido pagando en ciclos más nuevos`;
  const editPanel = editing && (
    <CreditTxEditPanel
      t={t}
      categories={categories}
      onSave={(payload) => { saveTxEdit(t.id, payload); setEditing(false); }}
      onCancel={() => setEditing(false)}
      // en mobile la fila no tiene botón de borrar (no hay swipe acá: la
      // lista de un ciclo es chica), así que va dentro del editor
      onDelete={isMobile ? () => onDelete(t.id) : undefined}
    />
  );

  if (isMobile) {
    // misma fila "Clásica" que Movimientos: tocar abre el editor
    return (
      <div className={isLast ? "" : "border-b border-border"}>
        <button
          onClick={() => setEditing((v) => !v)}
          aria-expanded={editing}
          aria-label={`${t.alias || t.description}, ${formatCLP(t.amount)}`}
          className="w-full flex items-center gap-3 px-4 py-3 bg-surface border-0 text-left cursor-pointer"
        >
          <ClassicRowContent
            icon={CatIcon} color={cat.color} title={t.alias || t.description} amount={t.amount}
            meta={
              <>
                <span className="shrink-0">{cat.label}</span>
                {t.installmentsPending > 0 && (
                  <span title={installmentsTitle} className="inline-flex items-center gap-[3px] text-caption font-semibold text-pending shrink-0">
                    <Layers size={10} /> {isLatestCycle ? "quedan" : "quedaban"} {t.installmentsPending}
                  </span>
                )}
                {t.alias && (
                  <>
                    <span className="text-faint shrink-0">·</span>
                    <span className="truncate text-faint">{t.description}</span>
                  </>
                )}
              </>
            }
          />
        </button>
        {editPanel}
      </div>
    );
  }

  return (
    <div className={isLast ? "" : "border-b border-border"}>
      <div className="grid grid-cols-[1fr_170px_130px_auto] items-center gap-2.5 px-4 py-[11px] bg-surface">
        <div className="flex items-center gap-1.5 text-body min-w-0">
          <span className="flex-[1_1_0%] min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
            {t.alias ? (
              <>
                <span className="font-medium">{t.alias}</span>
                <span className="text-faint text-small"> · {t.description}</span>
              </>
            ) : t.description}
          </span>
          {t.installmentsPending > 0 && (
            <span
              title={installmentsTitle}
              className="inline-flex items-center gap-[3px] text-micro text-pending border border-pending rounded-[4px] px-[5px] py-px font-semibold shrink-0 whitespace-nowrap"
            >
              <Layers size={9} /> {isLatestCycle ? "quedan" : "quedaban"} {t.installmentsPending}
            </span>
          )}
        </div>
        {/* el nombre va en tinta (no en el color de la categoría): en tema
            claro el amarillo/violeta no tenía contraste suficiente */}
        <div className="text-small flex items-center gap-1.5 overflow-hidden text-muted">
          <span
            className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
            style={{ background: `${cat.color}22` }}
          >
            <CatIcon size={12} color={cat.color} />
          </span>
          <span className="overflow-hidden text-ellipsis whitespace-nowrap">{cat.label}</span>
        </div>
        <div className={`mono text-body text-right font-medium ${t.amount >= 0 ? "text-income" : "text-expense"}`}>
          {formatCLP(t.amount)}
        </div>
        <div className="flex">
          <button onClick={() => setEditing((v) => !v)} aria-label={editing ? "Cerrar edición" : "Editar movimiento"} title="Editar" className={`bg-transparent border-0 cursor-pointer p-2 ${editing ? "text-accent" : "text-faint"}`}>
            <Pencil size={13} />
          </button>
          <button onClick={() => onDelete(t.id)} aria-label="Eliminar movimiento" title="Eliminar" className="bg-transparent border-0 cursor-pointer p-2 text-faint">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      {editPanel}
    </div>
  );
}

function CreditTxEditPanel({ t, categories, onSave, onCancel, onDelete }) {
  const [category, setCategory] = useState(t.category);
  const [alias, setAlias] = useState(t.alias || "");
  const [remember, setRemember] = useState(true);
  const [matchText, setMatchText] = useState(suggestMatchKey(t.description));

  return (
    <div className="bg-surface-alt px-4 py-3.5 border-t border-border">
      <div className="form-grid-2 grid grid-cols-2 gap-2.5 mb-2.5">
        <div>
          <div className="text-caption text-faint mb-1">Categoría</div>
          <CategorySelect categories={categories} value={category} onChange={setCategory} placeholder="Elige la categoría correcta…" />
        </div>
        <div>
          <div className="text-caption text-faint mb-1">Nombre para mostrar (opcional)</div>
          <input value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="Ej: Claude" className="w-full px-[9px] py-[7px] rounded-[7px] border border-border bg-surface text-ink text-body" />
        </div>
      </div>

      <div className="mb-2.5">
        <label className={`flex items-center gap-[7px] text-small text-muted cursor-pointer ${remember ? "mb-[7px]" : "mb-0"}`}>
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Recordar esto para futuros movimientos con una descripción parecida
        </label>
        {remember && (
          <div>
            <div className="text-micro text-faint mb-[3px]">Se aplicará a movimientos (de débito y de esta tarjeta) cuya descripción contenga:</div>
            <input value={matchText} onChange={(e) => setMatchText(e.target.value)} className="mono w-full px-[9px] py-[7px] rounded-[7px] border border-border bg-surface text-accent text-small" />
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onSave({ category, alias, remember, matchText })}
          disabled={!category}
          className={BTN_PRIMARY}
        >
          Guardar
        </button>
        <button onClick={onCancel} className={BTN_GHOST}>
          Cancelar
        </button>
        {onDelete && (
          <span className="ml-auto flex items-center">
            <ConfirmDeleteButton onConfirm={onDelete} text="¿Eliminar este movimiento de la tarjeta?" title="Eliminar movimiento" />
          </span>
        )}
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
    <Modal title={title} onClose={onClose} panelClassName="p-[22px] max-w-[420px]">

        <label
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); pick(e.dataTransfer.files[0]); }}
          className={`border-[1.5px] border-dashed rounded-xl px-4 py-[18px] flex items-center gap-3 cursor-pointer ${
            dragOver ? "border-accent bg-tint-accent-soft" : "border-border bg-surface"
          }`}
        >
          <input type="file" accept={accept} className="hidden" onChange={(e) => pick(e.target.files[0])} />
          <div className="w-[34px] h-[34px] rounded-lg bg-surface-alt flex items-center justify-center shrink-0">
            <Upload size={16} color={TOKENS.accent} />
          </div>
          <div>
            <div className="text-body font-medium">{helpTitle}</div>
            <div className="text-small text-faint">{helpText}</div>
          </div>
        </label>
    </Modal>
  );
}
