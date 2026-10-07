# Plan — pendientes de Gastify

Lista de trabajo para retomar. Ordenada por prioridad recomendada; los números
(n.º) son los del análisis de UI/UX del 2026-10-03. Al terminar algo, se marca
`[x]` y se mueve a "Hecho" con su commit.

Última actualización: 2026-10-06 · último commit: ver tabla "Hecho (2026-10-06)".

**Para retomar:** primero la sección 0 (pruebas en el teléfono), después la 1.
La deuda técnica quedó limpia salvo subir pdfjs/supabase, que necesita una
cartola PDF real a mano.

---

## 00. Bloqueante: migración 0008

- [ ] Correr `supabase/migrations/0008_rules_and_subscription_frequency.sql`
      en el SQL Editor de Supabase. El commit de reglas/suscripciones de la
      6.1 queda **sin publicar** hasta entonces: la app manda las columnas
      nuevas en cada guardado de reglas y suscripciones, y sin ellas Supabase
      rechaza el upsert. Después: `git push` y verificar el deploy.

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
- [ ] Movimientos → Filtros: el selector de categoría se abre **encima** de la
      hoja y se puede elegir (antes quedaba tapado; arreglado en `e302c9b`).
- [ ] Ahorro base: con la 0007 ya corrida, declarar/editar "Total ahorrado"
      guarda sin error.

## 1. Lista larga (n.º 19)

(La parte de conciliación, n.º 18, quedó hecha: ver "Hecho (2026-10-06)".)

- [ ] **n.º 19 · Lista larga.** Con "Todo" se renderizan todos los movimientos
      (y en mobile cada fila monta un `motion.div`). Paginar por mes con
      "Cargar más", o virtualizar. Medir antes con un fixture de ~2.000 filas.

## 2. Revisión de animaciones

- [ ] Correr la skill `improve-animations` (solo lectura → plan priorizado).
      Ya identificado: la transición de cada cambio de pestaña desplaza el
      contenido (acción frecuente → dejar solo fundido o nada, n.º 26);
      `.tx-row-wrap` anima `max-height` con `ease-in`; varios popovers sin
      `transform-origin` en su disparador.

## 3. Pulido (de a poco, al tocar cada pantalla)

- [ ] **n.º 17** · Etiqueta "Suscripciones" de la barra inferior no cabe a
      320–360px → acortar ("Suscrip.") o cambiar qué pestañas van ahí.
- [ ] **n.º 22** · Total del día en los encabezados de la lista ("Hoy · −$45.300").
- [ ] **n.º 23** · "Guardar resumen" (PNG) ocupa el primer lugar de Resumen →
      moverlo al final o a un menú "⋮".
- [ ] **n.º 25** · Categorías: nombre y presupuesto se guardan al salir del campo
      sin aviso local → mostrar un ✓ junto al campo.
- [ ] Botón "Importar Excel" también acepta PDF → "Importar cartola".

## 4. Deuda técnica

- [ ] Subir `pdfjs-dist` (6.2 → 6.4) y `supabase-js` (2.111 → 2.117) a
      propósito, probando la importación de cartolas PDF reales (los parsers
      no tienen tests). Quedaron fijados al regenerar el lock.

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
| `0ea2acd` | 6.1: proyección a fin de mes, tasa de ahorro, filtro por rango de monto, frecuentes y "Duplicar" en el alta manual |
| `3037ad4` | 6.1: reglas de comercio con tipo de coincidencia, rango de monto y "aplicar a lo existente" (pantalla nueva en Categorías); suscripciones anuales y con fecha de término. Requiere la migración **0008** |
| (este) | Sección 1 / n.º 18: aviso en Movimientos cuando hay manuales que no calzan con la cartola; sin botón "Conciliar mes" (ya concilia al entrar); textos reales en los paneles vacíos; filas "Clásica" en mobile en Conciliación y en la tarjeta (`ClassicRowContent`); nombre de categoría en tinta en la tarjeta (contraste) |

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
