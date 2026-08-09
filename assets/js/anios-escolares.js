let anios = [];

async function cargarAnios() {
    try {
        anios = await apiFetch('anios_escolares.php');
        pintarAnios();
    } catch (err) {
        mostrarAlerta('alertaAnio', err.message);
    }
}

function pintarAnios() {
    document.getElementById('tablaAnios').innerHTML = anios.map(a => `
        <tr>
            <td><strong>${escaparHtml(a.nombre)}</strong>${a.es_activo == 1 ? ' <span class="badge admin">Activo</span>' : ''}</td>
            <td>${a.fecha_inicio || '—'} a ${a.fecha_fin || '—'}</td>
            <td class="num">${a.habilitado == 1 ? '<span class="badge">Habilitado</span>' : '<span class="badge profesor">Inhabilitado</span>'}</td>
            <td class="acciones-tabla">
                ${a.es_activo != 1 ? `<button class="btn chico" onclick="activarAnio(${a.id})">Marcar como activo</button>` : ''}
                <button class="btn secundario chico" onclick="toggleHabilitado(${a.id}, ${a.habilitado == 1 ? 0 : 1})">${a.habilitado == 1 ? 'Inhabilitar' : 'Habilitar'}</button>
                ${a.es_activo != 1 ? `<button class="btn peligro chico" onclick="eliminarAnio(${a.id})">Eliminar</button>` : ''}
            </td>
        </tr>
    `).join('');
}

async function activarAnio(id) {
    if (!confirm('¿Marcar este año escolar como el activo? Todo el sistema empezará a trabajar con él por defecto (cursos, asistencia, calificaciones, etc.).')) return;
    try {
        await apiFetch('anios_escolares.php', { method: 'PUT', body: { id, activar: true } });
        mostrarAlerta('alertaAnio', 'Año escolar activado.', 'exito');
        cargarAnios();
    } catch (err) {
        mostrarAlerta('alertaAnio', err.message);
    }
}

async function toggleHabilitado(id, nuevoValor) {
    const mensaje = nuevoValor === 0
        ? '¿Inhabilitar este año escolar? Ya no se podrán crear ni editar cursos, estudiantes, asistencia, conducta ni calificaciones dentro de él.'
        : '¿Habilitar este año escolar para volver a permitir modificaciones?';
    if (!confirm(mensaje)) return;
    try {
        await apiFetch('anios_escolares.php', { method: 'PUT', body: { id, habilitado: nuevoValor } });
        cargarAnios();
    } catch (err) {
        mostrarAlerta('alertaAnio', err.message);
    }
}

async function eliminarAnio(id) {
    if (!confirm('¿Eliminar este año escolar? Solo es posible si no tiene cursos creados.')) return;
    try {
        await apiFetch(`anios_escolares.php?id=${id}`, { method: 'DELETE' });
        cargarAnios();
    } catch (err) {
        mostrarAlerta('alertaAnio', err.message);
    }
}

document.getElementById('formAnio').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        await apiFetch('anios_escolares.php', {
            method: 'POST',
            body: {
                nombre: document.getElementById('nombre').value.trim(),
                fecha_inicio: document.getElementById('fechaInicio').value,
                fecha_fin: document.getElementById('fechaFin').value,
            },
        });
        document.getElementById('formAnio').reset();
        cargarAnios();
    } catch (err) {
        mostrarAlerta('alertaAnio', err.message);
    }
});

window.activarAnio = activarAnio;
window.toggleHabilitado = toggleHabilitado;
window.eliminarAnio = eliminarAnio;

cargarAnios();
