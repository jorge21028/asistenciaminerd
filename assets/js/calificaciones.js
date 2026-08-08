const TEXTO_TIPO = {
    taller: 'Taller: cada actividad pertenece a un período. La nota del período es el promedio de sus actividades, y la del año es el promedio de los períodos.',
    tecnico: 'Técnico-profesional: cada actividad pertenece a un RA. El RA suma los puntos de sus actividades hasta su valor asignado; el período suma los RA que le pertenecen.',
    academica: 'Académica: cada actividad tiene una rúbrica con criterios de evaluación, que pueden evidenciar una o varias competencias específicas.',
};

let combosCalificaciones = [];
let mapaAsignaturas = {};
let actividades = [];

async function inicializar() {
    try {
        const [combos, asignaturas] = await Promise.all([
            apiFetch('asignaciones.php'),
            apiFetch('asignaturas.php'),
        ]);
        combosCalificaciones = combos;
        asignaturas.forEach(a => { mapaAsignaturas[a.id] = a; });

        document.getElementById('cursoAsignatura').innerHTML =
            '<option value="">Selecciona…</option>' +
            combos.map(c => `<option value="${c.curso_id}:${c.asignatura_id}">${escaparHtml(c.curso_nombre)} — ${escaparHtml(c.asignatura_nombre)}</option>`).join('');
    } catch (err) {
        mostrarAlerta('alertaCalificaciones', err.message);
    }
}

function comboActual() {
    const valor = document.getElementById('cursoAsignatura').value;
    if (!valor) return null;
    const [cursoId, asignaturaId] = valor.split(':');
    return { cursoId, asignaturaId, asignatura: mapaAsignaturas[asignaturaId] };
}

async function cargarActividades() {
    const combo = comboActual();
    const infoTipo = document.getElementById('infoTipo');

    if (!combo) {
        infoTipo.style.display = 'none';
        document.getElementById('tablaActividades').innerHTML = '';
        document.getElementById('estadoVacio').style.display = 'none';
        return;
    }

    infoTipo.style.display = 'block';
    document.getElementById('textoInfoTipo').textContent = TEXTO_TIPO[combo.asignatura.tipo] || '';

    document.getElementById('btnNuevaActividad').href = `${rutaBase('calificaciones-nueva.html')}?curso_id=${combo.cursoId}&asignatura_id=${combo.asignaturaId}`;
    document.getElementById('btnVerReportes').href = `${rutaBase('calificaciones-reportes.html')}?curso_id=${combo.cursoId}&asignatura_id=${combo.asignaturaId}`;

    try {
        actividades = await apiFetch(`calif_actividades.php?curso_id=${combo.cursoId}&asignatura_id=${combo.asignaturaId}`);
        pintarActividades();
    } catch (err) {
        mostrarAlerta('alertaCalificaciones', err.message);
    }
}

function referenciaActividad(a) {
    if (a.periodo_nombre && a.unidad_titulo) return `${a.unidad_codigo ? a.unidad_codigo + ': ' : ''}${a.unidad_titulo}`;
    if (a.unidad_titulo) return `${a.unidad_codigo ? a.unidad_codigo + ': ' : ''}${a.unidad_titulo}`;
    if (a.periodo_nombre) return a.periodo_nombre;
    return '—';
}

function pintarActividades() {
    const tbody = document.getElementById('tablaActividades');
    document.getElementById('estadoVacio').style.display = actividades.length ? 'none' : 'block';
    tbody.innerHTML = actividades.map(a => `
        <tr>
            <td><strong>${escaparHtml(a.nombre)}</strong></td>
            <td>${escaparHtml(referenciaActividad(a))}</td>
            <td class="num">${a.valor_maximo}</td>
            <td>${new Date(a.created_at).toLocaleDateString('es-DO')}</td>
            <td class="acciones-tabla">
                <a class="btn secundario chico" href="${rutaBase('calificaciones-calificar.html')}?id=${a.id}">Calificar</a>
                <a class="btn secundario chico" href="${rutaBase('calificaciones-reportes.html')}?curso_id=${a.curso_id}&asignatura_id=${a.asignatura_id}&tipo=actividad&actividad_id=${a.id}">Reporte</a>
                <button class="btn peligro chico" onclick="eliminarActividad(${a.id})">Eliminar</button>
            </td>
        </tr>
    `).join('');
}

async function eliminarActividad(id) {
    if (!confirm('¿Eliminar esta actividad? También se borrarán todas las calificaciones asociadas.')) return;
    try {
        await apiFetch(`calif_actividades.php?id=${id}`, { method: 'DELETE' });
        cargarActividades();
    } catch (err) {
        mostrarAlerta('alertaCalificaciones', err.message);
    }
}
window.eliminarActividad = eliminarActividad;

document.getElementById('cursoAsignatura').addEventListener('change', cargarActividades);

inicializar();
