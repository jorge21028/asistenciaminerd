const TEXTO_TIPO = {
    taller: 'Taller: cada actividad pertenece a un período. La nota del período es el promedio de sus actividades, y la del año es el promedio de los períodos.',
    tecnico: 'Técnico-profesional: cada actividad pertenece a un RA. El RA suma los puntos de sus actividades (CRA) hasta su valor asignado. Si el estudiante no aprueba el RA, tiene hasta 3 recuperaciones (R1, R2, R3): crea una actividad de tipo "Recuperación" en el RA. Como calificación final del RA (Total RA) cuenta el CRA si aprobó, o la recuperación con la que aprobó.',
    academica: 'Académica: cada actividad tiene una rúbrica con criterios de evaluación, que pueden evidenciar una o varias competencias específicas.',
};

let combosCalificaciones = [];
let mapaAsignaturas = {};
let actividades = [];

async function inicializar() {
    try {
        const [combos, asignaturas] = await Promise.all([
            apiFetch('asignaciones.php'),
            apiFetch('asignaturas.php'),
        ]);
        combosCalificaciones = combos;
        asignaturas.forEach(a => { mapaAsignaturas[a.id] = a; });

        document.getElementById('cursoAsignatura').innerHTML =
            '<option value="">Selecciona…</option>' +
            combos.map(c => `<option value="${c.curso_id}:${c.asignatura_id}">${escaparHtml(c.curso_nombre)} — ${escaparHtml(c.asignatura_nombre)}</option>`).join('');
    } catch (err) {
        mostrarAlerta('alertaCalificaciones', err.message);
    }
}

function comboActual() {
    const valor = document.getElementById('cursoAsignatura').value;
    if (!valor) return null;
    const [cursoId, asignaturaId] = valor.split(':');
    return { cursoId, asignaturaId, asignatura: mapaAsignaturas[asignaturaId] };
}

async function cargarActividades() {
    const combo = comboActual();
    const infoTipo = document.getElementById('infoTipo');

    if (!combo) {
        document.getElementById('btnImportarCsv').style.display = 'none';
        infoTipo.style.display = 'none';
        document.getElementById('tablaActividades').innerHTML = '';
        document.getElementById('estadoVacio').style.display = 'none';
        return;
    }

    infoTipo.style.display = 'block';
    document.getElementById('textoInfoTipo').textContent = TEXTO_TIPO[combo.asignatura.tipo] || '';

    document.getElementById('btnNuevaActividad').href = `${rutaBase('calificaciones-nueva.html')}?curso_id=${combo.cursoId}&asignatura_id=${combo.asignaturaId}`;
    // La importación por RA solo aplica a asignaturas técnico-profesionales
    document.getElementById('btnImportarCsv').style.display = combo.asignatura.tipo === 'tecnico' ? '' : 'none';
    document.getElementById('btnVerReportes').href = `${rutaBase('calificaciones-reportes.html')}?curso_id=${combo.cursoId}&asignatura_id=${combo.asignaturaId}`;

    try {
        actividades = await apiFetch(`calif_actividades.php?curso_id=${combo.cursoId}&asignatura_id=${combo.asignaturaId}`);
        pintarActividades();
    } catch (err) {
        mostrarAlerta('alertaCalificaciones', err.message);
    }
}

function referenciaActividad(a) {
    const base = a.unidad_codigo || '—';
    const r = parseInt(a.recuperacion) || 0;
    return r > 0 ? `${base} · Recuperación R${r}` : base;
}

function pintarActividades() {
    const tbody = document.getElementById('tablaActividades');
    document.getElementById('estadoVacio').style.display = actividades.length ? 'none' : 'block';
    tbody.innerHTML = actividades.map(a => `
        <tr>
            <td><strong>${escaparHtml(a.nombre)}</strong>${a.tipo_personalizado ? `<br><span style="color:var(--color-ink-soft); font-size:0.85em;">${escaparHtml(a.tipo_personalizado)}</span>` : ''}</td>
            <td>${escaparHtml(referenciaActividad(a))}</td>
            <td class="num">${a.valor_maximo}</td>
            <td>${new Date(a.created_at).toLocaleDateString('es-DO')}</td>
            <td class="acciones-tabla">
                <a class="btn secundario chico" href="${rutaBase('calificaciones-calificar.html')}?id=${a.id}">Calificar</a>
                <a class="btn secundario chico" href="${rutaBase('calificaciones-nueva.html')}?id=${a.id}">Editar</a>
                <a class="btn secundario chico" href="${rutaBase('calificaciones-reportes.html')}?curso_id=${a.curso_id}&asignatura_id=${a.asignatura_id}&tipo=actividad&actividad_id=${a.id}">Reporte</a>
                <button class="btn peligro chico" onclick="eliminarActividad(${a.id})">Eliminar</button>
            </td>
        </tr>
    `).join('');
}

async function eliminarActividad(id) {
    if (!confirm('¿Eliminar esta actividad? También se borrarán todas las calificaciones asociadas.')) return;
    try {
        await apiFetch(`calif_actividades.php?id=${id}`, { method: 'DELETE' });
        cargarActividades();
    } catch (err) {
        mostrarAlerta('alertaCalificaciones', err.message);
    }
}
window.eliminarActividad = eliminarActividad;

document.getElementById('cursoAsignatura').addEventListener('change', cargarActividades);

// =====================================================================
// Importar actividades desde CSV a un RA
// =====================================================================
let importFilas = [];      // filas parseadas del CSV (se envían al servidor)
let importTipos = [];      // tipos de actividad del sistema
let importRAs = [];        // RA de la asignatura con sus valores para este curso
let importListo = false;   // true cuando la vista previa no tiene errores

function importAlerta(msg, tipo = 'error') { mostrarAlerta('alertaImportar', msg, tipo); }
function fmtPts(n) { return (Math.round((parseFloat(n) || 0) * 100) / 100).toLocaleString('es-DO', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }

// Parser CSV (comillas, comas/; /tab, saltos de línea dentro de comillas, BOM)
function parsearCsv(texto) {
    texto = texto.replace(/^\uFEFF/, '');
    const primera = texto.split(/\r?\n/, 1)[0] || '';
    const cuenta = c => (primera.match(new RegExp(c === '\t' ? '\t' : '\\' + c, 'g')) || []).length;
    const delim = [';', ',', '\t'].sort((a, b) => cuenta(b) - cuenta(a))[0];

    const filas = []; let fila = [], campo = '', enComillas = false;
    for (let i = 0; i < texto.length; i++) {
        const ch = texto[i];
        if (enComillas) {
            if (ch === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else enComillas = false; }
            else campo += ch;
        } else if (ch === '"') enComillas = true;
        else if (ch === delim) { fila.push(campo); campo = ''; }
        else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && texto[i + 1] === '\n') i++;
            fila.push(campo); campo = '';
            if (fila.some(c => c.trim() !== '')) filas.push(fila);
            fila = [];
        } else campo += ch;
    }
    fila.push(campo);
    if (fila.some(c => c.trim() !== '')) filas.push(fila);
    return filas;
}

function filasDesdeCsv(matriz) {
    if (!matriz.length) return [];
    // Si la primera fila es encabezado (la columna "Valor" no es numérica), se omite
    const v = (matriz[0][2] || '').trim().replace(',', '.');
    const lineaInicial = (v === '' || isNaN(Number(v))) ? 1 : 0;
    return matriz.slice(lineaInicial).map((c, i) => ({
        linea: i + 1 + lineaInicial,
        nombre: (c[0] || '').trim(),
        descripcion: (c[1] || '').trim(),
        valor: (c[2] || '').trim(),
        tipo: (c[3] || '').trim(),
        fecha: (c[4] || '').trim(),
    }));
}

async function leerArchivoTexto(archivo) {
    const buf = await archivo.arrayBuffer();
    let texto = new TextDecoder('utf-8').decode(buf);
    if (texto.includes('\uFFFD')) texto = new TextDecoder('windows-1252').decode(buf); // CSV de Excel en español
    return texto;
}

async function abrirModalImportar() {
    const combo = comboActual();
    if (!combo) return;
    importFilas = []; importListo = false;
    document.getElementById('alertaImportar').innerHTML = '';
    document.getElementById('importArchivo').value = '';
    document.getElementById('importVistaPrevia').style.display = 'none';
    document.getElementById('btnConfirmarImportar').disabled = true;
    document.getElementById('importInfoRA').textContent = '';
    document.getElementById('modalImportar').style.display = 'flex';

    const sel = document.getElementById('importRA');
    sel.innerHTML = '<option value="">Cargando…</option>';
    try {
        if (!importTipos.length) importTipos = (await apiFetch('calif_tipos_actividad.php')).tipos || [];
        document.getElementById('importTipoTodas').innerHTML = '<option value="">— Elegir —</option>' + opcionesTipo('');
        document.getElementById('importFechaTodas').value = '';
        importRAs = await apiFetch(`asignatura_unidades.php?asignatura_id=${combo.asignaturaId}&curso_id=${combo.cursoId}`);
        importRAs = (importRAs || []).filter(r => parseInt(r.activo ?? 1) === 1);
        sel.innerHTML = '<option value="">Selecciona el RA…</option>' + importRAs.map(r =>
            `<option value="${r.id}">${escaparHtml(r.codigo || 'RA')} — ${escaparHtml((r.titulo || '').slice(0, 80))}${r.valor != null ? ' (' + fmtPts(r.valor) + ' pts)' : ''}</option>`).join('');
    } catch (err) {
        sel.innerHTML = '<option value="">—</option>';
        importAlerta(err.message);
    }
}

function opcionesTipo(sel) {
    return importTipos.map(t => `<option value="${t.id}" ${String(t.id) === String(sel) ? 'selected' : ''}>${escaparHtml(t.nombre)}</option>`).join('');
}

function cerrarModalImportar() { document.getElementById('modalImportar').style.display = 'none'; }

function cuerpoImportacion(simular) {
    const combo = comboActual();
    return {
        curso_id: combo.cursoId,
        asignatura_id: combo.asignaturaId,
        unidad_id: document.getElementById('importRA').value,
        recuperacion: parseInt(document.getElementById('importNivel').value) || 0,
        simular,
        filas: importFilas,
    };
}

async function actualizarVistaPrevia() {
    importListo = false;
    document.getElementById('btnConfirmarImportar').disabled = true;
    document.getElementById('alertaImportar').innerHTML = '';
    if (!importFilas.length) return;
    if (!document.getElementById('importRA').value) {
        document.getElementById('importVistaPrevia').style.display = 'none';
        importAlerta('Selecciona el RA donde se importarán las actividades.', 'info');
        return;
    }
    try {
        const r = await apiFetch('calif_actividades_importar.php', { method: 'POST', body: cuerpoImportacion(true) });
        pintarVistaPrevia(r);
    } catch (err) { importAlerta(err.message); }
}

function pintarVistaPrevia({ filas, resumen }) {
    document.getElementById('importVistaPrevia').style.display = 'block';
    const nivel = parseInt(document.getElementById('importNivel').value) || 0;
    document.getElementById('importInfoRA').textContent = resumen.valor_ra != null
        ? `${resumen.ra_codigo || 'RA'} vale ${fmtPts(resumen.valor_ra)} pts · ya asignados${nivel ? ' en R' + nivel : ''}: ${fmtPts(resumen.usado)} pts · disponibles: ${fmtPts(resumen.disponible)} pts.`
        : `${resumen.ra_codigo || 'RA'} no tiene valor definido: los valores se importan tal como vienen en el CSV.`;

    let html = `<strong>${resumen.a_importar}</strong> actividad(es) a importar`;
    if (resumen.duplicadas) html += ` · <span style="color:var(--color-tardanza);">${resumen.duplicadas} omitida(s) por duplicadas</span>`;
    if (resumen.con_error) html += ` · <span style="color:var(--color-absent);">${resumen.con_error} con error</span>`;
    html += `<br>Suma en el CSV: <strong>${fmtPts(resumen.suma_original)}</strong> pts → suma a importar: <strong>${fmtPts(resumen.suma_final)}</strong> pts`;
    if (resumen.ajustado) html += `<br><span style="color:var(--color-tardanza); font-weight:600;">⚠ Los valores superaban lo disponible del RA y se ajustaron proporcionalmente para igualarlo.</span>`;
    if (resumen.error_tope) html += `<br><span style="color:var(--color-absent); font-weight:600;">${escaparHtml(resumen.error_tope)}</span>`;
    document.getElementById('importResumen').innerHTML = html;

    const etiqueta = { ok: ['OK', 'var(--color-present)'], duplicada: ['Omitida', 'var(--color-tardanza)'], error: ['Error', 'var(--color-absent)'] };
    const origenTxt = {
        no_reconocido: f => `No reconocido: «${f.tipo_texto}». Elige el tipo correcto.`,
        vacio: () => 'Sin tipo en el CSV. Elige uno.',
    };
    document.getElementById('importTabla').innerHTML = filas.map((f, i) => {
        const [txt, color] = etiqueta[f.estado];
        const cambio = f.estado === 'ok' && f.valor_original != null && Math.abs(f.valor_original - f.valor_final) > 0.001;
        const aviso = f.tipo_origen !== 'manual' && origenTxt[f.tipo_origen] ? origenTxt[f.tipo_origen](f) : '';
        const estiloAviso = aviso ? 'border-color:var(--color-tardanza);' : '';
        return `<tr>
            <td>${f.linea}</td>
            <td><strong>${escaparHtml(f.nombre || '—')}</strong>${f.descripcion ? `<br><span style="color:var(--color-ink-soft); font-size:0.85em;">${escaparHtml(f.descripcion.slice(0, 90))}${f.descripcion.length > 90 ? '…' : ''}</span>` : ''}</td>
            <td style="min-width:170px;">
                <select data-i="${i}" data-campo="tipo" style="width:100%; ${estiloAviso}"><option value="">—</option>${opcionesTipo(f.tipo_id)}</select>
                ${f.valor_directo ? `<input type="text" data-i="${i}" data-campo="tipo_personalizado" maxlength="100" value="${escaparHtml(f.tipo_personalizado || '')}" placeholder="¿Qué tipo es?" style="width:100%; margin-top:4px;">` : ''}
                ${aviso ? `<span style="display:block; font-size:0.75em; color:var(--color-tardanza); margin-top:2px;">${escaparHtml(aviso)}</span>` : ''}
            </td>
            <td style="min-width:140px;">
                <input type="date" data-i="${i}" data-campo="fecha" value="${f.fecha || ''}" style="width:100%;">
                ${f.fecha_por_defecto ? '<span style="display:block; font-size:0.75em; color:var(--color-ink-soft); margin-top:2px;">Hoy (sin fecha en el CSV)</span>' : ''}
            </td>
            <td class="num">${f.valor_original != null ? fmtPts(f.valor_original) : '—'}</td>
            <td class="num" style="${cambio ? 'font-weight:700; color:var(--color-tardanza);' : ''}">${f.estado === 'ok' ? fmtPts(f.valor_final) : '—'}</td>
            <td style="color:${color};">${txt}${f.mensaje ? `<br><span style="font-size:0.8em;">${escaparHtml(f.mensaje)}</span>` : ''}</td>
        </tr>`;
    }).join('');

    importListo = resumen.a_importar > 0 && resumen.con_error === 0 && !resumen.error_tope;
    document.getElementById('btnConfirmarImportar').disabled = !importListo;
}

async function alElegirArchivo() {
    const archivo = document.getElementById('importArchivo').files[0];
    importFilas = [];
    document.getElementById('importVistaPrevia').style.display = 'none';
    document.getElementById('btnConfirmarImportar').disabled = true;
    if (!archivo) return;
    try {
        importFilas = filasDesdeCsv(parsearCsv(await leerArchivoTexto(archivo)));
        if (!importFilas.length) { importAlerta('El archivo está vacío o no tiene el formato esperado.'); return; }
        if (importFilas.length > 200) { importAlerta('El archivo tiene más de 200 filas. Divídelo en varios archivos.'); importFilas = []; return; }
        await actualizarVistaPrevia();
    } catch (err) { importAlerta('No se pudo leer el archivo: ' + err.message); }
}

async function confirmarImportacion() {
    if (!importListo) return;
    const btn = document.getElementById('btnConfirmarImportar');
    btn.disabled = true; btn.textContent = 'Importando…';
    try {
        const r = await apiFetch('calif_actividades_importar.php', { method: 'POST', body: cuerpoImportacion(false) });
        cerrarModalImportar();
        mostrarAlerta('alertaCalificaciones',
            `Se importaron ${r.importadas} actividad(es)` + (r.omitidas ? ` (${r.omitidas} omitida(s) por duplicadas)` : '') +
            (r.resumen.ajustado ? '. Los valores se ajustaron para igualar el valor del RA.' : '.'), 'exito');
        cargarActividades();
    } catch (err) {
        importAlerta(err.message);
        btn.disabled = false;
    } finally { btn.textContent = 'Importar actividades'; }
}

function descargarPlantillaCsv() {
    const lineas = [
        'Nombre actividad;Descripción;Valor;Tipo de actividad;Fecha',
        'Infografía de gestores de BD;Realizar una infografía sobre un gestor de base de datos;5;Actividad grupal;15/09/2026',
        'Quiz de repaso;Quiz hecho en Kahoot;3;Otros;2026-09-20',
    ];
    const blob = new Blob(['\uFEFF' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'plantilla_actividades.csv';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(a.href);
}

document.getElementById('btnImportarCsv').addEventListener('click', abrirModalImportar);
document.getElementById('btnCerrarImportar').addEventListener('click', cerrarModalImportar);
document.getElementById('btnCancelarImportar').addEventListener('click', cerrarModalImportar);
document.getElementById('importArchivo').addEventListener('change', alElegirArchivo);
document.getElementById('importRA').addEventListener('change', actualizarVistaPrevia);
document.getElementById('importNivel').addEventListener('change', actualizarVistaPrevia);
document.getElementById('btnConfirmarImportar').addEventListener('click', confirmarImportacion);
document.getElementById('importTabla').addEventListener('change', e => {
    const el = e.target, i = parseInt(el.dataset.i);
    if (isNaN(i) || !importFilas[i]) return;
    if (el.dataset.campo === 'tipo') { importFilas[i].tipo_id = el.value; importFilas[i].tipo_personalizado = ''; }
    else if (el.dataset.campo === 'tipo_personalizado') importFilas[i].tipo_personalizado = el.value;
    else if (el.dataset.campo === 'fecha') importFilas[i].fecha = el.value;
    actualizarVistaPrevia();
});
document.getElementById('btnTipoTodas').addEventListener('click', () => {
    const v = document.getElementById('importTipoTodas').value;
    if (!v) return importAlerta('Elige primero el tipo de actividad.', 'info');
    importFilas.forEach(f => { f.tipo_id = v; f.tipo_personalizado = ''; });
    actualizarVistaPrevia();
});
document.getElementById('btnFechaTodas').addEventListener('click', () => {
    const v = document.getElementById('importFechaTodas').value;
    if (!v) return importAlerta('Elige primero la fecha.', 'info');
    importFilas.forEach(f => { f.fecha = v; });
    actualizarVistaPrevia();
});
document.getElementById('btnPlantillaCsv').addEventListener('click', descargarPlantillaCsv);

inicializar();
