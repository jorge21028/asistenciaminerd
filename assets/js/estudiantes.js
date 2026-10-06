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
            <td>${escaparHtml(e.matricula || '—')}</td>
            <td class="nombre-estudiante">${escaparHtml(e.apellido)}</td>
            <td class="nombre-estudiante">${escaparHtml(e.nombre)}${parseInt(e.retirado) === 1 ? ` <span class="sello-estado retirado" style="width:auto; padding:0 8px; border-radius:12px; transform:none;" title="${escaparHtml(e.motivo_retiro || 'Retirado')}">Retirado desde ${escaparHtml(e.fecha_retiro || '')}</span>` : ''}</td>
            <td>${e.sexo === 'F' ? 'Hembra' : 'Varón'}</td>
            <td>${escaparHtml(e.fecha_nacimiento || '—')}</td>
            <td class="acciones-tabla">
                <a class="btn chico" href="${rutaBase('estudiante-ficha.html')}?id=${e.id}">Ficha</a>
                <a class="btn secundario chico" href="${rutaBase('conducta-expediente.html')}?estudiante_id=${e.id}">Conducta</a>
                <button class="btn secundario chico" onclick="editarEstudiante(${e.id})">Editar</button>
                ${parseInt(e.retirado) === 1
                    ? `<button class="btn secundario chico" onclick="reincorporarEstudiante(${e.id})">Reincorporar</button>`
                    : `<button class="btn secundario chico" onclick="abrirRetiro(${e.id})">Retirar</button>`}
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
    document.getElementById('fechaNacimiento').value = e.fecha_nacimiento || '';
    document.getElementById('tituloForm').textContent = 'Editar estudiante';
    document.getElementById('btnCancelar').style.display = 'inline-flex';
}

function abrirRetiro(id) {
    const e = estudiantes.find(x => x.id === id);
    if (!e) return;
    document.getElementById('retiroEstudianteId').value = id;
    document.getElementById('tituloRetiro').textContent = `Retirar a ${e.nombre} ${e.apellido}`;
    document.getElementById('fechaRetiro').value = new Date().toISOString().slice(0, 10);
    document.getElementById('motivoRetiro').value = '';
    document.getElementById('cardRetiro').style.display = 'block';
    document.getElementById('cardRetiro').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cerrarRetiro() {
    document.getElementById('cardRetiro').style.display = 'none';
    document.getElementById('retiroEstudianteId').value = '';
}

async function confirmarRetiro() {
    const id = document.getElementById('retiroEstudianteId').value;
    const fecha = document.getElementById('fechaRetiro').value;
    if (!id || !fecha) { mostrarAlerta('alertaEstudiante', 'Indica la fecha de retiro.'); return; }
    try {
        await apiFetch('estudiantes.php', { method: 'PUT', body: {
            id, accion: 'retirar', fecha_retiro: fecha, motivo_retiro: document.getElementById('motivoRetiro').value.trim(),
        } });
        cerrarRetiro();
        cargarEstudiantes();
    } catch (err) {
        mostrarAlerta('alertaEstudiante', err.message);
    }
}

async function reincorporarEstudiante(id) {
    if (!confirm('¿Reincorporar a este estudiante? Volverá a aparecer normal en la asistencia (las calificaciones que ya se guardaron como "No realizada" no se modifican).')) return;
    try {
        await apiFetch('estudiantes.php', { method: 'PUT', body: { id, accion: 'reincorporar' } });
        cargarEstudiantes();
    } catch (err) {
        mostrarAlerta('alertaEstudiante', err.message);
    }
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
        fecha_nacimiento: document.getElementById('fechaNacimiento').value,
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
document.getElementById('btnConfirmarRetiro').addEventListener('click', confirmarRetiro);
document.getElementById('btnCancelarRetiro').addEventListener('click', cerrarRetiro);
document.getElementById('filtroCurso').addEventListener('change', cargarEstudiantes);

cargarCursosSelect();
