// Elimina una categoría solo después de reasignar todas sus referencias.
// Con 0009 la operación es una transacción. Sin ella, conserva la categoría
// si alguna tabla falla; los cambios ya guardados se pueden reintentar.
export async function removeCategorySafely({ id, read, persist, removeAtomic }) {
  if (id === "otros") return { ok: false, error: "La categoría Otros es el destino de las reasignaciones y no se puede eliminar." };
  const categories = read("categories");
  if (!categories.some((c) => c.id === id)) return { ok: true, atomic: false };
  if (!categories.some((c) => c.id === "otros")) return { ok: false, error: "Falta la categoría Otros. Recarga tus datos antes de eliminar categorías." };
  const atomic = await removeAtomic(id);
  if (!atomic.unsupported) return atomic.error ? { ok: false, error: atomic.error } : { ok: true, atomic: true };

  for (const key of ["transactions", "creditTransactions", "subscriptions", "merchantRules"]) {
    const field = key === "merchantRules" ? "categoryId" : "category";
    const rows = read(key);
    if (!rows.some((row) => row[field] === id)) continue;
    const next = rows.map((row) => row[field] === id ? { ...row, [field]: "otros" } : row);
    if (!await persist(key, rows, next)) return { ok: false,
      error: "No se eliminó la categoría porque falló una reasignación. Algunas filas ya pueden estar en Otros; reintenta para completar el cambio." };
  }
  const current = read("categories");
  const ok = await persist("categories", current, current.filter((c) => c.id !== id));
  return { ok, atomic: false, error: ok ? "" : "Las filas ya están en Otros, pero no se pudo eliminar la categoría. Puedes reintentar." };
}
