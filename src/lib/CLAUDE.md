# src/lib — capa de datos y lógica pura

> Parte del contexto de Gastify. Índice y reglas generales en el
> [CLAUDE.md principal](../../CLAUDE.md).

Aquí no hay componentes ni hooks (esos van en `src/hooks/`, ver
[`src/hooks/CLAUDE.md`](../hooks/CLAUDE.md)). Hay dos tipos de archivo:
**lógica pura** (testeable, sin React ni Supabase) y **adaptadores de Supabase**.

## Mapa de archivos

| Archivo | Tipo | Qué hace |
| --- | --- | --- |
| `types.js` | tipos | `@typedef` de Transaction, Category, MerchantRule, Subscription, CreditTransaction, CreditStatement, AccountSettings. No exporta nada en runtime |
| `utils.js` | puro | parseo CLP/fechas, `makeKey`/`makeCreditKey`, categorización, aritmética de meses, `groupByDate`, `formatDayHeading`, `uid`, `computeInsights` |
| `reconcile.js` | puro | `reconcileMonthTransactions`, `matchManualToBank`, `findDuplicateIds` |
| `stats.js` | puro | derivados: listas de meses, filtros, stats del mes, por categoría/mes, `computeHeroStat`, saldo dinámico, total ahorrado, conciliación, crédito |
| `importers.js` | puro | filas parseadas → movimientos nuevos: `buildBankImport`, `evaluateBalanceSync`, `buildCreditImport`, `replaceCreditStatement` |
| `transactionOps.js` | puro | transformaciones de arrays: alta manual, cargos de suscripción, reglas de comercio, edición con regla retroactiva, vínculo a suscripción |
| `constants.js` | puro | `TOKENS` (vars CSS), `DEFAULT_CATEGORIES`, íconos lucide, `MERCHANT_RULES_DEFAULT`, `NOISE_TOKENS`, helpers de tipo de categoría |
| `storage.js` | Supabase | shim `get(key)`/`set(key, json, prevItems)` sobre tablas-lista, con mapeo camel↔snake |
| `accountSettings.js` | Supabase | tabla de UNA fila por usuario (saldo base, ahorro base) — fuera del patrón de storage |
| `supabaseClient.js` | Supabase | `createClient`; lanza si faltan las env vars |
| `parsePdfCartola.js` | parser | cartola débito PDF → filas `[fecha, desc, cargo, abono, saldo]` (igual que el xls) |
| `parseCreditCardXlsx.js` | parser | Excel CMR, hoja "Movimientos Facturados", columnas por **nombre** |
| `parseCreditStatementPdf.js` | parser | PDF Estado de Cuenta CMR → solo resumen (cupo, fechas, totales), no movimientos |
| `exportBackup.js` / `exportCsv.js` | export | leen de Supabase (no del estado React) y descargan archivo |
| `readFile.js` | util | `readFileWithProgress` con progreso real |

## storage.js — cómo funciona la persistencia

- Cada "key" (`transactions`, `categories`, `merchantRules`, `subscriptions`,
  `creditTransactions`, `creditStatements`) es una tabla completa.
- `get` pagina de a 1000 (límite de PostgREST) **con `.order("id")`**
  obligatorio — sin orden estable se repetían/saltaban filas. No quitarlo.
- `set(key, value, prevItems)` diffea contra `prevItems` (el estado previo en
  memoria): upsert solo de lo nuevo/cambiado (`shallowEqual`), delete de los ids
  que desaparecieron. No vuelve a leer la tabla.
- En error devuelve `{ key, error }` con `message — details` de Postgres (ahí
  viene la fila exacta en un choque UNIQUE).
- En `src/hooks/useAppData.js`, `runPersist` aplica el cambio local, llama a
  `set`, y si falla **revierte** a `prev` y muestra `syncError`. Todos los
  `persistX` usan eso.

**Agregar un campo** a una entidad: `types.js` → `toRow` + `fromRow` en
`TABLES` → columna en `supabase/schema.sql` + migración nueva. Ojo:
`shallowEqual` compara por `===`, así que campos objeto/array siempre se ven
"cambiados".

**Agregar una entidad** nueva tipo lista: entrada en `TABLES`, typedef,
`useState` + `persistX` con `runPersist` en `useAppData`, carga en `loadAllData`, y la
tabla con RLS + grant en Supabase.

## Claves de deduplicación (críticas)

- **Débito**: en `buildBankImport` la clave es `makeKey(date, String(saldo), cargo, abono)`
  — usa el **saldo corrido**, no la descripción, porque el xls y el PDF
  escriben distinto la descripción pero el saldo es idéntico. La DB tiene
  `unique(user_id, key)` como red de seguridad.
- **Crédito**: `makeCreditKey(statementMonth, date, desc, montoTotal, cuotasPendientes, valorCuota)`.
  `statementMonth` es obligatorio: una compra en cuotas reaparece cada mes con
  la misma fecha/desc/monto y sin él se perdería la cuota 2+.
- Movimientos manuales y de suscripción usan `makeKey(date, name, amount, 0)`.
- Ids nuevos siempre con `uid()` (UUID). Las categorías por defecto usan ids
  fijos (`comida`, `ingreso`…), por eso la PK en DB es `(id, user_id)`.

## Conciliación (reconcile.js)

- Conciliar **fusiona**: la fila manual se borra y la del banco hereda
  `category`, `alias` y `subscriptionId`, y guarda `matchedId = id del manual`.
  El campo `reconciled` es legado.
- Calce automático: mismo monto (±1) y fecha banco entre **−2 y +5 días** de la
  manual; busca también en el mes siguiente (fecha contable del banco).
- `findDuplicateIds`: solo manual vs. banco, mismo signo, ≤3 días, no vinculados.
- Si no hay cambios, las funciones devuelven **el mismo array** (`===`); los
  tests lo verifican.

## Categorización

Orden de prioridad al importar: regla de comercio del usuario
(`applyMerchantRules`, gana el `matchText` más largo) → `autoCategory`
(`MERCHANT_RULES_DEFAULT` + heurísticas `TRANSF`, `ASSERTIVA`) → `"otros"`.
`categoryType()` infiere `income`/`expense` cuando `type` es null o el legado
`"both"`.

## Parsers

- Débito xls: columnas por **posición** `Fecha | Descripción | Cargo | Abono | Saldo`,
  tras la fila de encabezado que contiene "fecha". Filas con fecha ilegible se
  descartan (`parseBankDate` devuelve `null`).
- PDF débito: reconstruye filas por coordenada Y y clasifica montos por X según
  el encabezado de cada página.
- PDF CMR: ignora el bloque "RESUMEN DE PAGO" (pdfjs lo extrae desordenado) y
  lee las secciones del cuerpo.
- `xlsx` viene del CDN oficial de SheetJS (la versión npm está abandonada); no
  cambiarlo a `xlsx` de npm.

## Tests y typecheck

- Un `*.test.js` por módulo puro (`utils`, `reconcile`, `stats`, `importers`,
  `transactionOps`), Vitest en entorno node, con helpers locales tipo
  `tx()`/`bank()`/`manual()` para armar transacciones. Toda función pura nueva
  o cambio de lógica de dinero → test. Las funciones reciben `now`/`createdAt`
  por parámetro para poder testear fechas sin mocks.
- `npm run typecheck` solo incluye los módulos puros (`types`, `utils`,
  `reconcile`, `constants`, `storage`, `stats`, `importers`, `transactionOps`;
  ver `tsconfig.json`, `strict: false`). Parsers,
  hooks y `supabaseClient` quedan fuera a propósito. Si agregas un archivo puro,
  súmalo al `include`.
