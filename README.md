# Gastify — gestor de gastos personal

PWA hecha en React + Vite para llevar el control de tus movimientos
bancarios, categorizarlos y conciliarlos contra el reporte oficial del
banco. Pensada para las cartolas de Banco Falabella (cuenta corriente y
tarjeta CMR), pero el importador de débito lee cualquier `.xls` con columnas
`Fecha | Descripción | Cargo | Abono | Saldo` en ese orden. Los datos viven en
Supabase (Postgres + Auth + Row Level Security), así que cada usuario ve solo
lo suyo y puede entrar desde cualquier dispositivo.

**En vivo:** https://alexperez7.github.io/gastify/

## En pocas palabras

- **Movimientos:** importa el `.xls` o la cartola `.pdf` del banco sin
  duplicar, carga manual con "frecuentes", lista por día, acciones masivas,
  deshacer, filtros y exportación.
- **Tarjeta CMR:** compras por ciclo con cuotas y resumen del estado de cuenta.
- **Categorías y reglas de comercio:** categorización automática que aprende
  de tus correcciones.
- **Suscripciones:** cobros recurrentes que se concilian solos con el banco.
- **Resumen:** saldo actual, gasto por día, proyección a fin de mes,
  presupuestos y gráficos.
- **Conciliación:** fusiona lo que anotaste a mano con el reporte del banco.
- **PWA:** se instala en el teléfono, abre sin conexión y se actualiza sola.

## Documentación

| Documento | Contenido |
| --- | --- |
| [Qué hace](docs/funciones.md) | Todas las funciones en detalle |
| [Instalación](docs/instalacion.md) | Requisitos, Supabase, migraciones, variables de entorno, correr en local |
| [Desarrollo](docs/desarrollo.md) | Scripts, tests, estructura del código, PWA, datos y deploy |

## Stack

React 18 + Vite 8 · Tailwind CSS 4 · Supabase (Postgres, Auth, RLS) ·
Recharts · Framer Motion · lucide-react · xlsx (SheetJS, build oficial desde
cdn.sheetjs.com — la versión publicada en npm quedó sin mantención y con
advisories) · pdfjs-dist · html-to-image · vite-plugin-pwa · Vitest ·
ESLint 9. Sin TypeScript (tipos vía JSDoc, chequeados con `tsc`) y sin
backend propio: toda la lógica vive en el cliente y habla directo con
Supabase.

## Dónde quedan los datos

Todo se guarda en Supabase (Postgres) con Row Level Security: cada usuario
solo puede leer y modificar sus propios datos. Puedes bajar un respaldo
completo en cualquier momento desde Movimientos → "Descargar respaldo".
