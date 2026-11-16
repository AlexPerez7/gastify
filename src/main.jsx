import React from "react";
import ReactDOM from "react-dom/client";
import { pwaUpdates } from "./lib/pwaClient.js";
import { AuthGate } from "./components/AuthGate.jsx";
import { ErrorBoundary } from "./components/ErrorBoundary.jsx";
import "./index.css";

if ("serviceWorker" in navigator) {
  pwaUpdates.start();
  const check = () => { if (navigator.onLine) void pwaUpdates.check({ silent: true }); };
  setInterval(check, 60 * 60 * 1000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
  window.addEventListener("online", check);
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthGate />
    </ErrorBoundary>
  </React.StrictMode>
);
