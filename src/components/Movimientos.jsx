import { useState, useRef, useEffect, useMemo } from "react";
import { motion, useAnimation } from "framer-motion";
import { Upload, Plus, Pencil, X, Inbox, SearchX, CalendarX2, Download, FileSpreadsheet, Loader2, Trash2, Sparkles, ChevronLeft, ScanLine } from "lucide-react";
import { TOKENS, resolveCategoryIcon, categoryMatchesType } from "../lib/constants.js";
import { formatCLP, suggestMatchKey, groupByDate, formatDayHeading } from "../lib/utils.js";
import { EmptyState, FieldInput, CategoryQuickAdd, CategorySelect } from "./Shared.jsx";
import { ConfirmDeleteButton } from "./ConfirmDeleteButton.jsx";
import { useIsMobile } from "../lib/useIsMobile.js";
import { exportBackup } from "../lib/exportBackup.js";
import { exportCsv } from "../lib/exportCsv.js";

const SWIPE_ACTION_WIDTH = 128; // ancho de los 2 botones (editar + borrar) revelados al deslizar

const actionBtnStyle = {
  display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 8,
  border: `1px solid ${TOKENS.border}`, background: TOKENS.surface, color: TOKENS.textMuted,
  fontSize: 12.5, cursor: "pointer", whiteSpace: "nowrap",
};

export function Movimientos({
  filteredTx, hasTransactions, categories, getCat, search, setSearch, catFilter, setCatFilter,
  txTypeFilter = "all", setTxTypeFilter,
  sourceFilter = "all", setSourceFilter,
  saveTxEdit, deleteTransaction, showManualForm, setShowManualForm, showImportModal, setShowImportModal,
  addManual, onAddCategory, handleFile, isImporting, pushToast, onBulkDelete, onBulkChangeCategory,
  recentImportIds = [], onClearRecentImports, duplicateIds, onOpenConciliacion, reconcileStats, onToggleSubscription,
}) {
  const [exportingBackup, setExportingBackup] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  // se calcula una sola vez acá arriba y se pasa a cada TxRow — antes cada
  // fila llamaba useIsMobile() por su cuenta, lo que con una lista larga
  // significaba un listener de matchMedia por fila en vez de uno solo.
  const isMobile = useIsMobile();
  // filtro opcional para revisar SOLO lo que trajo la última importación,
  // sin tener que buscarlo a mano en la lista completa.
  const [onlyRecent, setOnlyRecent] = useState(false);
  const recentSet = useMemo(() => new Set(recentImportIds), [recentImportIds]);
  const visibleTx = onlyRecent ? filteredTx.filter((t) => recentSet.has(t.id)) : filteredTx;

  // si el usuario borra o el filtro deja de tener sentido (nada seleccionable
  // porque ya no queda ningún movimiento reciente a la vista), se apaga solo.
  useEffect(() => {
    if (onlyRecent && recentImportIds.length === 0) setOnlyRecent(false);
  }, [onlyRecent, recentImportIds.length]);

  // Selección múltiple: por ahora solo rastrea IDs elegidos (base para
  // futuras acciones masivas — categorizar/borrar en lote, etc.), sin
  // ninguna acción real todavía.
  const [selectedIds, setSelectedIds] = useState([]);
  const selectAllRef = useRef(null);

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const visibleIds = visibleTx.map((t) => t.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const someVisibleSelected = visibleIds.some((id) => selectedIds.includes(id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  // el estado "indeterminado" (algunas, no todas) del checkbox nativo solo
  // se puede setear vía DOM, no existe como prop de React
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someVisibleSelected && !allVisibleSelected;
  }, [someVisibleSelected, allVisibleSelected]);

  // acciones masivas: onBulkDelete/onBulkChangeCategory ya hablan con
  // Supabase (vía persistTx en App.jsx) y devuelven si funcionó o no —
  // aquí solo se limpia la selección cuando la acción realmente terminó bien.
  const handleBulkDelete = async () => {
    const count = selectedIds.length;
    const ok = await onBulkDelete(selectedIds);
    if (ok) {
      pushToast?.("ok", `${count} movimiento${count === 1 ? "" : "s"} eliminado${count === 1 ? "" : "s"}.`);
      setSelectedIds([]);
    } else {
      pushToast?.("error", "No se pudo borrar. Revisa tu conexión e inténtalo de nuevo.");
    }
    return ok;
  };

  const handleBulkCategoryChange = async (categoryId) => {
    const count = selectedIds.length;
    const ok = await onBulkChangeCategory(selectedIds, categoryId);
    if (ok) {
      pushToast?.("ok", `Categoría actualizada en ${count} movimiento${count === 1 ? "" : "s"}.`);
      setSelectedIds([]);
    } else {
      pushToast?.("error", "No se pudo cambiar la categoría. Revisa tu conexión e inténtalo de nuevo.");
    }
    return ok;
  };

  const handleExportBackup = async () => {
    if (exportingBackup) return;
    setExportingBackup(true);
    try {
      await exportBackup();
    } catch (e) {
      console.error(e);
      pushToast?.("error", "No se pudo generar el respaldo. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setExportingBackup(false);
    }
  };

  const handleExportCsv = async () => {
    if (exportingCsv) return;
    setExportingCsv(true);
    try {
      await exportCsv();
    } catch (e) {
      console.error(e);
      pushToast?.("error", "No se pudo generar el CSV. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setExportingCsv(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <button
          onClick={handleExportCsv}
          disabled={exportingCsv}
          title="Descarga tus movimientos en .csv, para abrir en Excel o Sheets"
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8,
            border: `1px solid ${TOKENS.border}`, background: TOKENS.surface, color: TOKENS.textMuted,
            fontSize: 12, cursor: exportingCsv ? "default" : "pointer", opacity: exportingCsv ? 0.7 : 1,
          }}
        >
          {exportingCsv ? <Loader2 size={13} className="spin" /> : <FileSpreadsheet size={13} />}
          {exportingCsv ? "Generando CSV…" : "Exportar CSV"}
        </button>
        <button
          onClick={handleExportBackup}
          disabled={exportingBackup}
          title="Descarga un .json con todos tus movimientos y categorías"
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8,
            border: `1px solid ${TOKENS.border}`, background: TOKENS.surface, color: TOKENS.textMuted,
            fontSize: 12, cursor: exportingBackup ? "default" : "pointer", opacity: exportingBackup ? 0.7 : 1,
          }}
        >
          {exportingBackup ? <Loader2 size={13} className="spin" /> : <Download size={13} />}
          {exportingBackup ? "Generando respaldo…" : "Descargar respaldo"}
        </button>
      </div>

      {/* recién al primer uso: sin datos todavía, conviene la invitación grande
          a importar/agregar. Una vez que hay movimientos, esas dos áreas
          gigantes solo ocupan espacio — se reemplazan por botones compactos
          junto a la búsqueda. */}
      {!hasTransactions && (
        <div className="form-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
          <ImportDropzone onFile={handleFile} disabled={isImporting} />
          <button onClick={() => setShowManualForm(true)} style={{
            border: `1.5px solid ${TOKENS.border}`, borderRadius: 12, padding: "18px 16px", background: TOKENS.surface,
            display: "flex", alignItems: "center", gap: 12, cursor: "pointer", color: TOKENS.text, textAlign: "left",
          }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: TOKENS.surfaceAlt, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Plus size={16} color={TOKENS.pending} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Agregar gasto o ingreso manual</div>
              <div style={{ fontSize: 11.5, color: TOKENS.textFaint }}>Para movimientos que aún no aparecen en el banco</div>
            </div>
          </button>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        {hasTransactions && (
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
            <input
              ref={selectAllRef}
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleSelectAll}
              disabled={visibleTx.length === 0}
              aria-label={allVisibleSelected ? "Deseleccionar todo" : "Seleccionar todo"}
              title={allVisibleSelected ? "Deseleccionar todo" : "Seleccionar todo"}
              style={{ accentColor: TOKENS.accent, cursor: filteredTx.length === 0 ? "default" : "pointer", width: 18, height: 18 }}
            />
            {selectedIds.length > 0 && (
              <span style={{ fontSize: 12, color: TOKENS.textMuted, whiteSpace: "nowrap" }}>
                {selectedIds.length} seleccionado{selectedIds.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
        )}
        <div style={{ position: "relative", flex: "1 1 220px" }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar movimiento…"
            style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${TOKENS.border}`, background: TOKENS.surface, color: TOKENS.text, fontSize: 13 }}
          />
        </div>
        <div style={{ flex: "0 1 200px", minWidth: 160 }}>
          <CategorySelect
            categories={categories}
            value={catFilter}
            onChange={(v) => { setCatFilter(v); setTxTypeFilter?.("all"); }}
            allOption={{ value: "all", label: "Todas las categorías" }}
          />
        </div>
        {setSourceFilter && (
          <div style={{ flex: "0 1 160px", minWidth: 140 }}>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              style={{
                width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${TOKENS.border}`,
                background: TOKENS.surface, color: TOKENS.text, fontSize: 13, cursor: "pointer",
              }}
              aria-label="Filtrar por origen del movimiento"
              title="Filtrar por origen: manual o banco"
            >
              <option value="all">Manual y banco</option>
              <option value="manual">Solo manuales</option>
              <option value="bank">Solo del banco</option>
            </select>
          </div>
        )}
        {txTypeFilter !== "all" && (
          <button
            onClick={() => setTxTypeFilter?.("all")}
            title="Quitar filtro de tipo de movimiento"
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", borderRadius: 8,
              border: `1px solid ${txTypeFilter === "income" ? TOKENS.income : TOKENS.expense}`,
              background: txTypeFilter === "income" ? "var(--tint-income)" : "var(--tint-expense)",
              color: txTypeFilter === "income" ? TOKENS.income : TOKENS.expense, fontSize: 12.5, cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            {txTypeFilter === "income" ? "Solo ingresos" : "Solo gastos"} <X size={12} />
          </button>
        )}
        {hasTransactions && (
          <>
            <button
              onClick={() => setShowImportModal(true)}
              disabled={isImporting}
              style={{ ...actionBtnStyle, cursor: isImporting ? "default" : "pointer", opacity: isImporting ? 0.6 : 1 }}
              title={isImporting ? "Ya hay una importación en curso…" : "Importar movimientos del banco desde un .xls o una cartola .pdf"}
            >
              {isImporting ? <Loader2 size={13} className="spin" /> : <Upload size={13} />} Importar Excel
            </button>
            <button onClick={() => setShowManualForm((v) => !v)} className="new-record-btn" style={actionBtnStyle} title="Agregar un gasto o ingreso manual">
              <Plus size={13} /> Nuevo registro
            </button>
            {onOpenConciliacion && (
              <button onClick={onOpenConciliacion} style={actionBtnStyle} title="Revisar y conciliar movimientos manuales contra el reporte del banco">
                <ScanLine size={13} /> Conciliación
                {reconcileStats?.manuals?.length > 0 && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 16, height: 16, padding: "0 4px",
                    borderRadius: 999, background: TOKENS.pending, color: TOKENS.bg, fontSize: 10, fontWeight: 700,
                  }}>
                    {reconcileStats.manuals.length}
                  </span>
                )}
              </button>
            )}
          </>
        )}
      </div>

      {recentImportIds.length > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10,
          background: "var(--tint-accent-soft)", border: `1px solid ${TOKENS.accent}`, marginBottom: 14, flexWrap: "wrap",
        }}>
          <Sparkles size={14} color={TOKENS.accent} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 12.5, color: TOKENS.text, flex: "1 1 160px" }}>
            {recentImportIds.length} movimiento{recentImportIds.length === 1 ? "" : "s"} importado{recentImportIds.length === 1 ? "" : "s"} recién — marcado{recentImportIds.length === 1 ? "" : "s"} como "nuevo" abajo
          </span>
          <button
            onClick={() => setOnlyRecent((v) => !v)}
            style={{
              padding: "6px 10px", borderRadius: 7, border: `1px solid ${TOKENS.accent}`, fontSize: 12, cursor: "pointer",
              background: onlyRecent ? TOKENS.accent : "transparent", color: onlyRecent ? TOKENS.bg : TOKENS.accent, fontWeight: 600,
            }}
          >
            {onlyRecent ? "Ver todos" : "Ver solo estos"}
          </button>
          <button
            onClick={onClearRecentImports}
            aria-label="Descartar aviso de importación reciente"
            title="Descartar"
            style={{ background: "none", border: "none", color: TOKENS.textFaint, cursor: "pointer", padding: 4 }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {showManualForm && <ManualForm categories={categories} onClose={() => setShowManualForm(false)} onSubmit={addManual} onAddCategory={onAddCategory} />}

      {showImportModal && (
        <ImportModal onClose={() => setShowImportModal(false)} onFile={(f) => { handleFile(f); setShowImportModal(false); }} />
      )}

      <div style={{ background: TOKENS.surface, border: `1px solid ${TOKENS.border}`, borderRadius: 12, overflow: "hidden" }}>
        {visibleTx.length === 0 ? (
          !hasTransactions ? (
            <EmptyState
              icon={Inbox}
              title="Todavía no hay movimientos"
              text="Sube el .xls o la cartola .pdf de tu banco, o agrega un gasto o ingreso manual (arriba), para empezar a ver tus finanzas aquí."
            />
          ) : onlyRecent ? (
            <EmptyState
              icon={SearchX}
              title="Sin resultados"
              text="Ninguno de los movimientos recién importados coincide con tu búsqueda o filtro de categoría."
              action={
                <button onClick={() => { setSearch(""); setCatFilter("all"); setTxTypeFilter?.("all"); setSourceFilter?.("all"); }} style={{
                  padding: "7px 14px", borderRadius: 8, border: `1px solid ${TOKENS.border}`, background: "transparent",
                  color: TOKENS.textMuted, fontSize: 12.5, cursor: "pointer",
                }}>
                  Limpiar filtros
                </button>
              }
            />
          ) : search || catFilter !== "all" || txTypeFilter !== "all" || sourceFilter !== "all" ? (
            <EmptyState
              icon={SearchX}
              title="Sin resultados"
              text="Ningún movimiento coincide con tu búsqueda o filtro de categoría."
              action={
                <button onClick={() => { setSearch(""); setCatFilter("all"); setTxTypeFilter?.("all"); setSourceFilter?.("all"); }} style={{
                  padding: "7px 14px", borderRadius: 8, border: `1px solid ${TOKENS.border}`, background: "transparent",
                  color: TOKENS.textMuted, fontSize: 12.5, cursor: "pointer",
                }}>
                  Limpiar filtros
                </button>
              }
            />
          ) : (
            <EmptyState
              icon={CalendarX2}
              title="Sin movimientos este mes"
              text="Prueba seleccionando 'Todo' en los meses de arriba, o sube el reporte del banco para este período."
            />
          )
        ) : (
          groupByDate(visibleTx).map((group) => (
            <div key={group.date}>
              <div
                style={{
                  padding: "9px 16px", fontSize: 11, fontWeight: 600, color: TOKENS.textFaint,
                  textTransform: "uppercase", letterSpacing: "0.03em", background: TOKENS.surfaceAlt,
                  borderBottom: `1px solid ${TOKENS.border}`,
                }}
              >
                {formatDayHeading(group.date)}
              </div>
              {group.items.map((t, i) => (
                <TxRow
                  key={t.id}
                  t={t}
                  isLast={i === group.items.length - 1}
                  categories={categories}
                  getCat={getCat}
                  saveTxEdit={saveTxEdit}
                  onDelete={deleteTransaction}
                  selected={selectedIds.includes(t.id)}
                  onToggleSelect={toggleSelectOne}
                  isRecent={recentSet.has(t.id)}
                  isDuplicate={duplicateIds?.has(t.id)}
                  isMobile={isMobile}
                  onToggleSubscription={onToggleSubscription}
                />
              ))}
            </div>
          ))
        )}
      </div>

      {selectedIds.length > 0 && (
        <BulkActionsBar
          count={selectedIds.length}
          categories={categories}
          onDelete={handleBulkDelete}
          onChangeCategory={handleBulkCategoryChange}
          onClose={() => setSelectedIds([])}
        />
      )}
    </div>
  );
}

// Barra flotante contextual: solo existe mientras hay algo seleccionado.
// "Cambiar categoría" dispara la acción apenas el usuario elige una
// categoría, en vez de un botón + dropdown separados — menos clics, mismo
// resultado.
function BulkActionsBar({ count, categories, onDelete, onChangeCategory, onClose }) {
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pickedCategory, setPickedCategory] = useState("");

  const handleDeleteClick = async () => {
    setBusy(true);
    try {
      await onDelete();
    } finally {
      setBusy(false);
      setConfirmingDelete(false);
    }
  };

  const handleCategorySelect = async (categoryId) => {
    if (!categoryId) return;
    setBusy(true);
    try {
      await onChangeCategory(categoryId);
    } finally {
      setBusy(false);
      setPickedCategory("");
    }
  };

  return (
    <div
      className="bulk-action-bar"
      style={{
        position: "fixed", left: "50%", bottom: 20, transform: "translateX(-50%)", zIndex: 1500,
        display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12,
        background: TOKENS.surfaceAlt, border: `1px solid ${TOKENS.border}`,
        boxShadow: "0 10px 28px rgba(0,0,0,0.4)", maxWidth: "calc(100vw - 28px)", flexWrap: "wrap", justifyContent: "center",
      }}
    >
      <span style={{ fontSize: 12.5, fontWeight: 600, color: TOKENS.text, whiteSpace: "nowrap" }}>
        {count} seleccionado{count === 1 ? "" : "s"}
      </span>

      <div style={{ width: 190 }}>
        <CategorySelect
          categories={categories}
          value={pickedCategory}
          onChange={(v) => { setPickedCategory(v); handleCategorySelect(v); }}
          disabled={busy}
          placeholder="Cambiar categoría…"
        />
      </div>

      {confirmingDelete ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: TOKENS.textMuted }}>¿Seguro?</span>
          <button
            onClick={handleDeleteClick}
            disabled={busy}
            style={{
              display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 7, border: "none",
              background: TOKENS.expense, color: "#fff", fontSize: 12, fontWeight: 600, cursor: busy ? "default" : "pointer",
            }}
          >
            {busy ? <Loader2 size={12} className="spin" /> : "Confirmar"}
          </button>
          <button
            onClick={() => setConfirmingDelete(false)}
            disabled={busy}
            style={{ padding: "6px 10px", borderRadius: 7, border: `1px solid ${TOKENS.border}`, background: "transparent", color: TOKENS.textMuted, fontSize: 12, cursor: "pointer" }}
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirmingDelete(true)}
          disabled={busy}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: "none",
            background: "var(--tint-expense)", color: TOKENS.expense, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
          }}
        >
          <Trash2 size={13} /> Borrar seleccionados
        </button>
      )}

      <button
        onClick={onClose}
        disabled={busy}
        aria-label="Cerrar selección"
        title="Cerrar selección"
        style={{ background: "none", border: "none", color: TOKENS.textFaint, cursor: "pointer", padding: 4 }}
      >
        <X size={15} />
      </button>
    </div>
  );
}

// Zona de drag & drop para el .xls del banco — se usa tanto en la invitación
// grande de primer uso como dentro del modal de importar (mismo componente,
// misma lógica, para no duplicar el manejo de drag/drop).
function ImportDropzone({ onFile, disabled }) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <label
      onDragOver={(e) => { if (disabled) return; e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (disabled) return;
        const f = e.dataTransfer.files[0];
        if (f) onFile(f);
      }}
      style={{
        border: `1.5px dashed ${dragOver ? TOKENS.accent : TOKENS.border}`, borderRadius: 12, padding: "18px 16px",
        display: "flex", alignItems: "center", gap: 12, cursor: disabled ? "default" : "pointer",
        background: dragOver ? "var(--tint-accent-soft)" : TOKENS.surface, opacity: disabled ? 0.6 : 1,
      }}
    >
      <input type="file" accept=".xls,.xlsx,.pdf" disabled={disabled} style={{ display: "none" }} onChange={(e) => e.target.files[0] && onFile(e.target.files[0])} />
      <div style={{ width: 34, height: 34, borderRadius: 8, background: TOKENS.surfaceAlt, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {disabled ? <Loader2 size={16} color={TOKENS.accent} className="spin" /> : <Upload size={16} color={TOKENS.accent} />}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{disabled ? "Procesando archivo…" : "Subir movimientos del banco"}</div>
        <div style={{ fontSize: 11.5, color: TOKENS.textFaint }}>
          {disabled ? "Espera a que termine antes de subir otro." : "Arrastra el .xls de reportCollection o la cartola en .pdf, o haz clic para elegirlo"}
        </div>
      </div>
    </label>
  );
}

function ImportModal({ onClose, onFile }) {
  return (
    <div className="modal-backdrop" style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 2000, padding: 20,
    }}>
      <div className="modal-panel" style={{
        background: TOKENS.surface, border: `1px solid ${TOKENS.border}`, borderRadius: 16,
        padding: 22, maxWidth: 420, width: "100%",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div className="display" style={{ fontSize: 14.5, fontWeight: 600 }}>Importar movimientos</div>
          <button onClick={onClose} aria-label="Cerrar" title="Cerrar" style={{ background: "none", border: "none", color: TOKENS.textFaint, cursor: "pointer" }}>
            <X size={16} />
          </button>
        </div>
        <ImportDropzone onFile={onFile} />
      </div>
    </div>
  );
}

function TxRow({ t, isLast, categories, getCat, saveTxEdit, onDelete, selected, onToggleSelect, isRecent, isDuplicate, isMobile, onToggleSubscription }) {
  const [editing, setEditing] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const cat = getCat(t.category);
  const CatIcon = cat.icon;
  const swipeControls = useAnimation();
  const closeSwipe = () => swipeControls.start({ x: 0, transition: { duration: 0.18 } });

  // espera a que termine la animación de colapso antes de sacarla del estado
  const handleDelete = () => {
    closeSwipe();
    setLeaving(true);
    setTimeout(() => onDelete(t.id), 220);
  };

  const handleDragEnd = (_e, info) => {
    if (info.offset.x < -SWIPE_ACTION_WIDTH / 2) swipeControls.start({ x: -SWIPE_ACTION_WIDTH, transition: { duration: 0.18 } });
    else closeSwipe();
  };

  const RowGrid = isMobile ? motion.div : "div";

  return (
    <div style={{ borderBottom: isLast ? "none" : `1px solid ${TOKENS.border}` }}>
      <div
        className={`tx-row-wrap tx-row-enter${leaving ? " tx-row-leaving" : ""}`}
      >
      <div className="tx-swipe-clip">
        {isMobile && (
          <div className="tx-swipe-actions" style={{ width: SWIPE_ACTION_WIDTH }}>
            <button
              className="tx-swipe-btn tx-swipe-edit"
              onClick={() => { closeSwipe(); setEditing((v) => !v); }}
              aria-label={editing ? "Cerrar edición" : "Editar movimiento"}
              title="Editar"
            >
              <Pencil size={16} />
            </button>
            <div className="tx-swipe-btn tx-swipe-delete">
              <ConfirmDeleteButton onConfirm={handleDelete} text="¿Eliminar este movimiento?" title="Eliminar movimiento" size={16} color="#fff" />
            </div>
          </div>
        )}
        <RowGrid
          className="txrow-grid"
          style={{
            display: "grid", gridTemplateColumns: "20px 1fr 170px 130px auto", alignItems: "center", gap: 10,
            padding: "11px 16px", background: TOKENS.surface, touchAction: "pan-y", position: "relative",
            boxShadow: isRecent ? `inset 3px 0 0 ${TOKENS.accent}` : "none",
          }}
          // el swipe-to-action solo existe en mobile — en desktop esta fila
          // es un <div> normal, sin el overhead de framer-motion por fila
          // (con listas largas, montar motion.div en todas las filas se
          // notaba al hacer scroll aunque el drag estuviera desactivado).
          {...(isMobile ? {
            drag: "x",
            dragConstraints: { left: -SWIPE_ACTION_WIDTH, right: 0 },
            dragElastic: 0.06,
            animate: swipeControls,
            onDragEnd: handleDragEnd,
          } : {})}
        >
        <div className="tx-check">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(t.id)}
            aria-label={`Seleccionar movimiento: ${t.alias || t.description}`}
            style={{ accentColor: TOKENS.accent, cursor: "pointer", width: 18, height: 18 }}
          />
        </div>
        <div className="tx-desc" style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {t.alias ? (
            <>
              <span style={{ fontWeight: 500 }}>{t.alias}</span>
              <span style={{ color: TOKENS.textFaint, fontSize: 11.5 }}> · {t.description}</span>
            </>
          ) : t.description}
          <span style={{ marginLeft: 8, fontSize: 10, color: TOKENS.textFaint, border: `1px solid ${TOKENS.border}`, borderRadius: 4, padding: "1px 5px" }}>
            {t.source === "bank" ? "banco" : "manual"}
          </span>
          {isRecent && (
            <span style={{ marginLeft: 5, fontSize: 10, color: TOKENS.accent, border: `1px solid ${TOKENS.accent}`, borderRadius: 4, padding: "1px 5px", fontWeight: 600 }}>
              nuevo
            </span>
          )}
          {isDuplicate && (
            <span
              title="Hay otro movimiento con el mismo monto y una fecha muy cercana — revisa que no sea el mismo gasto anotado dos veces (uno a mano y otro del banco, por ejemplo)."
              style={{ marginLeft: 5, fontSize: 10, color: TOKENS.pending, border: `1px solid ${TOKENS.pending}`, borderRadius: 4, padding: "1px 5px", fontWeight: 600 }}
            >
              posible duplicado
            </span>
          )}
        </div>
        <div className="tx-cat" style={{ fontSize: 11.5, color: cat.color, display: "flex", alignItems: "center", gap: 6, overflow: "hidden" }}>
          <span style={{
            width: 20, height: 20, borderRadius: 6, background: `${cat.color}22`, display: "flex",
            alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <CatIcon size={12} color={cat.color} />
          </span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat.label}</span>
        </div>
        <div className="tx-amount mono" style={{ fontSize: 13, textAlign: "right", fontWeight: 500, color: t.amount >= 0 ? TOKENS.income : TOKENS.expense }}>
          {formatCLP(t.amount)}
        </div>
        <div className="tx-actions" style={{ display: "flex" }}>
          <button onClick={() => setEditing((v) => !v)} aria-label={editing ? "Cerrar edición" : "Editar movimiento"} title="Editar" style={{ background: "none", border: "none", cursor: "pointer", color: editing ? TOKENS.accent : TOKENS.textFaint, padding: 8 }}>
            <Pencil size={13} />
          </button>
          <ConfirmDeleteButton onConfirm={handleDelete} text="¿Eliminar este movimiento?" title="Eliminar movimiento" size={13} />
        </div>
        <ChevronLeft size={13} className="tx-swipe-hint" />
        </RowGrid>
      </div>
      </div>
      {editing && (
        <TxEditPanel
          t={t}
          categories={categories}
          onSave={(payload) => { saveTxEdit(t.id, payload); setEditing(false); }}
          onCancel={() => setEditing(false)}
          onToggleSubscription={onToggleSubscription ? (checked) => onToggleSubscription(t.id, checked) : undefined}
        />
      )}
    </div>
  );
}

function TxEditPanel({ t, categories, onSave, onCancel, onToggleSubscription }) {
  // solo se ofrecen categorías del mismo tipo que el monto (ingreso/gasto),
  // para no mezclar "Comida" con "Sueldo" en el mismo selector — incluida
  // la que ya tenía asignada, si esa categoría cambió de tipo después (o si
  // el movimiento quedó mal categorizado, como un reembolso que un import
  // automático cayó en la de gasto): en ese caso no se la mantiene como
  // opción, se obliga a elegir una de verdad para no dejar pasar el error.
  const txType = t.amount >= 0 ? "income" : "expense";
  const relevantCategories = categories.filter((c) => categoryMatchesType(c, txType));
  const currentMatchesType = relevantCategories.some((c) => c.id === t.category);

  const [category, setCategory] = useState(currentMatchesType ? t.category : "");
  const [alias, setAlias] = useState(t.alias || "");
  const [remember, setRemember] = useState(t.source === "bank");
  const [matchText, setMatchText] = useState(suggestMatchKey(t.description));

  return (
    <div style={{ background: TOKENS.surfaceAlt, padding: "14px 16px", borderTop: `1px solid ${TOKENS.border}` }}>
      <div className="form-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 11, color: TOKENS.textFaint, marginBottom: 4 }}>Categoría</div>
          <CategorySelect
            categories={relevantCategories}
            value={category}
            onChange={setCategory}
            placeholder="Elige la categoría correcta…"
          />
        </div>
        <div>
          <div style={{ fontSize: 11, color: TOKENS.textFaint, marginBottom: 4 }}>Nombre para mostrar (opcional)</div>
          <input value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="Ej: Claude" style={{ width: "100%", padding: "7px 9px", borderRadius: 7, border: `1px solid ${TOKENS.border}`, background: TOKENS.surface, color: TOKENS.text, fontSize: 12.5 }} />
        </div>
      </div>

      {t.amount < 0 && onToggleSubscription && (
        <div style={{ marginBottom: 10 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: TOKENS.textMuted, cursor: "pointer" }}>
            <input type="checkbox" checked={!!t.subscriptionId} onChange={(e) => onToggleSubscription(e.target.checked)} />
            ¿Es suscripción?
          </label>
          {t.subscriptionId && (
            <div style={{ fontSize: 10.5, color: TOKENS.textFaint, marginTop: 3, marginLeft: 23 }}>
              Va a aparecer en la pestaña Suscripciones y a generarse solo los meses siguientes.
            </div>
          )}
        </div>
      )}

      {t.source === "bank" && (
        <div style={{ marginBottom: 10 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: TOKENS.textMuted, marginBottom: remember ? 7 : 0, cursor: "pointer" }}>
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Recordar esto para futuros movimientos con una descripción parecida
          </label>
          {remember && (
            <div>
              <div style={{ fontSize: 10.5, color: TOKENS.textFaint, marginBottom: 3 }}>Se aplicará a movimientos cuya descripción contenga:</div>
              <input value={matchText} onChange={(e) => setMatchText(e.target.value)} className="mono" style={{ width: "100%", padding: "7px 9px", borderRadius: 7, border: `1px solid ${TOKENS.border}`, background: TOKENS.surface, color: TOKENS.accent, fontSize: 11.5 }} />
            </div>
          )}
        </div>
      )}

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

function ManualForm({ categories, onClose, onSubmit, onAddCategory }) {
  const [type, setType] = useState("expense");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("otros");
  const [addingCategory, setAddingCategory] = useState(false);

  // solo se ofrecen categorías del tipo elegido (gasto/ingreso), para no
  // mezclar "Comida" con "Sueldo" en la misma grilla.
  const relevantCategories = categories.filter((c) => categoryMatchesType(c, type));

  useEffect(() => {
    if (!relevantCategories.some((c) => c.id === category)) {
      setCategory(relevantCategories[0]?.id || "otros");
    }
    setAddingCategory(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const submit = () => {
    const amt = parseFloat(amount);
    if (!description || !amt || amt <= 0) return;
    onSubmit({ type, date, description, amount: amt, category });
  };

  return (
    <div
      onClick={onClose}
      className="modal-backdrop"
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex",
        alignItems: "center", justifyContent: "center", zIndex: 2000, padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-panel"
        style={{
          background: TOKENS.surface, border: `1px solid ${TOKENS.border}`, borderRadius: 16,
          maxWidth: 440, width: "100%", maxHeight: "88vh", display: "flex", flexDirection: "column", overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 20px 0", flexShrink: 0 }}>
          <div className="display" style={{ fontSize: 14.5, fontWeight: 600 }}>Nuevo movimiento</div>
          <button onClick={onClose} aria-label="Cerrar" title="Cerrar" style={{ background: "none", border: "none", color: TOKENS.textFaint, cursor: "pointer" }}><X size={16} /></button>
        </div>

        <div style={{
          display: "flex", gap: 3, padding: 3, margin: "14px 20px 0", borderRadius: 999, boxSizing: "border-box",
          background: TOKENS.surfaceAlt, border: `1px solid ${TOKENS.border}`, flexShrink: 0,
        }}>
          {["expense", "income"].map((v) => (
            <button key={v} onClick={() => setType(v)} style={{
              flex: "1 1 0", minWidth: 0, padding: "8px 0", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none",
              background: type === v ? (v === "expense" ? TOKENS.expense : TOKENS.income) : "transparent",
              color: type === v ? TOKENS.bg : TOKENS.textMuted,
              textAlign: "center",
              transition: "background 150ms ease, color 150ms ease",
            }}>
              {v === "expense" ? "Gasto" : "Ingreso"}
            </button>
          ))}
        </div>

        <div style={{ padding: "16px 20px", overflowY: "auto", flex: "1 1 auto", minHeight: 260 }}>
          <div style={{ fontSize: 11, color: TOKENS.textFaint, marginBottom: 10 }}>Categoría</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {relevantCategories.map((c) => {
              const CatIcon = resolveCategoryIcon(c);
              const selected = category === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => { setCategory(c.id); setAddingCategory(false); }}
                  aria-pressed={selected}
                  title={c.label}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", padding: 2 }}
                >
                  <div style={{
                    width: 46, height: 46, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                    background: selected ? c.color : `${c.color}22`,
                    boxShadow: selected ? `0 0 0 2px ${c.color}` : "none",
                  }}>
                    <CatIcon size={19} color={selected ? TOKENS.bg : c.color} />
                  </div>
                  <div style={{
                    fontSize: 10.5, color: selected ? TOKENS.text : TOKENS.textMuted, textAlign: "center", lineHeight: 1.2,
                    overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                  }}>
                    {c.label}
                  </div>
                </button>
              );
            })}
            {onAddCategory && (
              <button
                onClick={() => setAddingCategory((v) => !v)}
                aria-pressed={addingCategory}
                aria-expanded={addingCategory}
                title="Crear categoría nueva"
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", padding: 2 }}
              >
                <div style={{
                  width: 46, height: 46, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  background: addingCategory ? TOKENS.accent : "transparent",
                  border: `1.5px dashed ${addingCategory ? TOKENS.accent : TOKENS.border}`,
                }}>
                  <Plus size={19} color={addingCategory ? TOKENS.bg : TOKENS.textFaint} />
                </div>
                <div style={{ fontSize: 10.5, color: TOKENS.textMuted, textAlign: "center", lineHeight: 1.2 }}>
                  Nueva
                </div>
              </button>
            )}
          </div>

          {addingCategory && onAddCategory && (
            <CategoryQuickAdd
              type={type}
              onAdd={(id) => { setCategory(id); setAddingCategory(false); }}
              onAddCategory={onAddCategory}
              onCancel={() => setAddingCategory(false)}
            />
          )}
        </div>

        <div style={{ padding: "14px 20px", borderTop: `1px solid ${TOKENS.border}`, background: TOKENS.surfaceAlt, flexShrink: 0 }}>
          <div className="form-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <FieldInput label="Fecha" type="date" value={date} onChange={setDate} />
            <FieldInput label="Monto (CLP)" type="number" value={amount} onChange={setAmount} placeholder="0" />
          </div>
          <FieldInput label="Descripción" value={description} onChange={setDescription} style={{ marginBottom: 12 }} />
          <button onClick={submit} style={{ width: "100%", padding: "11px 0", borderRadius: 8, border: "none", cursor: "pointer", background: TOKENS.accent, color: TOKENS.bg, fontWeight: 600, fontSize: 13.5 }}>
            Guardar movimiento
          </button>
        </div>
      </div>
    </div>
  );
}
