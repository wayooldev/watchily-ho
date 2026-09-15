## ¿Qué es Watchily?

Watchily es una aplicación web tipo JustWatch que te ayuda a descubrir en qué plataformas de streaming están disponibles películas y series en tu región.

**En vivo:** https://watchily.wayool.com/

## ¿Para quién es?

Para personas que quieren saber rápidamente dónde ver un título (Netflix, Disney+, Prime Video, etc.) sin buscar manualmente en cada servicio, y que quieren personalizar resultados según sus suscripciones.

## FAQ

### ¿Cómo sé dónde ver una película o serie?

Busca el título en Watchily o abre su ficha de detalle. Watchily muestra en qué plataformas está disponible para ver con suscripción, alquiler o compra en tu región.

### ¿Necesito pagar para usar Watchily?

No. Watchily es gratuito. Solo necesitas crear una cuenta si quieres guardar listas y filtrar por tus plataformas suscritas.

### ¿De dónde obtiene Watchily la información de streaming?

Watchily combina datos de Watchmode y Streaming Availability para mostrar disponibilidad actualizada por país y plataforma.

# Watchily

App tipo JustWatch: descubre dónde ver películas y series en streaming.

- **Web**: Next.js 14+ (App Router), TypeScript, Tailwind, Shadcn UI
- **Backend**: Supabase (Auth + Postgres)
- **APIs**: Watchmode (primaria) + Streaming Availability (fallback)

## Setup

1. Clona y instala dependencias:

```bash
npm install
```

2. Copia las variables de entorno:

```bash
cp .env.local.example .env.local
```

3. Configura las variables en `.env.local`. La configuración mínima requerida es:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Dashboard → API Keys → publishable)
   - `WATCHMODE_API_KEY` (https://api.watchmode.com/requestApiKey)

   Todas las variables soportadas, su scope público/servidor, requiredness y
   comportamiento cuando faltan están documentados en
   [`docs/application-foundation.md`](docs/application-foundation.md). Nunca
   pongas valores secretos en Git ni en variables `NEXT_PUBLIC_`.

4. Crea un proyecto en Supabase y aplica las migraciones:

```bash
# En Supabase Dashboard: SQL Editor, o con Supabase CLI:
supabase db push
# O ejecuta manualmente los archivos en supabase/migrations/
```

5. En Supabase Dashboard > Authentication > Providers: activa Google y Email. En **URL Configuration** > Redirect URLs añade:
   - Web: `http://localhost:3000/auth/callback` y `https://tu-app.vercel.app/auth/callback`
   - Mobile (proxy): `https://tu-app.vercel.app/auth/mobile-callback` o `https://tu-app.vercel.app/auth/mobile-callback*`

6. Arranca el servidor:

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). English is the default
locale and keeps the existing unprefixed URLs. Spanish uses the `/es`
namespace, for example `/es`, `/es/search`, and `/es/library`.

Las rutas API usan la sesión del usuario (cookies) con la clave Publishable; la clave Secret solo se usa en servidor con `createAdminClient()` cuando hace falta bypass RLS (p. ej. jobs internos). No exponer la Secret key al cliente.

## Deploy en Vercel

1. En [Vercel](https://vercel.com/new) importa el repo `mauricioabh/watchily-ho`. Configura las variables requeridas y las integraciones opcionales descritas en [`docs/application-foundation.md`](docs/application-foundation.md). Las variables `NEXT_PUBLIC_*` son públicas; las API keys, claves VAPID privadas y `SUPABASE_SECRET_KEY` son solo de servidor.
2. Añade en **Supabase** > Authentication > URL Configuration la URL de producción (ej. `https://tu-app.vercel.app/auth/callback`).
3. Tras el primer deploy, reemplaza en `lg-tv-hosted/index.html` la URL `YOUR_APP.vercel.app` por tu URL de Vercel, y en `apps/mobile/.env` define `EXPO_PUBLIC_API_URL` con esa misma URL.

## Estructura

- `src/app` – Rutas y páginas (App Router)
- `src/components` – Componentes reutilizables
- `src/lib` – Supabase, streaming API unificada
- `src/types` – Tipos TypeScript
- `supabase/migrations` – SQL (profiles, user_providers, lists, list_items, likes, RLS)
- `docs/schema.md` – Documentación del schema de la base de datos
- `docs/application-foundation.md` – Variables, providers, analytics, cache y localization

## Foundation boundaries

- **Providers:** `AppProviders` is the single client boundary for the theme,
  TanStack Query, nuqs URL state, PostHog, and Sonner. Server-only credentials
  remain in server modules.
- **Analytics:** PostHog is opt-in and browser-only. Each allowlisted event
  includes `app_tag: "app:wat"` and a `web`/`tv` surface; raw query text,
  emails, passwords, list names, provider URLs, and API payloads are excluded.
  The supported event contract is documented in
  [`docs/application-foundation.md`](docs/application-foundation.md).
- **URL state/cache:** Search (`q`, `type`, `providers`) and library
  (`query`, `type`, `status`, `sort`) filters are typed URL state. TanStack
  Query keys include response inputs and user scope, reuse server-rendered
  initial data, and invalidate affected data after mutations.
- **Interaction batching:** `GET /api/watch-status?ids=a,b` and
  `GET /api/lists/items?title_ids=a,b` accept up to 100 unique title IDs and
  omit titles without state. The singular `title_id` membership URL remains
  compatible. Library uses server-rendered state plus a user-scoped Upstash
  cache-aside snapshot with a 15-minute TTL; successful list/status mutations
  invalidate the relevant cache, while Redis failures fall back to Supabase.
- **Localization:** `en` is the deterministic default for existing URLs;
  Spanish pages live under `/es`. API, auth callback, OpenAPI, asset, and
  standalone TV contracts remain unlocalized.

## LG TV

- **Hosted Web App**: Carpeta `lg-tv-hosted` con `appinfo.json` e `index.html` que redirige a `https://TU_APP.vercel.app/tv` (middleware envía a Library en modo React).
- **Modo TV React (default)**: shell `TvChrome` + Library/Search/Title/Settings compartidos con la web. Detección por User-Agent o `?device=tv`. Escape a HTML legacy: `?tv_ui=standalone` o `TV_UI_MODE=standalone`.
- **Navegación**: foco espacial propio (`src/lib/tv-spatial-nav.ts`) + mando; sin `@noriginmedia/norigin-spatial-navigation` (evita crashes `measureLayout`). Framer Motion se atenúa en TV.
- **Rollback**: rutas `*-standalone` siguen en el repo durante soak; URLs legacy redirigen a React salvo modo standalone.

## Production practices

- **Pre-commit:** Husky runs lint-staged (`eslint --fix`, `prettier --write`) on staged `*.ts` / `*.tsx`.
- **API contracts:** Zod schemas for priority `/api/*` routes → OpenAPI via `@asteasolutions/zod-to-openapi` → Scalar UI at `/api-docs` (spec JSON at `/api/openapi`).
- **Observability:** `@sentry/nextjs` on web/TV (`platform=web|webos` tags); `@sentry/react-native` on Expo (`platform=mobile`). `SENTRY_DSN`, `SENTRY_ORG`, and `SENTRY_PROJECT` are optional. Auth tokens and emails are scrubbed from breadcrumbs. **Core Web Vitals (RUM):** Sentry Performance → Web Vitals (`browserTracingIntegration`, 10% sample in prod). **Lab:** Lighthouse CI on PRs (`.github/workflows/lighthouse.yml`). Dev probe: `GET /api/debug/sentry`; verify with `npm run test:observability`.
- **Analytics:** Configure `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` together to enable the privacy-safe PostHog contract. Missing either variable disables analytics without affecting the app.
- **Async jobs:** Inngest refreshes watchlist title availability into `title_availability_cache` on add-to-list and daily cron when `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` are both configured. Supabase Queues alternative: [`docs/supabase-queues-alternative.md`](docs/supabase-queues-alternative.md).
- **Rate limiting:** Upstash sliding window (20 req/min/user) on `GET /api/titles/search` when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are both configured. Verify with `npm run test:rate-limit`.
- **CI:** Supabase RLS isolation tests (`.github/workflows/rls.yml`); CodeQL; Playwright landing smoke on PRs (`npm run test:e2e`, workflow `e2e.yml`).
- **RLS tests:** Row-level security policies in `supabase/migrations/` are verified with Vitest against local Supabase (`supabase start` then `npm run test:rls`). Covers profiles, lists, likes, and `pairing_codes` isolation. CI runs `.github/workflows/rls.yml` on PRs.
- **Security scanning:** CodeQL (`.github/workflows/codeql.yml`); Dependabot for npm and GitHub Actions.
