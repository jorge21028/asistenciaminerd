const NIVELES = [
    { valor: 'estrategico', etiqueta: 'Estratégico' },
    { valor: 'autonomo', etiqueta: 'Autónomo' },
    { valor: 'resolutivo', etiqueta: 'Resolutivo' },
    { valor: 'receptivo', etiqueta: 'Receptivo' },
    { valor: 'no_realizada', etiqueta: 'No realizada' },
];
const MULTIPLICADOR_NIVEL = { estrategico: 1, autonomo: 0.75, resolutivo: 0.5, receptivo: 0.25, no_realizada: 0 };

let actividadId;
let notaMinima = 70;
let esRubrica = false;

function badgeEstado(pct) {
    if (pct === null || pct === undefined) return '<span class="badge">Sin calificar</span>';
    const aprobado = pct >= notaMinima;
    return `<span class="badge ${aprobado ? 'badge-aprobado' : 'badge-reprobado'}">${aprobado ? 'Aprobado' : 'Reprobado'} (${pct.toFixed(1)}%)</span>`;
}

async function inicializar() {
    const params = new URLSearchParams(window.location.search);
    actividadId = params.get('id');
    if (!actividadId) { mostrarAlerta('alertaCalificar', 'No se indicó qué actividad calificar.'); return; }

    try {
        const actividad = await apiFetch(`calif_actividades.php?id=${actividadId}`);
        notaMinima = parseFloat(actividad.nota_minima);
        document.getElementById('tituloActividad').textContent = actividad.nombre;
        const referencia = actividad.unidad_titulo
            ? `${actividad.unidad_codigo ? actividad.unidad_codigo + ': ' : ''}${actividad.unidad_titulo}`
            : (actividad.periodo_nombre || '');
        document.getElementById('subtituloActividad').innerHTML =
            `<a href="${rutaBase('calificaciones.html')}">← Calificaciones</a> · ${escaparHtml(actividad.curso_nombre)} — ${escaparHtml(actividad.asignatura_nombre)} · ${escaparHtml(referencia)} · Valor: ${actividad.valor_maximo} pts · Nota mínima: ${notaMinima}%`;

        if (actividad.asignatura_tipo === 'academica') {
            esRubrica = true;
            await cargarModoRubrica();
        } else {
            await cargarModoSimple();
        }
        document.getElementById('cardGuardar').style.display = 'block';
    } catch (err) {
        mostrarAlerta('alertaCalificar', err.message);
    }
}

// ---------------------------------------------------------------------
// MODO SIMPLE (taller / técnico)
// ---------------------------------------------------------------------
async function cargarModoSimple() {
    const data = await apiFetch(`calif_calificaciones.php?actividad_id=${actividadId}`);
    const valorMaximo = parseFloat(data.actividad.valor_maximo);

    document.getElementById('cardSimple').style.display = 'block';
    document.getElementById('tablaSimple').innerHTML = data.estudiantes.map(e => `
        <tr data-fila="${e.estudiante_id}">
            <td class="nombre-estudiante">${escaparHtml(e.nombre)} ${escaparHtml(e.apellido)}</td>
            <td class="num"><input type="number" class="input-punt" min="0" max="${valorMaximo}" step="0.01"
                value="${e.puntuacion_obtenida ?? ''}" data-id="${e.estudiante_id}" style="width:90px; text-align:center; padding:6px; border:1px solid var(--color-line); border-radius:6px;"></td>
            <td class="num" id="pct-${e.estudiante_id}">${e.puntuacion_obtenida !== null ? ((e.puntuacion_obtenida / valorMaximo) * 100).toFixed(1) + '%' : '—'}</td>
            <td class="num" id="estado-${e.estudiante_id}">${badgeEstado(e.puntuacion_obtenida !== null ? (e.puntuacion_obtenida / valorMaximo) * 100 : null)}</td>
            <td><input type="text" class="input-obs" data-id="${e.estudiante_id}" value="${escaparHtml(e.observaciones || '')}" style="width:100%; padding:6px; border:1px solid var(--color-line); border-radius:6px;"></td>
        </tr>
    `).join('');

    document.querySelectorAll('.input-punt').forEach(input => {
        input.addEventListener('input', () => {
            const id = input.dataset.id;
            const valor = parseFloat(input.value);
            const pct = !isNaN(valor) ? (valor / valorMaximo) * 100 : null;
            document.getElementById(`pct-${id}`).textContent = pct !== null ? pct.toFixed(1) + '%' : '—';
            document.getElementById(`estado-${id}`).innerHTML = badgeEstado(pct);
        });
    });

    document.getElementById('btnGuardarCalificaciones').addEventListener('click', async () => {
        const registros = [];
        document.querySelectorAll('.input-punt').forEach(input => {
            if (input.value === '') return;
            const fila = input.closest('tr');
            registros.push({
                estudiante_id: input.dataset.id,
                puntuacion_obtenida: input.value,
                observaciones: fila.querySelector('.input-obs').value,
            });
        });
        await guardarSimple(registros);
    });
}

async function guardarSimple(registros) {
    const btn = document.getElementById('btnGuardarCalificaciones');
    btn.disabled = true;
    btn.textContent = 'Guardando…';
    try {
        await apiFetch('calif_calificaciones.php', { method: 'POST', body: { actividad_id: actividadId, registros } });
        mostrarAlerta('alertaCalificar', 'Calificaciones guardadas.', 'exito');
    } catch (err) {
        mostrarAlerta('alertaCalificar', err.message);
    }
    btn.disabled = false;
    btn.textContent = 'Guardar calificaciones';
}

// ---------------------------------------------------------------------
// MODO RÚBRICA (académica)
// ---------------------------------------------------------------------
async function cargarModoRubrica() {
    const data = await apiFetch(`calif_calificaciones_criterio.php?actividad_id=${actividadId}`);
    const { criterios, estudiantes, calificaciones } = data;

    document.getElementById('cardRubrica').style.display = 'block';
    const tabla = document.getElementById('tablaRubrica');

    const thead = '<thead><tr><th>Estudiante</th>' +
        criterios.map(c => `<th>${escaparHtml(c.nombre)}<br><span style="font-weight:400;">(${c.peso} pts)</span></th>`).join('') +
        '<th class="num">Total</th><th class="num">Estado</th></tr></thead>';

    const tbody = '<tbody>' + estudiantes.map(e => {
        const celdas = criterios.map(c => {
            const clave = `${c.id}:${e.id}`;
            const existente = calificaciones[clave];
            const nivel = existente ? existente.nivel : 'estrategico';
            return `<td>
                <select class="nivel-select nivel-${nivel}" data-est="${e.id}" data-crit="${c.id}" data-peso="${c.peso}">
                    ${NIVELES.map(n => `<option value="${n.valor}" ${n.valor === nivel ? 'selected' : ''}>${n.etiqueta}</option>`).join('')}
                </select>
            </td>`;
        }).join('');
        return `<tr data-fila-est="${e.id}">
            <td class="nombre-estudiante">${escaparHtml(e.nombre)} ${escaparHtml(e.apellido)}</td>
            ${celdas}
            <td class="num" id="total-${e.id}">—</td>
            <td class="num" id="estadoRub-${e.id}">—</td>
        </tr>`;
    }).join('') + '</tbody>';

    tabla.innerHTML = thead + tbody;

    const valorMaximo = criterios.reduce((s, c) => s + parseFloat(c.peso), 0);

    function recalcularFila(estudianteId) {
        let total = 0;
        document.querySelectorAll(`select[data-est="${estudianteId}"]`).forEach(sel => {
            const peso = parseFloat(sel.dataset.peso);
            total += peso * MULTIPLICADOR_NIVEL[sel.value];
        });
        document.getElementById(`total-${estudianteId}`).textContent = `${total.toFixed(2)} / ${valorMaximo}`;
        const pct = valorMaximo > 0 ? (total / valorMaximo) * 100 : null;
        document.getElementById(`estadoRub-${estudianteId}`).innerHTML = badgeEstado(pct);
    }

    document.querySelectorAll('.nivel-select').forEach(sel => {
        sel.addEventListener('change', () => {
            sel.className = `nivel-select nivel-${sel.value}`;
            recalcularFila(sel.dataset.est);
        });
        recalcularFila(sel.dataset.est);
    });

    document.getElementById('btnGuardarCalificaciones').addEventListener('click', async () => {
        const registros = [];
        document.querySelectorAll('.nivel-select').forEach(sel => {
            registros.push({ estudiante_id: sel.dataset.est, criterio_id: sel.dataset.crit, nivel: sel.value });
        });
        const btn = document.getElementById('btnGuardarCalificaciones');
        btn.disabled = true;
        btn.textContent = 'Guardando…';
        try {
            await apiFetch('calif_calificaciones_criterio.php', { method: 'POST', body: { actividad_id: actividadId, calificaciones: registros } });
            mostrarAlerta('alertaCalificar', 'Rúbrica guardada.', 'exito');
        } catch (err) {
            mostrarAlerta('alertaCalificar', err.message);
        }
        btn.disabled = false;
        btn.textContent = 'Guardar calificaciones';
    });
}

inicializar();
