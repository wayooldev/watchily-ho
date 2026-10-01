# Watchily - LG webOS TV (Hosted Web App)

Thin shell that opens the production TV UI:

`https://watchily.wayool.com/tv`

Full packaging, Dev Mode, store checklist, and LG vs Samsung notes: [docs/tv-packaging.md](../docs/tv-packaging.md).
Watch now / native provider launch: [docs/tv-streaming-urls.md](../docs/tv-streaming-urls.md).

## Local package / install

```bash
npm run tv:package   # writes com.watchily.web_<version>_all.ipk
npm run tv:install   # ares-install onto the default Dev Mode TV
```

With an explicit device:

```bash
ares-install com.watchily.web_1.0.1_all.ipk -d <device-name>
```

### Prerequisites

- webOS TV SDK (`ares-package`, `ares-install`)
- Icons `icon.png` (80×80) and `largeIcon.png` (130×130) in this folder
- TV in Developer Mode; `ares-setup-device` configured

## Version

Current `appinfo.json` version: **1.0.1** (id `com.watchily.web`).

- Bump `version` in `appinfo.json` for LG Content Store updates / new IPK sideloads.
- Content-only UI changes ship via Vercel — no IPK rebuild required.

## Permissions

`appinfo.json` includes launcher privileges for Watch now (open Netflix/Disney+/… via Luna). See design notes in docs.
