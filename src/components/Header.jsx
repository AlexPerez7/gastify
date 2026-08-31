import { useEffect, useMemo, useRef, useState } from "react";
import { Tag, ListChecks, LayoutGrid, Repeat, LogOut, Sun, Moon, Plus, PenLine, Upload, HelpCircle, Loader2, Check, MoreVertical, FileSpreadsheet, Download } from "lucide-react";
import { pillClass } from "./Shared.jsx";
import { HelpModal } from "./HelpModal.jsx";
import logo from "../assets/logo.png";

// Conciliación no tiene tab propia en la nav — se llega a ella desde un
// botón dentro de Movimientos (setTab("conciliacion") sigue siendo un valor
// válido de `tab`, solo no aparece acá).
const TAB_ITEMS = [
  { id: "resumen", label: "Resumen", icon: LayoutGrid },
  { id: "movimientos", label: "Movimientos", icon: ListChecks },
  { id: "suscripciones", label: "Suscripciones", icon: Repeat },
  { id: "categorias", label: "Categorías", icon: Tag },
];

// "Guardando…" mientras hay algo en vuelo hacia Supabase, "Guardado" un
// instante después de terminar — para que quede claro cuándo es seguro
// cerrar o recargar la pestaña sin perder el último cambio.
function SaveIndicator({ saving }) {
  const [showSaved, setShowSaved] = useState(false);
  const wasSaving = useRef(false);

  useEffect(() => {
    if (wasSaving.current && !saving) {
      setShowSaved(true);
      const t = setTimeout(() => setShowSaved(false), 1500);
      wasSaving.current = saving;
      return () => clearTimeout(t);
    }
    wasSaving.current = saving;
  }, [saving]);

  if (saving) {
    return (
      <span className="flex items-center gap-1 text-faint text-[11.5px]">
        <Loader2 size={11} className="spin" /> Guardando…
      </span>
    );
  }
  if (showSaved) {
    return (
      <span className="flex items-center gap-1 text-income text-[11.5px]">
        <Check size={11} /> Guardado
      </span>
    );
  }
  return null;
}

// botón de ícono suelto de la barra superior (ayuda, tema, cerrar sesión)
const HEADER_ICON_BTN =
  "flex items-center gap-1.5 px-3 py-[7px] rounded-lg border border-border bg-transparent text-muted text-[12.5px] cursor-pointer";

export function Header({ tab, setTab, onSignOut, theme, onToggleTheme, saving }) {
  const [showHelp, setShowHelp] = useState(false);
  return (
    <div className="border-b border-border bg-surface sticky top-0 z-10">
      <div className="max-w-[1080px] mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <img src={logo} alt="" width={30} height={30} className="block" />
          <div className="display text-lg font-bold tracking-[-0.02em]">Gastify</div>
          <div className="header-subtitle text-faint text-xs ml-0.5">· cuenta corriente CLP</div>
          <SaveIndicator saving={saving} />
        </div>
        <div className="header-controls flex items-center gap-2.5">
          <nav className="top-tab-nav flex gap-1 bg-surface-alt p-1 rounded-[10px] border border-border">
            {TAB_ITEMS.map((it) => {
              const Icon = it.icon;
              const active = tab === it.id;
              return (
                <button
                  key={it.id}
                  onClick={() => setTab(it.id)}
                  aria-label={it.label}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-1.5 px-3 py-[7px] rounded-[7px] border-0 cursor-pointer text-[13px] font-medium ${
                    active ? "bg-bg text-ink" : "bg-transparent text-muted"
                  }`}
                >
                  <Icon size={14} /> <span>{it.label}</span>
                </button>
              );
            })}
          </nav>
          <button
            onClick={() => setShowHelp(true)}
            title="Cómo usar la app"
            aria-label="Cómo usar la app"
            className={HEADER_ICON_BTN}
          >
            <HelpCircle size={13} />
          </button>
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              className={HEADER_ICON_BTN}
            >
              {theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
            </button>
          )}
          {onSignOut && (
            <button onClick={onSignOut} title="Cerrar sesión" aria-label="Cerrar sesión" className={HEADER_ICON_BTN}>
              <LogOut size={13} />
            </button>
          )}
        </div>
      </div>
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
}

function BottomTabButton({ it, tab, setTab }) {
  const Icon = it.icon;
  const active = tab === it.id;
  return (
    <button
      onClick={() => setTab(it.id)}
      aria-label={it.label}
      aria-current={active ? "page" : undefined}
      className={`bottom-tab-btn ${active ? "text-ink" : "text-faint"}`}
    >
      <Icon size={20} strokeWidth={active ? 2.3 : 1.8} />
      <span>{it.label}</span>
    </button>
  );
}

export function BottomNav({ tab, setTab, onManual, onImport }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const sheetRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (sheetRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (fn) => { setOpen(false); fn(); };

  return (
    <nav className="bottom-tab-nav" aria-label="Navegación principal">
      <BottomTabButton it={TAB_ITEMS[0]} tab={tab} setTab={setTab} />
      <BottomTabButton it={TAB_ITEMS[1]} tab={tab} setTab={setTab} />
      <div className="bottom-tab-center">
        <button
          ref={btnRef}
          className={`bottom-add-btn${open ? " open" : ""}`}
          aria-label="Agregar movimiento"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <Plus size={24} />
        </button>
        {open && (
          <div ref={sheetRef} className="add-sheet" role="menu">
            <button role="menuitem" className="add-sheet-btn" onClick={() => pick(onManual)}>
              <PenLine size={16} /> Manual
            </button>
            <button role="menuitem" className="add-sheet-btn" onClick={() => pick(onImport)}>
              <Upload size={16} /> Subir archivo del banco
            </button>
          </div>
        )}
      </div>
      <BottomTabButton it={TAB_ITEMS[2]} tab={tab} setTab={setTab} />
      <BottomTabButton it={TAB_ITEMS[3]} tab={tab} setTab={setTab} />
    </nav>
  );
}

// Menú "⋮" compacto para exportar/respaldar movimientos — vive acá, junto a
// los chips de año, en vez de ocupar su propia fila suelta bajo la búsqueda.
export function ExportMenu({ exportingCsv, exportingBackup, onExportCsv, onExportBackup }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (menuRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        aria-label="Más opciones"
        aria-expanded={open}
        title="Exportar o respaldar movimientos"
        className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-border bg-surface text-muted cursor-pointer"
      >
        <MoreVertical size={15} />
      </button>
      {open && (
        <div ref={menuRef} className="overflow-menu" role="menu">
          <button role="menuitem" className="add-sheet-btn" disabled={exportingCsv} onClick={() => { setOpen(false); onExportCsv(); }}>
            {exportingCsv ? <Loader2 size={15} className="spin" /> : <FileSpreadsheet size={15} />}
            {exportingCsv ? "Generando CSV…" : "Exportar CSV"}
          </button>
          <button role="menuitem" className="add-sheet-btn" disabled={exportingBackup} onClick={() => { setOpen(false); onExportBackup(); }}>
            {exportingBackup ? <Loader2 size={15} className="spin" /> : <Download size={15} />}
            {exportingBackup ? "Generando respaldo…" : "Descargar respaldo"}
          </button>
        </div>
      )}
    </div>
  );
}

export function MonthBar({ months, monthFilter, setMonthFilter, monthHealth, rightSlot }) {
  const [yearOverride, setYearOverride] = useState(null);
  const names = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const label = (m) => { const [, mo] = m.split("-"); return names[parseInt(mo, 10) - 1]; };
  const years = useMemo(() => Array.from(new Set(months.map((m) => m.split("-")[0]))).sort().reverse(), [months]);

  if (months.length === 0) return null;

  const activeYear = monthFilter !== "all" ? monthFilter.split("-")[0] : years[0];
  const selectedYear = yearOverride && years.includes(yearOverride) ? yearOverride : activeYear;
  const monthsInYear = months.filter((m) => m.startsWith(selectedYear));

  return (
    <div className="mb-[22px]">
      {(years.length > 1 || rightSlot) && (
        <div className="flex items-center justify-between gap-2.5 mb-2.5">
          {years.length > 1 ? (
            <div className="chip-scroll-row flex gap-1 bg-surface-alt p-1 rounded-[10px] border border-border w-fit max-w-full">
              {years.map((y) => {
                const active = y === selectedYear;
                return (
                  <button
                    key={y}
                    onClick={() => setYearOverride(y)}
                    className={`px-3 py-[5px] rounded-[7px] border-0 cursor-pointer text-[12.5px] font-medium shrink-0 ${
                      active ? "bg-bg text-ink" : "bg-transparent text-muted"
                    }`}
                  >
                    {y}
                  </button>
                );
              })}
            </div>
          ) : <div />}
          {rightSlot}
        </div>
      )}
      <div className="chip-scroll-row flex gap-2 flex-wrap">
        <button onClick={() => setMonthFilter("all")} className={pillClass(monthFilter === "all")}>Todo</button>
        {monthsInYear.map((m) => {
          const health = monthHealth?.[m];
          return (
            <button key={m} onClick={() => setMonthFilter(m)} className={pillClass(monthFilter === m)}>
              <span className="inline-flex items-center gap-[5px]">
                {label(m)}
                {health && (
                  <span
                    title={health === "warn" ? "Con movimientos manuales sin conciliar" : "Mes conciliado"}
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${health === "warn" ? "bg-pending" : "bg-income"}`}
                  />
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
