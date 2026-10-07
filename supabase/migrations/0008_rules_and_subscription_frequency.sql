-- Sección 6.1 del PLAN (ideas de ezbookkeeping):
--
-- 1. Reglas de comercio más potentes. Hasta ahora una regla era solo "la
--    descripción contiene X". match_type agrega empieza con / termina con /
--    es exactamente / regex, y min_amount/max_amount un rango de monto
--    ABSOLUTO (CLP, extremos incluidos; null = sin límite) para casos como
--    "transferencia a Juan por $450.000 = arriendo". Las reglas existentes
--    quedan como 'contains' sin rango: se comportan igual que antes.
--
-- 2. Suscripciones anuales y con fecha de término. frequency 'monthly' |
--    'yearly'; month_of_year (1..12) solo para las anuales; end_date: después
--    de esa fecha no se generan más cargos. Las existentes quedan mensuales
--    y sin término.
--
-- Córrela una sola vez en el SQL Editor de Supabase ANTES de publicar el
-- código que la usa (la app manda estas columnas en cada guardado y, sin
-- ellas, PostgREST rechaza el upsert). Los proyectos nuevos usan schema.sql,
-- que ya las incluye. Es idempotente.

alter table merchant_rules add column if not exists match_type text not null default 'contains';
alter table merchant_rules add column if not exists min_amount numeric;
alter table merchant_rules add column if not exists max_amount numeric;
alter table merchant_rules drop constraint if exists merchant_rules_match_type_check;
alter table merchant_rules add constraint merchant_rules_match_type_check
  check (match_type in ('contains', 'startsWith', 'endsWith', 'equals', 'regex'));

alter table subscriptions add column if not exists frequency text not null default 'monthly';
alter table subscriptions add column if not exists month_of_year integer;
alter table subscriptions add column if not exists end_date date;
alter table subscriptions drop constraint if exists subscriptions_frequency_check;
alter table subscriptions add constraint subscriptions_frequency_check
  check (frequency in ('monthly', 'yearly') and (month_of_year is null or month_of_year between 1 and 12));
