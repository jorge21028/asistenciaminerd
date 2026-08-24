const DIAS = [
    { valor: 'lunes', etiqueta: 'Lunes' },
    { valor: 'martes', etiqueta: 'Martes' },
    { valor: 'miercoles', etiqueta: 'Miércoles' },
    { valor: 'jueves', etiqueta: 'Jueves' },
    { valor: 'viernes', etiqueta: 'Viernes' },
];

let profesores = [];
let combosProfesorActual = []; // curso+asignatura válidos para el profesor seleccionado
let bloquesClase = [];
let asignacionesActuales = {}; // "dia:bloqueId" => {id, tipo_asignacion, curso_id, asignatura_id}

async function inicializar() {
    try {
        const [usuarios, bloques] = await Promise.all([
            apiFetch('usuarios.php'),
            apiFetch('bloques.php'),
        ]);
        profesores = usuarios.filter(u => u.activo == 1);
        bloquesClase = bloques.filter(b => b.tipo === 'clase').sort((a, b) => a.orden - b.orden);

        document.getElementById('profesor').innerHTML =
            '<option value="">Selecciona un profesor…</option>' +
            profesores.map(p => `<option value="${p.id}">${escaparHtml(p.nombre)}</option>`).join('');
    } catch (err) {
        mostrarAlerta('alertaHorario', err.message);
    }
}

async function cargarHorarioProfesor() {
    const profesorId = document.getElementById('profesor').value;
    const cardGrid = document.getElementById('cardGrid');
    const estadoVacio = document.getElementById('estadoVacio');

    if (!profesorId) {
        cardGrid.style.display = 'none';
        estadoVacio.style.display = 'none';
        return;
    }

    try {
        const [todasAsignaciones, data] = await Promise.all([
            apiFetch('asignaciones.php'),
            apiFetch(`horario.php?profesor_id=${profesorId}`),
        ]);

        combosProfesorActual = todasAsignaciones.filter(a => a.profesor_id == profesorId);

        if (!combosProfesorActual.length) {
            cardGrid.style.display = 'none';
            estadoVacio.style.display = 'block';
            estadoVacio.textContent = 'Este profesor no tiene asignaturas asignadas todavía. Primero ve a "Asignaciones" y asígnale curso(s) y asignatura(s), luego vuelve aquí para armar su horario.';
            return;
        }

        asignacionesActuales = {};
        data.asignaciones.forEach(a => {
            asignacionesActuales[`${a.dia}:${a.bloque_id}`] = a;
        });

        estadoVacio.style.display = 'none';
        cardGrid.style.display = 'block';
        construirGrid(profesorId);
    } catch (err) {
        mostrarAlerta('alertaHorario', err.message);
    }
}

function construirGrid(profesorId) {
    const tabla = document.getElementById('tablaGrid');

    const opcionesCombo = combosProfesorActual.map(c =>
        `<option value="${c.curso_id}:${c.asignatura_id}">${escaparHtml(c.curso_nombre)} — ${escaparHtml(c.asignatura_nombre)}</option>`
    ).join('');

    let thead = '<thead><tr><th>Día</th>' + bloquesClase.map(b =>
        `<th class="num">${escaparHtml(b.nombre)}<br><span style="font-weight:400;">${b.hora_inicio.slice(0,5)}–${b.hora_fin.slice(0,5)}</span></th>`
    ).join('') + '</tr></thead>';

    let tbody = '<tbody>' + DIAS.map(d => {
        const celdas = bloquesClase.map(b => {
            const clave = `${d.valor}:${b.id}`;
            const actual = asignacionesActuales[clave];
            let valorSel = '';
            let esGenerado = false;
            if (actual) {
                valorSel = actual.tipo_asignacion === 'pedagogica' ? 'pedagogica' : `${actual.curso_id}:${actual.asignatura_id}`;
                esGenerado = actual.origen === 'generado';
            }
            return `
                <td>
                    <select onchange="guardarCelda('${profesorId}', '${d.valor}', ${b.id}, this.value)" style="width:100%; padding:6px; border:1px solid ${esGenerado ? 'var(--color-primary)' : 'var(--color-line)'}; border-radius:6px; background:${actual ? (actual.tipo_asignacion === 'pedagogica' ? 'var(--color-excusa-bg)' : 'var(--color-present-bg)') : '#fff'};" title="${esGenerado ? 'Puesto por el Generador de Horario — si lo cambias aquí pasa a ser manual' : ''}">
                        <option value="">— Sin asignar —</option>
                        <option value="pedagogica" ${valorSel === 'pedagogica' ? 'selected' : ''}>Hora pedagógica</option>
                        ${opcionesCombo.replace(`value="${valorSel}"`, `value="${valorSel}" selected`)}
                    </select>
                    ${esGenerado ? '<span class="badge-origen-generado">auto</span>' : ''}
                </td>`;
        }).join('');
        return `<tr><td><strong>${d.etiqueta}</strong></td>${celdas}</tr>`;
    }).join('') + '</tbody>';

    tabla.innerHTML = thead + tbody;
}

async function guardarCelda(profesorId, dia, bloqueId, valor) {
    try {
        if (!valor) {
            await apiFetch(`horario.php?profesor_id=${profesorId}&dia=${dia}&bloque_id=${bloqueId}`, { method: 'DELETE' });
        } else if (valor === 'pedagogica') {
            await apiFetch('horario.php', {
                method: 'POST',
                body: { profesor_id: profesorId, dia, bloque_id: bloqueId, tipo_asignacion: 'pedagogica' },
            });
        } else {
            const [cursoId, asignaturaId] = valor.split(':');
            await apiFetch('horario.php', {
                method: 'POST',
                body: { profesor_id: profesorId, dia, bloque_id: bloqueId, tipo_asignacion: 'clase', curso_id: cursoId, asignatura_id: asignaturaId },
            });
        }
        mostrarAlerta('alertaHorario', 'Horario actualizado.', 'exito');
        cargarHorarioProfesor();
    } catch (err) {
        mostrarAlerta('alertaHorario', err.message);
    }
}

document.getElementById('profesor').addEventListener('change', cargarHorarioProfesor);

inicializar();
