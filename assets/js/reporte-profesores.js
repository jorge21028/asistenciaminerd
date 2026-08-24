// ---------------------------------------------------------------------
// Reporte de Profesores (módulo Reportes, solo admin)
// Asignaciones, cursos como guía y carga horaria semanal de cada
// profesor activo. Se puede imprimir o exportar a Excel.
// ---------------------------------------------------------------------

async function inicializar() {
    const cont = document.getElementById('contenedorReporte');
    try {
        const data = await apiFetch('reporte_profesores.php');
        pintar(data);
    } catch (err) {
        cont.innerHTML = '';
        mostrarAlerta('alertaReporteProfesores', err.message);
    }
}

function pintar(data) {
    const cont = document.getElementById('contenedorReporte');

    if (!data.profesores.length) {
        cont.innerHTML = '<div class="card"><div class="vacio-estado">No hay profesores activos registrados.</div></div>';
        return;
    }

    cont.innerHTML = `
        <div class="grid-3">
            <div class="card"><h3>${data.total_profesores}</h3><p>Profesores activos</p></div>
            <div class="card"><h3>${promedioBloques(data.profesores)}</h3><p>Bloques de clase / profesor (prom.)</p></div>
            <div class="card"><h3>${data.sin_asignaciones}</h3><p>Sin asignaciones todavía</p></div>
        </div>

        <div class="card">
            ${data.centro ? `<p class="subtitulo" style="margin:0 0 2px;">${escaparHtml(data.centro)}</p>` : ''}
            <h3>Carga por profesor</h3>
            <p class="subtitulo">Ordenado de mayor a menor cantidad de bloques de clase a la semana</p>
            <div class="tabla-wrap">
                <table id="tablaReporte">
                    <thead>
                        <tr>
                            <th>Profesor</th>
                            <th>Correo</th>
                            <th class="num">Cursos</th>
                            <th class="num">Asignaturas</th>
                            <th>Cursos como guía</th>
                            <th class="num">Bloques de clase / sem.</th>
                            <th class="num">Bloques pedagógicos / sem.</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.profesores.map(p => `
                            <tr>
                                <td class="nombre-estudiante">${escaparHtml(p.nombre)}</td>
                                <td>${escaparHtml(p.email)}</td>
                                <td class="num">${p.total_cursos}</td>
                                <td class="num">${p.total_asignaturas}</td>
                                <td>${p.cursos_guia.length ? escaparHtml(p.cursos_guia.join(', ')) : '<span class="subtitulo">—</span>'}</td>
                                <td class="num">${p.bloques_clase}</td>
                                <td class="num">${p.bloques_pedagogicos}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>

        <div id="detalleAsignaciones">
            <h2 style="margin:24px 0 12px;">Detalle de asignaciones por profesor</h2>
            ${data.profesores.map(p => `
                <div class="card">
                    <h3>${escaparHtml(p.nombre)}</h3>
                    ${p.asignaciones.length
                        ? `<ul style="margin:0; padding-left:20px;">${p.asignaciones.map(a => `<li>${escaparHtml(a.asignatura)} — ${escaparHtml(a.curso)}</li>`).join('')}</ul>`
                        : '<p class="subtitulo" style="margin:0;">Sin asignaturas asignadas todavía.</p>'}
                </div>
            `).join('')}
        </div>
    `;

    document.getElementById('btnExcel').style.display = 'inline-flex';
    document.getElementById('btnImprimir').style.display = 'inline-flex';
}

function promedioBloques(profesores) {
    if (!profesores.length) return 0;
    const total = profesores.reduce((s, p) => s + p.bloques_clase, 0);
    return Math.round((total / profesores.length) * 10) / 10;
}

function exportarExcel() {
    const tabla = document.getElementById('tablaReporte');
    if (!tabla) { mostrarAlerta('alertaReporteProfesores', 'No hay datos para exportar.'); return; }
    const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '_');
    const wb = XLSX.utils.table_to_book(tabla, { sheet: 'Profesores' });
    XLSX.writeFile(wb, `Profesores_carga_${fecha}.xlsx`);
}

document.getElementById('btnExcel').addEventListener('click', exportarExcel);
document.getElementById('btnImprimir').addEventListener('click', () => window.print());

inicializar();
