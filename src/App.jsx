import { useState, useCallback, lazy, Suspense } from "react";

import { useAppData } from "./hooks/useAppData.js";
import { useImporters } from "./hooks/useImporters.js";
import { useTransactionActions } from "./hooks/useTransactionActions.js";
import { useCatalogActions } from "./hooks/useCatalogActions.js";
import { useDerivedData } from "./hooks/useDerivedData.js";
import { useToasts } from "./hooks/useToasts.js";
import { useIsMobile } from "./hooks/useIsMobile.js";
import { exportBackup } from "./lib/exportBackup.js";
import { exportCsv } from "./lib/exportCsv.js";
import { EMPTY_AMOUNT_RANGE } from "./lib/stats.js";

import { Header, MonthBar, BottomNav, ExportMenu } from "./components/Header.jsx";
import { CategoryManager } from "./components/CategoryManager.jsx";
import { Subscriptions } from "./components/Subscriptions.jsx";
import { ToastStack } from "./components/Toast.jsx";
import { ErrorBoundary } from "./components/ErrorBoundary.jsx";
import { Onboarding } from "./components/Onboarding.jsx";
import { AppShellSkeleton, ResumenSkeleton, MovimientosSkeleton } from "./components/Shared.jsx";

// recharts y framer-motion solo hacen falta en sus tabs — se separan en sus
// propios chunks para no pesar la carga inicial (que arranca en Resumen).
const Resumen = lazy(() => import("./components/Resumen.jsx").then((m) => ({ default: m.Resumen })));
const Movimientos = lazy(() => import("./components/Movimientos.jsx").then((m) => ({ default: m.Movimientos })));
const Conciliacion = lazy(() => import("./components/Conciliacion.jsx").then((m) => ({ default: m.Conciliacion })));

const ONBOARDING_KEY = "gastify:onboarding-done";

// Composición de la app: los datos y su persistencia viven en
// src/hooks/useAppData.js, las acciones en use*Actions/useImporters y los
// derivados en useDerivedData. Acá solo queda el estado de UI (pestaña,
// filtros, modales) y el render.
export default function App({ onSignOut, theme, onToggleTheme }) {
  const isMobile = useIsMobile();
  const { toasts, push: pushToast, update: updateToast, dismiss: dismissToast, pause: pauseToast, resume: resumeToast } = useToasts();

  // ---- estado de UI ---------------------------------------------------------
  const [tab, setTab] = useState("resumen");
  // qué dataset se ve en Movimientos (débito/crédito) — lifted acá porque
  // hace falta abrirlo desde afuera (card de la tarjeta en Resumen).
  const [movementsView, setMovementsView] = useState("debito");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [txTypeFilter, setTxTypeFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [amountRange, setAmountRange] = useState(EMPTY_AMOUNT_RANGE);
  const [showManualForm, setShowManualForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingBackup, setExportingBackup] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try { return localStorage.getItem(ONBOARDING_KEY) !== "1"; } catch { return false; }
  });

  // ---- datos, acciones y derivados ------------------------------------------
  const data = useAppData();
  const {
    transactions, categories, subscriptions, accountSettings, loaded, saving, syncError, setSyncError,
    adjustBaseBalance, adjustSavingsBase,
  } = data;
  const closeManualForm = useCallback(() => setShowManualForm(false), []);
  const txActions = useTransactionActions(data, { onManualAdded: closeManualForm, pushToast });
  const catalog = useCatalogActions(data);
  const importers = useImporters(data, { pushToast, updateToast });
  const derived = useDerivedData(data, { search, catFilter, txTypeFilter, sourceFilter, amountRange });
  const { months, monthFilter, setMonthFilter, currentMonth } = derived;

  const dismissOnboarding = useCallback(() => {
    try { localStorage.setItem(ONBOARDING_KEY, "1"); } catch { /* localStorage puede fallar en modo privado */ }
    setShowOnboarding(false);
  }, []);

  const handleExportCsv = async () => {
    if (exportingCsv) return;
    setExportingCsv(true);
    try {
      await exportCsv();
    } catch (e) {
      console.error(e);
      pushToast("error", "No se pudo generar el CSV. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setExportingCsv(false);
    }
  };

  const handleExportBackup = async () => {
    if (exportingBackup) return;
    setExportingBackup(true);
    try {
      await exportBackup();
    } catch (e) {
      console.error(e);
      pushToast("error", "No se pudo generar el respaldo. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setExportingBackup(false);
    }
  };

  // ---- navegación -----------------------------------------------------------
  // el "+" central del nav inferior vive fuera de Movimientos — ambas
  // opciones abren el formulario/modal de ahí, así que primero cambian de tab.
  const openManualEntry = useCallback(() => {
    setTab("movimientos");
    setShowManualForm(true);
  }, []);
  const openImportFlow = useCallback(() => {
    setTab("movimientos");
    setShowImportModal(true);
  }, []);
  // desde la card de la tarjeta CMR en Resumen: Movimientos con "Crédito".
  const goToCredito = useCallback(() => {
    setTab("movimientos");
    setMovementsView("credito");
  }, []);
  // desde los gráficos por categoría de Resumen: Movimientos filtrado por esa
  // categoría y por el tipo del gráfico (mismo mes), sin mezclar ingresos y
  // gastos. El rango de monto se limpia: si no, la lista podría no sumar lo
  // que mostraba la porción del gráfico.
  const goToCategoryMovements = useCallback((categoryId, txType = "all") => {
    setCatFilter(categoryId);
    setTxTypeFilter(txType);
    setAmountRange(EMPTY_AMOUNT_RANGE);
    setTab("movimientos");
  }, []);

  if (!loaded) {
    return <AppShellSkeleton />;
  }

  return (
    <div className="bg-bg min-h-screen text-ink font-sans">
      <Header tab={tab} setTab={setTab} onSignOut={onSignOut} theme={theme} onToggleTheme={onToggleTheme} saving={saving} />

      <main className="app-main max-w-[1080px] mx-auto px-6 pt-7 pb-20">
        {syncError && (
          <div className="flex items-center justify-between gap-3 bg-tint-expense border border-expense text-expense rounded-[10px] px-3.5 py-2.5 text-body mb-[18px]">
            <span>{syncError}</span>
            <button onClick={() => setSyncError(null)} className="bg-transparent border-0 text-expense cursor-pointer text-body">
              Cerrar
            </button>
          </div>
        )}
        {tab !== "categorias" && tab !== "suscripciones" && (
          <MonthBar
            months={months} setMonthFilter={setMonthFilter}
            // en Resumen no existe "Todo" (ver resumenTx en useDerivedData):
            // se marca el mes que efectivamente se está mostrando.
            monthFilter={tab === "resumen" ? currentMonth : monthFilter}
            allowAll={tab !== "resumen"}
            monthHealth={tab === "conciliacion" ? derived.monthHealth : undefined}
            rightSlot={tab === "movimientos" && isMobile && transactions.length > 0 ? (
              <ExportMenu
                exportingCsv={exportingCsv}
                exportingBackup={exportingBackup}
                onExportCsv={handleExportCsv}
                onExportBackup={handleExportBackup}
              />
            ) : undefined}
          />
        )}

        <div key={tab} className="tab-panel">
        {tab === "categorias" && (
          <CategoryManager
            categories={categories} onAdd={catalog.addCategory} onRename={catalog.renameCategory} onDelete={catalog.deleteCategory}
            onIconChange={catalog.changeCategoryIcon} onColorChange={catalog.changeCategoryColor} onToggleExpense={catalog.toggleCategoryExpense}
            onBudgetChange={catalog.changeCategoryBudget} onTypeChange={catalog.changeCategoryType} onSavingsToggle={catalog.toggleCategorySavings}
          />
        )}

        {tab === "suscripciones" && (
          <Subscriptions
            subscriptions={subscriptions} categories={categories}
            onAdd={catalog.addSubscription} onUpdate={catalog.updateSubscription} onDelete={catalog.deleteSubscription}
          />
        )}

        {tab === "resumen" && (
          <ErrorBoundary>
            <Suspense fallback={<ResumenSkeleton />}>
              <Resumen
                stats={derived.stats} byCategory={derived.byCategory} byIncomeCategory={derived.byIncomeCategory} categories={categories} byMonth={derived.byMonth} currentMonth={currentMonth}
                dailySpend={derived.dailySpend} hasTransactions={transactions.length > 0} heroStat={derived.heroStat}
                projection={derived.projection} savingsRate={derived.savingsRate}
                insights={derived.insights} pushToast={pushToast}
                dynamicBalance={derived.dynamicBalance} lastSyncDate={accountSettings?.lastSyncDate}
                onAdjustBalance={adjustBaseBalance}
                onCategoryClick={goToCategoryMovements}
                totalSavings={derived.totalSavings}
                onAdjustSavings={adjustSavingsBase}
                creditStatement={derived.latestCreditStatement}
                onGoToCredit={goToCredito}
              />
            </Suspense>
          </ErrorBoundary>
        )}

        {tab === "movimientos" && (
          <ErrorBoundary>
            <Suspense fallback={<MovimientosSkeleton />}>
              <Movimientos
                filteredTx={derived.filteredTx}
                frequentEntries={derived.frequentEntries}
                hasTransactions={transactions.length > 0}
                categories={categories}
                getCat={derived.getCat}
                search={search} setSearch={setSearch}
                catFilter={catFilter} setCatFilter={setCatFilter}
                txTypeFilter={txTypeFilter} setTxTypeFilter={setTxTypeFilter}
                sourceFilter={sourceFilter} setSourceFilter={setSourceFilter}
                amountRange={amountRange} setAmountRange={setAmountRange}
                saveTxEdit={txActions.saveTxEdit}
                deleteTransaction={txActions.deleteTransaction}
                showManualForm={showManualForm} setShowManualForm={setShowManualForm}
                showImportModal={showImportModal} setShowImportModal={setShowImportModal}
                addManual={txActions.addManual}
                onAddCategory={catalog.addCategory}
                handleFile={importers.handleFile}
                isImporting={importers.isImporting}
                pushToast={pushToast}
                onBulkDelete={txActions.bulkDeleteTransactions}
                onBulkChangeCategory={txActions.bulkChangeCategory}
                recentImportIds={importers.recentImportIds}
                onClearRecentImports={importers.clearRecentImports}
                duplicateIds={derived.duplicateIds}
                onOpenConciliacion={() => setTab("conciliacion")}
                reconcileStats={derived.reconcileStats}
                onToggleSubscription={txActions.toggleTxSubscription}
                exportingCsv={exportingCsv} exportingBackup={exportingBackup}
                onExportCsv={handleExportCsv} onExportBackup={handleExportBackup}
                creditTx={derived.filteredCreditTx}
                creditMonths={derived.creditMonths}
                currentCreditMonth={derived.currentCreditMonth}
                onSetCreditMonth={derived.setCreditMonthFilter}
                creditStats={derived.creditStats}
                saveCreditTxEdit={txActions.editCreditTxEntry}
                deleteCreditTransaction={txActions.deleteCreditTransaction}
                handleCreditFile={importers.handleCreditFile}
                isImportingCredit={importers.isImportingCredit}
                creditStatement={derived.currentCreditStatement}
                handleCreditStatementFile={importers.handleCreditStatementFile}
                isImportingStatement={importers.isImportingStatement}
                viewMode={movementsView}
                setViewMode={setMovementsView}
              />
            </Suspense>
          </ErrorBoundary>
        )}

        {tab === "conciliacion" && (
          <ErrorBoundary>
            <Suspense fallback={<MovimientosSkeleton />}>
              <Conciliacion
                currentMonth={currentMonth} reconcileStats={derived.reconcileStats} reconcileMonth={txActions.reconcileMonth}
                onEditManual={txActions.editManualEntry} onManualMatch={txActions.manualMatch}
                onBack={() => setTab("movimientos")}
              />
            </Suspense>
          </ErrorBoundary>
        )}
        </div>
      </main>

      <BottomNav tab={tab} setTab={setTab} onManual={openManualEntry} onImport={openImportFlow} />
      <ToastStack toasts={toasts} onDismiss={dismissToast} onPause={pauseToast} onResume={resumeToast} />
      {showOnboarding && <Onboarding onDone={dismissOnboarding} />}
    </div>
  );
}
