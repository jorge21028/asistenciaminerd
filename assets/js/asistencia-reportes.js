let combosReporte = [];
const NOMBRES_MES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const CLASE_ESTADO = { P: 'presente', A: 'ausente', T: 'tardanza', E: 'excusa', R: 'retirado' };
const NOMBRE_ESTADO = { P: 'Presente', A: 'Ausente', T: 'Tardanza', E: 'Excusa', R: 'Retirado' };
let ultimoReporte = null;

async function inicializarReportes() {
    // Selector de mes
    document.getElementById('mes').innerHTML = NOMBRES_MES.map((n, i) => `<option value="${i + 1}">${n}</option>`).join('');
    const hoy = new Date();
    document.getElementById('fecha').value = hoy.toISOString().slice(0, 10);
    document.getElementById('mes').value = hoy.getMonth() + 1;
    document.getElementById('anio').value = hoy.getFullYear();
    document.getElementById('semanaInicio').value = lunesDeEstaSemana();

    try {
        combosReporte = await apiFetch('asignaciones.php');
        const select = document.getElementById('cursoAsignatura');
        select.innerHTML = combosReporte.map(c =>
            `<option value="${c.curso_id}:${c.asignatura_id}">${escaparHtml(c.curso_nombre)} — ${escaparHtml(c.asignatura_nombre)}</option>`
        ).join('');
        if (combosReporte.length) generarReporte();
    } catch (err) {
        mostrarAlerta('alertaReportes', err.message);
    }
}

function lunesDeEstaSemana() {
    const hoy = new Date();
    const dia = hoy.getDay(); // 0=domingo
    const diff = dia === 0 ? -6 : 1 - dia;
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() + diff);
    return lunes.toISOString().slice(0, 10);
}

function actualizarCamposVisibles() {
    const tipo = document.getElementById('tipoReporte').value;
    document.getElementById('campoFecha').style.display = tipo === 'diario' ? 'block' : 'none';
    document.getElementById('campoSemana').style.display = tipo === 'semanal' ? 'block' : 'none';
    document.getElementById('campoMes').style.display = tipo === 'mensual' ? 'block' : 'none';
    document.getElementById('campoAnio').style.display = (tipo === 'mensual' || tipo === 'anual') ? 'block' : 'none';
}

function formatoFechaCorta(fechaISO) {
    const [, m, d] = fechaISO.split('-');
    return `${d}/${m}`;
}

function claseporcentaje(p) {
    if (p >= 90) return 'porcentaje-alto';
    if (p >= 75) return 'porcentaje-medio';
    return 'porcentaje-bajo';
}

// Estudiante retirado todo el periodo: no hay porcentaje (llega null)
function textoPorcentaje(p) {
    return p === null || p === undefined ? '—' : `<span class="${claseporcentaje(p)}">${p}%</span>`;
}

function selloHtml(codigo) {
    if (!codigo) return `<span class="sello-estado vacio">·</span>`;
    const clase = CLASE_ESTADO[codigo];
    return `<span class="sello-estado ${clase}" title="${NOMBRE_ESTADO[codigo]}">${codigo}</span>`;
}

async function generarReporte() {
    const combo = document.getElementById('cursoAsignatura').value;
    if (!combo) return;
    const [cursoId, asignaturaId] = combo.split(':');
    const tipo = document.getElementById('tipoReporte').value;
    const cont = document.getElementById('contenedorReporte');

    let params = `tipo=${tipo}&curso_id=${cursoId}&asignatura_id=${asignaturaId}`;
    if (tipo === 'diario') params += `&fecha=${document.getElementById('fecha').value}`;
    if (tipo === 'semanal') params += `&fecha_inicio=${document.getElementById('semanaInicio').value}`;
    if (tipo === 'mensual') params += `&anio=${document.getElementById('anio').value}&mes=${document.getElementById('mes').value}`;
    if (tipo === 'anual') params += `&anio=${document.getElementById('anio').value}`;

    cont.innerHTML = `<div class="card"><p>Cargando reporte…</p></div>`;

    try {
        
const data = await apiFetch(`reportes.php?${params}`);

const opcion = document.getElementById('cursoAsignatura')
    .selectedOptions[0];

ultimoReporte = {
    data,
    tipo,
    cursoAsignatura: opcion ? opcion.textContent.trim() : '',
    fechaGeneracion: new Date().toLocaleString('es-DO')
};

if (tipo === 'diario') renderDiario(data, cont);
if (tipo === 'semanal') renderSemanal(data, cont);
if (tipo === 'mensual') renderMensual(data, cont);
if (tipo === 'anual') renderAnual(data, cont);

// Agregar el botón de Excel sin modificar las tablas del reporte.
const zonaExcel = document.createElement('div');
zonaExcel.className = 'fila-form no-imprimir';
zonaExcel.style.cssText =
    'display:flex;justify-content:flex-end;margin:0 0 12px;';

zonaExcel.innerHTML = `
    <button type="button" class="btn secundario"
            id="btnExportarExcel">
        Exportar a Excel (.xlsx)
    </button>
`;

cont.prepend(zonaExcel);

document.getElementById('btnExportarExcel')
    .addEventListener('click', exportarReporteExcel);

    } catch (err) {
        cont.innerHTML = '';
        mostrarAlerta('alertaReportes', err.message);
    }
}

// ---------------------------------------------------------------------
function renderDiario(data, cont) {
    if (!data.estudiantes.length) {
        cont.innerHTML = `<div class="vacio-estado">No hay estudiantes matriculados en este curso.</div>`;
        return;
    }
    cont.innerHTML = `
        <div class="grid-3" style="grid-template-columns: repeat(3, 1fr);">
            <div class="card"><h3>${data.conteo.presente}</h3><p>Asistencia</p></div>
            <div class="card"><h3>${data.conteo.excusa}</h3><p>Excusas</p></div>
            <div class="card"><h3>${data.conteo.ausente}</h3><p>Inasistencia</p></div>
        </div>
        <div class="grid-3" style="grid-template-columns: repeat(3, 1fr);">
            <div class="card"><h3>${data.varones_presentes}</h3><p>Varones presentes hoy</p></div>
            <div class="card"><h3>${data.hembras_presentes}</h3><p>Hembras presentes hoy</p></div>
            <div class="card"><h3>${data.varones_presentes + data.hembras_presentes}</h3><p>Total presentes hoy</p></div>
        </div>
        <div class="card">
            <h3>Reporte diario — ${data.fecha}</h3>
            <p class="subtitulo">${data.porcentaje_presentes}% de asistencia el día de hoy · ${data.total_estudiantes} estudiantes${data.total_retirados ? ` (más ${data.total_retirados} retirado(s), no cuentan en el %)` : ' matriculados'}</p>
            <div class="tabla-wrap">
                <table>
                    <thead><tr><th class="num">Matrícula</th><th>Estudiante</th><th class="num">Estado</th><th>Observación</th></tr></thead>
                    <tbody>
                        ${data.estudiantes.map(e => `
                            <tr>
                                <td class="num">${escaparHtml(e.matricula || '—')}</td>
                                <td class="nombre-estudiante">${escaparHtml(e.nombre)}</td>
                                <td class="num">${e.estado ? selloHtml({presente:'P',ausente:'A',tardanza:'T',excusa:'E',retirado:'R'}[e.estado]) : selloHtml(null)}</td>
                                <td>${escaparHtml(e.observacion || '')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// ---------------------------------------------------------------------
function renderSemanal(data, cont) {
    if (!data.estudiantes.length) {
        cont.innerHTML = `<div class="vacio-estado">No hay estudiantes matriculados en este curso.</div>`;
        return;
    }
    const dias = data.dias_trabajados;
    cont.innerHTML = `
        <div class="card">
            <h3>Reporte semanal — ${formatoFechaCorta(data.fecha_inicio)} al ${formatoFechaCorta(data.fecha_fin)}</h3>
            <p class="subtitulo">Días trabajados en la semana: ${data.total_dias_trabajados}</p>
            ${!dias.length ? '<div class="vacio-estado">No se ha registrado asistencia esta semana.</div>' : `
            <div class="tabla-wrap">
                <table>
                    <thead>
                        <tr>
                            <th class="num">Matrícula</th>
                            <th>Estudiante</th>
                            ${dias.map(f => `<th class="num">${formatoFechaCorta(f)}</th>`).join('')}
                            <th class="num">Total</th>
                            <th class="num">%</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.estudiantes.map(e => `
                            <tr>
                                <td class="num">${escaparHtml(e.matricula || '—')}</td>
                                <td class="nombre-estudiante">${escaparHtml(e.nombre)}</td>
                                ${dias.map(f => `<td class="num">${selloHtml(e.dias[f])}</td>`).join('')}
                                <td class="num">${e.total_asistencia}/${e.dias_trabajados}</td>
                                <td class="num">${textoPorcentaje(e.porcentaje)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>`}
        </div>
    `;
}

// ---------------------------------------------------------------------
function renderMensual(data, cont) {
    if (!data.estudiantes.length) {
        cont.innerHTML = `<div class="vacio-estado">No hay estudiantes matriculados en este curso.</div>`;
        return;
    }
    const dias = data.dias_trabajados; // array de números de día

    cont.innerHTML = `
        <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:baseline; flex-wrap:wrap; gap:8px;">
                <h3>Mes de ${data.mes_nombre} ${data.anio}</h3>
                <p class="subtitulo" style="margin:0;">Días trabajados: <strong>${data.total_dias_trabajados}</strong></p>
            </div>
            <div class="leyenda">
                <span><span class="sello-estado presente" style="width:20px;height:20px;font-size:0.65rem;">P</span> Presente</span>
                <span><span class="sello-estado ausente" style="width:20px;height:20px;font-size:0.65rem;">A</span> Ausente</span>
                <span><span class="sello-estado tardanza" style="width:20px;height:20px;font-size:0.65rem;">T</span> Tardanza</span>
                <span><span class="sello-estado excusa" style="width:20px;height:20px;font-size:0.65rem;">E</span> Excusa</span>
                <span><span class="sello-estado retirado" style="width:20px;height:20px;font-size:0.65rem;">R</span> Retirado</span>
                <span style="margin-left:auto;">2 excusas, 2 tardanzas, o 1 excusa + 1 tardanza = 1 inasistencia</span>
            </div>
            ${!dias.length ? '<div class="vacio-estado">No se ha registrado asistencia este mes.</div>' : `
            <div class="fila-form no-imprimir" style="margin:10px 0 0; justify-content:flex-end;">
                <button type="button" class="btn secundario chico" id="btnCopiarPorcentaje">
                    <svg class="icon icon-sm"><use href="#icon-lista"></use></svg> Copiar % de asistencia (solo números)
                </button>
            </div>
            <div class="tabla-wrap tabla-mensual-wrap">
                <table id="tablaMensual">
                    <thead>
                        <tr>
                            <th class="num">Matrícula</th>
                            <th>Estudiante</th>
                            ${dias.map(d => `<th class="num">${d}</th>`).join('')}
                            <th class="num">Total<br>asistencia</th>
                            <th class="num">%</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.estudiantes.map(e => `
                            <tr>
                                <td class="num">${escaparHtml(e.matricula || '—')}</td>
                                <td class="nombre-estudiante">${escaparHtml(e.nombre)}</td>
                                ${dias.map(d => `<td class="num">${selloHtml(e.dias[d])}</td>`).join('')}
                                <td class="num">${e.total_asistencia}</td>
                                <td class="num" data-porcentaje-entero="${e.porcentaje === null ? '' : Math.round(e.porcentaje)}">${textoPorcentaje(e.porcentaje)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>`}
        </div>
    `;

    const btnCopiar = document.getElementById('btnCopiarPorcentaje');
    if (btnCopiar) btnCopiar.addEventListener('click', () => copiarColumnaPorcentaje(btnCopiar));
}

// Copia la columna "%" del reporte mensual, una fila por línea, redondeada
// a número entero y SIN el signo "%" — pensado para pegar directo en el
// sistema del centro educativo, que espera solo el número.
function copiarColumnaPorcentaje(boton) {
    const valores = Array.from(document.querySelectorAll('#tablaMensual td[data-porcentaje-entero]'))
        .map(td => td.dataset.porcentajeEntero);

    if (!valores.length) return;

    const texto = valores.join('\n');
    const restaurarTexto = boton.innerHTML;

    navigator.clipboard.writeText(texto).then(() => {
        boton.innerHTML = '✓ Copiado';
        setTimeout(() => { boton.innerHTML = restaurarTexto; }, 1500);
    }).catch(() => {
        mostrarAlerta('alertaReportes', 'No se pudo copiar automáticamente. Selecciona la columna manualmente.');
    });
}

// ---------------------------------------------------------------------
function renderAnual(data, cont) {
    cont.innerHTML = `
        <div class="card">
            <h3>Resumen mensual — ${data.anio}</h3>
            <p class="subtitulo">Total de días trabajados en el año: ${data.total_dias_trabajados}</p>
            ${!data.resumen_por_mes.length ? '<div class="vacio-estado">No hay asistencia registrada en este año.</div>' : `
            <div class="tabla-wrap">
                <table>
                    <thead><tr><th>Mes</th><th class="num">Días trabajados</th><th class="num">% promedio del curso</th></tr></thead>
                    <tbody>
                        ${data.resumen_por_mes.map(m => `
                            <tr>
                                <td>${m.mes_nombre}</td>
                                <td class="num">${m.dias_trabajados}</td>
                                <td class="num"><span class="${claseporcentaje(m.porcentaje_promedio_curso)}">${m.porcentaje_promedio_curso}%</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>`}
        </div>

        <div class="card">
            <h3>Totales anuales por estudiante</h3>
            ${!data.estudiantes.length ? '<div class="vacio-estado">No hay estudiantes matriculados en este curso.</div>' : `
            <div class="tabla-wrap">
                <table>
                    <thead>
                        <tr><th class="num">Matrícula</th><th>Estudiante</th><th class="num">Días trabajados</th><th class="num">Total asistencia</th><th class="num">Ausentes</th><th class="num">Tardanzas</th><th class="num">Excusas</th><th class="num">Días retirado</th><th class="num">%</th></tr>
                    </thead>
                    <tbody>
                        ${data.estudiantes.map(e => `
                            <tr>
                                <td class="num">${escaparHtml(e.matricula || '—')}</td>
                                <td class="nombre-estudiante">${escaparHtml(e.nombre)}</td>
                                <td class="num">${e.dias_trabajados}</td>
                                <td class="num">${e.total_asistencia}</td>
                                <td class="num">${e.ausentes}</td>
                                <td class="num">${e.tardanzas}</td>
                                <td class="num">${e.excusas}</td>
                                <td class="num">${e.retirados || 0}</td>
                                <td class="num">${textoPorcentaje(e.porcentaje)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>`}
        </div>
    `;
}

document.getElementById('tipoReporte').addEventListener('change', actualizarCamposVisibles);
document.getElementById('btnGenerar').addEventListener('click', generarReporte);

function activarEncabezadosFijos() {
    if (!document.getElementById('estilosEncabezadoFijo')) {
        const estilo = document.createElement('style');
        estilo.id = 'estilosEncabezadoFijo';

        estilo.textContent = `
            /* Toda la fila del encabezado queda fija arriba */
            .tabla-wrap table thead {
                position: relative;
                z-index: 100;
            }

            .tabla-wrap table thead th {
                position: sticky !important;
                top: 0 !important;
                z-index: 100 !important;
                background-color: #ffffff !important;
                background-clip: padding-box;
            }

            /* Matrícula y Estudiante pueden tener sticky horizontal.
               Deben quedar por encima del resto. */
            .tabla-wrap table thead th:first-child,
            .tabla-wrap table thead th:nth-child(2) {
                z-index: 110 !important;
            }

            /* Evita transparencias del encabezado */
            .tabla-wrap table thead tr {
                background-color: #ffffff !important;
            }

            /* Línea inferior para distinguir el encabezado */
            .tabla-wrap table thead th {
                box-shadow: 0 2px 2px rgba(0,0,0,0.12);
            }
        `;

        document.head.appendChild(estilo);
    }
}
inicializarReportes();


function exportarReporteExcel() {
    if (!ultimoReporte) {
        mostrarAlerta('alertaReportes', 'Primero genera un reporte.');
        return;
    }

    if (typeof XLSX === 'undefined') {
        mostrarAlerta(
            'alertaReportes',
            'No se ha cargado la librería de Excel.'
        );
        return;
    }

    const { data, tipo, cursoAsignatura } = ultimoReporte;
    const libro = XLSX.utils.book_new();

    // Convierte una matriz de filas en una hoja de Excel.
    function agregarHoja(nombre, filas, anchos = []) {
        const hoja = XLSX.utils.aoa_to_sheet(filas);

        if (anchos.length) {
            hoja['!cols'] = anchos.map(w => ({ wch: w }));
        }

        hoja['!autofilter'] = {
            ref: XLSX.utils.encode_range({
                s: { r: 0, c: 0 },
                e: {
                    r: Math.max(filas.length - 1, 0),
                    c: Math.max(
                        ...filas.map(f => f.length),
                        1
                    ) - 1
                }
            })
        };

        XLSX.utils.book_append_sheet(libro, hoja, nombre);
    }

    function estadoTexto(codigo) {
        const equivalencias = {
            P: 'Presente',
            A: 'Ausente',
            T: 'Tardanza',
            E: 'Excusa',
            R: 'Retirado'
        };

        return equivalencias[codigo] || '';
    }

    function porcentaje(valor) {
        return valor === null || valor === undefined
            ? '—'
            : `${valor}%`;
    }

    const encabezado = [
        ['REPORTE DE ASISTENCIA'],
        ['Curso y asignatura', cursoAsignatura],
        ['Fecha de generación', ultimoReporte.fechaGeneracion],
        []
    ];

    // REPORTE DIARIO
    if (tipo === 'diario') {
        const filas = [
            ...encabezado,
            ['Fecha', data.fecha],
            ['Porcentaje general de asistencia',
                porcentaje(data.porcentaje_presentes)],
            ['Total de estudiantes', data.total_estudiantes],
            ['Estudiantes retirados', data.total_retirados || 0],
            [],
            ['Resumen de asistencia', 'Cantidad'],
            ['Presentes', data.conteo.presente],
            ['Excusas', data.conteo.excusa],
            ['Ausentes', data.conteo.ausente],
            ['Varones presentes', data.varones_presentes],
            ['Hembras presentes', data.hembras_presentes],
            [
                'Total presentes',
                data.varones_presentes + data.hembras_presentes
            ],
            [],
            ['Matrícula', 'Estudiante', 'Estado', 'Observación'],
            ...data.estudiantes.map(e => [
                e.matricula || '—',
                e.nombre,
                estadoTexto({
                    presente: 'P',
                    ausente: 'A',
                    tardanza: 'T',
                    excusa: 'E',
                    retirado: 'R'
                }[e.estado]),
                e.observacion || ''
            ])
        ];

        agregarHoja('Reporte diario', filas, [18, 32, 18, 45]);
    }

    // REPORTE SEMANAL
    if (tipo === 'semanal') {
        const dias = data.dias_trabajados || [];

        const filas = [
            ...encabezado,
            ['Desde', data.fecha_inicio],
            ['Hasta', data.fecha_fin],
            ['Total de días trabajados', data.total_dias_trabajados],
            [],
            [
                'Matrícula',
                'Estudiante',
                ...dias.map(f => formatoFechaCorta(f)),
                'Total asistencia',
                'Días trabajados',
                'Porcentaje'
            ],
            ...data.estudiantes.map(e => [
                e.matricula || '—',
                e.nombre,
                ...dias.map(f => estadoTexto(e.dias[f])),
                e.total_asistencia,
                e.dias_trabajados,
                porcentaje(e.porcentaje)
            ])
        ];

        agregarHoja('Reporte semanal', filas, [
            18, 32, ...dias.map(() => 14), 18, 18, 15
        ]);
    }

    // REPORTE MENSUAL
    if (tipo === 'mensual') {
        const dias = data.dias_trabajados || [];

        const filas = [
            ...encabezado,
            ['Mes', `${data.mes_nombre} ${data.anio}`],
            ['Total de días trabajados', data.total_dias_trabajados],
            [],
            [
                'Matrícula',
                'Estudiante',
                ...dias,
                'Total asistencia',
                'Porcentaje'
            ],
            ...data.estudiantes.map(e => [
                e.matricula || '—',
                e.nombre,
                ...dias.map(d => estadoTexto(e.dias[d])),
                e.total_asistencia,
                porcentaje(e.porcentaje)
            ]),
            [],
            ['LEYENDA DE ESTADOS'],
            ['P', 'Presente'],
            ['A', 'Ausente'],
            ['T', 'Tardanza'],
            ['E', 'Excusa'],
            ['R', 'Retirado'],
            [],
            [
                'Equivalencia de incidencias',
                '2 excusas, 2 tardanzas o 1 excusa + 1 tardanza = 1 inasistencia'
            ]
        ];

        agregarHoja('Reporte mensual', filas, [
            18, 32, ...dias.map(() => 5), 18, 14
        ]);
    }

    // REPORTE ANUAL: resumen por mes y totales por estudiante.
    if (tipo === 'anual') {
        const filasMes = [
            ...encabezado,
            ['Año', data.anio],
            ['Total de días trabajados en el año',
                data.total_dias_trabajados],
            [],
            ['Mes', 'Días trabajados', '% promedio del curso'],
            ...(data.resumen_por_mes || []).map(m => [
                m.mes_nombre,
                m.dias_trabajados,
                porcentaje(m.porcentaje_promedio_curso)
            ])
        ];

        agregarHoja('Resumen mensual', filasMes, [24, 22, 25]);

        const filasEstudiantes = [
            ...encabezado,
            ['Año', data.anio],
            [],
            [
                'Matrícula',
                'Estudiante',
                'Días trabajados',
                'Total asistencia',
                'Ausentes',
                'Tardanzas',
                'Excusas',
                'Días retirado',
                'Porcentaje'
            ],
            ...(data.estudiantes || []).map(e => [
                e.matricula || '—',
                e.nombre,
                e.dias_trabajados,
                e.total_asistencia,
                e.ausentes,
                e.tardanzas,
                e.excusas,
                e.retirados || 0,
                porcentaje(e.porcentaje)
            ])
        ];

        agregarHoja('Totales por estudiante', filasEstudiantes, [
            18, 32, 18, 18, 14, 14, 14, 16, 14
        ]);
    }

    const fechaArchivo = new Date().toISOString().slice(0, 10);
    const tipoNombre = {
        diario: 'Diario',
        semanal: 'Semanal',
        mensual: 'Mensual',
        anual: 'Anual'
    }[tipo] || 'Reporte';

    const nombreArchivo =
        `Asistencia_${tipoNombre}_${fechaArchivo}.xlsx`;

    XLSX.writeFile(libro, nombreArchivo);
}

