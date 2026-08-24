// ---------------------------------------------------------------------
// Reporte de Estudiantes (módulo Reportes)
// Listado por curso con datos generales y el contacto principal de cada
// estudiante. Se puede imprimir o exportar a Excel.
// ---------------------------------------------------------------------

let ultimoCursoId = null;

async function inicializar() {
    try {
        const cursos = await apiFetch('cursos.php');
        document.getElementById('curso').innerHTML = cursos.length
            ? '<option value="">Selecciona un curso…</option>' + cursos.map(c => `<option value="${c.id}">${escaparHtml(c.nombre)} (${escaparHtml(c.anio_escolar)})</option>`).join('')
            : '<option value="">— No tienes cursos disponibles —</option>';
    } catch (err) {
        mostrarAlerta('alertaReporteEstudiantes', err.message);
    }
    document.getElementById('curso').addEventListener('change', generar);
}

function formatoFecha(fechaSql) {
    if (!fechaSql) return '—';
    const [anio, mes, dia] = fechaSql.split('-');
    return `${dia}/${mes}/${anio}`;
}

async function generar() {
    const cursoId = document.getElementById('curso').value;
    const cont = document.getElementById('contenedorReporte');
    document.getElementById('btnExcel').style.display = 'none';
    document.getElementById('btnImprimir').style.display = 'none';

    if (!cursoId) { cont.innerHTML = ''; return; }
    ultimoCursoId = cursoId;
    cont.innerHTML = '<div class="card"><p>Generando…</p></div>';

    try {
        const data = await apiFetch(`reporte_estudiantes.php?curso_id=${cursoId}`);

        if (!data.estudiantes.length) {
            cont.innerHTML = `
                <div class="card">
                    <h3>${escaparHtml(data.curso)}</h3>
                    <div class="vacio-estado">Este curso no tiene estudiantes matriculados todavía.</div>
                </div>`;
            return;
        }

        cont.innerHTML = `
            <div class="grid-3">
                <div class="card"><h3>${data.total}</h3><p>Total de estudiantes</p></div>
                <div class="card"><h3>${data.total_masculino} / ${data.total_femenino}</h3><p>Masculino / Femenino</p></div>
                <div class="card"><h3>${data.sin_contacto_registrado}</h3><p>Sin responsable registrado</p></div>
            </div>

            <div class="card">
                ${data.centro ? `<p class="subtitulo" style="margin:0 0 2px;">${escaparHtml(data.centro)}</p>` : ''}
                <h3>${escaparHtml(data.curso)} — ${escaparHtml(data.anio_escolar)}</h3>
                <p class="subtitulo">Listado general y de contacto</p>
                <div class="tabla-wrap">
                    <table id="tablaReporte">
                        <thead>
                            <tr>
                                <th class="num">#</th>
                                <th>Estudiante</th>
                                <th class="num">Sexo</th>
                                <th>Nacimiento</th>
                                <th class="num">Edad</th>
                                <th>Responsable</th>
                                <th>Teléfono</th>
                                <th>Correo</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.estudiantes.map(e => `
                                <tr>
                                    <td class="num">${escaparHtml(e.matricula || '—')}</td>
                                    <td class="nombre-estudiante">${escaparHtml(e.apellido)}, ${escaparHtml(e.nombre)}</td>
                                    <td class="num">${e.sexo}</td>
                                    <td>${formatoFecha(e.fecha_nacimiento)}</td>
                                    <td class="num">${e.edad ?? '—'}</td>
                                    <td>${e.contacto_nombre ? `${escaparHtml(e.contacto_nombre)} <span class="subtitulo">(${escaparHtml(e.contacto_parentesco)})</span>` : '<span class="subtitulo">Sin registrar</span>'}</td>
                                    <td>${escaparHtml(e.contacto_telefono || '—')}</td>
                                    <td>${escaparHtml(e.contacto_correo || '—')}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        document.getElementById('btnExcel').style.display = 'inline-flex';
        document.getElementById('btnImprimir').style.display = 'inline-flex';
    } catch (err) {
        cont.innerHTML = '';
        mostrarAlerta('alertaReporteEstudiantes', err.message);
    }
}

function exportarExcel() {
    const tabla = document.getElementById('tablaReporte');
    if (!tabla) { mostrarAlerta('alertaReporteEstudiantes', 'Genera un reporte primero.'); return; }
    const cursoTexto = document.getElementById('curso').selectedOptions[0]?.textContent.trim().replace(/[^a-zA-Z0-9]+/g, '_') || 'curso';
    const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '_');
    const wb = XLSX.utils.table_to_book(tabla, { sheet: 'Estudiantes' });
    XLSX.writeFile(wb, `Estudiantes_${cursoTexto}_${fecha}.xlsx`);
}

document.getElementById('btnExcel').addEventListener('click', exportarExcel);
document.getElementById('btnImprimir').addEventListener('click', () => window.print());

inicializar();
