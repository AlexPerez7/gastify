import { useState, useRef, useEffect, useMemo } from "react";
import { motion, useAnimation } from "framer-motion";
import { Upload, Plus, Pencil, X, Copy, AlertTriangle, ChevronRight, Inbox, SearchX, CalendarX2, Download, FileSpreadsheet, Loader2, Trash2, Sparkles, Check, ScanLine, SlidersHorizontal, Landmark, PenLine, Wallet, CreditCard as CreditCardIcon } from "lucide-react";
import { TOKENS, resolveCategoryIcon, categoryMatchesType } from "../lib/constants.js";
import { formatCLP, suggestMatchKey, groupByDate, formatDayHeading, localIsoDate } from "../lib/utils.js";
import { EMPTY_AMOUNT_RANGE, isAmountRangeActive } from "../lib/stats.js";
import { entryFromTransaction } from "../lib/transactionOps.js";
import { EmptyState, FieldInput, CategoryQuickAdd, CategorySelect, Modal } from "./Shared.jsx";
import { BTN_PRIMARY, BTN_GHOST, pillClass } from "./classes.js";
import { CreditCard } from "./CreditCard.jsx";
import { useIsMobile } from "../hooks/useIsMobile.js";
import { useLongPress } from "../hooks/useLongPress.js";

const SWIPE_ACTION_WIDTH = 128; // ancho de los 2 botones (editar + borrar) revelados al deslizar

// Lista por tandas: con "Todo" y años de historial se montaban miles de filas
// (cada una con motion.div en mobile). Medido con 2.000 filas en un teléfono
// simulado: 1–3 s por tecla al buscar y 12 s al volver a la lista completa.
// Se montan LIST_PAGE filas y se suman más al acercarse al final del scroll.
const LIST_PAGE = 100;

// botón de acción de la barra de herramientas de Movimientos
const ACTION_BTN =
  "flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-surface text-muted text-body cursor-pointer whitespace-nowrap";

export function Movimientos({
  filteredTx, frequentEntries = [], hasTransactions, categories, getCat, search, setSearch, catFilter, setCatFilter,
  txTypeFilter = "all", setTxTypeFilter,
  sourceFilter = "all", setSourceFilter,
  amountRange = EMPTY_AMOUNT_RANGE, setAmountRange,
  saveTxEdit, deleteTransaction, showManualForm, setShowManualForm, showImportModal, setShowImportModal,
  addManual, onAddCategory, handleFile, isImporting, pushToast, onBulkDelete, onBulkChangeCategory,
  recentImportIds = [], onClearRecentImports, duplicateIds, onOpenConciliacion, reconcileStats, onToggleSubscription,
  exportingCsv, exportingBackup, onExportCsv, onExportBackup,
  // tarjeta de crédito (CMR) — dataset y handlers separados de los de
  // débito de arriba, ver App.jsx (nunca se mezclan).
  creditTx = [], creditMonths = [], currentCreditMonth = "", onSetCreditMonth,
  creditStats, saveCreditTxEdit, deleteCreditTransaction, handleCreditFile, isImportingCredit,
  creditStatement, handleCreditStatementFile, isImportingStatement,
  // "Débito" / "Crédito": vive en App.jsx (no local) para poder abrirse
  // directo en "Crédito" desde afuera (ver la card de la tarjeta en Resumen).
  viewMode, setViewMode,
}) {
  // en mobile, categoría/tipo/origen se agrupan en un bottom sheet detrás de
  // un solo botón de filtro (en vez de 3 selects apilados) — patrón típico
  // de apps mobile para no competir por ancho con la búsqueda.
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const amountActive = isAmountRangeActive(amountRange);
  const [showAmountModal, setShowAmountModal] = useState(false);
  const activeFilterCount =
    (catFilter !== "all" ? 1 : 0) + (txTypeFilter !== "all" ? 1 : 0) + (sourceFilter !== "all" ? 1 : 0) + (amountActive ? 1 : 0);
  const clearFilters = () => {
    setCatFilter("all"); setTxTypeFilter?.("all"); setSourceFilter?.("all"); setAmountRange?.(EMPTY_AMOUNT_RANGE);
  };
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
  // "Duplicar" desde el editor de una fila: abre el formulario de alta
  // precargado (con fecha de hoy), aparte del showManualForm de App.
  const [duplicateFrom, setDuplicateFrom] = useState(null);
  const selectAllRef = useRef(null);

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  // "visibles" = todo lo que pasa los filtros, montado o no todavía (ver
  // LIST_PAGE): "Seleccionar todo" sigue tomando la lista completa. Con Set:
  // con miles de filas, includes() dentro de every() era cuadrático.
  const visibleIds = visibleTx.map((t) => t.id);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id));
  const someVisibleSelected = visibleIds.some((id) => selectedSet.has(id));

  // cuántas filas montar. Vuelve a LIST_PAGE al cambiar la búsqueda, un
  // filtro o el mes (cambia el primer movimiento de la lista), pero NO al
  // editar o borrar una fila más abajo — si no, la lista se encogería bajo
  // el dedo. Se compara durante el render (patrón "estado derivado de
  // props") en vez de con un efecto, para no montar primero la lista larga.
  const listKey = [search, catFilter, txTypeFilter, sourceFilter, amountRange.min, amountRange.max, onlyRecent, visibleTx[0]?.id].join("|");
  const [page, setPage] = useState({ key: listKey, limit: LIST_PAGE });
  const limit = page.key === listKey ? page.limit : LIST_PAGE;
  const showMore = () => setPage({ key: listKey, limit: limit + LIST_PAGE });
  const renderedTx = visibleTx.length > limit ? visibleTx.slice(0, limit) : visibleTx;

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      const visibleSet = new Set(visibleIds);
      setSelectedIds((prev) => prev.filter((id) => !visibleSet.has(id)));
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
    const ok = await onBulkDelete(selectedIds);
    if (ok) {
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

  return (
    <div>
      <div className="flex gap-[3px] p-[3px] mb-4 rounded-full w-fit box-border bg-surface-alt border border-border">
        {[
          { v: "debito", label: "Débito", icon: Wallet },
          { v: "credito", label: "Crédito", icon: CreditCardIcon },
        ].map(({ v, label, icon: Icon }) => (
          <button
            key={v}
            onClick={() => setViewMode(v)}
            aria-pressed={viewMode === v}
            className={`flex items-center gap-1.5 px-3.5 py-[7px] rounded-full border-0 text-body font-semibold cursor-pointer ${
              viewMode === v ? "bg-accent text-bg" : "bg-transparent text-muted"
            }`}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {viewMode === "credito" ? (
        <CreditCard
          tx={creditTx}
          months={creditMonths}
          currentMonth={currentCreditMonth}
          onSetMonth={onSetCreditMonth}
          stats={creditStats}
          categories={categories}
          getCat={getCat}
          saveTxEdit={saveCreditTxEdit}
          onDelete={deleteCreditTransaction}
          onImportFile={handleCreditFile}
          isImporting={isImportingCredit}
          statement={creditStatement}
          onImportStatementFile={handleCreditStatementFile}
          isImportingStatement={isImportingStatement}
        />
      ) : (
      <>
      {/* en mobile, exportar/respaldar vive en el "⋮" de la fila de meses
          (arriba, junto a los chips de año) — acá solo queda en desktop,
          donde sí hay ancho de sobra para 2 botones sueltos. */}
      {!isMobile && (
        <div className="flex justify-end gap-2 mb-2.5 flex-wrap">
          <button
            onClick={onExportCsv}
            disabled={exportingCsv}
            title="Descarga tus movimientos en .csv, para abrir en Excel o Sheets"
            className="flex items-center gap-1.5 px-3 py-[7px] rounded-lg border border-border bg-surface text-muted text-small disabled:opacity-70 disabled:cursor-default enabled:cursor-pointer"
          >
            {exportingCsv ? <Loader2 size={13} className="spin" /> : <FileSpreadsheet size={13} />}
            {exportingCsv ? "Generando CSV…" : "Exportar CSV"}
          </button>
          <button
            onClick={onExportBackup}
            disabled={exportingBackup}
            title="Descarga un .json con todos tus movimientos y categorías"
            className="flex items-center gap-1.5 px-3 py-[7px] rounded-lg border border-border bg-surface text-muted text-small disabled:opacity-70 disabled:cursor-default enabled:cursor-pointer"
          >
            {exportingBackup ? <Loader2 size={13} className="spin" /> : <Download size={13} />}
            {exportingBackup ? "Generando respaldo…" : "Descargar respaldo"}
          </button>
        </div>
      )}

      {/* recién al primer uso: sin datos todavía, conviene la invitación grande
          a importar/agregar. Una vez que hay movimientos, esas dos áreas
          gigantes solo ocupan espacio — se reemplazan por botones compactos
          junto a la búsqueda. */}
      {!hasTransactions && (
        <div className="form-grid-2 grid grid-cols-2 gap-3.5 mb-5">
          <ImportDropzone onFile={handleFile} disabled={isImporting} />
          <button
            onClick={() => setShowManualForm(true)}
            className="border-[1.5px] border-border rounded-xl px-4 py-[18px] bg-surface flex items-center gap-3 cursor-pointer text-ink text-left"
          >
            <div className="w-[34px] h-[34px] rounded-lg bg-surface-alt flex items-center justify-center shrink-0">
              <Plus size={16} color={TOKENS.pending} />
            </div>
            <div>
              <div className="text-body font-medium">Agregar gasto o ingreso manual</div>
              <div className="text-small text-faint">Para movimientos que aún no aparecen en el banco</div>
            </div>
          </button>
        </div>
      )}

      <div className="flex gap-2.5 mb-3.5 flex-wrap items-center">
        {hasTransactions && (!isMobile || selectedIds.length > 0) && (
          <div className="flex items-center gap-[7px] shrink-0">
            <input
              ref={selectAllRef}
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleSelectAll}
              disabled={visibleTx.length === 0}
              aria-label={allVisibleSelected ? "Deseleccionar todo" : "Seleccionar todo"}
              title={allVisibleSelected ? "Deseleccionar todo" : "Seleccionar todo"}
              className="w-[18px] h-[18px]"
              style={{ accentColor: "var(--c-accent)", cursor: filteredTx.length === 0 ? "default" : "pointer" }}
            />
            {selectedIds.length > 0 && (
              <span className="text-small text-muted whitespace-nowrap">
                {selectedIds.length} seleccionado{selectedIds.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
        )}
        <div className="relative flex-[1_1_220px]">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar movimiento…"
            className="w-full px-2.5 py-2 rounded-lg border border-border bg-surface text-ink text-body"
          />
        </div>
        {isMobile ? (
          <>
            <button
              onClick={() => setShowFilterSheet(true)}
              aria-label="Filtros"
              title="Filtrar por categoría, tipo u origen"
              className={`${ACTION_BTN} relative !px-2.5`}
            >
              <SlidersHorizontal size={15} />
              {activeFilterCount > 0 && (
                <span className="absolute -top-[5px] -right-[5px] flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-accent text-bg text-micro font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>
            {onOpenConciliacion && (
              <button
                onClick={onOpenConciliacion}
                aria-label="Conciliación"
                title="Revisar y conciliar movimientos manuales contra el reporte del banco"
                className={`${ACTION_BTN} relative !px-2.5`}
              >
                <ScanLine size={15} />
                {reconcileStats?.manuals?.length > 0 && (
                  <span className="absolute -top-[5px] -right-[5px] flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-pending text-bg text-micro font-bold">
                    {reconcileStats.manuals.length}
                  </span>
                )}
              </button>
            )}
          </>
        ) : (
          <>
            <div className="flex-[0_1_200px] min-w-[160px]">
              <CategorySelect
                categories={categories}
                value={catFilter}
                onChange={(v) => { setCatFilter(v); setTxTypeFilter?.("all"); }}
                allOption={{ value: "all", label: "Todas las categorías" }}
              />
            </div>
            {setSourceFilter && (
              <div className="flex-[0_1_160px] min-w-[140px]">
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-lg border border-border bg-surface text-ink text-body cursor-pointer"
                  aria-label="Filtrar por origen del movimiento"
                  title="Filtrar por origen: manual o banco"
                >
                  <option value="all">Manual y banco</option>
                  <option value="manual">Solo manuales</option>
                  <option value="bank">Solo del banco</option>
                </select>
              </div>
            )}
            {setAmountRange && (
              <div className="flex">
                <button
                  onClick={() => setShowAmountModal(true)}
                  title="Filtrar por rango de monto"
                  className={`${ACTION_BTN} ${amountActive ? "!border-accent !text-accent rounded-r-none" : ""}`}
                >
                  {amountActive ? formatAmountRange(amountRange) : "Monto"}
                </button>
                {amountActive && (
                  <button
                    onClick={() => setAmountRange(EMPTY_AMOUNT_RANGE)}
                    aria-label="Quitar filtro de monto"
                    title="Quitar filtro de monto"
                    className={`${ACTION_BTN} !px-2 !border-accent !text-accent rounded-l-none border-l-0`}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )}
            {txTypeFilter !== "all" && (
              <button
                onClick={() => setTxTypeFilter?.("all")}
                title="Quitar filtro de tipo de movimiento"
                className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-body cursor-pointer whitespace-nowrap ${
                  txTypeFilter === "income" ? "border-income bg-tint-income text-income" : "border-expense bg-tint-expense text-expense"
                }`}
              >
                {txTypeFilter === "income" ? "Solo ingresos" : "Solo gastos"} <X size={12} />
              </button>
            )}
            {hasTransactions && (
              <>
                <button
                  onClick={() => setShowImportModal(true)}
                  disabled={isImporting}
                  className={`${ACTION_BTN} disabled:opacity-60 disabled:cursor-default`}
                  title={isImporting ? "Ya hay una importación en curso…" : "Importar movimientos del banco desde un .xls o una cartola .pdf"}
                >
                  {isImporting ? <Loader2 size={13} className="spin" /> : <Upload size={13} />} Importar Excel
                </button>
                <button onClick={() => setShowManualForm((v) => !v)} className={`new-record-btn ${ACTION_BTN}`} title="Agregar un gasto o ingreso manual">
                  <Plus size={13} /> Nuevo registro
                </button>
                {onOpenConciliacion && (
                  <button onClick={onOpenConciliacion} className={ACTION_BTN} title="Revisar y conciliar movimientos manuales contra el reporte del banco">
                    <ScanLine size={13} /> Conciliación
                    {reconcileStats?.manuals?.length > 0 && (
                      <span className="inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-pending text-bg text-micro font-bold">
                        {reconcileStats.manuals.length}
                      </span>
                    )}
                  </button>
                )}
              </>
            )}
          </>
        )}
      </div>

      {isMobile && showFilterSheet && (
        <FilterSheet
          categories={categories}
          catFilter={catFilter}
          setCatFilter={setCatFilter}
          txTypeFilter={txTypeFilter}
          setTxTypeFilter={setTxTypeFilter}
          sourceFilter={sourceFilter}
          setSourceFilter={setSourceFilter}
          amountRange={amountRange}
          setAmountRange={setAmountRange}
          activeFilterCount={activeFilterCount}
          onClear={clearFilters}
          onClose={() => setShowFilterSheet(false)}
        />
      )}

      {!isMobile && showAmountModal && setAmountRange && (
        <Modal title="Filtrar por monto" onClose={() => setShowAmountModal(false)}>
          <AmountRangeFields value={amountRange} onChange={setAmountRange} />
          <button onClick={() => setShowAmountModal(false)} className={`${BTN_PRIMARY} w-full mt-4`}>Listo</button>
        </Modal>
      )}

      {recentImportIds.length > 0 && (
        <div className="flex items-center gap-2.5 px-3 py-[9px] rounded-[10px] bg-tint-accent-soft border border-accent mb-3.5 flex-wrap">
          <Sparkles size={14} color={TOKENS.accent} className="shrink-0" />
          <span className="text-body text-ink flex-[1_1_160px]">
            {recentImportIds.length} movimiento{recentImportIds.length === 1 ? "" : "s"} importado{recentImportIds.length === 1 ? "" : "s"} recién — marcado{recentImportIds.length === 1 ? "" : "s"} como "nuevo" abajo
          </span>
          <button
            onClick={() => setOnlyRecent((v) => !v)}
            className={`px-2.5 py-1.5 rounded-[7px] border border-accent text-small cursor-pointer font-semibold ${
              onlyRecent ? "bg-accent text-bg" : "bg-transparent text-accent"
            }`}
          >
            {onlyRecent ? "Ver todos" : "Ver solo estos"}
          </button>
          <button
            onClick={onClearRecentImports}
            aria-label="Descartar aviso de importación reciente"
            title="Descartar"
            className="tap-expand bg-transparent border-0 text-faint cursor-pointer p-1"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* aviso de conciliación (n.º 18): en mobile la pestaña solo se
          alcanzaba por un ícono chico. Sale solo cuando hay algo que hacer —
          ya está la cartola del mes y algún manual no calzó —, no por cada
          manual recién anotado (esos esperan la cartola y es normal). */}
      {onOpenConciliacion && reconcileStats?.pendingMismatch?.length > 0 && (
        <button
          onClick={onOpenConciliacion}
          className="w-full flex items-center gap-2.5 px-3 py-[9px] rounded-[10px] bg-surface border border-pending mb-3.5 text-left cursor-pointer"
        >
          <AlertTriangle size={14} color={TOKENS.pending} className="shrink-0" />
          <span className="text-body text-ink flex-1 min-w-0">
            {reconcileStats.pendingMismatch.length} movimiento{reconcileStats.pendingMismatch.length === 1 ? "" : "s"} manual
            {reconcileStats.pendingMismatch.length === 1 ? " no calza" : "es no calzan"} con la cartola del banco
          </span>
          <span className="flex items-center gap-0.5 text-small font-semibold text-pending shrink-0">
            Revisar <ChevronRight size={14} />
          </span>
        </button>
      )}

      {showManualForm && !duplicateFrom && (
        <ManualForm
          categories={categories} frequent={frequentEntries} onAddCategory={onAddCategory}
          onClose={() => setShowManualForm(false)} onSubmit={addManual}
        />
      )}
      {duplicateFrom && (
        <ManualForm
          categories={categories} initial={duplicateFrom} onAddCategory={onAddCategory}
          onClose={() => setDuplicateFrom(null)}
          onSubmit={async (entry) => { await addManual(entry); setDuplicateFrom(null); }}
        />
      )}

      {showImportModal && (
        <ImportModal onClose={() => setShowImportModal(false)} onFile={(f) => { handleFile(f); setShowImportModal(false); }} />
      )}

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
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
                <button onClick={() => { setSearch(""); clearFilters(); }} className={BTN_GHOST}>
                  Limpiar filtros
                </button>
              }
            />
          ) : search || activeFilterCount > 0 ? (
            <EmptyState
              icon={SearchX}
              title="Sin resultados"
              text="Ningún movimiento coincide con tu búsqueda o filtro de categoría."
              action={
                <button onClick={() => { setSearch(""); clearFilters(); }} className={BTN_GHOST}>
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
          groupByDate(renderedTx).map((group) => (
            <div key={group.date}>
              <div className="px-4 py-[9px] text-caption font-semibold text-faint uppercase tracking-[0.03em] bg-surface-alt border-b border-border">
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
                  onDuplicate={(tx) => setDuplicateFrom(entryFromTransaction(tx))}
                  selected={selectedSet.has(t.id)}
                  selectionMode={selectedIds.length > 0}
                  onToggleSelect={toggleSelectOne}
                  onStartSelect={(id) => setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]))}
                  isRecent={recentSet.has(t.id)}
                  isDuplicate={duplicateIds?.has(t.id)}
                  isMobile={isMobile}
                  onToggleSubscription={onToggleSubscription}
                />
              ))}
            </div>
          ))
        )}
        {renderedTx.length < visibleTx.length && (
          <LoadMore onMore={showMore} remaining={visibleTx.length - renderedTx.length} />
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
      </>
      )}
    </div>
  );
}

// Bottom sheet de filtros (mobile): agrupa categoría/tipo/origen detrás de
// un solo botón con badge, en vez de 3 controles compitiendo por ancho con
// la búsqueda — mismo patrón que ya usa el "+" del nav inferior.
function FilterSheet({
  categories, catFilter, setCatFilter, txTypeFilter, setTxTypeFilter,
  sourceFilter, setSourceFilter, amountRange, setAmountRange, activeFilterCount, onClear, onClose,
}) {
  const typeOptions = [
    { v: "all", label: "Todos" },
    { v: "income", label: "Ingresos" },
    { v: "expense", label: "Gastos" },
  ];
  const sourceOptions = [
    { v: "all", label: "Todos" },
    { v: "manual", label: "Manual" },
    { v: "bank", label: "Banco" },
  ];

  return (
    <Modal
      title="Filtros"
      onClose={onClose}
      sheetOnMobile
      panelClassName="px-5 pt-[18px] pb-[calc(20px+env(safe-area-inset-bottom,0px))] overflow-y-auto overscroll-contain"
    >

        <div className="text-caption text-faint mb-1.5">Categoría</div>
        <div className="mb-4">
          <CategorySelect
            categories={categories}
            value={catFilter}
            onChange={(v) => { setCatFilter(v); setTxTypeFilter?.("all"); }}
            allOption={{ value: "all", label: "Todas las categorías" }}
          />
        </div>

        <div className="text-caption text-faint mb-1.5">Tipo</div>
        <div className="filter-seg-row mb-4">
          {typeOptions.map((opt) => (
            <button
              key={opt.v}
              className={`filter-seg-btn ${txTypeFilter === opt.v ? "bg-accent text-bg" : "bg-transparent text-muted"}`}
              onClick={() => setTxTypeFilter?.(opt.v)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {setSourceFilter && (
          <>
            <div className="text-caption text-faint mb-1.5">Origen</div>
            <div className="filter-seg-row mb-5">
              {sourceOptions.map((opt) => (
                <button
                  key={opt.v}
                  className={`filter-seg-btn ${sourceFilter === opt.v ? "bg-accent text-bg" : "bg-transparent text-muted"}`}
                  onClick={() => setSourceFilter(opt.v)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </>
        )}

        {setAmountRange && (
          <>
            <div className="text-caption text-faint mb-1.5">Monto</div>
            <div className="mb-5">
              <AmountRangeFields value={amountRange} onChange={setAmountRange} />
            </div>
          </>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClear}
            disabled={activeFilterCount === 0}
            className="flex-1 py-2.5 rounded-lg border border-border bg-transparent text-muted text-body disabled:opacity-50 disabled:cursor-default enabled:cursor-pointer"
          >
            Limpiar filtros
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border-0 bg-accent text-bg font-semibold text-body cursor-pointer"
          >
            Listo
          </button>
        </div>
    </Modal>
  );
}

// Final de la lista por tandas: se suma la siguiente tanda sola cuando este
// pie entra (o está por entrar) en pantalla; el botón queda por si el
// navegador no tiene IntersectionObserver o el usuario llega con el teclado.
function LoadMore({ onMore, remaining }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => { if (entries[0].isIntersecting) onMore(); }, { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [onMore]);
  return (
    <div ref={ref} className="border-t border-border p-3 text-center">
      <button onClick={onMore} className={BTN_GHOST}>
        Mostrar más ({remaining} restante{remaining === 1 ? "" : "s"})
      </button>
    </div>
  );
}

// "$10.000 – $50.000", "≥ $10.000" o "≤ $50.000" para el botón del filtro.
function formatAmountRange({ min, max }) {
  if (min != null && max != null) return `${formatCLP(min)} – ${formatCLP(max)}`;
  return min != null ? `≥ ${formatCLP(min)}` : `≤ ${formatCLP(max)}`;
}

// Desde/Hasta del filtro de monto (valor absoluto, sin signo). Solo dígitos:
// el usuario escribe "10000" o "10.000" y queda 10000; vacío = sin límite.
function AmountRangeFields({ value, onChange }) {
  const parse = (v) => {
    const digits = v.replace(/\D/g, "");
    return digits === "" ? null : Number(digits);
  };
  return (
    <div className="flex gap-2">
      <FieldInput
        label="Desde ($)" inputMode="numeric" placeholder="Sin mínimo" style={{ flex: 1 }}
        value={value.min ?? ""} onChange={(v) => onChange({ ...value, min: parse(v) })}
      />
      <FieldInput
        label="Hasta ($)" inputMode="numeric" placeholder="Sin máximo" style={{ flex: 1 }}
        value={value.max ?? ""} onChange={(v) => onChange({ ...value, max: parse(v) })}
      />
    </div>
  );
}

// Barra flotante contextual: solo existe mientras hay algo seleccionado.
// "Cambiar categoría" dispara la acción apenas el usuario elige una
// categoría, en vez de un botón + dropdown separados — menos clics, mismo
// resultado.
function BulkActionsBar({ count, categories, onDelete, onChangeCategory, onClose }) {
  const [busy, setBusy] = useState(false);
  const [pickedCategory, setPickedCategory] = useState("");

  const handleDeleteClick = async () => {
    setBusy(true);
    try {
      await onDelete();
    } finally {
      setBusy(false);
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
      className="bulk-action-bar fixed left-1/2 bottom-5 -translate-x-1/2 z-[1500] flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-surface-alt border border-border flex-wrap justify-center"
      style={{ boxShadow: "0 10px 28px rgba(0,0,0,0.4)", maxWidth: "calc(100vw - 28px)" }}
    >
      <span className="text-body font-semibold text-ink whitespace-nowrap">
        {count} seleccionado{count === 1 ? "" : "s"}
      </span>

      <div className="w-[190px]">
        <CategorySelect
          categories={categories}
          value={pickedCategory}
          onChange={(v) => { setPickedCategory(v); handleCategorySelect(v); }}
          disabled={busy}
          placeholder="Cambiar categoría…"
        />
      </div>

      <button
        onClick={handleDeleteClick}
        disabled={busy}
        className="flex items-center gap-1.5 px-3 py-[7px] rounded-lg border-0 bg-tint-expense text-expense text-body font-semibold disabled:cursor-default enabled:cursor-pointer"
      >
        {busy ? <Loader2 size={13} className="spin" /> : <Trash2 size={13} />} Borrar seleccionados
      </button>

      <button
        onClick={onClose}
        disabled={busy}
        aria-label="Cerrar selección"
        title="Cerrar selección"
        className="tap-expand bg-transparent border-0 text-faint cursor-pointer p-1"
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
      className={`border-[1.5px] border-dashed rounded-xl px-4 py-[18px] flex items-center gap-3 ${
        disabled ? "opacity-60 cursor-default" : "cursor-pointer"
      } ${dragOver ? "border-accent bg-tint-accent-soft" : "border-border bg-surface"}`}
    >
      <input type="file" accept=".xls,.xlsx,.pdf" disabled={disabled} className="hidden" onChange={(e) => e.target.files[0] && onFile(e.target.files[0])} />
      <div className="w-[34px] h-[34px] rounded-lg bg-surface-alt flex items-center justify-center shrink-0">
        {disabled ? <Loader2 size={16} color={TOKENS.accent} className="spin" /> : <Upload size={16} color={TOKENS.accent} />}
      </div>
      <div>
        <div className="text-body font-medium">{disabled ? "Procesando archivo…" : "Subir movimientos del banco"}</div>
        <div className="text-small text-faint">
          {disabled ? "Espera a que termine antes de subir otro." : "Arrastra el .xls de reportCollection o la cartola en .pdf, o haz clic para elegirlo"}
        </div>
      </div>
    </label>
  );
}

function ImportModal({ onClose, onFile }) {
  return (
    <Modal title="Importar movimientos" onClose={onClose} panelClassName="p-[22px] max-w-[420px]">
      <ImportDropzone onFile={onFile} />
    </Modal>
  );
}

// Monto con signo explícito: gasto en tinta neutra con "−", ingreso en verde
// con "+". Así la lista no es un muro rojo y el signo, no solo el color,
// dice qué es cada cosa.
function TxAmount({ amount, className = "" }) {
  return (
    <span className={`mono font-semibold ${amount >= 0 ? "text-income" : "text-ink"} ${className}`}>
      {amount >= 0 ? "+" : ""}{formatCLP(amount)}
    </span>
  );
}

function TxRow({ t, isLast, categories, getCat, saveTxEdit, onDelete, onDuplicate, selected, selectionMode, onToggleSelect, onStartSelect, isRecent, isDuplicate, isMobile, onToggleSubscription }) {
  const [editing, setEditing] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const cat = getCat(t.category);
  const CatIcon = cat.icon;
  const swipeControls = useAnimation();
  const closeSwipe = () => swipeControls.start({ x: 0, transition: { duration: 0.18, ease: [0.23, 1, 0.32, 1] } });
  const longPress = useLongPress(() => { closeSwipe(); setEditing(false); onStartSelect(t.id); });
  // al soltar un arrastre el navegador dispara igual un click: sin esto,
  // deslizar para ver editar/borrar abría además el editor
  const justDragged = useRef(false);

  // espera a que termine la animación de colapso antes de sacarla del estado
  const handleDelete = () => {
    closeSwipe();
    setLeaving(true);
    setTimeout(() => onDelete(t.id), 220);
  };

  const handleDragEnd = (_e, info) => {
    if (info.offset.x < -SWIPE_ACTION_WIDTH / 2) swipeControls.start({ x: -SWIPE_ACTION_WIDTH, transition: { duration: 0.18, ease: [0.23, 1, 0.32, 1] } });
    else closeSwipe();
  };

  const editPanel = editing && !selectionMode && (
    <TxEditPanel
      t={t}
      categories={categories}
      onSave={(payload) => { saveTxEdit(t.id, payload); setEditing(false); }}
      onCancel={() => setEditing(false)}
      onDuplicate={onDuplicate ? () => { setEditing(false); onDuplicate(t); } : undefined}
      onToggleSubscription={onToggleSubscription ? (checked) => onToggleSubscription(t.id, checked) : undefined}
    />
  );

  if (isMobile) {
    // Mobile ("Clásica", elegida por prototipo): ícono de categoría a la
    // izquierda, dos líneas, monto arriba a la derecha. Tocar abre el editor,
    // deslizar muestra editar/borrar, mantener presionado entra al modo
    // selección (ahí tocar suma/quita filas y el swipe se desactiva).
    const name = t.alias || t.description;
    const detail = t.alias ? t.description : t.source === "bank" ? "Banco" : "Manual";
    return (
      <div className={isLast ? "" : "border-b border-border"}>
        <div className={`tx-row-wrap tx-row-enter${leaving ? " tx-row-leaving" : ""}`}>
          <div className="tx-swipe-clip">
            {/* en modo selección no hay swipe: la bandeja ni se monta */}
            {!selectionMode && (
              <div className="tx-swipe-actions" style={{ width: SWIPE_ACTION_WIDTH }}>
                <button
                  className="tx-swipe-btn tx-swipe-edit"
                  onClick={() => { closeSwipe(); setEditing((v) => !v); }}
                  aria-label={editing ? "Cerrar edición" : "Editar movimiento"}
                  title="Editar"
                >
                  <Pencil size={17} />
                </button>
                <button className="tx-swipe-btn tx-swipe-delete" onClick={handleDelete} aria-label="Eliminar movimiento" title="Eliminar">
                  <Trash2 size={17} />
                </button>
              </div>
            )}
            <motion.div
              {...(selectionMode ? {} : {
                drag: "x",
                dragConstraints: { left: -SWIPE_ACTION_WIDTH, right: 0 },
                dragElastic: 0.06,
                onDragStart: () => { justDragged.current = true; },
                onDragEnd: handleDragEnd,
              })}
              animate={swipeControls}
              {...longPress.handlers}
              onClick={() => {
                if (longPress.consumeClick()) return;
                if (justDragged.current) { justDragged.current = false; return; }
                if (selectionMode) onToggleSelect(t.id);
                else setEditing((v) => !v);
              }}
              role="button"
              aria-pressed={selectionMode ? selected : undefined}
              aria-label={`${name}, ${formatCLP(t.amount)}`}
              className="relative flex items-center gap-3 px-4 py-3 touch-pan-y select-none cursor-pointer bg-surface"
              style={{
                WebkitTouchCallout: "none",
                boxShadow: isRecent ? `inset 3px 0 0 ${TOKENS.accent}` : "none",
                // fondo siempre opaco (la bandeja del swipe vive detrás); el
                // tinte de selección va encima como imagen
                backgroundImage: selected ? "linear-gradient(var(--tint-accent), var(--tint-accent))" : "none",
              }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{
                  background: selectionMode ? (selected ? TOKENS.accent : "transparent") : `${cat.color}22`,
                  border: selectionMode && !selected ? `2px solid ${TOKENS.border}` : "none",
                }}
              >
                {selectionMode
                  ? selected && <Check size={18} color={TOKENS.bg} strokeWidth={3} />
                  : <CatIcon size={18} color={cat.color} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="flex-1 min-w-0 truncate text-body-lg font-medium text-ink">{name}</span>
                  <TxAmount amount={t.amount} className="text-body-lg shrink-0" />
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 text-small text-muted min-w-0">
                  {isRecent && <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" title="Recién importado" aria-label="Recién importado" />}
                  {isDuplicate && (
                    <span
                      title="Hay otro movimiento con el mismo monto y una fecha muy cercana — revisa que no sea el mismo gasto anotado dos veces."
                      className="text-caption font-semibold text-pending shrink-0"
                    >
                      ¿Duplicado?
                    </span>
                  )}
                  <span className="shrink-0">{cat.label}</span>
                  <span className="text-faint shrink-0">·</span>
                  <span className="truncate text-faint">{detail}</span>
                  <span className="ml-auto shrink-0 text-faint" aria-label={t.source === "bank" ? "Movimiento del banco" : "Movimiento manual"}>
                    {t.source === "bank" ? <Landmark size={11} /> : <PenLine size={11} />}
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
        {editPanel}
      </div>
    );
  }

  return (
    <div className={isLast ? "" : "border-b border-border"}>
      <div className={`tx-row-wrap tx-row-enter${leaving ? " tx-row-leaving" : ""}`}>
        <div
          className="grid grid-cols-[20px_1fr_170px_130px_auto] items-center gap-2.5 px-4 py-[11px] bg-surface relative"
          style={{ boxShadow: isRecent ? `inset 3px 0 0 ${TOKENS.accent}` : "none" }}
        >
          <div>
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelect(t.id)}
              aria-label={`Seleccionar movimiento: ${t.alias || t.description}`}
              className="w-[18px] h-[18px] cursor-pointer"
              style={{ accentColor: "var(--c-accent)" }}
            />
          </div>
          <div className="flex items-center gap-1.5 text-body min-w-0">
            {/* el texto trunca solo a sí mismo (flex 1 + min-width 0) — así el
                tag de origen y los avisos de "nuevo"/duplicado quedan siempre
                enteros al lado, en vez de cortarse junto con la descripción. */}
            <span className="flex-[1_1_0%] min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
              {t.alias ? (
                <>
                  <span className="font-medium">{t.alias}</span>
                  <span className="text-faint text-small"> · {t.description}</span>
                </>
              ) : t.description}
            </span>
            <span
              title={t.source === "bank" ? "Movimiento del banco" : "Movimiento manual"}
              aria-label={t.source === "bank" ? "Movimiento del banco" : "Movimiento manual"}
              className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-[5px] border border-border text-faint shrink-0"
            >
              {t.source === "bank" ? <Landmark size={10} /> : <PenLine size={10} />}
            </span>
            {isRecent && (
              <span className="text-micro text-accent border border-accent rounded-[4px] px-[5px] py-px font-semibold shrink-0">
                nuevo
              </span>
            )}
            {isDuplicate && (
              <span
                title="Hay otro movimiento con el mismo monto y una fecha muy cercana — revisa que no sea el mismo gasto anotado dos veces (uno a mano y otro del banco, por ejemplo)."
                className="text-micro text-pending border border-pending rounded-[4px] px-[5px] py-px font-semibold shrink-0"
              >
                posible duplicado
              </span>
            )}
          </div>
          <div className="text-small flex items-center gap-1.5 overflow-hidden text-muted">
            <span
              className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
              style={{ background: `${cat.color}22` }}
            >
              <CatIcon size={12} color={cat.color} />
            </span>
            <span className="overflow-hidden text-ellipsis whitespace-nowrap">{cat.label}</span>
          </div>
          <TxAmount amount={t.amount} className="text-body text-right" />
          <div className="flex">
            <button onClick={() => setEditing((v) => !v)} aria-label={editing ? "Cerrar edición" : "Editar movimiento"} title="Editar" className={`bg-transparent border-0 cursor-pointer p-2 ${editing ? "text-accent" : "text-faint"}`}>
              <Pencil size={13} />
            </button>
            <button onClick={handleDelete} aria-label="Eliminar movimiento" title="Eliminar" className="bg-transparent border-0 cursor-pointer p-2 text-faint">
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>
      {editPanel}
    </div>
  );
}

function TxEditPanel({ t, categories, onSave, onCancel, onDuplicate, onToggleSubscription }) {
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
    <div className="bg-surface-alt px-4 py-3.5 border-t border-border">
      <div className="form-grid-2 grid grid-cols-2 gap-2.5 mb-2.5">
        <div>
          <div className="text-caption text-faint mb-1">Categoría</div>
          <CategorySelect
            categories={relevantCategories}
            value={category}
            onChange={setCategory}
            placeholder="Elige la categoría correcta…"
          />
        </div>
        <div>
          <div className="text-caption text-faint mb-1">Nombre para mostrar (opcional)</div>
          <input value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="Ej: Claude" className="w-full px-[9px] py-[7px] rounded-[7px] border border-border bg-surface text-ink text-body" />
        </div>
      </div>

      {t.amount < 0 && onToggleSubscription && (
        <div className="mb-2.5">
          <label className="flex items-center gap-[7px] text-small text-muted cursor-pointer">
            <input type="checkbox" checked={!!t.subscriptionId} onChange={(e) => onToggleSubscription(e.target.checked)} />
            ¿Es suscripción?
          </label>
          {t.subscriptionId && (
            <div className="text-micro text-faint mt-[3px] ml-[23px]">
              Va a aparecer en la pestaña Suscripciones y a generarse solo los meses siguientes.
            </div>
          )}
        </div>
      )}

      {t.source === "bank" && (
        <div className="mb-2.5">
          <label className={`flex items-center gap-[7px] text-small text-muted cursor-pointer ${remember ? "mb-[7px]" : "mb-0"}`}>
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Recordar esto para futuros movimientos con una descripción parecida
          </label>
          {remember && (
            <div>
              <div className="text-micro text-faint mb-[3px]">Se aplicará a movimientos cuya descripción contenga:</div>
              <input value={matchText} onChange={(e) => setMatchText(e.target.value)} className="mono w-full px-[9px] py-[7px] rounded-[7px] border border-border bg-surface text-accent text-small" />
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={() => onSave({ category, alias, remember, matchText })} disabled={!category} className={BTN_PRIMARY}>
          Guardar
        </button>
        <button onClick={onCancel} className={BTN_GHOST}>
          Cancelar
        </button>
        {onDuplicate && (
          <button
            onClick={onDuplicate}
            title="Crear un movimiento manual igual, con fecha de hoy"
            className={`${BTN_GHOST} ml-auto flex items-center gap-1.5`}
          >
            <Copy size={12} /> Duplicar
          </button>
        )}
      </div>
    </div>
  );
}

// "1234567" -> "1.234.567" (CLP no usa decimales)
const formatThousands = (digits) => (digits ? Number(digits).toLocaleString("es-CL") : "");

// Orden pensado para cargar un gasto en segundos desde el teléfono: el monto
// primero (es lo que uno tiene en la cabeza), grande y con teclado numérico;
// después descripción, categoría y fecha (casi siempre "Hoy"). En mobile sube
// desde abajo como hoja.
// `initial` precarga todo (Duplicar); `frequent` son atajos de un toque que
// llenan el formulario sin guardar (ver frequentManualEntries).
function ManualForm({ categories, onClose, onSubmit, onAddCategory, initial = null, frequent = [] }) {
  const [type, setType] = useState(initial?.type || "expense");
  const [date, setDate] = useState(() => localIsoDate());
  const [description, setDescription] = useState(initial?.description || "");
  const [amountDigits, setAmountDigits] = useState(initial ? String(initial.amount) : "");
  const [category, setCategory] = useState(initial?.category || "otros");
  const applyEntry = (e) => {
    setType(e.type);
    setAmountDigits(String(e.amount));
    setDescription(e.description);
    setCategory(e.category);
  };
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

  const today = localIsoDate();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = localIsoDate(yesterdayDate);

  const amount = Number(amountDigits);
  const valid = amount > 0 && description.trim() !== "" && !!date;
  // con algo escrito, tocar fuera no cierra (no se pierde lo ingresado)
  const dirty = amountDigits !== "" || description.trim() !== "";

  const submit = () => {
    if (!valid) return;
    onSubmit({ type, date, description: description.trim(), amount, category });
  };

  const accent = type === "expense" ? TOKENS.expense : TOKENS.income;

  return (
    <Modal
      onClose={onClose}
      ariaLabel="Nuevo movimiento"
      dismissOnBackdrop={!dirty}
      sheetOnMobile
      panelClassName="max-w-[440px] max-h-[88dvh] flex flex-col overflow-hidden"
    >
      <div className="flex justify-between items-center pt-[18px] px-5 shrink-0">
        <div className="display text-title font-semibold">Nuevo movimiento</div>
        <button onClick={onClose} aria-label="Cerrar" title="Cerrar" className="tap-expand bg-transparent border-0 text-faint cursor-pointer p-1 -m-1"><X size={16} /></button>
      </div>

      <div className="flex gap-[3px] p-[3px] mt-3.5 mx-5 rounded-full box-border bg-surface-alt border border-border shrink-0">
        {["expense", "income"].map((v) => (
          <button
            key={v}
            onClick={() => setType(v)}
            aria-pressed={type === v}
            className={`flex-[1_1_0] min-w-0 py-2 rounded-full text-body font-semibold cursor-pointer border-0 text-center transition-colors duration-150 ${
              type === v ? "text-bg" : "bg-transparent text-muted"
            }`}
            style={type === v ? { background: v === "expense" ? TOKENS.expense : TOKENS.income } : undefined}
          >
            {v === "expense" ? "Gasto" : "Ingreso"}
          </button>
        ))}
      </div>

      <div className="px-5 pt-4 pb-2 overflow-y-auto overscroll-contain flex-[1_1_auto]">
        {frequent.length > 0 && (
          <div className="mb-3.5">
            <div className="text-caption text-faint mb-1.5">Frecuentes</div>
            <div className="flex gap-1.5 overflow-x-auto overscroll-contain pb-1 -mx-5 px-5">
              {frequent.map((e) => (
                <button
                  key={`${e.type}|${e.description}`}
                  onClick={() => applyEntry(e)}
                  title={`Completar con "${e.description}" (lo anotaste ${e.count} veces)`}
                  className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-border bg-surface text-small text-ink cursor-pointer whitespace-nowrap"
                >
                  {e.description}
                  <span className={`mono ${e.type === "expense" ? "text-expense" : "text-income"}`}>{formatCLP(e.amount)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <label className="block mb-3.5">
          <span className="block text-caption text-faint mb-1">Monto (CLP)</span>
          <span className="flex items-baseline gap-1 border-b-2 pb-1" style={{ borderColor: accent }}>
            <span className="mono text-[22px] font-semibold text-faint">$</span>
            <input
              value={formatThousands(amountDigits)}
              onChange={(e) => setAmountDigits(e.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 12))}
              inputMode="numeric"
              enterKeyHint="next"
              placeholder="0"
              autoFocus
              className="amount-input mono flex-1 min-w-0 bg-transparent border-0 p-0 text-[28px] font-semibold text-ink outline-none"
            />
          </span>
        </label>

        <FieldInput
          label="Descripción"
          value={description}
          onChange={setDescription}
          placeholder={type === "expense" ? "Ej: almuerzo, Uber, farmacia" : "Ej: sueldo, reembolso"}
          enterKeyHint="done"
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          style={{ marginBottom: 16 }}
        />

        <div className="text-caption text-faint mb-2.5">Categoría</div>
        <div className="grid grid-cols-4 gap-3">
          {relevantCategories.map((c) => {
            const CatIcon = resolveCategoryIcon(c);
            const selected = category === c.id;
            return (
              <button
                key={c.id}
                onClick={() => { setCategory(c.id); setAddingCategory(false); }}
                aria-pressed={selected}
                title={c.label}
                className="flex flex-col items-center gap-1.5 bg-transparent border-0 cursor-pointer p-0.5"
              >
                <div
                  className="w-[46px] h-[46px] rounded-full flex items-center justify-center"
                  style={{
                    background: selected ? c.color : `${c.color}22`,
                    boxShadow: selected ? `0 0 0 2px ${c.color}` : "none",
                  }}
                >
                  <CatIcon size={19} color={selected ? TOKENS.bg : c.color} />
                </div>
                <div
                  className={`text-micro text-center leading-[1.2] overflow-hidden text-ellipsis ${selected ? "text-ink" : "text-muted"}`}
                  style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
                >
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
              className="flex flex-col items-center gap-1.5 bg-transparent border-0 cursor-pointer p-0.5"
            >
              <div
                className={`w-[46px] h-[46px] rounded-full flex items-center justify-center border-[1.5px] border-dashed ${
                  addingCategory ? "bg-accent border-accent" : "bg-transparent border-border"
                }`}
              >
                <Plus size={19} color={addingCategory ? TOKENS.bg : TOKENS.textFaint} />
              </div>
              <div className="text-micro text-muted text-center leading-[1.2]">
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

        <div className="text-caption text-faint mt-4 mb-1.5">Fecha</div>
        <div className="flex gap-2 items-center flex-wrap">
          {[[today, "Hoy"], [yesterday, "Ayer"]].map(([iso, text]) => (
            <button key={text} onClick={() => setDate(iso)} aria-pressed={date === iso} className={pillClass(date === iso)}>
              {text}
            </button>
          ))}
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Otra fecha"
            className={`px-2.5 py-1.5 rounded-full border bg-surface text-body ${
              date !== today && date !== yesterday ? "border-accent text-accent" : "border-border text-muted"
            }`}
          />
        </div>
      </div>

      <div className="sheet-footer px-5 py-3.5 border-t border-border bg-surface-alt shrink-0">
        <button
          onClick={submit}
          disabled={!valid}
          className="w-full py-[11px] rounded-lg border-0 bg-accent text-bg font-semibold text-body-lg disabled:opacity-50 disabled:cursor-default enabled:cursor-pointer"
        >
          {valid
            ? `Guardar ${type === "expense" ? "gasto" : "ingreso"} de $${formatThousands(amountDigits)}`
            : amount > 0 ? "Falta la descripción" : "Ingresa el monto"}
        </button>
      </div>
    </Modal>
  );
}
