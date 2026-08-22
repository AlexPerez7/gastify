# Gastify — gestor de gastos personal

PWA hecha en React + Vite para llevar el control de tus movimientos
bancarios, categorizarlos y conciliarlos contra el reporte oficial del
banco. Pensada originalmente para las cartolas de Banco Falabella, pero el
parser lee cualquier `.xls` con columnas `Fecha | Descripción | Cargo |
Abono` en ese orden. Los datos viven en Supabase (Postgres + Auth + Row
Level Security), así que cada usuario ve solo lo suyo y puede entrar desde
cualquier dispositivo.

## Qué hace

**Movimientos**
- Importa el `.xls` del banco arrastrándolo o desde un modal de
  importación; detecta y omite duplicados si vuelves a subir un archivo que
  se traslapa con datos ya cargados, con una barra de progreso real de
  lectura.
- Carga manual de gastos e ingresos que aún no aparecen en el banco.
- Lista agrupada por día ("Hoy", "Ayer", "Lunes, 3 de agosto"), con swipe
  para editar/borrar en mobile y edición inline en desktop.
- Selección múltiple con checkboxes y una barra de acciones masivas para
  borrar o recategorizar varios movimientos a la vez.
- Búsqueda y filtro por categoría.

**Categorías**
- Categorías editables (nombre, ícono, color) y una "memoria de comercio":
  puedes indicar que una descripción como `GOOGLE PLAY...` corresponde a
  "Claude", y la app recuerda esa regla para futuras importaciones (y
  corrige retroactivamente las que ya coincidían).
- Cada categoría tiene un interruptor "cuenta como gasto": pensado para
  transferencias entre tus propias cuentas (ahorro, etc.), que salen de la
  cuenta corriente pero no son consumo real — se excluyen de todos los
  cálculos de gasto sin dejar de aparecer en la lista de movimientos.
- Cada categoría se marca como de gasto, de ingreso o de ambos (para las
  que aplican en los dos sentidos, ej. Transferencias), para poder tener
  categorías propias de ingreso (Sueldo, Reembolsos, etc.) además de la
  categoría "Ingresos" genérica — los selectores de categoría solo sugieren
  las del tipo que corresponde según el monto del movimiento.
- Una categoría se puede marcar para que sus movimientos se acumulen en un
  "Total ahorrado" aparte en Resumen (ej. traspasos a tu cuenta de ahorro):
  no es una cuenta con saldo propio, es solo la suma histórica de esos
  movimientos, sin contar como gasto.

**Resumen**
- Hero con lo gastado en lo que va del mes y comparación contra el mismo
  tramo de días del mes anterior ("ritmo habitual").
- Insights en texto plano: variación de gasto total vs. mes pasado,
  categoría que más subió, aviso si el mes va en verde.
- Gráfico de gasto por categoría, evolución de los últimos 6 meses, y un
  heatmap estilo GitHub de actividad de gasto diaria.
- Botón para exportar el dashboard completo como imagen PNG.

**Conciliación**
- Compara los movimientos manuales contra el reporte del banco (mismo
  monto, fecha con hasta 3 días de diferencia) y separa lo confirmado, lo
  que aún no tiene reporte importado, y lo que sí tiene reporte pero no
  calza.

**General**
- Cuenta con email/contraseña (confirmación por correo) y recuperación de
  contraseña.
- Modo claro/oscuro con detección de preferencia del sistema.
- Instalable como PWA con soporte offline y actualización automática del
  service worker.
- Respaldo de todos tus datos (movimientos y categorías) a un `.json`
  descargable, en cualquier momento.
- Onboarding de 3 pasos la primera vez que entras.
- Totalmente responsive, con gestos táctiles nativos en mobile.

## Stack

React 18 + Vite 5 · Supabase (Postgres, Auth, RLS) · Recharts · Framer
Motion · lucide-react · xlsx · html-to-image · vite-plugin-pwa · Vitest.
Sin TypeScript, sin backend propio: toda la lógica vive en el cliente y
habla directo con Supabase.

## Requisitos

- Node.js 18 o superior.
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

Si tu proyecto ya existía antes de que existiera la sección de
Suscripciones, no corras `schema.sql` de nuevo (recrearía tablas que ya
tienes) — corre solo el archivo de migración correspondiente en
[`supabase/migrations/`](supabase/migrations) contra tu base existente
(por ahora hay uno: [`0001_add_subscriptions.sql`](supabase/migrations/0001_add_subscriptions.sql)).

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

Abre la URL que muestre la terminal (por defecto `http://localhost:5173`).
Al crear tu cuenta y confirmar el email, la app siembra las categorías por
defecto automáticamente.

## Scripts disponibles

| Comando           | Qué hace                                               |
| ------------------ | -------------------------------------------------------- |
| `npm run dev`       | Servidor de desarrollo con hot reload                    |
| `npm run build`     | Build de producción en `dist/`                           |
| `npm run preview`   | Sirve el build de producción localmente para probarlo     |
| `npm test`          | Corre la suite de Vitest                                  |

## Tests

```bash
npm test
```

Cubre las funciones puras de `src/lib/utils.js`: parseo de fechas y montos
del banco, categorización automática, reglas de comercio, agrupado de
movimientos por día, y el generador de insights.

## Estructura

```
src/
  main.jsx                    punto de entrada, registro del service worker
  App.jsx                      estado global, persistencia, derivación de stats/insights
  index.css                     temas claro/oscuro, animaciones, responsive
  lib/
    supabaseClient.js             cliente de Supabase
    storage.js                    sync-shim: get/set sobre las tablas de Supabase
    constants.js                  tokens de diseño, categorías por defecto, reglas de comercio
    utils.js                      parseo de fechas/montos, categorización, agrupado por día, insights
    useTheme.js / useIsMobile.js  hooks de UI
    useToasts.js                  notificaciones flotantes
    readFile.js                   lectura de archivos con progreso real
    exportBackup.js               exportación de respaldo a .json
  components/
    AuthGate.jsx / Auth.jsx / ResetPassword.jsx   login, registro, recuperación de contraseña
    Header.jsx                                     navegación, selector de mes, tema
    CategoryManager.jsx                            alta/edición/borrado de categorías
    Resumen.jsx / HeroStat.jsx / Heatmap.jsx / Insights.jsx   dashboard
    Movimientos.jsx                                import, alta manual, tabla, acciones masivas
    Conciliacion.jsx                               vista de conciliación mensual
    Onboarding.jsx                                 introducción de 3 pasos
    ConfirmDeleteButton.jsx / Toast.jsx            popover de confirmación, notificaciones flotantes
    ErrorBoundary.jsx / Shared.jsx                 manejo de errores, UI compartida (Panel, StatCard, etc.)
```

## PWA y offline

La app es instalable (`vite-plugin-pwa`, `registerType: "autoUpdate"`): el
service worker precachea todo el app shell para que abra sin conexión, y se
autoactualiza solo cuando hay una versión nueva. Si el sitio queda abierto
mucho tiempo sin recargar, revisa por una actualización cada una hora.

## Dónde quedan los datos

Todo se guarda en Supabase (Postgres) con Row Level Security: cada usuario
solo puede leer y modificar sus propios movimientos, categorías y reglas de
comercio — nadie más, ni siquiera con la anon key, puede ver los datos de
otro usuario. Puedes bajar un respaldo completo en cualquier momento desde
Movimientos → "Descargar respaldo".

## Deploy

El repo incluye un workflow de GitHub Actions
(`.github/workflows/deploy.yml`) que en cada push a `main` construye el
proyecto y lo publica en GitHub Pages. Para que funcione, agrega
`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` como *secrets* del
repositorio (**Settings → Secrets and variables → Actions**) — el build en
CI los necesita igual que el `.env` local.

Para desplegar a mano en otro lado (Vercel, Netlify, etc.):

```bash
npm run build
```

El resultado queda en `dist/`. Como `vite.config.js` fija
`base: "/gastify/"` para servir bien en GitHub Pages, si lo alojas
en un dominio propio o en la raíz de otro hosting cambia ese valor a `/`.
