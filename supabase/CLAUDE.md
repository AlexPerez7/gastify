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
  estados de cuenta).

## Tablas

| Tabla | Clave | Notas |
| --- | --- | --- |
| `transactions` | PK `(id, user_id)`, `unique(user_id, key)` | débito; `source` `bank`/`manual`; `matched_id`, `subscription_id`; `created_at` (la app la manda explícita: "Deshacer" la conserva) |
| `categories` | PK `(id, user_id)` | ids fijos para las por defecto; `type`, `budget`, `exclude_from_expense`, `is_savings` |
| `merchant_rules` | PK `(id, user_id)` | `match_text`, `category_id`, `alias` |
| `subscriptions` | PK `(id, user_id)` | `day_of_month`, `active` |
| `credit_transactions` | PK `(id, user_id)`, `unique(user_id, key)` | CMR; `statement_month` en la clave |
| `credit_statements` | PK `(id, user_id)`, `unique(user_id, statement_month)` | resumen del PDF CMR |
| `account_settings` | PK `user_id` | una fila por usuario; `base_balance`, `last_sync_date`, `savings_base`, `savings_base_date` |

Todas las tablas: `user_id uuid not null default auth.uid()` — la app **no**
manda `user_id` en los upsert (salvo `accountSettings.js`), lo pone el default.

## ⚠ Detalle conocido

`account_settings.base_balance` es `not null`, pero `saveSavingsBase` (en
`src/lib/accountSettings.js`) crea la fila sin ese campo si todavía no existe.
Un usuario que declara su ahorro base **antes** de ajustar su saldo choca con
esa restricción. En la práctica casi nunca pasa (la primera importación del
.xls ya crea la fila), pero tenlo en cuenta si se toca esta tabla.

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
