# Plan — pendientes de Gastify

Lista de trabajo para retomar. Ordenada por prioridad recomendada; los números
(n.º) son los del análisis de UI/UX del 2026-10-03. Al terminar algo, se marca
`[x]` y se mueve a "Hecho" con su commit.

Última actualización: 2026-10-04.

---

## 0. Verificar en el teléfono (antes de seguir)

Cosas que se probaron con Playwright o leyendo el código, pero que dependen de
hardware real. Con la app **instalada** (PWA) en el iPhone/Android:

- [ ] El header no queda debajo del notch / reloj (safe-area-inset-top).
- [ ] Formulario "Nuevo movimiento" con el teclado abierto: el botón Guardar
      queda alcanzable; el monto hace zoom 0 (input de 28px).
- [ ] La barra de estado cambia de color con el tema claro/oscuro.
- [ ] Fila de movimiento: mantener presionado entra a selección; deslizar
      muestra editar/borrar **sin** abrir el editor.
- [ ] Borrar → **Deshacer** → recargar: el movimiento sigue en su lugar del día
      y el saldo actual no cambió (confirma que `created_at` se conserva).
- [ ] Mapa de actividad: tocar un día muestra su monto.

## 2. Conciliación y lista larga (n.º 18–19)

- [ ] **n.º 18 · Conciliación más visible.** En mobile solo se llega por un ícono
      chico en Movimientos. Agregar un aviso en Movimientos
      ("3 manuales por conciliar →") cuando `reconcileStats.manuals.length > 0`.
- [ ] Quitar el botón "Conciliar mes": ya concilia solo al entrar
      (`useEffect` en `Conciliacion.jsx`).
- [ ] Paneles vacíos: reemplazar el "—" por un texto real.
- [ ] Filas de Conciliación (y de la tarjeta, `CreditCard.jsx`) con el mismo
      layout "Clásica" que Movimientos en mobile, para que las tres listas se
      vean iguales.
- [ ] **n.º 19 · Lista larga.** Con "Todo" se renderizan todos los movimientos
      (y en mobile cada fila monta un `motion.div`). Paginar por mes con
      "Cargar más", o virtualizar. Medir antes con un fixture de ~2.000 filas.

## 3. Revisión de animaciones

- [ ] Correr la skill `improve-animations` (solo lectura → plan priorizado).
      Ya identificado: la transición de cada cambio de pestaña desplaza el
      contenido (acción frecuente → dejar solo fundido o nada, n.º 26);
      `.tx-row-wrap` anima `max-height` con `ease-in`; varios popovers sin
      `transform-origin` en su disparador.

## 4. Pulido (de a poco, al tocar cada pantalla)

- [ ] **n.º 17** · Etiqueta "Suscripciones" de la barra inferior no cabe a
      320–360px → acortar ("Suscrip.") o cambiar qué pestañas van ahí.
- [ ] **n.º 22** · Total del día en los encabezados de la lista ("Hoy · −$45.300").
- [ ] **n.º 23** · "Guardar resumen" (PNG) ocupa el primer lugar de Resumen →
      moverlo al final o a un menú "⋮".
- [ ] **n.º 25** · Categorías: nombre y presupuesto se guardan al salir del campo
      sin aviso local → mostrar un ✓ junto al campo.
- [ ] Botón "Importar Excel" también acepta PDF → "Importar cartola".
- [ ] Contraste del texto en el color de la categoría (amarillo/violeta en tema
      claro) donde todavía se use: `CreditCard.jsx`, `Conciliacion.jsx`.

## 5. Deuda técnica

- [ ] **vite 5 + vitest 4 (que trae vite 8)**: dos vites en el árbol, origen del
      lock frágil que rompió el deploy. Subir `vite` a 7 (y revisar
      `@vitejs/plugin-react`, `vite-plugin-pwa`, `@tailwindcss/vite`) para que
      vitest use el mismo.
- [ ] Focus trap en `Modal` (hoy: Esc + autofocus, pero Tab puede salir del
      diálogo).

## 6. Opcional en Supabase

- [ ] `supabase/migrations/0006_recolor_default_categories.sql`: pasa las
      categorías por defecto no personalizadas a la paleta validada. Sin
      correrla, la app funciona igual (solo cambian los colores de categorías
      nuevas).

---

## Hecho (2026-10-03)

| Commit | Qué |
| --- | --- |
| `d742f65` | CLAUDE.md por área + migración 0004 (`savings_base`) |
| `c49033f` | App.jsx dividido en `src/lib` (puro, con tests) + `src/hooks` (42 → 91 tests) |
| `2afbdfd` | UI/UX fases 1–3: fecha local, Resumen siempre por mes, base mobile, `Modal` común, formulario nuevo |
| `3ab951b` | Fila de movimiento "Clásica" en mobile (elegida por prototipo) + selección por toque largo |
| `a6694ea` | Borrar con "Deshacer" + avisos con acción + migración 0005 (`created_at`) |
| `fd30db0` | Escala tipográfica de 6 tamaños que crecen en mobile |
| `a96edb0` | Gráficos: mapa de actividad legible en mobile, eje "$1,5M", donas con "Resto", paleta validada |
| `cf8d117` | Deploy arreglado (lock con el esbuild que exige npm 10 en el runner) |

## Hecho (2026-10-04)

| Commit | Qué |
| --- | --- |
| `05da7ec` | Workflow: acciones con Node 24 (checkout/setup-node v7, pages v5) y Node 22 en el runner |
| `45ace1d` | Ahorro base antes de ajustar el saldo: migración 0007 + saldo `null` en vez de error/`NaN` (0007 ya corrida) |
| — | Clases compartidas a `components/classes.js` (lint sin warnings) |

Resueltos del análisis: n.º 1–16, 20, 21, 24, 27.
