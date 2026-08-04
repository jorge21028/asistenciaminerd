let usuarios = [];

async function cargarUsuarios() {
    try {
        usuarios = await apiFetch('usuarios.php');
        pintarUsuarios();
    } catch (err) {
        mostrarAlerta('alertaUsuario', err.message);
    }
}

function pintarUsuarios() {
    const tbody = document.getElementById('tablaUsuarios');
    tbody.innerHTML = usuarios.map(u => `
        <tr>
            <td><strong>${escaparHtml(u.nombre)}</strong></td>
            <td>${escaparHtml(u.email)}</td>
            <td><span class="badge ${u.rol}">${u.rol === 'admin' ? 'Administrador' : 'Profesor'}</span></td>
            <td>${u.activo == 1 ? 'Activo' : 'Inactivo'}</td>
            <td class="acciones-tabla">
                <button class="btn secundario chico" onclick="editarUsuario(${u.id})">Editar</button>
                <button class="btn peligro chico" onclick="eliminarUsuario(${u.id})">Desactivar</button>
            </td>
        </tr>
    `).join('');
}

function editarUsuario(id) {
    const u = usuarios.find(x => x.id === id);
    if (!u) return;
    document.getElementById('usuarioId').value = u.id;
    document.getElementById('nombre').value = u.nombre;
    document.getElementById('email').value = u.email;
    document.getElementById('rol').value = u.rol;
    document.getElementById('password').value = '';
    document.getElementById('labelPassOpcional').style.display = 'inline';
    document.getElementById('tituloForm').textContent = 'Editar usuario';
    document.getElementById('btnCancelar').style.display = 'inline-flex';
}

function cancelarEdicion() {
    document.getElementById('formUsuario').reset();
    document.getElementById('usuarioId').value = '';
    document.getElementById('labelPassOpcional').style.display = 'none';
    document.getElementById('tituloForm').textContent = 'Nuevo usuario';
    document.getElementById('btnCancelar').style.display = 'none';
}

async function eliminarUsuario(id) {
    if (!confirm('¿Desactivar este usuario? No podrá iniciar sesión, pero se conserva su historial.')) return;
    try {
        await apiFetch(`usuarios.php?id=${id}`, { method: 'DELETE' });
        cargarUsuarios();
    } catch (err) {
        mostrarAlerta('alertaUsuario', err.message);
    }
}

document.getElementById('formUsuario').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('usuarioId').value;
    const password = document.getElementById('password').value;
    const body = {
        nombre: document.getElementById('nombre').value.trim(),
        email: document.getElementById('email').value.trim(),
        rol: document.getElementById('rol').value,
    };
    if (password) body.password = password;

    if (!id && !password) {
        mostrarAlerta('alertaUsuario', 'Debes definir una contraseña para el nuevo usuario.');
        return;
    }

    try {
        if (id) {
            await apiFetch('usuarios.php', { method: 'PUT', body: { id, ...body } });
        } else {
            await apiFetch('usuarios.php', { method: 'POST', body });
        }
        cancelarEdicion();
        cargarUsuarios();
    } catch (err) {
        mostrarAlerta('alertaUsuario', err.message);
    }
});

document.getElementById('btnCancelar').addEventListener('click', cancelarEdicion);

cargarUsuarios();
