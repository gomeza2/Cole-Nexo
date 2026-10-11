# NEXO — Fase 3: PWA e inicio sin conexión

## Objetivo

Hacer que NEXO se pueda instalar desde navegadores compatibles y abrir su app base si se pierde la conexión, sin hacer pasar las integraciones externas por funciones offline.

## Implementado

- `manifest.webmanifest`: nombre, idioma es-AR, inicio relativo, ámbito relativo y modo standalone para funcionar también bajo una ruta de proyecto de GitHub Pages.
- `nexo-icon-192.svg` y `nexo-icon-512.svg`: iconos SVG con dimensiones declaradas de 192×192 y 512×512, más `nexo-icon.svg` como alternativa escalable.
- `service-worker.js`: precache del shell estático y estrategia de red primero con fallback a caché para archivos propios. La navegación sin red vuelve a `index.html`.
- `pwa.js`: botón accesible de instalación/ayuda, compatibilidad con el aviso de instalación de navegadores y guía manual para iOS/Android/escritorio.
- Estado explicativo de conectividad: aclara que noticias y funciones que dependen de servicios externos pueden necesitar internet.
- No se guardan respuestas de API, tokens ni datos personales desde el Service Worker.

## Cómo probar

1. Publicar el sitio por HTTPS. El Service Worker no funciona desde `file://` y necesita un contexto seguro.
2. Abrir NEXO online una vez y esperar a que el navegador termine de preparar la versión base.
3. En un entorno de prueba, abrir DevTools → Application/Storage → Service Workers y verificar que `service-worker.js` está activo.
4. DevTools → Network → elegir Offline y recargar. La estructura local de NEXO debe abrir desde el shell guardado.
5. Probar el temporizador, notas y las funciones locales. Comprobar que las áreas que llaman a servicios remotos indican o aceptan la falta de conexión; no deben fingir datos actualizados.
6. En Chrome/Edge compatibles, comprobar si el navegador ofrece instalar. En iOS, usar Safari → Compartir → Agregar a pantalla de inicio.
7. Repetir en escritorio, Android y Safari iOS real antes de afirmar compatibilidad universal.

## Límites deliberados

- La primera visita requiere internet para descargar y guardar la app.
- No se implementan notificaciones push en segundo plano, sincronización cloud offline, cola de publicaciones ni resolución de conflictos.
- La instalación depende del navegador y del contexto HTTPS; no todos los navegadores muestran el mismo aviso.
- El shell local no vuelve offline a Supabase, OAuth, la IA, las noticias ni otros proveedores externos.
- Los iconos manifest son SVG; conviene añadir y validar PNG de 192/512 y un `apple-touch-icon` PNG para ampliar compatibilidad con navegadores y dispositivos, especialmente iOS.
- Aún hacen falta pruebas reales de navegador y dispositivo; el código por sí solo no certifica una release.

## Siguiente puerta de calidad

Primero publicar por HTTPS y completar la checklist PWA. Después configurar Supabase en un entorno de prueba y verificar la Fase 2 con dos cuentas antes de priorizar pagos o monetización.
