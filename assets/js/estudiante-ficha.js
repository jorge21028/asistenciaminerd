const NOMBRE_PARENTESCO = { padre: 'Padre', madre: 'Madre', tutor_legal: 'Tutor legal', otro: 'Otro' };

let estudianteId;
let estudianteActual;
let tutores = [];

function parametroId() {
    return new URLSearchParams(window.location.search).get('id');
}

async function inicializar() {
    estudianteId = parametroId();
    if (!estudianteId) {
        mostrarAlerta('alertaFicha', 'No se indicó qué estudiante mostrar.');
        return;
    }

    try {
        estudianteActual = await apiFetch(`estudiantes.php?id=${estudianteId}`);
        pintarDatosGenerales();
    } catch (err) {
        mostrarAlerta('alertaFicha', err.message);
        return;
    }

    cargarTutores();
    cargarSalud();
    cargarMinerd();
}

function pintarDatosGenerales() {
    const e = estudianteActual;
    document.getElementById('tituloEstudiante').textContent = `${e.nombre} ${e.apellido}`;
    document.getElementById('datosGenerales').innerHTML = `
        <div><strong>Matrícula</strong><p>${escaparHtml(e.matricula || '—')}</p></div>
        <div><strong>Sexo</strong><p>${e.sexo === 'F' ? 'Hembra' : 'Varón'}</p></div>
        <div><strong>Fecha de nacimiento</strong><p>${escaparHtml(e.fecha_nacimiento || '—')}</p></div>
    `;
}

// ---------------------------------------------------------------------
// Padres / Tutores
// ---------------------------------------------------------------------
async function cargarTutores() {
    try {
        tutores = await apiFetch(`estudiante_tutores.php?estudiante_id=${estudianteId}`);
        pintarTutores();
    } catch (err) {
        mostrarAlerta('alertaTutor', err.message);
    }
}

function pintarTutores() {
    const tbody = document.getElementById('tablaTutores');
    document.getElementById('estadoVacioTutores').style.display = tutores.length ? 'none' : 'block';
    tbody.innerHTML = tutores.map(t => `
        <tr>
            <td>${NOMBRE_PARENTESCO[t.parentesco] || t.parentesco}</td>
            <td class="nombre-estudiante">${escaparHtml(t.nombre)} ${escaparHtml(t.apellido)}</td>
            <td>${escaparHtml(t.telefono || '—')}</td>
            <td>${escaparHtml(t.correo || '—')}</td>
            <td class="num">${t.es_contacto_principal == 1 ? '✅' : ''}</td>
            <td class="acciones-tabla">
                <button class="btn secundario chico" onclick="editarTutor(${t.id})">Editar</button>
                <button class="btn peligro chico" onclick="eliminarTutor(${t.id})">Eliminar</button>
            </td>
        </tr>
    `).join('');
}

function editarTutor(id) {
    const t = tutores.find(x => x.id === id);
    if (!t) return;
    document.getElementById('tutorId').value = t.id;
    document.getElementById('parentesco').value = t.parentesco;
    document.getElementById('nombreTutor').value = t.nombre;
    document.getElementById('apellidoTutor').value = t.apellido;
    document.getElementById('cedulaTutor').value = t.cedula || '';
    document.getElementById('telefonoTutor').value = t.telefono || '';
    document.getElementById('telefonoAltTutor').value = t.telefono_alternativo || '';
    document.getElementById('correoTutor').value = t.correo || '';
    document.getElementById('direccionTutor').value = t.direccion || '';
    document.getElementById('ocupacionTutor').value = t.ocupacion || '';
    document.getElementById('lugarTrabajoTutor').value = t.lugar_trabajo || '';
    document.getElementById('telefonoLaboralTutor').value = t.telefono_laboral || '';
    document.getElementById('observacionesTutor').value = t.observaciones || '';
    document.getElementById('contactoPrincipal').checked = t.es_contacto_principal == 1;
    document.getElementById('btnCancelarTutor').style.display = 'inline-flex';
    window.scrollTo({ top: document.getElementById('formTutor').offsetTop - 20, behavior: 'smooth' });
}

function cancelarEdicionTutor() {
    document.getElementById('formTutor').reset();
    document.getElementById('tutorId').value = '';
    document.getElementById('btnCancelarTutor').style.display = 'none';
}

async function eliminarTutor(id) {
    if (!confirm('¿Eliminar este responsable?')) return;
    try {
        await apiFetch(`estudiante_tutores.php?id=${id}`, { method: 'DELETE' });
        cargarTutores();
    } catch (err) {
        mostrarAlerta('alertaTutor', err.message);
    }
}

document.getElementById('formTutor').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('tutorId').value;
    const body = {
        estudiante_id: estudianteId,
        parentesco: document.getElementById('parentesco').value,
        nombre: document.getElementById('nombreTutor').value.trim(),
        apellido: document.getElementById('apellidoTutor').value.trim(),
        cedula: document.getElementById('cedulaTutor').value.trim(),
        telefono: document.getElementById('telefonoTutor').value.trim(),
        telefono_alternativo: document.getElementById('telefonoAltTutor').value.trim(),
        correo: document.getElementById('correoTutor').value.trim(),
        direccion: document.getElementById('direccionTutor').value.trim(),
        ocupacion: document.getElementById('ocupacionTutor').value.trim(),
        lugar_trabajo: document.getElementById('lugarTrabajoTutor').value.trim(),
        telefono_laboral: document.getElementById('telefonoLaboralTutor').value.trim(),
        observaciones: document.getElementById('observacionesTutor').value.trim(),
        es_contacto_principal: document.getElementById('contactoPrincipal').checked,
    };
    try {
        if (id) {
            await apiFetch('estudiante_tutores.php', { method: 'PUT', body: { id, ...body } });
        } else {
            await apiFetch('estudiante_tutores.php', { method: 'POST', body });
        }
        cancelarEdicionTutor();
        cargarTutores();
    } catch (err) {
        mostrarAlerta('alertaTutor', err.message);
    }
});
document.getElementById('btnCancelarTutor').addEventListener('click', cancelarEdicionTutor);

// ---------------------------------------------------------------------
// Salud (puede fallar con 403 si no hay autorización — se oculta la tarjeta)
// ---------------------------------------------------------------------
async function cargarSalud() {
    try {
        const salud = await apiFetch(`estudiante_salud.php?estudiante_id=${estudianteId}`);
        document.getElementById('cardSalud').style.display = 'block';
        if (salud) {
            document.getElementById('enfermedades').value = salud.enfermedades || '';
            document.getElementById('alergias').value = salud.alergias || '';
            document.getElementById('medicamentos').value = salud.medicamentos || '';
            document.getElementById('condiciones').value = salud.condiciones || '';
            document.getElementById('observacionesSalud').value = salud.observaciones || '';
        }
    } catch (err) {
        // Sin autorización (u otro error): la tarjeta simplemente no se muestra
    }
}

document.getElementById('btnGuardarSalud').addEventListener('click', async () => {
    try {
        await apiFetch('estudiante_salud.php', {
            method: 'POST',
            body: {
                estudiante_id: estudianteId,
                enfermedades: document.getElementById('enfermedades').value.trim(),
                alergias: document.getElementById('alergias').value.trim(),
                medicamentos: document.getElementById('medicamentos').value.trim(),
                condiciones: document.getElementById('condiciones').value.trim(),
                observaciones: document.getElementById('observacionesSalud').value.trim(),
            },
        });
        mostrarAlerta('alertaSalud', 'Información de salud guardada.', 'exito');
    } catch (err) {
        mostrarAlerta('alertaSalud', err.message);
    }
});

// ---------------------------------------------------------------------
// Datos MINERD (mismo manejo de acceso restringido que salud)
// ---------------------------------------------------------------------
async function cargarMinerd() {
    try {
        const datos = await apiFetch(`estudiante_minerd.php?estudiante_id=${estudianteId}`);
        document.getElementById('cardMinerd').style.display = 'block';
        if (datos) {
            document.getElementById('rne').value = datos.rne || '';
            document.getElementById('nui').value = datos.nui || '';
            document.getElementById('codigoCentro').value = datos.codigo_centro || '';
            document.getElementById('distritoEducativo').value = datos.distrito_educativo || '';
            document.getElementById('regionalEducativo').value = datos.regional_educativo || '';
            document.getElementById('nivel').value = datos.nivel || 'Secundario';
            document.getElementById('modalidad').value = datos.modalidad || '';
            document.getElementById('subsistema').value = datos.subsistema || '';
            document.getElementById('tanda').value = datos.tanda || '';
            document.getElementById('anioIngreso').value = datos.anio_ingreso_sistema || '';
            document.getElementById('centroProcedencia').value = datos.centro_procedencia || '';
            document.getElementById('observacionesMinerd').value = datos.observaciones || '';
        }
    } catch (err) {
        // Sin autorización: la tarjeta no se muestra
    }
}

document.getElementById('btnGuardarMinerd').addEventListener('click', async () => {
    try {
        await apiFetch('estudiante_minerd.php', {
            method: 'POST',
            body: {
                estudiante_id: estudianteId,
                rne: document.getElementById('rne').value.trim(),
                nui: document.getElementById('nui').value.trim(),
                codigo_centro: document.getElementById('codigoCentro').value.trim(),
                distrito_educativo: document.getElementById('distritoEducativo').value.trim(),
                regional_educativo: document.getElementById('regionalEducativo').value.trim(),
                nivel: document.getElementById('nivel').value.trim(),
                modalidad: document.getElementById('modalidad').value,
                subsistema: document.getElementById('subsistema').value.trim(),
                tanda: document.getElementById('tanda').value,
                anio_ingreso_sistema: document.getElementById('anioIngreso').value,
                centro_procedencia: document.getElementById('centroProcedencia').value.trim(),
                observaciones: document.getElementById('observacionesMinerd').value.trim(),
            },
        });
        mostrarAlerta('alertaMinerd', 'Datos MINERD guardados.', 'exito');
    } catch (err) {
        mostrarAlerta('alertaMinerd', err.message);
    }
});

window.editarTutor = editarTutor;
window.eliminarTutor = eliminarTutor;

inicializar();
