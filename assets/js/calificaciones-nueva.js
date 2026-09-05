let cursoId, asignaturaId, asignatura, curso;
let competenciasDisponibles = [];
let contadorCriterio = 0;

// Modo edición: si la URL trae ?id=, se está editando una actividad ya
// creada en vez de crear una nueva. actividadExistente guarda lo que ya
// había (incluyendo los criterios con su id real), para precargar el
// formulario y para que al guardar sepamos qué UPDATE hacer.
let modoEdicion = false;
let actividadIdEdicion = null;
let actividadExistente = null;

// Textos de ayuda de la rúbrica, según el tipo de asignatura (cada
// componente tiene su propia lógica de evaluación, como pidió el docente).
const TEXTO_RUBRICA = {
    academica: 'Cada criterio puede evidenciar una o varias competencias específicas. Cambia el "Valor de la actividad" arriba y los pesos se reparten solos. Al calificar, la escala usada es Estratégico / Autónomo / Resolutivo / Receptivo / No realizada.',
    tecnico: 'Define los criterios/indicadores de desempeño de esta actividad técnica. Cambia el "Valor de la actividad" arriba y su peso en puntos se reparte solo. Al calificar, la escala usada es Domina / Competente / En desarrollo / Inicial / No ejecutada.',
    taller: 'Define los criterios de evaluación del taller. Cambia el "Valor de la actividad" arriba y su peso en puntos se reparte solo. Al calificar, la escala usada es Sobresaliente / Satisfactorio / Aceptable / Insuficiente / No realizada.',
};

function parametros() {
    const p = new URLSearchParams(window.location.search);
    return { cursoId: p.get('curso_id'), asignaturaId: p.get('asignatura_id'), id: p.get('id') };
}

async function inicializar() {
    const params = parametros();
    actividadIdEdicion = params.id;
    modoEdicion = !!actividadIdEdicion;

    if (modoEdicion) {
        try {
            actividadExistente = await apiFetch(`calif_actividades.php?id=${actividadIdEdicion}`);
            cursoId = actividadExistente.curso_id;
            asignaturaId = actividadExistente.asignatura_id;
        } catch (err) {
            mostrarAlerta('alertaNuevaActividad', err.message);
            document.getElementById('btnGuardarActividad').disabled = true;
            return;
        }
        document.getElementById('tituloPagina').textContent = 'Editar actividad';
        document.getElementById('btnGuardarActividad').textContent = 'Guardar cambios';
        document.getElementById('avisoEdicion').classList.remove('is-hidden');
    } else {
        cursoId = params.cursoId;
        asignaturaId = params.asignaturaId;
    }

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

        if (modoEdicion) {
            document.getElementById('nombre').value = actividadExistente.nombre || '';
            document.getElementById('descripcion').value = actividadExistente.descripcion || '';
            const valorInput = document.getElementById('valorActividad');
            valorInput.value = actividadExistente.valor_maximo;
            valorInput.dataset.tocado = '1'; // no lo pise ninguna plantilla
        }

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

    if (modoEdicion) {
        // No se dispara el evento "change": elegir la plantilla de nuevo
        // reemplazaría los criterios ya guardados. Solo se muestra cuál
        // se había usado, y se pintan los criterios TAL COMO ESTÁN.
        if (actividadExistente.tipo_actividad_id) select.value = actividadExistente.tipo_actividad_id;
        (actividadExistente.criterios || []).forEach(c => {
            agregarFilaCriterio(c.nombre, c.peso, c.competencia_ids || [], c.id);
        });
        if (!actividadExistente.criterios || !actividadExistente.criterios.length) agregarFilaCriterio();
        recalcularTotal();
    } else {
        agregarFilaCriterio(); // arranca con una fila vacía por si el docente no elige un tipo
        distribuirIgualEntreAuto();
    }
}

async function cargarPlantillaIndicadores(selectId) {
    if (modoEdicion && !confirm('Cambiar la plantilla reemplaza los criterios actuales por los de la nueva plantilla, y los criterios que quites perderán las calificaciones que ya tuvieran. ¿Continuar?')) {
        // Deshace la selección visualmente, dejando el valor que tenía antes
        const select = document.getElementById(selectId);
        select.value = actividadExistente.tipo_actividad_id || '';
        return;
    }

    const tipoId = document.getElementById(selectId).value;
    document.getElementById('listaCriterios').innerHTML = '';
    if (!tipoId) { agregarFilaCriterio(); distribuirIgualEntreAuto(); return; }

    try {
        const data = await apiFetch(`calif_tipos_actividad.php?tipo_actividad_id=${tipoId}`);
        if (!data.indicadores.length) { agregarFilaCriterio(); distribuirIgualEntreAuto(); return; }

        // Si el docente todavía no tocó el "Valor de la actividad", lo
        // autocompletamos con la suma de los pesos sugeridos de la
        // plantilla. Si ya lo había definido, respetamos ese valor y
        // solo tomamos los NOMBRES de los indicadores de la plantilla;
        // el peso de cada uno se reparte según ese valor.
        const valorInput = document.getElementById('valorActividad');
        if (valorInput.dataset.tocado !== '1') {
            const sumaSugerida = data.indicadores.reduce((s, ind) => s + (parseFloat(ind.peso_sugerido) || 0), 0);
            valorInput.value = sumaSugerida.toFixed(2);
        }

        data.indicadores.forEach(ind => agregarFilaCriterio(ind.nombre, 0));
        distribuirIgualEntreAuto();
    } catch (err) {
        mostrarAlerta('alertaNuevaActividad', err.message);
        agregarFilaCriterio();
        distribuirIgualEntreAuto();
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
    if (modoEdicion && actividadExistente.periodo_id) document.getElementById('periodoTaller').value = actividadExistente.periodo_id;

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
    if (modoEdicion && actividadExistente.unidad_id) selectRA.value = actividadExistente.unidad_id;
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
    if (modoEdicion && actividadExistente.periodo_id) document.getElementById('periodoAcademica').value = actividadExistente.periodo_id;

    if (!competencias.length) {
        mostrarAlerta('alertaNuevaActividad', 'Esta asignatura todavía no tiene competencias específicas registradas. Puedes crear la actividad igual, y agregar competencias más tarde desde "Competencias".', 'info');
    }

    await cargarSelectorTipoActividad('tipoActividad', competencias);
}

// ---------------------------------------------------------------------
// Criterios de la rúbrica (compartido por los 3 tipos)
// ---------------------------------------------------------------------
function agregarFilaCriterio(nombre = '', peso = 0, competenciaIds = [], criterioId = null) {
    const idx = contadorCriterio++;
    const div = document.createElement('div');
    div.className = 'card';
    div.style.background = 'var(--color-surface-alt)';
    div.style.marginBottom = '10px';
    div.dataset.criterioIdx = idx;
    div.dataset.pesoManual = '0';
    div.dataset.criterioId = criterioId || '';

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
                <input type="number" class="crit-peso" min="0" step="0.01" value="${peso}">
            </div>
            <button type="button" class="btn peligro chico" onclick="quitarFilaCriterio(this)">Quitar</button>
        </div>
        ${competenciasDisponibles.length ? `<div class="campo"><label>Competencia(s) específica(s) que evidencia</label><div>${checkboxes}</div></div>` : ''}
    `;
    document.getElementById('listaCriterios').appendChild(div);

    // Si el docente edita el peso a mano, esa fila queda "fija" y deja de
    // participar en el reparto automático (el resto del valor se sigue
    // repartiendo entre las filas que no ha tocado).
    div.querySelector('.crit-peso').addEventListener('input', () => {
        div.dataset.pesoManual = '1';
        recalcularTotal();
    });
    recalcularTotal();
}
window.recalcularTotal = recalcularTotal;

function quitarFilaCriterio(boton) {
    const fila = boton.closest('[data-criterio-idx]');
    if (fila.dataset.criterioId) {
        if (!confirm('Este criterio ya tiene calificaciones registradas. Si lo quitas, esas calificaciones se pierden. ¿Continuar?')) return;
    }
    fila.remove();
    distribuirIgualEntreAuto();
}
window.quitarFilaCriterio = quitarFilaCriterio;

function valorObjetivo() {
    return parseFloat(document.getElementById('valorActividad').value) || 0;
}

// Reparte el valor de la actividad entre los criterios que el docente no
// haya editado manualmente. Las filas fijadas a mano conservan su peso,
// y el resto del valor se reparte EN PARTES IGUALES entre las demás.
function distribuirIgualEntreAuto() {
    const filas = Array.from(document.querySelectorAll('[data-criterio-idx]'));
    const objetivo = valorObjetivo();
    const filasAuto = filas.filter(f => f.dataset.pesoManual !== '1');
    const sumaManual = filas
        .filter(f => f.dataset.pesoManual === '1')
        .reduce((s, f) => s + (parseFloat(f.querySelector('.crit-peso').value) || 0), 0);

    if (filasAuto.length > 0) {
        const restante = Math.max(objetivo - sumaManual, 0);
        const partes = filasAuto.map(() => Math.floor((restante / filasAuto.length) * 100) / 100);
        const asignado = partes.reduce((s, p) => s + p, 0);
        // El último criterio absorbe la diferencia por redondeo, así el
        // total siempre cuadra exacto con el valor de la actividad.
        partes[partes.length - 1] = Math.round((partes[partes.length - 1] + (restante - asignado)) * 100) / 100;

        filasAuto.forEach((fila, i) => {
            fila.querySelector('.crit-peso').value = partes[i];
        });
    }
    recalcularTotal();
}

// Reparte proporcionalmente entre las filas no fijadas, conservando la
// proporción que ya tenían entre sí (se usa cuando el docente cambia el
// valor de la actividad después de ya tener pesos distintos por criterio).
function redistribuirProporcional() {
    const filas = Array.from(document.querySelectorAll('[data-criterio-idx]'));
    const objetivo = valorObjetivo();
    const filasAuto = filas.filter(f => f.dataset.pesoManual !== '1');
    const sumaManual = filas
        .filter(f => f.dataset.pesoManual === '1')
        .reduce((s, f) => s + (parseFloat(f.querySelector('.crit-peso').value) || 0), 0);

    if (filasAuto.length === 0) { recalcularTotal(); return; }

    const restante = Math.max(objetivo - sumaManual, 0);
    const sumaActualAuto = filasAuto.reduce((s, f) => s + (parseFloat(f.querySelector('.crit-peso').value) || 0), 0);

    let partes;
    if (sumaActualAuto > 0) {
        partes = filasAuto.map(f => {
            const actual = parseFloat(f.querySelector('.crit-peso').value) || 0;
            return Math.floor((restante * (actual / sumaActualAuto)) * 100) / 100;
        });
    } else {
        partes = filasAuto.map(() => Math.floor((restante / filasAuto.length) * 100) / 100);
    }
    const asignado = partes.reduce((s, p) => s + p, 0);
    partes[partes.length - 1] = Math.round((partes[partes.length - 1] + (restante - asignado)) * 100) / 100;

    filasAuto.forEach((fila, i) => {
        fila.querySelector('.crit-peso').value = partes[i];
    });
    recalcularTotal();
}

function recalcularTotal() {
    let total = 0;
    document.querySelectorAll('.crit-peso').forEach(inp => { total += parseFloat(inp.value) || 0; });
    const objetivo = valorObjetivo();
    document.getElementById('valorTotalCriterios').textContent = total.toFixed(2);
    document.getElementById('valorObjetivoTexto').textContent = objetivo.toFixed(2);

    const cuadra = Math.abs(total - objetivo) < 0.01;
    document.getElementById('avisoDescuadre').style.display = cuadra ? 'none' : 'inline';
    const btnGuardar = document.getElementById('btnGuardarActividad');
    if (btnGuardar) btnGuardar.disabled = !cuadra || objetivo <= 0;
}

document.getElementById('btnAgregarCriterio').addEventListener('click', () => {
    agregarFilaCriterio();
    distribuirIgualEntreAuto();
});

document.getElementById('btnDistribuirIgual').addEventListener('click', () => {
    // Botón "reiniciar reparto": libera todas las filas fijadas a mano y
    // vuelve a repartir el valor de la actividad en partes iguales.
    document.querySelectorAll('[data-criterio-idx]').forEach(f => { f.dataset.pesoManual = '0'; });
    distribuirIgualEntreAuto();
});

document.getElementById('valorActividad').addEventListener('input', (e) => {
    e.target.dataset.tocado = '1';
    redistribuirProporcional();
});

// ---------------------------------------------------------------------
// Guardar
// ---------------------------------------------------------------------
document.getElementById('btnGuardarActividad').addEventListener('click', async () => {
    const nombre = document.getElementById('nombre').value.trim();
    if (!nombre) { mostrarAlerta('alertaNuevaActividad', 'Ponle un nombre a la actividad.'); return; }

    const valorActividad = valorObjetivo();
    if (valorActividad <= 0) { mostrarAlerta('alertaNuevaActividad', 'Indica el valor de la actividad (mayor que cero).'); return; }

    const body = {
        curso_id: cursoId,
        asignatura_id: asignaturaId,
        nombre,
        descripcion: document.getElementById('descripcion').value.trim(),
        valor_actividad: valorActividad,
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

    const filas = Array.from(document.querySelectorAll('[data-criterio-idx]'));
    if (!filas.length) { mostrarAlerta('alertaNuevaActividad', 'Agrega al menos un criterio de evaluación.'); return; }

    const criterios = [];
    for (const row of filas) {
        const nombreCrit = row.querySelector('.crit-nombre').value.trim();
        const peso = parseFloat(row.querySelector('.crit-peso').value) || 0;
        if (!nombreCrit) { mostrarAlerta('alertaNuevaActividad', 'Todos los criterios necesitan un nombre.'); return; }
        if (peso <= 0) { mostrarAlerta('alertaNuevaActividad', `El criterio "${nombreCrit}" no puede tener un peso de 0. Quítalo o repártele algo de valor.`); return; }
        const competenciaIds = Array.from(row.querySelectorAll('.chk-competencia:checked')).map(chk => parseInt(chk.value));
        const criterio = { nombre: nombreCrit, peso, competencia_ids: competenciaIds };
        if (row.dataset.criterioId) criterio.id = parseInt(row.dataset.criterioId);
        criterios.push(criterio);
    }

    const sumaCriterios = criterios.reduce((s, c) => s + c.peso, 0);
    if (Math.abs(sumaCriterios - valorActividad) >= 0.01) {
        mostrarAlerta('alertaNuevaActividad', `La suma de los criterios (${sumaCriterios.toFixed(2)}) no coincide con el valor de la actividad (${valorActividad.toFixed(2)}). Usa "Repartir en partes iguales" o ajusta los pesos.`);
        return;
    }
    body.criterios = criterios;

    const btn = document.getElementById('btnGuardarActividad');
    btn.disabled = true;
    btn.textContent = 'Guardando…';

    try {
        if (modoEdicion) {
            body.id = actividadIdEdicion;
            const res = await apiFetch('calif_actividades.php', { method: 'PUT', body });
            const n = res.estudiantes_actualizados || 0;
            alert(n > 0
                ? `Actividad actualizada. Se recalcularon las calificaciones de ${n} estudiante(s) según el nuevo valor.`
                : 'Actividad actualizada.');
        } else {
            await apiFetch('calif_actividades.php', { method: 'POST', body });
        }
        window.location.href = `${rutaBase('calificaciones.html')}`;
    } catch (err) {
        mostrarAlerta('alertaNuevaActividad', err.message);
        btn.disabled = false;
        btn.textContent = modoEdicion ? 'Guardar cambios' : 'Guardar actividad';
    }
});

inicializar();
