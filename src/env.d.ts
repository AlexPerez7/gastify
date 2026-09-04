// Tipos de las variables de entorno que inyecta Vite (ver .env.example).
// Sólo para `npm run typecheck` — Vite no necesita este archivo.
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
