import { useState } from "react";
import { Plus } from "lucide-react";
import { TOKENS, ICONS, ICON_NAMES, PALETTE, resolveCategoryIcon, categoryType } from "../lib/constants.js";
import { ConfirmDeleteButton } from "./ConfirmDeleteButton.jsx";
import { ToggleSwitch, FieldInput, CategoryQuickAdd } from "./Shared.jsx";

export function CategoryManager({ categories, onAdd, onRename, onDelete, onIconChange, onColorChange, onToggleExpense, onBudgetChange, onTypeChange, onSavingsToggle }) {
  const [type, setType] = useState("expense");
  // "new" identifica el tile "+"; cualquier otro valor es el id de una
  // categoría existente que se está editando.
  const [pickerFor, setPickerFor] = useState(null);

  const cats = categories.filter((c) => categoryType(c) === type);

  return (
    <div style={{ background: TOKENS.surface, border: `1px solid ${TOKENS.border}`, borderRadius: 12, padding: 18, marginBottom: 16 }}>
      <div style={{
        display: "flex", gap: 3, padding: 3, marginBottom: 16, borderRadius: 999,
        background: TOKENS.surfaceAlt, border: `1px solid ${TOKENS.border}`,
      }}>
        {["expense", "income"].map((v) => (
          <button key={v} onClick={() => { setType(v); setPickerFor(null); }} style={{
            flex: 1, padding: "8px 0", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none",
            background: type === v ? (v === "expense" ? TOKENS.expense : TOKENS.income) : "transparent",
            color: type === v ? TOKENS.bg : TOKENS.textMuted,
            transition: "background 150ms ease, color 150ms ease",
          }}>
            {v === "expense" ? "Gasto" : "Ingreso"}
          </button>
        ))}
      </div>

      <CategorySection
        key={type}
        type={type} cats={cats} pickerFor={pickerFor} setPickerFor={setPickerFor}
        onAdd={onAdd} onRename={onRename} onDelete={onDelete} onIconChange={onIconChange} onColorChange={onColorChange}
        onToggleExpense={onToggleExpense} onBudgetChange={onBudgetChange} onTypeChange={onTypeChange} onSavingsToggle={onSavingsToggle}
      />
    </div>
  );
}

function CategorySection({
  type, cats, pickerFor, setPickerFor,
  onAdd, onRename, onDelete, onIconChange, onColorChange, onToggleExpense, onBudgetChange, onTypeChange, onSavingsToggle,
}) {
  const newTileId = `new-${type}`;
  const addingNew = pickerFor === newTileId;
  const editingCat = cats.find((c) => c.id === pickerFor);

  return (
    <div className="tab-panel">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))", gap: 12 }}>
        {cats.map((c) => {
          const CatIcon = resolveCategoryIcon(c);
          const open = pickerFor === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setPickerFor(open ? null : c.id)}
              aria-pressed={open}
              aria-expanded={open}
              title={`Editar ${c.label}`}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", padding: 2 }}
            >
              <div style={{
                width: 46, height: 46, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                background: open ? c.color : `${c.color}22`,
                boxShadow: open ? `0 0 0 2px ${c.color}` : "none",
              }}>
                <CatIcon size={19} color={open ? TOKENS.bg : c.color} />
              </div>
              <div style={{
                fontSize: 10.5, color: open ? TOKENS.text : TOKENS.textMuted, textAlign: "center", lineHeight: 1.2,
                overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
              }}>
                {c.label}
              </div>
            </button>
          );
        })}

        <button
          onClick={() => setPickerFor(addingNew ? null : newTileId)}
          aria-pressed={addingNew}
          aria-expanded={addingNew}
          title={`Crear categoría de ${type === "expense" ? "gasto" : "ingreso"}`}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", padding: 2 }}
        >
          <div style={{
            width: 46, height: 46, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
            background: addingNew ? TOKENS.accent : "transparent",
            border: `1.5px dashed ${addingNew ? TOKENS.accent : TOKENS.border}`,
          }}>
            <Plus size={19} color={addingNew ? TOKENS.bg : TOKENS.textFaint} />
          </div>
          <div style={{ fontSize: 10.5, color: TOKENS.textMuted, textAlign: "center", lineHeight: 1.2 }}>
            Nueva
          </div>
        </button>
      </div>

      {addingNew && (
        <div className="tab-panel">
          <CategoryQuickAdd
            type={type}
            onAdd={() => setPickerFor(null)}
            onAddCategory={onAdd}
            onCancel={() => setPickerFor(null)}
          />
        </div>
      )}

      {editingCat && (
        <div className="tab-panel">
          <CategoryEditPanel
            key={editingCat.id}
            cat={editingCat}
            onRename={onRename} onDelete={onDelete} onIconChange={onIconChange} onColorChange={onColorChange}
            onToggleExpense={onToggleExpense} onBudgetChange={onBudgetChange} onTypeChange={onTypeChange} onSavingsToggle={onSavingsToggle}
            onClose={() => setPickerFor(null)}
          />
        </div>
      )}
    </div>
  );
}

// panel de edición de una categoría existente: nombre, tipo, color, ícono,
// presupuesto (solo gasto), si cuenta como gasto (solo gasto) y si suma al
// ahorro — se abre debajo de la grilla al tocar su tile.
function CategoryEditPanel({ cat, onRename, onDelete, onIconChange, onColorChange, onToggleExpense, onBudgetChange, onTypeChange, onSavingsToggle, onClose }) {
  const [label, setLabel] = useState(cat.label);
  const [budgetInput, setBudgetInput] = useState(cat.budget != null ? String(cat.budget) : "");
  const type = categoryType(cat);
  const isExpense = type === "expense";

  return (
    <div style={{ marginTop: 14, padding: 12, background: TOKENS.surfaceAlt, border: `1px solid ${TOKENS.border}`, borderRadius: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => { if (label.trim() && label.trim() !== cat.label) onRename(cat.id, label.trim()); }}
          style={{ flex: 1, minWidth: 0, padding: "8px 10px", borderRadius: 8, border: `1px solid ${TOKENS.border}`, background: TOKENS.surface, color: TOKENS.text, fontSize: 13 }}
        />
        <ConfirmDeleteButton
          onConfirm={() => { onDelete(cat.id); onClose(); }}
          text={`Los movimientos en "${cat.label}" van a pasar a Otros. ¿Eliminar la categoría?`}
          title="Eliminar (los movimientos pasan a Otros)"
        />
      </div>

      <div style={{ fontSize: 10.5, color: TOKENS.textFaint, marginBottom: 8 }}>Tipo</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {[["expense", "Gasto", TOKENS.expense], ["income", "Ingreso", TOKENS.income]].map(([v, text, accent]) => {
          const selected = type === v;
          return (
            <button
              key={v}
              onClick={() => onTypeChange(cat.id, v)}
              aria-pressed={selected}
              style={{
                flex: 1, padding: "7px 0", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer",
                border: `1px solid ${selected ? accent : TOKENS.border}`,
                background: selected ? `${accent}22` : "transparent",
                color: selected ? accent : TOKENS.textMuted,
              }}
            >
              {text}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {PALETTE.map((col) => {
          const selected = col === cat.color;
          return (
            <button
              key={col}
              onClick={() => onColorChange(cat.id, col)}
              title={col}
              aria-label={`Usar color ${col}`}
              aria-pressed={selected}
              style={{
                width: 26, height: 26, borderRadius: "50%", background: col, cursor: "pointer", padding: 0,
                border: selected ? `2px solid ${TOKENS.text}` : "2px solid transparent", boxShadow: selected ? `0 0 0 1px ${TOKENS.surface}` : "none",
              }}
            />
          );
        })}
      </div>

      <div style={{ fontSize: 10.5, color: TOKENS.textFaint, marginBottom: 8 }}>Ícono</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {ICON_NAMES.map((name) => {
          const OptionIcon = ICONS[name];
          const selected = (cat.icon || "Shapes") === name;
          return (
            <button
              key={name}
              title={name}
              onClick={() => onIconChange(cat.id, name)}
              style={{
                width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                background: selected ? `${cat.color}33` : "transparent",
                border: `1px solid ${selected ? cat.color : TOKENS.border}`, cursor: "pointer", padding: 0,
              }}
            >
              <OptionIcon size={15} color={selected ? cat.color : TOKENS.textMuted} />
            </button>
          );
        })}
      </div>

      {isExpense && (
        <>
          <div style={{ width: "100%", height: 1, background: TOKENS.border, margin: "4px 0 12px" }} />
          <FieldInput
            label="Presupuesto mensual (CLP, opcional)"
            type="number"
            value={budgetInput}
            onChange={setBudgetInput}
            onBlur={() => onBudgetChange(cat.id, budgetInput === "" ? null : parseFloat(budgetInput))}
            placeholder="Sin límite"
            style={{ marginBottom: 12 }}
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: TOKENS.text }}>Cuenta como gasto en resúmenes y gráficos</div>
            <ToggleSwitch
              checked={!cat.excludeFromExpense}
              onChange={() => onToggleExpense(cat.id)}
              ariaLabel={`${cat.label} cuenta como gasto`}
            />
          </div>
        </>
      )}

      <div style={{ width: "100%", height: 1, background: TOKENS.border, margin: "4px 0 12px" }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div>
          <div style={{ fontSize: 12, color: TOKENS.text }}>Suma al "Total ahorrado"</div>
          <div style={{ fontSize: 10.5, color: TOKENS.textFaint, marginTop: 2, lineHeight: 1.4 }}>
            Sus movimientos se acumulan en una tarjeta aparte en Resumen, sin contar como gasto.
          </div>
        </div>
        <ToggleSwitch checked={!!cat.isSavings} onChange={() => onSavingsToggle(cat.id)} ariaLabel='Sumar esta categoría al "Total ahorrado"' />
      </div>
    </div>
  );
}
