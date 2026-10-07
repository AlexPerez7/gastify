import { useMemo, useState } from "react";
import { Plus, Wand2 } from "lucide-react";
import { TOKENS, resolveCategoryIcon, labelWithTypeIfAmbiguous } from "../lib/constants.js";
import { formatCLP, formatDateDisplay, compileRuleRegex, uid } from "../lib/utils.js";
import { ConfirmDeleteButton } from "./ConfirmDeleteButton.jsx";
import { Panel, EmptyState, FieldInput, CategorySelect } from "./Shared.jsx";
import { BTN_PRIMARY, BTN_GHOST } from "./classes.js";

const MATCH_TYPE_LABELS = {
  contains: "contiene",
  startsWith: "empieza con",
  endsWith: "termina con",
  equals: "es exactamente",
  regex: "calza con regex",
};

// "entre $400.000 y $500.000", "desde $10.000", "hasta $5.000" o "" sin rango
function amountRangeText({ minAmount, maxAmount }) {
  if (minAmount != null && maxAmount != null) {
    return minAmount === maxAmount ? `de ${formatCLP(minAmount)}` : `entre ${formatCLP(minAmount)} y ${formatCLP(maxAmount)}`;
  }
  if (minAmount != null) return `desde ${formatCLP(minAmount)}`;
  if (maxAmount != null) return `hasta ${formatCLP(maxAmount)}`;
  return "";
}

// Pantalla de reglas de comercio (pestaña Categorías). Antes las reglas solo
// nacían de "Recordar esto" al editar un movimiento y no había dónde verlas;
// acá se listan, se editan con tipo de coincidencia y rango de monto, y se
// pueden aplicar a lo ya importado con vista previa de qué cambiaría.
export function RulesManager({ rules, categories, onSave, onDelete, onPreview, onApply, pushToast }) {
  const [editingId, setEditingId] = useState(null); // id, "new" o null
  const [applyFor, setApplyFor] = useState(null); // regla cuya vista previa se muestra
  const [query, setQuery] = useState("");

  const sorted = useMemo(() => {
    const q = query.trim().toUpperCase();
    return [...rules]
      .filter((r) => !q || r.matchText.toUpperCase().includes(q) || (r.alias || "").toUpperCase().includes(q))
      .sort((a, b) => a.matchText.localeCompare(b.matchText, "es"));
  }, [rules, query]);

  const save = async (rule) => {
    setEditingId(null);
    const ok = await onSave(rule);
    if (ok === false) pushToast?.("error", "No se pudo guardar la regla. Revisa tu conexión e inténtalo de nuevo.");
    else setApplyFor(rule);
  };

  return (
    <Panel
      title="Reglas de comercio"
      right={
        editingId !== "new" && (
          <button
            onClick={() => { setApplyFor(null); setEditingId("new"); }}
            className="flex items-center gap-[5px] px-[11px] py-1.5 rounded-[7px] border-0 bg-accent text-bg text-small font-semibold cursor-pointer"
          >
            <Plus size={13} /> Nueva regla
          </button>
        )
      }
    >
      <div className="text-small text-muted mb-3 leading-[1.4]">
        Al importar, cada movimiento toma la categoría (y el nombre) de la regla que le calce. Si varias calzan, gana la que
        tiene rango de monto y después la de texto más largo.
      </div>

      {editingId === "new" && (
        <RuleForm categories={categories} onCancel={() => setEditingId(null)} onSubmit={save} />
      )}

      {applyFor && (
        <ApplyPreview
          rule={applyFor} categories={categories} onPreview={onPreview}
          onApply={async () => {
            const ok = await onApply(applyFor);
            pushToast?.(ok ? "ok" : "error", ok ? "Regla aplicada a los movimientos existentes." : "No se pudo aplicar la regla.");
            setApplyFor(null);
          }}
          onClose={() => setApplyFor(null)}
        />
      )}

      {rules.length > 8 && (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar regla…"
          aria-label="Buscar regla"
          className="w-full px-2.5 py-2 mb-2 rounded-lg border border-border bg-surface text-ink text-body"
        />
      )}

      {rules.length === 0 && editingId !== "new" && (
        <EmptyState
          icon={Wand2}
          title="Sin reglas todavía"
          text='Se crean solas al editar un movimiento con "Recordar esto", o puedes armar una acá (ej. una transferencia de $450.000 a tu arrendador = Arriendo).'
        />
      )}

      {sorted.map((rule, i) => {
        const cat = categories.find((c) => c.id === rule.categoryId);
        const CatIcon = cat ? resolveCategoryIcon(cat) : Wand2;
        const open = editingId === rule.id;
        const range = amountRangeText(rule);
        return (
          <div key={rule.id}>
            <button
              onClick={() => { setApplyFor(null); setEditingId(open ? null : rule.id); }}
              aria-expanded={open}
              className={`w-full flex items-center gap-3 px-1 py-3 bg-transparent border-0 cursor-pointer text-left ${i > 0 ? "border-t border-border" : ""}`}
            >
              <div
                className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center"
                style={{ background: cat ? `${cat.color}22` : "var(--c-surface-alt)" }}
              >
                <CatIcon size={15} color={cat ? cat.color : TOKENS.textFaint} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-body text-ink overflow-hidden text-ellipsis whitespace-nowrap">
                  <span className="text-faint">{MATCH_TYPE_LABELS[rule.matchType || "contains"]} </span>
                  <span className="mono">{rule.matchText}</span>
                </div>
                <div className="text-caption text-faint mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap">
                  {cat ? labelWithTypeIfAmbiguous(cat, categories) : rule.categoryId}
                  {rule.alias ? ` · "${rule.alias}"` : ""}
                  {range ? ` · ${range}` : ""}
                </div>
              </div>
            </button>
            {open && (
              <div className="pb-3">
                <RuleForm
                  categories={categories}
                  initial={rule}
                  onCancel={() => setEditingId(null)}
                  onSubmit={save}
                  extra={
                    <button
                      type="button"
                      onClick={() => { setEditingId(null); setApplyFor(rule); }}
                      className={`${BTN_GHOST} ml-auto`}
                      title="Ver qué movimientos ya cargados cambiarían con esta regla"
                    >
                      Aplicar a lo existente
                    </button>
                  }
                  deleteButton={
                    <ConfirmDeleteButton
                      onConfirm={() => { onDelete(rule.id); setEditingId(null); }}
                      text="¿Eliminar esta regla? Los movimientos ya categorizados no cambian."
                      title="Eliminar regla"
                    />
                  }
                />
              </div>
            )}
          </div>
        );
      })}
    </Panel>
  );
}

function RuleForm({ categories, initial, onCancel, onSubmit, extra, deleteButton }) {
  const [matchType, setMatchType] = useState(initial?.matchType || "contains");
  const [matchText, setMatchText] = useState(initial?.matchText || "");
  const [minAmount, setMinAmount] = useState(initial?.minAmount != null ? String(initial.minAmount) : "");
  const [maxAmount, setMaxAmount] = useState(initial?.maxAmount != null ? String(initial.maxAmount) : "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId || "");
  const [alias, setAlias] = useState(initial?.alias || "");

  const parse = (v) => (v.trim() === "" ? null : Number(v.replace(/\D/g, "")));
  const min = parse(minAmount);
  const max = parse(maxAmount);
  const badRegex = matchType === "regex" && matchText.trim() !== "" && !compileRuleRegex(matchText.trim());
  const badRange = min != null && max != null && min > max;
  const valid = matchText.trim() !== "" && !!categoryId && !badRegex && !badRange;

  const submit = () => {
    if (!valid) return;
    onSubmit({
      id: initial?.id || uid(),
      matchType, matchText: matchText.trim(), minAmount: min, maxAmount: max, categoryId, alias: alias.trim(),
    });
  };

  return (
    <div className="mb-3.5 p-3 bg-surface-alt border border-border rounded-[10px]" style={{ marginTop: initial ? 0 : 4 }}>
      <div className="flex items-end gap-2 mb-2.5 flex-wrap">
        <label className="flex-[0_1_170px]">
          <span className="block text-caption text-faint mb-1">La descripción…</span>
          <select
            value={matchType}
            onChange={(e) => setMatchType(e.target.value)}
            className="w-full px-2.5 py-2 rounded-lg border border-border bg-surface text-ink text-body cursor-pointer"
          >
            {Object.entries(MATCH_TYPE_LABELS).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
        </label>
        <FieldInput
          label={matchType === "regex" ? "Expresión regular" : "Texto"} value={matchText} onChange={setMatchText}
          placeholder={matchType === "regex" ? "Ej. ^TRANSF.*PEREZ" : "Ej. UBER EATS"} style={{ flex: "1 1 180px" }}
        />
        {deleteButton}
      </div>
      {badRegex && <div className="text-caption text-expense -mt-1.5 mb-2.5">La expresión regular no es válida.</div>}

      <div className="text-caption text-faint mb-1">Monto (opcional, sin signo: sirve igual para gastos e ingresos)</div>
      <div className="flex gap-2 mb-1">
        <FieldInput label="Desde ($)" inputMode="numeric" value={minAmount} onChange={setMinAmount} placeholder="Sin mínimo" style={{ flex: 1 }} />
        <FieldInput label="Hasta ($)" inputMode="numeric" value={maxAmount} onChange={setMaxAmount} placeholder="Sin máximo" style={{ flex: 1 }} />
      </div>
      {badRange && <div className="text-caption text-expense mb-1">El mínimo es mayor que el máximo.</div>}
      <div className="mb-2.5" />

      <div className="flex gap-2 mb-3 flex-wrap">
        <div className="flex-[1_1_180px]">
          <div className="text-caption text-faint mb-1">Categoría</div>
          <CategorySelect categories={categories} value={categoryId} onChange={setCategoryId} />
        </div>
        <FieldInput label="Nombre para mostrar (opcional)" value={alias} onChange={setAlias} placeholder="Ej. Arriendo" style={{ flex: "1 1 180px" }} />
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={submit} disabled={!valid} className={BTN_PRIMARY}>
          {initial ? "Guardar" : "Crear"}
        </button>
        <button onClick={onCancel} className={BTN_GHOST}>Cancelar</button>
        {extra}
      </div>
    </div>
  );
}

// Vista previa de "aplicar a lo existente": qué movimientos ya cargados
// cambiarían (débito: solo los del banco; tarjeta: todos) antes de confirmar.
const PREVIEW_MAX = 5;

function ApplyPreview({ rule, categories, onPreview, onApply, onClose }) {
  const { debit, credit } = useMemo(() => onPreview(rule), [onPreview, rule]);
  const [applying, setApplying] = useState(false);
  const all = [...debit, ...credit];
  const cat = categories.find((c) => c.id === rule.categoryId);

  return (
    <div className="mb-3.5 p-3 rounded-[10px] border border-accent bg-tint-accent-soft">
      {all.length === 0 ? (
        <div className="flex items-center gap-2.5">
          <div className="text-small text-ink flex-1">Ningún movimiento ya cargado cambia con esta regla.</div>
          <button onClick={onClose} className={BTN_GHOST}>Cerrar</button>
        </div>
      ) : (
        <>
          <div className="text-small text-ink mb-2">
            ¿Aplicarla a lo ya cargado? Pasarían a <b>{cat?.label || rule.categoryId}</b>{" "}
            {all.length} movimiento{all.length === 1 ? "" : "s"}
            {credit.length > 0 && debit.length > 0 ? ` (${debit.length} de débito y ${credit.length} de la tarjeta)` : ""}:
          </div>
          <ul className="m-0 mb-2.5 p-0 list-none flex flex-col gap-1">
            {all.slice(0, PREVIEW_MAX).map((t) => (
              <li key={t.id} className="flex justify-between gap-2 text-caption text-muted">
                <span className="overflow-hidden text-ellipsis whitespace-nowrap">{formatDateDisplay(t.date)} · {t.alias || t.description}</span>
                <span className="mono shrink-0">{formatCLP(t.amount)}</span>
              </li>
            ))}
            {all.length > PREVIEW_MAX && <li className="text-caption text-faint">y {all.length - PREVIEW_MAX} más</li>}
          </ul>
          <div className="flex gap-2">
            <button
              onClick={async () => { setApplying(true); await onApply(); }}
              disabled={applying}
              className={BTN_PRIMARY}
            >
              {applying ? "Aplicando…" : `Aplicar a ${all.length}`}
            </button>
            <button onClick={onClose} className={BTN_GHOST}>Ahora no</button>
          </div>
        </>
      )}
    </div>
  );
}
