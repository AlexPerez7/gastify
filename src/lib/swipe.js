// Decisión de "deslizar para ver acciones" (filas de Movimientos y de
// Conciliación en mobile): lógica pura, con test. La usa
// src/components/swipe.js junto con el spring.

// Un gesto rápido y corto ("flick") cuenta aunque no llegue a la mitad del
// ancho de los botones. Se mide como distancia ÷ duración de TODO el gesto
// (px/ms), no con info.velocity de framer-motion: esa viene suavizada y un
// flick de 40px en 130ms la dejaba en ~150px/s, igual que un arrastre lento.
const FLICK_SPEED = 0.11; // px/ms
const FLICK_MIN_DISTANCE = 8; // px: menos que esto es temblor del dedo

/**
 * ¿Al soltar, la fila queda abierta? Un flick decide por su dirección
 * (izquierda abre, derecha cierra); si no, decide la distancia.
 * @param {{ offset: { x: number } }} info  el PanInfo de framer-motion
 * @param {number} width  ancho de los botones revelados
 * @param {number} elapsedMs  desde onDragStart hasta onDragEnd
 */
export function swipeShouldOpen(info, width, elapsedMs) {
  const dist = Math.abs(info.offset.x);
  if (dist >= FLICK_MIN_DISTANCE && dist / Math.max(elapsedMs, 1) > FLICK_SPEED) return info.offset.x < 0;
  return info.offset.x < -width / 2;
}
