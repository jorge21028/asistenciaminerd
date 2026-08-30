const ETIQUETAS_ROL = { admin: 'Administrador', profesor: 'Profesor', orientador: 'Orientador', coordinador: 'Coordinador' };

async function inicializar() {
    await Promise.all([cargarResumen(), cargarHistorial()]);
}

async function cargarResumen() {
    const cont = document.getElementById('contenedorReporte');
    try {
        const d = await apiFetch('accesos_log.php');

        cont.innerHTML = `
            <div class="generador-resumen-grid" style="margin-top:0;">
                <div class="card"><h3>${d.accesos_hoy}</h3><p>Accesos hoy</p></div>
                <div class="card"><h3>${d.usuarios_activos_hoy}</h3><p>Usuarios distintos hoy</p></div>
                <div class="card"><h3>${d.accesos_semana}</h3><p>Accesos últimos 7 días</p></div>
                <div class="card"><h3>${d.intentos_fallidos_semana}</h3><p>Intentos fallidos (7 días)</p></div>
            </div>

            <div class="card">
                <h3>Por usuario</h3>
                <p class="subtitulo">Ordenado por total de accesos exitosos</p>
                <div class="tabla-wrap">
                    <table id="tablaPorUsuario">
                        <thead>
                            <tr><th>Usuario</th><th>Rol</th><th class="num">Total accesos</th><th class="num">Últimos 7 días</th><th class="num">Últimos 30 días</th><th>Último acceso</th></tr>
                        </thead>
                        <tbody>
                            ${d.por_usuario.map(u => `
                                <tr>
                                    <td class="nombre-estudiante">${escaparHtml(u.nombre)}</td>
                                    <td>${ETIQUETAS_ROL[u.rol] || u.rol}</td>
                                    <td class="num">${u.total_accesos}</td>
                                    <td class="num">${u.ultimos_7_dias}</td>
                                    <td class="num">${u.ultimos_30_dias}</td>
                                    <td>${u.ultimo_acceso ? new Date(u.ultimo_acceso).toLocaleString('es-DO') : '<span class="subtitulo">Nunca</span>'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        document.getElementById('btnExcel').style.display = 'inline-flex';
        document.getElementById('btnImprimir').style.display = 'inline-flex';
    } catch (err) {
        mostrarAlerta('alertaAccesos', err.message);
    }
}

async function cargarHistorial() {
    try {
        const historial = await apiFetch('accesos_log.php?historial=1');
        const tbody = document.getElementById('tablaHistorialAccesos');
        document.getElementById('estadoVacioHistorial').style.display = historial.length ? 'none' : 'block';
        tbody.innerHTML = historial.map(h => `
            <tr>
                <td>${new Date(h.created_at).toLocaleString('es-DO')}</td>
                <td>${h.usuario_nombre ? escaparHtml(h.usuario_nombre) : '<span class="subtitulo">Desconocido</span>'}</td>
                <td>${escaparHtml(h.email_intentado)}</td>
                <td class="num">${h.exito == 1 ? '<span class="icon-presente">✓ Correcto</span>' : '<span class="icon-ausente">✕ Fallido</span>'}</td>
                <td>${escaparHtml(h.ip_address || '—')}</td>
            </tr>
        `).join('');
    } catch (err) {
        mostrarAlerta('alertaAccesos', err.message);
    }
}

function exportarExcel() {
    const tabla = document.getElementById('tablaPorUsuario');
    if (!tabla) { mostrarAlerta('alertaAccesos', 'No hay datos para exportar.'); return; }
    const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '_');
    const wb = XLSX.utils.table_to_book(tabla, { sheet: 'Accesos' });
    XLSX.writeFile(wb, `Registro_accesos_${fecha}.xlsx`);
}

document.getElementById('btnExcel').addEventListener('click', exportarExcel);
document.getElementById('btnImprimir').addEventListener('click', () => window.print());

inicializar();
