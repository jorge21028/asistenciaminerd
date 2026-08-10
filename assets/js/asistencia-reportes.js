let combosReporte = [];
const NOMBRES_MES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const CLASE_ESTADO = { P: 'presente', A: 'ausente', T: 'tardanza', E: 'excusa' };
const NOMBRE_ESTADO = { P: 'Presente', A: 'Ausente', T: 'Tardanza', E: 'Excusa' };

async function inicializarReportes() {
    // Selector de mes
    document.getElementById('mes').innerHTML = NOMBRES_MES.map((n, i) => `<option value="${i + 1}">${n}</option>`).join('');
    const hoy = new Date();
    document.getElementById('fecha').value = hoy.toISOString().slice(0, 10);
    document.getElementById('mes').value = hoy.getMonth() + 1;
    document.getElementById('anio').value = hoy.getFullYear();
    document.getElementById('semanaInicio').value = lunesDeEstaSemana();

    try {
        combosReporte = await apiFetch('asignaciones.php');
        const select = document.getElementById('cursoAsignatura');
        select.innerHTML = combosReporte.map(c =>
            `<option value="${c.curso_id}:${c.asignatura_id}">${escaparHtml(c.curso_nombre)} — ${escaparHtml(c.asignatura_nombre)}</option>`
        ).join('');
        if (combosReporte.length) generarReporte();
    } catch (err) {
        mostrarAlerta('alertaReportes', err.message);
    }
}

function lunesDeEstaSemana() {
    const hoy = new Date();
    const dia = hoy.getDay(); // 0=domingo
    const diff = dia === 0 ? -6 : 1 - dia;
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() + diff);
    return lunes.toISOString().slice(0, 10);
}

function actualizarCamposVisibles() {
    const tipo = document.getElementById('tipoReporte').value;
    document.getElementById('campoFecha').style.display = tipo === 'diario' ? 'block' : 'none';
    document.getElementById('campoSemana').style.display = tipo === 'semanal' ? 'block' : 'none';
    document.getElementById('campoMes').style.display = tipo === 'mensual' ? 'block' : 'none';
    document.getElementById('campoAnio').style.display = (tipo === 'mensual' || tipo === 'anual') ? 'block' : 'none';
}

function formatoFechaCorta(fechaISO) {
    const [, m, d] = fechaISO.split('-');
    return `${d}/${m}`;
}

function claseporcentaje(p) {
    if (p >= 90) return 'porcentaje-alto';
    if (p >= 75) return 'porcentaje-medio';
    return 'porcentaje-bajo';
}

function selloHtml(codigo) {
    if (!codigo) return `<span class="sello-estado vacio">·</span>`;
    const clase = CLASE_ESTADO[codigo];
    return `<span class="sello-estado ${clase}" title="${NOMBRE_ESTADO[codigo]}">${codigo}</span>`;
}

async function generarReporte() {
    const combo = document.getElementById('cursoAsignatura').value;
    if (!combo) return;
    const [cursoId, asignaturaId] = combo.split(':');
    const tipo = document.getElementById('tipoReporte').value;
    const cont = document.getElementById('contenedorReporte');

    let params = `tipo=${tipo}&curso_id=${cursoId}&asignatura_id=${asignaturaId}`;
    if (tipo === 'diario') params += `&fecha=${document.getElementById('fecha').value}`;
    if (tipo === 'semanal') params += `&fecha_inicio=${document.getElementById('semanaInicio').value}`;
    if (tipo === 'mensual') params += `&anio=${document.getElementById('anio').value}&mes=${document.getElementById('mes').value}`;
    if (tipo === 'anual') params += `&anio=${document.getElementById('anio').value}`;

    cont.innerHTML = `<div class="card"><p>Cargando reporte…</p></div>`;

    try {
        const data = await apiFetch(`reportes.php?${params}`);
        if (tipo === 'diario') renderDiario(data, cont);
        if (tipo === 'semanal') renderSemanal(data, cont);
        if (tipo === 'mensual') renderMensual(data, cont);
        if (tipo === 'anual') renderAnual(data, cont);
    } catch (err) {
        cont.innerHTML = '';
        mostrarAlerta('alertaReportes', err.message);
    }
}

// ---------------------------------------------------------------------
function renderDiario(data, cont) {
    if (!data.estudiantes.length) {
        cont.innerHTML = `<div class="vacio-estado">No hay estudiantes matriculados en este curso.</div>`;
        return;
    }
    cont.innerHTML = `
        <div class="grid-3" style="grid-template-columns: repeat(3, 1fr);">
            <div class="card"><h3>${data.conteo.presente}</h3><p>Asistencia</p></div>
            <div class="card"><h3>${data.conteo.excusa}</h3><p>Excusas</p></div>
            <div class="card"><h3>${data.conteo.ausente}</h3><p>Inasistencia</p></div>
        </div>
        <div class="grid-3" style="grid-template-columns: repeat(3, 1fr);">
            <div class="card"><h3>${data.varones_presentes}</h3><p>Varones presentes hoy</p></div>
            <div class="card"><h3>${data.hembras_presentes}</h3><p>Hembras presentes hoy</p></div>
            <div class="card"><h3>${data.varones_presentes + data.hembras_presentes}</h3><p>Total presentes hoy</p></div>
        </div>
        <div class="card">
            <h3>Reporte diario — ${data.fecha}</h3>
            <p class="subtitulo">${data.porcentaje_presentes}% de asistencia el día de hoy · ${data.total_estudiantes} estudiantes matriculados</p>
            <div class="tabla-wrap">
                <table>
                    <thead><tr><th>Estudiante</th><th class="num">Estado</th><th>Observación</th></tr></thead>
                    <tbody>
                        ${data.estudiantes.map(e => `
                            <tr>
                                <td class="nombre-estudiante">${escaparHtml(e.nombre)}</td>
                                <td class="num">${e.estado ? selloHtml({presente:'P',ausente:'A',tardanza:'T',excusa:'E'}[e.estado]) : selloHtml(null)}</td>
                                <td>${escaparHtml(e.observacion || '')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// ---------------------------------------------------------------------
function renderSemanal(data, cont) {
    if (!data.estudiantes.length) {
        cont.innerHTML = `<div class="vacio-estado">No hay estudiantes matriculados en este curso.</div>`;
        return;
    }
    const dias = data.dias_trabajados;
    cont.innerHTML = `
        <div class="card">
            <h3>Reporte semanal — ${formatoFechaCorta(data.fecha_inicio)} al ${formatoFechaCorta(data.fecha_fin)}</h3>
            <p class="subtitulo">Días trabajados en la semana: ${data.total_dias_trabajados}</p>
            ${!dias.length ? '<div class="vacio-estado">No se ha registrado asistencia esta semana.</div>' : `
            <div class="tabla-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Estudiante</th>
                            ${dias.map(f => `<th class="num">${formatoFechaCorta(f)}</th>`).join('')}
                            <th class="num">Total</th>
                            <th class="num">%</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.estudiantes.map(e => `
                            <tr>
                                <td class="nombre-estudiante">${escaparHtml(e.nombre)}</td>
                                ${dias.map(f => `<td class="num">${selloHtml(e.dias[f])}</td>`).join('')}
                                <td class="num">${e.total_asistencia}/${e.dias_trabajados}</td>
                                <td class="num"><span class="${claseporcentaje(e.porcentaje)}">${e.porcentaje}%</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>`}
        </div>
    `;
}

// ---------------------------------------------------------------------
function renderMensual(data, cont) {
    if (!data.estudiantes.length) {
        cont.innerHTML = `<div class="vacio-estado">No hay estudiantes matriculados en este curso.</div>`;
        return;
    }
    const dias = data.dias_trabajados; // array de números de día

    cont.innerHTML = `
        <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:baseline; flex-wrap:wrap; gap:8px;">
                <h3>Mes de ${data.mes_nombre} ${data.anio}</h3>
                <p class="subtitulo" style="margin:0;">Días trabajados: <strong>${data.total_dias_trabajados}</strong></p>
            </div>
            <div class="leyenda">
                <span><span class="sello-estado presente" style="width:20px;height:20px;font-size:0.65rem;">P</span> Presente</span>
                <span><span class="sello-estado ausente" style="width:20px;height:20px;font-size:0.65rem;">A</span> Ausente</span>
                <span><span class="sello-estado tardanza" style="width:20px;height:20px;font-size:0.65rem;">T</span> Tardanza</span>
                <span><span class="sello-estado excusa" style="width:20px;height:20px;font-size:0.65rem;">E</span> Excusa</span>
                <span style="margin-left:auto;">2 excusas, 2 tardanzas, o 1 excusa + 1 tardanza = 1 inasistencia</span>
            </div>
            ${!dias.length ? '<div class="vacio-estado">No se ha registrado asistencia este mes.</div>' : `
            <div class="tabla-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Estudiante</th>
                            ${dias.map(d => `<th class="num">${d}</th>`).join('')}
                            <th class="num">Total<br>asistencia</th>
                            <th class="num">%</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.estudiantes.map(e => `
                            <tr>
                                <td class="nombre-estudiante">${escaparHtml(e.nombre)}</td>
                                ${dias.map(d => `<td class="num">${selloHtml(e.dias[d])}</td>`).join('')}
                                <td class="num">${e.total_asistencia}</td>
                                <td class="num"><span class="${claseporcentaje(e.porcentaje)}">${e.porcentaje}%</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>`}
        </div>
    `;
}

// ---------------------------------------------------------------------
function renderAnual(data, cont) {
    cont.innerHTML = `
        <div class="card">
            <h3>Resumen mensual — ${data.anio}</h3>
            <p class="subtitulo">Total de días trabajados en el año: ${data.total_dias_trabajados}</p>
            ${!data.resumen_por_mes.length ? '<div class="vacio-estado">No hay asistencia registrada en este año.</div>' : `
            <div class="tabla-wrap">
                <table>
                    <thead><tr><th>Mes</th><th class="num">Días trabajados</th><th class="num">% promedio del curso</th></tr></thead>
                    <tbody>
                        ${data.resumen_por_mes.map(m => `
                            <tr>
                                <td>${m.mes_nombre}</td>
                                <td class="num">${m.dias_trabajados}</td>
                                <td class="num"><span class="${claseporcentaje(m.porcentaje_promedio_curso)}">${m.porcentaje_promedio_curso}%</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>`}
        </div>

        <div class="card">
            <h3>Totales anuales por estudiante</h3>
            ${!data.estudiantes.length ? '<div class="vacio-estado">No hay estudiantes matriculados en este curso.</div>' : `
            <div class="tabla-wrap">
                <table>
                    <thead>
                        <tr><th>Estudiante</th><th class="num">Días trabajados</th><th class="num">Total asistencia</th><th class="num">Ausentes</th><th class="num">Tardanzas</th><th class="num">Excusas</th><th class="num">%</th></tr>
                    </thead>
                    <tbody>
                        ${data.estudiantes.map(e => `
                            <tr>
                                <td class="nombre-estudiante">${escaparHtml(e.nombre)}</td>
                                <td class="num">${e.dias_trabajados}</td>
                                <td class="num">${e.total_asistencia}</td>
                                <td class="num">${e.ausentes}</td>
                                <td class="num">${e.tardanzas}</td>
                                <td class="num">${e.excusas}</td>
                                <td class="num"><span class="${claseporcentaje(e.porcentaje)}">${e.porcentaje}%</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>`}
        </div>
    `;
}

document.getElementById('tipoReporte').addEventListener('change', actualizarCamposVisibles);
document.getElementById('btnGenerar').addEventListener('click', generarReporte);

actualizarCamposVisibles();
inicializarReportes();
