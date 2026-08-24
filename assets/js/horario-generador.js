// ---------------------------------------------------------------------
// Generador de Horario (módulo Configuración)
// ---------------------------------------------------------------------

async function inicializar() {
    await Promise.all([cargarDiagnostico(), cargarHistorial()]);
}

async function cargarDiagnostico() {
    const cont = document.getElementById('diagnostico');
    try {
        const d = await apiFetch('horario_generador.php');

        if (!d.total_asignaciones_configuradas) {
            cont.innerHTML = `<div class="vacio-estado">Todavía no hay ninguna asignación con "bloques/semana" configurado. Ve a <a href="${rutaBase('asignaciones.html')}">Asignaciones</a> y defínelos primero.</div>`;
            document.getElementById('listaProfesoresScope').innerHTML = '';
            document.getElementById('btnGenerar').disabled = true;
            return;
        }
        document.getElementById('btnGenerar').disabled = false;

        const conProblema = d.profesores.filter(p => !p.alcanza);

        cont.innerHTML = `
            <div class="generador-resumen-grid" style="margin-top:0;">
                <div class="card"><h3>${d.total_asignaciones_configuradas}</h3><p>Asignaciones configuradas</p></div>
                <div class="card"><h3>${d.total_unidades_a_colocar}</h3><p>Bloques a colocar / semana</p></div>
                <div class="card"><h3>${d.profesores.length}</h3><p>Profesores involucrados</p></div>
            </div>
            ${conProblema.length ? `
                <div class="vacio-estado" style="border-color:var(--color-absent); color:var(--color-absent);">
                    ⚠ ${conProblema.length} profesor(es) necesitan más bloques de los que tienen disponibles (por sus bloqueos de disponibilidad):
                    <ul style="margin:6px 0 0; padding-left:20px;">
                        ${conProblema.map(p => `<li>${escaparHtml(p.profesor_nombre)}: necesita ${p.requerido}, disponibles ${p.disponible}</li>`).join('')}
                    </ul>
                </div>` : ''}
            ${d.asignaciones_sin_configurar.length ? `
                <p class="subtitulo" style="margin-top:10px;">${d.asignaciones_sin_configurar.length} asignación(es) todavía sin "bloques/semana" — no entrarán en la generación: ${d.asignaciones_sin_configurar.map(a => `${escaparHtml(a.profesor)} (${escaparHtml(a.asignatura)} en ${escaparHtml(a.curso)})`).join(', ')}.</p>` : ''}
        `;

        pintarListaProfesores(d.profesores);
    } catch (err) {
        mostrarAlerta('alertaGenerador', err.message);
    }
}

function pintarListaProfesores(profesores) {
    const cont = document.getElementById('listaProfesoresScope');
    cont.innerHTML = profesores.map(p => `
        <label class="grupos-check-item">
            <input type="checkbox" class="chk-profesor-scope" value="${p.profesor_id}" checked>
            ${escaparHtml(p.profesor_nombre)} <span class="subtitulo">(${p.requerido} bloques/sem.)</span>
        </label>
    `).join('');
}

async function generar() {
    const ids = Array.from(document.querySelectorAll('.chk-profesor-scope:checked')).map(chk => parseInt(chk.value));
    if (!ids.length) { mostrarAlerta('alertaGenerador', 'Selecciona al menos un profesor.'); return; }

    if (!confirm('Esto va a reemplazar el horario GENERADO previamente para los profesores marcados (lo que hayas puesto a mano no se toca). ¿Continuar?')) return;

    const btn = document.getElementById('btnGenerar');
    btn.disabled = true;
    document.getElementById('estadoGenerando').style.display = 'block';
    document.getElementById('cardResultado').style.display = 'none';

    try {
        const resultado = await apiFetch('horario_generador.php', { method: 'POST', body: { profesor_ids: ids } });
        pintarResultado(resultado);
        mostrarAlerta('alertaGenerador', resultado.no_colocadas.length === 0 ? '¡Horario generado sin conflictos!' : `Generado con ${resultado.no_colocadas.length} bloque(s) sin colocar (ver abajo).`, resultado.no_colocadas.length === 0 ? 'exito' : 'error');
        await Promise.all([cargarDiagnostico(), cargarHistorial()]);
    } catch (err) {
        mostrarAlerta('alertaGenerador', err.message);
    } finally {
        btn.disabled = false;
        document.getElementById('estadoGenerando').style.display = 'none';
    }
}

function pintarResultado(r) {
    document.getElementById('cardResultado').style.display = 'block';
    document.getElementById('resumenResultado').innerHTML = `
        <div class="card"><h3>${r.colocadas}</h3><p>Bloques colocados</p></div>
        <div class="card"><h3>${r.no_colocadas.length}</h3><p>Sin colocar</p></div>
        <div class="card"><h3>${r.intentos}</h3><p>Intentos (${r.segundos}s)</p></div>
    `;

    const detalle = document.getElementById('detalleNoColocadas');
    if (!r.no_colocadas.length) {
        detalle.innerHTML = '';
        return;
    }
    detalle.innerHTML = `
        <h4 style="margin-top:18px;">Bloques que necesitan ajuste manual</h4>
        <p class="subtitulo">No se encontró un espacio válido con las restricciones actuales. Ábrelos en <a href="${rutaBase('asignar-horario.html')}">Asignar horario</a> para completarlos a mano, o revisa las restricciones del profesor.</p>
        <ul class="lista-no-colocadas">
            ${r.no_colocadas.map(n => `<li><strong>${escaparHtml(n.profesor_nombre)}</strong> — ${escaparHtml(n.asignatura_nombre)} en ${escaparHtml(n.curso_nombre)} (faltan ${n.bloques_necesarios} bloque(s) ${n.bloques_necesarios > 1 ? 'consecutivos' : ''})</li>`).join('')}
        </ul>
    `;
}

async function cargarHistorial() {
    try {
        const historial = await apiFetch('horario_generador.php?historial=1');
        const tbody = document.getElementById('tablaHistorial');
        document.getElementById('estadoVacioHistorial').style.display = historial.length ? 'none' : 'block';
        tbody.innerHTML = historial.map(h => `
            <tr>
                <td>${new Date(h.fecha).toLocaleString('es-DO')} <span class="subtitulo">— ${escaparHtml(h.ejecutado_por)}</span></td>
                <td class="num">${h.colocadas ?? '—'}</td>
                <td class="num">${h.no_colocadas ?? '—'}</td>
                <td class="acciones-tabla"><button class="btn peligro chico" onclick="revertirGeneracion(${h.id})">Revertir</button></td>
            </tr>
        `).join('');
    } catch (err) {
        mostrarAlerta('alertaGenerador', err.message);
    }
}

async function revertirGeneracion(id) {
    if (!confirm('Esto borra los bloques que puso esa corrida (deja esas celdas vacías). ¿Continuar?')) return;
    try {
        await apiFetch(`horario_generador.php?generacion_id=${id}`, { method: 'DELETE' });
        mostrarAlerta('alertaGenerador', 'Corrida revertida.', 'exito');
        await Promise.all([cargarDiagnostico(), cargarHistorial()]);
    } catch (err) {
        mostrarAlerta('alertaGenerador', err.message);
    }
}

document.getElementById('btnGenerar').addEventListener('click', generar);
document.getElementById('btnMarcarTodosProf').addEventListener('click', () => {
    document.querySelectorAll('.chk-profesor-scope').forEach(chk => { chk.checked = true; });
});
document.getElementById('btnDesmarcarTodosProf').addEventListener('click', () => {
    document.querySelectorAll('.chk-profesor-scope').forEach(chk => { chk.checked = false; });
});

inicializar();
