// ---------------------------------------------------------------------
// Planificación de Clases
// Este módulo llama al API con apiFetch(), exactamente igual que
// cualquier otra pantalla del sistema (mismo Auth, mismo formato de
// respuesta) — Api de abajo son solo nombres cortos, no una capa aparte.
// ---------------------------------------------------------------------
const Api = {
  docentes: () => apiFetch('planificacion/api/docentes.php'),
  modulosPorDocente: (docenteId) => apiFetch(`planificacion/api/modulos.php?docente_id=${docenteId}`),
  todosLosModulos: () => apiFetch('planificacion/api/modulos.php?todos=1'),
  resultadosAprendizaje: (moduloId) => apiFetch(`planificacion/api/resultados_aprendizaje.php?modulo_id=${moduloId}`),
  instrumentosEvaluacion: () => apiFetch('planificacion/api/instrumentos_evaluacion.php'),

  listarContenidos: (asignaturaId) => apiFetch(`planificacion/api/contenidos_listar.php?asignatura_id=${asignaturaId}`),
  guardarContenido: (payload) => apiFetch('planificacion/api/contenidos_guardar.php', { method: 'POST', body: payload }),
  eliminarContenido: (id) => apiFetch('planificacion/api/contenidos_eliminar.php', { method: 'POST', body: { id } }),

  listarLogos: () => apiFetch('planificacion/api/logos_listar.php'),
  subirLogo: (tipo, imagenBase64) => apiFetch('planificacion/api/logos_subir.php', { method: 'POST', body: { tipo, imagen_base64: imagenBase64 } }),

  bachilleratos: () => apiFetch('planificacion/api/bachilleratos.php'),
  agregarBachillerato: (nombre) => apiFetch('planificacion/api/bachilleratos.php', { method: 'POST', body: { nombre } }),
  eliminarBachillerato: (id) => apiFetch(`planificacion/api/bachilleratos.php?id=${id}`, { method: 'DELETE' }),

  generarIA: (payload) => apiFetch('planificacion/api/generar_ia.php', { method: 'POST', body: payload }),
  guardarPlanificacion: (payload) => apiFetch('planificacion/api/guardar_planificacion.php', { method: 'POST', body: payload }),
  listarPlanificaciones: (docenteId) => apiFetch(`planificacion/api/listar_planificaciones.php?docente_id=${docenteId || ''}`),

  // Ver/Word/PDF se abren con <a href> (nueva pestaña/descarga), y un
  // navegador no puede mandar el header Authorization al navegar a un
  // link. Por eso primero se pide un enlace firmado de un solo uso
  // (vence en 2 minutos) y RECIÉN con eso se arma la URL final.
  async _urlFirmada(id, endpoint) {
    const firma = await apiFetch(`planificacion/api/link_firmado.php?id=${id}`);
    const base = (window.API_URL || '').replace(/\/+$/, '');
    return `${base}/planificacion/api/${endpoint}.php?id=${firma.id}&t=${encodeURIComponent(firma.t)}&exp=${firma.exp}`;
  },
  urlDocx(id) { return this._urlFirmada(id, 'exportar_docx'); },
  urlPdf(id) { return this._urlFirmada(id, 'exportar_pdf'); },
  urlVer(id) { return this._urlFirmada(id, 'ver_planificacion'); },
};

const state = {
  step: 1,
  docente: null,        // { id, nombre_completo, institucion_id, institucion_nombre }
  modulo: null,          // { id, nombre, codigo }
  ra: null,              // { id, codigo, descripcion }
  bachillerato: '',      // nombre del programa/ciclo elegido en el paso 1
  tipo: 'Individual',
  tiempo: 50,
  fecha: '',
  valor: '',
  enunciado: '',
  codigoActividad: '',
  generado: null,        // respuesta cruda de la IA
  instrumentos: [],
  planificacionId: null,
};

// ---------- Navegación entre pasos ----------
// Ver/Word/PDF requieren un enlace firmado (ver la función _urlFirmada que
// vence en 2 minutos — por eso se pide FRESCO justo al hacer clic, no de
// antemano (si el docente se tarda en hacer clic, un enlace pre-generado
// ya podría estar vencido).
function abrirEnlacePlanificacion(id, metodo) {
  return async (e) => {
    e.preventDefault();
    try {
      const url = await Api[metodo](id);
      window.open(url, '_blank');
    } catch (err) {
      alert('No se pudo abrir el enlace: ' + err.message);
    }
  };
}

function cablearEnlaceFirmado(elementId, id, metodo) {
  document.getElementById(elementId).onclick = abrirEnlacePlanificacion(id, metodo);
}

function goToStep(n) {
  state.step = n;
  document.querySelectorAll('.step-view').forEach(el => el.classList.add('is-hidden'));
  document.getElementById(`view-${n}`).classList.remove('is-hidden');

  document.querySelectorAll('.planif-paso').forEach(el => {
    const s = parseInt(el.dataset.step, 10);
    el.classList.toggle('active', s === n);
    el.classList.toggle('completado', s < n);
  });
}

// ---------- Inicialización ----------
async function init() {
  const usuario = Auth.getUsuario();
  const esSupervisor = usuario && (usuario.rol === 'admin' || usuario.rol === 'coordinador');
  let docentesCargados = [];

  try {
    docentesCargados = await Api.docentes();
    const sel = document.getElementById('selDocente');
    sel.innerHTML = '<option value="">Selecciona tu nombre…</option>' +
      docentesCargados.map(d => `<option value="${d.id}">${d.nombre_completo}</option>`).join('');
    sel.dataset.raw = JSON.stringify(docentesCargados);
  } catch (e) {
    alert('No se pudo conectar con la API de Planificación.\n' + e.message);
  }

  try {
    state.instrumentos = await Api.instrumentosEvaluacion();
    const sel = document.getElementById('selInstrumento');
    sel.innerHTML = state.instrumentos.map(i => `<option value="${i.id}">${i.nombre}</option>`).join('')
      + '<option value="otro">Otro (especificar)</option>';
  } catch (e) { /* silencioso: no bloquea el flujo */ }

  await cargarBachilleratos();

  const hoy = new Date().toISOString().slice(0, 10);
  document.getElementById('dateFecha').value = hoy;

  // Los listeners (incluido el que carga los módulos al cambiar el
  // docente) se registran ANTES de intentar auto-seleccionar abajo —
  // si no, el evento "change" se dispara al vacío y no pasa nada
  // (esto era el bug: al profesor nunca le cargaban los módulos).
  bindEvents();

  if (!esSupervisor) {
    // Un profesor siempre planifica como sí mismo — no hace falta que
    // elija su nombre de una lista (ya inició sesión en el portal).
    const propio = docentesCargados.find(d => String(d.id) === String(usuario.id));
    document.getElementById('campoDocente').classList.add('is-hidden');
    const indicador = document.getElementById('docentePlanificando');
    indicador.classList.remove('is-hidden');
    indicador.textContent = `Planificando como: ${usuario.nombre}`;

    if (propio) {
      const sel = document.getElementById('selDocente');
      sel.value = String(propio.id);
      sel.dispatchEvent(new Event('change'));
    } else {
      alert('Tu usuario no aparece en el listado de docentes de Planificación. Pide a un administrador que revise tu cuenta.');
    }
  }

  goToStep(1);
}

async function cargarBachilleratos() {
  try {
    const lista = await Api.bachilleratos();
    const sel = document.getElementById('selBachillerato');
    const valorActual = sel.value;
    sel.innerHTML = '<option value="">Selecciona un programa/ciclo…</option>' +
      lista.map(b => `<option value="${escapeHtml(b.nombre)}">${escapeHtml(b.nombre)}</option>`).join('');
    if (valorActual) sel.value = valorActual;
  } catch (e) {
    document.getElementById('selBachillerato').innerHTML = '<option value="">No se pudo cargar el catálogo</option>';
  }
}

function bindEvents() {
  // --- Paso 1 ---
  document.getElementById('selDocente').addEventListener('change', async (e) => {
    const docentes = JSON.parse(e.target.dataset.raw || '[]');
    const d = docentes.find(x => String(x.id) === e.target.value);
    state.docente = d || null;

    document.getElementById('txtInstitucion').value = d ? d.institucion_nombre : '';

    const selModulo = document.getElementById('selModulo');
    const selRA = document.getElementById('selRA');
    selModulo.innerHTML = '<option value="">Cargando…</option>';
    selRA.innerHTML = '<option value="">Selecciona un módulo primero…</option>';
    state.modulo = null; state.ra = null;

    if (!d) { selModulo.innerHTML = '<option value="">Selecciona un docente primero…</option>'; return; }

    try {
      const modulos = await Api.modulosPorDocente(d.id);
      selModulo.innerHTML = '<option value="">Selecciona un módulo…</option>' +
        modulos.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('');
      selModulo.dataset.raw = JSON.stringify(modulos);
    } catch (e) {
      selModulo.innerHTML = '<option value="">Error al cargar módulos</option>';
    }
  });

  document.getElementById('selModulo').addEventListener('change', async (e) => {
    const modulos = JSON.parse(e.target.dataset.raw || '[]');
    const m = modulos.find(x => String(x.id) === e.target.value);
    state.modulo = m || null;

    const selRA = document.getElementById('selRA');
    selRA.innerHTML = '<option value="">Cargando…</option>';
    state.ra = null;
    if (!m) { selRA.innerHTML = '<option value="">Selecciona un módulo primero…</option>'; return; }

    try {
      const ras = await Api.resultadosAprendizaje(m.id);
      if (ras.length === 0) {
        selRA.innerHTML = '<option value="">Este módulo no tiene RA cargados</option>';
        return;
      }
      selRA.innerHTML = '<option value="">Selecciona un RA…</option>' +
        ras.map(r => `<option value="${r.id}">${r.codigo} — ${r.descripcion.slice(0, 60)}${r.descripcion.length > 60 ? '…' : ''}</option>`).join('');
      selRA.dataset.raw = JSON.stringify(ras);
    } catch (e) {
      selRA.innerHTML = '<option value="">Error al cargar RA</option>';
    }
  });

  document.getElementById('selRA').addEventListener('change', (e) => {
    const ras = JSON.parse(e.target.dataset.raw || '[]');
    state.ra = ras.find(x => String(x.id) === e.target.value) || null;
  });

  document.getElementById('btnPaso1Next').addEventListener('click', () => {
    if (!state.docente) return alert('Selecciona un docente.');
    const bachillerato = document.getElementById('selBachillerato').value;
    if (!bachillerato) return alert('Selecciona el Bachillerato/Programa al que pertenece esta clase.');
    state.bachillerato = bachillerato;
    if (!state.modulo) return alert('Selecciona un módulo formativo.');
    if (!state.ra) return alert('Selecciona un Resultado de Aprendizaje (RA).');
    goToStep(2);
  });

  // --- Paso 2 ---
  document.getElementById('selTipo').addEventListener('change', (e) => {
    state.tipo = e.target.value;
  });
  state.tipo = document.getElementById('selTipo').value; // "Individual" por defecto

  document.getElementById('btnPaso2Back').addEventListener('click', () => goToStep(1));

  document.getElementById('btnPaso2Next').addEventListener('click', () => {
    state.tiempo = parseInt(document.getElementById('numTiempo').value, 10) || 50;
    state.fecha = document.getElementById('dateFecha').value;
    state.valor = document.getElementById('txtValor').value.trim();
    state.enunciado = document.getElementById('txtEnunciado').value.trim();
    state.codigoActividad = document.getElementById('txtCodigoActividad').value.trim();

    if (!state.fecha) return alert('Selecciona la fecha de realización.');
    if (state.enunciado.length < 5) return alert('Escribe el enunciado/título de la actividad.');

    goToStep(3);
    generarConIA();
  });

  // --- Paso 3 ---
  document.getElementById('btnReintentar').addEventListener('click', generarConIA);

  // --- Paso 4 ---
  document.getElementById('selInstrumento').addEventListener('change', (e) => {
    document.getElementById('fieldInstrumentoOtro').classList.toggle('is-hidden', e.target.value !== 'otro');
  });

  document.getElementById('btnPaso4Back').addEventListener('click', () => goToStep(2));
  document.getElementById('btnPaso4Next').addEventListener('click', () => goToStep(5));

  // --- Paso 5 ---
  document.getElementById('btnGuardar').addEventListener('click', guardarPlanificacion);
  document.getElementById('btnNueva').addEventListener('click', () => location.reload());

  // --- Historial ---
  document.getElementById('btnHistorial').addEventListener('click', abrirHistorial);
  document.getElementById('btnCerrarHistorial').addEventListener('click', () => {
    document.getElementById('modalHistorial').classList.add('is-hidden');
  });

  // --- Gestor de contenidos ---
  document.getElementById('btnGestionarContenidos').addEventListener('click', abrirGestorContenidos);
  document.getElementById('btnCerrarContenidos').addEventListener('click', () => {
    document.getElementById('modalContenidos').classList.add('is-hidden');
  });
  document.getElementById('cgSelModulo').addEventListener('change', onCambioModuloGestor);
  document.getElementById('btnAgregarContenido').addEventListener('click', agregarContenido);

  // --- Logos institucionales ---
  document.getElementById('btnLogos').addEventListener('click', abrirModalLogos);
  document.getElementById('btnCerrarLogos').addEventListener('click', () => {
    document.getElementById('modalLogos').classList.add('is-hidden');
  });
  document.getElementById('fileLogoCentro').addEventListener('change', (e) => subirLogoDesdeInput(e, 'centro'));
  document.getElementById('fileLogoMinerd').addEventListener('change', (e) => subirLogoDesdeInput(e, 'minerd'));
  document.getElementById('fileLogoDetp').addEventListener('change', (e) => subirLogoDesdeInput(e, 'detp'));

  // --- Programas/Bachilleratos ---
  document.getElementById('btnBachilleratos').addEventListener('click', abrirModalBachilleratos);
  document.getElementById('btnCerrarBachilleratos').addEventListener('click', () => {
    document.getElementById('modalBachilleratos').classList.add('is-hidden');
  });
  document.getElementById('btnAgregarBachillerato').addEventListener('click', agregarBachilleratoNuevo);
}

// ---------- Programas/Bachilleratos ----------
async function abrirModalBachilleratos() {
  document.getElementById('modalBachilleratos').classList.remove('is-hidden');
  await pintarListaBachilleratos();
}

async function pintarListaBachilleratos() {
  const cont = document.getElementById('listaBachilleratos');
  try {
    const lista = await Api.bachilleratos();
    cont.innerHTML = lista.length
      ? lista.map(b => `
          <div class="contenido-item">
            <span>${escapeHtml(b.nombre)}</span>
            <button type="button" class="btn-eliminar" data-id="${b.id}" title="Quitar">✕</button>
          </div>
        `).join('')
      : '<p class="subtitulo">Todavía no hay programas cargados.</p>';

    cont.querySelectorAll('.btn-eliminar').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('¿Quitar este programa del catálogo? Las planificaciones que ya lo usaron no se ven afectadas.')) return;
        try {
          await Api.eliminarBachillerato(btn.dataset.id);
          await pintarListaBachilleratos();
          await cargarBachilleratos(); // refresca el <select> del paso 1
        } catch (e) { alert(e.message); }
      });
    });
  } catch (e) {
    cont.innerHTML = `<p class="subtitulo">Error al cargar: ${escapeHtml(e.message)}</p>`;
  }
}

async function agregarBachilleratoNuevo() {
  const input = document.getElementById('txtNuevoBachillerato');
  const nombre = input.value.trim();
  if (!nombre) return alert('Escribe el nombre del programa/ciclo.');

  try {
    await Api.agregarBachillerato(nombre);
    input.value = '';
    await pintarListaBachilleratos();
    await cargarBachilleratos(); // refresca el <select> del paso 1
  } catch (e) {
    alert(e.message);
  }
}

// ---------- Logos institucionales ----------
async function abrirModalLogos() {
  document.getElementById('modalLogos').classList.remove('is-hidden');
  try {
    const logos = await Api.listarLogos();
    pintarPreviewLogo('logoPreviewCentro', logos.centro);
    pintarPreviewLogo('logoPreviewMinerd', logos.minerd);
    pintarPreviewLogo('logoPreviewDetp', logos.detp);
  } catch (e) { /* silencioso */ }
}

function pintarPreviewLogo(elId, url) {
  const el = document.getElementById(elId);
  el.innerHTML = url ? `<img src="${url}?t=${Date.now()}" alt="logo">` : 'Sin logo';
}

function subirLogoDesdeInput(e, tipo) {
  const file = e.target.files[0];
  if (!file) return;

  const mapaPreview = { centro: 'logoPreviewCentro', minerd: 'logoPreviewMinerd', detp: 'logoPreviewDetp' };
  const previewEl = document.getElementById(mapaPreview[tipo]);
  previewEl.textContent = 'Subiendo…';

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const res = await Api.subirLogo(tipo, reader.result);
      pintarPreviewLogo(mapaPreview[tipo], res.url);
    } catch (err) {
      previewEl.textContent = 'Error al subir';
      alert('No se pudo subir el logo: ' + err.message);
    }
  };
  reader.readAsDataURL(file);
}

// ---------- Gestor de contenidos ----------
let cgModulos = [];
let cgRAs = [];

async function abrirGestorContenidos() {
  const modal = document.getElementById('modalContenidos');
  modal.classList.remove('is-hidden');

  const sel = document.getElementById('cgSelModulo');
  sel.innerHTML = '<option value="">Cargando…</option>';

  try {
    cgModulos = await Api.todosLosModulos();
    sel.innerHTML = '<option value="">Selecciona un módulo…</option>' +
      cgModulos.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('');
  } catch (e) {
    sel.innerHTML = '<option value="">Error al cargar módulos</option>';
  }

  document.getElementById('cgListaContenidos').innerHTML =
    '<p class="hint">Selecciona un módulo para ver su banco de contenidos.</p>';
}

async function onCambioModuloGestor(e) {
  const moduloId = e.target.value;
  const selRA = document.getElementById('cgSelRA');
  selRA.innerHTML = '<option value="">Toda la asignatura</option>';

  if (!moduloId) {
    document.getElementById('cgListaContenidos').innerHTML =
      '<p class="hint">Selecciona un módulo para ver su banco de contenidos.</p>';
    return;
  }

  try {
    cgRAs = await Api.resultadosAprendizaje(moduloId);
    cgRAs.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = r.codigo;
      selRA.appendChild(opt);
    });
  } catch (e) { /* silencioso */ }

  await cargarListaContenidos(moduloId);
}

async function cargarListaContenidos(moduloId) {
  const cont = document.getElementById('cgListaContenidos');
  cont.innerHTML = '<p class="hint">Cargando…</p>';

  try {
    const items = await Api.listarContenidos(moduloId);
    if (items.length === 0) {
      cont.innerHTML = '<p class="hint">Este módulo todavía no tiene contenidos cargados.</p>';
      return;
    }

    const grupos = { conceptual: [], procedimental: [], actitudinal: [] };
    items.forEach(it => grupos[it.tipo].push(it));

    const etiquetas = { conceptual: 'Conceptuales', procedimental: 'Procedimentales', actitudinal: 'Actitudinales' };

    cont.innerHTML = Object.keys(etiquetas).map(tipo => {
      if (grupos[tipo].length === 0) return '';
      const filas = grupos[tipo].map(it => `
        <div class="contenido-item" data-id="${it.id}">
          <span>${it.ra_codigo ? `<span class="ra-tag">${it.ra_codigo}</span>` : ''}${escapeHtml(it.descripcion)}</span>
          <button class="btn-eliminar" title="Eliminar" data-id="${it.id}">✕</button>
        </div>
      `).join('');
      return `<div class="contenido-grupo"><h4>${etiquetas[tipo]}</h4>${filas}</div>`;
    }).join('');

    cont.querySelectorAll('.btn-eliminar').forEach(btn => {
      btn.addEventListener('click', () => eliminarContenido(btn.dataset.id, moduloId));
    });
  } catch (e) {
    cont.innerHTML = '<p class="hint">Error al cargar contenidos: ' + e.message + '</p>';
  }
}

async function agregarContenido() {
  const moduloId = document.getElementById('cgSelModulo').value;
  const raId = document.getElementById('cgSelRA').value;
  const tipo = document.getElementById('cgSelTipo').value;
  const descripcion = document.getElementById('cgTxtDescripcion').value.trim();

  if (!moduloId) return alert('Selecciona un módulo primero.');
  if (descripcion.length < 3) return alert('Escribe la descripción del contenido.');

  const btn = document.getElementById('btnAgregarContenido');
  btn.disabled = true;

  try {
    await Api.guardarContenido({
      asignatura_id: moduloId,
      unidad_id: raId || null,
      tipo,
      descripcion,
    });
    document.getElementById('cgTxtDescripcion').value = '';
    await cargarListaContenidos(moduloId);
  } catch (e) {
    alert('No se pudo agregar: ' + e.message);
  } finally {
    btn.disabled = false;
  }
}

async function eliminarContenido(id, moduloId) {
  if (!confirm('¿Eliminar este contenido del banco?')) return;
  try {
    await Api.eliminarContenido(id);
    await cargarListaContenidos(moduloId);
  } catch (e) {
    alert('No se pudo eliminar: ' + e.message);
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Paso 3: generación IA ----------
async function generarConIA() {
  document.getElementById('loadingBlock').classList.remove('is-hidden');
  document.getElementById('errorBlock').classList.add('is-hidden');

  try {
    const data = await Api.generarIA({
      modulo_id: state.modulo.id,
      ra_id: state.ra.id,
      tipo: state.tipo,
      tiempo_estimado_min: state.tiempo,
      enunciado_actividad: state.enunciado,
    });

    state.generado = data;
    rellenarPaso4(data.generado);
    goToStep(4);
  } catch (e) {
    document.getElementById('loadingBlock').classList.add('is-hidden');
    document.getElementById('errorBlock').classList.remove('is-hidden');
    document.getElementById('errorMsg').textContent = 'No se pudo generar la planificación: ' + e.message;
  }
}

function rellenarPaso4(g) {
  document.getElementById('edEstrategia').value = g.estrategia || '';
  document.getElementById('edIntencion').value = g.intencion_educativa || '';
  document.getElementById('edInicio').value = g.momento_inicio || '';
  document.getElementById('edDesarrollo').value = g.momento_desarrollo || '';
  document.getElementById('edCierre').value = g.momento_cierre || '';
  document.getElementById('edDiversidad').value = g.atencion_diversidad || '';
  document.getElementById('edRecursos').value = g.recursos || '';
  document.getElementById('edConceptuales').value = g.contenidos_conceptuales || '';
  document.getElementById('edProcedimentales').value = g.contenidos_procedimentales || '';
  document.getElementById('edActitudinales').value = g.contenidos_actitudinales || '';
}

// ---------- Paso 5: guardar ----------
async function guardarPlanificacion() {
  const btn = document.getElementById('btnGuardar');
  btn.disabled = true;
  btn.textContent = 'Guardando…';

  const selInstrumento = document.getElementById('selInstrumento');
  const esOtro = selInstrumento.value === 'otro';

  const payload = {
    docente_id: state.docente.id,
    institucion_id: state.docente.institucion_id,
    modulo_id: state.modulo.id,
    ra_id: state.ra.id,
    bachillerato: state.bachillerato,
    tipo: state.tipo,
    tiempo_estimado_min: state.tiempo,
    fecha_realizacion: state.fecha,
    valor: state.valor,
    enunciado_actividad: state.enunciado,
    codigo_actividad: state.codigoActividad || null,
    instrumento_evaluacion_id: esOtro ? null : (selInstrumento.value || null),
    instrumento_evaluacion_otro: esOtro ? document.getElementById('txtInstrumentoOtro').value.trim() : null,
    estrategia: document.getElementById('edEstrategia').value,
    intencion_educativa: document.getElementById('edIntencion').value,
    momento_inicio: document.getElementById('edInicio').value,
    momento_desarrollo: document.getElementById('edDesarrollo').value,
    momento_cierre: document.getElementById('edCierre').value,
    atencion_diversidad: document.getElementById('edDiversidad').value,
    recursos: document.getElementById('edRecursos').value,
    contenidos_conceptuales: document.getElementById('edConceptuales').value,
    contenidos_procedimentales: document.getElementById('edProcedimentales').value,
    contenidos_actitudinales: document.getElementById('edActitudinales').value,
    ia_generado: 1,
    ia_respuesta_cruda: state.generado ? state.generado.generado : null,
    ia_modelo: state.generado ? state.generado.modelo : null,
    estado: 'finalizada',
  };

  try {
    const res = await Api.guardarPlanificacion(payload);
    state.planificacionId = res.id;

    document.getElementById('saveBlock').classList.add('is-hidden');
    document.getElementById('exportBlock').classList.remove('is-hidden');
    document.getElementById('linkDocx').href = '#';
    document.getElementById('linkPdf').href = '#';
    document.getElementById('linkVer').href = '#';
    cablearEnlaceFirmado('linkDocx', res.id, 'urlDocx');
    cablearEnlaceFirmado('linkPdf', res.id, 'urlPdf');
    cablearEnlaceFirmado('linkVer', res.id, 'urlVer');
  } catch (e) {
    alert('No se pudo guardar: ' + e.message);
    btn.disabled = false;
    btn.textContent = 'Guardar planificación';
  }
}

// ---------- Historial ----------
async function abrirHistorial() {
  const modal = document.getElementById('modalHistorial');
  const body = document.getElementById('historialBody');
  modal.classList.remove('is-hidden');
  body.innerHTML = '<p class="hint">Cargando…</p>';

  try {
    const docenteId = state.docente ? state.docente.id : '';
    const lista = await Api.listarPlanificaciones(docenteId);
    if (lista.length === 0) {
      body.innerHTML = '<p class="hint">Aún no hay planificaciones guardadas.</p>';
      return;
    }
    body.innerHTML = lista.map(p => `
      <div class="hist-item">
        <strong>${p.enunciado_actividad}</strong>
        <small>${p.modulo_nombre} · ${p.ra_codigo} · ${p.fecha_realizacion} · ${p.docente_nombre}</small>
        <div style="margin-top:6px;">
          <a class="btn secundario chico" href="#" data-id="${p.id}" data-metodo="urlVer" target="_blank">Ver</a>
          <a class="btn secundario chico" href="#" data-id="${p.id}" data-metodo="urlDocx" target="_blank">Word</a>
          <a class="btn secundario chico" href="#" data-id="${p.id}" data-metodo="urlPdf" target="_blank">PDF</a>
        </div>
      </div>
    `).join('');
    body.querySelectorAll('a[data-metodo]').forEach(a => {
      a.onclick = abrirEnlacePlanificacion(a.dataset.id, a.dataset.metodo);
    });
  } catch (e) {
    body.innerHTML = '<p class="hint">Error al cargar el historial: ' + e.message + '</p>';
  }
}

document.addEventListener('DOMContentLoaded', init);
