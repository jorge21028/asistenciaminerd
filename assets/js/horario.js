const DIAS_HORARIO = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
const NOMBRE_DIA = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes' };
const MESES_LARGO = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const DIAS_LARGO = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];

let bloquesHorario = [];
let bloquesClaseOrdenados = [];
let asignaciones = {}; // "dia:bloqueId" => registro
let usuarioActual = null;
let profesorMostrado = null;

// ---------------------------------------------------------------------
// Utilidades de tiempo
// ---------------------------------------------------------------------
function parseHoraMin(hhmmss) {
    const [h, m] = hhmmss.split(':').map(Number);
    return h * 60 + m;
}
function parseHoraSeg(hhmmss) {
    const [h, m, s] = hhmmss.split(':').map(Number);
    return h * 3600 + m * 60 + (s || 0);
}
function diaJsANombre(jsDay) {
    // JS: 0=domingo ... 6=sábado
    if (jsDay === 0 || jsDay === 6) return null;
    return DIAS_HORARIO[jsDay - 1];
}
function formatoCuentaAtras(segundos) {
    segundos = Math.max(0, segundos);
    const h = Math.floor(segundos / 3600);
    const m = Math.floor((segundos % 3600) / 60);
    const s = segundos % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

// Color consistente por nombre de asignatura (paleta pastel derivada del texto)
function colorAsignatura(nombre) {
    let hash = 0;
    for (let i = 0; i < nombre.length; i++) hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
    const hue = Math.abs(hash) % 360;
    return {
        bg: `hsl(${hue}, 62%, 93%)`,
        border: `hsl(${hue}, 45%, 62%)`,
        texto: `hsl(${hue}, 55%, 28%)`,
    };
}

// ---------------------------------------------------------------------
// Carga inicial
// ---------------------------------------------------------------------
async function inicializarHorario() {
    usuarioActual = Auth.getUsuario();

    if (usuarioActual.rol === 'admin') {
        document.getElementById('selectorProfesorWrap').style.display = 'block';
        try {
            const usuarios = await apiFetch('usuarios.php');
            const profesores = usuarios.filter(u => u.activo == 1);
            const select = document.getElementById('selectorProfesor');
            select.innerHTML = profesores.map(p => `<option value="${p.id}">${escaparHtml(p.nombre)}</option>`).join('');
            const idsProfesores = profesores.map(p => String(p.id));
            select.value = idsProfesores.includes(String(usuarioActual.id)) ? usuarioActual.id : (profesores[0] ? profesores[0].id : '');
            select.addEventListener('change', () => cargarHorario(select.value));
            if (profesores.length) cargarHorario(select.value || profesores[0].id);
        } catch (err) {
            mostrarAlerta('alertaHorarioVista', err.message);
        }
    } else {
        cargarHorario(usuarioActual.id);
    }

    actualizarRelojFecha();
    setInterval(actualizarRelojFecha, 1000);
    setInterval(actualizarEstadoActual, 1000);
}

async function cargarHorario(profesorId) {
    try {
        const data = await apiFetch(`horario.php?profesor_id=${profesorId}`);
        profesorMostrado = data.profesor;
        bloquesHorario = data.bloques;
        bloquesClaseOrdenados = bloquesHorario.filter(b => b.tipo === 'clase');

        asignaciones = {};
        data.asignaciones.forEach(a => { asignaciones[`${a.dia}:${a.bloque_id}`] = a; });

        document.getElementById('nombreProfesorHorario').textContent = profesorMostrado.nombre;
        document.getElementById('fechaActualizacion').textContent =
            'Datos actualizados: ' + new Date().toLocaleString('es-DO');

        pintarCargaHoraria();
        pintarGrid();
        pintarResumen();
        actualizarEstadoActual();
    } catch (err) {
        mostrarAlerta('alertaHorarioVista', err.message);
    }
}

// ---------------------------------------------------------------------
// Reloj / fecha
// ---------------------------------------------------------------------
function actualizarRelojFecha() {
    const ahora = new Date();
    const diaTexto = DIAS_LARGO[ahora.getDay()];
    const mesTexto = MESES_LARGO[ahora.getMonth()];
    document.getElementById('fechaActual').textContent =
        `${capitalizar(diaTexto)}, ${ahora.getDate()} de ${mesTexto}`;
    document.getElementById('horaActual').textContent =
        ahora.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function capitalizar(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ---------------------------------------------------------------------
// Carga horaria (chips del encabezado)
// ---------------------------------------------------------------------
function pintarCargaHoraria() {
    const claseTotal = Object.values(asignaciones).filter(a => a.tipo_asignacion === 'clase').length;
    const ahora = new Date();
    const diaHoy = diaJsANombre(ahora.getDay());
    const claseHoy = diaHoy
        ? Object.values(asignaciones).filter(a => a.tipo_asignacion === 'clase' && a.dia === diaHoy).length
        : 0;

    document.getElementById('cargaSemanal').textContent = `${claseTotal} horas`;
    document.getElementById('cargaDiaria').textContent = diaHoy ? `${claseHoy} horas` : 'Fin de semana';
}

// ---------------------------------------------------------------------
// Determinar bloque/estado actual y próximo
// ---------------------------------------------------------------------
function obtenerEstadoActual() {
    const ahora = new Date();
    const diaHoy = diaJsANombre(ahora.getDay());
    const minAhora = ahora.getHours() * 60 + ahora.getMinutes();

    if (!diaHoy) return { tipo: 'fin_de_semana' };

    const bloqueActual = bloquesHorario.find(b =>
        minAhora >= parseHoraMin(b.hora_inicio) && minAhora < parseHoraMin(b.hora_fin)
    );

    if (!bloqueActual) return { tipo: 'sin_clase', dia: diaHoy };
    if (bloqueActual.tipo === 'receso') return { tipo: 'receso', bloque: bloqueActual, dia: diaHoy };
    if (bloqueActual.tipo === 'almuerzo') return { tipo: 'almuerzo', bloque: bloqueActual, dia: diaHoy };

    const asign = asignaciones[`${diaHoy}:${bloqueActual.id}`];
    if (!asign) return { tipo: 'sin_clase', bloque: bloqueActual, dia: diaHoy };
    if (asign.tipo_asignacion === 'pedagogica') return { tipo: 'pedagogica', bloque: bloqueActual, dia: diaHoy, asignacion: asign };
    return { tipo: 'clase', bloque: bloqueActual, dia: diaHoy, asignacion: asign };
}

function obtenerProximoBloque() {
    const ahora = new Date();
    const idxHoy = DIAS_HORARIO.indexOf(diaJsANombre(ahora.getDay()));
    const minAhora = ahora.getHours() * 60 + ahora.getMinutes();

    for (let offset = 0; offset <= 5; offset++) {
        const idx = idxHoy === -1 ? offset % 5 : (idxHoy + offset) % 5;
        const dia = DIAS_HORARIO[idx];
        const esHoy = offset === 0 && idxHoy !== -1;

        for (const b of bloquesClaseOrdenados) {
            if (esHoy && parseHoraMin(b.hora_inicio) <= minAhora) continue;
            const asign = asignaciones[`${dia}:${b.id}`];
            if (asign) return { dia, bloque: b, asignacion: asign };
        }
    }
    return null;
}

// ---------------------------------------------------------------------
// Pintar temporizador + tarjetas de estado
// ---------------------------------------------------------------------
function actualizarEstadoActual() {
    if (!bloquesHorario.length) return;

    const estado = obtenerEstadoActual();
    const chipTexto = document.getElementById('temporizadorTexto');
    const chipCuenta = document.getElementById('temporizadorCuenta');
    const cardActual = document.getElementById('cardClaseActual');
    const contActual = document.getElementById('contenidoClaseActual');

    cardActual.classList.remove('en-curso', 'es-receso', 'es-almuerzo');

    if (estado.tipo === 'fin_de_semana') {
        chipTexto.textContent = 'Fin de semana';
        chipCuenta.textContent = '';
        contActual.innerHTML = `<p class="estado-vacio">Actualmente no tienes clases (fin de semana).</p>`;
    } else if (estado.tipo === 'sin_clase') {
        chipTexto.textContent = 'Sin clases';
        chipCuenta.textContent = '';
        contActual.innerHTML = `<p class="estado-vacio">Actualmente no tienes clases.</p>`;
    } else if (estado.tipo === 'receso') {
        const seg = parseHoraSeg(estado.bloque.hora_fin) - segundosAhora();
        chipTexto.textContent = 'Recreo';
        chipCuenta.textContent = `Termina en ${formatoCuentaAtras(seg)}`;
        cardActual.classList.add('es-receso');
        contActual.innerHTML = `
            <p class="estado-asignatura">☕ Recreo</p>
            <p class="estado-detalle">Finaliza a las ${formatoHora12(estado.bloque.hora_fin)}</p>`;
    } else if (estado.tipo === 'almuerzo') {
        const seg = parseHoraSeg(estado.bloque.hora_fin) - segundosAhora();
        chipTexto.textContent = 'Almuerzo';
        chipCuenta.textContent = `Termina en ${formatoCuentaAtras(seg)}`;
        cardActual.classList.add('es-almuerzo');
        contActual.innerHTML = `
            <p class="estado-asignatura">🍽️ Almuerzo</p>
            <p class="estado-detalle">Finaliza a las ${formatoHora12(estado.bloque.hora_fin)}</p>`;
    } else if (estado.tipo === 'pedagogica') {
        const seg = parseHoraSeg(estado.bloque.hora_fin) - segundosAhora();
        chipTexto.textContent = 'Hora pedagógica';
        chipCuenta.textContent = `Termina en ${formatoCuentaAtras(seg)}`;
        cardActual.classList.add('en-curso');
        contActual.innerHTML = `
            <span class="badge-ahora">AHORA</span>
            <p class="estado-asignatura">📝 Hora pedagógica</p>
            <p class="estado-detalle">${NOMBRE_DIA[estado.dia]} · ${estado.bloque.nombre}</p>
            <p class="estado-detalle">Finaliza a las ${formatoHora12(estado.bloque.hora_fin)}</p>`;
    } else if (estado.tipo === 'clase') {
        const seg = parseHoraSeg(estado.bloque.hora_fin) - segundosAhora();
        const a = estado.asignacion;
        chipTexto.textContent = `${a.asignatura_nombre} · ${a.curso_nombre}`;
        chipCuenta.textContent = `Termina en ${formatoCuentaAtras(seg)}`;
        cardActual.classList.add('en-curso');
        contActual.innerHTML = `
            <span class="badge-ahora">AHORA</span>
            <p class="estado-asignatura">Ahora: ${escaparHtml(a.asignatura_nombre)} — ${escaparHtml(a.curso_nombre)}</p>
            <p class="estado-detalle">${NOMBRE_DIA[estado.dia]} · ${estado.bloque.nombre} (${formatoHora12(estado.bloque.hora_inicio)} – ${formatoHora12(estado.bloque.hora_fin)})</p>
            <p class="estado-detalle">Finaliza a las ${formatoHora12(estado.bloque.hora_fin)}</p>`;
    }

    // Próxima clase
    const proximo = obtenerProximoBloque();
    const contProxima = document.getElementById('contenidoProximaClase');
    if (!proximo) {
        contProxima.innerHTML = `<p class="estado-vacio">No hay más clases programadas.</p>`;
    } else {
        const a = proximo.asignacion;
        const esPedagogica = a.tipo_asignacion === 'pedagogica';
        contProxima.innerHTML = `
            <p class="estado-asignatura">${esPedagogica ? '📝 Hora pedagógica' : escaparHtml(a.asignatura_nombre) + ' — ' + escaparHtml(a.curso_nombre)}</p>
            <p class="estado-detalle">${NOMBRE_DIA[proximo.dia]} · ${proximo.bloque.nombre}</p>
            <p class="estado-detalle">Empieza a las ${formatoHora12(proximo.bloque.hora_inicio)}</p>`;
    }

    // Resaltar la celda "ahora" en la grilla
    document.querySelectorAll('.celda-ahora').forEach(el => el.classList.remove('celda-ahora'));
    if (estado.bloque && estado.dia) {
        const celda = document.querySelector(`[data-celda="${estado.dia}:${estado.bloque.id}"]`);
        if (celda) celda.classList.add('celda-ahora');
    }
}

function segundosAhora() {
    const a = new Date();
    return a.getHours() * 3600 + a.getMinutes() * 60 + a.getSeconds();
}

function formatoHora12(hhmmss) {
    let [h, m] = hhmmss.split(':').map(Number);
    const sufijo = h >= 12 ? 'PM' : 'AM';
    h = h % 12; if (h === 0) h = 12;
    return `${h}:${String(m).padStart(2, '0')} ${sufijo}`;
}

// ---------------------------------------------------------------------
// Grilla semanal
// ---------------------------------------------------------------------
function pintarGrid() {
    const tabla = document.getElementById('tablaHorarioGrid');

    const thead = '<thead><tr><th></th>' + bloquesHorario.map(b => `
        <th>${escaparHtml(b.nombre)}<br><span style="font-weight:400; font-size:0.68rem;">${formatoHora12(b.hora_inicio)}–${formatoHora12(b.hora_fin)}</span></th>
    `).join('') + '</tr></thead>';

    const tbody = '<tbody>' + DIAS_HORARIO.map(dia => {
        const celdas = bloquesHorario.map(b => {
            if (b.tipo !== 'clase') {
                const icono = b.tipo === 'receso' ? '☕' : '🍽️';
                return `<td><div class="clase-card separador">${icono} ${escaparHtml(b.nombre)}</div></td>`;
            }
            const a = asignaciones[`${dia}:${b.id}`];
            if (!a) {
                return `<td><div class="clase-card vacia" data-celda="${dia}:${b.id}">—</div></td>`;
            }
            if (a.tipo_asignacion === 'pedagogica') {
                return `<td><div class="clase-card pedagogica" data-celda="${dia}:${b.id}"><span class="materia">📝 Pedagógica</span></div></td>`;
            }
            const color = colorAsignatura(a.asignatura_nombre);
            return `<td><div class="clase-card" data-celda="${dia}:${b.id}" style="background:${color.bg}; border-color:${color.border}; color:${color.texto};">
                        <span class="materia">${escaparHtml(a.asignatura_nombre)}</span>
                        <span class="curso">${escaparHtml(a.curso_nombre)}</span>
                    </div></td>`;
        }).join('');
        return `<tr><td class="celda-dia">${NOMBRE_DIA[dia]}</td>${celdas}</tr>`;
    }).join('') + '</tbody>';

    tabla.innerHTML = thead + tbody;
}

// ---------------------------------------------------------------------
// Resumen semanal
// ---------------------------------------------------------------------
function pintarResumen() {
    const clases = Object.values(asignaciones).filter(a => a.tipo_asignacion === 'clase');
    const pedagogicas = Object.values(asignaciones).filter(a => a.tipo_asignacion === 'pedagogica');
    const diasConDatos = new Set(Object.values(asignaciones).map(a => a.dia)).size;
    const gruposUnicos = new Set(clases.map(a => `${a.curso_id}:${a.asignatura_id}`)).size;

    document.getElementById('statsGrid').innerHTML = `
        <div class="horario-stat-tile"><span class="numero">${clases.length}</span><span class="etiqueta">Horas de clases</span></div>
        <div class="horario-stat-tile"><span class="numero">${diasConDatos}</span><span class="etiqueta">Días</span></div>
        <div class="horario-stat-tile"><span class="numero">${gruposUnicos}</span><span class="etiqueta">Asignaturas/grupos</span></div>
        <div class="horario-stat-tile"><span class="numero">${pedagogicas.length}</span><span class="etiqueta">Horas pedagógicas</span></div>
    `;

    const conteoPorAsignatura = {};
    clases.forEach(a => { conteoPorAsignatura[a.asignatura_nombre] = (conteoPorAsignatura[a.asignatura_nombre] || 0) + 1; });

    const chips = Object.entries(conteoPorAsignatura)
        .sort((a, b) => b[1] - a[1])
        .map(([nombre, cantidad]) => {
            const color = colorAsignatura(nombre);
            return `<span class="chip-asignatura" style="background:${color.bg}; border-color:${color.border}; color:${color.texto};">${escaparHtml(nombre)} — ${cantidad} clase${cantidad === 1 ? '' : 's'}</span>`;
        }).join('');

    document.getElementById('resumenAsignaturas').innerHTML = chips || '<p class="estado-vacio">Este profesor todavía no tiene clases asignadas.</p>';
}

inicializarHorario();
