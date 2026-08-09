let cursos = [];
let aniosDisponibles = [];
let profesoresDisponibles = [];

async function cargarSelects() {
    try {
        const [anios, usuarios] = await Promise.all([
            apiFetch('anios_escolares.php'),
            apiFetch('usuarios.php'),
        ]);
        aniosDisponibles = anios;
        profesoresDisponibles = usuarios.filter(u => u.activo == 1);

        const activo = anios.find(a => a.es_activo == 1);

        document.getElementById('anioEscolar').innerHTML = anios.map(a =>
            `<option value="${a.id}" ${activo && a.id === activo.id ? 'selected' : ''}>${escaparHtml(a.nombre)}${a.es_activo == 1 ? ' (activo)' : ''}</option>`
        ).join('');

        document.getElementById('profesorGuia').innerHTML = '<option value="">— Sin asignar —</option>' +
            profesoresDisponibles.map(p => `<option value="${p.id}">${escaparHtml(p.nombre)}</option>`).join('');

        document.getElementById('filtroAnio').innerHTML = '<option value="">Todos los años</option>' +
            anios.map(a => `<option value="${a.id}">${escaparHtml(a.nombre)}${a.es_activo == 1 ? ' (activo)' : ''}</option>`).join('');
    } catch (err) {
        mostrarAlerta('alertaCurso', err.message);
    }
}

async function cargarCursos() {
    const anioFiltro = document.getElementById('filtroAnio').value;
    try {
        cursos = await apiFetch(anioFiltro ? `cursos.php?anio_escolar_id=${anioFiltro}` : 'cursos.php?todos=1');
        pintarCursos();
    } catch (err) {
        mostrarAlerta('alertaCurso', err.message);
    }
}

function pintarCursos() {
    const tbody = document.getElementById('tablaCursos');
    document.getElementById('estadoVacio').style.display = cursos.length ? 'none' : 'block';
    tbody.innerHTML = cursos.map(c => `
        <tr>
            <td><strong>${escaparHtml(c.nombre)}</strong></td>
            <td>${escaparHtml(c.anio_escolar)} ${c.anio_habilitado == 0 ? '<span class="badge profesor">Inhabilitado</span>' : ''}</td>
            <td>${c.profesor_guia_nombre ? escaparHtml(c.profesor_guia_nombre) : '—'}</td>
            <td class="acciones-tabla">
                <button class="btn secundario chico" onclick="editarCurso(${c.id})">Editar</button>
                <button class="btn peligro chico" onclick="eliminarCurso(${c.id})">Eliminar</button>
            </td>
        </tr>
    `).join('');
}

function editarCurso(id) {
    const c = cursos.find(x => x.id === id);
    if (!c) return;
    document.getElementById('cursoId').value = c.id;
    document.getElementById('grado').value = c.grado;
    document.getElementById('seccion').value = c.seccion;
    document.getElementById('anioEscolar').value = c.anio_escolar_id;
    document.getElementById('profesorGuia').value = c.profesor_guia_id || '';
    document.getElementById('tituloForm').textContent = 'Editar curso';
    document.getElementById('btnCancelar').style.display = 'inline-flex';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelarEdicion() {
    document.getElementById('formCurso').reset();
    document.getElementById('cursoId').value = '';
    document.getElementById('tituloForm').textContent = 'Nuevo curso';
    document.getElementById('btnCancelar').style.display = 'none';
}

async function eliminarCurso(id) {
    if (!confirm('¿Eliminar este curso? Los estudiantes asociados también dejarán de estar disponibles.')) return;
    try {
        await apiFetch(`cursos.php?id=${id}`, { method: 'DELETE' });
        cargarCursos();
    } catch (err) {
        mostrarAlerta('alertaCurso', err.message);
    }
}

document.getElementById('formCurso').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('cursoId').value;
    const body = {
        grado: document.getElementById('grado').value.trim(),
        seccion: document.getElementById('seccion').value.trim(),
        anio_escolar_id: document.getElementById('anioEscolar').value,
        profesor_guia_id: document.getElementById('profesorGuia').value || null,
    };
    try {
        if (id) {
            await apiFetch('cursos.php', { method: 'PUT', body: { id, ...body } });
        } else {
            await apiFetch('cursos.php', { method: 'POST', body });
        }
        cancelarEdicion();
        cargarCursos();
    } catch (err) {
        mostrarAlerta('alertaCurso', err.message);
    }
});

document.getElementById('btnCancelar').addEventListener('click', cancelarEdicion);
document.getElementById('filtroAnio').addEventListener('change', cargarCursos);

cargarSelects().then(cargarCursos);
