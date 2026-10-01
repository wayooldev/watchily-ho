# URLs de streaming en la app TV (webOS + Tizen)

## Comportamiento de producto

Los enlaces a Netflix, Disney+, Max, etc. usan **URLs web** (ej. `https://www.netflix.com/title/123456`). En la app empaquetada (IPK / WGT), Watch now:

1. Intenta abrir la **app nativa** del proveedor (Luna en webOS, ApplicationControl en Tizen).
2. Pasa la URL / content target cuando el OEM y el proveedor lo aceptan (deep link al título).
3. Si falla o la app no está instalada → abre la URL en el navegador del sistema (sin navegar el WebView de Watchily con `location.href`, que en webOS puede dejar pantalla negra).

Código: `src/lib/tv-streaming-launch.ts`, `webos-launch.ts`, `tizen-launch.ts`, cableado en `StreamingLink`.

---

## webOS (LG)

### API

`webOS.service.request('luna://com.webos.applicationManager', { method: 'launch', … })` vía `webOSTV.js` (CDN en `TvChrome`).

**IDs (mapa en código):**

| Provider | App id |
|----------|--------|
| Netflix | `netflix` |
| Disney+ | `com.disney.disneyplus-prod` |
| Max | `com.wbd.max` |
| Prime Video | `amazon` |
| Crunchyroll | `com.crunchyroll.crmay` |
| Paramount+ | `com.paramount.paramountplus` |
| Apple TV+ | `com.apple.appletv` |

**Deep link:** se envía `contentTarget` / params con la URL. Muchos proveedores **abren la app** pero **ignoran** el título concreto (no documentan params públicos). Fallback: launch sin params → browser URL.

**Permisos IPK:** `application.launcher`, `com.webos.applicationManager.launch`, `com.webos.service.applicationmanager`.

---

## Tizen (Samsung)

### API

`tizen.application.launchAppControl(appControl, appId, …)` con `ApplicationControl` operation `http://tizen.org/appcontrol/operation/view` y URI = URL del título cuando existe.

**IDs iniciales (verificar en hardware — pueden variar por región/firmware):**

| Provider | App id (tentative) |
|----------|--------------------|
| Netflix | `org.tizen.netflix-app` |
| Disney+ | `HOh3FT9SBL.DisneyPlus` |
| Max | `3s5yv8f6r4.Max` |
| Prime Video | `org.tizen.primevideo` |
| YouTube | `9Ur5IzDKqV.TizenYouTube` |

Actualizar este doc y `TIZEN_APP_IDS_BY_BRAND` tras la spike en dispositivo (task 3.4 / 5.2).

**Deep link:** URI + optional `PAYLOAD` data. Si `launchAppControl` falla → reintento sin URI → `window.open(url)`.

**Privilegios WGT:** `http://tizen.org/privilege/application.launch`, `internet`.

---

## Escritorio (`?device=tv`)

Sin APIs OEM: `launchStreamingWatchNow({ preferTvBehavior: true })` hace `window.open` y no lanza excepciones. Útil para QA de foco/UI.

---

## Notas de spike en hardware

| Platform | Provider | Native launch? | Title deep-link? | Notes | Date |
|----------|----------|----------------|------------------|-------|------|
| webOS | Netflix | _TBD on device_ | Often app-only | contentTarget best-effort | |
| webOS | Disney+ | _TBD_ | Partial / GUID params historically | See legacy standalone notes | |
| Tizen | Netflix | _TBD on device_ | _TBD_ | Confirm app id | |
| Tizen | Disney+ / Max / Prime | _TBD_ | _TBD_ | Confirm app ids | |

Fill this table when sideloading IPK/WGT on real TVs.
