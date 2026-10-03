# src/hooks — conexión entre la lógica y React

> Parte del contexto de Gastify. Índice y reglas generales en el
> [CLAUDE.md principal](../../CLAUDE.md). La lógica pura que usan estos hooks
> está en [`src/lib/`](../lib/CLAUDE.md).

Los hooks no deberían tener lógica de negocio propia: arman el siguiente
estado con funciones puras de `src/lib/` y lo persisten. Si algo se puede
testear sin React, va a `src/lib/` con su test.

## Hooks de dominio (los compone App.jsx)

```js
const data = useAppData();                                    // estado + persist*
const txActions = useTransactionActions(data, { onManualAdded });
const catalog = useCatalogActions(data);
const importers = useImporters(data, { pushToast, updateToast });
const derived = useDerivedData(data, { search, catFilter, txTypeFilter, sourceFilter });
```

| Hook | Responsabilidad |
| --- | --- |
| `useAppData` | **Único dueño del estado de datos** (transactions, creditTransactions, creditStatements, categories, merchantRules, subscriptions, accountSettings). Carga inicial, recarga al volver a la pestaña (si no hay guardados en vuelo), aviso `beforeunload`, `runPersist` optimista con rollback, `persistX` por entidad, `lastPersistError`, cargos de suscripción una vez por sesión, ajuste de saldo/ahorro base |
| `useTransactionActions` | alta/borrado/edición de movimientos débito y crédito (borrar es inmediato + aviso "Deshacer" que reinserta las mismas filas), acciones masivas, regla de comercio retroactiva, vincular a suscripción, conciliación (`reconcileMonth`, `editManualEntry`, `manualMatch`) |
| `useCatalogActions` | CRUD de categorías (borrar una mueve sus movimientos y suscripciones a `"otros"`) y suscripciones |
| `useImporters` | lectura de archivos con progreso, toasts, candado contra doble importación por flujo (`useImportLock`), conciliación automática de saldo, `recentImportIds` |
| `useDerivedData` | `getCat`, mes seleccionado de débito y crédito (por defecto el más reciente, una sola vez), y todos los derivados memoizados de `src/lib/stats.js` |

## Hooks de UI

`useTheme` (`data-theme` en `<html>`), `useIsMobile` (breakpoint 640px),
`useToasts` (`push(type, text, progress?, { action?, duration? })`, `update`,
`dismiss`, `pause`/`resume`; tipos `ok` | `warn` | `error` | `loading`; los
`error` no se cierran solos).
`useLongPress(cb)` → `{ handlers, consumeClick }`: toque largo de 450ms (se
cancela si el dedo se mueve); el `onClick` del elemento debe empezar con
`if (consumeClick()) return;`. Lo usan las filas de Movimientos en mobile
para entrar al modo selección.

## Convenciones

- Las acciones reciben el estado **actual** por closure (se recrean con
  `useCallback` cuando cambia); llaman a un `persistX(next)` que devuelve
  `Promise<boolean>`.
- Para leer el error real después de un `await persistX(...)`, usar
  `data.lastPersistError.current` (el estado `syncError` llega tarde).
- Importaciones: un ref como candado (no estado), porque dos llamadas en
  paralelo verían la misma foto de los datos y duplicarían filas.
- Los `eslint-disable react-hooks/exhaustive-deps` que hay son deliberados y
  llevan el motivo al lado; mantener ese formato si se agrega otro.
