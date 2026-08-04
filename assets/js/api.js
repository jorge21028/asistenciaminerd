/**
 * api.js — capa de comunicación con el backend PHP (Hostinger).
 * API_URL se inyecta desde _config.yml de Jekyll en cada página (ver <head> del layout).
 */

const Auth = {
    getToken() { return localStorage.getItem('asistencia_token'); },
    getUsuario() {
        const raw = localStorage.getItem('asistencia_usuario');
        return raw ? JSON.parse(raw) : null;
    },
    guardarSesion(token, usuario) {
        localStorage.setItem('asistencia_token', token);
        localStorage.setItem('asistencia_usuario', JSON.stringify(usuario));
    },
    cerrarSesion() {
        localStorage.removeItem('asistencia_token');
        localStorage.removeItem('asistencia_usuario');
        window.location.href = rutaBase('index.html');
    },
    estaAutenticado() { return !!this.getToken(); },
    esAdmin() {
        const u = this.getUsuario();
        return u && u.rol === 'admin';
    },
};

// Resuelve rutas relativas respetando el baseurl configurado en Jekyll (window.SITE_BASEURL)
function rutaBase(pagina) {
    const base = window.SITE_BASEURL || '';
    return base + '/' + pagina;
}

/**
 * Llama a un endpoint de la API.
 * @param {string} endpoint  ej: 'cursos.php' o 'auth.php?action=login'
 * @param {object} opciones  { method, body }
 */
async function apiFetch(endpoint, opciones = {}) {
    const url = `${window.API_URL}/${endpoint}`;
    const headers = { 'Content-Type': 'application/json' };
    const token = Auth.getToken();
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
        Auth.cerrarSesion();
        return;
    }

    if (!json.success) {
        throw new Error(json.message || 'Ocurrió un error.');
    }

    return json.data;
}

/** Protege una página: si no hay sesión, redirige al login. Si requiereAdmin, exige rol admin. */
function protegerPagina({ requiereAdmin = false } = {}) {
    if (!Auth.estaAutenticado()) {
        window.location.href = rutaBase('index.html');
        return false;
    }
    if (requiereAdmin && !Auth.esAdmin()) {
        alert('Esta sección es solo para administradores.');
        window.location.href = rutaBase('dashboard.html');
        return false;
    }
    return true;
}

function mostrarAlerta(contenedorId, mensaje, tipo = 'error') {
    const cont = document.getElementById(contenedorId);
    if (!cont) return;
    cont.innerHTML = `<div class="alerta ${tipo}">${mensaje}</div>`;
    if (tipo !== 'error') {
        setTimeout(() => { cont.innerHTML = ''; }, 3500);
    }
}

function escaparHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
}
