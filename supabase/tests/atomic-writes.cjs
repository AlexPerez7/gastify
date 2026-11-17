// Base desechable en memoria. No conecta con Supabase ni con datos reales.
/* global __dirname, console, process */
// NODE_PATH=/tmp/gastify-sql-check/node_modules node supabase/tests/atomic-writes.cjs
const { PGlite } = require('@electric-sql/pglite');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const assert = require('node:assert/strict');
(async () => {
 const db = new PGlite();
 await db.exec(`create schema auth; create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
 create role authenticated; grant usage on schema auth to authenticated;`);
 await db.exec(readFileSync(resolve(__dirname,'../schema.sql'),'utf8'));
 // La migración debe ser repetible y preservar las tablas.
 await db.exec(readFileSync(resolve(__dirname,'../migrations/0009_atomic_writes_and_category_delete.sql'),'utf8'));
 await db.exec('grant select,insert,update,delete on all tables in schema public to authenticated');
 const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222';
 await db.query('insert into auth.users values ($1),($2)',[A,B]);
 for(const user of [A,B]) {
  await db.query("insert into categories(id,user_id,label,color) values ('otros',$1,'Otros','x'),('cat',$1,'Prueba','x')",[user]);
  for(const id of ['a','b']) await db.query(`insert into transactions(id,user_id,key,date,description,amount,category,source)
   values ($1,$2,$1,'2026-08-01','Prueba',-1000,'cat','bank')`,[id,user]);
 }
 async function as(user) {await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);await db.exec('set role authenticated');}
 async function row(id) {return (await db.query('select to_jsonb(t) as row from transactions t where id=$1',[id])).rows[0]?.row;}
 async function write(upserts,deletes,expected) {return db.query('select public.gastify_write_table($1,$2::jsonb,$3::text[],$4::jsonb)', ['transactions',JSON.stringify(upserts),deletes,JSON.stringify(expected)]);}
 await as(A);
 const a=await row('a'), b=await row('b');
 // El cliente usa ISO con Z y números JS: normalización de timestamptz.
 const expectedA={...a,created_at:new Date(a.created_at).toISOString()};
 await write([{...a,alias:'nuevo'}],[],[expectedA]);
 assert.equal((await row('a')).alias,'nuevo');
 await assert.rejects(write([{...a,alias:'obsoleto'}],['b'],[a,b]),e=>e.code==='40001');
 assert(await row('b'));assert.equal((await row('a')).alias,'nuevo');
 const current=await row('a');
 // Falla al insertar después de borrar b: rollback restaura b y todo a.
 await assert.rejects(write([{id:'invalida',key:'x',date:'2026-08-01',description:'x',category:'cat',source:'bank'}],['b'],[b]));
 assert(await row('b'));assert.deepEqual(await row('a'),current);
 await assert.rejects(write([{id:'huerfana',key:'x',date:'2026-08-01',description:'x',amount:-1,category:'inexistente',source:'bank'}],['b'],[b]),e=>e.code==='23503');
 assert(await row('b'));
 // Una adición no debe convertirse en upsert sobre un id ya existente.
 await assert.rejects(write([{...current,alias:'pisado'}],[],[]),e=>e.code==='40001');
 assert.equal((await row('a')).alias,'nuevo');
 await assert.rejects(db.query('select gastify_write_table($1,$2::jsonb,$3::text[],$4::jsonb)', ['account_settings','[]',[],'[]']));
 await as(B);
 assert.equal((await row('a')).alias,null);
 await assert.rejects(write([{...current,alias:'cruce'}],[],[current]));
 assert.equal((await row('a')).alias,null);
 await as(A);
 // Insert con columnas mínimas conserva defaults de la base.
 await write([{id:'c',key:'c',date:'2026-08-01',description:'Prueba',amount:-2000,category:'cat',source:'bank'}],[],[]);
 assert((await row('c')).created_at);assert.equal((await row('c')).reconciled,false);
 await db.exec('reset role');
 for(const user of [A,B]) {
  await db.query("insert into credit_transactions(id,user_id,key,statement_month,date,description,amount,category) values ('credito',$1,'credito','2026-08','2026-08-01','Prueba',-1000,'cat')",[user]);
  await db.query("insert into subscriptions(id,user_id,name,amount,category_id,day_of_month) values ('sub',$1,'Prueba',1000,'cat',1)",[user]);
  await db.query("insert into merchant_rules(id,user_id,match_text,category_id) values ('regla',$1,'PRUEBA','cat')",[user]);
 }
 await db.exec(`create function public.test_reject_reassignment() returns trigger language plpgsql as $$begin
 if new.category='otros' then raise exception 'fallo simulado'; end if; return new; end$$;
 create trigger test_reject before update on credit_transactions for each row execute function public.test_reject_reassignment();`);
 await as(A);
 const category=(await db.query("select to_jsonb(c) as row from categories c where id='cat'")).rows[0].row;
 await assert.rejects(db.query('select gastify_write_table($1,$2::jsonb,$3::text[],$4::jsonb)',
  ['categories','[]',['cat'],JSON.stringify([category])]),e=>e.code==='23503');
 await assert.rejects(db.query("select gastify_delete_category('cat')"));
 assert.equal((await row('a')).category,'cat');
 assert.equal((await db.query("select count(*)::int as n from categories where id='cat'")).rows[0].n,1);
 await db.exec('reset role; drop trigger test_reject on credit_transactions');
 await as(A);
 await db.query("select gastify_delete_category('cat')");
 for(const [table,column] of [['transactions','category'],['credit_transactions','category'],['subscriptions','category_id'],['merchant_rules','category_id']]) {
  assert.equal((await db.query(`select count(*)::int as n from ${table} where ${column}='cat'`)).rows[0].n,0);
 }
 assert.equal((await db.query("select count(*)::int as n from categories where id='cat'")).rows[0].n,0);
 await assert.rejects(write([{id:'categoria-obsoleta',key:'obsoleta',date:'2026-08-01',description:'Prueba',amount:-1000,category:'cat',source:'bank'}],[],[]),e=>e.code==='23503');
 await assert.rejects(db.query("select gastify_delete_category('otros')"));
 await as(B);
 assert.equal((await row('a')).category,'cat');
 assert.equal((await db.query("select count(*)::int as n from categories where id='cat'")).rows[0].n,1);
 await as('');
 await assert.rejects(db.query("select gastify_delete_category('cat')"),e=>e.code==='42501');
 console.log('OK PostgreSQL: migración repetible, tipos/fechas, rollback total, conflictos, defaults, tablas permitidas, aislamiento RLS, categoría completa y destino protegido.');
 await db.close();
})().catch(error=>{console.error(error);process.exit(1)});
