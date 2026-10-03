# Gastify — CLAUDE.md principal

PWA de gastos personales (React 18 + Vite 5 + Supabase). Importa cartolas de
Banco Falabella (débito `.xls`/PDF) y de la tarjeta CMR (`.xlsx` + PDF de estado
de cuenta), categoriza, concilia manual↔banco y muestra un dashboard. **No hay
backend propio**: toda la lógica corre en el cliente y habla directo con
Supabase (Postgres + Auth + RLS). Proyecto personal de un solo desarrollador;
código, comentarios, UI y commits en **español (Chile)**.

## Documentos de contexto por área

Este archivo es el índice. El detalle vive en CLAUDE.md por carpeta (Claude Code
los carga al trabajar dentro de ellas); léelos antes de tocar esa área:

| Archivo | Cubre |
| --- | --- |
| [`src/lib/CLAUDE.md`](src/lib/CLAUDE.md) | Capa de datos: `storage.js`, tipos JSDoc, claves de dedupe, parsers, conciliación, utils, tests y typecheck |
| [`src/components/CLAUDE.md`](src/components/CLAUDE.md) | UI: Tailwind v4 sin preflight, tokens de tema, `Shared.jsx`, mapa de componentes, mobile |
| [`supabase/CLAUDE.md`](supabase/CLAUDE.md) | Esquema, RLS, grants, migraciones y checklist para agregar tablas/columnas |

## Comandos

```bash
npm run dev        # Vite en http://localhost:5173/gastify/
npm run build      # build a dist/ (requiere .env con VITE_SUPABASE_*)
npm run lint       # ESLint 9 (config plana)
npm run typecheck  # tsc sobre JSDoc, solo un subconjunto de src/lib
npm test           # Vitest (utils + reconcile)
```

CI (`.github/workflows/deploy.yml`) corre **lint + typecheck + test** en cada
push/PR; en push a `main` además construye y publica en GitHub Pages. Antes de
dar algo por terminado corre los tres checks + `npm run build`.

Quirk conocido: `vitest run` justo después de `npm run build` a veces reporta
un falso "no tests"/FAIL la primera vez — reintentar una vez.

## Arquitectura en una pantalla

```
main.jsx ─ registra SW (PWA autoUpdate, chequeo cada 1h) ─ ErrorBoundary ─ AuthGate
AuthGate.jsx ─ sesión Supabase → Auth / ResetPassword / App
App.jsx (~1300 líneas) ─ TODO el estado global y la lógica de negocio:
   ├─ carga inicial (loadAllData) + recarga al volver a la pestaña
   ├─ persist* optimista vía runPersist → storage.set (diff local) → Supabase
   ├─ importadores: handleFile (débito xls/pdf), handleCreditFile, handleCreditStatementFile
   ├─ CRUD de movimientos, categorías, reglas de comercio, suscripciones
   ├─ conciliación (usa src/lib/reconcile.js)
   └─ derivados con useMemo: stats, byCategory, heroStat, insights, reconcileStats…
components/ ─ presentacionales; reciben datos y callbacks por props desde App
lib/ ─ lógica pura (utils, reconcile, parsers) + adaptadores Supabase
```

Tabs (`tab` en App): `resumen` | `movimientos` (sub-vista `debito`/`credito`) |
`conciliacion` | `categorias` | `suscripciones`. Resumen, Movimientos y
Conciliacion se cargan con `lazy()` para no meter recharts/framer-motion en el
bundle inicial; `xlsx` y `pdfjs-dist` se importan dinámicamente solo al importar.

## Reglas que no se rompen

1. **Montos con signo**: negativo = gasto, positivo = ingreso. CLP enteros;
   formatear siempre con `formatCLP`.
2. **Fechas** como string ISO `YYYY-MM-DD`; meses como `YYYY-MM`. Aritmética de
   meses solo con `addMonths`/`nextMonthKey`/`prevMonthKey`/`monthKeyOf`.
3. **Estado local = fuente de verdad**. Todo cambio pasa por un `persist*`
   (patrón optimista con rollback). Nunca escribir a Supabase directo desde un
   componente (excepción: `accountSettings.js`, tabla de una fila).
4. **camelCase en la app, snake_case en la DB**. El mapeo vive solo en
   `TABLES` de `src/lib/storage.js`; un campo nuevo exige tocar toRow, fromRow,
   `types.js` y el SQL (ver `supabase/CLAUDE.md`).
5. **Gasto real** = `amount < 0` y categoría sin `excludeFromExpense`. Usar
   `isRealExpense` / `excludedCategoryIds` de App, no reinventarlo.
6. Lógica nueva que no dependa de React va a `src/lib/` como función pura
   **con test**. App.jsx ya es demasiado grande; no seguir engordándolo con
   lógica testeable.
7. Sin TypeScript: tipos vía JSDoc (`src/lib/types.js`). No convertir a `.ts`.
8. Comentarios explican el **porqué** (el código ya tiene ese estilo, denso y en
   español). Mantenerlo al editar.

## Flujo de trabajo

- Commits y push **directo a `main`** (sin ramas ni PR) salvo que se pida otra
  cosa. Mensajes de commit en español, imperativo ("Arregla…", "Agrega…").
- Variables de entorno: `.env` (no versionado) con `VITE_SUPABASE_URL` y
  `VITE_SUPABASE_ANON_KEY`; ver `.env.example`. Sin ellas `supabaseClient.js`
  lanza al arrancar.
- `vite.config.js` fija `base: "/gastify/"` (GitHub Pages).
- El `README.md` describe features y setup, pero su sección "Estructura" está
  desactualizada (no menciona CreditCard, Subscriptions, HelpModal, parsers);
  confía en estos CLAUDE.md para la estructura.
