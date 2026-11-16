// Una cola por tabla: cada intención se calcula contra la foto que vio quien
// editó, pero se guarda sobre lo último confirmado. Así una foto vieja no
// borra altas recientes ni vuelve a aplicar campos de un guardado rechazado.
/** @typedef {{ id: string, [field: string]: any }} Row */

/** @param {Row[]} prev @param {Row[]} next */
function changesBetween(prev, next) {
  const before = new Map(prev.map((row) => [row.id, row]));
  const after = new Map(next.map((row) => [row.id, row]));
  return {
    removed: new Set(prev.filter((row) => !after.has(row.id)).map((row) => row.id)),
    added: next.filter((row) => !before.has(row.id)),
    edited: next.filter((row) => before.has(row.id)).map((row) => {
      const old = before.get(row.id);
      const fields = new Set([...Object.keys(old), ...Object.keys(row)]);
      return { id: row.id, fields: [...fields].filter((field) => old[field] !== row[field])
        .map((field) => ({ field, value: row[field], present: Object.hasOwn(row, field) })) };
    }).filter((edit) => edit.fields.length > 0),
  };
}

/** @param {Row[]} rows @param {ReturnType<typeof changesBetween>} changes */
function applyChanges(rows, changes) {
  const result = new Map(rows.filter((row) => !changes.removed.has(row.id)).map((row) => [row.id, row]));
  for (const row of changes.added) result.set(row.id, row);
  for (const { id, fields } of changes.edited) {
    // Editar una alta que falló no debe resucitarla como si se hubiera guardado.
    if (!result.has(id)) continue;
    const row = { ...result.get(id) };
    for (const { field, value, present } of fields) {
      if (present) row[field] = value;
      else delete row[field];
    }
    result.set(id, row);
  }
  return [...result.values()];
}

/**
 * @param {{ write: (key: string, value: string, prev: Row[]) => Promise<any>,
 *   onChange: (key: string, rows: Row[]) => void }} options
 */
export function createPersistenceQueue({ write, onChange }) {
  /** @type {Map<string, {confirmed: Row[], pending: any[], running: boolean, version: number}>} */
  const tables = new Map();
  const tableOf = (key, initial = []) => {
    if (!tables.has(key)) tables.set(key, { confirmed: initial, pending: [], running: false, version: 0 });
    return tables.get(key);
  };
  const publish = (key, table) => onChange(key,
    table.pending.reduce((rows, entry) => applyChanges(rows, entry.changes), table.confirmed));

  async function drain(key, table) {
    if (table.running) return;
    table.running = true;
    try {
      while (table.pending.length > 0) {
        const entry = table.pending[0];
        const next = applyChanges(table.confirmed, entry.changes);
        let result;
        try {
          const ids = new Set(table.confirmed.map((row) => row.id));
          if (entry.changes.edited.some(({ id }) => !ids.has(id))) {
            throw new Error("El registro que intentas editar no se guardó o ya fue eliminado. Vuelve a cargarlo antes de editar.");
          }
          result = await write(key, JSON.stringify(next), table.confirmed);
        } catch (error) {
          result = { key, error: error?.message || String(error) };
        }
        if (result && !result.error) table.confirmed = next;
        table.pending.shift();
        // Invalida también lecturas iniciadas mientras el request de guardado
        // estaba en vuelo y que recién responden cuando la cola quedó vacía.
        table.version += 1;
        // Se reconstruye la vista con las intenciones restantes, sin la que
        // falló. El rollback nunca restaura una foto completa de React.
        publish(key, table);
        entry.resolve(result);
      }
    } finally {
      table.running = false;
    }
  }

  return {
    /** @param {string} key @param {Row[]} prev @param {Row[]} next */
    persist(key, prev, next) {
      const table = tableOf(key, prev);
      table.version += 1;
      const changes = changesBetween(prev, next);
      const result = new Promise((resolve) => table.pending.push({ changes, resolve }));
      publish(key, table);
      void drain(key, table);
      return result;
    },
    version(key) { return tableOf(key).version; },
    // Una lectura iniciada antes de editar (aunque termine después del save)
    // tampoco puede reemplazar el estado confirmado con una respuesta vieja.
    /** @param {string} key @param {Row[]} rows @param {number} version */
    acceptLoad(key, rows, version) {
      const table = tableOf(key);
      if (table.pending.length > 0 || table.version !== version) return false;
      table.confirmed = rows;
      table.version += 1;
      publish(key, table);
      return true;
    },
  };
}
