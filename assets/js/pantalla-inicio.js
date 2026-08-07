// ---------------------------------------------------------------------
// Pantalla de Inicio de Clase (Dinámica de Clase)
// Compartido entre pantalla-inicio.html (control) y
// pantalla-inicio-proyeccion.html (proyección), sincronizadas vía
// BroadcastChannel.
// ---------------------------------------------------------------------

const canalInicio = new BroadcastChannel('dinamica_pantalla_inicio_sync');
const esProyeccionInicio = !document.getElementById('btnAbrirVentana');
const QR_URL_DEFECTO = 'https://jorge21028.github.io/portafolio/perfil-docente.html';
const VIDEO_ID_MUSICA = '17fQ_XxoBLs';

let estadoInicio = null; // {nombreCentro, logoUrl, nombreProfesor, asignatura, horaInicio, qrUrl}
let ytPlayerInicio = null;

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------
function formatoTiempoInicio(ms) {
    const totalSeg = Math.max(0, Math.round(ms / 1000));
    const h = Math.floor(totalSeg / 3600);
    const m = Math.floor((totalSeg % 3600) / 60);
    const s = totalSeg % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function calcularObjetivoHoy(horaInicioStr) {
    if (!horaInicioStr) return null;
    const [h, m] = horaInicioStr.split(':').map(Number);
    const ahora = new Date();
    return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), h, m, 0, 0);
}

function formatoHora12Inicio(horaInicioStr) {
    if (!horaInicioStr) return '—';
    let [h, m] = horaInicioStr.split(':').map(Number);
    const sufijo = h >= 12 ? 'PM' : 'AM';
    h = h % 12; if (h === 0) h = 12;
    return `${h}:${String(m).padStart(2, '0')} ${sufijo}`;
}

// ---------------------------------------------------------------------
// Pintado (ambas ventanas — cada elemento se actualiza solo si existe)
// ---------------------------------------------------------------------
function pintarContenidoInicio() {
    if (!estadoInicio) return;
    const set = (id, texto) => { const el = document.getElementById(id); if (el) el.textContent = texto; };

    set('bienvenidaCentro', estadoInicio.nombreCentro || 'Centro Educativo');
    set('bienvenidaProfesor', estadoInicio.nombreProfesor || '—');
    set('bienvenidaAsignatura', estadoInicio.asignatura || '—');
    set('bienvenidaHora', formatoHora12Inicio(estadoInicio.horaInicio));

    const logo = document.getElementById('bienvenidaLogo');
    if (logo) {
        if (estadoInicio.logoUrl) { logo.src = estadoInicio.logoUrl; logo.style.display = 'block'; }
        else { logo.style.display = 'none'; }
    }

    const qrCont = document.getElementById('bienvenidaQrCont');
    const qrImg = document.getElementById('bienvenidaQrImg');
    if (qrCont && qrImg) {
        const url = estadoInicio.qrUrl || QR_URL_DEFECTO;
        if (url) {
            qrImg.src = 'https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=' + encodeURIComponent(url);
            qrCont.style.display = 'block';
        } else {
            qrCont.style.display = 'none';
        }
    }
}

function actualizarCuentaInicio() {
    const el = document.getElementById('bienvenidaCuenta');
    if (!el) return;

    if (!estadoInicio || !estadoInicio.horaInicio) {
        el.textContent = '--:--';
        return;
    }

    const objetivo = calcularObjetivoHoy(estadoInicio.horaInicio);
    const restanteMs = objetivo - Date.now();

    if (restanteMs <= 0) {
        el.textContent = '¡Es hora de comenzar!';
        el.classList.add('bienvenida-lista');
        const etiqueta = document.getElementById('bienvenidaEtiquetaCuenta');
        if (etiqueta) etiqueta.textContent = '¡Bienvenidos!';
    } else {
        el.textContent = formatoTiempoInicio(restanteMs);
        el.classList.remove('bienvenida-lista');
        const etiqueta = document.getElementById('bienvenidaEtiquetaCuenta');
        if (etiqueta) etiqueta.textContent = 'La clase inicia en';
    }
}
setInterval(actualizarCuentaInicio, 250);

// ---------------------------------------------------------------------
// Sincronización
// ---------------------------------------------------------------------
function difundirInicio() {
    canalInicio.postMessage({ tipo: 'sync', estado: estadoInicio });
}

canalInicio.onmessage = (evento) => {
    const d = evento.data;
    if (d.tipo === 'solicitar_sync' && !esProyeccionInicio && estadoInicio) {
        difundirInicio();
        return;
    }
    if (d.tipo === 'sync' && esProyeccionInicio) {
        estadoInicio = d.estado;
        pintarContenidoInicio();
        actualizarCuentaInicio();
    }
};

// =======================================================================
// VENTANA DE CONTROL
// =======================================================================
if (!esProyeccionInicio) {

    async function cargarTodo() {
        try {
            const config = await apiFetch('config_institucional.php');
            document.getElementById('nombreCentro').value = config.nombre_centro || '';
            if (config.logo_url) {
                document.getElementById('previewLogo').src = config.logo_url;
                document.getElementById('previewLogo').style.display = 'inline-block';
            }

            const guardado = await apiFetch('dinamica_pantalla_inicio.php');
            const usuario = Auth.getUsuario();
            document.getElementById('nombreProfesor').value = (guardado && guardado.nombre_profesor) || usuario.nombre;
            document.getElementById('asignatura').value = (guardado && guardado.asignatura) || '';
            document.getElementById('horaInicio').value = (guardado && guardado.hora_inicio) ? guardado.hora_inicio.slice(0, 5) : '';
            document.getElementById('qrUrl').value = (guardado && guardado.qr_url) || QR_URL_DEFECTO;

            estadoInicio = {
                nombreCentro: config.nombre_centro || '',
                logoUrl: config.logo_url || null,
                nombreProfesor: document.getElementById('nombreProfesor').value,
                asignatura: document.getElementById('asignatura').value,
                horaInicio: document.getElementById('horaInicio').value,
                qrUrl: document.getElementById('qrUrl').value,
            };
        } catch (err) {
            mostrarAlerta('alertaPantallaInicio', err.message);
        }
    }

    function leerEstadoFormulario() {
        estadoInicio = {
            nombreCentro: document.getElementById('nombreCentro').value.trim(),
            logoUrl: estadoInicio ? estadoInicio.logoUrl : null,
            nombreProfesor: document.getElementById('nombreProfesor').value.trim(),
            asignatura: document.getElementById('asignatura').value.trim(),
            horaInicio: document.getElementById('horaInicio').value,
            qrUrl: document.getElementById('qrUrl').value.trim(),
        };
    }

    async function guardarCentro() {
        try {
            await apiFetch('config_institucional.php', { method: 'PUT', body: { nombre_centro: document.getElementById('nombreCentro').value.trim() } });
            mostrarAlerta('alertaPantallaInicio', 'Nombre del centro guardado.', 'exito');
            leerEstadoFormulario();
            difundirInicio();
        } catch (err) {
            mostrarAlerta('alertaPantallaInicio', err.message);
        }
    }

    async function subirLogo() {
        const input = document.getElementById('logoInput');
        if (!input.files || !input.files[0]) {
            mostrarAlerta('alertaPantallaInicio', 'Elige primero un archivo de imagen.');
            return;
        }
        const formData = new FormData();
        formData.append('logo', input.files[0]);

        const btn = document.getElementById('btnSubirLogo');
        btn.disabled = true;
        btn.textContent = 'Subiendo…';

        try {
            const respuesta = await fetch(`${window.API_URL}/config_institucional.php`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${Auth.getToken()}` },
                body: formData,
            });
            const json = await respuesta.json();
            if (!json.success) throw new Error(json.message || 'No se pudo subir el logo.');

            document.getElementById('previewLogo').src = json.data.logo_url;
            document.getElementById('previewLogo').style.display = 'inline-block';
            mostrarAlerta('alertaPantallaInicio', 'Logo actualizado.', 'exito');

            leerEstadoFormulario();
            estadoInicio.logoUrl = json.data.logo_url;
            difundirInicio();
        } catch (err) {
            mostrarAlerta('alertaPantallaInicio', err.message);
        }

        btn.disabled = false;
        btn.textContent = 'Subir logo';
    }

    async function abrirVentana() {
        leerEstadoFormulario();

        try {
            await apiFetch('dinamica_pantalla_inicio.php', {
                method: 'POST',
                body: {
                    nombre_profesor: estadoInicio.nombreProfesor,
                    asignatura: estadoInicio.asignatura,
                    hora_inicio: estadoInicio.horaInicio,
                    qr_url: estadoInicio.qrUrl,
                },
            });
        } catch (err) {
            mostrarAlerta('alertaPantallaInicio', err.message);
            return;
        }

        difundirInicio();
        window.open(rutaBase('pantalla-inicio-proyeccion.html'), 'pantalla_inicio_proyeccion', 'width=1280,height=800');
    }

    // Cualquier cambio en el formulario re-sincroniza la ventana de proyección si ya está abierta
    ['nombreProfesor', 'asignatura', 'horaInicio', 'qrUrl'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => { leerEstadoFormulario(); difundirInicio(); });
    });

    document.getElementById('btnGuardarCentro').addEventListener('click', guardarCentro);
    document.getElementById('btnSubirLogo').addEventListener('click', subirLogo);
    document.getElementById('btnAbrirVentana').addEventListener('click', abrirVentana);

    cargarTodo();

} else {
    // ===================================================================
    // VENTANA DE PROYECCIÓN
    // ===================================================================
    canalInicio.postMessage({ tipo: 'solicitar_sync' });

    // Música de fondo (YouTube, en bucle). Empieza silenciada para
    // garantizar el autoplay en cualquier navegador; el profesor activa el
    // sonido con un clic (eso sí cuenta como gesto del usuario dentro de
    // esta ventana).
    window.onYouTubeIframeAPIReady = function () {
        ytPlayerInicio = new YT.Player('ytPlayer', {
            height: '90',
            width: '160',
            videoId: VIDEO_ID_MUSICA,
            playerVars: {
                autoplay: 1,
                loop: 1,
                playlist: VIDEO_ID_MUSICA,
                controls: 0,
                disablekb: 1,
                modestbranding: 1,
                rel: 0,
            },
            events: {
                onReady: (e) => { e.target.mute(); e.target.playVideo(); },
            },
        });
    };

    const scriptYT = document.createElement('script');
    scriptYT.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(scriptYT);

    document.getElementById('btnMute').addEventListener('click', function () {
        if (!ytPlayerInicio || typeof ytPlayerInicio.isMuted !== 'function') return;
        if (ytPlayerInicio.isMuted()) {
            ytPlayerInicio.unMute();
            this.textContent = '🔊 Sonido activado';
        } else {
            ytPlayerInicio.mute();
            this.textContent = '🔇 Activar sonido';
        }
    });
}
