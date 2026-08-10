# Sistema de Gestión Docente

Plataforma modular de gestión académica y administrativa para centros educativos dominicanos (MINERD), organizada por módulos: Asistencia, Calificaciones, Horario, Conducta, Dinámica de Clase, Estudiantes, Asignaciones, Reportes y Configuración.

El primer módulo construido fue Asistencia — lo demás se fue agregando sobre la misma base.
Pensado como el primer módulo de un sistema académico más grande.

**Arquitectura:**
- **Frontend:** HTML/CSS/JS + Jekyll → GitHub Pages
- **Backend (API):** PHP → Hostinger
- **Base de datos:** MySQL → Hostinger

El frontend estático (GitHub Pages) no puede hablar directo con MySQL, así que toda la
comunicación pasa por la API en PHP alojada en tu cuenta de Hostinger.

---

## 1. Crear la base de datos en Hostinger

1. Entra a **hPanel → Bases de datos → Bases de datos MySQL**.
2. Crea una base de datos (ej. `u123456789_asistencia`) y un usuario con su contraseña. Anota los 3 datos: nombre de la base, usuario y contraseña.
3. Ve a **phpMyAdmin**, selecciona la base de datos, entra a la pestaña **SQL** y pega/ejecuta todo el contenido de [`database/schema.sql`](database/schema.sql).

## 2. Subir la API a Hostinger

1. Entra a **hPanel → Archivos → Administrador de archivos**, ve a `public_html` (o a la carpeta de tu dominio/subdominio).
2. Sube toda la carpeta **`api/`** de este proyecto a esa ubicación (ej. `public_html/api/`).
3. Abre `api/config.php` y edita:
   - `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS` → los datos del paso 1.
   - `JWT_SECRET` → una cadena larga y aleatoria, solo tú la debes conocer.
   - `SETUP_KEY` → otra clave temporal, solo para crear el primer usuario admin.
   - `ALLOWED_ORIGINS` → la URL donde vas a publicar el frontend en GitHub Pages (ej. `https://tuusuario.github.io`).
4. Verifica que tu plan de Hostinger tenga **PHP 8.x** habilitado (hPanel → Sitios web → Configuración de PHP) y la extensión **PDO MySQL** activa (viene activa por defecto).

## 3. Crear tu usuario administrador

Con la API ya subida y `config.php` editado, visita **una sola vez** en el navegador
(cambia los valores por los tuyos):

```
https://tu-dominio.com/api/setup.php?key=TU_SETUP_KEY&nombre=Tu+Nombre&email=tu@correo.com&password=UnaClaveSegura123
```

Si todo sale bien verás un mensaje de éxito. **Después borra el archivo `api/setup.php`
del servidor** (ya no lo necesitas y es un punto de riesgo si se queda ahí).

## 4. Publicar el frontend en GitHub Pages

1. Crea un repositorio en GitHub y sube todo el contenido de este proyecto **excepto** la carpeta `api/` y `database/` (esos van solo en Hostinger). Puedes dejarlos en el repo si quieres tener todo en un solo lugar — GitHub Pages simplemente no los va a "ejecutar", pero igual es buena práctica mantenerlos como referencia/backup de tu código fuente.
2. Edita `_config.yml`:
   - `api_url`: la URL de tu API en Hostinger, ej. `https://tu-dominio.com/api`.
   - `baseurl`: déjalo vacío si usarás un dominio propio o `usuario.github.io`; si tu sitio queda en `https://usuario.github.io/nombre-repo`, pon `"/nombre-repo"`.
3. En GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, elige la rama y la carpeta `/ (root)`.
4. Espera unos minutos y tu sitio estará disponible en la URL que GitHub te indique.

### Probar en tu computadora antes de publicar (opcional)

```bash
bundle install
bundle exec jekyll serve
```

Abre `http://localhost:4000`. Asegúrate de que `http://localhost:4000` esté en `ALLOWED_ORIGINS`
dentro de `api/config.php` mientras pruebas localmente.

---

## Cómo funciona el sistema

### Roles
- **Administrador/director:** gestiona usuarios, cursos, asignaturas, estudiantes y asignaciones (qué profesor da qué asignatura en qué curso). Ve todos los reportes.
- **Profesor:** solo ve y pasa asistencia en los cursos/asignaturas que el admin le haya asignado (sección "Asignaciones").

### Flujo normal de uso
1. El admin crea **cursos** (grado + sección), **asignaturas**, matricula **estudiantes** por curso, crea **usuarios** (profesores) y los **asigna** a curso+asignatura.
2. Al iniciar sesión, todos llegan primero a **`portal.html`** — la página principal del sistema, con una tarjeta por cada módulo (por ahora solo "Asistencia" está activo; los demás son marcadores de posición para cuando se construyan).
3. Al entrar al módulo de Asistencia, cada profesor va a **"Tomar asistencia"**, elige su curso/asignatura y la fecha, marca **P / A / T / E** por estudiante y guarda.
4. Cualquiera con acceso puede ir a **"Reportes"** y ver el reporte diario, semanal, mensual o anual de ese curso/asignatura.

### Regla de cálculo de asistencia
- **Días trabajados** de un periodo = cantidad de fechas distintas en las que se registró asistencia para ese curso+asignatura (se calcula solo, no hay que definir un calendario aparte).
- **2 excusas = 1 inasistencia**, **2 tardanzas = 1 inasistencia**, y **1 excusa + 1 tardanza = 1 inasistencia** (se suman las excusas y tardanzas del periodo y cada 2 cuentan como 1 inasistencia, sin importar la combinación).
- **Total de asistencia** = días trabajados − inasistencias (incluyendo las equivalentes por excusas/tardanzas).
- **Porcentaje** = (total de asistencia ÷ días trabajados) × 100.

### Reporte mensual (tabla solicitada)
Muestra: mes y días trabajados en el encabezado, y por cada estudiante una fila con su estado (P/A/T/E) día por día, el total de días trabajados, el total de asistencia y el porcentaje — tal como se pidió.

---

### Módulo de Horario

Además de la asistencia, el sistema ahora incluye un módulo de **Horario**:

- **Bloques de horario** (`bloques-horario.html`, solo admin): el "campanario" del centro — los bloques de clase y los separadores de receso/almuerzo, con sus horas de inicio y fin. Es el mismo para todo el centro. Viene con 8 bloques de clase + receso + almuerzo precargados; edítalos a las horas reales de tu centro.
- **Asignar horario** (`asignar-horario.html`, solo admin): eliges un profesor y llenas una grilla día × bloque con lo que imparte en cada uno (una combinación curso+asignatura de las que ya tiene en "Asignaciones") o si es una hora pedagógica.
- **Horario** (`horario.html`): el dashboard visual del horario semanal — muestra la clase actual con cuenta regresiva en vivo, la próxima clase, la carga horaria semanal/diaria, la grilla completa de la semana y un resumen de horas por asignatura. Los profesores ven su propio horario; el admin puede elegir de cuál profesor ver el horario.
- Si ya tenías la base de datos creada, ejecuta `database/migracion_horario.sql` en phpMyAdmin para agregar las tablas de este módulo.

Este módulo reutiliza las mismas tablas de `usuarios`, `cursos` y `asignaturas` del módulo de asistencia — no hay que duplicar datos.

### Módulo de Conducta (Gestión de la Convivencia)

Basado fielmente en:
- **Normas del Sistema Educativo Dominicano para la Convivencia Armoniosa en los Centros Educativos Públicos y Privados** (MINERD, Ordenanza 05-2023, en cumplimiento de los Arts. 48-50 de la Ley 136-03).
- **Ley 136-03**, Código para el Sistema de Protección y los Derechos Fundamentales de Niños, Niñas y Adolescentes.
- **Reglamento del Estatuto del Docente** (Arts. 33-35, deberes del personal docente).
- La **Guía Táctica de Convivencia** del centro (Matriz de Triaje Disciplinario, Protocolo de Derivación, Protocolo de Emergencia Docente, estructura del reporte disciplinario).

**Cómo funciona:**
- **Falta leve:** el/la docente la determina y resuelve de inmediato, sin proceso posterior (Art. 31). El formulario de registro pide directamente la medida aplicada, tomada del catálogo del Art. 18.
- **Falta grave / muy grave:** el/la docente NO sanciona por su cuenta — solo documenta el hecho de forma objetiva (qué, cuándo, dónde, testigos, acción inmediata) y el sistema deriva automáticamente el caso a Gestión de Convivencia (graves) o Dirección/Consejo de Disciplina (muy graves), quienes resuelven desde la pantalla de detalle del incidente.
- **Alerta de reincidencia:** si un estudiante acumula 3 o más faltas leves, el sistema avisa que, según el Art. 19-m y la guía del centro, esto puede considerarse una falta grave.
- **Protocolo de Emergencia:** al registrar una falta muy grave, se muestran los 3 pasos (Proteger y Salvaguardar → Aislar y Derivar → Documentación Legal) como recordatorio antes de completar el reporte.
- **Catálogo de medidas restringido a lo permitido por ley:** el catálogo de medidas educativas y disciplinarias (Arts. 18, 20 y 22) **deliberadamente no incluye** ninguna medida prohibida por el Art. 23 (agresión verbal, castigos corporales o colectivos, sanciones económicas, negar recreo/alimentación/baño/examen/acceso) **ni la expulsión**, prohibida en cualquier caso por el Art. 24. Esto es una salvaguarda incorporada al sistema, no solo una recomendación de uso.
- **Expediente de conducta:** el historial completo de faltas de cada estudiante, accesible desde el listado de incidentes o desde "Estudiantes" → "Conducta".
- Si ya tenías la base de datos creada, ejecuta `database/migracion_conducta.sql` en phpMyAdmin.

**Importante — lo que este módulo NO reemplaza:** las Normas MINERD establecen procesos con personas concretas (Equipo de Mediación, Equipo de Gestión, Comité Distrital/Regional de Revisión de Medidas para apelaciones, obligación de escuchar al estudiante, plazos de 48 horas laborables, etc.) que siguen siendo responsabilidad humana. El sistema organiza, documenta y da trazabilidad a esos procesos — no sustituye el criterio profesional del Equipo de Gestión ni los procedimientos de apelación ante el Distrito/Regional educativo. Para casos que puedan constituir delito, el Art. 27 exige remitirlos al Tribunal de Niños, Niñas y Adolescentes; el sistema no gestiona ese trámite.

### Módulo Dinámica de Clase

Un subsistema pensado para alojar herramientas de uso rápido durante la clase en vivo. Por ahora incluye un submódulo:

**Ruleta de Participación** (`ruleta.html`):
- Elige un curso y gira la ruleta para seleccionar estudiantes al azar, sin repetir dentro de la misma ronda.
- Cada giro agrega el estudiante y su turno a una lista ordenada.
- **Guardar estado**: guarda qué estudiantes ya participaron y el orden de turnos, para continuar exactamente donde quedaste en la siguiente clase (por profesor y por curso).
- **Reiniciar**: borra el estado guardado y vuelve a poner a todos los estudiantes disponibles.
- **Ventana de proyección** (`ruleta-proyeccion.html`, botón "Abrir ventana para proyector"): una vista de pantalla completa, con letras grandes, pensada para el segundo monitor conectado al proyector/PDI del aula. Se sincroniza en vivo con la ventana de control (misma animación de giro, mismo resultado) usando `BroadcastChannel`, sin necesidad de recargar ni configurar nada — solo abre esa ventana en la pantalla del proyector y controla todo desde tu laptop.
- Si ya tenías la base de datos creada, ejecuta `database/migracion_dinamica_clase.sql` en phpMyAdmin.

Cuando construyamos más submódulos (generador de grupos, temporizador, etc.), se agregan como tarjetas nuevas en `dinamica-clase.html`, el mismo patrón que ya usa `portal.html` para los módulos principales.

**Actividades** (`actividades.html`):
- Selecciona curso, asignatura y el RA (si es una asignatura técnico-profesional) o Unidad de Aprendizaje (si es académica) — la etiqueta cambia sola según el **tipo** que le hayas asignado a esa asignatura en "Asignaturas". Gestiona el catálogo de RA/Unidades de cada asignatura desde el nuevo menú "RA / Unidades" (solo admin).
- El docente llena: título, valor, Intención Pedagógica/Objetivo, descripción de la actividad, y el tiempo asignado (minutos/segundos).
- **Descargar PDF**: genera un PDF donde todo el contenido es una imagen (no hay texto seleccionable), así que no se puede copiar y pegar directamente el texto. El nombre del archivo incluye la fecha, formato `DD_MM_AAAA_actividad_titulo.pdf` (ej. `25_08_2026_actividad_Diagrama_de_flujo.pdf`). Esto evita el copiado casual hacia una IA u otro documento — no es una protección absoluta (una captura de pantalla + reconocimiento de texto siempre sería posible), y así se lo advierte la propia pantalla al profesor.
- **Proyectar con temporizador**: guarda la actividad y abre una ventana aparte pensada para el segundo monitor/proyector/PDI, con toda la información de la actividad y una cuenta regresiva grande. Los controles de **Iniciar / Pausar / Reiniciar** se manejan siempre desde la pantalla del profesor (ventana de control) y se reflejan al instante en la proyección.
- **Precisión del temporizador**: en vez de restar segundo a segundo (lo cual pierde precisión si el navegador limita la pestaña en segundo plano), el conteo se calcula comparando la hora del sistema contra la hora exacta en que debe terminar. Esto significa que el tiempo mostrado siempre es exacto, sin importar cuántos milisegundos tardó en dispararse cada actualización.
- **Actividades recientes**: la lista de actividades ya usadas para ese curso/asignatura, para volver a cargarlas con un clic sin escribir todo de nuevo.
- Si ya tenías la base de datos creada, ejecuta `database/migracion_actividades.sql` en phpMyAdmin.

**Pantalla de Inicio** (`pantalla-inicio.html`):
- Página de control donde configuras: nombre del centro educativo y su logo (compartidos por todo el centro), y nombre del profesor, asignatura, hora de inicio y el enlace del código QR (datos que se guardan por profesor, con el nombre precargado desde tu sesión).
- El logo se sube como imagen (máx. 2MB) a `api/uploads/` en Hostinger — **asegúrate de que esa carpeta tenga permisos de escritura** (755 o 775) la primera vez que la uses.
- El botón **"Abrir ventana emergente"** abre una segunda ventana para proyectar en la PDI, con botón de pantalla completa incluido ahí mismo. Si cambias algo en la pantalla de control mientras la proyección está abierta, se actualiza sola.
- La proyección muestra: logo y nombre del centro, cuenta regresiva grande hasta la hora de inicio configurada (calculada contra el reloj del sistema, igual que el temporizador de Actividades — no pierde precisión), profesor, asignatura, hora de inicio, un código QR (generado con el servicio público qrserver.com) que enlaza al perfil del docente, y música de fondo de YouTube en bucle.
- La música empieza silenciada automáticamente (necesario para que el navegador permita la reproducción automática) — el botón "Activar sonido" en la esquina la activa con un clic.
- Si ya tenías la base de datos creada, ejecuta `database/migracion_pantalla_inicio.sql` en phpMyAdmin.

### Módulo de Calificaciones

Módulo interno para que el profesor califique sus actividades y saque sus propios reportes — **no reemplaza el sistema oficial de boletines del MINERD**.

**Tres metodologías, una por tipo de asignatura** (se define en "Asignaturas" → campo Tipo):

- **Taller**: cada actividad pertenece directamente a un **período**. La nota del período es el **promedio de los porcentajes** de sus actividades (no se suman puntos, porque cada actividad puede valer distinto). La nota del año es el promedio de los períodos.
- **Técnico-profesional**: cada actividad pertenece a un **RA** (gestiona los RA desde "Asignaturas" → "RA", donde defines su **valor total** y a qué **período** pertenece). El RA suma los puntos obtenidos en sus actividades; el período suma los RA que le pertenecen (puntos, no promedio); el año promedia los períodos.
- **Académica (por competencias)**: cada actividad tiene una **rúbrica** de criterios de evaluación definida por el profesor (no se reparte la nota en partes iguales entre competencias). Cada criterio tiene su propio peso en puntos y puede evidenciar una o varias **competencias específicas** (gestiónalas en "Asignaturas" → "Competencias"). Al elegir un **tipo de actividad** (Exposición, Mapa mental, Lectura, Actividad práctica, Actividad grupal, Debate, Prueba corta, Proyecto, Estudio de caso, Portafolio, Trabajo escrito/Ensayo) se autocompleta una rúbrica sugerida de 5 indicadores, totalmente editable. La nota del período y del año se calculan sobre el total de puntos de las actividades (no sobre las competencias, para no contar la misma evidencia dos veces si un criterio evidencia varias competencias) — las competencias son un reporte diagnóstico aparte (reporte "Por RA / competencia").

**Escala de niveles de dominio** (para calificar cada criterio de la rúbrica): Estratégico (100% del peso) · Autónomo (75%) · Resolutivo (50%) · Receptivo (25%) · No realizada (0%) — corresponde a los Niveles de Dominio de Competencias del Diseño Curricular Dominicano. Todos los criterios empiezan marcados como "Estratégico"; el profesor solo cambia los que correspondan, en una sola pantalla con toda la lista de estudiantes.

**Reportes** (en pantalla y descargables en Excel, con la calificación mínima y máxima del grupo resaltada, y las filas de reprobados marcadas en rojo):
1. Por actividad
2. Por RA o competencia (actividad por actividad, con el valor total)
3. Por período (por RA o competencia, con el valor final del período)
4. Anual (por período, con el promedio del año)

Cada reporte incluye centro educativo, profesor, año escolar, curso, asignatura y período/RA/competencia según corresponda.

**Supuestos que tomé y que puedes pedirme cambiar si no calzan con tu forma de trabajar:**
- La nota mínima aprobatoria es **70%** por defecto, configurable por asignatura.
- Una actividad sin calificar cuenta como **0** en los totales de período/año (no se excluye), como en un libro de calificaciones tradicional.
- En técnico-profesional, el valor máximo del período/RA es el **valor asignado al RA**, no la suma de sus actividades (por si no cuadran exactamente).
- El "profesor" que aparece en los reportes de período/RA/anual es quien genera el reporte (no necesariamente quien creó cada actividad, ya que puede haber varias).

Si ya tenías la base de datos creada, ejecuta `database/migracion_calificaciones.sql` en phpMyAdmin.

## Sistema de Gestión Docente — Fase 1: Año Escolar

Primera fase de la ampliación hacia un Sistema de Gestión Docente completo (ver el análisis y plan de fases que acordamos). Esta fase implementa la gestión del año escolar como base para todo lo demás.

**Qué cambia:**
- Nueva tabla `anios_escolares`: catálogo real de años escolares, con **un año activo** a la vez y la posibilidad de **inhabilitar** años anteriores.
- `cursos` y `periodos_academicos` ahora usan una **referencia (FK)** al año escolar en vez de texto libre — esto ya evitaba en la práctica el problema de cursos con el mismo nombre en años distintos (todo cuelga del `id` del curso, nunca de su nombre), y ahora además queda mejor controlado (sin años escritos de formas distintas por error).
- **Nueva página "Años Escolares"** (menú, solo admin): crear años, marcar cuál es el activo, habilitar/inhabilitar.
- **Cursos** ahora se seleccionan de una lista (no se escriben a mano) y tienen un **profesor guía** opcional (cualquier profesor existente, sin necesidad de un rol nuevo).
- **Filtrado automático por año activo**: al no indicar un año explícito, `cursos.php` y `periodos.php` devuelven solo lo del año escolar activo. Esto significa que **Asistencia, Horario, Conducta, Calificaciones y Dinámica de Clase ya trabajan automáticamente con el año activo sin que tuvieras que tocar ese código** — todas esas pantallas simplemente piden "los cursos" sin especificar año, y ahora reciben los del año activo por defecto.
- Las páginas de gestión (Cursos, Períodos) sí pueden ver todos los años o filtrar por uno específico, para consultar/preparar información histórica o futura.
- **Bloqueo real en el backend** (no solo visual) de modificaciones en años inhabilitados: registrar asistencia, crear incidentes de conducta, crear actividades calificables, matricular/editar estudiantes, y crear/eliminar asignaciones — todo eso se rechaza con error 403 si el curso pertenece a un año inhabilitado.
- El año escolar activo se muestra como una insignia (📅) en la barra superior de todas las páginas.

**Importante — no se perdió ningún dato:** la migración no borra ninguna columna. Los valores de texto que tenías en `cursos.anio_escolar` y `periodos_academicos.anio_escolar` se copiaron a las nuevas tablas/columnas y las columnas originales se renombraron a `anio_escolar_legacy` (siguen ahí, intactas, solo que el sistema ya no las usa).

Si ya tenías la base de datos creada, ejecuta `database/migracion_anio_escolar.sql` en phpMyAdmin.

**Alcance de esta fase:** dejé fuera, a propósito, el bloqueo de años inhabilitados en Horario y en las herramientas de Dinámica de Clase (ruleta, actividades, pantalla de inicio) porque son herramientas de uso en vivo, no registros académicos permanentes — si prefieres que también se restrinjan, lo agrego.

**Próximas fases** (según el plan que aprobaste): rebranding a "Sistema de Gestión Docente" + navegación modular, estudiantes ampliado (tutores, salud, MINERD), asistencia/horario con los nuevos reportes, calificaciones con rúbrica en técnico/taller, generador de grupos, reportes unificados, configuración unificada, y exportar/copiar universal.

## Sistema de Gestión Docente — Fase 2: Rebranding + Navegación Modular

Segunda fase del plan acordado. El sistema ahora se llama **Sistema de Gestión Docente** en todas partes (login, portal, título de pestaña, menús), y la navegación dejó de mostrar siempre la misma lista de ~25 enlaces.

**Qué cambia:**

- **Menú por módulo:** al entrar a cualquier página, el menú superior ahora muestra **solo** los enlaces de ese módulo (ej. dentro de "Conducta" solo ves "Incidentes" y "Registrar falta"), en vez de los enlaces de los otros 9 módulos también. El enlace **"🏠 Portal"** siempre está primero, para volver al inicio en un clic.
- **Indicador de módulo actual:** junto al logo, una etiqueta muestra en qué módulo estás (ej. "Calificaciones"), visible en todo momento.
- **Portal principal reorganizado:** ahora agrupa Asistencia, Calificaciones, Horario, Conducta, Dinámica de Clase, Estudiantes, Asignaciones (admin), Generador de Grupos (próximamente, Fase 6), Reportes y Configuración (admin) — se quitaron las tarjetas de "Boletines" y "Familias" que ya no correspondían (esa información ahora vive dentro del módulo de Reportes, como pediste).
- **Nuevo módulo "Reportes"** (`reportes.html`): reúne los reportes que ya existían (Asistencia, Calificaciones, Conducta) en un solo lugar. Los reportes nuevos (estudiantes, profesores, horarios) se agregan en la Fase 7.
- **Nuevo módulo "Configuración"** (`configuracion.html`, solo admin): reúne Años Escolares, Cursos, Asignaturas, Períodos, Competencias y Usuarios — las tablas maestras que antes estaban sueltas en el menú.
- El reporte de asistencia se renombró de `reportes.html` a **`asistencia-reportes.html`** (para liberar ese nombre para el nuevo hub general de Reportes). Si tenías esa URL guardada en algún enlace externo, actualízala.

**Nada de esto tocó la base de datos ni la API** — es una reorganización de navegación y branding sobre lo que ya funcionaba. Todos los formularios, cálculos y datos siguen exactamente igual.

**Un archivo que debes editar tú mismo:** en `_config.yml`, solo actualicé `title` y `description` — **no toques `api_url`**, esa línea debe seguir teniendo la URL real de tu API en Hostinger, no la copies de este paquete.

## Seguridad — antes de usarlo en producción

- Cambia `JWT_SECRET` y `SETUP_KEY` por valores únicos y largos.
- Borra `api/setup.php` después de crear tu(s) administrador(es).
- No subas `api/config.php` con tus contraseñas reales a un repositorio público de GitHub. Si vas a versionar la API en GitHub, considera mantenerla en un repositorio **privado** separado, o usar un `config.php` de ejemplo (`config.example.php`) y mantener el real solo en el servidor.
- Cambia la contraseña del usuario administrador con frecuencia desde la sección "Usuarios".

---

## Próximos módulos (roadmap sugerido)

Este módulo quedó pensado para integrarse a un sistema académico más grande. Ya existe
**`portal.html`**, la página principal del sistema con una tarjeta por módulo — cuando
construyas el siguiente módulo (ej. Calificaciones), solo hay que:
1. Crear sus propias páginas/JS dentro de este mismo repositorio (o en uno nuevo, según prefieras organizarlo).
2. Agregar sus propios endpoints PHP reutilizando `usuarios`, `cursos`, `asignaturas` y `estudiantes` de esta misma base de datos (así no hay que duplicar profesores, cursos ni estudiantes).
3. Activar su tarjeta en `portal.html` (quitarle la clase `modulo-proximamente` y apuntar el botón "Entrar" a su página principal).

La tabla `usuarios` y el sistema de tokens (JWT) ya pueden reutilizarse tal cual para
cualquier módulo nuevo.
