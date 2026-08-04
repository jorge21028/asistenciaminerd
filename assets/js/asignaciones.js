let asignaciones = [];

async function cargarSelects() {
    try {
        const [usuarios, cursos, asignaturas] = await Promise.all([
            apiFetch('usuarios.php'),
            apiFetch('cursos.php'),
            apiFetch('asignaturas.php'),
        ]);
        const profesores = usuarios.filter(u => u.activo == 1);
        document.getElementById('profesor').innerHTML = profesores.map(p => `<option value="${p.id}">${escaparHtml(p.nombre)} (${p.rol})</option>`).join('');
        document.getElementById('curso').innerHTML = cursos.map(c => `<option value="${c.id}">${escaparHtml(c.nombre)}</option>`).join('');
        document.getElementById('asignatura').innerHTML = asignaturas.map(a => `<option value="${a.id}">${escaparHtml(a.nombre)}</option>`).join('');
    } catch (err) {
        mostrarAlerta('alertaAsignacion', err.message);
    }
}

async function cargarAsignaciones() {
    try {
        asignaciones = await apiFetch('asignaciones.php');
        pintarAsignaciones();
    } catch (err) {
        mostrarAlerta('alertaAsignacion', err.message);
    }
}

function pintarAsignaciones() {
    const tbody = document.getElementById('tablaAsignaciones');
    document.getElementById('estadoVacio').style.display = asignaciones.length ? 'none' : 'block';
    tbody.innerHTML = asignaciones.map(a => `
        <tr>
            <td>${escaparHtml(a.profesor_nombre)}</td>
            <td>${escaparHtml(a.curso_nombre)}</td>
            <td>${escaparHtml(a.asignatura_nombre)}</td>
            <td class="acciones-tabla">
                <button class="btn peligro chico" onclick="eliminarAsignacion(${a.id})">Quitar</button>
            </td>
        </tr>
    `).join('');
}

async function eliminarAsignacion(id) {
    if (!confirm('¿Quitar esta asignación?')) return;
    try {
        await apiFetch(`asignaciones.php?id=${id}`, { method: 'DELETE' });
        cargarAsignaciones();
    } catch (err) {
        mostrarAlerta('alertaAsignacion', err.message);
    }
}

document.getElementById('formAsignacion').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
        profesor_id: document.getElementById('profesor').value,
        curso_id: document.getElementById('curso').value,
        asignatura_id: document.getElementById('asignatura').value,
    };
    try {
        await apiFetch('asignaciones.php', { method: 'POST', body });
        cargarAsignaciones();
    } catch (err) {
        mostrarAlerta('alertaAsignacion', err.message);
    }
});

cargarSelects().then(cargarAsignaciones);
