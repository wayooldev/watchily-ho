# TV packaging — LG webOS & Samsung Tizen

Watchily’s living-room clients for LG and Samsung are **hosted web apps**: a thin local package opens `https://watchily.wayool.com/tv` (Next.js React TV shell, Clerk + Neon). UI updates ship on Vercel; store packages are updated only when the shell, privileges, or version must change.

| | LG webOS | Samsung Tizen |
|--|----------|---------------|
| Folder | `lg-tv-hosted/` | `tizen-tv-hosted/` |
| Package | `.ipk` | `.wgt` |
| Manifest | `appinfo.json` | `config.xml` |
| Scripts | `npm run tv:package` / `tv:install` | `npm run tizen:package` / `tizen:install` |
| Store | LG Content Store | Samsung Seller Office |

Shared packaging rules (version bumps vs Vercel-only deploys) are in [§ Version bumps](#version-bumps).

---

## Architecture

```
┌─────────────────────┐     redirect / load      ┌──────────────────────────┐
│  IPK or WGT shell   │ ───────────────────────▶ │ watchily.wayool.com/tv   │
│  icons + privileges │                          │ React TV + spatial nav   │
└─────────────────────┘                          └────────────┬─────────────┘
                                                              │ Watch now
                                              ┌───────────────┼───────────────┐
                                              ▼               ▼               ▼
                                          webOS Luna     Tizen AppCtrl    browser URL
```

---

## LG webOS

### Dev Mode

1. Install **Developer Mode** from LG Content Store.
2. Enable Dev Mode; note the key / pair with your PC.
3. `ares-setup-device` → add TV IP.
4. `ares-device-info` or `ares-inspect` to confirm connectivity.

### Package & install

```bash
npm run tv:package
npm run tv:install
# or: ares-install com.watchily.web_1.0.1_all.ipk -d <name>
```

### Remote keys (typical)

| Key | Behavior in Watchily |
|-----|----------------------|
| Arrow keys | Spatial focus (`TvSpatialRoot`) |
| OK / Enter | Activate focused control |
| Back | Browser history / TV chrome (avoid trapping users) |

### CSP / network

Remote content is on `watchily.wayool.com`. Launcher privileges in `appinfo.json` enable Luna `applicationManager.launch` for Watch now.

### LG Content Store (checklist)

- [ ] Seller / developer account on LG Seller Lounge
- [ ] App id `com.watchily.web` stable across versions
- [ ] Bump `version` in `appinfo.json` for each store upload
- [ ] Icons, screenshots, age rating, privacy policy URL
- [ ] Test on target webOS years (hosted Chromium differs by year)
- [ ] Submit IPK; after approval, updates = new versioned IPK

---

## Samsung Tizen

### Dev Mode & certificates

1. On the TV: Apps → enter `12345` → Developer mode **On** → set Host PC IP → restart.
2. Install [Tizen Studio](https://developer.tizen.org/development/tizen-studio/download) + **Samsung Certificate Extension**.
3. Certificate Manager: Author + **Samsung TV Distributor** certificate (device DUID registered).
4. `sdb connect <tv-ip>:26101` (confirm port on-screen).

### Package & install

```bash
npm run tizen:package   # → Watchily.wgt (uses tizen CLI if present, else zip)
npm run tizen:install   # tizen install / sdb install
```

Replace placeholder package id `G1A2B3C4D5` in `config.xml` with your Seller Office application id before store submission.

`access` / `allow-navigation` / CSP in `config.xml` allow `watchily.wayool.com`, Clerk, and CDNs. If a host is blocked on device, add it explicitly and rebuild the WGT.

### Remote keys (typical)

| Key | Notes |
|-----|--------|
| Arrow / Enter | Same spatial nav as LG |
| Back (`tizenhwkey`) | May need an explicit `tizenhwkey` listener later if history Back is insufficient |
| Exit | OEM may kill the WebView |

### Samsung Seller Office (checklist)

- [ ] Samsung Seller Office account + TV app listing
- [ ] Real `tizen:application` id / package from partner portal
- [ ] Signed WGT with distributor cert matching the listing
- [ ] Bump `version` in `config.xml` for each upload
- [ ] Privileges: `internet`, `application.launch` (Watch now)
- [ ] Screenshots, descriptions, privacy policy
- [ ] Device group testing; then submit

---

## Version bumps

| Change type | Action |
|-------------|--------|
| UI / API / copy on the web TV shell | Deploy Vercel only (no store upload) |
| New privilege, icon, redirect URL, CSP/access | Bump package version + sideload + store update |
| First store release or mandatory recert | New signed IPK/WGT with incremented version |

- LG: `lg-tv-hosted/appinfo.json` → `version`
- Tizen: `tizen-tv-hosted/config.xml` → `widget@version`

Keep application **ids** stable so updates replace the same store listing.

---

## Desktop QA

```text
https://watchily.wayool.com/login?device=tv
https://watchily.wayool.com/library?device=tv
```

Or local: `npm run dev` → `/login?device=tv`. Confirm `[data-tv-spatial-root]`, remote-like Tab/arrows, and streaming links do not crash without OEM APIs.

Playwright: `e2e/tv-react.spec.ts`.

---

## Related docs

- [tv-streaming-urls.md](./tv-streaming-urls.md) — Watch now / native launch
- [auth-and-clients.md](./auth-and-clients.md) — Clerk surfaces
- Shell READMEs: `lg-tv-hosted/README.md`, `tizen-tv-hosted/README.md`
