let asignaturasDisponibles = [];
let unidadesActuales = [];
let asignaturaSeleccionada = null;

async function inicializar() {
    try {
        asignaturasDisponibles = await apiFetch('asignaturas.php');
        const select = document.getElementById('asignatura');
        select.innerHTML = '<option value="">Selecciona una asignatura…</option>' +
            asignaturasDisponibles.map(a => `<option value="${a.id}">${escaparHtml(a.nombre)}</option>`).join('');

        const params = new URLSearchParams(window.location.search);
        const preseleccion = params.get('asignatura_id');
        if (preseleccion) {
            select.value = preseleccion;
            cargarUnidades();
        }
    } catch (err) {
        mostrarAlerta('alertaUnidad', err.message);
    }
}

function etiquetaTipo() {
    return asignaturaSeleccionada && asignaturaSeleccionada.tipo === 'tecnico' ? 'RA' : 'Unidad';
}

async function cargarUnidades() {
    const asignaturaId = document.getElementById('asignatura').value;
    document.getElementById('cardForm').style.display = asignaturaId ? 'block' : 'none';
    document.getElementById('cardTabla').style.display = asignaturaId ? 'block' : 'none';
    if (!asignaturaId) return;

    asignaturaSeleccionada = asignaturasDisponibles.find(a => String(a.id) === String(asignaturaId));
    document.getElementById('tituloForm').textContent = `Nuevo (${etiquetaTipo()})`;
    document.getElementById('codigo').placeholder = asignaturaSeleccionada.tipo === 'tecnico' ? 'RA1' : 'UA1';

    try {
        unidadesActuales = await apiFetch(`asignatura_unidades.php?asignatura_id=${asignaturaId}`);
        pintarUnidades();
    } catch (err) {
        mostrarAlerta('alertaUnidad', err.message);
    }
}

function pintarUnidades() {
    const tbody = document.getElementById('tablaUnidades');
    document.getElementById('estadoVacio').style.display = unidadesActuales.length ? 'none' : 'block';
    tbody.innerHTML = unidadesActuales.map(u => `
        <tr>
            <td class="num">${u.orden}</td>
            <td>${escaparHtml(u.codigo || '—')}</td>
            <td>${escaparHtml(u.titulo)}</td>
            <td class="acciones-tabla">
                <button class="btn secundario chico" onclick="editarUnidad(${u.id})">Editar</button>
                <button class="btn peligro chico" onclick="eliminarUnidad(${u.id})">Eliminar</button>
            </td>
        </tr>
    `).join('');
}

function editarUnidad(id) {
    const u = unidadesActuales.find(x => x.id === id);
    if (!u) return;
    document.getElementById('unidadId').value = u.id;
    document.getElementById('orden').value = u.orden;
    document.getElementById('codigo').value = u.codigo || '';
    document.getElementById('titulo').value = u.titulo;
    document.getElementById('tituloForm').textContent = `Editar (${etiquetaTipo()})`;
    document.getElementById('btnCancelar').style.display = 'inline-flex';
}

function cancelarEdicion() {
    document.getElementById('formUnidad').reset();
    document.getElementById('unidadId').value = '';
    document.getElementById('orden').value = (unidadesActuales.length + 1);
    document.getElementById('tituloForm').textContent = `Nuevo (${etiquetaTipo()})`;
    document.getElementById('btnCancelar').style.display = 'none';
}

async function eliminarUnidad(id) {
    if (!confirm('¿Eliminar este RA/Unidad?')) return;
    try {
        await apiFetch(`asignatura_unidades.php?id=${id}`, { method: 'DELETE' });
        cargarUnidades();
    } catch (err) {
        mostrarAlerta('alertaUnidad', err.message);
    }
}

document.getElementById('asignatura').addEventListener('change', cargarUnidades);
document.getElementById('btnCancelar').addEventListener('click', cancelarEdicion);

document.getElementById('formUnidad').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('unidadId').value;
    const body = {
        asignatura_id: document.getElementById('asignatura').value,
        orden: document.getElementById('orden').value,
        codigo: document.getElementById('codigo').value.trim(),
        titulo: document.getElementById('titulo').value.trim(),
    };
    try {
        if (id) {
            await apiFetch('asignatura_unidades.php', { method: 'PUT', body: { id, ...body } });
        } else {
            await apiFetch('asignatura_unidades.php', { method: 'POST', body });
        }
        cancelarEdicion();
        cargarUnidades();
    } catch (err) {
        mostrarAlerta('alertaUnidad', err.message);
    }
});

inicializar();
