import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "gastify:theme";

// color de la barra de estado / chrome del navegador: el fondo del header
// (--c-surface de cada tema, ver index.css), no el color de marca. Se
// actualiza desde acá porque el tema se cambia con un toggle propio, no solo
// con prefers-color-scheme (que es lo único que un <meta media=…> sigue).
const THEME_COLOR = { dark: "#131b17", light: "#ffffff" };

// localStorage puede lanzar (modo privado, almacenamiento bloqueado) — sin
// el try, eso tumbaba la app entera al arrancar.
function readSaved() {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

function getInitialTheme() {
  const saved = readSaved();
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function useTheme() {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* sin persistencia, el tema igual se aplica */ }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  return { theme, toggleTheme };
}
