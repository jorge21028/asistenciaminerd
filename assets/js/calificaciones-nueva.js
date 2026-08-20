let cursoId, asignaturaId, asignatura, curso;
let competenciasDisponibles = [];
let contadorCriterio = 0;

// Textos de ayuda de la rúbrica, según el tipo de asignatura (cada
// componente tiene su propia lógica de evaluación, como pidió el docente).
const TEXTO_RUBRICA = {
    academica: 'Cada criterio puede evidenciar una o varias competencias específicas. El valor de la actividad es la suma de los pesos. Al calificar, la escala usada es Estratégico / Autónomo / Resolutivo / Receptivo / No realizada.',
    tecnico: 'Define los criterios/indicadores de desempeño de esta actividad técnica y su peso en puntos. Al calificar, la escala usada es Domina / Competente / En desarrollo / Inicial / No ejecutada.',
    taller: 'Define los criterios de evaluación del taller y su peso en puntos. Al calificar, la escala usada es Sobresaliente / Satisfactorio / Aceptable / Insuficiente / No realizada.',
};

function parametros() {
    const p = new URLSearchParams(window.location.search);
    return { cursoId: p.get('curso_id'), asignaturaId: p.get('asignatura_id') };
}

async function inicializar() {
    const params = parametros();
    cursoId = params.cursoId;
    asignaturaId = params.asignaturaId;

    if (!cursoId || !asignaturaId) {
        mostrarAlerta('alertaNuevaActividad', 'Falta indicar el curso y la asignatura. Vuelve a "Calificaciones" y elige una combinación primero.');
        document.getElementById('btnGuardarActividad').disabled = true;
        return;
    }

    try {
        const [asignaturas, cursos] = await Promise.all([apiFetch('asignaturas.php'), apiFetch('cursos.php')]);
        asignatura = asignaturas.find(a => String(a.id) === String(asignaturaId));
        curso = cursos.find(c => String(c.id) === String(cursoId));

        if (!asignatura || !curso) throw new Error('No se encontró el curso o la asignatura indicados.');

        document.getElementById('subtituloContexto').innerHTML =
            `<a href="${rutaBase('calificaciones.html')}">← Calificaciones</a> · ${escaparHtml(curso.nombre)} — ${escaparHtml(asignatura.nombre)}`;

        document.getElementById('textoRubrica').textContent = TEXTO_RUBRICA[asignatura.tipo] || TEXTO_RUBRICA.academica;
        document.getElementById('cardRubrica').style.display = 'block';

        if (asignatura.tipo === 'taller') await inicializarTaller();
        else if (asignatura.tipo === 'tecnico') await inicializarTecnico();
        else await inicializarAcademica();
    } catch (err) {
        mostrarAlerta('alertaNuevaActividad', err.message);
    }
}

// ---------------------------------------------------------------------
// Catálogo de tipos de actividad + competencias (compartido por los 3 tipos)
// ---------------------------------------------------------------------
async function cargarSelectorTipoActividad(selectId, competencias) {
    competenciasDisponibles = competencias || [];
    const select = document.getElementById(selectId);
    const tiposData = await apiFetch('calif_tipos_actividad.php');
    select.innerHTML += tiposData.tipos.map(t => `<option value="${t.id}">${escaparHtml(t.nombre)}</option>`).join('');
    select.addEventListener('change', () => cargarPlantillaIndicadores(selectId));
    agregarFilaCriterio(); // arranca con una fila vacía por si el docente no elige un tipo
}

async function cargarPlantillaIndicadores(selectId) {
    const tipoId = document.getElementById(selectId).value;
    document.getElementById('listaCriterios').innerHTML = '';
    if (!tipoId) { agregarFilaCriterio(); return; }

    try {
        const data = await apiFetch(`calif_tipos_actividad.php?tipo_actividad_id=${tipoId}`);
        if (!data.indicadores.length) { agregarFilaCriterio(); return; }
        data.indicadores.forEach(ind => agregarFilaCriterio(ind.nombre, ind.peso_sugerido));
    } catch (err) {
        mostrarAlerta('alertaNuevaActividad', err.message);
        agregarFilaCriterio();
    }
}

// ---------------------------------------------------------------------
// TALLER
// ---------------------------------------------------------------------
async function inicializarTaller() {
    document.getElementById('campoPeriodoTaller').style.display = 'flex';
    const periodos = await apiFetch(`periodos.php?anio_escolar=${encodeURIComponent(curso.anio_escolar)}`);
    document.getElementById('periodoTaller').innerHTML = periodos.length
        ? periodos.map(p => `<option value="${p.id}">${escaparHtml(p.nombre)}</option>`).join('')
        : '<option value="">— No hay períodos para este año escolar —</option>';

    await cargarSelectorTipoActividad('tipoActividadTaller', []);
}

// ---------------------------------------------------------------------
// TÉCNICO
// ---------------------------------------------------------------------
async function inicializarTecnico() {
    document.getElementById('campoTecnico').style.display = 'block';
    const [ras, periodos] = await Promise.all([
        apiFetch(`asignatura_unidades.php?asignatura_id=${asignaturaId}`),
        apiFetch('periodos.php'),
    ]);

    const selectRA = document.getElementById('ra');
    selectRA.innerHTML = ras.length
        ? ras.map(r => `<option value="${r.id}" data-valor="${r.valor ?? ''}" data-periodo="${r.periodo_id ?? ''}">${escaparHtml(r.codigo ? r.codigo + ': ' : '')}${escaparHtml(r.titulo)}</option>`).join('')
        : '<option value="">— No hay RA creados para esta asignatura —</option>';

    function actualizarInfoRA() {
        const opt = selectRA.options[selectRA.selectedIndex];
        if (!opt || !opt.value) { document.getElementById('infoRA').textContent = ''; return; }
        const periodo = periodos.find(p => String(p.id) === String(opt.dataset.periodo));
        document.getElementById('infoRA').textContent =
            `Valor total del RA: ${opt.dataset.valor || '—'} puntos · Período: ${periodo ? periodo.nombre : 'sin asignar'} — el valor de esta actividad (suma de sus criterios) debe ser parte de ese total.`;
    }
    selectRA.addEventListener('change', actualizarInfoRA);
    actualizarInfoRA();

    await cargarSelectorTipoActividad('tipoActividadTecnico', []);
}

// ---------------------------------------------------------------------
// ACADÉMICA
// ---------------------------------------------------------------------
async function inicializarAcademica() {
    document.getElementById('campoPeriodoAcademica').style.display = 'flex';

    const [periodos, competencias] = await Promise.all([
        apiFetch(`periodos.php?anio_escolar=${encodeURIComponent(curso.anio_escolar)}`),
        apiFetch(`competencias.php?asignatura_id=${asignaturaId}`),
    ]);

    document.getElementById('periodoAcademica').innerHTML = periodos.length
        ? periodos.map(p => `<option value="${p.id}">${escaparHtml(p.nombre)}</option>`).join('')
        : '<option value="">— No hay períodos para este año escolar —</option>';

    if (!competencias.length) {
        mostrarAlerta('alertaNuevaActividad', 'Esta asignatura todavía no tiene competencias específicas registradas. Puedes crear la actividad igual, y agregar competencias más tarde desde "Competencias".', 'info');
    }

    await cargarSelectorTipoActividad('tipoActividad', competencias);
}

// ---------------------------------------------------------------------
// Criterios de la rúbrica (compartido por los 3 tipos)
// ---------------------------------------------------------------------
function agregarFilaCriterio(nombre = '', peso = 4, competenciaIds = []) {
    const idx = contadorCriterio++;
    const div = document.createElement('div');
    div.className = 'card';
    div.style.background = 'var(--color-surface-alt)';
    div.style.marginBottom = '10px';
    div.dataset.criterioIdx = idx;

    const checkboxes = competenciasDisponibles.map(c => `
        <label style="display:inline-flex; align-items:center; gap:5px; font-weight:400; font-size:0.82rem; margin-right:14px;">
            <input type="checkbox" class="chk-competencia" value="${c.id}" ${competenciaIds.includes(c.id) ? 'checked' : ''} style="width:auto;">
            ${escaparHtml(c.codigo ? c.codigo + ': ' : '')}${escaparHtml(c.descripcion)}
        </label>
    `).join('');

    div.innerHTML = `
        <div class="fila-form">
            <div class="campo" style="flex:3;">
                <label>Criterio / indicador</label>
                <input type="text" class="crit-nombre" value="${escaparHtml(nombre)}" placeholder="Ej: Dominio del tema">
            </div>
            <div class="campo" style="max-width:110px;">
                <label>Peso (puntos)</label>
                <input type="number" class="crit-peso" min="0.01" step="0.01" value="${peso}">
            </div>
            <button type="button" class="btn peligro chico" onclick="this.closest('[data-criterio-idx]').remove(); recalcularTotal();">Quitar</button>
        </div>
        ${competenciasDisponibles.length ? `<div class="campo"><label>Competencia(s) específica(s) que evidencia</label><div>${checkboxes}</div></div>` : ''}
    `;
    document.getElementById('listaCriterios').appendChild(div);
    div.querySelector('.crit-peso').addEventListener('input', recalcularTotal);
    recalcularTotal();
}
window.recalcularTotal = recalcularTotal;

function recalcularTotal() {
    let total = 0;
    document.querySelectorAll('.crit-peso').forEach(inp => { total += parseFloat(inp.value) || 0; });
    document.getElementById('valorTotalCriterios').textContent = total.toFixed(2);
}

document.getElementById('btnAgregarCriterio').addEventListener('click', () => agregarFilaCriterio());

// ---------------------------------------------------------------------
// Guardar
// ---------------------------------------------------------------------
document.getElementById('btnGuardarActividad').addEventListener('click', async () => {
    const nombre = document.getElementById('nombre').value.trim();
    if (!nombre) { mostrarAlerta('alertaNuevaActividad', 'Ponle un nombre a la actividad.'); return; }

    const body = {
        curso_id: cursoId,
        asignatura_id: asignaturaId,
        nombre,
        descripcion: document.getElementById('descripcion').value.trim(),
    };

    if (asignatura.tipo === 'taller') {
        body.periodo_id = document.getElementById('periodoTaller').value;
        body.tipo_actividad_id = document.getElementById('tipoActividadTaller').value || null;
        if (!body.periodo_id) { mostrarAlerta('alertaNuevaActividad', 'Selecciona un período.'); return; }
    } else if (asignatura.tipo === 'tecnico') {
        body.unidad_id = document.getElementById('ra').value;
        body.tipo_actividad_id = document.getElementById('tipoActividadTecnico').value || null;
        if (!body.unidad_id) { mostrarAlerta('alertaNuevaActividad', 'Selecciona el RA.'); return; }
    } else {
        body.periodo_id = document.getElementById('periodoAcademica').value;
        body.tipo_actividad_id = document.getElementById('tipoActividad').value || null;
        if (!body.periodo_id) { mostrarAlerta('alertaNuevaActividad', 'Selecciona un período.'); return; }
    }

    const criterios = [];
    document.querySelectorAll('[data-criterio-idx]').forEach(row => {
        const nombreCrit = row.querySelector('.crit-nombre').value.trim();
        const peso = parseFloat(row.querySelector('.crit-peso').value) || 0;
        if (!nombreCrit || peso <= 0) return;
        const competenciaIds = Array.from(row.querySelectorAll('.chk-competencia:checked')).map(chk => parseInt(chk.value));
        criterios.push({ nombre: nombreCrit, peso, competencia_ids: competenciaIds });
    });
    if (!criterios.length) { mostrarAlerta('alertaNuevaActividad', 'Agrega al menos un criterio de evaluación con su peso.'); return; }
    body.criterios = criterios;

    const btn = document.getElementById('btnGuardarActividad');
    btn.disabled = true;
    btn.textContent = 'Guardando…';

    try {
        await apiFetch('calif_actividades.php', { method: 'POST', body });
        window.location.href = `${rutaBase('calificaciones.html')}`;
    } catch (err) {
        mostrarAlerta('alertaNuevaActividad', err.message);
        btn.disabled = false;
        btn.textContent = 'Guardar actividad';
    }
});

inicializar();
