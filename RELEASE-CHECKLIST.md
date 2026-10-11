# NEXO 1.0 — checklist de QA

## Persistencia y privacidad
- [ ] Crear tareas, prioridades, notas, bienestar y progreso; recargar y comprobar persistencia.
- [ ] En navegador de prueba, quitar la clave primaria de localStorage y verificar recuperación desde la copia auxiliar.
- [ ] Exportar JSON y revisar tareas, agenda, bienestar, favoritos, puntos, aprendizaje, récords e historial.
- [ ] Confirmar que no se exportan API keys ni el texto efímero del Descompresor Neural.
- [ ] Importar JSON válido; probar JSON inválido, archivo de más de 2 MB y propiedades inesperadas.
- [ ] Probar almacenamiento bloqueado/lleno. No debe aparecer una confirmación falsa de éxito.
- [ ] Verificar el aviso de que borrar todos los datos del sitio también puede borrar el respaldo local.

## Noticias
- [ ] Sin conexión aparecen tres tarjetas DEMO identificadas como ejemplos, no noticias reales.
- [ ] Las flechas recorren selecciones locales sin recargar.
- [ ] La lectura de un demo no muestra una fuente o enlace inventado.
- [ ] Si se publica Worker: comprobar secreto GNEWS_API_KEY, CORS, tres titulares, caché de diez minutos y fallback.
- [ ] Confirmar que no hay claves de API en HTML, JS, JSON ni commits.

## Onboarding y accesibilidad
- [ ] Primera visita muestra tres pasos; siguiente, saltar y Escape funcionan.
- [ ] Al completar no se repite; Ajustes permite reabrir el tour.
- [ ] En móvil, el tour abre el menú para Agenda y lo cierra para Modo Profundo.
- [ ] Probar teclado, foco visible, lector de pantalla y zoom al 200%.
- [ ] El texto del Descompresor Neural se borra al salir y no se exporta.

## Móvil y rendimiento
- [ ] Revisar 360 px, 390 px, tablet y 768 px sin desbordamiento horizontal.
- [ ] Menú hamburguesa, rutas y engranaje de Ajustes funcionan.
- [ ] Alternar Modo Profundo en móvil y escritorio.
- [ ] Ocultar la pestaña durante Neural y comprobar pausa/reanudación.
- [ ] Con `prefers-reduced-motion`, Neural no mantiene un bucle continuo estando quieto.
- [ ] Probar batería, temperatura, memoria e imágenes en un teléfono real.

## Puerta de salida
- [ ] Consola sin errores; revisar enlaces y botones.
- [ ] Exportación/importación y navegación probadas en Chrome, Firefox, Safari iOS y Chrome Android.
- [ ] Verificar GitHub Pages; para noticias reales, verificar Worker y secreto.
- [ ] No declarar validado el lanzamiento hasta probar navegadores y dispositivos reales.


## Fase 1 — hábitos, analíticas y recordatorios
- [ ] En Progreso, revisar la tarjeta de actividad semanal con siete días; comprobar que los días sin registro no generan avisos de culpa.
- [ ] Completar y reabrir una tarea: sólo la primera finalización agrega un evento de actividad.
- [ ] Completar una sesión de enfoque desde Agenda y desde Progreso; el día actual debe reflejar la sesión.
- [ ] En Bienestar, comparar ánimo y actividad; los días sin check-in deben aparecer sin puntuación de ánimo.
- [ ] En Ajustes, comprobar que los recordatorios están apagados por defecto y no se solicita permiso hasta pulsar activar.
- [ ] Confirmar que los recordatorios se etiquetan como avisos locales mientras la pestaña está activa, no como push en segundo plano.
- [ ] Exportar e importar JSON con los nuevos campos habitLog y reminderSettings.
- [ ] Ejecutar supabase/schema.sql sólo en un proyecto de prueba; verificar RLS con dos usuarios distintos y que ningún usuario lea las filas del otro.
- [ ] Antes de lanzar auth cloud: probar OAuth, migración local idempotente, logout, cambio de usuario, exportación/borrado y conflictos de sincronización.


## Compañero de Ruta — IA y consentimiento
- [ ] Abrir Mi Ruta sin marcar consentimiento y comprobar que se produce sólo un texto local; verificar que no hay POST al Worker.
- [ ] Escribir notas opcionales, guardarlas, salir/volver y comprobar que persisten localmente sin llamadas a la API.
- [ ] Activar consentimiento y pedir reflexión; validar que sólo se envían los datos agregados de siete días y las notas opcionales, sin correo o nombre.
- [ ] Verificar el POST /api/companion, el secreto OPENAI_API_KEY, respuesta sin caché y alternativa local ante errores.
- [ ] Probar contexto vacío, notas largas, JSON grande, origen no permitido y respuestas del proveedor 401/429/5xx.
- [ ] Probar lenguaje alimentario neutro, sin inferencias médicas, y sugerencias opcionales.
- [ ] Configurar Cloudflare rate limiting para /api/companion y límites de gasto antes del lanzamiento público.

- [ ] Verificar que la salida generada por Compañero de Ruta pase por omni-moderation-latest y que un error de revisión no muestre la salida sin comprobar.


## Fase 2 — Comunidad segura
- [ ] Ejecutar supabase/phase2-community.sql después del esquema de Fase 1 en un proyecto de test y verificar que todas las funciones existen.
- [ ] Sin conexión Supabase, validar que la sala y el muro se identifiquen como demo; no debe simular usuarios reales ni permitir publicar.
- [ ] Configurar dos cuentas de prueba; validar OAuth, crear sala, código de invitación, presencia, timer compartido, salida y expiración de heartbeat.
- [ ] Confirmar que las salas y los canales Realtime son privados y un usuario fuera de la membresía no puede leer ni enviar Presence/Broadcast.
- [ ] Verificar que sólo el anfitrión puede controlar la sesión y que el anfitrión offline puede ceder el control de manera segura.
- [ ] Enviar una publicación y confirmar estado pending, límite de caracteres y rechazo de enlaces/contacto. No debe aparecer en el muro antes de aprobación.
- [ ] Probar moderación con una cuenta de equipo autorizada; cuenta común no puede aprobar, retirar ni ver la cola.
- [ ] Probar reporte, duplicado de reporte, límites por tiempo y bloqueo de alias en dos cuentas distintas.
- [ ] Revisar que las consultas públicas nunca devuelvan auth user ID, correo, IP ni metadatos de cuenta.
- [ ] Confirmar que existe una persona moderadora responsable y un procedimiento de respuesta antes del lanzamiento.


## Fase 3 — PWA y funcionamiento offline
- [ ] Publicar en HTTPS y comprobar que `manifest.webmanifest` carga sin error.
- [ ] Verificar el nombre, ámbito y ruta inicial desde la URL real de GitHub Pages, incluida la ruta de subdirectorio del proyecto.
- [ ] Abrir online y esperar la instalación del Service Worker; comprobar que el cache contiene sólo el shell estático.
- [ ] Poner el navegador en modo Offline, recargar y confirmar que abre `index.html` desde la caché.
- [ ] En modo Offline, probar notas, tareas y temporizador; confirmar que noticias, Supabase y la IA no se presentan como conectados.
- [ ] En línea, editar/publicar una nueva versión y comprobar que los archivos se actualizan sin quedarse permanentemente en caché antigua.
- [ ] Probar las instrucciones manuales de iOS Safari y el flujo nativo de instalación en un navegador compatible.
- [ ] Comprobar teclado, Escape, foco, pantalla de 320–390 px y tema oscuro del panel de instalación.
- [ ] Revisar Service Worker y consola en Chrome, Firefox, Safari iOS y Chrome Android reales antes de declarar la release validada.
- [ ] Verificar en Chrome/Edge que se reconocen los iconos manifest de 192×192 y 512×512; añadir PNG de 192/512 y `apple-touch-icon` para compatibilidad más amplia, especialmente iOS.
