# supabase — esquema y migraciones

> Parte del contexto de Gastify. Índice y reglas generales en el
> [CLAUDE.md principal](../CLAUDE.md). Mapeo app↔DB en
> [`src/lib/CLAUDE.md`](../src/lib/CLAUDE.md).

No hay CLI de Supabase ni migraciones automáticas: el SQL se corre **a mano**
en el SQL Editor del proyecto. Claude no puede aplicarlo; al cambiar el esquema,
deja el SQL listo y avisa al usuario que debe ejecutarlo.

- `schema.sql` — esquema completo para un proyecto **nuevo**.
- `migrations/000N_*.sql` — cambios incrementales para proyectos existentes
  (0001 suscripciones, 0002 credit_transactions, 0003 credit_statements,
  0004 savings_base en account_settings, 0005 created_at en movimientos y
  estados de cuenta, 0006 **opcional**: recolorea las categorías por defecto
  no personalizadas a la paleta validada, 0007 `base_balance`/`last_sync_date`
  nullables en account_settings, 0008 `match_type`/`min_amount`/`max_amount`
  en merchant_rules y `frequency`/`month_of_year`/`end_date` en subscriptions).

## Tablas

| Tabla | Clave | Notas |
| --- | --- | --- |
| `transactions` | PK `(id, user_id)`, `unique(user_id, key)` | débito; `source` `bank`/`manual`; `matched_id`, `subscription_id`; `created_at` (la app la manda explícita: "Deshacer" la conserva) |
| `categories` | PK `(id, user_id)` | ids fijos para las por defecto; `type`, `budget`, `exclude_from_expense`, `is_savings` |
| `merchant_rules` | PK `(id, user_id)` | `match_text`, `category_id`, `alias`, `match_type` (contains/startsWith/endsWith/equals/regex), `min_amount`/`max_amount` (rango absoluto) |
| `subscriptions` | PK `(id, user_id)` | `day_of_month`, `active`, `frequency` (monthly/yearly), `month_of_year`, `end_date` |
| `credit_transactions` | PK `(id, user_id)`, `unique(user_id, key)` | CMR; `statement_month` en la clave |
| `credit_statements` | PK `(id, user_id)`, `unique(user_id, statement_month)` | resumen del PDF CMR |
| `account_settings` | PK `user_id` | una fila por usuario; `base_balance`, `last_sync_date`, `savings_base`, `savings_base_date` (todas nullables: la fila puede existir solo por el ahorro base) |

Todas las tablas: `user_id uuid not null default auth.uid()` — la app **no**
manda `user_id` en los upsert (salvo `accountSettings.js`), lo pone el default.

## account_settings sin saldo

La fila puede nacer desde `saveSavingsBase` (ahorro declarado antes de ajustar
el saldo), con `base_balance` y `last_sync_date` en null = "saldo sin ajustar".
Por eso `last_sync_date` **no** tiene `default now()`: con él, la primera
importación del .xls se veía como histórica y no fijaba el saldo
(`evaluateBalanceSync`). `computeDynamicBalance` devuelve null en ese caso.

## Checklist para un cambio de esquema

1. Nueva migración `migrations/000N_descripcion.sql` (numeración correlativa),
   con comentario inicial en español explicando qué y por qué.
2. Reflejar el mismo cambio en `schema.sql` (debe quedar siempre como el estado
   final completo).
3. Tabla nueva: `enable row level security` + policy
   `"usuarios ven y editan solo lo suyo"` (`using/with check auth.uid() = user_id`)
   + **`grant select, insert, update, delete on <tabla> to authenticated`** —
   sin el grant PostgREST responde 403 `permission denied` (42501) aunque la
   policy esté bien.
4. PK compuesta `(id, user_id)` e `id text` (los ids los genera el cliente).
5. Actualizar `TABLES` en `storage.js`, `types.js` y, si aplica, el README
   ("Puesta en marcha").
6. Numéricos como `numeric` → en `fromRow` convertir con `Number(...)`
   (PostgREST los devuelve como string), respetando `null`.
