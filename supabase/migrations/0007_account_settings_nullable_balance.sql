-- Permite una fila de account_settings sin saldo ajustado. saveSavingsBase crea
-- la fila solo con el ahorro base si el usuario lo declara ANTES de ajustar su
-- saldo, y base_balance `not null` hacía fallar ese insert.
--
-- last_sync_date pierde también el `not null` y el `default now()`: con el
-- default, esa fila nacía con "sincronizado ahora" y la primera importación del
-- .xls (siempre anterior a ahora) se tomaba como histórica y no fijaba el
-- saldo. Null en ambas = saldo nunca ajustado; la app (saveAccountSettings)
-- siempre manda las dos juntas.
--
-- Córrela una sola vez en el SQL Editor de Supabase (los proyectos nuevos usan
-- schema.sql, que ya lo incluye). Es idempotente.

alter table account_settings alter column base_balance drop not null;
alter table account_settings alter column last_sync_date drop not null;
alter table account_settings alter column last_sync_date drop default;
