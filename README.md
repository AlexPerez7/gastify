# Gastify — gestor de gastos personal

PWA hecha en React + Vite para llevar el control de tus movimientos
bancarios, categorizarlos y conciliarlos contra el reporte oficial del
banco. Pensada para las cartolas de Banco Falabella (cuenta corriente y
tarjeta CMR), pero el importador de débito lee cualquier `.xls` con columnas
`Fecha | Descripción | Cargo | Abono | Saldo` en ese orden. Los datos viven en
Supabase (Postgres + Auth + Row Level Security), así que cada usuario ve solo
lo suyo y puede entrar desde cualquier dispositivo.

**En vivo:** https://alexperez7.github.io/gastify/

## Qué hace

**Movimientos (cuenta corriente)**
- Importa el `.xls` del banco o la cartola mensual en `.pdf`, arrastrándolos
  o desde un modal, con barra de progreso real. Detecta y omite duplicados
  aunque subas el `.xls` y el `.pdf` del mismo período, y concilia el saldo
  automáticamente con el del archivo más reciente.
- Carga manual de gastos e ingresos que aún no aparecen en el banco: monto
  primero con formato CLP en vivo, categoría y fecha con atajos "Hoy"/"Ayer".
- Lista agrupada por día ("Hoy", "Ayer", "Lunes, 3 de agosto"). En mobile:
  tocar edita, deslizar muestra editar/borrar y mantener presionado entra al
  modo selección. En desktop: edición en la misma fila.
- Selección múltiple con barra de acciones masivas para recategorizar o
  borrar varios movimientos a la vez.
- Borrar es inmediato y siempre se puede **deshacer** desde el aviso que
  aparece (el movimiento vuelve tal cual estaba).
- Búsqueda y filtros por categoría, tipo (ingreso/gasto) y origen
  (manual/banco); aviso de posibles duplicados entre un manual y uno del banco.
- Exportación a `.csv` y respaldo completo a `.json`.

**Tarjeta de crédito (CMR)**
- Importa el Excel de "Movimientos Facturados" por ciclo, con cuotas
  pendientes y monto total de cada compra (una compra en cuotas no se pierde
  al reaparecer en la cartola del mes siguiente).
- Importa el PDF del Estado de Cuenta para mostrar cupo, total a pagar y
  fecha límite. Separada de la cuenta corriente para no contar dos veces el
  mismo gasto (el pago de la tarjeta ya aparece como cargo en débito).

**Categorías**
- Categorías editables (nombre, ícono, color, presupuesto mensual) y una
  "memoria de comercio": puedes indicar que una descripción como
  `GOOGLE PLAY...` corresponde a "Claude", y la app recuerda esa regla para
  futuras importaciones (y corrige retroactivamente las que ya coincidían).
- Cada categoría es de gasto o de ingreso, y los selectores solo sugieren las
  del tipo que corresponde según el monto.
- Interruptor "cuenta como gasto" para transferencias entre tus propias
  cuentas: salen de la cuenta corriente pero no son consumo real, así que se
  excluyen de todos los cálculos sin dejar de aparecer en la lista.
- Una categoría puede sumar a un "Total ahorrado" aparte en Resumen (ej.
  traspasos a tu cuenta de ahorro), con un monto inicial ajustable.

**Suscripciones**
- Declaras cada cobro recurrente ("Netflix, $9.990, día 19") o marcas un
  movimiento existente como suscripción; la app genera el movimiento
  pendiente el día del cobro y lo concilia con el cargo real del banco.

**Resumen** (siempre de un mes concreto)
- Saldo actual (último saldo del banco + manuales cargados después) y
  tarjetas de ingresos, gastos (con comparación contra el mismo tramo de días
  del mes anterior), balance y total ahorrado.
- Insights en texto: variación del gasto vs. el mes pasado y la categoría
  que más subió.
- Donas de gasto e ingreso por categoría (tocar una abre sus movimientos),
  barras de los últimos 6 meses, presupuestos por categoría y un mapa de
  actividad diaria del último año (tocar un día muestra cuánto gastaste).
- Paleta de colores validada para daltonismo y contraste en ambos temas.
- Exportación del dashboard como imagen PNG.

**Conciliación**
- Compara los movimientos manuales contra el reporte del banco (mismo monto;
  fecha del banco hasta 5 días después de la manual o 2 antes, por la "fecha
  contable") y los fusiona: el del banco queda como oficial y hereda la
  categoría que le pusiste. Separa lo confirmado, lo que aún no tiene
  reporte importado y lo que no calza, con vínculo manual para los casos
  raros.

**General**
- Cuenta con email/contraseña (confirmación por correo) y recuperación de
  contraseña.
- Modo claro/oscuro con detección de la preferencia del sistema.
- Instalable como PWA, con soporte offline y actualización automática.
- Pensada primero para el teléfono: zonas táctiles amplias, hojas que suben
  desde abajo, sin zoom al escribir, respeta el notch.
- Onboarding de 3 pasos y ayuda integrada.

## Stack

React 18 + Vite 8 · Tailwind CSS 4 · Supabase (Postgres, Auth, RLS) ·
Recharts · Framer Motion · lucide-react · xlsx (SheetJS, build oficial desde
cdn.sheetjs.com — la versión publicada en npm quedó sin mantención y con
advisories) · pdfjs-dist · html-to-image · vite-plugin-pwa · Vitest ·
ESLint 9. Sin TypeScript (tipos vía JSDoc, chequeados con `tsc`) y sin
backend propio: toda la lógica vive en el cliente y habla directo con
Supabase.

## Requisitos

- Node.js 20.19 o superior (22 recomendado).
- Una cuenta gratuita de [Supabase](https://supabase.com).

## Puesta en marcha

### 1. Clonar e instalar

```bash
git clone https://github.com/AlexPerez7/gastify.git
cd gastify
npm install
```

### 2. Crear el proyecto en Supabase

Crea un proyecto nuevo en [supabase.com](https://supabase.com), abre el
**SQL Editor** y ejecuta el contenido de
[`supabase/schema.sql`](supabase/schema.sql) para armar las tablas con Row
Level Security (cada fila queda atada al usuario que la creó, y solo ese
usuario puede leerla o modificarla).

Si tu proyecto ya existía, **no** corras `schema.sql` de nuevo (recrearía
tablas que ya tienes): corre solo las migraciones de
[`supabase/migrations/`](supabase/migrations) que te falten, en orden.
Las `0001`–`0003` crean tablas y fallan si ya las tienes (en ese caso,
sáltalas); de la `0004` en adelante se pueden repetir sin problema:

| Migración | Qué agrega |
| --- | --- |
| `0001` | Suscripciones |
| `0002` | Movimientos de la tarjeta de crédito |
| `0003` | Estados de cuenta de la tarjeta |
| `0004` | Ahorro base (`savings_base`) |
| `0005` | `created_at` en movimientos (lo necesita "Deshacer") |
| `0006` | *Opcional:* recolorea las categorías por defecto a la paleta nueva |

Después, en **Authentication → URL Configuration**, agrega la URL donde vas
a correr o desplegar la app (ej. `http://localhost:5173` para desarrollo y
la URL de producción) tanto en *Site URL* como en *Redirect URLs* — la
recuperación de contraseña depende de que esto esté bien configurado.

Por defecto Supabase pide confirmación por email antes de dejar iniciar
sesión; si quieres saltarte ese paso en desarrollo, desactívalo en
**Authentication → Providers → Email**.

### 3. Variables de entorno

Copia `.env.example` a `.env` y completa con los valores de tu proyecto
(**Project Settings → API** en Supabase):

```bash
cp .env.example .env
```

```
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

### 4. Correr en desarrollo

```bash
npm run dev
```

Abre la URL que muestre la terminal (por defecto
`http://localhost:5173/gastify/`). Al crear tu cuenta y confirmar el email,
la app siembra las categorías por defecto automáticamente.

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
autoactualiza solo cuando hay una versión nueva. Si el sitio queda abierto
mucho tiempo sin recargar, revisa por una actualización cada una hora.

## Dónde quedan los datos

Todo se guarda en Supabase (Postgres) con Row Level Security: cada usuario
solo puede leer y modificar sus propios datos — nadie más, ni siquiera con la
anon key, puede ver los de otro usuario. Puedes bajar un respaldo completo en
cualquier momento desde Movimientos → "Descargar respaldo".

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
