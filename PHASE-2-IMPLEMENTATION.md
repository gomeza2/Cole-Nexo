# NEXO — Fase 2: Comunidad segura y Salas de Enfoque

## Qué incluye la entrega

### Salas de Enfoque
- Crear una sala con nombre corto y duración inicial de 5, 15, 25 o 45 minutos.
- Compartir un código de seis caracteres y unirse con ese código.
- Hasta 12 participantes activos por sala.
- Presencia en tiempo real por Supabase Realtime Presence y temporizador compartido mediante Broadcast en canal privado.
- Cada persona aparece con un alias temporal y un avatar minimalista; el canal no publica correo, nombre de cuenta ni ID de usuario.
- Sólo el anfitrión inicia, pausa, reanuda o termina el bloque. El anfitrión puede transferirse si deja de estar activo.
- No hay mensajes privados, chat, cámara ni micrófono.
- Mientras Supabase no esté configurado, se muestra un temporizador local de demostración rotulado como demo.

### Muro de Descubrimientos
- Publicaciones exclusivamente de texto, entre 12 y 400 caracteres.
- Los envíos quedan en estado pending. No son visibles en el muro hasta que una persona moderadora los aprueba.
- El muro muestra un alias seudónimo, fecha y texto aprobado; no devuelve el ID real de la cuenta.
- Reportar una publicación con categorías predefinidas y ocultar un alias para la cuenta actual.
- Límites de publicación y reporte en la base de datos. Se rechazan patrones comunes de enlaces, correo y secuencias largas de números de contacto.
- La cola moderadora muestra pendientes y publicaciones aprobadas que recibieron reportes; el estado de moderación se valida en backend.
- Si no hay Supabase, el muro muestra tarjetas claramente etiquetadas como ejemplos y no permite publicarlas.

## Pasos para conectar el backend

1. En un proyecto de Supabase, ejecuta primero supabase/schema.sql (Fase 1) desde **SQL Editor**.
2. Ejecuta después el contenido completo de supabase/phase2-community.sql. Crea tablas, funciones RPC, límites, políticas RLS y autorización para canales privados. No lo ejecutes en una base con tablas equivalentes creadas manualmente sin revisar antes el esquema.
3. En **Settings → API Keys** (o el cuadro **Connect** del proyecto), copia el Project URL y la **publishable key**. En GitHub, edita community-config.js y reemplaza las cadenas vacías:
   - window.NEXO_SUPABASE_URL = 'https://TU-PROYECTO.supabase.co';
   - window.NEXO_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_…';
4. En **Authentication → Providers**, habilita Google y/o Discord y completa la configuración OAuth que pide cada proveedor. En **Authentication → URL Configuration**, añade la URL exacta publicada por GitHub Pages como URL permitida de redirección.
5. En **Realtime Settings**, desactiva el acceso público a canales para exigir canales privados. El SQL crea políticas de realtime.messages ligadas a una membresía activa en la sala.
6. Publica una versión actualizada de GitHub Pages. Con la configuración vacía, la web permanece en modo local.
7. Para habilitar moderación, una persona adulta responsable de administrar el proyecto debe asignar nexo_role: "moderator" al app_metadata de las cuentas del equipo desde un proceso administrativo seguro. No asignes esta propiedad desde el navegador ni desde user_metadata, porque la persona usuaria podría modificar su propio metadata. Después, el moderador debe volver a iniciar sesión.

**Nunca uses una secret key o service_role en community-config.js.** Sólo va la publishable key, y las políticas RLS deben estar aplicadas antes de publicar.

## Decisiones de privacidad y seguridad

- El muro es seudónimo frente a otros participantes, no anónimo para el backend: la cuenta privada se vincula internamente a cada aporte para limitar abusos, procesar reportes y aplicar bloqueos. La vista pública no expone correo ni ID de cuenta.
- El cuerpo del post se trata como texto y se escapa antes de renderizarse. No se aceptan imágenes, enlaces, embeds ni archivos.
- El contenido generado por participantes no se publica automáticamente. La revisión humana previa es requisito para abrir el muro a usuarios reales.
- Las salas usan códigos no adivinables, membresías temporales con heartbeat y canales privados. El temporizador del anfitrión se valida por RPC; los broadcasts no sustituyen las validaciones del backend.
- Los reportes no publican quién reportó. Los bloqueos se aplican sólo al muro de la cuenta que los configuró.
- No hay chat libre en las salas en esta fase, reduciendo los canales de acoso y contacto no deseado.
- Antes de abrir masivamente la comunidad, debe haber una persona moderadora responsable, una política de respuesta a reportes, un canal de contacto y un procedimiento de incidentes. Revisa también requisitos legales de privacidad y consentimiento para el público de 16–18 años.

## Pruebas manuales de salida

1. Sin configurar Supabase, abre Comunidad: el cronómetro demo debe funcionar y todos los posts deben decir que son ejemplos.
2. Con Supabase configurado pero sin sesión, comprueba que se muestran login y funciones bloqueadas.
3. En dos cuentas de prueba diferentes, crea una sala, copia el código y únete desde la segunda cuenta. Verifica presencia y alias temporales, capacidad y que sólo el anfitrión pueda controlar el timer.
4. Prueba iniciar, pausar, reanudar, terminar, abandonar, recargar y volver a entrar. Las salas no deben aceptar usuarios sin código y sesión.
5. Publica texto normal y confirma que queda pendiente y no aparece en el muro. Como moderador, apruébalo y comprueba que ahora sí aparece con alias seudónimo.
6. Envía un post con enlaces, email o muchos dígitos y confirma el rechazo. Verifica límites de frecuencia.
7. Prueba reportar, duplicar el reporte, bloquear alias y confirmar que sus publicaciones dejan de mostrarse a la cuenta que lo bloqueó.
8. Comprueba que una cuenta común no puede invocar herramientas de moderación ni leer tablas de posts/reportes/identidades directamente.
9. En Supabase, prueba RLS de realtime.messages con un usuario miembro y otro que no pertenece a esa sala. El no miembro no debe suscribirse ni publicar Presence.
10. Probar en navegador móvil, tema oscuro, recarga, conexión lenta y pérdida de conexión Realtime.

## Pendiente antes de considerar completa la Fase 2

- Crear/configurar el proyecto Supabase real y completar OAuth.
- Publicar el SQL de Fase 2 y probar sus funciones en una base de test.
- Configurar una cuenta moderadora responsable y ensayar su cola.
- Hacer pruebas de autorización y carga con dos o más sesiones reales.
- Poner alertas de uso y monitoreo de errores en Supabase antes de anunciar la comunidad.
