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
2. Cada profesor entra, va a **"Tomar asistencia"**, elige su curso/asignatura y la fecha, marca **P / A / T / E** por estudiante y guarda.
3. Cualquiera con acceso puede ir a **"Reportes"** y ver el reporte diario, semanal, mensual o anual de ese curso/asignatura.

### Regla de cálculo de asistencia
- **Días trabajados** de un periodo = cantidad de fechas distintas en las que se registró asistencia para ese curso+asignatura (se calcula solo, no hay que definir un calendario aparte).
- **2 excusas = 1 inasistencia** y **2 tardanzas = 1 inasistencia** (ambas reglas se aplican de forma independiente y se suman).
- **Total de asistencia** = días trabajados − inasistencias (incluyendo las equivalentes por excusas/tardanzas).
- **Porcentaje** = (total de asistencia ÷ días trabajados) × 100.

### Reporte mensual (tabla solicitada)
Muestra: mes y días trabajados en el encabezado, y por cada estudiante una fila con su estado (P/A/T/E) día por día, el total de días trabajados, el total de asistencia y el porcentaje — tal como se pidió.

---

## Seguridad — antes de usarlo en producción

- Cambia `JWT_SECRET` y `SETUP_KEY` por valores únicos y largos.
- Borra `api/setup.php` después de crear tu(s) administrador(es).
- No subas `api/config.php` con tus contraseñas reales a un repositorio público de GitHub. Si vas a versionar la API en GitHub, considera mantenerla en un repositorio **privado** separado, o usar un `config.php` de ejemplo (`config.example.php`) y mantener el real solo en el servidor.
- Cambia la contraseña del usuario administrador con frecuencia desde la sección "Usuarios".

---

## Próximos módulos (roadmap sugerido)

Este módulo quedó pensado para integrarse a un sistema académico más grande: la tabla
`usuarios` y el sistema de tokens ya pueden reutilizarse para un módulo de **calificaciones**,
**horarios**, **conducta**, etc. Cuando quieras seguir construyendo, lo ideal es mantener
la misma API en Hostinger y solo ir agregando nuevos archivos PHP (`calificaciones.php`,
etc.) y nuevas tablas en la base de datos, reutilizando `cursos`, `asignaturas`,
`estudiantes` y `usuarios`.
