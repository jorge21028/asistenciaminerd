const NOMBRE_DIA_CURSO = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes' };
const DIAS_ORDEN_CURSO = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];

function formatoHora12Curso(hhmmss) {
    let [h, m] = hhmmss.split(':').map(Number);
    const sufijo = h >= 12 ? 'PM' : 'AM';
    h = h % 12; if (h === 0) h = 12;
    return `${h}:${String(m).padStart(2, '0')} ${sufijo}`;
}

async function inicializar() {
    try {
        const cursos = await apiFetch('cursos.php');
        document.getElementById('curso').innerHTML = cursos.length
            ? cursos.map(c => `<option value="${c.id}">${escaparHtml(c.nombre)} (${escaparHtml(c.anio_escolar)})</option>`).join('')
            : '<option value="">— No tienes cursos disponibles —</option>';
        if (cursos.length) cargarHorario();
    } catch (err) {
        mostrarAlerta('alertaHorarioCurso', err.message);
    }
}

async function cargarHorario() {
    const cursoId = document.getElementById('curso').value;
    const cont = document.getElementById('contenedorHorario');
    if (!cursoId) return;

    cont.innerHTML = '<div class="card"><p>Cargando…</p></div>';

    try {
        const [data, config] = await Promise.all([
            apiFetch(`horario.php?curso_id=${cursoId}`),
            apiFetch('config_institucional.php').catch(() => ({ nombre_centro: '' })),
        ]);

        const mapa = {};
        data.asignaciones.forEach(a => { mapa[`${a.dia}:${a.bloque_id}`] = a; });

        const thead = '<thead><tr><th>Hora</th>' +
            DIAS_ORDEN_CURSO.map(d => `<th>${NOMBRE_DIA_CURSO[d]}</th>`).join('') + '</tr></thead>';

        const tbody = '<tbody>' + data.bloques.map(b => {
            if (b.tipo !== 'clase') {
                const icono = b.tipo === 'receso' ? '☕ Recreo' : '🍽️ Almuerzo';
                return `<tr class="fila-separador"><td>${formatoHora12Curso(b.hora_inicio)}–${formatoHora12Curso(b.hora_fin)}</td><td colspan="5" style="text-align:center; color:var(--color-ink-soft);">${icono}</td></tr>`;
            }
            const celdas = DIAS_ORDEN_CURSO.map(dia => {
                const a = mapa[`${dia}:${b.id}`];
                if (!a) return '<td>—</td>';
                return `<td><strong>${escaparHtml(a.asignatura_nombre || '—')}</strong>${a.origen === 'generado' ? '<span class="badge-origen-generado" title="Puesto por el Generador de Horario">auto</span>' : ''}<br><span style="color:var(--color-ink-soft); font-size:0.8rem;">${escaparHtml(a.profesor_nombre)}</span></td>`;
            }).join('');
            return `<tr><td>${formatoHora12Curso(b.hora_inicio)}–${formatoHora12Curso(b.hora_fin)}</td>${celdas}</tr>`;
        }).join('') + '</tbody>';

        cont.innerHTML = `
            <div class="card">
                <div style="text-align:center; margin-bottom:18px;">
                    <h2 style="margin-bottom:2px;">${escaparHtml(config.nombre_centro || 'Centro Educativo')}</h2>
                    <p class="subtitulo" style="margin:0;">Horario semanal — ${escaparHtml(data.curso.nombre)} (${escaparHtml(data.curso.grado)} ${escaparHtml(data.curso.seccion)}) · Año escolar ${escaparHtml(data.curso.anio_escolar)}</p>
                </div>
                <div class="tabla-wrap">
                    <table>${thead}${tbody}</table>
                </div>
            </div>
        `;
    } catch (err) {
        cont.innerHTML = '';
        mostrarAlerta('alertaHorarioCurso', err.message);
    }
}

document.getElementById('curso').addEventListener('change', cargarHorario);

inicializar();
