async function inicializar() {
    try {
        const u = await apiFetch('auth.php?action=perfil');
        document.getElementById('datosCuenta').innerHTML =
            `<strong>${escaparHtml(u.nombre)}</strong><br>${escaparHtml(u.email)}<br>Rol: ${u.rol === 'admin' ? 'Administrador' : 'Profesor'}`;
    } catch (err) {
        mostrarAlerta('alertaCuenta', err.message);
    }
}

document.getElementById('formPassword').addEventListener('submit', async (e) => {
    e.preventDefault();

    const actual = document.getElementById('passwordActual').value;
    const nueva = document.getElementById('passwordNueva').value;
    const confirmar = document.getElementById('passwordConfirmar').value;

    if (nueva !== confirmar) {
        mostrarAlerta('alertaCuenta', 'La confirmación no coincide con la contraseña nueva.');
        return;
    }
    if (nueva.length < 8) {
        mostrarAlerta('alertaCuenta', 'La contraseña nueva debe tener al menos 8 caracteres.');
        return;
    }

    const btn = document.getElementById('btnCambiarPassword');
    btn.disabled = true;
    btn.textContent = 'Guardando…';

    try {
        await apiFetch('auth.php?action=cambiar_password', {
            method: 'POST',
            body: { password_actual: actual, password_nueva: nueva },
        });
        mostrarAlerta('alertaCuenta', 'Contraseña actualizada correctamente.', 'exito');
        document.getElementById('formPassword').reset();
    } catch (err) {
        mostrarAlerta('alertaCuenta', err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Cambiar contraseña';
    }
});

inicializar();
