# Plan — pendientes de Gastify

Lista de trabajo para retomar. Ordenada por prioridad recomendada; los números
(n.º) son los del análisis de UI/UX del 2026-10-03. Al terminar algo, se marca
`[x]` y se mueve a "Hecho" con su commit.

Última actualización: 2026-10-06 · último commit: ver tabla "Hecho (2026-10-06)".

**Para retomar:** quedan los tests de los parsers (sección 4), la 5 (opcional) y las ideas de la 6.2 en adelante.
La deuda técnica quedó limpia salvo subir pdfjs/supabase, que necesita una
cartola PDF real a mano.

---

## 0. Verificar en el teléfono

Hecho el 2026-10-07 (pruebas del usuario con la PWA instalada: notch,
teclado, gestos, "Deshacer", lo nuevo de la 6.1, sección 1, lista larga y
animaciones). Repetir esta ronda tras cambios grandes de UI.

## 2. Animaciones

Auditoría del 2026-10-07 completa (ver "Hecho"). Pendiente solo probarlo en
el teléfono (sección 0).

## 3. Pulido

Hecho (ver "Hecho (2026-10-07)"): n.º 17, 22, 23, 25 e "Importar cartola".

## 4. Deuda técnica

- [ ] **Tests de los parsers de PDF.** Hoy no tienen: la subida de pdfjs se
      validó a mano con cartolas reales (que NO pueden ir al repo: es
      público). Idea: separar en `parsePdfCartola.js` la parte pura (ítems de
      texto con x/y → filas) de la lectura con pdfjs, y testearla con ítems
      sintéticos; lo mismo con el texto del estado de cuenta CMR.
- [ ] El build genera dos `pdf.worker.min` (`.mjs` 1,26 MB vía `?url` y un
      `.js` de 430 KB). Ya pasaba con pdfjs 6.2; averiguar si el `.js` sobra.

## 5. Opcional en Supabase

- [ ] `supabase/migrations/0006_recolor_default_categories.sql`: pasa las
      categorías por defecto no personalizadas a la paleta validada. Sin
      correrla, la app funciona igual (solo cambian los colores de categorías
      nuevas).

## 6. Ideas sacadas de ezbookkeeping (2026-10-06)

Análisis de [mayswind/ezbookkeeping](https://github.com/mayswind/ezbookkeeping)
(app de finanzas self-hosted, Go + Vue). Ordenadas por valor para Gastify; la
recomendación es partir por 6.1 (lógica pura en `src/lib`, con tests, casi sin
tocar el esquema).

### 6.1 Alto impacto, encajan directo

Hecha (ver tabla "Hecho (2026-10-06)"). Quedó fuera a propósito:

- Suscripciones **semanales / cada N días**: generarían 4–5 manuales pendientes
  por mes que conciliar a mano; no hay casos reales hoy. Si aparece uno,
  `subscriptionChargesInMonth` es el punto a extender.
- **Búsqueda por palabra exacta**: el filtro por monto cubre el caso de uso
  real (encontrar un cargo puntual); se puede sumar si hace falta.
- **Rango "ciclo de facturación" en la tarjeta**: ya existía — la vista CMR
  agrupa por `statementMonth`, que *es* el ciclo, no el mes calendario. Las
  compras no facturadas no se pueden mostrar porque el Excel de CMR solo trae
  las facturadas.

### 6.2 Valor medio, más trabajo

- [ ] **IA para cargar movimientos**: foto de boleta, o pegar el SMS/correo de
      aviso de compra del banco → JSON con las categorías del usuario como
      opciones. Sin backend: Edge Function de Supabase con la API key. Sus
      prompts (`templates/prompt/*.tmpl`) sirven de base.
- [ ] **Etiquetas (tags)** transversales a la categoría ("vacaciones-2026",
      "reembolsable"), con filtro. Migración + toRow/fromRow + tipos.
- [ ] **Nota libre** por movimiento (una columna `comment`).
- [ ] **Subcategorías de dos niveles** (Comida → Supermercado / Delivery), donas
      por categoría principal o secundaria. Cambio grande de modelo: evaluar.
- [ ] **Estado de conciliación con saldos**: saldo inicial + entradas − salidas
      = saldo final para un rango, "conciliado hasta acá" y filtro "desde la
      última conciliación". Ayuda a encontrar descuadres de saldo.
- [ ] **Tendencia del saldo** en el tiempo (las filas del banco ya traen saldo).
- [ ] **Calendario del mes**: grilla con el gasto de cada día; tocar un día
      lista sus movimientos.
- [ ] **Ranking de categorías** en barras horizontales con % del total, como
      alternativa a la dona (se lee mejor en mobile con muchas categorías).
- [ ] **Más rangos**: últimos 7/30 días, esta semana, este año, últimos 12
      meses y personalizado.

### 6.3 Pulido

- [ ] **Ocultar montos** (ojo en Resumen) para abrir la app en público.
- [ ] **Bloqueo con PIN / biometría** (WebAuthn) al abrir la PWA.
- [ ] **Borrador automático** del formulario "Nuevo movimiento".
- [ ] **Resumen configurable**: mostrar/ocultar (y quizá reordenar) secciones.
- [ ] **Total del mes** en el encabezado de la lista (junto con n.º 22).
- [ ] Ajuste de **tamaño de texto** en la app.
- [ ] **Categorías preset elegibles** al crear la cuenta.
- [ ] **Mover todos los movimientos** de una categoría a otra antes de borrarla.
- [ ] **Exportar CSV de la vista filtrada** (hoy se exporta todo).

### 6.4 Exploratorias

- [ ] **Explorador de consultas guardadas** (condiciones arbitrarias → gráfico
      o tabla, con edición masiva sobre el resultado).
- [ ] **Gráfico generado por IA** a partir de una pregunta.
- [ ] **Servidor MCP / API** para preguntarle a Claude por los propios datos.
- [ ] **Importador CSV/Excel con mapeo de columnas** para otros bancos, sin
      escribir un parser por banco.
- [ ] **Adjuntar foto** (boleta/comprobante) a un movimiento (Supabase Storage).
- [ ] Geolocalización del gasto manual + mapa.

Descartado (no aplica a un usuario, CLP y bancos chilenos): multimoneda y tipos
de cambio, zonas horarias por movimiento, multi-cuenta con transferencias,
OFX/QIF/MT940/GnuCash, OIDC/2FA, self-hosting en Docker.

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

## Hecho (2026-10-06)

| Commit | Qué |
| --- | --- |
| `2ca403e` | Sección 6 del PLAN: ideas sacadas de ezbookkeeping |
| — | Migración **0008** corrida en Supabase (verificado vía PostgREST); publicado todo lo de abajo |
| `0ea2acd` | 6.1: proyección a fin de mes, tasa de ahorro, filtro por rango de monto, frecuentes y "Duplicar" en el alta manual |
| `3037ad4` | 6.1: reglas de comercio con tipo de coincidencia, rango de monto y "aplicar a lo existente" (pantalla nueva en Categorías); suscripciones anuales y con fecha de término. Requiere la migración **0008** |
| `5c320bd` | Sección 1 / n.º 18: aviso en Movimientos cuando hay manuales que no calzan con la cartola; sin botón "Conciliar mes" (ya concilia al entrar); textos reales en los paneles vacíos; filas "Clásica" en mobile en Conciliación y en la tarjeta (`ClassicRowContent`); nombre de categoría en tinta en la tarjeta (contraste) |
| `8e112ea` | n.º 19 · Lista larga por tandas de 100 filas (scroll infinito + "Mostrar más"). Medido con 2.000 filas, mobile, CPU ×4, React dev: por tecla al buscar 0,9–3,3 s → 0,25–0,47 s; volver a la lista completa 12,4 s → ~0,3 s; DOM 75k → 3,8k nodos |
| `7e3f499` | Animaciones: tokens de curva (`--ease-out`, `--ease-in-out`, `--ease-drawer`, `--ease-overshoot`); pestañas principales sin animación y Resumen sin escalonado (n.º 26); filas sin animación de entrada al montarse; colapso al borrar con `grid-template-rows` y ease-out (antes `max-height` + `ease-in`); la regla global de botones ya no pisa `transition-colors` ni las transiciones propias (estaba fuera de `@layer`) |
| `2bb4953` | Animaciones, resto de la auditoría: menú ⋮, `CategorySelect` y confirmar borrado entran desde su botón (`.popover`); toasts con salida interrumpible y el stack se reacomoda sin saltos (`.toast-slot`); modales y hojas con salida animada (Esc/fondo/✕ y botones propios vía `useModalClose`); deslizar filas abre/cierra con un gesto rápido (distancia ÷ duración > 0,11 px/ms) y termina con spring sin rebote |

## Hecho (2026-10-07)

| Commit | Qué |
| --- | --- |
| `4d8f9bb` | Pulido: barra inferior cabe a 320px ("Suscrip.", "+" de ancho fijo, etiquetas que no empujan) (n.º 17); total del día en los encabezados de Movimientos y de la tarjeta, con gasto real (`computeDayTotals`) (n.º 22); "Guardar resumen como imagen" al final de Resumen (n.º 23); ✓ "Guardado" al salir del nombre/presupuesto de una categoría (n.º 25); "Importar cartola"; `swipeShouldOpen` a `src/lib/swipe.js` con test |
| (este) | `pdfjs-dist` 6.2.108 → 6.4.299 y `supabase-js` 2.111.0 → 2.117.2. Validado con una cartola de débito y un estado de cuenta CMR reales (fuera del repo): salida idéntica a la de antes, 81 filas con la cadena de saldos cuadrando 80/80, los 9 campos de CMR; un solo vite, `npm audit` en 0, el build de producción arranca sin errores |

## Hecho (2026-10-04)

| Commit | Qué |
| --- | --- |
| `05da7ec` | Workflow: acciones con Node 24 (checkout/setup-node v7, pages v5) (Node 22 en el runner; pasó a 24 en `75908d4`) |
| `45ace1d` | Ahorro base antes de ajustar el saldo: migración 0007 + saldo `null` en vez de error/`NaN` (0007 ya corrida) |
| `499ebec` | Clases compartidas a `components/classes.js` (lint sin warnings) |
| `e302c9b` | Focus trap en `Modal` (`useFocusTrap`) + popovers en portal por encima del modal (el selector de categoría de Filtros quedaba tapado) |
| `eccd799` | vite 5 → 8 (un solo vite en el árbol, sin esbuild) + plugin-react 5.2; bundle inicial 478 → 433 KB |
| `75908d4` | `npm audit` en 0: vitest 4.1.11 + lock regenerado con npm 11; CI a Node 24 / npm 11 (npm 10 ya no resolvía el árbol) |

Resueltos del análisis: n.º 1–16, 20, 21, 24, 27.
