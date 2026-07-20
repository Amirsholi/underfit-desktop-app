const fs = require('fs');
const path = require('path');
const { BrowserWindow } = require('electron');

function createClosureExportService({ cashService, getDbPath }) {
  function getClosuresDirectory() {
    const dbPath = getDbPath();
    const baseDir = path.dirname(dbPath);
    const closuresDir = path.join(baseDir, 'cierres');
    fs.mkdirSync(closuresDir, { recursive: true });
    return closuresDir;
  }

  function getPdfPath(fecha) {
    return path.join(getClosuresDirectory(), `cierre-caja-${fecha}.pdf`);
  }

  function formatMoney(value) {
    return new Intl.NumberFormat('es-UY', {
      style: 'currency',
      currency: 'UYU',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(value || 0));
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDifferenceLabel(value) {
    const amount = Number(value || 0);
    if (amount > 0) return `Sobrante ${formatMoney(amount)}`;
    if (amount < 0) return `Faltante ${formatMoney(amount)}`;
    return `Sin diferencia ${formatMoney(0)}`;
  }

  function formatMovementType(value) {
    const labels = {
      alta: 'Alta',
      renovacion: 'Renovacion',
      venta_producto: 'Venta de producto',
      ingreso_manual: 'Ingreso manual',
      egreso: 'Salida',
      ajuste_manual: 'Ajuste',
      anulacion: 'Anulacion por correccion',
    };
    return labels[value] || value || '-';
  }

  function formatPaymentMethod(value) {
    const labels = {
      efectivo: 'Efectivo',
      transferencia: 'Transferencia',
      ajuste: 'Ajuste',
    };
    return labels[value] || value || '-';
  }

  function buildMovementsRows(movimientos = []) {
    if (!movimientos.length) {
      return `<tr><td colspan="5">Sin movimientos registrados</td></tr>`;
    }

    return movimientos.map(row => {
      const detalle = row.usuario_nombre || row.producto_nombre || row.descripcion || '-';
      return `<tr>
        <td>${escapeHtml(row.hora || '-')}</td>
        <td>${escapeHtml(formatMovementType(row.tipo_ingreso))}</td>
        <td>${escapeHtml(detalle)}</td>
        <td>${escapeHtml(formatPaymentMethod(row.forma_pago))}</td>
        <td>${formatMoney(row.monto)}</td>
      </tr>`;
    }).join('');
  }

  function buildSessionHtml(sesion, index) {
    const isClosed = sesion.estado === 'cerrada';
    const cierreLabel = isClosed
      ? `${escapeHtml(sesion.cajero_cierre || 'Sin registrar')} a las ${escapeHtml(sesion.hora_cierre || '-')}`
      : 'Caja abierta pendiente de cierre';
    const cierreObs = sesion.observacion_cierre ? escapeHtml(sesion.observacion_cierre) : 'Sin observaciones';
    const aperturaObs = sesion.observacion_apertura ? escapeHtml(sesion.observacion_apertura) : 'Sin observaciones';

    return `<section class="section session">
      <h2>Caja ${index + 1}</h2>
      <div class="session-grid">
        <div><span class="meta-label">Abrio</span><strong>${escapeHtml(sesion.cajero_apertura || 'Sin registrar')}</strong></div>
        <div><span class="meta-label">Hora apertura</span><strong>${escapeHtml(sesion.hora_apertura || '-')}</strong></div>
        <div><span class="meta-label">Monto inicial</span><strong>${formatMoney(sesion.monto_inicial_efectivo)}</strong></div>
        <div><span class="meta-label">Cerro</span><strong>${cierreLabel}</strong></div>
        <div><span class="meta-label">Efectivo esperado</span><strong>${formatMoney(sesion.efectivoEsperado)}</strong></div>
        <div><span class="meta-label">Efectivo contado</span><strong>${isClosed ? formatMoney(sesion.efectivo_contado) : '-'}</strong></div>
        <div><span class="meta-label">Diferencia</span><strong>${isClosed ? formatDifferenceLabel(sesion.diferencia_efectivo) : '-'}</strong></div>
        <div><span class="meta-label">Total caja</span><strong>${formatMoney(sesion.totalGeneral)}</strong></div>
      </div>
      <div class="notes">
        <div><span class="meta-label">Observacion apertura</span><p>${aperturaObs}</p></div>
        <div><span class="meta-label">Observacion cierre</span><p>${cierreObs}</p></div>
      </div>
      <table>
        <thead>
          <tr><th>Hora</th><th>Tipo</th><th>Detalle</th><th>Pago</th><th>Monto</th></tr>
        </thead>
        <tbody>
          ${buildMovementsRows(sesion.movimientos)}
        </tbody>
      </table>
      <div class="session-totals">
        <span>Efectivo: ${formatMoney(sesion.totalesPorFormaPago.efectivo)}</span>
        <span>Transferencia: ${formatMoney(sesion.totalesPorFormaPago.transferencia)}</span>
        <span>Salidas: ${formatMoney(Math.abs(sesion.totalesPorTipoIngreso.egresos))}</span>
      </div>
    </section>`;
  }

  function buildReportHtml(report) {
    const closedSessions = (report.sesiones || []).filter(sesion => sesion.estado === 'cerrada');
    const openSessions = (report.sesiones || []).filter(sesion => sesion.estado === 'abierta');
    const totalDiferencia = closedSessions.reduce((acc, sesion) => acc + Number(sesion.diferencia_efectivo || 0), 0);
    const ultimoCierre = [...closedSessions].reverse()[0] || null;
    const sessionSections = closedSessions.length
      ? closedSessions.map(buildSessionHtml).join('')
      : `<section class="section"><h2>Cajas cerradas</h2><p class="empty">Todavia no hay cajas cerradas para esta fecha.</p></section>`;
    const openNotice = openSessions.length
      ? `<section class="section warning"><h2>Caja abierta pendiente</h2><p>Hay una caja abierta por ${escapeHtml(openSessions[0].cajero_apertura || 'Sin registrar')} desde las ${escapeHtml(openSessions[0].hora_apertura || '-')}.</p></section>`
      : '';

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Cierre de caja ${escapeHtml(report.fecha)}</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #0e1116;
      --panel: #161b22;
      --soft: #f6f7fb;
      --line: #d9dfea;
      --ink: #111827;
      --muted: #6b7280;
      --accent: #ff6a1a;
      --accent-soft: rgba(255, 106, 26, 0.12);
      --warn-soft: rgba(245, 158, 11, 0.14);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 32px;
      font-family: "Segoe UI", Tahoma, sans-serif;
      color: var(--ink);
      background: #ffffff;
    }
    .sheet {
      display: grid;
      gap: 22px;
    }
    .hero {
      display: grid;
      gap: 8px;
      padding: 24px 26px;
      border-radius: 18px;
      background:
        radial-gradient(circle at top right, rgba(255, 106, 26, 0.18), transparent 28%),
        linear-gradient(180deg, #11151c, #0b0e13);
      color: #f9fafb;
    }
    .hero h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 700;
    }
    .hero p {
      margin: 0;
      color: rgba(249, 250, 251, 0.78);
      font-size: 14px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
    }
    .card {
      padding: 18px 20px;
      border: 1px solid var(--line);
      border-radius: 16px;
      background: var(--soft);
    }
    .card-label {
      display: block;
      margin-bottom: 8px;
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .card-value {
      display: block;
      font-size: 24px;
      font-weight: 700;
      color: var(--ink);
    }
    .section {
      display: grid;
      gap: 12px;
      padding: 20px 22px;
      border: 1px solid var(--line);
      border-radius: 18px;
      background: #fff;
    }
    .section h2 {
      margin: 0;
      font-size: 17px;
    }
    .session-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      padding: 12px 0;
    }
    .meta-label {
      display: block;
      color: var(--muted);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .notes {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      padding: 10px 0;
    }
    .notes p {
      margin: 4px 0 0;
      color: var(--ink);
    }
    .session-totals {
      display: flex;
      gap: 18px;
      flex-wrap: wrap;
      color: var(--muted);
      font-size: 13px;
      font-weight: 700;
    }
    .warning {
      background: var(--warn-soft);
    }
    .empty {
      margin: 0;
      color: var(--muted);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    th, td {
      padding: 10px 0;
      border-bottom: 1px solid var(--line);
      text-align: left;
    }
    th {
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    tr:last-child td { border-bottom: none; }
    .obs {
      padding: 14px 16px;
      border-radius: 14px;
      background: var(--accent-soft);
      color: #7c2d12;
      font-size: 14px;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <main class="sheet">
    <section class="hero">
      <h1>Cierre de caja</h1>
      <p>Fecha: ${escapeHtml(report.fecha)}</p>
      <p>${closedSessions.length} caja(s) cerrada(s)${openSessions.length ? ' - hay una caja abierta pendiente' : ''}</p>
    </section>

    <section class="grid">
      <div class="card">
        <span class="card-label">Total efectivo</span>
        <span class="card-value">${formatMoney(report.totalesPorFormaPago.efectivo)}</span>
      </div>
      <div class="card">
        <span class="card-label">Total general</span>
        <span class="card-value">${formatMoney(report.totalGeneral)}</span>
      </div>
      <div class="card">
        <span class="card-label">Transferencias</span>
        <span class="card-value">${formatMoney(report.totalesPorFormaPago.transferencia)}</span>
      </div>
    </section>

    ${sessionSections}
    ${openNotice}

    <section class="section">
      <h2>Resumen del dia</h2>
      <table>
        <thead>
          <tr><th>Concepto</th><th>Total</th></tr>
        </thead>
        <tbody>
          <tr><td>Altas</td><td>${formatMoney(report.totalesPorTipoIngreso.altas)}</td></tr>
          <tr><td>Renovaciones</td><td>${formatMoney(report.totalesPorTipoIngreso.renovaciones)}</td></tr>
          <tr><td>Ventas de productos</td><td>${formatMoney(report.totalesPorTipoIngreso.ventasProductos)}</td></tr>
          <tr><td>Ingresos manuales</td><td>${formatMoney(report.totalesPorTipoIngreso.ingresosManuales)}</td></tr>
          <tr><td>Salidas</td><td>${formatMoney(report.totalesPorTipoIngreso.egresos)}</td></tr>
          <tr><td>Ajustes</td><td>${formatMoney(report.totalesPorTipoIngreso.ajustes)}</td></tr>
          <tr><td>Diferencia total de efectivo</td><td>${formatDifferenceLabel(totalDiferencia)}</td></tr>
          <tr><td>Ultimo monto contado</td><td>${ultimoCierre ? formatMoney(ultimoCierre.efectivo_contado) : '-'}</td></tr>
        </tbody>
      </table>
    </section>
  </main>
</body>
</html>`;
  }

  async function exportDailyClosurePdf(fecha) {
    const report = await cashService.getDailyReport(fecha);
    const pdfPath = getPdfPath(fecha);
    const html = buildReportHtml(report);
    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        sandbox: false,
      },
    });

    try {
      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      const pdfBuffer = await win.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        marginsType: 1,
      });
      fs.writeFileSync(pdfPath, pdfBuffer);
      return {
        created: true,
        path: pdfPath,
        directory: getClosuresDirectory(),
      };
    } finally {
      win.destroy();
    }
  }

  async function exportAndRevealDailyClosurePdf(fecha) {
    return exportDailyClosurePdf(fecha);
  }

  return {
    getClosuresDirectory,
    exportDailyClosurePdf,
    exportAndRevealDailyClosurePdf,
  };
}

module.exports = { createClosureExportService };
