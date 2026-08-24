let asignaciones = [];

const ETIQUETA_DISTRIBUCION = {
    libre: 'Libre',
    pares: 'En pares',
    todo_corrido: 'Todo corrido',
};

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
            <td class="num">${a.bloques_semana > 0 ? a.bloques_semana : '<span class="subtitulo">—</span>'}</td>
            <td>${a.bloques_semana > 0 ? (ETIQUETA_DISTRIBUCION[a.distribucion] || a.distribucion) : '<span class="subtitulo">—</span>'}</td>
            <td class="num">${a.max_bloques_dia ?? '<span class="subtitulo">—</span>'}</td>
            <td class="acciones-tabla">
                <button class="btn secundario chico" onclick="editarAsignacion(${a.id})">Editar</button>
                <button class="btn peligro chico" onclick="eliminarAsignacion(${a.id})">Quitar</button>
            </td>
        </tr>
    `).join('');
}

function editarAsignacion(id) {
    const a = asignaciones.find(x => x.id === id);
    if (!a) return;
    document.getElementById('idEdicion').value = a.id;
    document.getElementById('profesor').value = a.profesor_id;
    document.getElementById('curso').value = a.curso_id;
    document.getElementById('asignatura').value = a.asignatura_id;
    document.getElementById('profesor').disabled = true;
    document.getElementById('curso').disabled = true;
    document.getElementById('asignatura').disabled = true;
    document.getElementById('bloquesSemana').value = a.bloques_semana;
    document.getElementById('distribucion').value = a.distribucion;
    document.getElementById('maxBloquesDia').value = a.max_bloques_dia ?? '';
    document.getElementById('tituloFormAsignacion').textContent = `Editando: ${a.profesor_nombre} — ${a.curso_nombre} — ${a.asignatura_nombre}`;
    document.getElementById('btnGuardarAsignacion').textContent = 'Guardar cambios';
    document.getElementById('btnCancelarEdicion').style.display = 'inline-flex';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelarEdicion() {
    document.getElementById('formAsignacion').reset();
    document.getElementById('idEdicion').value = '';
    document.getElementById('profesor').disabled = false;
    document.getElementById('curso').disabled = false;
    document.getElementById('asignatura').disabled = false;
    document.getElementById('tituloFormAsignacion').textContent = 'Nueva asignación';
    document.getElementById('btnGuardarAsignacion').textContent = 'Asignar';
    document.getElementById('btnCancelarEdicion').style.display = 'none';
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

document.getElementById('btnCancelarEdicion').addEventListener('click', cancelarEdicion);

document.getElementById('formAsignacion').addEventListener('submit', async (e) => {
    e.preventDefault();
    const idEdicion = document.getElementById('idEdicion').value;
    const body = {
        profesor_id: document.getElementById('profesor').value,
        curso_id: document.getElementById('curso').value,
        asignatura_id: document.getElementById('asignatura').value,
        bloques_semana: parseInt(document.getElementById('bloquesSemana').value) || 0,
        distribucion: document.getElementById('distribucion').value,
        max_bloques_dia: document.getElementById('maxBloquesDia').value || null,
    };
    try {
        if (idEdicion) {
            body.id = idEdicion;
            await apiFetch('asignaciones.php', { method: 'PUT', body });
        } else {
            await apiFetch('asignaciones.php', { method: 'POST', body });
        }
        cancelarEdicion();
        cargarAsignaciones();
    } catch (err) {
        mostrarAlerta('alertaAsignacion', err.message);
    }
});

cargarSelects().then(cargarAsignaciones);
