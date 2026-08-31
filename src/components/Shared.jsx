import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Tags } from "lucide-react";
import { TOKENS, ICONS, ICON_NAMES, PALETTE, DEFAULT_CATEGORY_ICON, resolveCategoryIcon, labelWithTypeIfAmbiguous } from "../lib/constants.js";

export function Skeleton({ width = "100%", height = 14, radius = 6, style }) {
  return <div className="skeleton" style={{ width, height, borderRadius: radius, background: TOKENS.surfaceAlt, ...style }} />;
}

export function AppShellSkeleton() {
  return (
    <div className="bg-bg min-h-screen" aria-hidden="true">
      <div className="border-b border-border px-6 py-4">
        <div className="max-w-[1080px] mx-auto flex items-center justify-between">
          <Skeleton width={110} height={24} radius={6} />
          <Skeleton width={160} height={32} radius={8} />
        </div>
      </div>
      <div className="max-w-[1080px] mx-auto px-6 py-7">
        <ResumenSkeleton />
      </div>
    </div>
  );
}

export function ResumenSkeleton() {
  return (
    <div aria-hidden="true">
      <Skeleton height={92} radius={12} style={{ marginBottom: 16 }} />
      <div className="flex gap-3 mb-4 flex-wrap">
        <Skeleton height={64} radius={12} style={{ flex: "1 1 160px" }} />
        <Skeleton height={64} radius={12} style={{ flex: "1 1 160px" }} />
        <Skeleton height={64} radius={12} style={{ flex: "1 1 160px" }} />
      </div>
      <div className="resumen-charts-grid grid grid-cols-[1.1fr_1fr] gap-4 mb-4">
        <Skeleton height={220} radius={12} />
        <Skeleton height={220} radius={12} />
      </div>
      <Skeleton height={130} radius={12} />
    </div>
  );
}

export function MovimientosSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="flex gap-2.5 mb-3.5">
        <Skeleton height={36} radius={8} style={{ flex: "1 1 220px" }} />
        <Skeleton height={36} radius={8} width={140} />
      </div>
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`flex items-center gap-3 px-4 py-3.5 ${i < 4 ? "border-b border-border" : ""}`}
          >
            <Skeleton width={32} height={32} radius={8} />
            <div className="flex-1">
              <Skeleton height={12} width="55%" style={{ marginBottom: 6 }} />
              <Skeleton height={10} width="30%" />
            </div>
            <Skeleton height={12} width={60} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function Panel({ title, right, children }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-[18px]">
      <div className="flex justify-between items-center mb-3.5">
        <div className="display text-[13.5px] font-semibold">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

export function EmptyNote({ text }) {
  return <div className="text-faint text-[12.5px] py-[30px] text-center">{text}</div>;
}

export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="text-center px-5 py-10">
      <div className="w-11 h-11 rounded-xl bg-surface-alt flex items-center justify-center mx-auto mb-3.5">
        <Icon size={20} color={TOKENS.textFaint} />
      </div>
      <div className="display text-sm font-semibold text-ink mb-[5px]">{title}</div>
      <div className="text-[12.5px] text-faint max-w-[320px] mx-auto leading-[1.5]">{text}</div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// secundarias a propósito (fontSize/padding más chicos que antes): el hero
// number de arriba es el que debe destacar, estas son contexto de apoyo.
export function StatCard({ label, value, sub, icon: Icon, accent, action }) {
  return (
    <div className="bg-surface border border-border rounded-xl px-4 py-[13px]">
      <div className="flex justify-between items-start">
        <div className="text-[11px] text-muted mb-1.5 leading-[1.4]">{label}</div>
        {action || (Icon && <Icon size={13} color={accent} />)}
      </div>
      <div className="mono text-[17px] font-semibold" style={{ color: accent }}>{value}</div>
      {sub && <div className="text-[10.5px] text-faint mt-[3px]">{sub}</div>}
    </div>
  );
}

export function FieldInput({ label, style, ...props }) {
  return (
    <div style={style}>
      <div className="text-[11px] text-faint mb-1">{label}</div>
      <input
        {...props}
        onChange={(e) => props.onChange(e.target.value)}
        className="w-full px-2.5 py-2 rounded-lg border border-border bg-surface text-ink text-[13px]"
      />
    </div>
  );
}

// Interruptor on/off — reemplaza a los checkboxes nativos donde se necesita
// una afirmación/negación visualmente clara (ej. "cuenta como gasto").
export function ToggleSwitch({ checked, onChange, disabled = false, title, ariaLabel }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      title={title}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative shrink-0 w-[34px] h-[18px] rounded-full border-0 p-0 transition-colors duration-150 ${
        disabled ? "opacity-45 cursor-not-allowed" : "cursor-pointer"
      } ${checked && !disabled ? "bg-accent" : "bg-border"}`}
    >
      <span
        className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-[left] duration-150 ${
          checked ? "left-[18px]" : "left-0.5"
        }`}
        style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.35)" }}
      />
    </button>
  );
}

export function pillStyle(active) {
  return {
    padding: "6px 13px", borderRadius: 999, fontSize: 12.5, fontWeight: 500, cursor: "pointer",
    border: `1px solid ${active ? TOKENS.accent : TOKENS.border}`,
    background: active ? "var(--tint-accent)" : "transparent",
    color: active ? TOKENS.accent : TOKENS.textMuted,
    textTransform: "capitalize",
  };
}

// panel compacto para crear una categoría (nombre + color + ícono) sin
// abandonar el flujo en el que se abrió — se usa tanto en "Nuevo movimiento"
// como en la pestaña Categorías, mismo look en los dos lados.
export function CategoryQuickAdd({ type, onAdd, onAddCategory, onCancel }) {
  const [label, setLabel] = useState("");
  const [icon, setIcon] = useState("Shapes");
  const [color, setColor] = useState(PALETTE[0]);
  const Icon = ICONS[icon] || DEFAULT_CATEGORY_ICON;

  const submit = () => {
    if (!label.trim()) return;
    const id = onAddCategory(label.trim(), icon, color, type);
    onAdd(id);
  };

  return (
    <div className="mt-3.5 p-3 bg-surface-alt border border-border rounded-[10px]">
      <div className="flex items-center gap-2 mb-2.5">
        <div
          className="w-[30px] h-[30px] rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${color}22` }}
        >
          <Icon size={15} color={color} />
        </div>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder={`Nueva categoría de ${type === "expense" ? "gasto" : "ingreso"}`}
          autoFocus
          className="flex-1 min-w-0 px-[9px] py-1.5 rounded-md border border-border bg-surface text-ink text-[12.5px]"
        />
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2.5">
        {PALETTE.map((col) => (
          <button
            key={col}
            onClick={() => setColor(col)}
            title={col}
            aria-label={`Usar color ${col}`}
            aria-pressed={col === color}
            className="w-5 h-5 rounded-full cursor-pointer p-0 border-2"
            style={{ background: col, borderColor: col === color ? "var(--c-text)" : "transparent" }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {ICON_NAMES.map((name) => {
          const OptionIcon = ICONS[name];
          const selected = icon === name;
          return (
            <button
              key={name}
              title={name}
              onClick={() => setIcon(name)}
              className="w-7 h-7 rounded-[7px] flex items-center justify-center border cursor-pointer p-0"
              style={{
                background: selected ? `${color}33` : "transparent",
                borderColor: selected ? color : "var(--c-border)",
              }}
            >
              <OptionIcon size={13} color={selected ? color : TOKENS.textMuted} />
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={!label.trim()}
          className="px-3.5 py-[7px] rounded-[7px] border-0 text-xs font-semibold bg-accent text-bg disabled:opacity-60 disabled:cursor-default enabled:cursor-pointer"
        >
          Crear y usar
        </button>
        <button
          onClick={onCancel}
          className="px-3.5 py-[7px] rounded-[7px] border border-border bg-transparent text-muted text-xs cursor-pointer"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// selector de categoría con ícono y color — reemplaza a un <select> nativo,
// que en mobile abre la lista del sistema operativo sin forma de mostrar
// nada más que el texto. Mismo popover-en-portal que ConfirmDeleteButton,
// para que no lo recorten los contenedores con overflow:hidden de las
// listas de la app.
// allOption: {value, label} opcional — una fila extra al principio (ej.
// "Todas las categorías" en el filtro) sin ícono de categoría propio.
export function CategorySelect({ categories, value, onChange, placeholder = "Elegir categoría…", disabled = false, allOption = null }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const btnRef = useRef(null);
  const popRef = useRef(null);

  const POPOVER_MAX_HEIGHT = 260;

  const openPopover = () => {
    const rect = btnRef.current.getBoundingClientRect();
    // si no entra hacia abajo (ej. la barra de acciones flotante, anclada
    // cerca del borde inferior) se abre hacia arriba, para que no quede
    // recortado fuera de la pantalla.
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < POPOVER_MAX_HEIGHT && rect.top > spaceBelow;
    setCoords(
      openUpward
        ? { bottom: window.innerHeight - rect.top + 4, left: rect.left, width: rect.width }
        : { top: rect.bottom + 4, left: rect.left, width: rect.width }
    );
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (popRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    // las coordenadas se calculan una sola vez al abrir (position: fixed,
    // no sigue al botón) — si la página scrollea, el popover queda
    // "flotando" en el lugar viejo, ya desconectado del botón que lo abrió.
    // Se cierra apenas hay scroll fuera del propio popover (que sí puede
    // scrollear internamente, para no perder esa interacción).
    const onScroll = (e) => {
      if (popRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    document.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const isAllSelected = allOption && value === allOption.value;
  const selected = categories.find((c) => c.id === value);
  const SelectedIcon = selected ? resolveCategoryIcon(selected) : null;

  return (
    <>
      <button
        type="button"
        ref={btnRef}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openPopover())}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 7, padding: "6px 9px", borderRadius: 7,
          border: `1px solid ${TOKENS.border}`, background: TOKENS.surface, cursor: disabled ? "default" : "pointer",
          opacity: disabled ? 0.6 : 1, textAlign: "left",
        }}
      >
        {isAllSelected ? (
          <>
            <span style={{
              width: 20, height: 20, borderRadius: 6, background: TOKENS.surfaceAlt, display: "flex",
              alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Tags size={12} color={TOKENS.textFaint} />
            </span>
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12.5, color: TOKENS.text }}>
              {allOption.label}
            </span>
          </>
        ) : selected ? (
          <>
            <span style={{
              width: 20, height: 20, borderRadius: 6, background: `${selected.color}22`, display: "flex",
              alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <SelectedIcon size={12} color={selected.color} />
            </span>
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12.5, color: TOKENS.text }}>
              {labelWithTypeIfAmbiguous(selected, categories)}
            </span>
          </>
        ) : (
          <span style={{ flex: 1, fontSize: 12.5, color: TOKENS.textFaint }}>{placeholder}</span>
        )}
        <ChevronDown size={13} color={TOKENS.textFaint} style={{ flexShrink: 0 }} />
      </button>

      {open && coords && createPortal(
        <div
          ref={popRef}
          role="listbox"
          style={{
            position: "fixed", left: coords.left, width: Math.max(coords.width, 200), zIndex: 1000,
            ...(coords.top != null ? { top: coords.top } : { bottom: coords.bottom }),
            background: TOKENS.surfaceAlt, border: `1px solid ${TOKENS.border}`, borderRadius: 10,
            padding: 5, boxShadow: "0 10px 28px rgba(0,0,0,0.45)", maxHeight: POPOVER_MAX_HEIGHT, overflowY: "auto",
          }}
        >
          {allOption && (
            <button
              type="button"
              role="option"
              aria-selected={isAllSelected}
              onClick={() => { onChange(allOption.value); setOpen(false); }}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 7,
                border: "none", background: isAllSelected ? TOKENS.surface : "transparent", cursor: "pointer", textAlign: "left",
              }}
            >
              <span style={{
                width: 22, height: 22, borderRadius: 6, background: TOKENS.bg, display: "flex",
                alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <Tags size={12.5} color={TOKENS.textFaint} />
              </span>
              <span style={{ fontSize: 12.5, color: isAllSelected ? TOKENS.text : TOKENS.textMuted, fontWeight: isAllSelected ? 600 : 400 }}>
                {allOption.label}
              </span>
            </button>
          )}
          {categories.map((c) => {
            const Icon = resolveCategoryIcon(c);
            const isSelected = c.id === value;
            return (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => { onChange(c.id); setOpen(false); }}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 7,
                  border: "none", background: isSelected ? TOKENS.surface : "transparent", cursor: "pointer", textAlign: "left",
                }}
              >
                <span style={{
                  width: 22, height: 22, borderRadius: 6, background: `${c.color}22`, display: "flex",
                  alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <Icon size={12.5} color={c.color} />
                </span>
                <span style={{ fontSize: 12.5, color: isSelected ? TOKENS.text : TOKENS.textMuted, fontWeight: isSelected ? 600 : 400 }}>
                  {labelWithTypeIfAmbiguous(c, categories)}
                </span>
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}
