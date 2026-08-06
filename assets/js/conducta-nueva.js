let nivelElegido = null;
let catalogoFaltas = [];
let catalogoMedidas = [];

async function inicializar() {
    document.getElementById('fecha').value = new Date().toISOString().slice(0, 10);
    document.getElementById('hora').value = new Date().toTimeString().slice(0, 5);

    try {
        const cursos = await apiFetch('cursos.php');
        document.getElementById('curso').innerHTML = cursos.map(c => `<option value="${c.id}">${escaparHtml(c.nombre)}</option>`).join('');
        if (cursos.length) cargarEstudiantes();
    } catch (err) {
        mostrarAlerta('alertaNueva', err.message);
    }
}

async function cargarEstudiantes() {
    const cursoId = document.getElementById('curso').value;
    if (!cursoId) return;
    try {
        const estudiantes = await apiFetch(`estudiantes.php?curso_id=${cursoId}`);
        document.getElementById('estudiante').innerHTML = estudiantes.map(e =>
            `<option value="${e.id}">${escaparHtml(e.apellido)}, ${escaparHtml(e.nombre)}${e.matricula ? ' (' + escaparHtml(e.matricula) + ')' : ''}</option>`
        ).join('');
    } catch (err) {
        mostrarAlerta('alertaNueva', err.message);
    }
}

async function elegirNivel(nivel) {
    nivelElegido = nivel;
    document.querySelectorAll('.nivel-opcion').forEach(el => el.classList.remove('nivel-activo'));
    document.querySelector(`.nivel-opcion[data-nivel="${nivel}"]`).classList.add('nivel-activo');

    document.getElementById('cardEmergencia').style.display = nivel === 'muy_grave' ? 'block' : 'none';
    document.getElementById('cardFalta').style.display = 'block';
    document.getElementById('cardMedidaLeve').style.display = nivel === 'leve' ? 'block' : 'none';
    document.getElementById('cardDerivacion').style.display = nivel !== 'leve' ? 'block' : 'none';
    document.getElementById('cardGuardar').style.display = 'block';

    if (nivel !== 'leve') {
        const destino = nivel === 'muy_grave' ? 'Dirección / Consejo de Disciplina' : 'Gestión de Convivencia / Orientación';
        document.getElementById('textoDerivacion').textContent = `Se derivará automáticamente a: ${destino}. Ellos determinarán la medida educativa/disciplinaria.`;
    }

    try {
        catalogoFaltas = await apiFetch(`conducta_catalogo.php?tipo=faltas&nivel=${nivel}`);
        document.getElementById('faltaCatalogo').innerHTML =
            '<option value="">— Elegir del catálogo —</option>' +
            catalogoFaltas.map(f => `<option value="${f.id}" data-desc="${escaparHtml(f.categoria + ': ' + f.descripcion)}">${escaparHtml(f.categoria)} — ${escaparHtml(f.descripcion)}</option>`).join('');

        if (nivel === 'leve') {
            catalogoMedidas = await apiFetch(`conducta_catalogo.php?tipo=medidas&nivel=leve`);
            document.getElementById('medidaCatalogo').innerHTML =
                '<option value="">— Elegir del catálogo —</option>' +
                catalogoMedidas.map(m => `<option value="${m.id}" data-desc="${escaparHtml(m.descripcion)}">${escaparHtml(m.descripcion)}</option>`).join('');
        }
    } catch (err) {
        mostrarAlerta('alertaNueva', err.message);
    }

    window.scrollTo({ top: document.getElementById('cardFalta').offsetTop - 20, behavior: 'smooth' });
}

document.getElementById('curso').addEventListener('change', cargarEstudiantes);

document.getElementById('faltaCatalogo').addEventListener('change', function () {
    const opt = this.options[this.selectedIndex];
    if (opt.value) document.getElementById('faltaDescripcion').value = opt.dataset.desc;
});

document.getElementById('medidaCatalogo').addEventListener('change', function () {
    const opt = this.options[this.selectedIndex];
    if (opt.value) document.getElementById('medidaAplicada').value = opt.dataset.desc;
});

document.getElementById('btnGuardar').addEventListener('click', async () => {
    const descripcionHechos = document.getElementById('descripcionHechos').value.trim();
    const faltaDescripcion = document.getElementById('faltaDescripcion').value.trim();

    if (!nivelElegido) { mostrarAlerta('alertaNueva', 'Selecciona el nivel de la falta.'); return; }
    if (!faltaDescripcion) { mostrarAlerta('alertaNueva', 'Indica qué falta ocurrió.'); return; }
    if (!descripcionHechos) { mostrarAlerta('alertaNueva', 'Describe los hechos de forma objetiva.'); return; }

    const body = {
        estudiante_id: document.getElementById('estudiante').value,
        curso_id: document.getElementById('curso').value,
        fecha: document.getElementById('fecha').value,
        hora: document.getElementById('hora').value,
        lugar: document.getElementById('lugar').value.trim(),
        nivel: nivelElegido,
        falta_id: document.getElementById('faltaCatalogo').value || null,
        falta_descripcion: faltaDescripcion,
        descripcion_hechos: descripcionHechos,
        testigos: document.getElementById('testigos').value.trim(),
        accion_inmediata: document.getElementById('accionInmediata').value.trim(),
    };

    if (nivelElegido === 'leve') {
        body.medida_id = document.getElementById('medidaCatalogo').value || null;
        body.medida_aplicada = document.getElementById('medidaAplicada').value.trim();
    }

    const btn = document.getElementById('btnGuardar');
    btn.disabled = true;
    btn.textContent = 'Guardando…';

    try {
        const data = await apiFetch('conducta_incidentes.php', { method: 'POST', body });
        if (data.alerta_reincidencia) {
            mostrarAlerta('alertaNueva', data.alerta_reincidencia, 'info');
            setTimeout(() => { window.location.href = rutaBase('conducta.html'); }, 4500);
        } else {
            mostrarAlerta('alertaNueva', 'Falta registrada correctamente.', 'exito');
            setTimeout(() => { window.location.href = rutaBase('conducta.html'); }, 1200);
        }
    } catch (err) {
        mostrarAlerta('alertaNueva', err.message);
        btn.disabled = false;
        btn.textContent = 'Registrar falta';
    }
});

inicializar();
