-- Versiona created_at en las tablas de movimientos y estados de cuenta. La
-- app ya la leía (orden "más reciente arriba" dentro del día, y el saldo
-- dinámico, que suma los movimientos manuales cargados DESPUÉS del último
-- ajuste comparando por esta fecha), pero nunca había quedado en schema.sql
-- ni en una migración. Además, desde "Deshacer" al borrar, la app la manda
-- explícita al guardar para que una fila restaurada conserve su fecha
-- original.
--
-- `if not exists`: es segura de correr también en una base donde la columna
-- ya existe. Córrela una sola vez en el SQL Editor de Supabase si tu
-- proyecto ya existe (los proyectos nuevos usan schema.sql).

alter table transactions add column if not exists created_at timestamptz not null default now();
alter table credit_transactions add column if not exists created_at timestamptz not null default now();
alter table credit_statements add column if not exists created_at timestamptz not null default now();
