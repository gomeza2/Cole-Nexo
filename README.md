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
