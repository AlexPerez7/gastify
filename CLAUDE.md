# Gastify — CLAUDE.md principal

PWA de gastos personales (React 18 + Vite 5 + Supabase). Importa cartolas de
Banco Falabella (débito `.xls`/PDF) y de la tarjeta CMR (`.xlsx` + PDF de estado
de cuenta), categoriza, concilia manual↔banco y muestra un dashboard. **No hay
backend propio**: toda la lógica corre en el cliente y habla directo con
Supabase (Postgres + Auth + RLS). Proyecto personal de un solo desarrollador;
código, comentarios, UI y commits en **español (Chile)**.

**Trabajo pendiente: [`PLAN.md`](PLAN.md)** — leerlo al empezar una sesión;
marcar `[x]` y mover a "Hecho" (con su commit) lo que se termine.

## Documentos de contexto por área

Este archivo es el índice. El detalle vive en CLAUDE.md por carpeta (Claude Code
los carga al trabajar dentro de ellas); léelos antes de tocar esa área:

| Archivo | Cubre |
| --- | --- |
| [`src/lib/CLAUDE.md`](src/lib/CLAUDE.md) | Lógica pura y datos: `storage.js`, tipos JSDoc, claves de dedupe, importers, stats, conciliación, parsers, tests y typecheck |
| [`src/hooks/CLAUDE.md`](src/hooks/CLAUDE.md) | Hooks que conectan la lógica con React: `useAppData` (estado + persistencia), acciones, importadores, derivados |
| [`src/components/CLAUDE.md`](src/components/CLAUDE.md) | UI: Tailwind v4 sin preflight, tokens de tema, `Shared.jsx`, mapa de componentes, mobile |
| [`supabase/CLAUDE.md`](supabase/CLAUDE.md) | Esquema, RLS, grants, migraciones y checklist para agregar tablas/columnas |

## Comandos

```bash
npm run dev        # Vite en http://localhost:5173/gastify/
npm run build      # build a dist/ (requiere .env con VITE_SUPABASE_*)
npm run lint       # ESLint 9 (config plana)
npm run typecheck  # tsc sobre JSDoc, solo un subconjunto de src/lib
npm test           # Vitest (lógica pura de src/lib)
```

CI (`.github/workflows/deploy.yml`) corre `npm ci` + **lint + typecheck + test**
en cada push/PR; en push a `main` además construye y publica en GitHub Pages
(https://alexperez7.github.io/gastify/). Antes de dar algo por terminado corre
los tres checks + `npm run build`.

**Deploy — verificar siempre.** Un push no es "publicado" hasta que el
workflow termina bien: `gh run list --limit 1` y `gh run watch <id>
--exit-status`; si falla, `gh run view <id> --log-failed`. Estuvo un mes
fallando sin que nadie lo notara (lock desincronizado).

**Dependencias.** El runner usa Node 20 / **npm 10**; localmente hay npm 11,
que arma un lock distinto (omite el `esbuild` que pide el `vite` 8 anidado de
vitest 4) y rompe `npm ci` en CI. Si tocas `package.json`, regenera el lock con
`npx npm@10 install` y verifica con `rm -rf node_modules && npx npm@10 ci`.

Quirk conocido: `vitest run` justo después de `npm run build` a veces reporta
un falso "no tests"/FAIL la primera vez — reintentar una vez.

## Arquitectura en una pantalla

```
main.jsx ─ registra SW (PWA autoUpdate, chequeo cada 1h) ─ ErrorBoundary ─ AuthGate
AuthGate.jsx ─ sesión Supabase → Auth / ResetPassword / App
App.jsx (~260 líneas) ─ estado de UI (tab, filtros, modales) + composición + render
   ├─ hooks/useAppData ─ estado de datos, carga, persist* optimista → storage.js → Supabase
   ├─ hooks/useTransactionActions ─ CRUD movimientos débito/crédito + conciliación
   ├─ hooks/useCatalogActions ─ categorías y suscripciones
   ├─ hooks/useImporters ─ archivos débito xls/PDF, Excel CMR, PDF estado de cuenta
   └─ hooks/useDerivedData ─ mes seleccionado + stats, gráficos, hero, conciliación (useMemo)
lib/ ─ lógica pura y testeable (utils, stats, importers, transactionOps, reconcile, parsers)
       + adaptadores Supabase (storage, accountSettings)
components/ ─ presentacionales; reciben datos y callbacks por props desde App
```

Tabs (`tab` en App): `resumen` | `movimientos` (sub-vista `debito`/`credito`) |
`conciliacion` | `categorias` | `suscripciones`. Resumen, Movimientos y
Conciliacion se cargan con `lazy()` para no meter recharts/framer-motion en el
bundle inicial; `xlsx` y `pdfjs-dist` se importan dinámicamente solo al importar.

## Reglas que no se rompen

1. **Montos con signo**: negativo = gasto, positivo = ingreso. CLP enteros;
   formatear siempre con `formatCLP`.
2. **Fechas** como string ISO `YYYY-MM-DD`; meses como `YYYY-MM`. Aritmética de
   meses solo con `addMonths`/`nextMonthKey`/`prevMonthKey`/`monthKeyOf`. "Hoy"
   siempre con `localIsoDate()`, **nunca** `toISOString().slice(0, 10)` (es UTC:
   en Chile da la fecha de mañana desde las 20:00–21:00).
3. **Estado local = fuente de verdad**. Todo cambio pasa por un `persist*`
   (patrón optimista con rollback, en `useAppData`). Nunca escribir a Supabase
   directo desde un componente (excepción: `accountSettings.js`, tabla de una fila).
4. **camelCase en la app, snake_case en la DB**. El mapeo vive solo en
   `TABLES` de `src/lib/storage.js`; un campo nuevo exige tocar toRow, fromRow,
   `types.js` y el SQL (ver `supabase/CLAUDE.md`).
5. **Gasto real** = `amount < 0` y categoría sin `excludeFromExpense`. Usar
   `isRealExpense` / `excludedCategoryIdsOf` de `src/lib/stats.js`, no reinventarlo.
6. **Capas**: lógica → función pura en `src/lib/` **con test**; conexión con
   React → hook en `src/hooks/`; App.jsx solo compone y renderiza. No volver a
   meter lógica de negocio en App.jsx ni en componentes.
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
- Cambios de esquema: SQL en `supabase/migrations/000N_*.sql` que el usuario
  corre a mano **antes** del deploy si el código nuevo depende de él (ver
  `supabase/CLAUDE.md`).
- Probar UI sin login: una página temporal en `prototypes/` (Vite la sirve en
  dev, no entra al build) que monte los componentes reales con datos de
  ejemplo, y Playwright para capturas. Borrarla al terminar; no se versiona.
- El `README.md` es la documentación para personas (features, setup); estos
  CLAUDE.md, la de trabajo. Si cambia una feature visible, actualizar ambos.
