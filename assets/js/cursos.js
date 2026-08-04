let cursos = [];

async function cargarCursos() {
    try {
        cursos = await apiFetch('cursos.php');
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
            <td>${escaparHtml(c.grado)}</td>
            <td>${escaparHtml(c.seccion)}</td>
            <td>${escaparHtml(c.anio_escolar)}</td>
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
    document.getElementById('anioEscolar').value = c.anio_escolar;
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
        anio_escolar: document.getElementById('anioEscolar').value.trim(),
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

cargarCursos();
