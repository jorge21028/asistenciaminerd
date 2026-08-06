const NIVEL_ETIQUETA3 = { leve: 'Leve', grave: 'Grave', muy_grave: 'Muy grave' };
const NIVEL_CLASE3 = { leve: 'presente', grave: 'tardanza', muy_grave: 'ausente' };
const ESTADO_ETIQUETA3 = { registrado: 'Registrado', en_gestion: 'En gestión', resuelto: 'Resuelto', apelado: 'Apelado' };

async function cargarExpediente() {
    const params = new URLSearchParams(window.location.search);
    const estudianteId = params.get('estudiante_id');

    if (!estudianteId) {
        mostrarAlerta('alertaExpediente', 'No se indicó qué estudiante mostrar.');
        return;
    }

    try {
        const data = await apiFetch(`conducta_reportes.php?tipo=expediente&estudiante_id=${estudianteId}`);
        pintarExpediente(data);
    } catch (err) {
        mostrarAlerta('alertaExpediente', err.message);
    }
}

function pintarExpediente(data) {
    const e = data.estudiante;
    const cont = document.getElementById('contenidoExpediente');

    let alertaReincidencia = '';
    if (data.resumen.leve >= 3) {
        alertaReincidencia = `<div class="alerta info">Este estudiante acumula ${data.resumen.leve} faltas leves. Según el Art. 19-m de las Normas MINERD y la guía del centro, esto puede considerarse una falta grave por reiteración.</div>`;
    }

    cont.innerHTML = `
        <div class="card">
            <h2 style="margin-bottom:2px;">${escaparHtml(e.nombre)} ${escaparHtml(e.apellido)}</h2>
            <p class="subtitulo">${escaparHtml(e.curso_nombre)}${e.matricula ? ' · Matrícula ' + escaparHtml(e.matricula) : ''}</p>
        </div>

        ${alertaReincidencia}

        <div class="grid-3">
            <div class="card"><h3>${data.resumen.leve}</h3><p>Faltas leves</p></div>
            <div class="card"><h3>${data.resumen.grave}</h3><p>Faltas graves</p></div>
            <div class="card"><h3>${data.resumen.muy_grave}</h3><p>Faltas muy graves</p></div>
        </div>

        <div class="card">
            <h3>Historial completo</h3>
            ${!data.incidentes.length ? '<div class="vacio-estado">Este estudiante no tiene incidentes de conducta registrados.</div>' : `
            <div class="tabla-wrap">
                <table>
                    <thead><tr><th>Fecha</th><th>Falta</th><th class="num">Nivel</th><th class="num">Estado</th><th>Reportado por</th><th>Acciones</th></tr></thead>
                    <tbody>
                        ${data.incidentes.map(i => `
                            <tr>
                                <td>${i.fecha}</td>
                                <td>${escaparHtml(i.falta_descripcion)}</td>
                                <td class="num"><span class="sello-estado ${NIVEL_CLASE3[i.nivel]}" style="width:auto; height:auto; padding:3px 9px; border-radius:20px;">${NIVEL_ETIQUETA3[i.nivel]}</span></td>
                                <td class="num"><span class="badge">${ESTADO_ETIQUETA3[i.estado]}</span></td>
                                <td>${escaparHtml(i.reportado_por_nombre)}</td>
                                <td><a class="btn secundario chico" href="${rutaBase('conducta-detalle.html')}?id=${i.id}">Ver</a></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>`}
        </div>
    `;
}

cargarExpediente();
