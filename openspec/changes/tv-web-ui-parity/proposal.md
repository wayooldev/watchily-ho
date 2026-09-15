## Why

The hosted LG TV app already loads Watchily from Vercel, but TV User-Agents are rewritten to HTML `*-standalone` routes that diverge from the React web UI (library hub, search filters, Tailwind/shadcn look). Users experience two products; React `/tv` exists as an incomplete prototype and is not what the TV actually serves. We need one TV surface that looks and navigates like the web app while remaining usable with the remote on webOS.

## What Changes

- Serve a **React TV shell** (Next.js + Tailwind design tokens) as the primary TV experience instead of hand-rolled HTML standalone pages for the main browsing flows.
- Align TV information architecture with web: **Library as hub**, Search as browse/search, Title detail, Settings, Login/pairing — not a separate “Popular home + Ver todo” IA.
- Add **spatial / remote navigation** suitable for webOS (focus rings, arrow keys, Back, OK) around shared or TV-adapted components.
- Keep **webOS-specific behaviors** where needed (e.g. launching Netflix/Disney via `webOSTV.js` on title detail).
- Soften or disable **Framer Motion** on TV; prefer CSS focus/hover states and light transitions.
- Phase out reliance on `*-standalone` HTML for core screens once React TV covers them (**BREAKING** for anyone bookmarking standalone URLs; redirects preserve continuity).
- Leave `lg-tv-hosted` as a thin redirect IPK (no UI rewrite in the package itself).

## Capabilities

### New Capabilities

- `tv-react-shell`: React-based TV UI served to TV clients (middleware, layout, remote navigation, parity screens with web).
- `tv-webos-integrations`: Preserved webOS deep-link / native app launch and hosted-shell contract.

### Modified Capabilities

- _(none — no existing specs under `openspec/specs/` cover TV standalone behavior today)_

## Impact

- **Middleware** (`src/middleware.ts`): stop rewriting core paths to `*-standalone` (or rewrite only as fallback); route TV UA to React `/tv` (and library/search/title/settings under a TV layout).
- **UI**: extend or replace `src/app/tv/*`, `tv-page-client`, reuse `LibraryContent` / `SearchContent` / title / settings with TV adaptations; shared tokens from Tailwind/shadcn.
- **Dependencies**: likely add spatial-navigation library (e.g. `@noriginmedia/norigin-spatial-navigation`) if chosen in design.
- **Standalone routes**: remain temporarily for rollback / deep links, then deprecate.
- **Auth**: keep TV pairing + email login; Google OAuth optional/follow-up if webview allows.
- **Deploy**: hosted IPK unchanged unless `lg-tv-hosted` URL/version bumps; content updates via Vercel as today.
- **Risk**: older webOS Chrome performance and API gaps — needs a compatibility spike before full cutover.
