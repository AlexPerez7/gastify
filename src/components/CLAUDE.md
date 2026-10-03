# src/components — UI

> Parte del contexto de Gastify. Índice y reglas generales en el
> [CLAUDE.md principal](../../CLAUDE.md).

Los componentes son mayormente **presentacionales**: el estado y los callbacks
vienen por props desde `App.jsx`. Un componente no llama a Supabase ni a
`storage` (excepciones: `AuthGate`, `Auth`, `ResetPassword`, que usan
`supabase.auth`). Estado local de UI (modales, edición inline, swipe) sí va aquí.

Exports con nombre (`export function X`), salvo `App` (default). Íconos de
`lucide-react`.

## Mapa

| Componente | Rol |
| --- | --- |
| `AuthGate.jsx` | decide Auth / ResetPassword / App según sesión; maneja `#error=` de links vencidos |
| `Auth.jsx`, `ResetPassword.jsx` | login/registro/recuperación |
| `Header.jsx` | `Header`, `BottomNav` (mobile), `MonthBar` (selector de mes, badges de salud de conciliación), `ExportMenu` |
| `Resumen.jsx` | dashboard: hero, saldo dinámico, ahorro, gráficos recharts, export PNG (html-to-image); usa `Heatmap`, `Insights` |
| `Movimientos.jsx` (~1000 líneas) | lista débito agrupada por día, import modal, alta manual, edición inline/swipe (framer-motion), selección múltiple; contiene la sub-vista `CreditCard` |
| `CreditCard.jsx` | vista tarjeta CMR: movimientos por ciclo, cuotas, resumen del estado de cuenta |
| `Conciliacion.jsx` | confirmados / sin reporte / descuadres, vínculo manual |
| `CategoryManager.jsx` | CRUD de categorías (ícono, color, tipo, presupuesto, excluir de gasto, ahorro) |
| `Subscriptions.jsx` | suscripciones declaradas |
| `Shared.jsx` | piezas reutilizables (ver abajo) |
| `Toast.jsx`, `ConfirmDeleteButton.jsx`, `ErrorBoundary.jsx`, `Onboarding.jsx`, `HelpModal.jsx`, `Heatmap.jsx`, `Insights.jsx` | utilitarios |

## Shared.jsx — reutilizar antes de crear

`Modal` (**todo diálogo nuevo usa este**: Esc, `dismissOnBackdrop` en false
mientras un formulario tenga datos, `sheetOnMobile` para que suba desde abajo
en mobile, rol de diálogo), `Panel`, `StatCard`, `EmptyState`, `EmptyNote`,
`FieldInput` (es un `<label>`), `ToggleSwitch`,
`CategorySelect` (con `allOption`), `CategoryQuickAdd`, skeletons
(`AppShellSkeleton`, `ResumenSkeleton`, `MovimientosSkeleton`, `Skeleton`), y
clases: `BTN_PRIMARY`, `BTN_GHOST`, `pillClass(active)`. Constantes locales
existentes: `ACTION_BTN` (Movimientos), `HEADER_ICON_BTN` (Header).

## Estilos: Tailwind v4 (migración de inline styles terminada)

- `src/index.css` importa Tailwind **sin preflight** (solo `theme.css` +
  `utilities.css`). Por eso:
  - El `@layer base` pone `border-width: 0; border-style: solid` en `*` — ambas
    líneas son necesarias.
  - En `<button>` usar `bg-transparent` (no `bg-none`, que solo limpia
    `background-image`) para quitar el gris por defecto del navegador.
- Colores vía tokens del tema (definidos en `:root` / `[data-theme]`, nunca hex
  sueltos): `bg-bg`, `bg-surface`, `bg-surface-alt`, `border-border`,
  `text-ink`, `text-muted`, `text-faint`, `text-accent`, `text-income`,
  `text-expense`, `text-pending`, `bg-tint-accent`, `bg-tint-income`,
  `bg-tint-expense`.
- Las vars crudas se llaman `--c-*`; en JS se referencian vía `TOKENS` de
  `src/lib/constants.js` (para props de recharts/SVG, que no aceptan clases).
- `dark:` sigue al toggle manual `data-theme`, no a `prefers-color-scheme`.
- **Tamaños de texto: solo la escala con nombre** — `text-micro` (etiquetas
  tipo "nuevo"), `text-caption` (etiquetas de campo, metadatos), `text-small`
  (ayudas, botones compactos), `text-body` (texto principal), `text-body-lg`
  (nombres destacados), `text-title` (títulos de panel/modal). Crecen solos
  en mobile (variables `--fs-*` en `index.css`). Nada de `text-[12.5px]` ni
  `text-xs`; tamaños propios solo para números grandes (saldo, montos
  destacados) y el mapa de actividad.
- Fuentes: `font-sans` (Inter), `font-display`/`.display` (Space Grotesk),
  `font-mono`/`.mono` (JetBrains Mono, para cifras).
- `style={{}}` solo para valores realmente dinámicos: color de categoría
  (`${c.color}22`), color por signo del monto, dimensiones calculadas
  (Heatmap, swipe), `box-shadow`/`rgba` puntuales.
- Clases globales en `index.css` (`.tab-panel`, `.app-main`, animaciones,
  media queries) — revisarlas antes de duplicar.

## Mobile y UX

- Botones de ícono chicos llevan la clase `tap-expand` (agranda la zona táctil
  con un `::after` invisible, sin cambiar el layout). Objetivo: ~40px o más.
- `:hover` en CSS propio va dentro de `@media (hover: hover) and (pointer: fine)`
  (las utilidades `hover:` de Tailwind v4 ya lo hacen solas).
- Alturas de pantalla con `dvh`, no `vh`. Scroll interno de hojas/popovers
  con `overscroll-contain`.
- Popovers que manejan Esc llaman `e.preventDefault()` para que el `Modal`
  de abajo no se cierre también.

- `useIsMobile()` (640px, en `src/hooks/`) para ramas de layout; en mobile hay `BottomNav`,
  swipe para editar/borrar y gestos táctiles.
- Feedback al usuario con `pushToast(kind, msg)` (`ok` | `warn` | `error` |
  `loading`); errores de sync en el banner `syncError` de App.
- Selectores de categoría filtran por tipo según el signo del monto
  (`categoryMatchesType`); usar `labelWithTypeIfAmbiguous` cuando se mezclan
  tipos.
- Textos de UI en español chileno, tuteo ("Importa tu cartola", "Llevas
  gastado").

## Verificación

Tras cambios visuales: `npm run lint` y `npm run build`, y revisar en
`npm run dev` en ancho mobile y desktop, tema claro y oscuro.
