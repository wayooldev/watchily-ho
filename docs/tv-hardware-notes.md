# Hardware / sideload notes — js-tv-lg-tizen

## Tizen (task 1.3 / 5.2)

- `npm run tizen:package` → `Watchily.wgt` at repo root (verified; zip fallback when Tizen CLI absent).
- `npm run tizen:install` → **blocked this session**: no `tizen` / `sdb` on PATH. Install via Tizen Studio Device Manager once Developer Mode + certificates are set.
- After first install: open app → React TV shell; Watch now Netflix + one other → fill table in `docs/tv-streaming-urls.md`.

## LG webOS (task 2.2 / 5.2)

- Privileges in `appinfo.json` include launcher APIs for Watch now (confirmed).
- `npm run tv:package` → `com.watchily.web_1.0.1_all.ipk` (verified).
- `npm run tv:install` → **connection timed out** to device `mitv` this session. Re-run when the TV is on the network / Dev Mode reachable.
- Watch now path: `launchStreamingWatchNow` → webOS Luna (existing) with browser fallback.

## Desktop

- Unit: `tests/tv-streaming-launch.test.ts` (10) + `webos-launch` (3) passed.
- E2E: `e2e/tv-react.spec.ts` covers `[data-tv-spatial-root]` / `?device=tv`.
- `npm run build` succeeded after launch adapter changes.
