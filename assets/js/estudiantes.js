let estudiantes = [];
let cursosDisponibles = [];

async function cargarCursosSelect() {
    try {
        cursosDisponibles = await apiFetch('cursos.php');
        const select = document.getElementById('filtroCurso');
        select.innerHTML = cursosDisponibles.map(c => `<option value="${c.id}">${escaparHtml(c.nombre)} (${escaparHtml(c.anio_escolar)})</option>`).join('');
        if (cursosDisponibles.length) {
            cargarEstudiantes();
        } else {
            document.getElementById('estadoVacio').style.display = 'block';
            document.getElementById('estadoVacio').textContent = 'Primero crea un curso en la sección "Cursos".';
        }
    } catch (err) {
        mostrarAlerta('alertaEstudiante', err.message);
    }
}

async function cargarEstudiantes() {
    const cursoId = document.getElementById('filtroCurso').value;
    if (!cursoId) return;
    try {
        estudiantes = await apiFetch(`estudiantes.php?curso_id=${cursoId}`);
        pintarEstudiantes();
    } catch (err) {
        mostrarAlerta('alertaEstudiante', err.message);
    }
}

function pintarEstudiantes() {
    const tbody = document.getElementById('tablaEstudiantes');
    document.getElementById('estadoVacio').style.display = estudiantes.length ? 'none' : 'block';
    document.getElementById('estadoVacio').textContent = 'No hay estudiantes en este curso todavía.';
    tbody.innerHTML = estudiantes.map(e => `
        <tr>
            <td class="nombre-estudiante">${escaparHtml(e.apellido)}</td>
            <td class="nombre-estudiante">${escaparHtml(e.nombre)}</td>
            <td>${escaparHtml(e.matricula || '—')}</td>
            <td>${e.sexo === 'F' ? 'Hembra' : 'Varón'}</td>
            <td class="acciones-tabla">
                <button class="btn secundario chico" onclick="editarEstudiante(${e.id})">Editar</button>
                <button class="btn peligro chico" onclick="eliminarEstudiante(${e.id})">Eliminar</button>
            </td>
        </tr>
    `).join('');
}

function editarEstudiante(id) {
    const e = estudiantes.find(x => x.id === id);
    if (!e) return;
    document.getElementById('estudianteId').value = e.id;
    document.getElementById('nombre').value = e.nombre;
    document.getElementById('apellido').value = e.apellido;
    document.getElementById('matricula').value = e.matricula || '';
    document.getElementById('sexo').value = e.sexo || 'M';
    document.getElementById('tituloForm').textContent = 'Editar estudiante';
    document.getElementById('btnCancelar').style.display = 'inline-flex';
}

function cancelarEdicion() {
    document.getElementById('formEstudiante').reset();
    document.getElementById('estudianteId').value = '';
    document.getElementById('tituloForm').textContent = 'Nuevo estudiante';
    document.getElementById('btnCancelar').style.display = 'none';
}

async function eliminarEstudiante(id) {
    if (!confirm('¿Eliminar este estudiante?')) return;
    try {
        await apiFetch(`estudiantes.php?id=${id}`, { method: 'DELETE' });
        cargarEstudiantes();
    } catch (err) {
        mostrarAlerta('alertaEstudiante', err.message);
    }
}

document.getElementById('formEstudiante').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('estudianteId').value;
    const body = {
        nombre: document.getElementById('nombre').value.trim(),
        apellido: document.getElementById('apellido').value.trim(),
        matricula: document.getElementById('matricula').value.trim(),
        sexo: document.getElementById('sexo').value,
        curso_id: document.getElementById('filtroCurso').value,
    };
    try {
        if (id) {
            await apiFetch('estudiantes.php', { method: 'PUT', body: { id, ...body } });
        } else {
            await apiFetch('estudiantes.php', { method: 'POST', body });
        }
        cancelarEdicion();
        cargarEstudiantes();
    } catch (err) {
        mostrarAlerta('alertaEstudiante', err.message);
    }
});

document.getElementById('btnCancelar').addEventListener('click', cancelarEdicion);
document.getElementById('filtroCurso').addEventListener('change', cargarEstudiantes);

cargarCursosSelect();
