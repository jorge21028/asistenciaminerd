// ---------------------------------------------------------------------
// Actividades (Dinámica de Clase)
// Compartido entre la ventana de control (actividades.html) y la
// ventana de proyección (actividad-proyeccion.html), sincronizadas vía
// BroadcastChannel. El temporizador se calcula siempre a partir de
// marcas de tiempo del reloj (Date.now()), nunca contando "ticks", para
// que no pierda precisión aunque la pestaña quede en segundo plano.
// ---------------------------------------------------------------------

const canalActividad = new BroadcastChannel('dinamica_actividad_sync');
const esProyeccionActividad = !document.getElementById('btnIniciar');

let combosActividad = [];
let mapaTipoAsignatura = {};
let unidadesActuales = [];
let actividadActual = null; // {tituloTexto, cursoNombre, asignaturaNombre, unidadEtiqueta, unidadTexto, valor, objetivo, descripcion}

let duracionTotalSeg = 600;
let estadoTimer = 'detenido'; // detenido | corriendo | pausado | terminado
let finTimestamp = null;
let restanteMsPausado = null;

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------
function formatoTiempo(ms) {
    const totalSeg = Math.max(0, Math.round(ms / 1000));
    const h = Math.floor(totalSeg / 3600);
    const m = Math.floor((totalSeg % 3600) / 60);
    const s = totalSeg % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function calcularRestanteMs() {
    if (estadoTimer === 'corriendo') return Math.max(0, finTimestamp - Date.now());
    if (estadoTimer === 'pausado') return restanteMsPausado;
    if (estadoTimer === 'terminado') return 0;
    return duracionTotalSeg * 1000;
}

// ---------------------------------------------------------------------
// Pintado del temporizador y del contenido (ambas ventanas)
// ---------------------------------------------------------------------
function pintarTimer() {
    const restanteMs = calcularRestanteMs();
    const texto = formatoTiempo(restanteMs);
    const etiquetas = { detenido: 'Detenido', corriendo: 'En curso', pausado: 'Pausado', terminado: '¡Tiempo terminado!' };

    const displays = [document.getElementById('displayTemporizador'), document.getElementById('displayTemporizadorProyeccion')];
    displays.forEach(el => {
        if (!el) return;
        el.textContent = texto;
        el.classList.toggle('temporizador-alerta', restanteMs > 0 && restanteMs <= 30000);
        el.classList.toggle('temporizador-terminado', estadoTimer === 'terminado');
    });

    const estados = [document.getElementById('estadoTemporizadorTexto'), document.getElementById('estadoTimerProyeccion')];
    estados.forEach(el => { if (el) el.textContent = etiquetas[estadoTimer]; });
}

function pintarContenidoActividad() {
    if (!actividadActual) return;
    const set = (id, texto) => { const el = document.getElementById(id); if (el) el.textContent = texto; };

    set('proyeccionContexto', `${actividadActual.cursoNombre} — ${actividadActual.asignaturaNombre}`);
    set('proyeccionUnidadEtiqueta', actividadActual.unidadEtiqueta);
    set('proyeccionUnidad', actividadActual.unidadTexto || '—');
    set('proyeccionTitulo', actividadActual.titulo);
    set('proyeccionValor', actividadActual.valor ? `Valor: ${actividadActual.valor}` : '');
    set('proyeccionObjetivo', actividadActual.objetivo || '—');
    set('proyeccionDescripcion', actividadActual.descripcion);
}

function bucleTimer() {
    if (estadoTimer === 'corriendo') {
        const restanteMs = finTimestamp - Date.now();
        if (restanteMs <= 0) {
            estadoTimer = 'terminado';
            restanteMsPausado = 0;
            if (!esProyeccionActividad) difundirActividad();
        }
    }
    pintarTimer();
}
setInterval(bucleTimer, 250);

// ---------------------------------------------------------------------
// Sincronización
// ---------------------------------------------------------------------
function difundirActividad() {
    canalActividad.postMessage({
        tipo: 'sync',
        actividad: actividadActual,
        duracionTotalSeg,
        estadoTimer,
        finTimestamp,
        restanteMsPausado,
    });
}

canalActividad.onmessage = (evento) => {
    const d = evento.data;

    if (d.tipo === 'solicitar_sync' && !esProyeccionActividad && actividadActual) {
        difundirActividad();
        return;
    }

    if (d.tipo === 'sync' && esProyeccionActividad) {
        actividadActual = d.actividad;
        duracionTotalSeg = d.duracionTotalSeg;
        estadoTimer = d.estadoTimer;
        finTimestamp = d.finTimestamp;
        restanteMsPausado = d.restanteMsPausado;
        pintarContenidoActividad();
        pintarTimer();
    }
};

// =======================================================================
// VENTANA DE CONTROL
// =======================================================================
if (!esProyeccionActividad) {

    async function inicializarControl() {
        try {
            const [combos, asignaturas] = await Promise.all([
                apiFetch('asignaciones.php'),
                apiFetch('asignaturas.php'),
            ]);
            combosActividad = combos;
            asignaturas.forEach(a => { mapaTipoAsignatura[a.id] = a.tipo; });

            document.getElementById('cursoAsignatura').innerHTML =
                '<option value="">Selecciona…</option>' +
                combos.map(c => `<option value="${c.curso_id}:${c.asignatura_id}">${escaparHtml(c.curso_nombre)} — ${escaparHtml(c.asignatura_nombre)}</option>`).join('');
        } catch (err) {
            mostrarAlerta('alertaActividad', err.message);
        }
        cargarRecientes();
    }

    async function cargarUnidadesDeAsignatura() {
        const valor = document.getElementById('cursoAsignatura').value;
        const selectUnidad = document.getElementById('unidad');
        selectUnidad.innerHTML = '<option value="">— Sin especificar —</option>';
        if (!valor) return;

        const [, asignaturaId] = valor.split(':');
        const tipo = mapaTipoAsignatura[asignaturaId] || 'academica';
        document.getElementById('labelUnidad').textContent = tipo === 'tecnico' ? 'RA (Resultado de Aprendizaje)' : 'Unidad de aprendizaje';

        try {
            unidadesActuales = await apiFetch(`asignatura_unidades.php?asignatura_id=${asignaturaId}`);
            selectUnidad.innerHTML = '<option value="">— Sin especificar —</option>' +
                unidadesActuales.map(u => `<option value="${u.id}">${escaparHtml(u.codigo ? u.codigo + ': ' : '')}${escaparHtml(u.titulo)}</option>`).join('');
        } catch (err) {
            mostrarAlerta('alertaActividad', err.message);
        }
        cargarRecientes();
    }

    async function cargarRecientes() {
        const valor = document.getElementById('cursoAsignatura').value;
        let params = '';
        if (valor) {
            const [cursoId, asignaturaId] = valor.split(':');
            params = `?curso_id=${cursoId}&asignatura_id=${asignaturaId}`;
        }
        try {
            const recientes = await apiFetch(`dinamica_actividades.php${params}`);
            const cont = document.getElementById('listaRecientes');
            if (!recientes.length) {
                cont.innerHTML = '<p class="estado-vacio">Todavía no hay actividades guardadas.</p>';
                return;
            }
            cont.innerHTML = recientes.map(r => `
                <div class="proyeccion-turno-item" style="background:var(--color-surface-alt); color:var(--color-ink); cursor:pointer; margin-bottom:8px;" onclick="cargarActividadGuardada(${r.id})">
                    <span style="background:var(--color-primary); color:#fff;">🗂️</span>
                    <div>
                        <strong>${escaparHtml(r.titulo)}</strong>
                        <div style="font-size:0.78rem; color:var(--color-ink-soft);">${escaparHtml(r.curso_nombre)} — ${escaparHtml(r.asignatura_nombre)} · ${new Date(r.created_at).toLocaleDateString('es-DO')}</div>
                    </div>
                </div>
            `).join('');
        } catch (err) { /* no bloquea el resto de la pantalla */ }
    }

    async function cargarActividadGuardada(id) {
        try {
            const a = await apiFetch(`dinamica_actividades.php?id=${id}`);
            document.getElementById('cursoAsignatura').value = `${a.curso_id}:${a.asignatura_id}`;
            await cargarUnidadesDeAsignatura();
            if (a.unidad_id) document.getElementById('unidad').value = a.unidad_id;
            document.getElementById('titulo').value = a.titulo;
            document.getElementById('valor').value = a.valor || '';
            document.getElementById('objetivo').value = a.objetivo || '';
            document.getElementById('descripcion').value = a.descripcion;
            document.getElementById('minutos').value = Math.floor(a.duracion_segundos / 60);
            document.getElementById('segundos').value = a.duracion_segundos % 60;
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err) {
            mostrarAlerta('alertaActividad', err.message);
        }
    }
    window.cargarActividadGuardada = cargarActividadGuardada;

    function leerFormulario() {
        const valor = document.getElementById('cursoAsignatura').value;
        if (!valor) return null;
        const [cursoId, asignaturaId] = valor.split(':');
        const combo = combosActividad.find(c => String(c.curso_id) === cursoId && String(c.asignatura_id) === asignaturaId);
        const unidadId = document.getElementById('unidad').value;
        const unidadObj = unidadesActuales.find(u => String(u.id) === unidadId);
        const tipo = mapaTipoAsignatura[asignaturaId] || 'academica';

        const titulo = document.getElementById('titulo').value.trim();
        const descripcion = document.getElementById('descripcion').value.trim();
        if (!titulo || !descripcion) return { error: 'Completa al menos el título y la descripción de la actividad.' };

        return {
            cursoId, asignaturaId, unidadId: unidadId || null,
            cursoNombre: combo ? combo.curso_nombre : '',
            asignaturaNombre: combo ? combo.asignatura_nombre : '',
            unidadEtiqueta: tipo === 'tecnico' ? 'RA (Resultado de Aprendizaje)' : 'Unidad de aprendizaje',
            unidadTexto: unidadObj ? `${unidadObj.codigo ? unidadObj.codigo + ': ' : ''}${unidadObj.titulo}` : '',
            titulo,
            valor: document.getElementById('valor').value.trim(),
            objetivo: document.getElementById('objetivo').value.trim(),
            descripcion,
            duracionSegundos: (parseInt(document.getElementById('minutos').value) || 0) * 60 + (parseInt(document.getElementById('segundos').value) || 0),
        };
    }

    // -------------------------------------------------------------
    // PDF (imagen, sin texto seleccionable)
    // -------------------------------------------------------------
    async function generarPdf() {
        const datos = leerFormulario();
        if (!datos) { mostrarAlerta('alertaActividad', 'Selecciona el curso y la asignatura.'); return; }
        if (datos.error) { mostrarAlerta('alertaActividad', datos.error); return; }

        document.getElementById('pdfContexto').textContent = `${datos.cursoNombre} — ${datos.asignaturaNombre}${datos.unidadTexto ? ' · ' + datos.unidadEtiqueta + ': ' + datos.unidadTexto : ''}`;
        document.getElementById('pdfTitulo').textContent = datos.titulo;
        document.getElementById('pdfValor').textContent = datos.valor ? `Valor: ${datos.valor}` : '';
        document.getElementById('pdfObjetivo').textContent = datos.objetivo || '—';
        document.getElementById('pdfDescripcion').textContent = datos.descripcion;
        document.getElementById('pdfPie').textContent = `Generado el ${new Date().toLocaleDateString('es-DO')} — Documento de uso exclusivo en clase`;

        const btn = document.getElementById('btnPdf');
        btn.disabled = true;
        btn.textContent = 'Generando…';

        try {
            const contenedor = document.getElementById('hojaActividadPDF');
            contenedor.style.left = '0';
            contenedor.style.position = 'fixed';
            contenedor.style.top = '-99999px'; // renderizable pero fuera de la vista

            const canvas = await html2canvas(contenedor, { scale: 2, backgroundColor: '#ffffff' });
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margen = 24;
            let anchoImg = pageWidth - margen * 2;
            let altoImg = canvas.height * (anchoImg / canvas.width);
            if (altoImg > pageHeight - margen * 2) {
                altoImg = pageHeight - margen * 2;
                anchoImg = canvas.width * (altoImg / canvas.height);
            }
            const x = (pageWidth - anchoImg) / 2;
            pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', x, margen, anchoImg, altoImg);

            const nombreArchivo = 'Actividad_' + datos.titulo.replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 60) + '.pdf';
            pdf.save(nombreArchivo);

            contenedor.style.top = '';
            contenedor.style.left = '-9999px';
        } catch (err) {
            mostrarAlerta('alertaActividad', 'No se pudo generar el PDF: ' + err.message);
        }

        btn.disabled = false;
        btn.textContent = '📄 Descargar PDF (sin copiar/pegar)';
    }

    // -------------------------------------------------------------
    // Proyectar (guarda + abre ventana + prepara temporizador)
    // -------------------------------------------------------------
    async function proyectar() {
        const datos = leerFormulario();
        if (!datos) { mostrarAlerta('alertaActividad', 'Selecciona el curso y la asignatura.'); return; }
        if (datos.error) { mostrarAlerta('alertaActividad', datos.error); return; }
        if (datos.duracionSegundos < 10) { mostrarAlerta('alertaActividad', 'Configura una duración de al menos 10 segundos.'); return; }

        try {
            await apiFetch('dinamica_actividades.php', {
                method: 'POST',
                body: {
                    curso_id: datos.cursoId, asignatura_id: datos.asignaturaId, unidad_id: datos.unidadId,
                    titulo: datos.titulo, valor: datos.valor, objetivo: datos.objetivo, descripcion: datos.descripcion,
                    duracion_segundos: datos.duracionSegundos,
                },
            });
        } catch (err) {
            mostrarAlerta('alertaActividad', err.message);
            return;
        }

        actividadActual = datos;
        duracionTotalSeg = datos.duracionSegundos;
        estadoTimer = 'detenido';
        finTimestamp = null;
        restanteMsPausado = duracionTotalSeg * 1000;

        document.getElementById('cardTemporizador').style.display = 'block';
        pintarTimer();
        difundirActividad();
        cargarRecientes();

        window.open(rutaBase('actividad-proyeccion.html'), 'actividad_proyeccion', 'width=1200,height=800');
        mostrarAlerta('alertaActividad', 'Actividad guardada y lista para proyectar. Usa los controles del temporizador cuando quieras iniciar la cuenta regresiva.', 'exito');
    }

    document.getElementById('cursoAsignatura').addEventListener('change', cargarUnidadesDeAsignatura);
    document.getElementById('btnPdf').addEventListener('click', generarPdf);
    document.getElementById('btnProyectar').addEventListener('click', proyectar);

    document.getElementById('btnIniciar').addEventListener('click', () => {
        if (estadoTimer === 'corriendo') return;
        const restanteMs = estadoTimer === 'pausado' ? restanteMsPausado : duracionTotalSeg * 1000;
        finTimestamp = Date.now() + restanteMs;
        estadoTimer = 'corriendo';
        pintarTimer();
        difundirActividad();
    });
    document.getElementById('btnPausar').addEventListener('click', () => {
        if (estadoTimer !== 'corriendo') return;
        restanteMsPausado = Math.max(0, finTimestamp - Date.now());
        estadoTimer = 'pausado';
        pintarTimer();
        difundirActividad();
    });
    document.getElementById('btnReiniciarTimer').addEventListener('click', () => {
        estadoTimer = 'detenido';
        finTimestamp = null;
        restanteMsPausado = duracionTotalSeg * 1000;
        pintarTimer();
        difundirActividad();
    });

    inicializarControl();

} else {
    // ===================================================================
    // VENTANA DE PROYECCIÓN
    // ===================================================================
    canalActividad.postMessage({ tipo: 'solicitar_sync' });
}
