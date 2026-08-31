import { useEffect, useMemo, useRef, useState } from "react";
import { Tag, ListChecks, LayoutGrid, Repeat, LogOut, Sun, Moon, Plus, PenLine, Upload, HelpCircle, Loader2, Check, MoreVertical, FileSpreadsheet, Download } from "lucide-react";
import { TOKENS } from "../lib/constants.js";
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
      <span style={{ display: "flex", alignItems: "center", gap: 4, color: TOKENS.textFaint, fontSize: 11.5 }}>
        <Loader2 size={11} className="spin" /> Guardando…
      </span>
    );
  }
  if (showSaved) {
    return (
      <span style={{ display: "flex", alignItems: "center", gap: 4, color: TOKENS.income, fontSize: 11.5 }}>
        <Check size={11} /> Guardado
      </span>
    );
  }
  return null;
}

export function Header({ tab, setTab, onSignOut, theme, onToggleTheme, saving }) {
  const [showHelp, setShowHelp] = useState(false);
  return (
    <div style={{ borderBottom: `1px solid ${TOKENS.border}`, background: TOKENS.surface, position: "sticky", top: 0, zIndex: 10 }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src={logo} alt="" width={30} height={30} style={{ display: "block" }} />
          <div className="display" style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>Gastify</div>
          <div className="header-subtitle" style={{ color: TOKENS.textFaint, fontSize: 12, marginLeft: 2 }}>· cuenta corriente CLP</div>
          <SaveIndicator saving={saving} />
        </div>
        <div className="header-controls" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <nav className="top-tab-nav" style={{ display: "flex", gap: 4, background: TOKENS.surfaceAlt, padding: 4, borderRadius: 10, border: `1px solid ${TOKENS.border}` }}>
            {TAB_ITEMS.map((it) => {
              const Icon = it.icon;
              const active = tab === it.id;
              return (
                <button key={it.id} onClick={() => setTab(it.id)} aria-label={it.label} aria-current={active ? "page" : undefined} style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 7,
                  border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500,
                  background: active ? TOKENS.bg : "transparent", color: active ? TOKENS.text : TOKENS.textMuted,
                }}>
                  <Icon size={14} /> <span>{it.label}</span>
                </button>
              );
            })}
          </nav>
          <button
            onClick={() => setShowHelp(true)}
            title="Cómo usar la app"
            aria-label="Cómo usar la app"
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8,
              border: `1px solid ${TOKENS.border}`, background: "transparent", color: TOKENS.textMuted, fontSize: 12.5, cursor: "pointer",
            }}>
            <HelpCircle size={13} />
          </button>
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              style={{
              display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8,
              border: `1px solid ${TOKENS.border}`, background: "transparent", color: TOKENS.textMuted, fontSize: 12.5, cursor: "pointer",
            }}>
              {theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
            </button>
          )}
          {onSignOut && (
            <button onClick={onSignOut} title="Cerrar sesión" aria-label="Cerrar sesión" style={{
              display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8,
              border: `1px solid ${TOKENS.border}`, background: "transparent", color: TOKENS.textMuted, fontSize: 12.5, cursor: "pointer",
            }}>
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
      className="bottom-tab-btn"
      style={{ color: active ? TOKENS.text : TOKENS.textFaint }}
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
    <div style={{ position: "relative" }}>
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        aria-label="Más opciones"
        aria-expanded={open}
        title="Exportar o respaldar movimientos"
        style={{
          display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", borderRadius: 8,
          border: `1px solid ${TOKENS.border}`, background: TOKENS.surface, color: TOKENS.textMuted, cursor: "pointer",
        }}
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
    <div style={{ marginBottom: 22 }}>
      {(years.length > 1 || rightSlot) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
          {years.length > 1 ? (
            <div className="chip-scroll-row" style={{ display: "flex", gap: 4, background: TOKENS.surfaceAlt, padding: 4, borderRadius: 10, border: `1px solid ${TOKENS.border}`, width: "fit-content", maxWidth: "100%" }}>
              {years.map((y) => {
                const active = y === selectedYear;
                return (
                  <button key={y} onClick={() => setYearOverride(y)} style={{
                    padding: "5px 12px", borderRadius: 7, border: "none", cursor: "pointer",
                    fontSize: 12.5, fontWeight: 500, flexShrink: 0,
                    background: active ? TOKENS.bg : "transparent", color: active ? TOKENS.text : TOKENS.textMuted,
                  }}>
                    {y}
                  </button>
                );
              })}
            </div>
          ) : <div />}
          {rightSlot}
        </div>
      )}
      <div className="chip-scroll-row" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={() => setMonthFilter("all")} className={pillClass(monthFilter === "all")}>Todo</button>
        {monthsInYear.map((m) => {
          const health = monthHealth?.[m];
          return (
            <button key={m} onClick={() => setMonthFilter(m)} className={pillClass(monthFilter === m)}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                {label(m)}
                {health && (
                  <span
                    title={health === "warn" ? "Con movimientos manuales sin conciliar" : "Mes conciliado"}
                    style={{
                      width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                      background: health === "warn" ? TOKENS.pending : TOKENS.income,
                    }}
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
