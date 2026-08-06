// ---------------------------------------------------------------------
// Ruleta de Participación
// Este archivo se usa tanto en la ventana de control (ruleta.html) como
// en la ventana de proyección (ruleta-proyeccion.html). Ambas se
// sincronizan en tiempo real vía BroadcastChannel (misma sesión de
// navegador — pensado para abrir la proyección en un segundo monitor
// conectado al proyector/PDI del aula).
// ---------------------------------------------------------------------

const canalRuleta = new BroadcastChannel('dinamica_ruleta_sync');
const esProyeccion = !document.getElementById('btnGirar');

let cursos = [];
let cursoActualId = null;
let cursoActualNombre = '';
let estudiantesCurso = [];
let restantes = [];
let turnos = [];

const svg = document.getElementById('svgRuleta');
const SVG_NS = 'http://www.w3.org/2000/svg';
const CENTRO = 150;
const RADIO = 140;

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------
function nombreCompleto(est) { return `${est.nombre} ${est.apellido}`; }
function nombreCorto(est) { return `${est.nombre.split(' ')[0]} ${est.apellido.charAt(0)}.`; }

function colorDesdeTexto(texto) {
    let hash = 0;
    for (let i = 0; i < texto.length; i++) hash = texto.charCodeAt(i) + ((hash << 5) - hash);
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 68%, 56%)`;
}

function puntoEnCirculo(anguloDeg, radio) {
    const rad = (anguloDeg - 0) * Math.PI / 180; // 0deg = arriba (12 en punto)
    return {
        x: CENTRO + radio * Math.sin(rad),
        y: CENTRO - radio * Math.cos(rad),
    };
}

// ---------------------------------------------------------------------
// Dibujo de la rueda
// ---------------------------------------------------------------------
function dibujarRueda(lista) {
    svg.style.transition = 'none';
    svg.style.transform = 'rotate(0deg)';
    void svg.offsetWidth; // forzar reflow para que el próximo giro parta de 0
    svg.innerHTML = '';

    const n = lista.length;
    if (n === 0) return;

    const anguloPorSlice = 360 / n;

    lista.forEach((est, i) => {
        const inicio = i * anguloPorSlice;
        const fin = inicio + anguloPorSlice;
        const p1 = puntoEnCirculo(inicio, RADIO);
        const p2 = puntoEnCirculo(fin, RADIO);
        const largeArc = anguloPorSlice > 180 ? 1 : 0;

        const path = document.createElementNS(SVG_NS, 'path');
        const d = n === 1
            ? `M ${CENTRO},${CENTRO - RADIO} A ${RADIO},${RADIO} 0 1,1 ${CENTRO - 0.01},${CENTRO - RADIO} Z`
            : `M ${CENTRO},${CENTRO} L ${p1.x},${p1.y} A ${RADIO},${RADIO} 0 ${largeArc},1 ${p2.x},${p2.y} Z`;
        path.setAttribute('d', d);
        path.setAttribute('fill', colorDesdeTexto(nombreCompleto(est)));
        path.setAttribute('stroke', '#ffffff');
        path.setAttribute('stroke-width', '1.5');
        svg.appendChild(path);

        const medio = inicio + anguloPorSlice / 2;
        const g = document.createElementNS(SVG_NS, 'g');
        g.setAttribute('transform', `rotate(${medio} ${CENTRO} ${CENTRO})`);
        const text = document.createElementNS(SVG_NS, 'text');
        text.setAttribute('x', CENTRO + RADIO * 0.9);
        text.setAttribute('y', CENTRO + 4);
        text.setAttribute('text-anchor', 'end');
        text.setAttribute('class', 'ruleta-label');
        text.textContent = nombreCorto(est);
        g.appendChild(text);
        svg.appendChild(g);
    });
}

function mostrarRuedaVacia(mensaje) {
    svg.innerHTML = `<circle cx="150" cy="150" r="140" fill="var(--color-surface-alt)" stroke="var(--color-line)" />
        <text x="150" y="150" text-anchor="middle" fill="var(--color-ink-soft)" font-size="14">${mensaje}</text>`;
}

// ---------------------------------------------------------------------
// Girar
// ---------------------------------------------------------------------
function anguloParaGanador(indice, totalAntes) {
    const anguloPorSlice = 360 / totalAntes;
    const centroSlice = indice * anguloPorSlice + anguloPorSlice / 2;
    const vueltasExtra = 360 * 5;
    return ((360 - centroSlice) % 360) + vueltasExtra;
}

function esperarFinDeGiro(callback) {
    let ejecutado = false;
    const terminar = () => { if (ejecutado) return; ejecutado = true; callback(); };
    svg.addEventListener('transitionend', terminar, { once: true });
    setTimeout(terminar, 4500);
}

function ejecutarGiro({ listaAntes, indiceGanador, anguloFinal, ganador, turno }) {
    dibujarRueda(listaAntes);
    requestAnimationFrame(() => {
        svg.style.transition = 'transform 4.2s cubic-bezier(0.14,0.67,0.2,1)';
        svg.style.transform = `rotate(${anguloFinal}deg)`;
    });

    const resultadoEl = document.getElementById('resultadoGiro');
    if (resultadoEl) resultadoEl.textContent = 'Girando…';

    esperarFinDeGiro(() => {
        restantes = restantes.filter(e => e.id !== ganador.id);
        if (!turnos.find(t => t.estudiante_id === ganador.id && t.turno === turno)) {
            turnos.push({ estudiante_id: ganador.id, nombre: nombreCompleto(ganador), turno });
        }
        if (resultadoEl) resultadoEl.textContent = `Turno ${turno}: ${nombreCompleto(ganador)}`;
        pintarTurnos();
        if (restantes.length > 0) {
            dibujarRueda(restantes);
        } else {
            mostrarRuedaVacia('Todos participaron');
        }
        actualizarControles();
    });
}

async function girar() {
    if (!cursoActualId) return;
    if (restantes.length === 0) {
        mostrarAlerta('alertaRuleta', 'Todos los estudiantes ya participaron en esta ronda. Guarda el estado o reinicia para una nueva ronda.', 'info');
        return;
    }

    const indice = Math.floor(Math.random() * restantes.length);
    const ganador = restantes[indice];
    const totalAntes = restantes.length;
    const anguloFinal = anguloParaGanador(indice, totalAntes);
    const turno = turnos.length + 1;
    const listaAntes = restantes.slice();

    document.getElementById('btnGirar').disabled = true;

    ejecutarGiro({ listaAntes, indiceGanador: indice, anguloFinal, ganador, turno });

    canalRuleta.postMessage({
        tipo: 'girar',
        cursoId: cursoActualId,
        listaAntesIds: listaAntes.map(e => e.id),
        indiceGanador: indice,
        anguloFinal,
        ganadorId: ganador.id,
        turno,
    });

    setTimeout(() => { document.getElementById('btnGirar').disabled = false; actualizarControles(); }, 4400);
}

// ---------------------------------------------------------------------
// Pintar turnos / controles
// ---------------------------------------------------------------------
function pintarTurnos() {
    const tbody = document.getElementById('tablaTurnos');
    if (tbody) {
        document.getElementById('estadoVacioTurnos').style.display = turnos.length ? 'none' : 'block';
        tbody.innerHTML = turnos.map(t => `<tr><td class="num">${t.turno}</td><td>${escaparHtml(t.nombre)}</td></tr>`).join('');
        const restantesInfo = document.getElementById('restantesInfo');
        if (restantesInfo) restantesInfo.textContent = `${restantes.length} de ${estudiantesCurso.length} estudiantes sin participar en esta ronda`;
    }

    const listaProyeccion = document.getElementById('listaTurnosProyeccion');
    if (listaProyeccion) {
        listaProyeccion.innerHTML = turnos.slice().reverse().map(t =>
            `<div class="proyeccion-turno-item"><span>${t.turno}</span>${escaparHtml(t.nombre)}</div>`
        ).join('') || '<p class="estado-vacio">Aún no hay turnos.</p>';
    }
}

function actualizarControles() {
    const btnGirar = document.getElementById('btnGirar');
    if (btnGirar) btnGirar.disabled = restantes.length === 0;
}

// ---------------------------------------------------------------------
// Estado: cargar / guardar / reiniciar (solo ventana de control)
// ---------------------------------------------------------------------
async function cargarCursoSeleccionado() {
    cursoActualId = document.getElementById('curso').value;
    const cursoObj = cursos.find(c => String(c.id) === String(cursoActualId));
    cursoActualNombre = cursoObj ? cursoObj.nombre : '';

    document.getElementById('areaRuleta').style.display = 'none';
    document.getElementById('estadoVacioCurso').style.display = 'none';

    if (!cursoActualId) return;

    try {
        estudiantesCurso = await apiFetch(`estudiantes.php?curso_id=${cursoActualId}`);
        if (!estudiantesCurso.length) {
            document.getElementById('estadoVacioCurso').style.display = 'block';
            document.getElementById('estadoVacioCurso').textContent = 'Este curso no tiene estudiantes matriculados todavía.';
            return;
        }

        const guardado = await apiFetch(`dinamica_ruleta.php?curso_id=${cursoActualId}`);
        if (guardado && guardado.estado) {
            const idsRestantes = new Set(guardado.estado.restantes || []);
            restantes = estudiantesCurso.filter(e => idsRestantes.has(e.id));
            turnos = guardado.estado.turnos || [];
            document.getElementById('estadoGuardadoInfo').textContent =
                'Se cargó el estado guardado del ' + new Date(guardado.actualizado).toLocaleString('es-DO');
        } else {
            restantes = estudiantesCurso.slice();
            turnos = [];
            document.getElementById('estadoGuardadoInfo').textContent = '';
        }

        document.getElementById('areaRuleta').style.display = 'grid';
        document.getElementById('resultadoGiro').textContent = turnos.length
            ? `Último: Turno ${turnos[turnos.length - 1].turno} — ${turnos[turnos.length - 1].nombre}`
            : 'Presiona "Girar la ruleta" para empezar';

        dibujarRueda(restantes.length ? restantes : []);
        if (!restantes.length) mostrarRuedaVacia('Todos participaron');
        pintarTurnos();
        actualizarControles();
        difundirSincronizacion();
    } catch (err) {
        mostrarAlerta('alertaRuleta', err.message);
    }
}

async function guardarEstado() {
    try {
        await apiFetch('dinamica_ruleta.php', {
            method: 'POST',
            body: { curso_id: cursoActualId, estado: { restantes: restantes.map(e => e.id), turnos } },
        });
        mostrarAlerta('alertaRuleta', 'Estado guardado. Podrás continuar desde aquí en la próxima clase.', 'exito');
        document.getElementById('estadoGuardadoInfo').textContent = 'Guardado justo ahora — ' + new Date().toLocaleString('es-DO');
    } catch (err) {
        mostrarAlerta('alertaRuleta', err.message);
    }
}

async function reiniciar() {
    if (!confirm('¿Reiniciar la ruleta? Se perderá el orden de turnos actual y todos los estudiantes volverán a estar disponibles.')) return;
    try {
        await apiFetch(`dinamica_ruleta.php?curso_id=${cursoActualId}`, { method: 'DELETE' });
        restantes = estudiantesCurso.slice();
        turnos = [];
        document.getElementById('resultadoGiro').textContent = 'Presiona "Girar la ruleta" para empezar';
        document.getElementById('estadoGuardadoInfo').textContent = '';
        dibujarRueda(restantes);
        pintarTurnos();
        actualizarControles();
        difundirSincronizacion();
        mostrarAlerta('alertaRuleta', 'Ruleta reiniciada.', 'exito');
    } catch (err) {
        mostrarAlerta('alertaRuleta', err.message);
    }
}

// ---------------------------------------------------------------------
// Sincronización con la ventana de proyección
// ---------------------------------------------------------------------
function difundirSincronizacion() {
    canalRuleta.postMessage({
        tipo: 'sync',
        cursoId: cursoActualId,
        cursoNombre: cursoActualNombre,
        estudiantesCurso,
        restantesIds: restantes.map(e => e.id),
        turnos,
    });
}

function aplicarSync(d) {
    cursoActualId = d.cursoId;
    cursoActualNombre = d.cursoNombre;
    estudiantesCurso = d.estudiantesCurso;
    restantes = estudiantesCurso.filter(e => d.restantesIds.includes(e.id));
    turnos = d.turnos;

    const cursoLabel = document.getElementById('proyeccionCurso');
    if (cursoLabel) cursoLabel.textContent = cursoActualNombre || 'Ruleta de Participación';

    if (restantes.length) dibujarRueda(restantes); else mostrarRuedaVacia('Todos participaron');
    pintarTurnos();
    const resultadoEl = document.getElementById('resultadoGiro');
    if (resultadoEl) {
        resultadoEl.textContent = turnos.length
            ? `Turno ${turnos[turnos.length - 1].turno}: ${turnos[turnos.length - 1].nombre}`
            : '—';
    }
}

canalRuleta.onmessage = (evento) => {
    const d = evento.data;

    if (d.tipo === 'solicitar_sync' && !esProyeccion && cursoActualId) {
        difundirSincronizacion();
        return;
    }

    if (d.tipo === 'sync' && esProyeccion) {
        aplicarSync(d);
        return;
    }

    if (d.tipo === 'girar' && esProyeccion) {
        const listaAntes = d.listaAntesIds.map(id => estudiantesCurso.find(e => e.id === id)).filter(Boolean);
        const ganador = estudiantesCurso.find(e => e.id === d.ganadorId);
        if (!ganador || listaAntes.length !== d.listaAntesIds.length) return; // datos aún no sincronizados
        ejecutarGiro({ listaAntes, indiceGanador: d.indiceGanador, anguloFinal: d.anguloFinal, ganador, turno: d.turno });
    }
};

// ---------------------------------------------------------------------
// Inicialización según la ventana
// ---------------------------------------------------------------------
if (!esProyeccion) {
    (async function inicializarControl() {
        try {
            cursos = await apiFetch('cursos.php');
            document.getElementById('curso').innerHTML =
                '<option value="">Selecciona un curso…</option>' +
                cursos.map(c => `<option value="${c.id}">${escaparHtml(c.nombre)}</option>`).join('');
        } catch (err) {
            mostrarAlerta('alertaRuleta', err.message);
        }

        document.getElementById('curso').addEventListener('change', cargarCursoSeleccionado);
        document.getElementById('btnGirar').addEventListener('click', girar);
        document.getElementById('btnGuardarEstado').addEventListener('click', guardarEstado);
        document.getElementById('btnReiniciar').addEventListener('click', reiniciar);
        document.getElementById('btnProyectar').addEventListener('click', () => {
            window.open(rutaBase('ruleta-proyeccion.html'), 'ruleta_proyeccion', 'width=1100,height=750');
        });
    })();
} else {
    mostrarRuedaVacia('Esperando…');
    canalRuleta.postMessage({ tipo: 'solicitar_sync' });
}
