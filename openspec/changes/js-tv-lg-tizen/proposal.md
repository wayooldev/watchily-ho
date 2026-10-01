## Why

Watchily already serves a real React TV shell at `https://watchily.wayool.com/tv` (Clerk + Neon, spatial nav, library/search/title/settings). LG has a thin hosted IPK; Samsung Tizen has no package. Living-room users on LG and Samsung need installable store apps that reuse that same web TV product, open native streaming apps on Watch now, and support local sideload plus store publish/update — without Kotlin, Expo, or Android apps.

## What Changes

- Keep and polish **`lg-tv-hosted`** as the LG webOS hosted shell (IPK): prod URL `/tv`, permissions for native app launch, local `ares` package/install, Content Store checklist.
- Add **`tizen-tv-hosted/`** (or `apps/tizen-tv`): Tizen web app package (`.wgt`) with `config.xml`, icons, privileges, same hosted URL, local install + Seller Office checklist.
- Unify **Watch now** launch behind a small platform adapter: webOS Luna (existing) + **Tizen ApplicationControl** (new) + browser fallback — product behavior is “open the provider’s native app and deep-link to the title when the platform allows.”
- Document **LG vs Samsung** differences (remote keys, CSP/access origins, Dev Mode, certificates, store update flows) in one TV packaging README.
- npm scripts for package/install on both platforms; desktop verification via `?device=tv` plus hardware notes.
- **Out of scope**: Android mobile, Android TV (Kotlin), Expo/React Native, rewriting the TV UI outside Next.js.

## Capabilities

### New Capabilities

- `js-tv-packaging`: Hosted shell packages for LG webOS (IPK) and Samsung Tizen (WGT), local install, store publish/update docs and scripts.
- `tv-native-launch`: Cross-platform Watch now: open installed streaming apps (Netflix, Disney+, etc.) with title deep-link when supported; documented fallbacks when the OEM/provider does not accept content params.

### Modified Capabilities

- _(none — existing `tv-react-shell` / web TV UX stays; this change packages and extends launch, not IA)_

## Impact

- **Repo**: `lg-tv-hosted/*`, new `tizen-tv-hosted/` (or `apps/tizen-tv`), `package.json` scripts, docs under `docs/` (packaging + LG vs Tizen).
- **Web**: `src/lib/webos-launch.ts` → generalize or add `tizen-launch` + update `StreamingLink` / title Watch now; optional `tizen.js` / privilege assumptions for hosted WebView.
- **Auth/data**: no change — already Clerk + Neon via hosted `watchily.wayool.com`.
- **Deps**: Tizen CLI / Certificate Manager for packaging (dev docs); no new runtime framework.
- **Stores**: LG Content Store + Samsung Seller Office submission paths; version bumps in `appinfo.json` / `config.xml` for updates.
- **Depends on**: existing React TV shell (`tv-web-ui-parity` largely applied). Explicitly **not** blocked on Android apps.
