const NIVEL_ETIQUETA2 = { leve: 'Leve', grave: 'Grave', muy_grave: 'Muy grave' };
const NIVEL_CLASE2 = { leve: 'presente', grave: 'tardanza', muy_grave: 'ausente' };
const ESTADO_ETIQUETA2 = { registrado: 'Registrado', en_gestion: 'En gestión', resuelto: 'Resuelto', apelado: 'Apelado' };
const DERIVADO_ETIQUETA = { ninguno: 'Ninguno', gestion_convivencia: 'Gestión de Convivencia', direccion: 'Dirección', consejo_disciplina: 'Consejo de Disciplina' };
const TIPO_ACCION_ETIQUETA = { nota: 'Nota', comunicacion_familia: 'Comunicación con la familia', mediacion: 'Mediación', acuerdo: 'Acuerdo', derivacion: 'Derivación', apelacion: 'Apelación', cierre: 'Cierre' };

let incidenteId = null;
let incidenteActual = null;
let esAdmin = false;

async function cargarDetalle() {
    const params = new URLSearchParams(window.location.search);
    incidenteId = params.get('id');
    esAdmin = Auth.esAdmin();

    if (!incidenteId) {
        mostrarAlerta('alertaDetalle', 'No se indicó qué incidente mostrar.');
        return;
    }

    try {
        incidenteActual = await apiFetch(`conducta_incidentes.php?id=${incidenteId}`);
        pintarDetalle();
    } catch (err) {
        mostrarAlerta('alertaDetalle', err.message);
    }
}

function pintarDetalle() {
    const i = incidenteActual;
    const cont = document.getElementById('contenidoDetalle');

    cont.innerHTML = `
        <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px;">
                <div>
                    <h2 style="margin-bottom:2px;">
                        <a href="${rutaBase('conducta-expediente.html')}?estudiante_id=${i.estudiante_id}">${escaparHtml(i.estudiante_nombre)} ${escaparHtml(i.estudiante_apellido)}</a>
                    </h2>
                    <p class="subtitulo" style="margin:0;">${escaparHtml(i.curso_nombre)} · ${i.fecha}${i.hora ? ' · ' + i.hora.slice(0,5) : ''}${i.lugar ? ' · ' + escaparHtml(i.lugar) : ''}</p>
                </div>
                <div style="text-align:right;">
                    <span class="sello-estado ${NIVEL_CLASE2[i.nivel]}" style="width:auto; height:auto; padding:4px 12px; border-radius:20px; display:inline-block;">${NIVEL_ETIQUETA2[i.nivel]}</span>
                    <br><span class="badge" style="margin-top:6px; display:inline-block;">${ESTADO_ETIQUETA2[i.estado]}</span>
                </div>
            </div>

            <div class="grid-2" style="margin-top:18px;">
                <div>
                    <h3>Falta</h3>
                    <p>${escaparHtml(i.falta_descripcion)}</p>
                    <h3>Descripción de los hechos</h3>
                    <p style="white-space:pre-wrap;">${escaparHtml(i.descripcion_hechos)}</p>
                    ${i.testigos ? `<h3>Testigos</h3><p>${escaparHtml(i.testigos)}</p>` : ''}
                    ${i.accion_inmediata ? `<h3>Acción inmediata del docente</h3><p>${escaparHtml(i.accion_inmediata)}</p>` : ''}
                </div>
                <div>
                    <h3>Gestión del caso</h3>
                    <p><strong>Reportado por:</strong> ${escaparHtml(i.reportado_por_nombre)}</p>
                    <p><strong>Derivado a:</strong> ${DERIVADO_ETIQUETA[i.derivado_a]}</p>
                    <p><strong>Medida aplicada:</strong> ${i.medida_aplicada ? escaparHtml(i.medida_aplicada) : '— Pendiente —'}</p>
                    <p><strong>Familia notificada:</strong> ${i.notificado_familia == 1 ? 'Sí, el ' + (i.fecha_notificacion_familia || '') : 'No'}</p>
                    ${i.observaciones ? `<p><strong>Observaciones:</strong> ${escaparHtml(i.observaciones)}</p>` : ''}
                </div>
            </div>
        </div>

        ${esAdmin ? panelGestionHtml(i) : ''}

        <div class="card">
            <h3>Bitácora del caso</h3>
            <div id="listaSeguimiento">${pintarSeguimiento(i.seguimiento)}</div>

            <h4 style="margin-top:20px;">Agregar seguimiento</h4>
            <div class="fila-form">
                <div class="campo">
                    <label for="tipoAccion">Tipo</label>
                    <select id="tipoAccion">
                        <option value="nota">Nota</option>
                        <option value="comunicacion_familia">Comunicación con la familia</option>
                        <option value="mediacion">Mediación</option>
                        <option value="acuerdo">Acuerdo</option>
                        <option value="derivacion">Derivación</option>
                        <option value="apelacion">Apelación</option>
                        <option value="cierre">Cierre</option>
                    </select>
                </div>
                <div class="campo" style="flex:3;">
                    <label for="descripcionSeguimiento">Descripción</label>
                    <input type="text" id="descripcionSeguimiento" placeholder="Ej: Se llamó a la madre, acuerda acompañamiento en casa.">
                </div>
                <button class="btn secundario" id="btnAgregarSeguimiento">Agregar</button>
            </div>
        </div>
    `;

    if (esAdmin) {
        cargarMedidasParaResolucion(i.nivel);
        document.getElementById('btnGuardarGestion').addEventListener('click', guardarGestion);
    }
    document.getElementById('btnAgregarSeguimiento').addEventListener('click', agregarSeguimiento);
}

function panelGestionHtml(i) {
    return `
        <div class="card" style="border: 2px solid var(--color-primary-light);">
            <h3>Resolver caso (Gestión de Convivencia / Dirección)</h3>
            <div class="fila-form">
                <div class="campo">
                    <label for="nuevoEstado">Estado</label>
                    <select id="nuevoEstado">
                        <option value="registrado" ${i.estado === 'registrado' ? 'selected' : ''}>Registrado</option>
                        <option value="en_gestion" ${i.estado === 'en_gestion' ? 'selected' : ''}>En gestión</option>
                        <option value="resuelto" ${i.estado === 'resuelto' ? 'selected' : ''}>Resuelto</option>
                        <option value="apelado" ${i.estado === 'apelado' ? 'selected' : ''}>Apelado</option>
                    </select>
                </div>
                <div class="campo">
                    <label for="nuevoDerivado">Derivado a</label>
                    <select id="nuevoDerivado">
                        <option value="ninguno" ${i.derivado_a === 'ninguno' ? 'selected' : ''}>Ninguno</option>
                        <option value="gestion_convivencia" ${i.derivado_a === 'gestion_convivencia' ? 'selected' : ''}>Gestión de Convivencia</option>
                        <option value="direccion" ${i.derivado_a === 'direccion' ? 'selected' : ''}>Dirección</option>
                        <option value="consejo_disciplina" ${i.derivado_a === 'consejo_disciplina' ? 'selected' : ''}>Consejo de Disciplina</option>
                    </select>
                </div>
            </div>
            <div class="campo" style="margin-top:12px;">
                <label for="medidaCatalogoResolucion">Medida educativa/disciplinaria (catálogo permitido)</label>
                <select id="medidaCatalogoResolucion"><option value="">— Elegir del catálogo —</option></select>
            </div>
            <div class="campo">
                <label for="medidaAplicadaResolucion">Detalle de la medida</label>
                <input type="text" id="medidaAplicadaResolucion" value="${i.medida_aplicada ? escaparHtml(i.medida_aplicada) : ''}">
            </div>
            <div class="fila-form" style="margin-top:6px;">
                <label style="display:flex; align-items:center; gap:8px; font-weight:600; font-size:0.85rem;">
                    <input type="checkbox" id="notificadoFamilia" ${i.notificado_familia == 1 ? 'checked' : ''} style="width:auto;">
                    Familia notificada
                </label>
            </div>
            <div class="campo" style="margin-top:6px;">
                <label for="observacionesResolucion">Observaciones</label>
                <textarea id="observacionesResolucion" rows="2">${i.observaciones ? escaparHtml(i.observaciones) : ''}</textarea>
            </div>
            <button class="btn" id="btnGuardarGestion" style="margin-top:10px;">Guardar gestión del caso</button>
        </div>
    `;
}

async function cargarMedidasParaResolucion(nivel) {
    try {
        const medidas = await apiFetch(`conducta_catalogo.php?tipo=medidas&nivel=${nivel}`);
        const select = document.getElementById('medidaCatalogoResolucion');
        select.innerHTML = '<option value="">— Elegir del catálogo —</option>' +
            medidas.map(m => `<option value="${m.id}" data-desc="${escaparHtml(m.descripcion)}" ${incidenteActual.medida_id == m.id ? 'selected' : ''}>${escaparHtml(m.descripcion)}</option>`).join('');
        select.addEventListener('change', function () {
            const opt = this.options[this.selectedIndex];
            if (opt.value) document.getElementById('medidaAplicadaResolucion').value = opt.dataset.desc;
        });
    } catch (err) { /* no bloquea el resto de la vista */ }
}

async function guardarGestion() {
    const body = {
        id: incidenteId,
        estado: document.getElementById('nuevoEstado').value,
        derivado_a: document.getElementById('nuevoDerivado').value,
        medida_id: document.getElementById('medidaCatalogoResolucion').value || null,
        medida_aplicada: document.getElementById('medidaAplicadaResolucion').value.trim(),
        notificado_familia: document.getElementById('notificadoFamilia').checked ? 1 : 0,
        observaciones: document.getElementById('observacionesResolucion').value.trim(),
    };
    try {
        await apiFetch('conducta_incidentes.php', { method: 'PUT', body });
        mostrarAlerta('alertaDetalle', 'Caso actualizado.', 'exito');
        cargarDetalle();
    } catch (err) {
        mostrarAlerta('alertaDetalle', err.message);
    }
}

function pintarSeguimiento(seguimiento) {
    if (!seguimiento || !seguimiento.length) {
        return '<p class="estado-vacio">Sin entradas todavía.</p>';
    }
    return seguimiento.map(s => `
        <div style="border-left: 3px solid var(--color-primary-light); padding: 4px 0 4px 12px; margin-bottom: 10px;">
            <p style="margin:0; font-size:0.8rem; color:var(--color-ink-soft);">${s.fecha} · ${escaparHtml(s.usuario_nombre)} · <span class="badge">${TIPO_ACCION_ETIQUETA[s.tipo_accion]}</span></p>
            <p style="margin:2px 0 0;">${escaparHtml(s.descripcion)}</p>
        </div>
    `).join('');
}

async function agregarSeguimiento() {
    const descripcion = document.getElementById('descripcionSeguimiento').value.trim();
    if (!descripcion) { mostrarAlerta('alertaDetalle', 'Escribe una descripción.'); return; }

    try {
        await apiFetch('conducta_seguimiento.php', {
            method: 'POST',
            body: {
                incidente_id: incidenteId,
                tipo_accion: document.getElementById('tipoAccion').value,
                descripcion,
            },
        });
        cargarDetalle();
    } catch (err) {
        mostrarAlerta('alertaDetalle', err.message);
    }
}

cargarDetalle();
