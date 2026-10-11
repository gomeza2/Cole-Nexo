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
