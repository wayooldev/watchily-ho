## 1. Compatibility spike (gate)

- [x] 1.1 Add a temporary TV UI mode switch (query/env) that can force React vs standalone for TV UA, and verify toggling works in browser with `?device=tv`
- [x] 1.2 Serve a minimal React TV page (Tailwind + `TitleTile` grid) on device with the hosted IPK / Dev Mode, and record whether hydration succeeds without console-blocking errors
- [x] 1.3 Decide go/no-go for full React cutover from spike notes (document outcome in design.md Open Questions or a short spike note); if no-go, stop and revise approach before further tasks

## 2. TV shell and remote navigation

- [x] 2.1 Introduce a TV mode detection helper shared by middleware and client (UA / `device=tv` / UI mode), and verify unit or smoke coverage for detection cases
- [x] 2.2 Expand `src/app/tv/layout.tsx` (or route-group equivalent) into the React TV chrome: safe areas, 10-foot spacing, primary nav Search + Library + Settings/Sign out; verify layout renders at 1920×1080 viewport
- [x] 2.3 Add spatial navigation (library + focus provider) and wire initial focus + OK/Enter activation; verify arrow keys move focus across a sample grid without a mouse
- [x] 2.4 Gate Framer Motion / heavy animation when TV mode is active; verify core screens remain usable with motion disabled

## 3. Align IA with web (Library + Search)

- [x] 3.1 Make authenticated TV entry land on Library (redirect `/tv` and `/` under TV React mode), and verify TV client reaches `/library` instead of popular-only home
- [x] 3.2 Adapt Library for remote (focusable chips/find/rows; defer dnd if needed) reusing web data/UI where possible; verify Watching/Finished/Find still filter titles on TV mode
- [x] 3.3 Serve Search under TV shell with empty=popular discovery and query=results; verify both states with remote focus
- [x] 3.4 Ensure `/lists` and `/lists/all` on TV React mode redirect to Library like web; verify redirects

## 4. Title detail + webOS integrations

- [x] 4.1 Extract webOS launch helpers from `title-standalone` into a shared module usable from React title UI; verify module exports and unit tests for brand→app id mapping
- [x] 4.2 Render Title detail in TV React mode with streaming actions calling launch-with-browser-fallback; verify on webOS that mapped apps attempt launch and fallback still works in browser
- [x] 4.3 Keep pairing login path working from TV React login; verify unauthenticated TV user can complete `/tv/pair` flow

## 5. Settings and auth polish

- [x] 5.1 Settings in TV React mode: at least read country/providers; enable edit if remote UX is acceptable; verify values match web settings for the same user
- [x] 5.2 Use next-intl / existing locale messages for TV React chrome (no Spanish-only hardcoding); verify `en` and `es` labels on TV shell

## 6. Middleware cutover and standalone deprecation

- [x] 6.1 Change default middleware path so webOS UA uses React TV mode (standalone only via escape hatch); verify real TV UA no longer receives `*-standalone` HTML for `/`, `/search`, `/library`, `/title/:id`, `/settings`, `/login`
- [x] 6.2 Redirect legacy `*-standalone` URLs to React equivalents; verify `/tv-standalone` and `/title-standalone/:id` land on React routes
- [ ] 6.3 After soak, remove unused standalone routes and `tv-shared` HTML helpers; verify `npm run build` succeeds and no remaining imports

## 7. Verification on device / release

- [ ] 7.1 Run remote checklist (initial focus, arrows, OK, Back on entry) on LG webOS against Library, Search, Title, Settings; verify checklist passes
- [ ] 7.2 Complete TV update flow when shipping (`npm run build`, deploy Ready, `tv:package` / `tv:install` if shell changed); verify hosted app opens React TV UI on device
