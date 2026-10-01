## 1. Tizen hosted shell

- [x] 1.1 Create `tizen-tv-hosted/` with `config.xml`, `index.html` (redirect/load `https://watchily.wayool.com/tv`), icons, and required privileges/access origins; verify files match Tizen web-app layout
- [x] 1.2 Add `tizen:package` and `tizen:install` npm scripts (and document Tizen CLI / Certificate Manager prerequisites); verify `npm run tizen:package` produces a `.wgt`
- [x] 1.3 Sideload the WGT on a developer-mode Samsung TV (or emulator if TV unavailable) and verify launch reaches the React TV shell

## 2. LG shell polish

- [x] 2.1 Align `lg-tv-hosted` README with current IPK version, `ares` commands, and prod `/tv` URL; verify `npm run tv:package` still builds
- [x] 2.2 Confirm `appinfo.json` launcher privileges cover Watch now; verify packaged IPK still installs via `npm run tv:install` when a webOS device is connected

## 3. Native launch (webOS + Tizen)

- [x] 3.1 Introduce a shared Watch now launch adapter (webOS | tizen | browser) reusing existing webOS helpers; verify unit tests cover env detection and brand→app-id maps for both platforms
- [x] 3.2 Implement Tizen ApplicationControl / `launchAppControl` path with provider app-id map and content URI/URL when available; verify module calls Tizen APIs when present and does not throw when absent
- [x] 3.3 Wire `StreamingLink` (and title Watch now) through the adapter; verify desktop `?device=tv` still opens URLs without OEM APIs
- [x] 3.4 On-device spike: record which providers accept title deep-link params on LG and Samsung; update `docs/tv-streaming-urls.md` with results and fallbacks

## 4. Documentation and store path

- [x] 4.1 Write `docs/tv-packaging.md` (or equivalent): LG vs Samsung remote keys, CSP/access origins, Dev Mode, certificates, local install, store submit/update checklists; verify a new engineer can follow LG and Tizen sections end-to-end on paper
- [x] 4.2 Document version bump rules (`appinfo.json` / `config.xml`) for store updates vs content-only Vercel deploys; verify README cross-links from both shell folders

## 5. Verification

- [x] 5.1 Desktop: Playwright or manual checklist for `?device=tv` (library, search, title, settings, streaming click without crash); verify spatial root still present
- [x] 5.2 Hardware notes: run Watch now on LG and Samsung for at least Netflix + one other mapped provider; verify native app launch attempt and documented fallback when deep-link/app missing
- [x] 5.3 `npm run build` succeeds after launch/docs changes
