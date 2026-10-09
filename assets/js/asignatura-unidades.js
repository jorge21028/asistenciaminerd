let asignaturasDisponibles = [];
let unidadesActuales = [];
let asignaturaSeleccionada = null;
let periodosDisponibles = [];
let cursosDisponibles = [];

function cursoSeleccionadoId() {
    const sel = document.getElementById('cursoValores');
    return sel ? sel.value : '';
}

function nombreCursoSeleccionado() {
    const sel = document.getElementById('cursoValores');
    return sel && sel.value ? sel.options[sel.selectedIndex].textContent : '';
}

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
    document.getElementById('cardForm').style.display = (asignaturaId && !cursoSeleccionadoId()) ? 'block' : 'none';
    document.getElementById('cardTabla').style.display = asignaturaId ? 'block' : 'none';
    if (!asignaturaId) return;

    asignaturaSeleccionada = asignaturasDisponibles.find(a => String(a.id) === String(asignaturaId));
    document.getElementById('tituloForm').textContent = `Nuevo (${etiquetaTipo()})`;
    document.getElementById('codigo').placeholder = asignaturaSeleccionada.tipo === 'tecnico' ? 'RA1' : 'UA1';

    const esTecnico = asignaturaSeleccionada.tipo === 'tecnico';
    document.getElementById('filaCalificaciones').style.display = esTecnico ? 'flex' : 'none';

    // Valores propios por curso: solo para asignaturas con RA
    document.getElementById('campoCursoValores').style.display = esTecnico ? 'block' : 'none';
    document.getElementById('notaCursoValores').style.display = esTecnico ? 'block' : 'none';
    if (!esTecnico) document.getElementById('cursoValores').value = '';
    if (esTecnico && !cursosDisponibles.length) {
        try {
            cursosDisponibles = await apiFetch('cursos.php');
            document.getElementById('cursoValores').innerHTML = '<option value="">Todos los cursos (valores de la asignatura)</option>' +
                cursosDisponibles.map(c => `<option value="${c.id}">${escaparHtml(c.nombre)}${c.anio_escolar ? ' (' + escaparHtml(c.anio_escolar) + ')' : ''}</option>`).join('');
        } catch (err) { /* no bloquea el resto */ }
    }
    const cursoId = esTecnico ? cursoSeleccionadoId() : '';
    document.getElementById('cardForm').style.display = cursoId ? 'none' : 'block';

    if (esTecnico && !periodosDisponibles.length) {
        try {
            periodosDisponibles = await apiFetch('periodos.php');
            document.getElementById('periodo').innerHTML = '<option value="">— Sin asignar —</option>' +
                periodosDisponibles.map(p => `<option value="${p.id}">${escaparHtml(p.nombre)} (${escaparHtml(p.anio_escolar)})</option>`).join('');
        } catch (err) { /* no bloquea el resto */ }
    }

    try {
        unidadesActuales = await apiFetch(`asignatura_unidades.php?asignatura_id=${asignaturaId}${cursoId ? '&curso_id=' + cursoId : ''}`);
        pintarUnidades();
    } catch (err) {
        mostrarAlerta('alertaUnidad', err.message);
    }
}

function nombrePeriodo(periodoId) {
    const p = periodosDisponibles.find(x => String(x.id) === String(periodoId));
    return p ? p.nombre : '—';
}

function pintarUnidades() {
    const tbody = document.getElementById('tablaUnidades');
    document.getElementById('estadoVacio').style.display = unidadesActuales.length ? 'none' : 'block';
    const porCurso = !!cursoSeleccionadoId();
    tbody.innerHTML = unidadesActuales.map(u => {
        const personalizado = porCurso && parseInt(u.personalizado) === 1;
        const base = personalizado
            ? `<br><span style="color:var(--color-ink-soft); font-size:0.8em;">Asignatura: ${u.valor_base ?? '—'} · ${u.periodo_id_base ? escaparHtml(nombrePeriodo(u.periodo_id_base)) : '—'}</span>`
            : '';
        const acciones = porCurso
            ? `<button class="btn secundario chico" onclick="editarUnidad(${u.id})">Editar para este curso</button>
               ${personalizado ? `<button class="btn secundario chico" onclick="restablecerUnidad(${u.id})">Usar los de la asignatura</button>` : ''}`
            : `<button class="btn secundario chico" onclick="editarUnidad(${u.id})">Editar</button>
               <button class="btn peligro chico" onclick="eliminarUnidad(${u.id})">Eliminar</button>`;
        return `
        <tr>
            <td class="num">${u.orden}</td>
            <td>${escaparHtml(u.codigo || '—')}</td>
            <td>${escaparHtml(u.titulo)}</td>
            <td class="num">${u.valor ?? '—'}${personalizado ? ' <span class="badge" title="Valor propio de este curso">curso</span>' : ''}${base}</td>
            <td>${u.periodo_id ? escaparHtml(nombrePeriodo(u.periodo_id)) : '—'}</td>
            <td class="acciones-tabla">${acciones}</td>
        </tr>`;
    }).join('');
}

function editarUnidad(id) {
    const u = unidadesActuales.find(x => x.id === id);
    if (!u) return;
    document.getElementById('unidadId').value = u.id;
    document.getElementById('orden').value = u.orden;
    document.getElementById('codigo').value = u.codigo || '';
    document.getElementById('titulo').value = u.titulo;
    if (document.getElementById('valor')) document.getElementById('valor').value = u.valor ?? '';
    if (document.getElementById('periodo')) document.getElementById('periodo').value = u.periodo_id ?? '';
    document.getElementById('tituloForm').textContent = `Editar (${etiquetaTipo()})`;
    document.getElementById('btnCancelar').style.display = 'inline-flex';

    // Editando para un curso: solo cambian el valor y el período de ESE curso
    const porCurso = !!cursoSeleccionadoId();
    ['orden', 'codigo', 'titulo'].forEach(campo => { document.getElementById(campo).disabled = porCurso; });
    if (porCurso) {
        document.getElementById('cardForm').style.display = 'block';
        document.getElementById('tituloForm').textContent = `Valor y período de ${u.codigo || u.titulo} para ${nombreCursoSeleccionado()}`;
        document.getElementById('cardForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

async function restablecerUnidad(id) {
    if (!confirm('¿Usar de nuevo el valor y el período de la asignatura para este curso?')) return;
    try {
        await apiFetch('asignatura_unidades.php', { method: 'PUT', body: { id, curso_id: cursoSeleccionadoId(), restablecer: true } });
        cargarUnidades();
    } catch (err) {
        mostrarAlerta('alertaUnidad', err.message);
    }
}

function cancelarEdicion() {
    ['orden', 'codigo', 'titulo'].forEach(campo => { document.getElementById(campo).disabled = false; });
    if (cursoSeleccionadoId()) document.getElementById('cardForm').style.display = 'none';
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

document.getElementById('asignatura').addEventListener('change', () => { document.getElementById('cursoValores').value = ''; cargarUnidades(); });
document.getElementById('cursoValores').addEventListener('change', () => { cancelarEdicion(); cargarUnidades(); });
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
    if (asignaturaSeleccionada && asignaturaSeleccionada.tipo === 'tecnico') {
        body.valor = document.getElementById('valor').value;
        body.periodo_id = document.getElementById('periodo').value;
    }
    try {
        if (id && cursoSeleccionadoId()) {
            // Valor y período propios de este curso
            await apiFetch('asignatura_unidades.php', { method: 'PUT', body: {
                id, curso_id: cursoSeleccionadoId(), valor: body.valor, periodo_id: body.periodo_id,
            } });
        } else if (id) {
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
