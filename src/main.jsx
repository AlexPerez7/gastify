import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { AuthGate } from "./components/AuthGate.jsx";
import { ErrorBoundary } from "./components/ErrorBoundary.jsx";
import "./index.css";

if ("serviceWorker" in navigator) {
  // registerType: "autoUpdate" ya hace que el SW nuevo tome control solo al
  // detectarlo (y recarga la página); el chequeo periódico es para que lo
  // detecte incluso si la pestaña queda abierta mucho tiempo sin recargar (no
  // navega, no hay chequeo). El de visibilitychange cubre la PWA instalada en
  // el teléfono: al volver a ella desde segundo plano no hay navegación y el
  // sistema pausa los timers, así que sin esto seguía en la versión vieja.
  registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => { if (navigator.onLine) registration.update().catch(() => {}); };
      setInterval(check, 60 * 60 * 1000);
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
    },
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthGate />
    </ErrorBoundary>
  </React.StrictMode>
);
