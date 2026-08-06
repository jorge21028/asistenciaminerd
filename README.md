# Sistema de Asistencia — MINERD (Módulo de Asistencia)

Módulo de asistencia diaria por curso y asignatura, con reportes diario, semanal, mensual y anual.
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
