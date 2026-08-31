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
    <div className="bg-surface border border-border rounded-xl p-[18px] mb-4">
      <div className="flex gap-[3px] p-[3px] mb-4 rounded-full bg-surface-alt border border-border">
        {["expense", "income"].map((v) => (
          <button
            key={v}
            onClick={() => { setType(v); setPickerFor(null); }}
            className={`flex-1 py-2 rounded-full text-[13px] font-semibold cursor-pointer border-0 transition-colors duration-150 ${
              type === v ? "text-bg" : "bg-transparent text-muted"
            }`}
            style={type === v ? { background: v === "expense" ? TOKENS.expense : TOKENS.income } : undefined}
          >
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
      <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-3">
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
              className="flex flex-col items-center gap-1.5 bg-none border-0 cursor-pointer p-0.5"
            >
              <div
                className="w-[46px] h-[46px] rounded-full flex items-center justify-center"
                style={{
                  background: open ? c.color : `${c.color}22`,
                  boxShadow: open ? `0 0 0 2px ${c.color}` : "none",
                }}
              >
                <CatIcon size={19} color={open ? TOKENS.bg : c.color} />
              </div>
              <div
                className={`text-[10.5px] text-center leading-[1.2] overflow-hidden text-ellipsis ${open ? "text-ink" : "text-muted"}`}
                style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
              >
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
          className="flex flex-col items-center gap-1.5 bg-none border-0 cursor-pointer p-0.5"
        >
          <div
            className={`w-[46px] h-[46px] rounded-full flex items-center justify-center border-[1.5px] border-dashed ${
              addingNew ? "bg-accent border-accent" : "bg-transparent border-border"
            }`}
          >
            <Plus size={19} color={addingNew ? TOKENS.bg : TOKENS.textFaint} />
          </div>
          <div className="text-[10.5px] text-muted text-center leading-[1.2]">
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
    <div className="mt-3.5 p-3 bg-surface-alt border border-border rounded-[10px]">
      <div className="flex items-center gap-2 mb-3">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => { if (label.trim() && label.trim() !== cat.label) onRename(cat.id, label.trim()); }}
          className="flex-1 min-w-0 px-2.5 py-2 rounded-lg border border-border bg-surface text-ink text-[13px]"
        />
        <ConfirmDeleteButton
          onConfirm={() => { onDelete(cat.id); onClose(); }}
          text={`Los movimientos en "${cat.label}" van a pasar a Otros. ¿Eliminar la categoría?`}
          title="Eliminar (los movimientos pasan a Otros)"
        />
      </div>

      <div className="text-[10.5px] text-faint mb-2">Tipo</div>
      <div className="flex gap-2 mb-3">
        {[["expense", "Gasto", TOKENS.expense], ["income", "Ingreso", TOKENS.income]].map(([v, text, accent]) => {
          const selected = type === v;
          return (
            <button
              key={v}
              onClick={() => onTypeChange(cat.id, v)}
              aria-pressed={selected}
              className="flex-1 py-[7px] rounded-[7px] text-xs font-semibold cursor-pointer border"
              style={{
                borderColor: selected ? accent : "var(--c-border)",
                background: selected ? `${accent}22` : "transparent",
                color: selected ? accent : "var(--c-text-muted)",
              }}
            >
              {text}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {PALETTE.map((col) => {
          const selected = col === cat.color;
          return (
            <button
              key={col}
              onClick={() => onColorChange(cat.id, col)}
              title={col}
              aria-label={`Usar color ${col}`}
              aria-pressed={selected}
              className="w-[26px] h-[26px] rounded-full cursor-pointer p-0 border-2"
              style={{
                background: col,
                borderColor: selected ? "var(--c-text)" : "transparent",
                boxShadow: selected ? "0 0 0 1px var(--c-surface)" : "none",
              }}
            />
          );
        })}
      </div>

      <div className="text-[10.5px] text-faint mb-2">Ícono</div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {ICON_NAMES.map((name) => {
          const OptionIcon = ICONS[name];
          const selected = (cat.icon || "Shapes") === name;
          return (
            <button
              key={name}
              title={name}
              onClick={() => onIconChange(cat.id, name)}
              className="w-8 h-8 rounded-lg flex items-center justify-center border cursor-pointer p-0"
              style={{
                background: selected ? `${cat.color}33` : "transparent",
                borderColor: selected ? cat.color : "var(--c-border)",
              }}
            >
              <OptionIcon size={15} color={selected ? cat.color : TOKENS.textMuted} />
            </button>
          );
        })}
      </div>

      {isExpense && (
        <>
          <div className="w-full h-px bg-border mt-1 mb-3" />
          <FieldInput
            label="Presupuesto mensual (CLP, opcional)"
            type="number"
            value={budgetInput}
            onChange={setBudgetInput}
            onBlur={() => onBudgetChange(cat.id, budgetInput === "" ? null : parseFloat(budgetInput))}
            placeholder="Sin límite"
            style={{ marginBottom: 12 }}
          />
          <div className="flex items-center justify-between gap-2.5 mb-3">
            <div className="text-xs text-ink">Cuenta como gasto en resúmenes y gráficos</div>
            <ToggleSwitch
              checked={!cat.excludeFromExpense}
              onChange={() => onToggleExpense(cat.id)}
              ariaLabel={`${cat.label} cuenta como gasto`}
            />
          </div>
        </>
      )}

      <div className="w-full h-px bg-border mt-1 mb-3" />
      <div className="flex items-center justify-between gap-2.5">
        <div>
          <div className="text-xs text-ink">Suma al "Total ahorrado"</div>
          <div className="text-[10.5px] text-faint mt-0.5 leading-[1.4]">
            Sus movimientos se acumulan en una tarjeta aparte en Resumen, sin contar como gasto.
          </div>
        </div>
        <ToggleSwitch checked={!!cat.isSavings} onChange={() => onSavingsToggle(cat.id)} ariaLabel='Sumar esta categoría al "Total ahorrado"' />
      </div>
    </div>
  );
}
