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
  user_id uuid not null default auth.uid() references auth.users (id),
  primary key (id, user_id),
  unique (user_id, statement_month)
);

alter table credit_statements enable row level security;

create policy "usuarios ven y editan solo lo suyo" on credit_statements
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on credit_statements to authenticated;
