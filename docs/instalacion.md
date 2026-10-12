# Instalación y puesta en marcha

> Parte de la documentación de Gastify — volver al [README](../README.md).

## Requisitos

- Node.js 20.19 o superior (22 recomendado).
- Una cuenta gratuita de [Supabase](https://supabase.com).

## 1. Clonar e instalar

```bash
git clone https://github.com/AlexPerez7/gastify.git
cd gastify
npm install
```

## 2. Crear el proyecto en Supabase

Crea un proyecto nuevo en [supabase.com](https://supabase.com), abre el
**SQL Editor** y ejecuta el contenido de
[`supabase/schema.sql`](../supabase/schema.sql) para armar las tablas con Row
Level Security (cada fila queda atada al usuario que la creó, y solo ese
usuario puede leerla o modificarla).

Si tu proyecto ya existía, **no** corras `schema.sql` de nuevo (recrearía
tablas que ya tienes): corre solo las migraciones de
[`supabase/migrations/`](../supabase/migrations) que te falten, en orden.
Las `0001`–`0003` crean tablas y fallan si ya las tienes (en ese caso,
sáltalas); de la `0004` en adelante se pueden repetir sin problema:

| Migración | Qué agrega |
| --- | --- |
| `0001` | Suscripciones |
| `0002` | Movimientos de la tarjeta de crédito |
| `0003` | Estados de cuenta de la tarjeta |
| `0004` | Ahorro base (`savings_base`) |
| `0005` | `created_at` en movimientos (lo necesita "Deshacer") |
| `0006` | *Opcional:* recolorea las categorías por defecto a la paleta nueva |
| `0007` | `base_balance`/`last_sync_date` nullables (ahorro base sin saldo ajustado) |
| `0008` | Reglas con tipo de coincidencia y rango de monto; suscripciones anuales y con término |

Después, en **Authentication → URL Configuration**, agrega la URL donde vas
a correr o desplegar la app (ej. `http://localhost:5173` para desarrollo y
la URL de producción) tanto en *Site URL* como en *Redirect URLs* — la
recuperación de contraseña depende de que esto esté bien configurado.

Por defecto Supabase pide confirmación por email antes de dejar iniciar
sesión; si quieres saltarte ese paso en desarrollo, desactívalo en
**Authentication → Providers → Email**.

## 3. Variables de entorno

Copia `.env.example` a `.env` y completa con los valores de tu proyecto
(**Project Settings → API** en Supabase):

```bash
cp .env.example .env
```

```
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

## 4. Correr en desarrollo

```bash
npm run dev
```

Abre la URL que muestre la terminal (por defecto
`http://localhost:5173/gastify/`). Al crear tu cuenta y confirmar el email,
la app siembra las categorías por defecto automáticamente.
