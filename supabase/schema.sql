-- Esquema completo para un proyecto Supabase nuevo. Ejecutar una sola vez en
-- el SQL Editor de Supabase (Project -> SQL Editor -> New query).
--
-- Si tu proyecto ya existe y solo te falta la sección de Suscripciones,
-- no corras este archivo entero: usa migrations/0001_add_subscriptions.sql.

-- las llaves primarias son compuestas (id, user_id), no solo id: las
-- categorías por defecto usan el mismo id fijo ("comida", "transporte", …)
-- para todos los usuarios, así que con id solo como primary key la segunda
-- cuenta que se registra choca con las filas que ya sembró la primera.
-- unique(user_id, key): key es el identificador determinístico del
-- movimiento (fecha+saldo+cargo+abono, ver src/lib/utils.js), no un id al
-- azar — esta restricción es la red de seguridad a nivel de base de datos
-- contra reimportar el mismo movimiento dos veces (ej. si el usuario suelta
-- el mismo archivo dos veces seguidas): si la app llega a fallar en
-- detectarlo, Postgres rechaza el insert en vez de guardar el duplicado.
create table transactions (
  id text not null,
  key text not null,
  date date not null,
  description text not null,
  alias text,
  amount numeric not null,
  category text not null,
  source text not null,
  reconciled boolean not null default false,
  matched_id text,
  subscription_id text, -- si el movimiento vino de una suscripción declarada (ver tabla subscriptions), o se fusionó con una
  user_id uuid not null default auth.uid() references auth.users (id),
  primary key (id, user_id),
  unique (user_id, key)
);

create table categories (
  id text not null,
  label text not null,
  color text not null,
  icon text,
  exclude_from_expense boolean not null default false,
  budget numeric, -- presupuesto mensual opcional; null = sin límite definido
  type text, -- "income" | "expense" | "both"; null = se infiere ("ingreso" -> income, el resto -> expense)
  is_savings boolean not null default false, -- sus movimientos se acumulan en "Total ahorrado" (Resumen), no cuentan como gasto
  user_id uuid not null default auth.uid() references auth.users (id),
  primary key (id, user_id)
);

create table merchant_rules (
  id text not null,
  match_text text not null,
  category_id text not null,
  alias text,
  user_id uuid not null default auth.uid() references auth.users (id),
  primary key (id, user_id)
);

-- una sola fila por usuario: guarda el ajuste manual de saldo y la
-- conciliación automática que hace la app al importar el .xls del banco
create table account_settings (
  user_id uuid primary key default auth.uid() references auth.users (id),
  base_balance numeric not null,
  last_sync_date timestamptz not null default now()
);

-- suscripciones declaradas a mano (ej. "Paramount, $6.990, cada 19") — la
-- app genera un movimiento manual pendiente el día del cobro, que se
-- concilia con el cargo real del banco igual que cualquier otro manual.
create table subscriptions (
  id text not null,
  name text not null,
  amount numeric not null,
  category_id text not null,
  day_of_month integer not null,
  active boolean not null default true,
  user_id uuid not null default auth.uid() references auth.users (id),
  primary key (id, user_id)
);

alter table transactions enable row level security;
alter table categories enable row level security;
alter table merchant_rules enable row level security;
alter table account_settings enable row level security;
alter table subscriptions enable row level security;

create policy "usuarios ven y editan solo lo suyo" on transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "usuarios ven y editan solo lo suyo" on categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "usuarios ven y editan solo lo suyo" on merchant_rules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "usuarios ven y editan solo lo suyo" on account_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "usuarios ven y editan solo lo suyo" on subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
