// ---------------------------------------------------------------------
// Generador de Grupos
// Reparte a los estudiantes de un curso en grupos al azar, por cantidad
// de grupos o por tamaño de grupo, con opción de balancear por sexo.
// Igual que la Ruleta, la ventana de control y la de proyección se
// sincronizan en tiempo real vía BroadcastChannel (pensado para un
// segundo monitor conectado al proyector/PDI del aula).
// ---------------------------------------------------------------------

const canalGrupos = new BroadcastChannel('dinamica_grupos_sync');
const esProyeccionGrupos = !document.getElementById('btnGenerar');

let cursos = [];
let cursoActualId = null;
let cursoActualNombre = '';
let estudiantesCurso = [];
let ultimosGrupos = []; // [[estudiante, ...], [estudiante, ...], ...]

function nombreCompleto(est) { return `${est.nombre} ${est.apellido}`; }

// ---------------------------------------------------------------------
// Sorteo
// ---------------------------------------------------------------------
function mezclar(lista) {
    const copia = lista.slice();
    for (let i = copia.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copia[i], copia[j]] = [copia[j], copia[i]];
    }
    return copia;
}

function cantidadDeGrupos(totalEstudiantes, modo, valor) {
    if (modo === 'cantidad') return Math.max(1, Math.min(valor, totalEstudiantes));
    return Math.max(1, Math.ceil(totalEstudiantes / Math.max(1, valor)));
}

function generarGrupos(estudiantes, modo, valor, balancearSexo) {
    const numGrupos = cantidadDeGrupos(estudiantes.length, modo, valor);
    const grupos = Array.from({ length: numGrupos }, () => []);

    if (balancearSexo) {
        // Se reparten por separado M y F, en round-robin, para que cada
        // grupo quede lo más equilibrado posible entre ambos.
        const masculinos = mezclar(estudiantes.filter(e => e.sexo === 'M'));
        const femeninas = mezclar(estudiantes.filter(e => e.sexo === 'F'));
        masculinos.forEach((est, i) => grupos[i % numGrupos].push(est));
        femeninas.forEach((est, i) => grupos[i % numGrupos].push(est));
    } else {
        const mezclados = mezclar(estudiantes);
        mezclados.forEach((est, i) => grupos[i % numGrupos].push(est));
    }

    // Orden alfabético dentro de cada grupo, para que sea fácil de leer.
    grupos.forEach(g => g.sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b), 'es')));
    return grupos;
}

// ---------------------------------------------------------------------
// Pintado (control)
// ---------------------------------------------------------------------
function pintarChecklistEstudiantes() {
    const cont = document.getElementById('listaEstudiantesCheck');
    cont.innerHTML = estudiantesCurso.map(est => `
        <label class="grupos-check-item">
            <input type="checkbox" class="chk-estudiante-grupo" value="${est.id}" checked>
            ${escaparHtml(nombreCompleto(est))}
        </label>
    `).join('');
    cont.querySelectorAll('.chk-estudiante-grupo').forEach(chk => chk.addEventListener('change', actualizarContadorSeleccion));
    actualizarContadorSeleccion();
}

function estudiantesSeleccionados() {
    const ids = Array.from(document.querySelectorAll('.chk-estudiante-grupo:checked')).map(chk => parseInt(chk.value));
    return estudiantesCurso.filter(e => ids.includes(e.id));
}

function actualizarContadorSeleccion() {
    const n = document.querySelectorAll('.chk-estudiante-grupo:checked').length;
    document.getElementById('contadorSeleccion').textContent = `${n} de ${estudiantesCurso.length} seleccionados`;
}

function pintarResultado(grupos) {
    const cont = document.getElementById('resultadoGrupos');
    document.getElementById('cardResultado').style.display = grupos.length ? 'block' : 'none';
    document.getElementById('estadoVacioGrupos').style.display = grupos.length ? 'none' : 'block';
    document.getElementById('btnProyectar').style.display = grupos.length ? 'inline-flex' : 'none';
    document.getElementById('btnImprimir').style.display = grupos.length ? 'inline-flex' : 'none';

    cont.innerHTML = grupos.map((g, i) => `
        <div class="card grupo-card">
            <h4>Grupo ${i + 1} <span class="subtitulo">(${g.length})</span></h4>
            <ol>${g.map(est => `<li>${escaparHtml(nombreCompleto(est))}</li>`).join('')}</ol>
        </div>
    `).join('');
}

// ---------------------------------------------------------------------
// Acciones (control)
// ---------------------------------------------------------------------
function generar() {
    const seleccionados = estudiantesSeleccionados();
    if (seleccionados.length < 2) {
        mostrarAlerta('alertaGrupos', 'Selecciona al menos 2 estudiantes para poder formar grupos.');
        return;
    }
    const modo = document.getElementById('modoAgrupar').value;
    const valor = parseInt(document.getElementById('valorAgrupar').value) || 1;
    const balancearSexo = document.getElementById('balancearSexo').value === '1';

    ultimosGrupos = generarGrupos(seleccionados, modo, valor, balancearSexo);
    pintarResultado(ultimosGrupos);
    document.getElementById('estadoGuardadoInfo').textContent = '';
    guardarEstado(); // se guarda solo, así no se pierde si cierra la pestaña
    difundirSincronizacion();
}

async function guardarEstado() {
    try {
        await apiFetch('dinamica_grupos.php', {
            method: 'POST',
            body: {
                curso_id: cursoActualId,
                estado: {
                    modo: document.getElementById('modoAgrupar').value,
                    valor: parseInt(document.getElementById('valorAgrupar').value) || 1,
                    balancearSexo: document.getElementById('balancearSexo').value === '1',
                    seleccionadosIds: estudiantesSeleccionados().map(e => e.id),
                    grupos: ultimosGrupos.map(g => g.map(e => e.id)),
                },
            },
        });
        document.getElementById('estadoGuardadoInfo').textContent = 'Guardado — ' + new Date().toLocaleString('es-DO');
    } catch (err) {
        // Falla silenciosa: no generar ruido si el guardado automático no funciona.
        console.error(err);
    }
}

// ---------------------------------------------------------------------
// Cargar curso (control)
// ---------------------------------------------------------------------
async function cargarCursoSeleccionado() {
    cursoActualId = document.getElementById('curso').value;
    const cursoObj = cursos.find(c => String(c.id) === String(cursoActualId));
    cursoActualNombre = cursoObj ? cursoObj.nombre : '';

    document.getElementById('areaGrupos').style.display = 'none';
    document.getElementById('estadoVacioCurso').style.display = 'none';
    document.getElementById('cardResultado').style.display = 'none';
    ultimosGrupos = [];

    if (!cursoActualId) return;

    try {
        estudiantesCurso = await apiFetch(`estudiantes.php?curso_id=${cursoActualId}`);
        if (estudiantesCurso.length < 2) {
            document.getElementById('estadoVacioCurso').style.display = 'block';
            document.getElementById('estadoVacioCurso').textContent = 'Este curso necesita al menos 2 estudiantes matriculados para armar grupos.';
            return;
        }

        pintarChecklistEstudiantes();
        document.getElementById('areaGrupos').style.display = 'block';
        document.getElementById('estadoVacioGrupos').style.display = 'block';

        const guardado = await apiFetch(`dinamica_grupos.php?curso_id=${cursoActualId}`);
        if (guardado && guardado.estado) {
            const e = guardado.estado;
            document.getElementById('modoAgrupar').value = e.modo || 'cantidad';
            document.getElementById('valorAgrupar').value = e.valor || 4;
            document.getElementById('balancearSexo').value = e.balancearSexo ? '1' : '0';
            if (Array.isArray(e.seleccionadosIds)) {
                document.querySelectorAll('.chk-estudiante-grupo').forEach(chk => {
                    chk.checked = e.seleccionadosIds.includes(parseInt(chk.value));
                });
                actualizarContadorSeleccion();
            }
            if (Array.isArray(e.grupos) && e.grupos.length) {
                ultimosGrupos = e.grupos.map(idsGrupo => idsGrupo.map(id => estudiantesCurso.find(est => est.id === id)).filter(Boolean));
                pintarResultado(ultimosGrupos);
                document.getElementById('estadoGuardadoInfo').textContent = 'Cargado del ' + new Date(guardado.actualizado).toLocaleString('es-DO');
            }
        }
        difundirSincronizacion();
    } catch (err) {
        mostrarAlerta('alertaGrupos', err.message);
    }
}

// ---------------------------------------------------------------------
// Sincronización con la ventana de proyección
// ---------------------------------------------------------------------
function difundirSincronizacion() {
    canalGrupos.postMessage({
        tipo: 'sync',
        cursoId: cursoActualId,
        cursoNombre: cursoActualNombre,
        grupos: ultimosGrupos.map(g => g.map(e => ({ id: e.id, nombre: nombreCompleto(e) }))),
    });
}

function pintarProyeccion(cursoNombre, grupos) {
    const cursoLabel = document.getElementById('proyeccionCurso');
    if (cursoLabel) cursoLabel.textContent = cursoNombre || 'Generador de Grupos';

    const cont = document.getElementById('proyeccionGrupos');
    if (!cont) return;
    cont.innerHTML = grupos.length
        ? grupos.map((g, i) => `
            <div class="proyeccion-panel grupo-proyeccion-card">
                <p class="proyeccion-etiqueta">Grupo ${i + 1}</p>
                <ol>${g.map(est => `<li>${escaparHtml(est.nombre)}</li>`).join('')}</ol>
            </div>
        `).join('')
        : '<p class="estado-vacio">Esperando a que el profesor genere los grupos…</p>';
}

canalGrupos.onmessage = (evento) => {
    const d = evento.data;
    if (d.tipo === 'solicitar_sync' && !esProyeccionGrupos && cursoActualId) {
        difundirSincronizacion();
        return;
    }
    if (d.tipo === 'sync' && esProyeccionGrupos) {
        pintarProyeccion(d.cursoNombre, d.grupos || []);
    }
};

// ---------------------------------------------------------------------
// Inicialización según la ventana
// ---------------------------------------------------------------------
if (!esProyeccionGrupos) {
    (async function inicializarControl() {
        try {
            cursos = await apiFetch('cursos.php');
            document.getElementById('curso').innerHTML =
                '<option value="">Selecciona un curso…</option>' +
                cursos.map(c => `<option value="${c.id}">${escaparHtml(c.nombre)}</option>`).join('');
        } catch (err) {
            mostrarAlerta('alertaGrupos', err.message);
        }

        document.getElementById('curso').addEventListener('change', cargarCursoSeleccionado);
        document.getElementById('btnGenerar').addEventListener('click', generar);
        document.getElementById('btnMarcarTodos').addEventListener('click', () => {
            document.querySelectorAll('.chk-estudiante-grupo').forEach(chk => { chk.checked = true; });
            actualizarContadorSeleccion();
        });
        document.getElementById('btnDesmarcarTodos').addEventListener('click', () => {
            document.querySelectorAll('.chk-estudiante-grupo').forEach(chk => { chk.checked = false; });
            actualizarContadorSeleccion();
        });
        document.getElementById('btnImprimir').addEventListener('click', () => window.print());
        document.getElementById('btnProyectar').addEventListener('click', () => {
            window.open(rutaBase('dinamica-grupos-proyeccion.html'), 'grupos_proyeccion', 'width=1100,height=750');
        });
    })();
} else {
    canalGrupos.postMessage({ tipo: 'solicitar_sync' });
}
