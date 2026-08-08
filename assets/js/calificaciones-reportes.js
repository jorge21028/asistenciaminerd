let combosReportesCalif = [];
let mapaAsignaturasReportes = {};
let cursosReportes = [];

function paramsURL() { return new URLSearchParams(window.location.search); }

async function inicializar() {
    try {
        const [combos, asignaturas, cursos] = await Promise.all([
            apiFetch('asignaciones.php'), apiFetch('asignaturas.php'), apiFetch('cursos.php'),
        ]);
        combosReportesCalif = combos;
        cursosReportes = cursos;
        asignaturas.forEach(a => { mapaAsignaturasReportes[a.id] = a; });

        document.getElementById('cursoAsignatura').innerHTML =
            '<option value="">Selecciona…</option>' +
            combos.map(c => `<option value="${c.curso_id}:${c.asignatura_id}">${escaparHtml(c.curso_nombre)} — ${escaparHtml(c.asignatura_nombre)}</option>`).join('');

        const params = paramsURL();
        if (params.get('curso_id') && params.get('asignatura_id')) {
            document.getElementById('cursoAsignatura').value = `${params.get('curso_id')}:${params.get('asignatura_id')}`;
        }
        if (params.get('tipo')) document.getElementById('tipoReporte').value = params.get('tipo');

        await actualizarOpcionesTipo();
        await cargarSubselectores();

        if (params.get('actividad_id')) document.getElementById('selectActividad').value = params.get('actividad_id');
        if (params.get('unidad_id')) document.getElementById('selectUnidad').value = `ra:${params.get('unidad_id')}`;
        if (params.get('competencia_id')) document.getElementById('selectUnidad').value = `comp:${params.get('competencia_id')}`;
        if (params.get('periodo_id')) document.getElementById('selectPeriodo').value = params.get('periodo_id');

        mostrarCamposSegunTipo();
        if (params.get('tipo')) generarReporte();
    } catch (err) {
        mostrarAlerta('alertaReportesCalif', err.message);
    }
}

function comboActualReportes() {
    const valor = document.getElementById('cursoAsignatura').value;
    if (!valor) return null;
    const [cursoId, asignaturaId] = valor.split(':');
    return { cursoId, asignaturaId, asignatura: mapaAsignaturasReportes[asignaturaId], curso: cursosReportes.find(c => String(c.id) === cursoId) };
}

async function actualizarOpcionesTipo() {
    const combo = comboActualReportes();
    const optUnidad = document.querySelector('#tipoReporte option[value="unidad"]');
    if (combo && combo.asignatura && combo.asignatura.tipo === 'taller') {
        optUnidad.disabled = true;
        optUnidad.textContent = 'Por RA / competencia (no aplica a taller)';
        if (document.getElementById('tipoReporte').value === 'unidad') document.getElementById('tipoReporte').value = 'periodo';
    } else {
        optUnidad.disabled = false;
        optUnidad.textContent = 'Por RA / competencia';
    }
    document.getElementById('labelSelectUnidad').textContent = (combo && combo.asignatura && combo.asignatura.tipo === 'tecnico') ? 'RA' : 'Competencia';
}

function mostrarCamposSegunTipo() {
    const tipo = document.getElementById('tipoReporte').value;
    document.getElementById('campoActividad').style.display = tipo === 'actividad' ? 'flex' : 'none';
    document.getElementById('campoUnidad').style.display = tipo === 'unidad' ? 'flex' : 'none';
    document.getElementById('campoPeriodo').style.display = tipo === 'periodo' ? 'block' : 'none';
}

async function cargarSubselectores() {
    const combo = comboActualReportes();
    if (!combo) return;

    try {
        const actividades = await apiFetch(`calif_actividades.php?curso_id=${combo.cursoId}&asignatura_id=${combo.asignaturaId}`);
        document.getElementById('selectActividad').innerHTML = actividades.map(a => `<option value="${a.id}">${escaparHtml(a.nombre)}</option>`).join('') || '<option value="">— Sin actividades —</option>';

        if (combo.asignatura.tipo === 'tecnico') {
            const ras = await apiFetch(`asignatura_unidades.php?asignatura_id=${combo.asignaturaId}`);
            document.getElementById('selectUnidad').innerHTML = ras.map(r => `<option value="ra:${r.id}">${escaparHtml(r.codigo ? r.codigo + ': ' : '')}${escaparHtml(r.titulo)}</option>`).join('') || '<option value="">— Sin RA —</option>';
        } else {
            const competencias = await apiFetch(`competencias.php?asignatura_id=${combo.asignaturaId}`);
            document.getElementById('selectUnidad').innerHTML = competencias.map(c => `<option value="comp:${c.id}">${escaparHtml(c.codigo ? c.codigo + ': ' : '')}${escaparHtml(c.descripcion)}</option>`).join('') || '<option value="">— Sin competencias —</option>';
        }

        if (combo.curso) {
            const periodos = await apiFetch(`periodos.php?anio_escolar=${encodeURIComponent(combo.curso.anio_escolar)}`);
            document.getElementById('selectPeriodo').innerHTML = periodos.map(p => `<option value="${p.id}">${escaparHtml(p.nombre)}</option>`).join('') || '<option value="">— Sin períodos —</option>';
        }
    } catch (err) {
        mostrarAlerta('alertaReportesCalif', err.message);
    }
}

document.getElementById('cursoAsignatura').addEventListener('change', async () => { await actualizarOpcionesTipo(); await cargarSubselectores(); });
document.getElementById('tipoReporte').addEventListener('change', mostrarCamposSegunTipo);
document.getElementById('btnGenerar').addEventListener('click', generarReporte);
document.getElementById('btnExcel').addEventListener('click', exportarExcel);

// ---------------------------------------------------------------------
// Utilidades de presentación
// ---------------------------------------------------------------------
function filasEncabezado(enc) {
    return `
        <tr><td><strong>Centro:</strong></td><td colspan="4">${escaparHtml(enc.centro || '—')}</td></tr>
        <tr><td><strong>Profesor:</strong></td><td colspan="4">${escaparHtml(enc.profesor || '—')}</td></tr>
        <tr><td><strong>Año escolar:</strong></td><td colspan="4">${escaparHtml(enc.anio_escolar || '—')}</td></tr>
        <tr><td><strong>Curso:</strong></td><td colspan="4">${escaparHtml(enc.curso || '—')}</td></tr>
        <tr><td><strong>Asignatura:</strong></td><td colspan="4">${escaparHtml(enc.asignatura || '—')}</td></tr>
        ${enc.periodo ? `<tr><td><strong>Período:</strong></td><td colspan="4">${escaparHtml(enc.periodo)}</td></tr>` : ''}
        ${enc.unidad ? `<tr><td><strong>RA/Competencia:</strong></td><td colspan="4">${escaparHtml(enc.unidad)}</td></tr>` : ''}
        <tr><td><strong>Nota mínima:</strong></td><td colspan="4">${enc.nota_minima}%</td></tr>
        <tr><td>&nbsp;</td></tr>
    `;
}

function filaMinMax(mm) {
    if (mm.min === null) return '';
    return `<tr><td><strong>Calificación mínima del grupo:</strong></td><td>${mm.min}%</td><td><strong>Calificación máxima del grupo:</strong></td><td>${mm.max}%</td></tr><tr><td>&nbsp;</td></tr>`;
}

function claseFila(aprobado) {
    if (aprobado === false) return 'style="background:var(--color-absent-bg);"';
    if (aprobado === true) return 'style="background:var(--color-present-bg);"';
    return '';
}

function estadoTexto(aprobado) {
    if (aprobado === null || aprobado === undefined) return 'Sin calificar';
    return aprobado ? 'Aprobado' : 'Reprobado';
}

function marca(pct, minmax) {
    if (pct === null || !minmax || minmax.min === null) return '';
    if (pct === minmax.max) return ' 🔺';
    if (pct === minmax.min) return ' 🔻';
    return '';
}

// ---------------------------------------------------------------------
// Generar
// ---------------------------------------------------------------------
async function generarReporte() {
    const combo = comboActualReportes();
    if (!combo) { mostrarAlerta('alertaReportesCalif', 'Selecciona un curso y asignatura.'); return; }
    const tipo = document.getElementById('tipoReporte').value;
    const cont = document.getElementById('contenedorReporte');
    cont.innerHTML = '<div class="card"><p>Generando…</p></div>';

    try {
        let params = `tipo=${tipo}`;
        if (tipo === 'actividad') {
            const actId = document.getElementById('selectActividad').value;
            if (!actId) { cont.innerHTML = '<div class="vacio-estado">No hay actividades para elegir.</div>'; return; }
            params += `&actividad_id=${actId}`;
            const data = await apiFetch(`calif_reportes.php?${params}`);
            renderActividad(data);
        } else if (tipo === 'unidad') {
            const valor = document.getElementById('selectUnidad').value;
            if (!valor) { cont.innerHTML = '<div class="vacio-estado">No hay RA/competencias para elegir.</div>'; return; }
            const [prefijo, id] = valor.split(':');
            params += `&curso_id=${combo.cursoId}&asignatura_id=${combo.asignaturaId}&${prefijo === 'ra' ? 'unidad_id' : 'competencia_id'}=${id}`;
            const data = await apiFetch(`calif_reportes.php?${params}`);
            renderUnidad(data);
        } else if (tipo === 'periodo') {
            const perId = document.getElementById('selectPeriodo').value;
            if (!perId) { cont.innerHTML = '<div class="vacio-estado">No hay períodos para elegir.</div>'; return; }
            params += `&curso_id=${combo.cursoId}&asignatura_id=${combo.asignaturaId}&periodo_id=${perId}`;
            const data = await apiFetch(`calif_reportes.php?${params}`);
            renderPeriodo(data);
        } else {
            params += `&curso_id=${combo.cursoId}&asignatura_id=${combo.asignaturaId}`;
            const data = await apiFetch(`calif_reportes.php?${params}`);
            renderAnual(data);
        }
    } catch (err) {
        cont.innerHTML = '';
        mostrarAlerta('alertaReportesCalif', err.message);
    }
}

function renderActividad(data) {
    const filas = data.estudiantes.map(e => `
        <tr ${claseFila(e.aprobado)}>
            <td class="nombre-estudiante">${escaparHtml(e.nombre)}</td>
            <td class="num">${e.obtenida ?? '—'}</td>
            <td class="num">${e.maxima}</td>
            <td class="num">${e.porcentaje !== null ? e.porcentaje + '%' + marca(e.porcentaje, data.minmax) : '—'}</td>
            <td class="num">${estadoTexto(e.aprobado)}</td>
            <td>${escaparHtml(e.observaciones || '')}</td>
        </tr>
    `).join('');

    document.getElementById('contenedorReporte').innerHTML = `
        <div class="card">
            <h3>${escaparHtml(data.actividad.nombre)} <span style="font-weight:400; color:var(--color-ink-soft);">(${data.actividad.valor_maximo} pts)</span></h3>
            <div class="tabla-wrap">
                <table id="tablaReporte">
                    <tbody>${filasEncabezado(data.encabezado)}${filaMinMax(data.minmax)}</tbody>
                    <thead><tr><th>Estudiante</th><th class="num">Obtenida</th><th class="num">Máxima</th><th class="num">%</th><th class="num">Estado</th><th>Observaciones</th></tr></thead>
                    <tbody>${filas}</tbody>
                </table>
            </div>
        </div>
    `;
}

function renderUnidad(data) {
    const thActs = data.actividades.map(a => `<th class="num">${escaparHtml(a.nombre)}<br>(${a.valor_maximo})</th>`).join('');
    const filas = data.estudiantes.map(e => {
        const celdas = data.actividades.map(a => {
            const c = e.actividades[a.id] || { obtenida: 0, maxima: a.valor_maximo };
            return `<td class="num">${c.obtenida}/${c.maxima}</td>`;
        }).join('');
        return `<tr ${claseFila(e.aprobado)}>
            <td class="nombre-estudiante">${escaparHtml(e.nombre)}</td>
            ${celdas}
            <td class="num">${e.total_obtenido}</td>
            <td class="num">${e.total_maximo}</td>
            <td class="num">${e.porcentaje !== null ? e.porcentaje + '%' + marca(e.porcentaje, data.minmax) : '—'}</td>
            <td class="num">${estadoTexto(e.aprobado)}</td>
        </tr>`;
    }).join('');

    document.getElementById('contenedorReporte').innerHTML = `
        <div class="card">
            <h3>${escaparHtml(data.encabezado.unidad)} <span style="font-weight:400; color:var(--color-ink-soft);">(valor total: ${data.valor_total})</span></h3>
            <div class="tabla-wrap">
                <table id="tablaReporte">
                    <tbody>${filasEncabezado(data.encabezado)}${filaMinMax(data.minmax)}</tbody>
                    <thead><tr><th>Estudiante</th>${thActs}<th class="num">Total</th><th class="num">Valor</th><th class="num">%</th><th class="num">Estado</th></tr></thead>
                    <tbody>${filas}</tbody>
                </table>
            </div>
        </div>
    `;
}

function renderPeriodo(data) {
    const thCols = data.columnas.map(c => `<th class="num">${escaparHtml(c.nombre)}</th>`).join('');
    const filas = data.estudiantes.map(e => {
        const celdas = data.columnas.map(c => `<td class="num">${e.celdas[c.id] ?? 0}</td>`).join('');
        return `<tr ${claseFila(e.aprobado)}>
            <td class="nombre-estudiante">${escaparHtml(e.nombre)}</td>
            ${celdas}
            <td class="num">${e.total_obtenido ?? '—'}</td>
            <td class="num">${e.total_maximo ?? '—'}</td>
            <td class="num">${e.porcentaje !== null ? e.porcentaje + '%' + marca(e.porcentaje, data.minmax) : '—'}</td>
            <td class="num">${estadoTexto(e.aprobado)}</td>
        </tr>`;
    }).join('');

    document.getElementById('contenedorReporte').innerHTML = `
        <div class="card">
            <h3>${escaparHtml(data.encabezado.periodo)}</h3>
            <div class="tabla-wrap">
                <table id="tablaReporte">
                    <tbody>${filasEncabezado(data.encabezado)}${filaMinMax(data.minmax)}</tbody>
                    <thead><tr><th>Estudiante</th>${thCols}<th class="num">Total</th><th class="num">Valor</th><th class="num">%</th><th class="num">Estado</th></tr></thead>
                    <tbody>${filas}</tbody>
                </table>
            </div>
        </div>
    `;
}

function renderAnual(data) {
    const thPer = data.periodos.map(p => `<th class="num">${escaparHtml(p.nombre)}</th>`).join('');
    const filas = data.estudiantes.map(e => {
        const celdas = data.periodos.map(p => `<td class="num">${e.periodos[p.id] !== null ? e.periodos[p.id] + '%' : '—'}</td>`).join('');
        return `<tr ${claseFila(e.aprobado)}>
            <td class="nombre-estudiante">${escaparHtml(e.nombre)}</td>
            ${celdas}
            <td class="num">${e.promedio !== null ? e.promedio + '%' + marca(e.promedio, data.minmax) : '—'}</td>
            <td class="num">${estadoTexto(e.aprobado)}</td>
        </tr>`;
    }).join('');

    document.getElementById('contenedorReporte').innerHTML = `
        <div class="card">
            <h3>Calificación anual — ${escaparHtml(data.encabezado.anio_escolar)}</h3>
            <div class="tabla-wrap">
                <table id="tablaReporte">
                    <tbody>${filasEncabezado(data.encabezado)}${filaMinMax(data.minmax)}</tbody>
                    <thead><tr><th>Estudiante</th>${thPer}<th class="num">Promedio</th><th class="num">Estado</th></tr></thead>
                    <tbody>${filas}</tbody>
                </table>
            </div>
        </div>
    `;
}

// ---------------------------------------------------------------------
// Excel
// ---------------------------------------------------------------------
function exportarExcel() {
    const tabla = document.getElementById('tablaReporte');
    if (!tabla) { mostrarAlerta('alertaReportesCalif', 'Genera un reporte primero.'); return; }
    const tipo = document.getElementById('tipoReporte').value;
    const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '_');
    const wb = XLSX.utils.table_to_book(tabla, { sheet: 'Calificaciones' });
    XLSX.writeFile(wb, `Calificaciones_${tipo}_${fecha}.xlsx`);
}

inicializar();
