/**
 * api-estudiante.js — capa de comunicación con el backend para el
 * Espacio Académico (sesión de ESTUDIANTE).
 *
 * A propósito NO reutiliza el objeto `Auth` ni `apiFetch` de api.js: esos
 * son para la sesión de staff (admin/profesor/orientador/coordinador) y
 * comparten localStorage y lógica de "401 = cerrar sesión". Si un
 * estudiante y un profesor comparten el mismo navegador (aula/laboratorio),
 * mezclar las dos sesiones podría cerrar la sesión equivocada. Por eso
 * usa sus propias llaves de localStorage y su propio manejo de 401.
 *
 * Requiere que api.js ya se haya cargado antes (usa rutaBase() de ahí).
 */

const AuthEA = {
    getToken() { return localStorage.getItem('ea_token'); },
    getEstudiante() {
        const raw = localStorage.getItem('ea_estudiante');
        return raw ? JSON.parse(raw) : null;
    },
    guardarSesion(token, estudiante) {
        localStorage.setItem('ea_token', token);
        localStorage.setItem('ea_estudiante', JSON.stringify(estudiante));
    },
    cerrarSesion() {
        localStorage.removeItem('ea_token');
        localStorage.removeItem('ea_estudiante');
        window.location.href = rutaBase('login-estudiante.html');
    },
    estaAutenticado() { return !!this.getToken(); },
};

/**
 * Llama a un endpoint de la API con el token de ESTUDIANTE.
 * @param {string} endpoint  ej: 'ea_asignaturas.php' o 'auth_estudiante.php?action=login'
 * @param {object} opciones  { method, body }
 */
async function apiFetchEA(endpoint, opciones = {}) {
    const base = (window.API_URL || '').replace(/\/+$/, '');
    const url = `${base}/${endpoint}`;
    const headers = { 'Content-Type': 'application/json' };
    const token = AuthEA.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let respuesta;
    try {
        respuesta = await fetch(url, {
            method: opciones.method || 'GET',
            headers,
            body: opciones.body ? JSON.stringify(opciones.body) : undefined,
        });
    } catch (err) {
        throw new Error('No se pudo conectar con el servidor. Verifica tu conexión o que la API esté disponible.');
    }

    let json;
    try {
        json = await respuesta.json();
    } catch (err) {
        throw new Error('El servidor respondió de forma inesperada.');
    }

    if (respuesta.status === 401) {
        AuthEA.cerrarSesion();
        return;
    }

    if (!json.success) {
        throw new Error(json.message || 'Ocurrió un error.');
    }

    return json.data;
}

/** Protege una página del Espacio Académico: si no hay sesión de estudiante, redirige al login. */
function protegerPaginaEA() {
    if (!AuthEA.estaAutenticado()) {
        window.location.href = rutaBase('login-estudiante.html');
        return false;
    }
    return true;
}
