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
      renovacion: 'Renovación',
      venta_producto: 'Venta de producto',
      ingreso_manual: 'Ingreso manual',
      egreso: 'Salida',
      ajuste_manual: 'Ajuste',
      anulacion: 'Anulación por corrección',
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

  function buildProductRows(products = []) {
    if (!products.length) return `<tr><td colspan="5">Sin ventas de productos</td></tr>`;
    return products.map(product => `<tr>
      <td>${escapeHtml(product.nombre)}</td>
      <td>${Number(product.cantidad || 0)}</td>
      <td>${formatMoney(product.efectivo)}</td>
      <td>${formatMoney(product.transferencia)}</td>
      <td>${formatMoney(product.total)}</td>
    </tr>`).join('');
  }

  function buildPendingRows(sales = []) {
    return sales.map(sale => `<tr>
      <td>${escapeHtml(sale.hora || '-')}</td>
      <td>${escapeHtml(sale.usuarioNombre || sale.usuario_nombre || '-')}</td>
      <td>${escapeHtml(sale.productoNombre || sale.producto_nombre || '-')}</td>
      <td>${escapeHtml(sale.profesor || '-')}</td>
      <td>${formatMoney(sale.total)}</td>
    </tr>`).join('');
  }

  function buildConceptRows(report) {
    const totals = report.totalesPorTipoIngreso || {};
    const concepts = [
      ['Altas', totals.altas],
      ['Renovaciones', totals.renovaciones],
      ['Ventas de productos', totals.ventasProductos],
      ['Ingresos manuales', totals.ingresosManuales],
      ['Salidas', Math.abs(Number(totals.egresos || 0))],
      ['Ajustes', totals.ajustes],
    ].filter(([, value]) => Math.abs(Number(value || 0)) > 0.0001);

    return concepts.map(([label, value]) => `<tr>
      <td>${label}</td>
      <td>${formatMoney(value)}</td>
    </tr>`).join('');
  }

  function buildSessionHtml(sesion, index) {
    const isClosed = sesion.estado === 'cerrada';
    const cierreLabel = isClosed
      ? `${escapeHtml(sesion.cajero_cierre || 'Sin registrar')} a las ${escapeHtml(sesion.hora_cierre || '-')}`
      : 'Caja abierta pendiente de cierre';
    const notes = [
      sesion.observacion_apertura
        ? `<div><span class="meta-label">Observación de apertura</span><p>${escapeHtml(sesion.observacion_apertura)}</p></div>`
        : '',
      sesion.observacion_cierre
        ? `<div><span class="meta-label">Observación de cierre</span><p>${escapeHtml(sesion.observacion_cierre)}</p></div>`
        : '',
    ].filter(Boolean).join('');
    const notesHtml = notes ? `<div class="notes">${notes}</div>` : '';
    const products = sesion.ventasPorProducto || [];
    const productsHtml = products.length
      ? `<div class="subsection">
          <h3>Ventas por producto</h3>
          <table>
            <thead>
              <tr><th>Producto</th><th>Unidades</th><th>Efectivo</th><th>Transferencia</th><th>Total</th></tr>
            </thead>
            <tbody>${buildProductRows(products)}</tbody>
          </table>
        </div>`
      : '';

    return `<section class="section session">
      <h2>Caja ${index + 1}</h2>
      <div class="session-grid">
        <div><span class="meta-label">Apertura</span><strong>${escapeHtml(sesion.cajero_apertura || 'Sin registrar')} · ${escapeHtml(sesion.hora_apertura || '-')}</strong></div>
        <div><span class="meta-label">Cierre</span><strong>${cierreLabel}</strong></div>
        <div><span class="meta-label">Monto inicial</span><strong>${formatMoney(sesion.monto_inicial_efectivo)}</strong></div>
        <div><span class="meta-label">Efectivo esperado</span><strong>${formatMoney(sesion.efectivoEsperado)}</strong></div>
        <div><span class="meta-label">Efectivo contado</span><strong>${isClosed ? formatMoney(sesion.efectivo_contado) : '-'}</strong></div>
        <div><span class="meta-label">Diferencia</span><strong>${isClosed ? formatDifferenceLabel(sesion.diferencia_efectivo) : '-'}</strong></div>
      </div>
      ${notesHtml}
      <h3>Movimientos de caja</h3>
      <table>
        <thead>
          <tr><th>Hora</th><th>Tipo</th><th>Detalle</th><th>Pago</th><th>Monto</th></tr>
        </thead>
        <tbody>
          ${buildMovementsRows(sesion.movimientos)}
        </tbody>
      </table>
      ${productsHtml}
    </section>`;
  }

  function buildReportHtml(report) {
    const closedSessions = (report.sesiones || []).filter(sesion => sesion.estado === 'cerrada');
    const openSessions = (report.sesiones || []).filter(sesion => sesion.estado === 'abierta');
    const paymentTotals = report.totalesPorFormaPago || {};
    const typeTotals = report.totalesPorTipoIngreso || {};
    const conceptRows = buildConceptRows(report);
    const pendingSales = report.ventasPendientes || [];
    const sessionSections = closedSessions.length
      ? closedSessions.map(buildSessionHtml).join('')
      : `<section class="section"><h2>Cajas cerradas</h2><p class="empty">Todavía no hay cajas cerradas para esta fecha.</p></section>`;
    const conceptSection = conceptRows
      ? `<section class="section compact-section">
          <h2>Ingresos y salidas por concepto</h2>
          <table class="concept-table">
            <thead><tr><th>Concepto</th><th>Total</th></tr></thead>
            <tbody>${conceptRows}</tbody>
          </table>
        </section>`
      : '';
    const openNotice = openSessions.length
      ? `<section class="section warning"><h2>Caja abierta pendiente</h2><p>Hay una caja abierta por ${escapeHtml(openSessions[0].cajero_apertura || 'Sin registrar')} desde las ${escapeHtml(openSessions[0].hora_apertura || '-')}.</p></section>`
      : '';
    const pendingSection = pendingSales.length
      ? `<section class="section warning pending-section">
          <div class="section-heading">
            <div>
              <h2>Ventas entregadas sin cobrar</h2>
              <p class="empty">Control aparte: estos importes no integran el efectivo ni las transferencias cobradas.</p>
            </div>
            <strong>${formatMoney(report.pendientes?.total || 0)}</strong>
          </div>
          <table>
            <thead><tr><th>Hora</th><th>Socio</th><th>Producto</th><th>Registró</th><th>Importe pendiente</th></tr></thead>
            <tbody>${buildPendingRows(pendingSales)}</tbody>
          </table>
        </section>`
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
    @page {
      size: A4;
      margin: 12mm;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: "Segoe UI", Tahoma, sans-serif;
      color: var(--ink);
      background: #ffffff;
    }
    .sheet {
      display: grid;
      gap: 14px;
    }
    .hero {
      display: grid;
      gap: 5px;
      padding: 18px 20px;
      border-radius: 14px;
      background:
        radial-gradient(circle at top right, rgba(255, 106, 26, 0.18), transparent 28%),
        linear-gradient(180deg, #11151c, #0b0e13);
      color: #f9fafb;
      break-inside: avoid;
    }
    .hero h1 {
      margin: 0;
      font-size: 25px;
      font-weight: 700;
    }
    .hero p {
      margin: 0;
      color: rgba(249, 250, 251, 0.78);
      font-size: 12px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 9px;
      break-inside: avoid;
    }
    .card {
      padding: 13px 14px;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: var(--soft);
    }
    .card-label {
      display: block;
      margin-bottom: 6px;
      color: var(--muted);
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .card-value {
      display: block;
      font-size: 20px;
      font-weight: 700;
      color: var(--ink);
    }
    .section {
      display: grid;
      gap: 10px;
      padding: 15px 17px;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: #fff;
    }
    .section h2 {
      margin: 0;
      font-size: 16px;
    }
    .section h3 {
      margin: 3px 0 0;
      font-size: 13px;
    }
    .session-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px 14px;
      padding: 5px 0 8px;
      break-inside: avoid;
    }
    .session-grid strong {
      display: block;
      margin-top: 2px;
      font-size: 12px;
    }
    .meta-label {
      display: block;
      color: var(--muted);
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.035em;
    }
    .notes {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      padding: 9px 11px;
      border-radius: 9px;
      background: var(--soft);
      break-inside: avoid;
    }
    .notes p {
      margin: 3px 0 0;
      color: var(--ink);
      font-size: 11px;
    }
    .subsection {
      display: grid;
      gap: 7px;
      padding-top: 5px;
      break-inside: avoid;
    }
    .warning {
      background: var(--warn-soft);
    }
    .empty {
      margin: 0;
      color: var(--muted);
      font-size: 11px;
      line-height: 1.4;
    }
    .section-heading {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 20px;
    }
    .section-heading > strong {
      flex: 0 0 auto;
      color: #9a3412;
      font-size: 18px;
    }
    .compact-section {
      break-inside: avoid;
    }
    .concept-table {
      font-size: 12px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    th, td {
      padding: 7px 8px 7px 0;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: top;
    }
    th {
      color: var(--muted);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    th:last-child,
    td:last-child {
      padding-right: 0;
      text-align: right;
    }
    tr:last-child td { border-bottom: none; }
    thead {
      display: table-header-group;
    }
    tr {
      break-inside: avoid;
    }
    .card,
    .compact-section,
    .pending-section,
    .warning {
      break-inside: avoid;
    }
  </style>
</head>
<body>
  <main class="sheet">
    <section class="hero">
      <h1>Cierre de caja</h1>
      <p>Fecha: ${escapeHtml(report.fecha)}</p>
      <p>${closedSessions.length} ${closedSessions.length === 1 ? 'caja cerrada' : 'cajas cerradas'}${openSessions.length ? ' - hay una caja abierta pendiente' : ''}</p>
    </section>

    <section class="grid">
      <div class="card">
        <span class="card-label">Efectivo</span>
        <span class="card-value">${formatMoney(paymentTotals.efectivo)}</span>
      </div>
      <div class="card">
        <span class="card-label">Transferencias</span>
        <span class="card-value">${formatMoney(paymentTotals.transferencia)}</span>
      </div>
      <div class="card">
        <span class="card-label">Salidas</span>
        <span class="card-value">${formatMoney(Math.abs(Number(typeTotals.egresos || 0)))}</span>
      </div>
      <div class="card">
        <span class="card-label">Total caja</span>
        <span class="card-value">${formatMoney(report.totalGeneral)}</span>
      </div>
    </section>

    ${conceptSection}
    ${sessionSections}
    ${openNotice}
    ${pendingSection}
  </main>
</body>
</html>`;
  }

  async function exportDailyClosurePdf(fecha) {
    const report = await cashService.getDailyReport(fecha);
    const pdfPath = getPdfPath(fecha);
    const html = buildReportHtml(report);
    const temporaryHtmlPath = `${pdfPath}.rendering.html`;
    fs.writeFileSync(temporaryHtmlPath, html, 'utf8');
    let win = null;

    try {
      win = new BrowserWindow({
        show: false,
        webPreferences: {
          sandbox: false,
        },
      });
      await win.loadFile(temporaryHtmlPath);
      const pdfBuffer = await win.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        preferCSSPageSize: true,
      });
      fs.writeFileSync(pdfPath, pdfBuffer);
      return {
        created: true,
        path: pdfPath,
        directory: getClosuresDirectory(),
      };
    } finally {
      if (win && !win.isDestroyed()) win.destroy();
      if (fs.existsSync(temporaryHtmlPath)) fs.rmSync(temporaryHtmlPath);
    }
  }

  async function exportAndRevealDailyClosurePdf(fecha) {
    return exportDailyClosurePdf(fecha);
  }

  return {
    getClosuresDirectory,
    buildReportHtml,
    exportDailyClosurePdf,
    exportAndRevealDailyClosurePdf,
  };
}

module.exports = { createClosureExportService };
