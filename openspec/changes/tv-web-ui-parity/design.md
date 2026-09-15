## Context

See `proposal.md` for motivation.

Today:

```
lg-tv-hosted (IPK redirect)
        │
        ▼
   /tv on Vercel
        │
 middleware: TV UA? ──yes──▶  *-standalone (HTML strings)
        │ no
        ▼
   React app (library, search, shadcn, …)
```

React scaffolding already exists (`src/app/tv/page.tsx`, `tv-page-client.tsx`, TV layout) but is bypassed on real TVs. Shared data layer (`unified` streaming, Supabase, providers) is already reused by standalone. Web IA centers on `/library` + `/search` (`openspec/specs/library-ia`); TV still uses Popular home + Listas + Ver todo.

Constraints that shape the design:

- webOS webview may behave like older Chromium; heavy client bundles and modern syntax in *inline* scripts have bitten us before.
- Remote requires visible focus, initial focus, Enter→activate, Back behavior.
- Hosted IPK should stay a thin shell; UI ships from Vercel.

## Goals / Non-Goals

**Goals:**

- One primary TV UI stack: React + Tailwind tokens, visually aligned with web.
- TV IA matches web: Library hub, Search, title detail, settings, auth/pairing.
- Reliable remote navigation on LG webOS for the screens in scope.
- Preserve webOS app-launch for streaming brands on title detail.
- Gradual cutover with rollback to standalone if needed.

**Non-Goals:**

- Pixel-perfect desktop header/footer on TV (TV gets its own chrome sized for 10-foot UI).
- Full Framer Motion parity on TV.
- Drag-and-drop library reorder on first TV cut (mouse/dnd is secondary on remote).
- Native Android TV / Cast receiver in this change.
- Editing every settings field if some controls are impractical on remote (minimum: view + clear path; prefer editable providers/country when feasible).
- Rewriting `lg-tv-hosted` beyond version/URL bumps.

## Decisions

### 1. React TV as served surface (not restyle standalone)

**Choice:** Change middleware so TV UA loads React routes under a TV layout instead of rewriting to `*-standalone` for core paths.

**Why:** Visual and feature parity with web requires component reuse (`LibraryContent`, `SearchContent`, title actions, design tokens). Restyling HTML strings would permanently fork UX.

**Alternatives:** (a) Keep standalone and copy CSS — rejected (no lasting parity). (b) iframe web into IPK — rejected (already hosted; iframe worsens focus).

### 2. Phased cutover with feature flag / query escape hatch

**Choice:** Introduce an explicit opt-in during development (`?device=tv` already forces TV mode; add `?tv_ui=react|standalone` or env `TV_UI_MODE`) so we can test React on device before flipping default for webOS UA.

**Why:** Safer on real hardware; rollback without redeploying IPK.

### 3. TV layout wraps shared pages (adapter pattern)

**Choice:** Prefer routing TV users to existing paths (`/library`, `/search`, `/title/[id]`, `/settings`, `/login`) wrapped by `src/app/tv/layout.tsx` (or a parallel `(tv)` route group that reuses page bodies), rather than duplicating all pages under `/tv/*`.

Practical compromise if layout composition is hard in App Router: `/tv` redirects authenticated users to `/library?device=tv` (or internal rewrite) and a root TV chrome provider activates when `isTV`.

**Why:** One IA, one set of data loaders; TV only adds chrome + navigation + interaction adaptations.

**Alternatives:** Full fork under `/tv/**` copying every page — rejected (duplicates library-ia work).

### 4. Spatial navigation (lightweight, no norigin)

**Choice:** Custom arrow-key focus in `src/lib/tv-spatial-nav.ts` + `TvSpatialRoot` (native DOM focus).

**Why:** `@noriginmedia/norigin-spatial-navigation` threw runtime `measureLayout` errors under Next 16 / React 19 (init after first `useFocusable`). Native focus + geometry picking is enough for Library/Search nav.

**Alternatives:** Norigin — rejected after production runtime crash.

### 5. Compatibility spike before full migration

**Choice:** First implementation task is a spike on real LG hardware: load React Library (or a thin TV React page using `TitleTile` + Tailwind) with spatial nav, measure load time / JS errors / focus.

**Gate:** If Chrome-too-old blocks Next client hydration or critical APIs, fall back to a **constrained React build** (fewer client islands, progressive enhancement) or keep standalone for that OS version — decide before deleting standalone.

### 6. webOS integrations stay on title detail

**Choice:** Extract launch helpers from `title-standalone` into a shared module used by the React title page when `webOS` is present; keep pairing login flow.

### 7. Deprecate standalone after parity checklist

**Choice:** After Library, Search, Title (+ launch), Settings (at least read + edit providers if spike allows), Login/pair work on device: redirect standalone URLs to React equivalents; keep files until one stable release, then remove.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Old webOS Chromium fails on modern JS bundle | Spike early; browserslist / differential serving; reduce client JS; optional keep standalone for failing UA |
| Library UX too dense for remote (filters, menus) | TV-simplified controls first (chips + find + open title); defer dnd/overflow polish |
| Double maintenance during migration | Time-box dual mode; feature flag; delete standalone promptly after gate |
| LG store QA fails remote/Back rules | Follow existing TV remote skill checklist; test Back on entry → Home |
| Performance (TTI) worse than standalone | Skeleton UI, limit initial grid size, lazy below-fold; compare metrics on device |
| i18n: standalone is ES-hardcoded; web is en/es | TV React uses next-intl like web |

## Migration Plan

1. **Spike** on device with flag → React UI.
2. **TV chrome + spatial nav** provider.
3. **Route cutover** per screen: Library → Search → Title+webOS → Settings → Login.
4. Flip default middleware for webOS UA to React; keep `tv_ui=standalone` escape.
5. Redirect `*-standalone` → React routes.
6. Remove standalone + `tv-shared` HTML after soak period.
7. IPK only if version/icons change; otherwise Vercel-only updates.

**Rollback:** Set flag/env to standalone rewrite; no IPK reinstall required if shell URL unchanged.

## Open Questions

- Exact App Router composition (`(tv)` group vs `?device=tv` provider) — **resolved:** root layout + cookies (`watchily_tv_client` / `watchily_tv_ui`) + `TvChrome` when React mode.
- Whether Google OAuth works acceptably inside webOS browser for login — defer; pairing remains available from TV login.
- Minimum webOS version we officially support for React TV — validate on device (task 7.1).

## Spike notes (2026-09-14)

- **Go** for React cutover as default (`TV_UI_MODE` / `?tv_ui=standalone` escape hatch retained).
- Desktop verification path: `/library?device=tv` (middleware sets TV cookies; shell + spatial nav + shared Library/Search/Title/Settings).
- On-device hydration checklist deferred to task 7.1 after deploy; legacy standalone kept for soak (task 6.3 not deleting yet).
