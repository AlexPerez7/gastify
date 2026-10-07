// Deslizar para ver acciones (filas de Movimientos y de Conciliación en
// mobile). Archivo aparte (no en Shared.jsx): exportar constantes desde un
// archivo de componentes rompe el fast refresh. La decisión de abrir/cerrar
// es lógica pura y vive en src/lib/swipe.js (con test).
export { swipeShouldOpen } from "../lib/swipe.js";

// Spring y no una animación de duración fija: al soltar, la fila sigue con
// la velocidad que traía el dedo. Sin rebote a propósito — al pasarse de
// -ancho dejaría ver una franja vacía al lado de los botones.
export const SWIPE_SPRING = { type: "spring", duration: 0.4, bounce: 0 };
