let asignaturasDisponiblesComp = [];
let competenciasActuales = [];

async function inicializar() {
    try {
        const todas = await apiFetch('asignaturas.php');
        asignaturasDisponiblesComp = todas.filter(a => a.tipo === 'academica');
        const select = document.getElementById('asignatura');
        select.innerHTML = '<option value="">Selecciona una asignatura académica…</option>' +
            asignaturasDisponiblesComp.map(a => `<option value="${a.id}">${escaparHtml(a.nombre)}</option>`).join('');

        const params = new URLSearchParams(window.location.search);
        const preseleccion = params.get('asignatura_id');
        if (preseleccion) { select.value = preseleccion; cargarCompetencias(); }
    } catch (err) {
        mostrarAlerta('alertaCompetencia', err.message);
    }
}

async function cargarCompetencias() {
    const asignaturaId = document.getElementById('asignatura').value;
    document.getElementById('cardForm').style.display = asignaturaId ? 'block' : 'none';
    document.getElementById('cardTabla').style.display = asignaturaId ? 'block' : 'none';
    if (!asignaturaId) return;

    try {
        competenciasActuales = await apiFetch(`competencias.php?asignatura_id=${asignaturaId}`);
        pintarCompetencias();
    } catch (err) {
        mostrarAlerta('alertaCompetencia', err.message);
    }
}

function pintarCompetencias() {
    const tbody = document.getElementById('tablaCompetencias');
    document.getElementById('estadoVacio').style.display = competenciasActuales.length ? 'none' : 'block';
    tbody.innerHTML = competenciasActuales.map(c => `
        <tr>
            <td>${escaparHtml(c.codigo || '—')}</td>
            <td>${escaparHtml(c.descripcion)}</td>
            <td class="acciones-tabla">
                <button class="btn secundario chico" onclick="editarCompetencia(${c.id})">Editar</button>
                <button class="btn peligro chico" onclick="eliminarCompetencia(${c.id})">Eliminar</button>
            </td>
        </tr>
    `).join('');
}

function editarCompetencia(id) {
    const c = competenciasActuales.find(x => x.id === id);
    if (!c) return;
    document.getElementById('competenciaId').value = c.id;
    document.getElementById('codigo').value = c.codigo || '';
    document.getElementById('descripcion').value = c.descripcion;
    document.getElementById('tituloForm').textContent = 'Editar competencia';
    document.getElementById('btnCancelar').style.display = 'inline-flex';
}

function cancelarEdicion() {
    document.getElementById('formCompetencia').reset();
    document.getElementById('competenciaId').value = '';
    document.getElementById('tituloForm').textContent = 'Nueva competencia';
    document.getElementById('btnCancelar').style.display = 'none';
}

async function eliminarCompetencia(id) {
    if (!confirm('¿Eliminar esta competencia? Se quitará de los criterios que la tenían asociada.')) return;
    try {
        await apiFetch(`competencias.php?id=${id}`, { method: 'DELETE' });
        cargarCompetencias();
    } catch (err) {
        mostrarAlerta('alertaCompetencia', err.message);
    }
}

document.getElementById('asignatura').addEventListener('change', cargarCompetencias);
document.getElementById('btnCancelar').addEventListener('click', cancelarEdicion);

document.getElementById('formCompetencia').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('competenciaId').value;
    const body = {
        asignatura_id: document.getElementById('asignatura').value,
        codigo: document.getElementById('codigo').value.trim(),
        descripcion: document.getElementById('descripcion').value.trim(),
    };
    try {
        if (id) {
            await apiFetch('competencias.php', { method: 'PUT', body: { id, codigo: body.codigo, descripcion: body.descripcion } });
        } else {
            await apiFetch('competencias.php', { method: 'POST', body });
        }
        cancelarEdicion();
        cargarCompetencias();
    } catch (err) {
        mostrarAlerta('alertaCompetencia', err.message);
    }
});

inicializar();
