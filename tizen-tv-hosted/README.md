# Watchily — Samsung Tizen TV (Hosted Web App)

Thin shell that opens the production TV UI:

`https://watchily.wayool.com/tv`

Full packaging, Dev Mode, certificates, and store checklist: [docs/tv-packaging.md](../docs/tv-packaging.md).

## Local package / install

```bash
npm run tizen:package   # writes Watchily.wgt at repo root
npm run tizen:install   # installs to a connected Tizen TV (requires sdb / Tizen CLI)
```

### Prerequisites

1. [Tizen Studio](https://developer.tizen.org/development/tizen-studio/download) (or CLI only) + **Samsung Certificate Extension**
2. Certificate Manager: create a **Samsung TV distributor** certificate and author certificate
3. TV: enable **Developer Mode** (Apps → 12345 → On), set your PC IP, restart
4. Connect: `sdb connect <tv-ip>:26101` (port may vary)

If `tizen` CLI is not installed, `tizen:package` still builds a `.wgt` zip. Store submission and signed install require Tizen Studio certificates.

## Version

Bump `version` in `config.xml` (and keep `tizen:application` id stable) for store updates. Content-only UI changes ship via Vercel — no WGT resubmit.
