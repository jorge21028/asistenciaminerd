const NOMBRE_TIPO_ASIGNATURA = { academica: 'Académica (Unidad)', tecnico: 'Técnico-profesional (RA)' };

let asignaturas = [];

async function cargarAsignaturas() {
    try {
        asignaturas = await apiFetch('asignaturas.php');
        pintarAsignaturas();
    } catch (err) {
        mostrarAlerta('alertaAsignatura', err.message);
    }
}

function pintarAsignaturas() {
    const tbody = document.getElementById('tablaAsignaturas');
    document.getElementById('estadoVacio').style.display = asignaturas.length ? 'none' : 'block';
    tbody.innerHTML = asignaturas.map(a => `
        <tr>
            <td><strong>${escaparHtml(a.nombre)}</strong></td>
            <td><span class="badge">${NOMBRE_TIPO_ASIGNATURA[a.tipo] || a.tipo}</span></td>
            <td class="acciones-tabla">
                <a class="btn secundario chico" href="${rutaBase('asignatura-unidades.html')}?asignatura_id=${a.id}">RA/Unidades</a>
                <button class="btn secundario chico" onclick="editarAsignatura(${a.id})">Editar</button>
                <button class="btn peligro chico" onclick="eliminarAsignatura(${a.id})">Eliminar</button>
            </td>
        </tr>
    `).join('');
}

function editarAsignatura(id) {
    const a = asignaturas.find(x => x.id === id);
    if (!a) return;
    document.getElementById('asignaturaId').value = a.id;
    document.getElementById('nombre').value = a.nombre;
    document.getElementById('tipo').value = a.tipo;
    document.getElementById('tituloForm').textContent = 'Editar asignatura';
    document.getElementById('btnCancelar').style.display = 'inline-flex';
}

function cancelarEdicion() {
    document.getElementById('formAsignatura').reset();
    document.getElementById('asignaturaId').value = '';
    document.getElementById('tituloForm').textContent = 'Nueva asignatura';
    document.getElementById('btnCancelar').style.display = 'none';
}

async function eliminarAsignatura(id) {
    if (!confirm('¿Eliminar esta asignatura?')) return;
    try {
        await apiFetch(`asignaturas.php?id=${id}`, { method: 'DELETE' });
        cargarAsignaturas();
    } catch (err) {
        mostrarAlerta('alertaAsignatura', err.message);
    }
}

document.getElementById('formAsignatura').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('asignaturaId').value;
    const nombre = document.getElementById('nombre').value.trim();
    const tipo = document.getElementById('tipo').value;
    try {
        if (id) {
            await apiFetch('asignaturas.php', { method: 'PUT', body: { id, nombre, tipo } });
        } else {
            await apiFetch('asignaturas.php', { method: 'POST', body: { nombre, tipo } });
        }
        cancelarEdicion();
        cargarAsignaturas();
    } catch (err) {
        mostrarAlerta('alertaAsignatura', err.message);
    }
});

document.getElementById('btnCancelar').addEventListener('click', cancelarEdicion);

cargarAsignaturas();
