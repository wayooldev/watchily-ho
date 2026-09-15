# Watchily - LG webOS TV (Hosted Web App)

## Probar en la TV

1. **Empaquetar** (genera el IPK):
   ```bash
   npm run tv:package
   ```

2. **Instalar** en la TV conectada:
   ```bash
   npm run tv:install
   ```
   O con dispositivo: `ares-install com.watchily.web_1.0.0_all.ipk -d <nombre-tv>`

3. La app abre directamente la página Popular en https://watchily.wayool.com/tv

## Requisitos

- webOS TV SDK (ares-package, ares-install)
- Iconos `icon.png` (80x80) y `largeIcon.png` (130x130) en esta carpeta

Documentación: https://webostv.developer.lge.com/develop/getting-started/web-app-types
