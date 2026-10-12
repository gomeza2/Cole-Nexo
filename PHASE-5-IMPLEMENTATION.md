# NEXO — Fase 5: copia personal privada y sincronización manual

## Qué incluye

- Panel en **Ajustes → Copia privada en la nube**.
- Consentimiento explícito por sesión. La casilla comienza desmarcada y vuelve a desmarcarse si se cierra o cambia de cuenta.
- Revisión de la versión guardada en Supabase y comparación con este dispositivo.
- Guardado manual de la copia local en la nube, limitado a 1,5 MB.
- Restauración manual de la copia remota al dispositivo actual. Antes de restaurar, el módulo consulta de nuevo la versión para no aplicar una revisión que cambió mientras se leía.
- Control de concurrencia optimista: cada guardado requiere la versión revisada. Si otro dispositivo guardó antes, la operación devuelve conflicto y no sobrescribe la versión nueva.
- Tabla privada `public.nexo_user_snapshots`, RLS activado, sin permisos de acceso directo desde el navegador. La lectura/escritura se ejecuta por RPC autenticadas.
- El módulo local expone únicamente una API de instantáneas validada y una lista permitida de claves auxiliares. El texto efímero del Descompresor Neural no se guarda ni se incluye.

## Importante sobre privacidad

La instantánea puede contener tareas, notas, preferencias, información de bienestar, favoritos, historial de descubrimientos y reflexiones de Mi Ruta. Esos datos quedan asociados a la cuenta de Supabase. Activá la opción únicamente en un proyecto que controles y después de leer el aviso de privacidad correspondiente.

No hay sincronización automática ni fusión de campos: el usuario decide cuándo revisar, subir o restaurar. Subir reemplaza la copia en la nube completa; restaurar reemplaza en ese navegador el estado y las claves locales auxiliares incluidas en la instantánea. Exportá un JSON antes de restaurar. La versión local sigue disponible si no se activa la función cloud.

## Puesta en marcha

1. Crea un proyecto de prueba en Supabase. No compartas claves privadas con el sitio ni por chat.
2. En SQL Editor, si el proyecto es nuevo, ejecutá `supabase/schema.sql` y luego `supabase/phase2-community.sql`.
3. Ejecutá `supabase/phase5-sync.sql`. El SQL crea la tabla y las RPC; no inserta datos personales ni conecta automáticamente ninguna cuenta.
4. Ejecutá `supabase/phase5-verify.sql`. Todos los checks deben mostrar `OK`; revisá específicamente RLS, ausencia de permisos de acceso directo y permisos de las RPC.
5. En `community-config.js`, completá la URL HTTPS del proyecto y su **publishable key**. Nunca pongas `service_role` ni claves secret en el navegador.
6. Configurá el proveedor OAuth que usarás y las redirect URLs. Iniciá sesión en NEXO desde **Comunidad**.
7. Abrí **Ajustes**, marcá «Quiero usar la copia privada en Supabase» y pulsá **Revisar copia**. Ningún contenido remoto se lee hasta ese consentimiento y la acción.
8. Para crear la primera copia, pulsá «Guardar copia local en la nube». En otro perfil/dispositivo con la misma cuenta, revisá la versión y elegí restaurarla sólo después de exportar los datos locales que querés conservar.

## Cómo resolver conflictos

Si una subida responde que la nube cambió desde la última revisión, no intentes forzarla. Pulsá **Revisar copia** para comprobar la nueva versión y compará el contenido local con el remoto. Elegí explícitamente cuál copia querés conservar. La herramienta todavía no fusiona campos porque una fusión automática de notas privadas, tareas y bienestar podría causar pérdidas o mezclar datos de épocas distintas.

## Pruebas obligatorias antes de lanzar

- Sin configuración o sin sesión, los botones permanecen deshabilitados y no se lee ni sube una copia.
- El consentimiento se limpia al cambiar o cerrar sesión; no hay carga en segundo plano.
- Dos perfiles con la misma cuenta pueden revisar una copia, subir desde uno y restaurar en el otro.
- Dos operaciones concurrentes con la misma versión: sólo la primera guarda; la segunda devuelve conflicto y conserva la versión nueva.
- Una cuenta distinta no puede leer la instantánea de otra.
- Usuarios sin autenticar no pueden ejecutar las RPC ni acceder directamente a la tabla.
- Se prueban tamaño superior a 1,5 MB, JSON auxiliar inválido, error de red, RPC no desplegada y sesión vencida.
- La restauración exige la misma versión revisada y muestra claramente que reemplazará datos locales.

La implementación del cliente y las comprobaciones de sintaxis no sustituyen estas pruebas con un proyecto Supabase real. La fase no debe declararse completamente validada hasta pasarlas.
