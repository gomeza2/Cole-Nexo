# NEXO — Fase 4: comprobación de Supabase y preparación para pruebas multiusuario

## Qué se añade

- Un auditor SQL de solo lectura: `supabase/phase4-verify.sql`. Comprueba las 15 tablas de Fases 1 y 2, RLS, las RPC que usa Comunidad, las políticas principales y la publicación Realtime para membresías.
- Un comprobador en la pantalla Comunidad. Después de iniciar sesión, verifica que la sesión se puede validar contra Supabase y que la RPC `get_discovery_wall` responde. Explica con claridad que la prueba real de Realtime requiere dos cuentas.
- Pasos de puesta en marcha y una puerta de salida antes de abrir la comunidad.

## Orden para conectar un proyecto nuevo

1. En Supabase, crea un proyecto de prueba y guarda su URL y **publishable key**. No uses ni compartas una secret/service_role key en el navegador.
2. En SQL Editor, ejecuta `supabase/schema.sql`.
3. Ejecuta `supabase/phase2-community.sql`.
4. Ejecuta `supabase/phase4-verify.sql`. Todos los checks de tablas, RLS, RPC, políticas y Realtime deberían mostrar `OK`. Si alguno dice `REVISAR`, no abras el sitio al público hasta corregirlo.
5. En `community-config.js`, completa `NEXO_SUPABASE_URL` y `NEXO_SUPABASE_PUBLISHABLE_KEY`.
6. En Supabase Authentication, habilita los proveedores OAuth que vas a usar (Google o Discord), configura sus credenciales y agrega la URL HTTPS publicada de NEXO a las URLs de redirección permitidas. La callback también debe coincidir con el proveedor.
7. En Realtime, deja los canales de salas como privados. No uses una clave de servidor en el navegador.
8. Abre Comunidad, inicia sesión y ejecuta **Comprobar conexión**. Esto revisa sesión + RPC del muro; no sustituye una prueba en dos cuentas.

## Prueba manual obligatoria con dos cuentas de test

1. Abre dos perfiles de navegador independientes o un navegador normal y otro incógnito.
2. Inicia sesión con dos cuentas de test distintas; no uses cuentas personales como casos de prueba.
3. Con cuenta A, crea una sala con un bloque de 5 minutos y copia el código de seis caracteres.
4. Con cuenta B, entra con ese código. Confirma que ambas ven los participantes y el mismo cronómetro.
5. Inicia, pausa, reanuda y termina la sesión como anfitrión. Confirma que el cambio se replica; prueba que B no puede controlar el bloque cuando no es anfitrión.
6. Cierra la pestaña del anfitrión, espera la expiración de heartbeat y verifica que el comportamiento de reconexión/control coincide con las reglas SQL.
7. Desde cuenta B, crea una publicación. Debe quedar pendiente y no aparecer en el muro público hasta aprobación.
8. Revisa que una cuenta común no puede aprobar publicaciones ni consultar la cola de moderación. Para comprobarlo, la cuenta de equipo debe tener `app_metadata.nexo_role = "moderator"`, puesto por un canal administrativo de confianza, nunca por `user_metadata`.
9. Prueba reportar y ocultar alias con dos cuentas. Repite los casos negativos: usuario sin sesión, sala inexistente, texto con enlaces/datos de contacto, y RPC no desplegada.
10. Revisa la consola del navegador y los registros de Supabase. No declares la fase validada hasta que estas pruebas pasen.

## Qué no puede comprobar el script SQL

- OAuth redirect URLs, credenciales externas y el estado de los proveedores.
- La publishable key que está cargada en la web y que coincide con el proyecto que auditaste.
- Acceso completo en tiempo real con dos usuarios conectados.
- La configuración de moderación del producto y los procesos de respuesta ante reportes.

El verificador SQL es de solo lectura: no crea tablas ni cambia políticas, grants o datos. La app todavía queda en modo demo hasta completar la configuración real de Supabase.
