/**
 * espacio-academico.js — dashboard del estudiante: tarjeta por asignatura.
 */
if (window.__sesionEAValida) {
    document.addEventListener('DOMContentLoaded', cargarAsignaturas);
}

async function cargarAsignaturas() {
    const grid = document.getElementById('gridAsignaturas');
    const vacio = document.getElementById('vacioAsignaturas');

    try {
        const asignaturas = await apiFetchEA('ea_asignaturas.php');

        if (!asignaturas.length) {
            vacio.classList.remove('is-hidden');
            return;
        }

        grid.innerHTML = asignaturas.map(a => `
            <div class="card modulo-card">
                <span class="icon-circulo"><svg class="icon"><use href="#icon-libro"></use></svg></span>
                <h3>${escaparHtml(a.nombre)}</h3>
                <p>${a.total_creaciones} creación(es) · ${a.total_entregadas} de ${a.total_actividades} actividad(es) entregada(s)</p>
                <a class="btn" href="${rutaBase('ea-asignatura.html')}?asignatura_id=${a.id}&nombre=${encodeURIComponent(a.nombre)}">Entrar</a>
            </div>
        `).join('');
    } catch (err) {
        mostrarAlerta('alertaEA', err.message);
    }
}
