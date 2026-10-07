// Cierre animado de un Modal desde un botón propio del contenido (ej. la ✕
// del formulario "Nuevo movimiento" o el "Listo" de Filtros). Modal provee
// su `requestClose` por contexto: reproduce la salida y recién después
// llama al onClose del padre. Fuera de un Modal devuelve null — quien lo usa
// cae a su onClose directo.
import { createContext, useContext } from "react";

export const ModalCloseContext = createContext(/** @type {null | (() => void)} */ (null));

export function useModalClose() {
  return useContext(ModalCloseContext);
}
