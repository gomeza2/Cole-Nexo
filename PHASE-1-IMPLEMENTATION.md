# NEXO — implementación de la Fase 1

## Qué está implementado en la web

- **Ritmo flexible:** en Progreso aparece un resumen de los últimos siete días. Cuenta sesiones de enfoque, tareas completadas, módulos de aprendizaje y check-ins de bienestar. No se borra un récord ni se muestra un mensaje de culpa cuando un día queda vacío.
- **Ánimo y actividad:** en Bienestar se muestra un gráfico local de ánimo frente a sesiones de enfoque y tareas completadas. Es descriptivo; no diagnostica ni afirma que una variable cause la otra.
- **Recordatorios amables:** son opt-in y se configuran en Ajustes. Solicita permiso sólo al pulsar el botón y puede mostrar un aviso tras 1, 2 o 3 horas sin interacción. En esta primera entrega sólo funciona mientras NEXO está abierto y la pestaña activa; **no es push en segundo plano**.
- **Persistencia local compatible:** los nuevos campos se incorporan al estado ya existente y a la exportación/importación JSON. Los datos permanecen en el dispositivo por ahora.

## Preparar la base real con Supabase

El esquema inicial está en **supabase/schema.sql**. Crea tablas separadas para tareas, registros diarios de bienestar, actividad agregada, reflexiones privadas, favoritos, avance de aprendizaje, preferencias y registro de migraciones. Activa Row Level Security (RLS) en todas las tablas y cada política limita las filas al usuario autenticado que las posee.

1. Crea un proyecto en Supabase.
2. Abre SQL Editor, pega el contenido completo de **supabase/schema.sql** y ejecútalo.
3. En Authentication → Providers, habilita Google y/o Discord y completa la configuración OAuth solicitada por cada proveedor.
4. En Authentication → URL Configuration, añade la URL de la web publicada a las URLs de redirección permitidas. Usa también las URLs callback que muestre Supabase en la configuración de cada proveedor.
5. La próxima integración de cliente necesitará el Project URL y la publishable/anon key. Esa clave pública sólo se puede usar desde el navegador porque RLS protege los datos; **nunca** publiques ni pegues una service_role key.
6. Antes de activar sincronización, implementa login/logout, una migración idempotente del JSON local, manejo de conflictos y borrado de cuenta/datos. No subas automáticamente notas íntimas o registros de bienestar sin consentimiento claro.

## Decisiones de privacidad para el público de 16–18 años

- No hay perfiles públicos, rankings globales ni publicación automática de datos íntimos.
- Los registros de ánimo, sueño, agua, notas y reflexiones deben permanecer privados y no usarse para segmentación publicitaria.
- Los recordatorios están desactivados por defecto, pueden deshabilitarse en cualquier momento y no usan lenguaje de culpa.
- La comunidad asincrónica y las salas multijugador corresponden a una fase posterior; deben salir sólo después de diseñar reportes, bloqueo, moderación, límites de contacto y respuesta a incidentes.

## Pruebas manuales de salida

1. En Progreso, comprobar que completar una tarea o una sesión cuenta sólo el día actual y que desmarcar una tarea no agrega otra actividad.
2. En Bienestar, guardar varios check-ins y comprobar que el gráfico muestra ánimo; los registros vacíos deben seguir como vacíos, no transformarse en cero.
3. En Ajustes, mantener los recordatorios desactivados por defecto, cambiar el intervalo, activarlos y desactivarlos. Confirmar que el permiso del sistema sólo se solicita después de pulsar el botón.
4. Exportar la copia JSON, revisar que habitLog y reminderSettings aparecen dentro del estado, importarla y confirmar que se recuperan.
5. Probar con el permiso de notificaciones denegado, pestaña oculta, móvil estrecho, tema oscuro y prefers-reduced-motion.

## Qué queda pendiente antes de considerar completa la Fase 1

- Crear el proyecto Supabase y configurar los proveedores OAuth.
- Implementar el flujo de sesión y sincronización real en el cliente; el SQL por sí solo no crea una cuenta ni sincroniza los datos actuales.
- Implementar push real con Service Worker, suscripción del navegador y backend que envíe notificaciones. No activar push mientras no haya opt-in claro y mecanismos para cancelar la suscripción.
- Medir activación, retención D7, opt-in de recordatorios y errores de migración usando métricas agregadas que no incluyan el contenido de las notas de bienestar.


## Compañero de Ruta — reflexión semanal asistida por IA

### Experiencia y privacidad
- La sección Mi Ruta / Compañero de Ruta muestra un diario semanal y una sugerencia pequeña.
- Los domingos aparece una invitación discreta en Inicio. No abre por sí sola, no genera reflexión en segundo plano y no envía datos automáticamente.
- Las notas opcionales sobre comidas y sensaciones físicas se guardan en el navegador al pulsar “Guardar sólo en este dispositivo”.
- Con el consentimiento apagado, la reflexión y la sugerencia se generan localmente; no se llama a la API.
- Sólo si la persona activa “Quiero compartir el contexto seleccionado con la IA” y luego toca un botón, el navegador envía los datos agregados de los últimos siete días y las notas opcionales al Worker. La casilla está apagada por defecto.
- La reflexión generada se guarda localmente. La exportación e importación JSON incluye sus dos claves de almacenamiento.
- La IA no diagnostica, no atribuye causas seguras, no juzga comidas ni cuerpo, no recomienda dietas y no reemplaza atención profesional.

### Conectar OpenAI en el Worker existente
1. El archivo companion-config.js contiene la URL pública de /api/companion. No contiene secretos.
2. En Cloudflare, abre Workers & Pages → nexo-news-proxy → Settings → Variables and Secrets y agrega un Secret llamado OPENAI_API_KEY. Usa una clave de la API de OpenAI, no una clave de ChatGPT.
3. El Worker usa gpt-6-luna por defecto y revisa la salida con omni-moderation-latest antes de mostrarla. Si tu proyecto necesita otro modelo compatible, define la variable OPENAI_MODEL.
4. Abre workers/news-worker.js en GitHub, copia el archivo completo, pégalo en Edit Code del Worker reemplazando la versión anterior y pulsa Deploy. El código conserva la ruta de noticias y añade el POST /api/companion.
5. La clave no se debe incluir en app.js, companion-config.js ni en el repositorio.

### Seguridad antes de publicar a gran escala
- El Worker valida y limita el tamaño del cuerpo, reduce los campos recibidos, utiliza store:false para la petición de Responses API y comprueba el origen permitido. Eso no es una promesa de retención cero por parte del proveedor.
- CORS no autentica el endpoint ni evita que un cliente externo intente llamarlo. Configura una regla de rate limiting de Cloudflare para /api/companion antes de abrirlo al público y añade alertas/límites de gasto.
- La interfaz avisa que las notas opcionales se enviarán al proveedor de IA sólo con consentimiento explícito. No prometas confidencialidad absoluta ni anonimato perfecto.
- Revisa el aviso de privacidad, el consentimiento apropiado para la edad y los requisitos legales del mercado antes de usar datos de bienestar de menores.



## Siguiente etapa
La siguiente implementación está en **PHASE-2-IMPLEMENTATION.md** y la migración **supabase/phase2-community.sql**. La interfaz de Comunidad funciona como demo hasta que se conecte un proyecto Supabase, se configure OAuth y se publique el SQL.
