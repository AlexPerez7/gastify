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
-- Los manuales usan key = 'manual|<id>' (ver manualKey), así que nunca chocan.
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
  created_at timestamptz not null default now(), -- cuándo se cargó en la app (orden del día, saldo dinámico); la app la manda explícita
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
  -- cómo se compara match_text: contiene / empieza / termina / igual / regex
  match_type text not null default 'contains'
    check (match_type in ('contains', 'startsWith', 'endsWith', 'equals', 'regex')),
  min_amount numeric, -- rango de monto ABSOLUTO (CLP); null = sin límite
  max_amount numeric,
  user_id uuid not null default auth.uid() references auth.users (id),
  primary key (id, user_id)
);

-- una sola fila por usuario: guarda el ajuste manual de saldo y la
-- conciliación automática que hace la app al importar el .xls del banco
create table account_settings (
  user_id uuid primary key default auth.uid() references auth.users (id),
  -- ambas null = saldo nunca ajustado (la fila puede existir solo por el ahorro
  -- base); la app siempre manda last_sync_date junto con base_balance
  base_balance numeric,
  last_sync_date timestamptz,
  savings_base numeric,          -- ancla manual de "Total ahorrado" (lo ahorrado antes de usar la app); null = nunca declarado
  savings_base_date timestamptz  -- desde cuándo rige ese ancla
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
  frequency text not null default 'monthly', -- 'monthly' | 'yearly'
  month_of_year integer, -- 1..12, solo para las anuales
  end_date date, -- después de esta fecha no se generan más cargos
  check (frequency in ('monthly', 'yearly') and (month_of_year is null or month_of_year between 1 and 12)),
  user_id uuid not null default auth.uid() references auth.users (id),
  primary key (id, user_id)
);

-- Tarjeta de crédito (CMR), separada por completo de `transactions`
-- (cuenta corriente/débito) — no hay saldo corrido acá: cada import es "lo
-- facturado este ciclo" (ver src/lib/parseCreditCardXlsx.js). Una compra en
-- cuotas reaparece en cada cartola mensual siguiente con la MISMA
-- fecha/descripción/monto original (solo cambia installments_pending), así
-- que el dedup necesita statement_month además de esos campos — sin eso, la
-- cuota 2 se vería como "ya importada" (ver makeCreditKey en utils.js) y se
-- perdería silenciosamente.
create table credit_transactions (
  id text not null,
  key text not null,
  statement_month text not null, -- "2026-08": ciclo/cartola al que pertenece esta fila, elegido al importar (no derivable de las filas)
  date date not null, -- fecha original de la compra, tal como viene en el Excel
  description text not null,
  alias text,
  amount numeric not null, -- VALOR CUOTA: lo efectivamente cobrado este ciclo, con signo
  total_amount numeric, -- MONTO: precio total de la compra (null si no aplica / igual a amount)
  installments_pending integer not null default 0, -- CUOTAS PENDIENTES
  holder text, -- TITULAR/ADICIONAL
  category text not null,
  created_at timestamptz not null default now(),
  user_id uuid not null default auth.uid() references auth.users (id),
  primary key (id, user_id),
  unique (user_id, key)
);

-- Resumen del Estado de Cuenta CMR (cupo, fechas de pago, totales) — una fila
-- por ciclo, separada de credit_transactions (los movimientos siguen viniendo
-- solo del Excel; este PDF solo aporta datos que el Excel no trae). Ver
-- src/lib/parseCreditStatementPdf.js para el detalle de qué campo sale de
-- qué sección del PDF.
create table credit_statements (
  id text not null,
  statement_month text not null, -- "2026-08", mismo criterio de clave que credit_transactions.statement_month
  statement_date date,   -- Fecha Facturación Estado de Cuenta
  period_from date,      -- Período Facturado: Desde
  period_to date,        -- Período Facturado: Hasta
  pay_by date,            -- Pagar Hasta
  total_to_pay numeric,   -- Monto Total Facturado a Pagar
  min_to_pay numeric,     -- Monto Mínimo a Pagar
  cupo_total numeric,     -- Cupo Compras: Cupo Total
  cupo_used numeric,      -- Cupo Compras: Cupo Utilizado
  cupo_available numeric, -- Cupo Compras: Cupo Disponible
  created_at timestamptz not null default now(),
  user_id uuid not null default auth.uid() references auth.users (id),
  primary key (id, user_id),
  unique (user_id, statement_month)
);

alter table transactions enable row level security;
alter table categories enable row level security;
alter table merchant_rules enable row level security;
alter table account_settings enable row level security;
alter table subscriptions enable row level security;
alter table credit_transactions enable row level security;
alter table credit_statements enable row level security;

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
create policy "usuarios ven y editan solo lo suyo" on credit_transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "usuarios ven y editan solo lo suyo" on credit_statements
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on credit_transactions to authenticated;
grant select, insert, update, delete on credit_statements to authenticated;
-- Guardados atómicos y borrado de categorías con control de concurrencia.
-- Ejecutar en SQL Editor. Se puede repetir. No modifica datos existentes.
begin;

create or replace function public.gastify_write_table(
  p_table text, p_upserts jsonb, p_deletes text[], p_expected jsonb
) returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_id text;
  v_actual jsonb;
  v_expected jsonb;
  v_normalized jsonb;
  v_field text;
  v_row jsonb;
  v_columns text;
  v_assignments text;
  v_category text;
begin
  if v_user is null then raise exception 'Sesión requerida' using errcode = '42501'; end if;
  if p_table is null or p_table not in ('transactions', 'categories', 'merchant_rules',
      'subscriptions', 'credit_transactions', 'credit_statements') then
    raise exception 'Tabla no permitida' using errcode = '22023';
  end if;
  if jsonb_typeof(p_upserts) is distinct from 'array'
      or jsonb_typeof(p_expected) is distinct from 'array' or p_deletes is null then
    raise exception 'Formato de cambios inválido' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_upserts) r where
      jsonb_typeof(r) <> 'object' or coalesce(r->>'id', '') = '') then
    raise exception 'Identificador inválido' using errcode = '22023';
  end if;
  if (select count(*) from jsonb_array_elements(p_upserts)) <>
     (select count(distinct r->>'id') from jsonb_array_elements(p_upserts) r) then
    raise exception 'Identificadores repetidos' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_upserts) r where r->>'id'=any(p_deletes)) then
    raise exception 'Un registro no puede borrarse y guardarse a la vez' using errcode='22023';
  end if;
  -- Ordena todas las operaciones nuevas de una cuenta. RLS sigue activo;
  -- no se usa SECURITY DEFINER ni se acepta un usuario enviado por el cliente.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 0));

  for v_id in select id from (
      select r->>'id' as id from jsonb_array_elements(p_upserts) r
      union select unnest(p_deletes)
    ) ids order by id
  loop
    if v_id is null or v_id = '' then raise exception 'Identificador inválido' using errcode = '22023'; end if;
    execute format('select to_jsonb(t) from public.%I t where id=$1 and user_id=$2 for update', p_table)
      into v_actual using v_id, v_user;
    select r into v_expected from jsonb_array_elements(p_expected) r where r->>'id' = v_id;
    if (v_actual is null) <> (v_expected is null) then
      raise exception 'El registro cambió en otra sesión. Recarga antes de guardar.' using errcode = '40001';
    end if;
    if v_expected is not null then
      -- Normaliza numeric/date/timestamptz con los tipos reales de la tabla.
      -- No compara columnas que el cliente no conoce ni reescribe defaults.
      execute format('select to_jsonb(jsonb_populate_record(null::public.%I, $1))', p_table)
        into v_normalized using v_expected;
      for v_field in select jsonb_object_keys(v_expected) loop
        if v_field = 'user_id' and v_expected->>'user_id' is distinct from v_user::text then
          raise exception 'Usuario inválido' using errcode = '42501';
        end if;
        if v_actual->v_field is distinct from v_normalized->v_field then
          raise exception 'El registro cambió en otra sesión. Recarga antes de guardar.' using errcode = '40001';
        end if;
      end loop;
    end if;
  end loop;

  if p_table='categories' and (
      exists(select 1 from public.transactions where user_id=v_user and category=any(p_deletes)) or
      exists(select 1 from public.credit_transactions where user_id=v_user and category=any(p_deletes)) or
      exists(select 1 from public.subscriptions where user_id=v_user and category_id=any(p_deletes)) or
      exists(select 1 from public.merchant_rules where user_id=v_user and category_id=any(p_deletes))) then
    raise exception 'La categoría todavía tiene referencias' using errcode='23503';
  end if;

  -- Primero libera las claves eliminadas; cualquier fallo posterior revierte
  -- también esos borrados en la misma transacción.
  execute format('delete from public.%I where user_id=$1 and id=any($2)', p_table)
    using v_user, p_deletes;
  for v_row in select value from jsonb_array_elements(p_upserts) loop
    v_id := v_row->>'id';
    v_category := case when p_table in ('transactions','credit_transactions') then v_row->>'category'
      when p_table in ('subscriptions','merchant_rules') then v_row->>'category_id' else null end;
    if v_category is not null and not exists(
        select 1 from public.categories where user_id=v_user and id=v_category) then
      raise exception 'La categoría ya no existe. Recarga antes de guardar.' using errcode='23503';
    end if;
    v_row := v_row || jsonb_build_object('user_id', v_user);
    select string_agg(format('%I', k), ', ' order by k) into v_columns
      from jsonb_object_keys(v_row) k;
    if exists (select 1 from jsonb_array_elements(p_expected) r where r->>'id'=v_id) then
      select string_agg(format('%I', k), ', ' order by k) into v_assignments
        from jsonb_object_keys(v_row) k where k not in ('id', 'user_id');
      if v_assignments is not null then
        execute format('update public.%I set (%s)=(select %s from jsonb_populate_record(null::public.%I,$1)) where id=$2 and user_id=$3',
          p_table, v_assignments, v_assignments, p_table) using v_row, v_id, v_user;
      end if;
    else
      execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I,$1)',
        p_table, v_columns, v_columns, p_table) using v_row;
    end if;
  end loop;
end;
$$;

create or replace function public.gastify_delete_category(p_category text)
returns void language plpgsql security invoker set search_path = ''
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Sesión requerida' using errcode='42501'; end if;
  if p_category is null or p_category = '' or p_category = 'otros' then
    raise exception 'No se puede eliminar la categoría Otros' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 0));
  perform 1 from public.categories where user_id=v_user and id='otros' for key share;
  if not found then raise exception 'Falta la categoría Otros' using errcode='23503'; end if;
  update public.transactions set category='otros' where user_id=v_user and category=p_category;
  update public.credit_transactions set category='otros' where user_id=v_user and category=p_category;
  update public.subscriptions set category_id='otros' where user_id=v_user and category_id=p_category;
  update public.merchant_rules set category_id='otros' where user_id=v_user and category_id=p_category;
  delete from public.categories where user_id=v_user and id=p_category;
end;
$$;

revoke all on function public.gastify_write_table(text,jsonb,text[],jsonb) from public;
revoke all on function public.gastify_delete_category(text) from public;
grant execute on function public.gastify_write_table(text,jsonb,text[],jsonb) to authenticated;
grant execute on function public.gastify_delete_category(text) to authenticated;

notify pgrst, 'reload schema';
commit;
