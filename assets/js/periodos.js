let periodos = [];
let aniosDisponiblesPeriodo = [];

async function cargarSelectAnios() {
    try {
        aniosDisponiblesPeriodo = await apiFetch('anios_escolares.php');
        const activo = aniosDisponiblesPeriodo.find(a => a.es_activo == 1);
        document.getElementById('anioEscolar').innerHTML = aniosDisponiblesPeriodo.map(a =>
            `<option value="${a.id}" ${activo && a.id === activo.id ? 'selected' : ''}>${escaparHtml(a.nombre)}${a.es_activo == 1 ? ' (activo)' : ''}</option>`
        ).join('');
        document.getElementById('filtroAnio').innerHTML = '<option value="">Todos los años</option>' +
            aniosDisponiblesPeriodo.map(a => `<option value="${a.id}">${escaparHtml(a.nombre)}${a.es_activo == 1 ? ' (activo)' : ''}</option>`).join('');
    } catch (err) {
        mostrarAlerta('alertaPeriodo', err.message);
    }
}

async function cargarPeriodos() {
    const anioFiltro = document.getElementById('filtroAnio').value;
    try {
        periodos = await apiFetch(anioFiltro ? `periodos.php?anio_escolar_id=${anioFiltro}` : 'periodos.php?todos=1');
        pintarPeriodos();
    } catch (err) {
        mostrarAlerta('alertaPeriodo', err.message);
    }
}

function pintarPeriodos() {
    const tbody = document.getElementById('tablaPeriodos');
    document.getElementById('estadoVacio').style.display = periodos.length ? 'none' : 'block';
    tbody.innerHTML = periodos.map(p => `
        <tr>
            <td class="num">${p.orden}</td>
            <td><strong>${escaparHtml(p.nombre)}</strong></td>
            <td>${escaparHtml(p.anio_escolar)}</td>
            <td>${p.fecha_inicio}</td>
            <td>${p.fecha_fin}</td>
            <td class="acciones-tabla">
                <button class="btn secundario chico" onclick="editarPeriodo(${p.id})">Editar</button>
                <button class="btn peligro chico" onclick="eliminarPeriodo(${p.id})">Eliminar</button>
            </td>
        </tr>
    `).join('');
}

function editarPeriodo(id) {
    const p = periodos.find(x => x.id === id);
    if (!p) return;
    document.getElementById('periodoId').value = p.id;
    document.getElementById('nombre').value = p.nombre;
    document.getElementById('anioEscolar').value = p.anio_escolar_id;
    document.getElementById('orden').value = p.orden;
    document.getElementById('fechaInicio').value = p.fecha_inicio;
    document.getElementById('fechaFin').value = p.fecha_fin;
    document.getElementById('tituloForm').textContent = 'Editar período';
    document.getElementById('btnCancelar').style.display = 'inline-flex';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelarEdicion() {
    document.getElementById('formPeriodo').reset();
    document.getElementById('periodoId').value = '';
    document.getElementById('orden').value = periodos.length + 1;
    document.getElementById('tituloForm').textContent = 'Nuevo período';
    document.getElementById('btnCancelar').style.display = 'none';
}

async function eliminarPeriodo(id) {
    if (!confirm('¿Eliminar este período? Los RA y actividades que dependían de él quedarán sin período asignado.')) return;
    try {
        await apiFetch(`periodos.php?id=${id}`, { method: 'DELETE' });
        cargarPeriodos();
    } catch (err) {
        mostrarAlerta('alertaPeriodo', err.message);
    }
}

document.getElementById('formPeriodo').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('periodoId').value;
    const body = {
        nombre: document.getElementById('nombre').value.trim(),
        anio_escolar_id: document.getElementById('anioEscolar').value,
        orden: document.getElementById('orden').value,
        fecha_inicio: document.getElementById('fechaInicio').value,
        fecha_fin: document.getElementById('fechaFin').value,
    };
    try {
        if (id) {
            await apiFetch('periodos.php', { method: 'PUT', body: { id, ...body } });
        } else {
            await apiFetch('periodos.php', { method: 'POST', body });
        }
        cancelarEdicion();
        cargarPeriodos();
    } catch (err) {
        mostrarAlerta('alertaPeriodo', err.message);
    }
});

document.getElementById('btnCancelar').addEventListener('click', cancelarEdicion);
document.getElementById('filtroAnio').addEventListener('change', cargarPeriodos);

cargarSelectAnios().then(cargarPeriodos);
