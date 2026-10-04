// Clases de Tailwind reutilizadas entre componentes. Viven fuera de
// Shared.jsx porque un archivo que exporta componentes Y constantes rompe el
// fast refresh de Vite (react-refresh/only-export-components).

// botones compactos de formulario, mismo look en toda la app
export const BTN_PRIMARY =
  "px-3.5 py-[7px] rounded-[7px] border-0 text-small font-semibold bg-accent text-bg disabled:opacity-60 disabled:cursor-default enabled:cursor-pointer";
export const BTN_GHOST =
  "px-3.5 py-[7px] rounded-[7px] border border-border bg-transparent text-muted text-small cursor-pointer";

export function pillClass(active) {
  return `px-[13px] py-1.5 rounded-full text-body font-medium cursor-pointer capitalize border ${
    active ? "border-accent bg-tint-accent text-accent" : "border-border bg-transparent text-muted"
  }`;
}
