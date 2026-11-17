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
