const NIVEL_ETIQUETA = { leve: 'Leve', grave: 'Grave', muy_grave: 'Muy grave' };
const NIVEL_CLASE = { leve: 'presente', grave: 'tardanza', muy_grave: 'ausente' };
const ESTADO_ETIQUETA = { registrado: 'Registrado', en_gestion: 'En gestión', resuelto: 'Resuelto', apelado: 'Apelado' };

async function cargarCursosFiltro() {
    try {
        const cursos = await apiFetch('cursos.php');
        document.getElementById('filtroCurso').innerHTML =
            '<option value="">Todos</option>' + cursos.map(c => `<option value="${c.id}">${escaparHtml(c.nombre)}</option>`).join('');
    } catch (err) { /* silencioso, no bloquea el resto */ }
}

async function cargarResumen() {
    try {
        const data = await apiFetch('conducta_reportes.php?tipo=resumen');
        document.getElementById('statsResumen').innerHTML = `
            <div class="card"><h3>${data.por_nivel.leve}</h3><p>Faltas leves (este mes)</p></div>
            <div class="card"><h3>${data.por_nivel.grave}</h3><p>Faltas graves (este mes)</p></div>
            <div class="card"><h3>${data.por_nivel.muy_grave}</h3><p>Faltas muy graves (este mes)</p></div>
        `;
        if (data.pendientes > 0) {
            document.getElementById('cardPendientes').style.display = 'block';
            document.getElementById('textoPendientes').textContent =
                `Hay ${data.pendientes} caso(s) grave(s) o muy grave(s) que aún no han sido resueltos por Gestión de Convivencia / Dirección.`;
        }
    } catch (err) {
        mostrarAlerta('alertaConducta', err.message);
    }
}

async function cargarIncidentes() {
    const params = new URLSearchParams();
    const curso = document.getElementById('filtroCurso').value;
    const nivel = document.getElementById('filtroNivel').value;
    const estado = document.getElementById('filtroEstado').value;
    if (curso) params.set('curso_id', curso);
    if (nivel) params.set('nivel', nivel);
    if (estado) params.set('estado', estado);

    try {
        const incidentes = await apiFetch(`conducta_incidentes.php?${params.toString()}`);
        pintarIncidentes(incidentes);
    } catch (err) {
        mostrarAlerta('alertaConducta', err.message);
    }
}

function pintarIncidentes(incidentes) {
    const tbody = document.getElementById('tablaIncidentes');
    document.getElementById('estadoVacio').style.display = incidentes.length ? 'none' : 'block';

    tbody.innerHTML = incidentes.map(i => `
        <tr>
            <td>${i.fecha}</td>
            <td class="nombre-estudiante">
                <a href="${rutaBase('conducta-expediente.html')}?estudiante_id=${i.estudiante_id}">${escaparHtml(i.estudiante_nombre)} ${escaparHtml(i.estudiante_apellido)}</a>
            </td>
            <td>${escaparHtml(i.curso_nombre)}</td>
            <td>${escaparHtml(i.falta_descripcion)}</td>
            <td class="num"><span class="sello-estado ${NIVEL_CLASE[i.nivel]}" style="width:auto; height:auto; padding:3px 9px; border-radius:20px;">${NIVEL_ETIQUETA[i.nivel]}</span></td>
            <td class="num"><span class="badge">${ESTADO_ETIQUETA[i.estado]}</span></td>
            <td class="acciones-tabla">
                <a class="btn secundario chico" href="${rutaBase('conducta-detalle.html')}?id=${i.id}">Ver</a>
            </td>
        </tr>
    `).join('');
}

document.getElementById('btnFiltrar').addEventListener('click', cargarIncidentes);

cargarCursosFiltro();
cargarResumen();
cargarIncidentes();
