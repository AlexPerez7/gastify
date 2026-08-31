-- Agrega el soporte de tarjeta de crédito (CMR), separado por completo de
-- `transactions` (cuenta corriente/débito) — ver comentarios en la tabla.
-- Córrelo una sola vez en el SQL Editor de Supabase si tu proyecto ya existe
-- (si es un proyecto nuevo, usa supabase/schema.sql en su lugar, que ya
-- incluye esta sección).

-- A diferencia de `transactions`, acá no hay saldo corrido: cada import es
-- "lo facturado este ciclo" (ver src/lib/parseCreditCardXlsx.js). Una compra
-- en cuotas reaparece en cada cartola mensual siguiente con la MISMA
-- fecha/descripción/monto original (solo cambia `installments_pending`), así
-- que el dedup necesita `statement_month` además de esos campos — sin eso,
-- la cuota 2 se vería como "ya importada" (ver makeCreditKey en utils.js) y
-- se perdería silenciosamente.
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
  user_id uuid not null default auth.uid() references auth.users (id),
  primary key (id, user_id),
  unique (user_id, key)
);

alter table credit_transactions enable row level security;

create policy "usuarios ven y editan solo lo suyo" on credit_transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- las demás tablas de este proyecto heredaron estos privilegios de la
-- configuración inicial de Supabase (grants por defecto sobre el schema
-- public), pero una tabla creada después a mano por SQL no siempre los
-- hereda — sin esto, RLS ni siquiera llega a evaluarse: Postgres rechaza el
-- acceso antes, con "permission denied for table credit_transactions".
grant select, insert, update, delete on credit_transactions to authenticated;
