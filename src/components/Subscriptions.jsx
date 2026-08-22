import { useState } from "react";
import { Plus, Repeat } from "lucide-react";
import { TOKENS, resolveCategoryIcon, categoryMatchesType } from "../lib/constants.js";
import { formatCLP } from "../lib/utils.js";
import { ConfirmDeleteButton } from "./ConfirmDeleteButton.jsx";
import { Panel, EmptyState, StatCard, FieldInput, ToggleSwitch, CategorySelect } from "./Shared.jsx";

const DEFAULT_CATEGORY_ID = "suscripciones";

export function Subscriptions({ subscriptions, categories, onAdd, onUpdate, onDelete }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const sorted = [...subscriptions].sort((a, b) => a.dayOfMonth - b.dayOfMonth);
  const totalMonthly = subscriptions.filter((s) => s.active).reduce((sum, s) => sum + s.amount, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {subscriptions.length > 0 && (
        <StatCard label="Total mensual (activas)" value={formatCLP(totalMonthly)} icon={Repeat} accent={TOKENS.text} />
      )}

      <Panel
        title="Suscripciones"
        right={
          !adding && (
            <button
              onClick={() => { setEditingId(null); setAdding(true); }}
              style={{
                display: "flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 7,
                border: "none", background: TOKENS.accent, color: TOKENS.bg, fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}
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
                style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: TOKENS.accent, color: TOKENS.bg, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
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
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 4px",
                  background: "none", border: "none", cursor: "pointer", textAlign: "left",
                  borderTop: i > 0 ? `1px solid ${TOKENS.border}` : "none",
                  opacity: sub.active ? 1 : 0.5,
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  background: cat ? `${cat.color}22` : TOKENS.surfaceAlt,
                }}>
                  <CatIcon size={15} color={cat ? cat.color : TOKENS.textFaint} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: TOKENS.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub.name}</div>
                  <div style={{ fontSize: 11, color: TOKENS.textFaint, marginTop: 2 }}>
                    Cobra el {sub.dayOfMonth} de cada mes{!sub.active ? " · pausada" : ""}
                  </div>
                </div>
                <div className="mono" style={{ fontSize: 13, fontWeight: 600, color: TOKENS.text, flexShrink: 0 }}>{formatCLP(sub.amount)}</div>
              </button>

              {open && (
                <div style={{ paddingBottom: 12 }}>
                  <SubscriptionForm
                    categories={categories}
                    initial={sub}
                    onCancel={() => setEditingId(null)}
                    onSubmit={(values) => { onUpdate(sub.id, values); setEditingId(null); }}
                    extra={
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
                        <div style={{ fontSize: 12, color: TOKENS.text }}>Activa</div>
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
    <div style={{ marginTop: initial ? 0 : 14, marginBottom: 14, padding: 12, background: TOKENS.surfaceAlt, border: `1px solid ${TOKENS.border}`, borderRadius: 10 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 10 }}>
        <FieldInput label="Nombre" value={name} onChange={setName} placeholder="Ej. Paramount" style={{ flex: 1 }} />
        {deleteButton}
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <FieldInput label="Monto (CLP)" type="number" value={amount} onChange={setAmount} placeholder="0" style={{ flex: 1 }} />
        <FieldInput label="Día del mes" type="number" min="1" max="31" value={dayOfMonth} onChange={setDayOfMonth} style={{ width: 100 }} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: TOKENS.textFaint, marginBottom: 4 }}>Categoría</div>
        <CategorySelect categories={categories.filter((c) => categoryMatchesType(c, "expense"))} value={category} onChange={setCategory} />
      </div>
      {extra}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={submit}
          disabled={!valid}
          style={{
            padding: "7px 14px", borderRadius: 7, border: "none", fontSize: 12, fontWeight: 600,
            background: TOKENS.accent, color: TOKENS.bg, cursor: valid ? "pointer" : "default", opacity: valid ? 1 : 0.6,
          }}
        >
          {initial ? "Guardar" : "Crear"}
        </button>
        <button onClick={onCancel} style={{ padding: "7px 14px", borderRadius: 7, border: `1px solid ${TOKENS.border}`, background: "transparent", color: TOKENS.textMuted, fontSize: 12, cursor: "pointer" }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
