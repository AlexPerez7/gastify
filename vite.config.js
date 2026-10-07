import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

const BASE_PATH = "/gastify/";

// Librerías que solo se usan al importar una cartola (se cargan con
// import() dinámico). Nombre de chunk fijo para poder sacarlas del precache
// de la PWA por patrón (ver workbox abajo) sin depender del nombre que
// Vite elija — antes pdfjs salía como "pdf.worker.min-….js" o
// "pdfParsing-….js" según qué archivo lo importara primero.
const IMPORT_ONLY_CHUNKS = { "node_modules/xlsx/": "xlsx", "node_modules/pdfjs-dist/": "pdfjs" };

export default defineConfig({
  base: BASE_PATH,
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const norm = id.replaceAll("\\", "/");
          for (const [path, name] of Object.entries(IMPORT_ONLY_CHUNKS)) if (norm.includes(path)) return name;
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      // registramos el SW a mano en main.jsx (chequeo periódico de updates)
      injectRegister: false,
      manifest: {
        name: "Gastify",
        short_name: "Gastify",
        description: "Gestor de gastos personal — movimientos, categorías y conciliación bancaria.",
        start_url: BASE_PATH,
        scope: BASE_PATH,
        display: "standalone",
        background_color: "#0C1210",
        theme_color: "#0C1210",
        icons: [
          { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // precachea el app shell completo para que abra offline…
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // …menos xlsx y pdfjs (~900 KB): solo sirven para importar, y
        // descargarlos en cada instalación era casi 40% del precache. Se
        // guardan la primera vez que se usan (runtimeCaching), así que
        // después de la primera importación también funcionan offline.
        globIgnores: ["**/assets/xlsx-*.js", "**/assets/pdfjs-*.js"],
        runtimeCaching: [
          {
            // el worker de pdfjs (.mjs, vía ?url) nunca estuvo en el precache:
            // sin esto, importar un PDF offline fallaba aunque pdfjs estuviera
            urlPattern: /\/assets\/(xlsx|pdfjs|pdf\.worker\.min)-[^/]+\.m?js$/,
            handler: "CacheFirst", // nombre con hash: un archivo nunca cambia
            options: { cacheName: "importadores", expiration: { maxEntries: 8 } },
          },
        ],
      },
    }),
  ],
});
