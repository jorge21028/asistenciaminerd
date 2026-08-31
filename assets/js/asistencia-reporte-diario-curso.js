async function inicializar() {
    document.getElementById('fecha').value = new Date().toISOString().slice(0, 10);
    try {
        const cursos = await apiFetch('cursos.php');
        document.getElementById('curso').innerHTML = cursos.length
            ? cursos.map(c => `<option value="${c.id}">${escaparHtml(c.nombre)} (${escaparHtml(c.anio_escolar)})</option>`).join('')
            : '<option value="">— No tienes cursos disponibles —</option>';
        if (cursos.length) generar();
    } catch (err) {
        mostrarAlerta('alertaDiarioCurso', err.message);
    }
}

function formatoHora(fechaHoraSql) {
    if (!fechaHoraSql) return '';
    const d = new Date(fechaHoraSql.replace(' ', 'T'));
    return d.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' });
}

async function generar() {
    const cursoId = document.getElementById('curso').value;
    const fecha = document.getElementById('fecha').value;
    const cont = document.getElementById('contenedorReporte');
    if (!cursoId || !fecha) return;

    cont.innerHTML = '<div class="card"><p>Generando…</p></div>';

    try {
        const data = await apiFetch(`reportes.php?tipo=diario_curso&curso_id=${cursoId}&fecha=${fecha}`);

        if (data.sin_registro) {
            cont.innerHTML = `
                <div class="card">
                    <h3>${escaparHtml(data.curso)} — ${fecha}</h3>
                    <div class="vacio-estado">No se registró ninguna toma de asistencia este día para este curso.</div>
                </div>`;
            return;
        }

        cont.innerHTML = `
            <div class="grid-3">
                <div class="card"><h3>${data.total_estudiantes}</h3><p>Total de estudiantes</p></div>
                <div class="card"><h3>${data.conteo.presente}</h3><p>Presentes</p></div>
                <div class="card"><h3>${data.conteo.ausente}</h3><p>Ausentes</p></div>
            </div>
            <div class="grid-3">
                <div class="card"><h3>${data.conteo.excusa}</h3><p>Excusas/justificaciones</p></div>
                <div class="card"><h3>${data.porcentaje_asistencia}%</h3><p>% de asistencia</p></div>
                <div class="card"><h3>${data.porcentaje_ausencia}%</h3><p>% de ausencia</p></div>
            </div>

            <div class="card">
                <h3>${escaparHtml(data.curso)} — ${data.fecha}</h3>
                <p class="subtitulo">Año escolar: ${escaparHtml(data.anio_escolar)} · Referencia: última toma del día, en <strong>${escaparHtml(data.asignatura_referencia)}</strong> (${formatoHora(data.hora_referencia)})</p>
                <div class="tabla-wrap">
                    <table>
                        <thead><tr><th class="num">Matrícula</th><th>Estudiante</th><th class="num">Estado</th><th>Observación</th></tr></thead>
                        <tbody>
                            ${data.estudiantes.map(e => `
                                <tr>
                                    <td class="num">${escaparHtml(e.matricula || '—')}</td>
                                    <td class="nombre-estudiante">${escaparHtml(e.nombre)}</td>
                                    <td class="num">${e.estado ? selloHtmlLocal(e.estado) : '<span class="sello-estado vacio">·</span>'}</td>
                                    <td>${escaparHtml(e.observacion || '')}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } catch (err) {
        cont.innerHTML = '';
        mostrarAlerta('alertaDiarioCurso', err.message);
    }
}

function selloHtmlLocal(estado) {
    const codigos = { presente: 'P', ausente: 'A', tardanza: 'T', excusa: 'E' };
    const clases = { presente: 'presente', ausente: 'ausente', tardanza: 'tardanza', excusa: 'excusa' };
    return `<span class="sello-estado ${clases[estado]}">${codigos[estado]}</span>`;
}

document.getElementById('btnGenerar').addEventListener('click', generar);

inicializar();
