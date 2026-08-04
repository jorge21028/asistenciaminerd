let combos = [];
let listaActual = []; // [{estudiante_id, nombre, matricula, estado, observacion}]

const ETIQUETAS = { presente: 'P', ausente: 'A', tardanza: 'T', excusa: 'E' };

async function inicializar() {
    document.getElementById('fecha').value = new Date().toISOString().slice(0, 10);
    try {
        combos = await apiFetch('asignaciones.php');
        if (!combos.length) {
            document.getElementById('estadoVacio').style.display = 'block';
            return;
        }
        const select = document.getElementById('cursoAsignatura');
        select.innerHTML = combos.map(c =>
            `<option value="${c.curso_id}:${c.asignatura_id}">${escaparHtml(c.curso_nombre)} — ${escaparHtml(c.asignatura_nombre)}</option>`
        ).join('');
        cargarLista();
    } catch (err) {
        mostrarAlerta('alertaAsistencia', err.message);
    }
}

async function cargarLista() {
    const [cursoId, asignaturaId] = document.getElementById('cursoAsignatura').value.split(':');
    const fecha = document.getElementById('fecha').value;
    if (!cursoId || !asignaturaId || !fecha) return;

    try {
        const data = await apiFetch(`asistencia.php?curso_id=${cursoId}&asignatura_id=${asignaturaId}&fecha=${fecha}`);
        listaActual = data.estudiantes.map(e => ({
            estudiante_id: e.estudiante_id,
            nombre: `${e.nombre} ${e.apellido}`,
            matricula: e.matricula,
            estado: e.estado || 'presente', // por defecto se sugiere presente
            observacion: e.observacion || '',
        }));
        pintarLista();
        document.getElementById('cardLista').style.display = 'block';
    } catch (err) {
        mostrarAlerta('alertaAsistencia', err.message);
        document.getElementById('cardLista').style.display = 'none';
    }
}

function pintarLista() {
    const tbody = document.getElementById('tablaLista');
    tbody.innerHTML = listaActual.map((e, idx) => `
        <tr>
            <td class="nombre-estudiante">${escaparHtml(e.nombre)}</td>
            <td>${escaparHtml(e.matricula || '—')}</td>
            <td>
                <div class="selector-estado" data-idx="${idx}">
                    ${['presente', 'ausente', 'tardanza', 'excusa'].map(estado => `
                        <button type="button"
                                class="${e.estado === estado ? 'activo ' + ETIQUETAS[estado].toLowerCase() : ''}"
                                onclick="cambiarEstado(${idx}, '${estado}')"
                                title="${estado}">${ETIQUETAS[estado]}</button>
                    `).join('')}
                </div>
            </td>
            <td><input type="text" value="${escaparHtml(e.observacion)}" placeholder="Opcional" onchange="cambiarObservacion(${idx}, this.value)" style="min-width:160px; padding:6px 8px; border:1px solid var(--color-line); border-radius:6px;"></td>
        </tr>
    `).join('');
}

function cambiarEstado(idx, estado) {
    listaActual[idx].estado = estado;
    pintarLista();
}

function cambiarObservacion(idx, valor) {
    listaActual[idx].observacion = valor;
}

function marcarTodos(estado) {
    listaActual.forEach(e => e.estado = estado);
    pintarLista();
}

async function guardarAsistencia() {
    const [cursoId, asignaturaId] = document.getElementById('cursoAsignatura').value.split(':');
    const fecha = document.getElementById('fecha').value;
    const btn = document.getElementById('btnGuardar');
    btn.disabled = true;
    btn.textContent = 'Guardando…';

    try {
        await apiFetch('asistencia.php', {
            method: 'POST',
            body: {
                curso_id: cursoId,
                asignatura_id: asignaturaId,
                fecha,
                registros: listaActual.map(e => ({
                    estudiante_id: e.estudiante_id,
                    estado: e.estado,
                    observacion: e.observacion,
                })),
            },
        });
        mostrarAlerta('alertaAsistencia', 'Asistencia guardada correctamente.', 'exito');
    } catch (err) {
        mostrarAlerta('alertaAsistencia', err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Guardar asistencia';
    }
}

document.getElementById('btnCargar').addEventListener('click', cargarLista);
document.getElementById('btnGuardar').addEventListener('click', guardarAsistencia);

inicializar();
