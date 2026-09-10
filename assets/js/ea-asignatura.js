/**
 * ea-asignatura.js — "Mis creaciones" + "Actividades asignadas" de una
 * asignatura, dentro del Espacio Académico del estudiante.
 */
const paramsEA = new URLSearchParams(window.location.search);
const asignaturaIdEA = paramsEA.get('asignatura_id');
const nombreAsignaturaEA = paramsEA.get('nombre') || 'Asignatura';

if (window.__sesionEAValida) {
    if (!asignaturaIdEA) {
        window.location.href = rutaBase('espacio-academico.html');
    } else {
        document.getElementById('tituloAsignatura').textContent = nombreAsignaturaEA;
        document.addEventListener('DOMContentLoaded', () => {
            cargarHerramientas();
            cargarCreaciones();
            cargarActividades();
        });
    }
}

const ETIQUETAS_ESTADO = {
    borrador: 'Borrador',
    entregado: 'Entregado',
    devuelto: 'Devuelto para corrección',
};

async function cargarHerramientas() {
    try {
        const herramientas = await apiFetchEA('ea_herramientas.php');
        const select = document.getElementById('herramientaCreacion');
        select.innerHTML = herramientas.map(h => `<option value="${h.id}">${escaparHtml(h.nombre)}</option>`).join('');
    } catch (err) {
        mostrarAlerta('alertaAsignaturaEA', err.message);
    }
}

async function cargarCreaciones() {
    const lista = document.getElementById('listaCreaciones');
    const vacio = document.getElementById('vacioCreaciones');
    try {
        const creaciones = await apiFetchEA(`ea_creaciones.php?asignatura_id=${asignaturaIdEA}`);
        if (!creaciones.length) {
            lista.innerHTML = '';
            vacio.classList.remove('is-hidden');
            return;
        }
        vacio.classList.add('is-hidden');
        lista.innerHTML = creaciones.map(c => `
            <div class="fila-form" style="align-items:center; border-top:1px solid var(--color-line); padding-top:10px; margin-top:10px;">
                <div style="flex:1;">
                    <strong>${escaparHtml(c.titulo)}</strong><br>
                    <span class="subtitulo">${escaparHtml(c.herramienta_nombre)}${c.actividad_nombre ? ' · ' + escaparHtml(c.actividad_nombre) : ' · Creación personal'}</span>
                </div>
                <span class="badge">${ETIQUETAS_ESTADO[c.estado] || c.estado}</span>
            </div>
        `).join('');
    } catch (err) {
        mostrarAlerta('alertaAsignaturaEA', err.message);
    }
}

async function cargarActividades() {
    const lista = document.getElementById('listaActividades');
    const vacio = document.getElementById('vacioActividades');
    try {
        const actividades = await apiFetchEA(`ea_actividades.php?asignatura_id=${asignaturaIdEA}`);
        if (!actividades.length) {
            lista.innerHTML = '';
            vacio.classList.remove('is-hidden');
            return;
        }
        vacio.classList.add('is-hidden');
        lista.innerHTML = actividades.map(a => `
            <div class="fila-form" style="align-items:center; border-top:1px solid var(--color-line); padding-top:10px; margin-top:10px;">
                <div style="flex:1;">
                    <strong>${escaparHtml(a.nombre)}</strong><br>
                    <span class="subtitulo">${escaparHtml(a.herramienta_nombre || 'Sin herramienta definida')}${a.fecha_limite ? ' · Fecha límite: ' + new Date(a.fecha_limite).toLocaleDateString() : ''}</span>
                </div>
                <span class="badge">${a.estado_entrega ? (ETIQUETAS_ESTADO[a.estado_entrega] || a.estado_entrega) : 'Pendiente'}</span>
            </div>
        `).join('');
    } catch (err) {
        mostrarAlerta('alertaAsignaturaEA', err.message);
    }
}

document.getElementById('btnNuevaCreacion').addEventListener('click', () => {
    document.getElementById('formNuevaCreacion').classList.remove('is-hidden');
});
document.getElementById('btnCancelarCreacion').addEventListener('click', () => {
    document.getElementById('formNuevaCreacion').classList.add('is-hidden');
    document.getElementById('tituloCreacion').value = '';
});

document.getElementById('btnGuardarCreacion').addEventListener('click', async () => {
    const titulo = document.getElementById('tituloCreacion').value.trim();
    const herramientaId = document.getElementById('herramientaCreacion').value;
    if (!titulo) {
        mostrarAlerta('alertaAsignaturaEA', 'Escribe un título para tu creación.');
        return;
    }
    const btn = document.getElementById('btnGuardarCreacion');
    btn.disabled = true;
    try {
        await apiFetchEA('ea_creaciones.php', {
            method: 'POST',
            body: {
                asignatura_id: asignaturaIdEA,
                herramienta_id: herramientaId,
                titulo,
                contenido: null,
            },
        });
        document.getElementById('formNuevaCreacion').classList.add('is-hidden');
        document.getElementById('tituloCreacion').value = '';
        mostrarAlerta('alertaAsignaturaEA', 'Creación guardada. El editor para trabajar en ella se habilitará en una próxima fase.', 'exito');
        cargarCreaciones();
    } catch (err) {
        mostrarAlerta('alertaAsignaturaEA', err.message);
    } finally {
        btn.disabled = false;
    }
});
