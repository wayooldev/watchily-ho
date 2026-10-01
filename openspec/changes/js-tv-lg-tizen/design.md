## Context

See `proposal.md` for motivation.

Today:

- React TV shell is live on Vercel (`/tv` → library/login with `?device=tv`), Clerk + Neon, spatial nav.
- `lg-tv-hosted` is a thin redirect IPK to `https://watchily.wayool.com/tv` with launcher permissions.
- Watch now on TV calls `launchStreamingOnWebOS` from `StreamingLink` (Luna `applicationManager.launch`). No Tizen package or Tizen launch path exists.
- Android phone/TV apps are separate products and are **not** prerequisites.

Market pattern for store TV aggregators: hosted or hybrid web app in the OEM store + platform APIs to open Netflix/Disney/etc., passing a content target when the OEM/provider allows it.

## Goals / Non-Goals

**Goals:**

- One product path: shared Next.js TV UI + hosted shells for LG and Samsung.
- Native provider launch on both packaged platforms (product requirement, not optional polish).
- Local sideload loops + documented store submit/update.
- Honest deep-link behavior: title when possible; app open + fallback when OEM/provider limits apply.

**Non-Goals:**

- Kotlin / Android / Expo clients in this change.
- Rewriting TV UI outside Next.js.
- Guaranteeing every provider deep-links to the exact title on every firmware (many do not document params).
- Changing Clerk/Neon auth architecture (cookies on hosted origin remain the web TV session).

## Decisions

### 1. Single product path (no phased “packaging without launch”)

**Choice:** Ship packaging and native launch together as one change. Tizen is not “done” until Watch now attempts `tizen.application` / ApplicationControl the same way LG attempts Luna.

**Why:** User expectation for a real TV app is open Netflix (and peers) for the title. Packaging-only would feel broken vs market.

**Alternatives rejected:** Packaging-first without launch; waiting on Android TV.

### 2. Hosted shells (LG pattern extended to Tizen)

**Choice:** Keep thin local `index.html` (+ icons/manifest) that redirects/loads `https://watchily.wayool.com/tv`. UI updates ship via Vercel; store updates only when shell/permissions/version must change.

**Why:** Matches current LG success; maximizes Next.js reuse; update content without resubmitting the store for every UI fix.

**Alternatives:** Full offline bundle of Next export — rejected (auth, API, availability need network anyway).

### 3. Launch adapter module

**Choice:** Generalize Watch now into a small adapter:

```
detectEnv: webos | tizen | browser
  → webOS: existing Luna launch + contentTarget
  → tizen: ApplicationControl / launchAppControl with provider app id + URI
  → browser: window.open / default <a>
```

Wire from `StreamingLink` (and any title Watch now control). Map provider brands → platform app ids (extend `WEBOS_APP_IDS_BY_BRAND` with a Tizen map).

**Why:** Keeps platform quirks out of UI; one click path.

### 4. Deep-link honesty

**Choice:** Pass the best available target (full URL / content id) on both platforms. Document per-provider limits (e.g. some apps ignore params and only open home). Never use `window.location` navigation that blacks out the Watchily WebView (existing webOS lesson).

**Why:** Market standard attempt + safe UX when OEM/provider is limited.

### 5. Layout on disk

**Choice:** `tizen-tv-hosted/` at repo root next to `lg-tv-hosted/` (same thin-shell convention). Scripts: `tv:package` / `tv:install` (LG) + `tizen:package` / `tizen:install`.

**Why:** Symmetry; no Android `apps/` confusion.

### 6. Auth

**Choice:** No new auth stack. Hosted origin uses existing Clerk session cookies; pairing `/tv/pair` remains available for TV-friendly login.

## Risks / Trade-offs

- [Tizen CSP / `access` origins block Vercel] → Declare `https://watchily.wayool.com` (and Clerk/CDN hosts as needed) in `config.xml`; verify on device early.
- [Provider ignores deep-link params] → Still launch app; document fallback; prefer URL params that are known to work per brand.
- [Firmware fragmentation] → Sideload checklist on at least one recent LG and one recent Samsung; note OS year gaps.
- [Store review friction] → Sideload-first QA; store checklist separate from daily TV update flow for content-only deploys.
- [Privileges missing → silent browser fallback] → Manifest privileges required in both packages; fail open to URL.

## Migration Plan

1. Implement Tizen shell + scripts; verify sideload loads `/tv`.
2. Add Tizen launch path; verify Watch now on device.
3. Align LG docs/version with store checklist; no forced IPK resubmit if only web changed.
4. Docs: LG vs Tizen + store update.
5. Rollback: revert launch adapter to webOS-only; packages remain redirect shells.

## Open Questions

- Exact Samsung app IDs / ApplicationControl `appControl` URI shapes per provider (Netflix, Disney+, Max, Prime) — spike on device during implement; capture in `docs/tv-streaming-urls.md`.
- Whether Seller Office requires a specific `config.xml` `content` hosted vs local index for category approval — confirm at first submission; default to local index + redirect like LG.
