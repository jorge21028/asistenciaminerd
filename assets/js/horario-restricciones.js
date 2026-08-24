const DIAS = [
    { valor: 'lunes', etiqueta: 'Lunes' },
    { valor: 'martes', etiqueta: 'Martes' },
    { valor: 'miercoles', etiqueta: 'Miércoles' },
    { valor: 'jueves', etiqueta: 'Jueves' },
    { valor: 'viernes', etiqueta: 'Viernes' },
];

let profesores = [];
let bloquesClase = [];
let restriccionesActuales = []; // filas crudas del profesor seleccionado
let bloqueosPorCelda = {}; // "dia:bloqueId" => id de la restricción

async function inicializar() {
    try {
        const [usuarios, bloques] = await Promise.all([
            apiFetch('usuarios.php'),
            apiFetch('bloques.php'),
        ]);
        profesores = usuarios.filter(u => u.activo == 1 && u.rol === 'profesor');
        bloquesClase = bloques.filter(b => b.tipo === 'clase').sort((a, b) => a.orden - b.orden);

        document.getElementById('profesor').innerHTML =
            '<option value="">Selecciona un profesor…</option>' +
            profesores.map(p => `<option value="${p.id}">${escaparHtml(p.nombre)}</option>`).join('');
    } catch (err) {
        mostrarAlerta('alertaRestricciones', err.message);
    }
    document.getElementById('profesor').addEventListener('change', cargarProfesor);
    document.getElementById('btnGuardarPreferencias').addEventListener('click', guardarPreferencias);
}

async function cargarProfesor() {
    const profesorId = document.getElementById('profesor').value;
    document.getElementById('areaRestricciones').style.display = profesorId ? 'block' : 'none';
    if (!profesorId) return;

    try {
        restriccionesActuales = await apiFetch(`horario_restricciones.php?profesor_id=${profesorId}`);
        bloqueosPorCelda = {};
        restriccionesActuales
            .filter(r => r.tipo === 'bloqueo')
            .forEach(r => {
                if (r.bloque_id) {
                    bloqueosPorCelda[`${r.dia}:${r.bloque_id}`] = r.id;
                } else {
                    // bloqueo de día completo: se aplica a todos los bloques de ese día
                    bloquesClase.forEach(b => { bloqueosPorCelda[`${r.dia}:${b.id}:dia_completo`] = r.id; });
                }
            });

        const minimizarHuecos = restriccionesActuales.find(r => r.tipo === 'minimizar_huecos');
        const maxBloquesDia = restriccionesActuales.find(r => r.tipo === 'max_bloques_dia');
        document.getElementById('chkMinimizarHuecos').checked = !!minimizarHuecos;
        document.getElementById('maxBloquesDiaProfesor').value = maxBloquesDia ? maxBloquesDia.valor_numerico : '';

        construirGrid(profesorId);
    } catch (err) {
        mostrarAlerta('alertaRestricciones', err.message);
    }
}

function construirGrid(profesorId) {
    const tabla = document.getElementById('tablaDisponibilidad');

    const thead = '<thead><tr><th>Día</th>' + bloquesClase.map(b =>
        `<th class="num">${escaparHtml(b.nombre)}<br><span style="font-weight:400;">${b.hora_inicio.slice(0, 5)}–${b.hora_fin.slice(0, 5)}</span></th>`
    ).join('') + '<th>Día completo</th></tr></thead>';

    const tbody = '<tbody>' + DIAS.map(d => {
        const diaCompletoBloqueado = bloquesClase.length > 0 && bloquesClase.every(b => bloqueosPorCelda[`${d.valor}:${b.id}:dia_completo`]);
        const celdas = bloquesClase.map(b => {
            const claveDiaCompleto = `${d.valor}:${b.id}:dia_completo`;
            const claveIndividual = `${d.valor}:${b.id}`;
            const bloqueado = !!bloqueosPorCelda[claveIndividual] || !!bloqueosPorCelda[claveDiaCompleto];
            const esDiaCompleto = !!bloqueosPorCelda[claveDiaCompleto];
            return `
                <td>
                    <button type="button" class="celda-disponibilidad ${bloqueado ? 'bloqueada' : ''}"
                        ${esDiaCompleto ? 'disabled title="Bloqueado por día completo"' : `onclick="alternarCelda('${profesorId}', '${d.valor}', ${b.id})"`}>
                        ${bloqueado ? '✕' : ''}
                    </button>
                </td>`;
        }).join('');
        return `<tr><td><strong>${d.etiqueta}</strong></td>${celdas}<td><button type="button" class="btn secundario chico" onclick="alternarDiaCompleto('${profesorId}', '${d.valor}')">${diaCompletoBloqueado ? 'Desbloquear día' : 'Bloquear día'}</button></td></tr>`;
    }).join('') + '</tbody>';

    tabla.innerHTML = thead + tbody;
}

async function alternarCelda(profesorId, dia, bloqueId) {
    const clave = `${dia}:${bloqueId}`;
    const idExistente = bloqueosPorCelda[clave];
    try {
        if (idExistente) {
            await apiFetch(`horario_restricciones.php?id=${idExistente}`, { method: 'DELETE' });
        } else {
            await apiFetch('horario_restricciones.php', {
                method: 'POST',
                body: { profesor_id: profesorId, tipo: 'bloqueo', dia, bloque_id: bloqueId },
            });
        }
        await cargarProfesor();
    } catch (err) {
        mostrarAlerta('alertaRestricciones', err.message);
    }
}

async function alternarDiaCompleto(profesorId, dia) {
    const yaBloqueado = bloquesClase.length > 0 && bloquesClase.every(b => bloqueosPorCelda[`${dia}:${b.id}:dia_completo`]);
    try {
        if (yaBloqueado) {
            // Se borra el bloqueo de día completo Y cualquier bloqueo individual de ese día
            const idsABorrar = restriccionesActuales
                .filter(r => r.tipo === 'bloqueo' && r.dia === dia)
                .map(r => r.id);
            for (const id of idsABorrar) {
                await apiFetch(`horario_restricciones.php?id=${id}`, { method: 'DELETE' });
            }
        } else {
            // Primero limpiamos bloqueos individuales de ese día para no duplicar, luego bloqueamos el día completo
            const idsIndividuales = restriccionesActuales
                .filter(r => r.tipo === 'bloqueo' && r.dia === dia && r.bloque_id)
                .map(r => r.id);
            for (const id of idsIndividuales) {
                await apiFetch(`horario_restricciones.php?id=${id}`, { method: 'DELETE' });
            }
            await apiFetch('horario_restricciones.php', {
                method: 'POST',
                body: { profesor_id: profesorId, tipo: 'bloqueo', dia, bloque_id: null },
            });
        }
        await cargarProfesor();
    } catch (err) {
        mostrarAlerta('alertaRestricciones', err.message);
    }
}

async function guardarPreferencias() {
    const profesorId = document.getElementById('profesor').value;
    if (!profesorId) return;
    const minimizarHuecos = document.getElementById('chkMinimizarHuecos').checked;
    const maxBloquesDia = document.getElementById('maxBloquesDiaProfesor').value;

    try {
        const minimizarExistente = restriccionesActuales.find(r => r.tipo === 'minimizar_huecos');
        if (minimizarHuecos && !minimizarExistente) {
            await apiFetch('horario_restricciones.php', { method: 'POST', body: { profesor_id: profesorId, tipo: 'minimizar_huecos' } });
        } else if (!minimizarHuecos && minimizarExistente) {
            await apiFetch(`horario_restricciones.php?id=${minimizarExistente.id}`, { method: 'DELETE' });
        }

        const maxExistente = restriccionesActuales.find(r => r.tipo === 'max_bloques_dia');
        if (maxBloquesDia) {
            await apiFetch('horario_restricciones.php', { method: 'POST', body: { profesor_id: profesorId, tipo: 'max_bloques_dia', valor_numerico: maxBloquesDia } });
        } else if (maxExistente) {
            await apiFetch(`horario_restricciones.php?id=${maxExistente.id}`, { method: 'DELETE' });
        }

        mostrarAlerta('alertaRestricciones', 'Preferencias guardadas.', 'exito');
        await cargarProfesor();
    } catch (err) {
        mostrarAlerta('alertaRestricciones', err.message);
    }
}

inicializar();
