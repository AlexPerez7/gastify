import { registerSW } from "virtual:pwa-register";
import { createPwaUpdates } from "./pwaUpdates.js";

export const pwaUpdates = createPwaUpdates({
  register: registerSW,
  supported: "serviceWorker" in navigator,
  isOnline: () => navigator.onLine,
  hasController: () => !!navigator.serviceWorker?.controller,
  reload: () => window.location.reload(),
});

navigator.serviceWorker?.addEventListener("controllerchange", () => pwaUpdates.controllerChanged());
