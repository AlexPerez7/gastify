-- Agrega el ancla manual de "Total ahorrado" a account_settings: cuánto tenía
-- ahorrado el usuario ANTES de empezar a usar la app (ver saveSavingsBase en
-- src/lib/accountSettings.js). El código ya leía/escribía estas columnas, pero
-- nunca habían quedado versionadas ni en schema.sql ni en una migración — un
-- proyecto nuevo fallaba al guardar el ahorro base.
--
-- `if not exists`: es seguro correrla también en una base donde las columnas
-- ya se habían agregado a mano. Córrela una sola vez en el SQL Editor de
-- Supabase si tu proyecto ya existe (los proyectos nuevos usan schema.sql,
-- que ya las incluye).

alter table account_settings add column if not exists savings_base numeric;          -- null = nunca declarado
alter table account_settings add column if not exists savings_base_date timestamptz; -- desde cuándo rige ese ancla
