let bloques = [];
const NOMBRE_TIPO = { clase: 'Clase', receso: 'Receso', almuerzo: 'Almuerzo' };

async function cargarBloques() {
    try {
        bloques = await apiFetch('bloques.php');
        pintarBloques();
    } catch (err) {
        mostrarAlerta('alertaBloque', err.message);
    }
}

function pintarBloques() {
    document.getElementById('tablaBloques').innerHTML = bloques.map(b => `
        <tr>
            <td class="num">${b.orden}</td>
            <td><strong>${escaparHtml(b.nombre)}</strong></td>
            <td class="num">${b.hora_inicio.slice(0,5)}</td>
            <td class="num">${b.hora_fin.slice(0,5)}</td>
            <td><span class="badge">${NOMBRE_TIPO[b.tipo]}</span></td>
            <td class="acciones-tabla">
                <button class="btn secundario chico" onclick="editarBloque(${b.id})">Editar</button>
                <button class="btn peligro chico" onclick="eliminarBloque(${b.id})">Eliminar</button>
            </td>
        </tr>
    `).join('');
}

function editarBloque(id) {
    const b = bloques.find(x => x.id === id);
    if (!b) return;
    document.getElementById('bloqueId').value = b.id;
    document.getElementById('orden').value = b.orden;
    document.getElementById('nombre').value = b.nombre;
    document.getElementById('horaInicio').value = b.hora_inicio.slice(0,5);
    document.getElementById('horaFin').value = b.hora_fin.slice(0,5);
    document.getElementById('tipo').value = b.tipo;
    document.getElementById('tituloForm').textContent = 'Editar bloque';
    document.getElementById('btnCancelar').style.display = 'inline-flex';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelarEdicion() {
    document.getElementById('formBloque').reset();
    document.getElementById('bloqueId').value = '';
    document.getElementById('tituloForm').textContent = 'Nuevo bloque';
    document.getElementById('btnCancelar').style.display = 'none';
}

async function eliminarBloque(id) {
    if (!confirm('¿Eliminar este bloque? Las asignaciones de horario que dependían de él también se perderán.')) return;
    try {
        await apiFetch(`bloques.php?id=${id}`, { method: 'DELETE' });
        cargarBloques();
    } catch (err) {
        mostrarAlerta('alertaBloque', err.message);
    }
}

document.getElementById('formBloque').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('bloqueId').value;
    const body = {
        orden: document.getElementById('orden').value,
        nombre: document.getElementById('nombre').value.trim(),
        hora_inicio: document.getElementById('horaInicio').value,
        hora_fin: document.getElementById('horaFin').value,
        tipo: document.getElementById('tipo').value,
    };
    try {
        if (id) {
            await apiFetch('bloques.php', { method: 'PUT', body: { id, ...body } });
        } else {
            await apiFetch('bloques.php', { method: 'POST', body });
        }
        cancelarEdicion();
        cargarBloques();
    } catch (err) {
        mostrarAlerta('alertaBloque', err.message);
    }
});

document.getElementById('btnCancelar').addEventListener('click', cancelarEdicion);

cargarBloques();
