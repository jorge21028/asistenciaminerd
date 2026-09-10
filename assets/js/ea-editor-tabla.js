/**
 * ea-editor-tabla.js — editor de "Tabla comparativa" (Fase 2 del Espacio
 * Académico). Contenido guardado en ea_creaciones.contenido como JSON:
 *   { "tipo": "tabla_comparativa", "columnas": ["...", "..."], "filas": [["...","..."], ...] }
 */
const paramsET = new URLSearchParams(window.location.search);
const creacionIdET = paramsET.get('id');

let creacionET = null;
let dataET = { tipo: 'tabla_comparativa', columnas: ['Columna 1', 'Columna 2'], filas: [['', ''], ['', '']] };

const ETIQUETAS_ESTADO_ET = {
    borrador: 'Borrador',
    entregado: 'Entregado',
    devuelto: 'Devuelto para corrección',
};

if (window.__sesionEAValida) {
    if (!creacionIdET) {
        window.location.href = rutaBase('espacio-academico.html');
    } else {
        document.addEventListener('DOMContentLoaded', cargarCreacionET);
    }
}

async function cargarCreacionET() {
    try {
        creacionET = await apiFetchEA(`ea_creaciones.php?id=${creacionIdET}`);
        document.getElementById('tituloTrabajo').textContent = creacionET.titulo;
        document.getElementById('badgeEstado').textContent = ETIQUETAS_ESTADO_ET[creacionET.estado] || creacionET.estado;

        if (creacionET.contenido) {
            try {
                const parseado = JSON.parse(creacionET.contenido);
                if (parseado && parseado.columnas && parseado.filas) dataET = parseado;
            } catch (e) { /* si el contenido guardado no es válido, se usa la plantilla por defecto */ }
        }

        const soloLectura = creacionET.estado === 'entregado';
        if (soloLectura) {
            document.getElementById('avisoSoloLectura').classList.remove('is-hidden');
            ['btnAgregarFila', 'btnQuitarFila', 'btnAgregarColumna', 'btnQuitarColumna', 'btnGuardarTabla']
                .forEach(id => document.getElementById(id).style.display = 'none');
        } else if (creacionET.actividad_id) {
            document.getElementById('btnEntregarTabla').style.display = '';
        }

        renderTablaET(soloLectura);
    } catch (err) {
        mostrarAlerta('alertaEditorTabla', err.message);
    }
}

function renderTablaET(soloLectura) {
    const tabla = document.getElementById('tablaComparativa');
    const editable = !soloLectura;

    const encabezado = `<thead><tr>${dataET.columnas.map((c, i) =>
        `<th contenteditable="${editable}" data-col="${i}">${escaparHtml(c)}</th>`
    ).join('')}</tr></thead>`;

    const cuerpo = `<tbody>${dataET.filas.map((fila, f) =>
        `<tr>${fila.map((celda, c) =>
            `<td contenteditable="${editable}" data-fila="${f}" data-col="${c}">${escaparHtml(celda)}</td>`
        ).join('')}</tr>`
    ).join('')}</tbody>`;

    tabla.innerHTML = encabezado + cuerpo;
}

/** Lee lo que el estudiante haya escrito en el DOM y lo vuelca a dataET, antes de modificar filas/columnas o guardar. */
function leerTablaDelDOMET() {
    const ths = document.querySelectorAll('#tablaComparativa thead th');
    dataET.columnas = Array.from(ths).map(th => th.textContent.trim());

    const filas = document.querySelectorAll('#tablaComparativa tbody tr');
    dataET.filas = Array.from(filas).map(tr =>
        Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim())
    );
}

document.getElementById('btnAgregarFila').addEventListener('click', () => {
    leerTablaDelDOMET();
    dataET.filas.push(dataET.columnas.map(() => ''));
    renderTablaET(false);
});

document.getElementById('btnQuitarFila').addEventListener('click', () => {
    leerTablaDelDOMET();
    if (dataET.filas.length > 1) dataET.filas.pop();
    renderTablaET(false);
});

document.getElementById('btnAgregarColumna').addEventListener('click', () => {
    leerTablaDelDOMET();
    dataET.columnas.push(`Columna ${dataET.columnas.length + 1}`);
    dataET.filas.forEach(fila => fila.push(''));
    renderTablaET(false);
});

document.getElementById('btnQuitarColumna').addEventListener('click', () => {
    leerTablaDelDOMET();
    if (dataET.columnas.length <= 1) return;
    dataET.columnas.pop();
    dataET.filas.forEach(fila => fila.pop());
    renderTablaET(false);
});

async function guardarTablaET(mostrarMensaje = true) {
    leerTablaDelDOMET();
    await apiFetchEA('ea_creaciones.php', {
        method: 'PUT',
        body: {
            id: creacionIdET,
            titulo: creacionET.titulo,
            contenido: JSON.stringify(dataET),
        },
    });
    if (mostrarMensaje) mostrarAlerta('alertaEditorTabla', 'Guardado.', 'exito');
}

document.getElementById('btnGuardarTabla').addEventListener('click', async () => {
    const btn = document.getElementById('btnGuardarTabla');
    btn.disabled = true;
    try {
        await guardarTablaET();
    } catch (err) {
        mostrarAlerta('alertaEditorTabla', err.message);
    } finally {
        btn.disabled = false;
    }
});

document.getElementById('btnEntregarTabla').addEventListener('click', async () => {
    if (!confirm('¿Entregar este trabajo? Ya no podrás editarlo hasta que el profesor lo revise.')) return;
    const btn = document.getElementById('btnEntregarTabla');
    btn.disabled = true;
    try {
        await guardarTablaET(false);
        await apiFetchEA('ea_creaciones.php', { method: 'PUT', body: { id: creacionIdET, accion: 'entregar' } });
        mostrarAlerta('alertaEditorTabla', 'Trabajo entregado correctamente.', 'exito');
        setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
        mostrarAlerta('alertaEditorTabla', err.message);
        btn.disabled = false;
    }
});
