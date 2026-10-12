# Desarrollo: scripts, tests, estructura y deploy

> Parte de la documentación de Gastify — volver al [README](../README.md).

## Scripts disponibles

| Comando             | Qué hace                                                 |
| ------------------- | -------------------------------------------------------- |
| `npm run dev`       | Servidor de desarrollo con hot reload                    |
| `npm run build`     | Build de producción en `dist/`                           |
| `npm run preview`   | Sirve el build de producción localmente para probarlo    |
| `npm run lint`      | ESLint sobre todo el proyecto                            |
| `npm run typecheck` | Chequeo de tipos (JSDoc) sobre la lógica de `src/lib`    |
| `npm test`          | Corre la suite de Vitest                                 |

## Tests

```bash
npm test
```

Cubren toda la lógica pura de `src/lib/`, que es donde vive lo que afecta la
plata:

- `utils.js` — parseo de fechas y montos del banco, claves de deduplicación,
  categorización automática, reglas de comercio, agrupado por día, insights,
  formato compacto para ejes.
- `reconcile.js` — calce manual↔banco, vínculo manual, posibles duplicados.
- `importers.js` — armado de filas importadas (débito y tarjeta), saldo del
  archivo y protección contra archivos antiguos.
- `stats.js` — stats del mes, gasto por categoría, comparación con el mes
  anterior, saldo actual, total ahorrado, conciliación, mapa de actividad.
- `pdfParsing.js` — lectura de la cartola PDF de débito y del estado de
  cuenta CMR. Además de los tests con datos inventados, si pones PDF reales
  en `test-fixtures/` (`cartola-debito.pdf`, `estado-cuenta-cmr.pdf`) los
  verifica también contra ellos; esa carpeta está en `.gitignore` y nunca
  se sube al repo.
- `transactionOps.js` — alta manual, cargos de suscripción, reglas
  retroactivas, edición desde conciliación.

## Estructura

```
src/
  main.jsx            punto de entrada, registro del service worker
  App.jsx             estado de UI (pestaña, filtros, modales) y composición
  index.css           Tailwind, temas claro/oscuro, escala tipográfica, mobile
  hooks/
    useAppData.js             estado de datos + guardado optimista en Supabase
    useTransactionActions.js  movimientos (débito/crédito), deshacer, conciliación
    useCatalogActions.js      categorías y suscripciones
    useImporters.js           importación de .xls/.pdf del banco y de la tarjeta
    useDerivedData.js         mes seleccionado y todo lo calculado (stats, gráficos)
    useToasts.js / useTheme.js / useIsMobile.js / useLongPress.js   UI
  lib/                lógica pura (con tests) y acceso a Supabase
    utils.js / stats.js / importers.js / transactionOps.js / reconcile.js
    parsePdfCartola.js / parseCreditCardXlsx.js / parseCreditStatementPdf.js
    storage.js / accountSettings.js / supabaseClient.js
    constants.js / types.js / exportCsv.js / exportBackup.js / readFile.js
  components/
    AuthGate / Auth / ResetPassword       login, registro, recuperación
    Header                                 navegación, selector de mes, barra inferior
    Resumen / Heatmap / Insights           dashboard
    Movimientos / CreditCard               listas de débito y tarjeta, importación, alta manual
    Conciliacion                           conciliación mensual
    CategoryManager / Subscriptions        categorías y suscripciones
    Shared                                 Modal, Panel, StatCard, selectores, etc.
    Toast / ConfirmDeleteButton / ErrorBoundary / Onboarding / HelpModal
supabase/
  schema.sql          esquema completo para un proyecto nuevo
  migrations/         cambios para proyectos existentes
```

## PWA y offline

La app es instalable (`vite-plugin-pwa`, `registerType: "autoUpdate"`): el
service worker precachea todo el app shell para que abra sin conexión, y se
autoactualiza cuando hay una versión nueva — no hace falta reinstalarla.
Busca actualizaciones al abrirla, cada vez que vuelves a ella desde segundo
plano (en el teléfono una PWA casi nunca se cierra del todo) y cada una hora
si queda abierta. Cuando encuentra una, la descarga y recarga la página sola.

## Deploy

El workflow de GitHub Actions (`.github/workflows/deploy.yml`) corre lint,
typecheck y tests en cada push y PR, y en cada push a `main` construye el
proyecto y lo publica en GitHub Pages. Para que funcione, agrega
`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` como *secrets* del
repositorio (**Settings → Secrets and variables → Actions**) — el build en
CI los necesita igual que el `.env` local.

El workflow instala con `npm ci`, que exige que `package-lock.json` esté en
sincronía con `package.json`. Si cambias dependencias, regenera el lock con
la misma versión de npm que usa CI (`npx npm@10 install`) para no romper el
deploy.

Para desplegar a mano en otro lado (Vercel, Netlify, etc.):

```bash
npm run build
```

El resultado queda en `dist/`. Como `vite.config.js` fija
`base: "/gastify/"` para servir bien en GitHub Pages, si lo alojas
en un dominio propio o en la raíz de otro hosting cambia ese valor a `/`.
