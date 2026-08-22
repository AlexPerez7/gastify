-- Agrega el tracker de suscripciones a un proyecto Supabase que ya existía
-- antes de esta funcionalidad. Correr una sola vez en el SQL Editor de
-- Supabase (Project -> SQL Editor -> New query).

alter table transactions add column subscription_id text;

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
alter table subscriptions enable row level security;
create policy "usuarios ven y editan solo lo suyo" on subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- RLS filtra FILAS, pero antes de eso Postgres exige el permiso de tabla en
-- sí — en proyectos donde el rol `authenticated` no hereda privilegios por
-- defecto sobre tablas nuevas, sin esto PostgREST devuelve 403 "permission
-- denied for table subscriptions" (código 42501) aunque la policy esté bien.
grant select, insert, update, delete on public.subscriptions to authenticated;
