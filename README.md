# NEXO — primera base visual y funcional

NEXO es una experiencia web en español hecha con HTML, CSS y JavaScript nativo. No requiere npm ni dependencias de compilación.

## Sección Mi agenda
Incluye temporizador de enfoque, notas locales, tres prioridades flexibles y un balance personal. Las notas, objetivos y preferencias quedan guardados en el navegador del usuario. Las sesiones de enfoque completadas suman puntos locales.

## Abrir con GitHub Pages
1. En el repositorio, entrá en **Settings → Pages**.
2. En Build and deployment, elegí **Deploy from a branch**.
3. Seleccioná la rama `main` y la carpeta `/(root)`, luego Save.
4. Esperá la publicación y abrí la URL que GitHub Pages indique.

## Desarrollo local
Abrí `index.html` con un servidor estático local. Si Python está instalado: `py -m http.server 8000`, luego abrí http://localhost:8000.

## Funciones incluidas
- Navegación entre inicio, creatividad, descubrimientos, juegos y progreso.
- Editor de memes Canvas con descarga PNG.
- Ideas creativas y generador de personajes.
- Colección local de descubrimientos con enlaces institucionales, filtros, favoritos e historial.
- Trivia de cinco preguntas por ronda, feedback y puntuación.
- Juego de palabras con pistas.
- Tareas persistentes, categorías, fecha opcional, filtros, edición y borrado.
- Temporizador de enfoque en Mi agenda (5, 25 y 45 minutos), con pausa, reinicio y puntos por sesión.
- Bloc de notas local, hasta tres prioridades y balance personal editable en Mi agenda.
- Exportación e importación de datos JSON.
- Preferencia de tema y diseño adaptable.

## Limitaciones honestas
Los datos se guardan en el navegador, no se sincronizan entre dispositivos. No hay cuentas ni multijugador. La colección de descubrimientos es estática y los enlaces de fuente deben revisarse periódicamente. La fuente tipográfica remota requiere conexión; existen alternativas del sistema.

## Nuevas ramas: Bienestar y Aprender

### Bienestar cotidiano
- Check-in local de ánimo y energía percibida, horas de sueño aproximadas y nota personal.
- Registro flexible de movimiento, pausas y vasos de agua, sin metas obligatorias ni puntuaciones por el cuerpo.
- Historial de los últimos siete días para observar registros sin rachas ni penalizaciones.
- Los datos de bienestar quedan en el navegador y no constituyen una evaluación ni recomendación médica.

### Laboratorio de aprendizaje
- Cuatro rutas: fundamentos de la web, pensamiento científico, creatividad práctica y estrategias de estudio.
- Doce módulos marcables con descripciones breves y progreso local.
- Los módulos completados suman puntos de aprendizaje; se pueden desmarcar y el progreso se puede reiniciar sin borrar el resto de los datos.

### Más comodidad y contenido
- Biblioteca ampliada a 18 descubrimientos, con categorías y enlaces a fuentes de referencia.
- Navegación horizontal en pantallas pequeñas para acceder a todas las ramas.
- El buscador reconoce términos de bienestar, organización y aprendizaje.
- El registro personal, el progreso y los favoritos continúan siendo locales a cada navegador.

## Estudio de Creación Viral (Mime Studio)

- Biblioteca de plantillas populares cargada desde el endpoint público `https://api.imgflip.com/get_memes?type=image`.
- Buscador local sobre las plantillas recibidas, filtros rápidos por palabras y selección del fondo con vista previa.
- Textos superior e inferior editables y arrastrables directamente sobre el lienzo; color y tamaño ajustables.
- Botón «Sorpréndeme» que combina una plantilla aleatoria del catálogo con frases predefinidas.
- Exportación del lienzo como PNG cuando el origen de la imagen permite exportación desde canvas. Algunas plantillas externas pueden bloquearla por restricciones CORS.
- La búsqueda filtra el catálogo popular recibido de la API; la búsqueda completa del catálogo de Imgflip es una función premium y no se usa aquí.

## Bienestar Integral en Inicio

- Tres mini-tarjetas en el panel principal: contador visual de hasta ocho vasos, consejo/receta diaria y pausa de estiramiento en silla de un minuto.
- El contador usa `localStorage` y se reinicia al cambiar el día local; no establece una cuota universal de hidratación.
- Los 30 consejos y recetas viven en `wellbeing-tips.json`; la selección cambia cada 24 horas según el día y se refresca si la pestaña queda abierta.
- Ilustración SVG animada con respeto por la preferencia `prefers-reduced-motion`.
- Si no se puede cargar el JSON, se muestra un consejo de respaldo.

## Reflejos Ninja

- Minijuego expandible en la sección Jugar: el círculo pulsa en gris y cambia a verde tras una espera aleatoria de 1,5 a 6 segundos.
- Tocar antes de tiempo muestra «¡Demasiado rápido!»; al reaccionar tras el verde se mide el tiempo en milisegundos.
- Tabla Top 3 local ordenada de menor a mayor, guardada en `localStorage`.
- Confeti y vibración opcional al conseguir un nuevo récord; animaciones reducidas cuando el dispositivo lo solicita.


## Resumen del Mundo — modo demo y noticias reales opcionales

- El carrusel muestra automáticamente tres tarjetas de demostración sin pedir una clave en el navegador. Cada tarjeta se identifica como **DEMO · EJEMPLO** y su lectura explica que no es una noticia real.
- Hay varias selecciones locales que pueden recorrerse con las flechas; esto deja visible la experiencia incluso sin conexión o cuando una API está caída.
- Para activar titulares reales, usá el proxy opcional descrito en «Noticias reales opcionales» al final de este README. La clave se guarda como secreto del servidor de Cloudflare, nunca en el JavaScript público.
- Las noticias reales pueden estar sujetas a cuotas y demoras del proveedor. Si la conexión falla, vuelve la demo claramente identificada.
- Documentación del proveedor: https://docs.gnews.io/endpoints/top-headlines-endpoint

## Modo Profundo + Descompresor Neural

- Interruptor global de Modo Profundo con cambio visual glassmorphism: grafito, negro y acentos menta/neón sutiles. El estado visual es de sesión y no cambia las preferencias ni el contenido guardado.
- El Descompresor Neural usa WebGL nativo (sin Three.js ni paquetes adicionales) para dibujar una nube de hasta 2.200 puntos GPU con shaders de movimiento 3D. La densidad visible aumenta con la extensión del texto y la energía con la velocidad de escritura; al pulsar «Soltar», los puntos convergen en una esfera simétrica y se desvanecen.
- El campo incluye fallback animado con Canvas 2D si WebGL no está disponible, adaptación móvil, pausa cuando la pestaña no está visible y movimiento reducido cuando el sistema lo solicita.
- El texto de `#neural-dump` es efímero: no se manda a ninguna API, no se copia a `localStorage`, al estado exportable ni a copias de seguridad. «Soltar», «Vaciar» y salir de la sección reemplazan el campo por uno vacío para descartar su contenido y su historial de edición.
- No hay límite de caracteres impuesto por la aplicación. La representación visual tiene un máximo de partículas para mantener el rendimiento.


## Descubrir — mazo de curiosidades con Swipe

- Reemplaza la lista estática por un mazo de tarjetas superpuestas, con fotografía de fondo por curiosidad, categoría, texto, fuente y enlace para verificar.
- Deslizá hacia la derecha para guardar el dato en Favoritos; hacia la izquierda para descartarlo del recorrido del día. También hay controles visibles para guardar/descartar y atajos de teclado con flechas.
- El contador «Datos aprendidos hoy» registra una sola vez cada dato por día local, independientemente de guardarlo o descartarlo; el avance diario se guarda aparte para reiniciar al cambiar la fecha.
- Usa Interact.js 1.10.28 desde jsDelivr para drag con inercia, con fallback a Pointer Events si el CDN o la librería no están disponibles.
- Las curiosidades y fuentes continúan siendo parte de la colección local; las imágenes de fondo se cargan desde NASA, National Geographic y Unsplash, por lo que requieren conexión a Internet.


## Estación de Enfoque

- El temporizador de Progresar mantiene bloques de 5, 15, 25 o 45 minutos, pausa/continuación, reinicio y suma 5 puntos al completar una sesión.
- El indicador SVG circular se vacía según el tiempo restante y el panel de la estación se oscurece sutilmente cuando el temporizador está en marcha.
- Panel lateral plegable con tres paisajes sonoros generados localmente por Web Audio: lluvia urbana, ambiente suave de cafetería y ruido blanco. No requiere descargar archivos de audio ni conectarse a servicios externos; el sonido empieza únicamente después de la acción explícita del usuario.
- Reiniciar o cambiar la duración detiene el audio. Cambiar de sección pausa el reloj y detiene el sonido para evitar que quede reproduciéndose a escondidas; al volver, se conserva el tiempo restante.


## Micro-interacciones de respuestas en Jugar

- Respuesta correcta en «La palabra escondida»: input con borde verde neón pulsante, brillo suave y pequeño rebote; se deshabilita durante la confirmación y luego deja paso al resultado.
- Respuesta incorrecta: borde rojo, sacudida horizontal y mensaje inline accesible que permite volver a intentar sin alertas del navegador.
- En Trivia, la opción correcta usa el pulso verde y rebote, y la opción elegida incorrecta utiliza la sacudida roja.
- Animaciones reducidas si el sistema operativo solicita `prefers-reduced-motion`; los puntos y récords existentes se mantienen.


## Pulido de Release Candidate — versión 1.0

- Persistencia centralizada en localStorage, copia auxiliar e IndexedDB opcional. NEXO solicita almacenamiento persistente, aunque no puede impedir que se borren manualmente todos los datos del sitio.
- Nueva sección **Ajustes** para exportar/importar JSON. Incluye estado principal y registros auxiliares; no incluye el texto efímero del Descompresor Neural.
- Resumen del Mundo funciona sin clave gracias a tarjetas locales DEMO identificadas como ejemplos, no noticias reales. Un proxy opcional está en `workers/news-worker.js`; la API key va como secreto de Cloudflare, nunca en el cliente.
- Tour inicial de tres pasos con opción de repetir desde Ajustes. Menú hamburguesa móvil y acceso rápido a Ajustes.
- El Descompresor Neural limita el render a 30 FPS en móvil, usa un cuadro estático con movimiento reducido y no dibuja fuera de la vista.

### Noticias reales opcionales
1. Instalá Wrangler y autenticá Cloudflare.
2. Ejecutá `wrangler secret put GNEWS_API_KEY`; pegá la clave en la terminal, nunca en GitHub.
3. Ejecutá `wrangler deploy` desde la raíz del repositorio.
4. Configurá `window.NEXO_NEWS_ENDPOINT` en `news-config.js` con la URL HTTPS final del Worker.
5. Ajustá `ALLOWED_ORIGIN` en `wrangler.toml` si el sitio usa otro dominio. Si falla el servicio, vuelven las tarjetas DEMO.


## Fase 1 — Retención y ecosistema de hábitos

- **Ritmo flexible:** resumen de actividad en los últimos siete días, sin rachas punitivas.
- **Ánimo y actividad:** visualización local del check-in de ánimo frente a sesiones de enfoque y tareas completadas, con nota explícita de que no establece causalidad.
- **Recordatorios amables:** opt-in, intervalos configurables y sólo mientras la pestaña está abierta; las notificaciones push reales en segundo plano todavía requieren Service Worker y backend.
- **Base Supabase preparada:** esquema SQL inicial con RLS por usuario en `supabase/schema.sql`. La autenticación y la sincronización cloud aún requieren un proyecto Supabase configurado.
- **Guía de implementación y pruebas:** ver `PHASE-1-IMPLEMENTATION.md`.


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



## Fase 2 — Comunidad segura y Salas de Enfoque

La pantalla **Comunidad** añade un temporizador de sala con código, presencia y control del anfitrión, además de un muro seudónimo para compartir descubrimientos. Las publicaciones quedan pendientes hasta aprobación humana; se puede reportar contenido y ocultar un alias. No hay chat, cámara ni micrófono. En modo de demo aparecen ejemplos rotulados como tales.

Para conectar el backend, sigue **PHASE-2-IMPLEMENTATION.md** y ejecuta primero **supabase/schema.sql**, luego **supabase/phase2-community.sql**. La app requiere URL de Supabase, publishable key y OAuth configurados en **community-config.js**; sin esos pasos funciona en modo local.


## Fase 3 — PWA e inicio sin conexión

- **Instalación:** `manifest.webmanifest`, iconos SVG escalables con tamaños declarados 192×192 y 512×512, y el botón «Instalar» ofrecen la opción nativa cuando el navegador la admite, con instrucciones manuales para otros navegadores. Los PNG de respaldo siguen siendo una mejora de compatibilidad pendiente.
- **Shell local:** `service-worker.js` guarda archivos estáticos de NEXO y vuelve a `index.html` cuando se navega sin conexión. La caché no almacena respuestas de API, tokens ni datos personales.
- **Interfaz adaptable:** `pwa.js` muestra instrucciones específicas para iOS, Android y escritorio y explica qué partes necesitan internet.
- **Límite:** la primera visita requiere conexión y HTTPS. El offline no convierte en locales Supabase, OAuth, noticias ni Compañero de Ruta. No se incluyen push notifications ni sincronización cloud offline.
- **Guía y pruebas:** ver `PHASE-3-IMPLEMENTATION.md` y la sección PWA del `RELEASE-CHECKLIST.md`.


## Fase 4 — conexión de Supabase y pruebas de Comunidad

- La pantalla Comunidad incluye **Comprobar conexión** una vez iniciada la sesión. Valida la sesión con el servidor y prueba la RPC `get_discovery_wall`; los resultados explican si hay que revisar la migración SQL.
- El diagnóstico en el navegador no demuestra que todas las políticas estén bien ni que Realtime funcione entre cuentas. Ejecutá `supabase/phase4-verify.sql` en SQL Editor después de las fases 1 y 2, y seguí `PHASE-4-IMPLEMENTATION.md`.
- La conexión real sigue dependiendo de un proyecto Supabase, la URL HTTPS, una publishable key, OAuth/redirects, políticas Realtime privadas y pruebas con dos cuentas distintas. Nunca uses `service_role` en el navegador.


## Fase 5 — copia personal privada en la nube

- Ajustes incorpora una copia personal manual en Supabase. Es opt-in: la casilla empieza apagada y no hay carga ni descarga automática.
- La copia incluye el estado de NEXO y una lista explícita de registros locales compatibles. Puede contener notas personales y de bienestar; activala sólo si entendés que esos datos se almacenarán en tu proyecto privado.
- El almacenamiento usa `nexo_user_snapshots` y RPC autenticadas con RLS, sin acceso directo de la app a la tabla. Las escrituras usan versiones optimistas para detener y mostrar conflictos, no resolverlos silenciosamente.
- Antes de usar: ejecutar `supabase/phase5-sync.sql` después de los esquemas de fases 1 y 2, revisar con `supabase/phase5-verify.sql`, configurar `community-config.js` y autenticarte desde Comunidad. Guía: `PHASE-5-IMPLEMENTATION.md`.
- No reemplaza un backup exportado: exportá JSON antes de restaurar. La sincronización no combina datos; elegir subir o restaurar reemplaza la copia completa correspondiente.
