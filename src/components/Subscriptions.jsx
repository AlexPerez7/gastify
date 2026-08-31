import { useState } from "react";
import { Plus, Repeat } from "lucide-react";
import { TOKENS, resolveCategoryIcon, categoryMatchesType } from "../lib/constants.js";
import { formatCLP } from "../lib/utils.js";
import { ConfirmDeleteButton } from "./ConfirmDeleteButton.jsx";
import { Panel, EmptyState, StatCard, FieldInput, ToggleSwitch, CategorySelect, BTN_PRIMARY, BTN_GHOST } from "./Shared.jsx";

const DEFAULT_CATEGORY_ID = "suscripciones";

export function Subscriptions({ subscriptions, categories, onAdd, onUpdate, onDelete }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const sorted = [...subscriptions].sort((a, b) => a.dayOfMonth - b.dayOfMonth);
  const totalMonthly = subscriptions.filter((s) => s.active).reduce((sum, s) => sum + s.amount, 0);

  return (
    <div className="flex flex-col gap-4">
      {subscriptions.length > 0 && (
        <StatCard label="Total mensual (activas)" value={formatCLP(totalMonthly)} icon={Repeat} accent={TOKENS.text} />
      )}

      <Panel
        title="Suscripciones"
        right={
          !adding && (
            <button
              onClick={() => { setEditingId(null); setAdding(true); }}
              className="flex items-center gap-[5px] px-[11px] py-1.5 rounded-[7px] border-0 bg-accent text-bg text-xs font-semibold cursor-pointer"
            >
              <Plus size={13} /> Agregar
            </button>
          )
        }
      >
        {adding && (
          <SubscriptionForm
            categories={categories}
            onCancel={() => setAdding(false)}
            onSubmit={(values) => { onAdd(values); setAdding(false); }}
          />
        )}

        {sorted.length === 0 && !adding && (
          <EmptyState
            icon={Repeat}
            title="Sin suscripciones declaradas"
            text='Agrega cada cobro recurrente (ej. "Paramount, $6.990, día 19") — la app va a generar el movimiento pendiente ese día y conciliarlo con el cargo real del banco cuando llegue.'
            action={
              <button
                onClick={() => setAdding(true)}
                className="px-4 py-2 rounded-lg border-0 bg-accent text-bg text-[12.5px] font-semibold cursor-pointer"
              >
                Agregar suscripción
              </button>
            }
          />
        )}

        {sorted.map((sub, i) => {
          const cat = categories.find((c) => c.id === sub.category);
          const CatIcon = cat ? resolveCategoryIcon(cat) : Repeat;
          const open = editingId === sub.id;
          return (
            <div key={sub.id}>
              <button
                onClick={() => { setAdding(false); setEditingId(open ? null : sub.id); }}
                aria-expanded={open}
                className={`w-full flex items-center gap-3 px-1 py-3 bg-transparent border-0 cursor-pointer text-left ${
                  i > 0 ? "border-t border-border" : ""
                } ${sub.active ? "opacity-100" : "opacity-50"}`}
              >
                <div
                  className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center"
                  style={{ background: cat ? `${cat.color}22` : "var(--c-surface-alt)" }}
                >
                  <CatIcon size={15} color={cat ? cat.color : TOKENS.textFaint} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-ink overflow-hidden text-ellipsis whitespace-nowrap">{sub.name}</div>
                  <div className="text-[11px] text-faint mt-0.5">
                    Cobra el {sub.dayOfMonth} de cada mes{!sub.active ? " · pausada" : ""}
                  </div>
                </div>
                <div className="mono text-[13px] font-semibold text-ink shrink-0">{formatCLP(sub.amount)}</div>
              </button>

              {open && (
                <div className="pb-3">
                  <SubscriptionForm
                    categories={categories}
                    initial={sub}
                    onCancel={() => setEditingId(null)}
                    onSubmit={(values) => { onUpdate(sub.id, values); setEditingId(null); }}
                    extra={
                      <div className="flex items-center justify-between gap-2.5 mb-3">
                        <div className="text-xs text-ink">Activa</div>
                        <ToggleSwitch checked={sub.active} onChange={(v) => onUpdate(sub.id, { active: v })} ariaLabel={`${sub.name} activa`} />
                      </div>
                    }
                    deleteButton={
                      <ConfirmDeleteButton
                        onConfirm={() => { onDelete(sub.id); setEditingId(null); }}
                        text={`¿Eliminar "${sub.name}"? Los movimientos ya generados no se borran.`}
                        title="Eliminar suscripción"
                      />
                    }
                  />
                </div>
              )}
            </div>
          );
        })}
      </Panel>
    </div>
  );
}

function SubscriptionForm({ categories, initial, onCancel, onSubmit, extra, deleteButton }) {
  const [name, setName] = useState(initial?.name || "");
  const [amount, setAmount] = useState(initial?.amount != null ? String(initial.amount) : "");
  const [dayOfMonth, setDayOfMonth] = useState(initial?.dayOfMonth != null ? String(initial.dayOfMonth) : "1");
  const [category, setCategory] = useState(
    initial?.category || (categories.some((c) => c.id === DEFAULT_CATEGORY_ID) ? DEFAULT_CATEGORY_ID : categories[0]?.id || "")
  );

  const amountN = parseFloat(amount);
  const dayN = parseInt(dayOfMonth, 10);
  const valid = name.trim() !== "" && amountN > 0 && dayN >= 1 && dayN <= 31 && !!category;

  const submit = () => {
    if (!valid) return;
    onSubmit({ name: name.trim(), amount: amountN, dayOfMonth: dayN, category });
  };

  return (
    <div
      className="mb-3.5 p-3 bg-surface-alt border border-border rounded-[10px]"
      style={{ marginTop: initial ? 0 : 14 }}
    >
      <div className="flex items-end gap-2 mb-2.5">
        <FieldInput label="Nombre" value={name} onChange={setName} placeholder="Ej. Paramount" style={{ flex: 1 }} />
        {deleteButton}
      </div>
      <div className="flex gap-2 mb-2.5">
        <FieldInput label="Monto (CLP)" type="number" value={amount} onChange={setAmount} placeholder="0" style={{ flex: 1 }} />
        <FieldInput label="Día del mes" type="number" min="1" max="31" value={dayOfMonth} onChange={setDayOfMonth} style={{ width: 100 }} />
      </div>
      <div className="mb-3">
        <div className="text-[11px] text-faint mb-1">Categoría</div>
        <CategorySelect categories={categories.filter((c) => categoryMatchesType(c, "expense"))} value={category} onChange={setCategory} />
      </div>
      {extra}
      <div className="flex gap-2">
        <button onClick={submit} disabled={!valid} className={BTN_PRIMARY}>
          {initial ? "Guardar" : "Crear"}
        </button>
        <button onClick={onCancel} className={BTN_GHOST}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
