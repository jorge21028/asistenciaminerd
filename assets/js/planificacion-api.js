// ---------------------------------------------------------------------
// Planificación de Clases — capa de API
// Este módulo vive ahora en asistencia-api/planificacion/, así que
// reutiliza el mismo dominio de API y el mismo token de sesión
// (Authorization: Bearer ...) que el resto del portal — ya no hace
// falta un login aparte.
// ---------------------------------------------------------------------

const PLANIF_API_BASE = window.API_URL + '/planificacion';

const ApiPlanificacion = {
  async _get(path) {
    const res = await fetch(PLANIF_API_BASE + path, {
      headers: { 'Authorization': 'Bearer ' + Auth.getToken() },
    });
    const json = await res.json();
    if (!res.ok || !json.ok) throw new Error(json.error || 'Error de red');
    return json.data;
  },

  async _post(path, body) {
    const res = await fetch(PLANIF_API_BASE + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + Auth.getToken(),
      },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) throw new Error(json.error || 'Error de red');
    return json.data;
  },

  docentes: () => ApiPlanificacion._get('/api/docentes.php'),
  modulosPorDocente: (docenteId) => ApiPlanificacion._get(`/api/modulos.php?docente_id=${docenteId}`),
  resultadosAprendizaje: (moduloId) => ApiPlanificacion._get(`/api/resultados_aprendizaje.php?modulo_id=${moduloId}`),
  instrumentosEvaluacion: () => ApiPlanificacion._get('/api/instrumentos_evaluacion.php'),

  listarContenidos: (asignaturaId) => ApiPlanificacion._get(`/api/contenidos_listar.php?asignatura_id=${asignaturaId}`),
  guardarContenido: (payload) => ApiPlanificacion._post('/api/contenidos_guardar.php', payload),
  eliminarContenido: (id) => ApiPlanificacion._post('/api/contenidos_eliminar.php', { id }),

  listarLogos: () => ApiPlanificacion._get('/api/logos_listar.php'),
  subirLogo: (tipo, imagenBase64) => ApiPlanificacion._post('/api/logos_subir.php', { tipo, imagen_base64: imagenBase64 }),

  generarIA: (payload) => ApiPlanificacion._post('/api/generar_ia.php', payload),
  guardarPlanificacion: (payload) => ApiPlanificacion._post('/api/guardar_planificacion.php', payload),
  listarPlanificaciones: (docenteId) => ApiPlanificacion._get(`/api/listar_planificaciones.php?docente_id=${docenteId || ''}`),

  // Ver/Word/PDF se abren con <a href> (nueva pestaña / descarga), y un
  // navegador no puede mandar el header Authorization al navegar a un
  // link. Por eso primero se pide un enlace firmado de un solo uso
  // (vence en 2 minutos) y RECIÉN con eso se arma la URL final.
  async _urlFirmada(id, endpoint) {
    const firma = await ApiPlanificacion._get(`/api/link_firmado.php?id=${id}`);
    return `${PLANIF_API_BASE}/api/${endpoint}.php?id=${firma.id}&t=${encodeURIComponent(firma.t)}&exp=${firma.exp}`;
  },
  urlDocx: (id) => ApiPlanificacion._urlFirmada(id, 'exportar_docx'),
  urlPdf: (id) => ApiPlanificacion._urlFirmada(id, 'exportar_pdf'),
  urlVer: (id) => ApiPlanificacion._urlFirmada(id, 'ver_planificacion'),
};

// Alias corto: el resto del código (adaptado del módulo original) usa "Api".
const Api = ApiPlanificacion;
