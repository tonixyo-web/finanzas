# Finanzas

App web instalable (PWA) para apuntar ingresos, gastos, ahorro y cuentas, con diseño estilo iOS. Sin servidor: los datos se guardan en el propio teléfono.

## Publicar en GitHub Pages

1. Crea un repositorio en https://github.com/new (por ejemplo `finanzas`), público, sin README.
2. En este ordenador, dentro de la carpeta del proyecto:
   ```
   git remote add origin https://github.com/TU_USUARIO/finanzas.git
   git push -u origin main
   ```
3. En GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: main / (root) → Save**.
4. Al cabo de un minuto la app está en `https://TU_USUARIO.github.io/finanzas/`.

## Instalar en el iPhone

1. Abre esa URL en **Safari** (tiene que ser Safari, no Chrome).
2. Pulsa el botón **Compartir** (cuadrado con flecha) → **Añadir a pantalla de inicio** → **Añadir**.
3. Abre "Finanzas" desde el icono. Se abre a pantalla completa y funciona sin conexión.

## Actualizar la app

1. Cambia el número de versión en `sw.js` (`finanzas-v1` → `finanzas-v2`, etc.). Sin esto el iPhone seguirá mostrando la versión antigua.
2. `git add -A && git commit -m "..." && git push`.
3. En el iPhone, cierra la app del todo y ábrela dos veces: la primera descarga la versión nueva, la segunda ya la usa.

## Copias de seguridad

Ajustes → Exportar datos guarda un archivo JSON (por ejemplo en Archivos o iCloud Drive). Importar datos lo restaura. Los datos viven solo en el navegador del teléfono: si borras los datos de Safari o cambias de móvil, necesitarás esa copia.

## Desarrollo

- Sin dependencias. Para probar en el PC hace falta un servidor local (los navegadores bloquean los módulos JS abiertos como archivo): ejecuta `powershell -ExecutionPolicy Bypass -File tools/serve.ps1` (o botón derecho sobre `tools\serve.ps1` → "Ejecutar con PowerShell") y abre `http://localhost:8080/`. En localhost no se activa el modo sin conexión, así cada recarga muestra el código actual.
- Tests: abre `tests/tests.html`, o ejecuta `bash tests/run-tests.sh` (usa Microsoft Edge en modo headless).
- Iconos: `powershell -ExecutionPolicy Bypass -File tools/make-icons.ps1`.
