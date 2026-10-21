const fs = require('fs');
const path = require('path');
const { BrowserWindow } = require('electron');
const { summarizeMovements, cents } = require('./closureReportModel');
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = value => new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU', minimumFractionDigits: Number.isInteger(value / 100) ? 0 : 2, maximumFractionDigits: 2 }).format(value / 100);
const time = (formatted, timestamp) => formatted || (timestamp && !Number.isNaN(new Date(timestamp).valueOf()) ? new Date(timestamp).toLocaleTimeString('es-UY', { timeZone: 'America/Montevideo', hour12: false }) : 'No informada');
const dateLabel = date => /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? date.split('-').reverse().join('/') : escapeHtml(date);
function receiptsTable(model) {
  const other = model.hasOther;
  const head = `<thead><tr><th>Concepto</th><th>Cantidad</th><th class="cash">Efectivo</th><th class="transfer">Transferencia</th>${other ? '<th>Otros</th>' : ''}<th class="total">Total</th></tr></thead>`;
  const amounts = row => `<td class="cash">${money(row.efectivo)}</td><td class="transfer">${money(row.transferencia)}</td>${other ? `<td>${money(row.otros)}</td>` : ''}<td class="total">${money(row.efectivo + row.transferencia + row.otros)}</td>`;
  const rows = model.groups.map(g => `<tr><td>${escapeHtml(g.label)}</td><td>${g.knownQuantity ? '×' + g.quantity : 'N/D'}</td>${amounts(g)}</tr>`).join('');
  return `<table class="receipts">${head}<tbody>${rows || `<tr><td colspan="${other ? 6 : 5}">Sin cobros registrados</td></tr>`}<tr class="grand"><td>Total cobrado</td><td></td>${amounts(model.receipts)}</tr></tbody></table>${model.groups.some(g => !g.knownQuantity) ? '<p class="note">N/D: cantidad no disponible.</p>' : ''}`;
}
function adjustmentsTable(model) {
  if (!model.adjustments.length) return '';
  const totals = { efectivo: 0, transferencia: 0, otros: 0 };
  for (const row of model.adjustments) totals[row.method] += row.amount;
  return `<h3>Salidas y correcciones</h3><table><thead><tr><th>Concepto / motivo</th><th>Efectivo</th><th>Transferencia</th>${model.hasOther ? '<th>Otros</th>' : ''}<th>Total</th></tr></thead><tbody>${model.adjustments.map(a => `<tr><td>${escapeHtml(a.label)} · ${escapeHtml(a.detail)}</td><td>${money(a.method === 'efectivo' ? a.amount : 0)}</td><td>${money(a.method === 'transferencia' ? a.amount : 0)}</td>${model.hasOther ? `<td>${money(a.method === 'otros' ? a.amount : 0)}</td>` : ''}<td>${money(a.amount)}</td></tr>`).join('')}<tr class="subtotal"><td>Total salidas y correcciones</td><td>${money(totals.efectivo)}</td><td>${money(totals.transferencia)}</td>${model.hasOther ? `<td>${money(totals.otros)}</td>` : ''}<td>${money(totals.efectivo + totals.transferencia + totals.otros)}</td></tr></tbody></table>`;
}
function balanceHtml(session, model) {
  const initial = cents(session.monto_inicial_efectivo);
  const calculated = initial + model.net.efectivo;
  const expected = session.efectivoEsperado ?? session.efectivo_esperado;
  const counted = session.efectivo_contado;
  const difference = counted == null ? null : cents(counted) - (expected == null ? calculated : cents(expected));
  return `<div class="balance"><h3>Control del efectivo</h3><p>Inicial <b>${money(initial)}</b> + cobros <b>${money(model.receipts.efectivo)}</b> + salidas y correcciones <b>${money(model.net.efectivo - model.receipts.efectivo)}</b></p><div class="final-balance"><span>Efectivo final calculado</span><strong>${money(calculated)}</strong></div>${expected != null && cents(expected) !== calculated ? `<p>Saldo guardado al cierre: <b>${money(cents(expected))}</b> · Diferencia con los movimientos: <b>${money(cents(expected) - calculated)}</b></p>` : ''}${counted != null ? `<p>Contado registrado: <b>${money(cents(counted))}</b> · ${difference === 0 ? 'Sin diferencia' : difference > 0 ? 'Sobrante: ' + money(difference) : 'Faltante: ' + money(-difference)}</p>` : ''}</div>`;
}
function createClosureExportService({ cashService, getDbPath }) {
  function getClosuresDirectory() {
    const directory = path.join(path.dirname(getDbPath()), 'cierres');
    fs.mkdirSync(directory, { recursive: true });
    return directory;
  }
  function getPdfPath(date) { return path.join(getClosuresDirectory(), `cierre-caja-${date}.pdf`); }
  function buildReportHtml(report) {
    const sessions = [...(report.sesiones || [])].sort((a, b) => String(a.ts_apertura || a.hora_apertura || '').localeCompare(String(b.ts_apertura || b.hora_apertura || '')));
    const model = summarizeMovements(sessions.flatMap(s => s.movimientos || []));
    const first = sessions[0];
    const last = sessions.at(-1);
    const lastModel = summarizeMovements(last?.movimientos || []);
    const closed = sessions.filter(s => s.estado === 'cerrada').length;
    const pending = report.ventasPendientes || [];
    let carry = 0;
    for (let i = 1; i < sessions.length; i++) {
      const previous = sessions[i - 1];
      carry += cents(sessions[i].monto_inicial_efectivo) - cents(previous.monto_inicial_efectivo) - summarizeMovements(previous.movimientos).net.efectivo;
    }
    const sections = sessions.map((s, i) => {
      const m = summarizeMovements(s.movimientos);
      return `<section class="session"><header><h2>${s.estado === 'cerrada' ? 'Cierre' : 'Caja abierta'} ${i + 1} · ${escapeHtml(s.cajero_cierre || s.cajero_apertura || 'Sin registrar')}</h2><p>Apertura: ${escapeHtml(time(s.hora_apertura, s.ts_apertura))} · Abre: ${escapeHtml(s.cajero_apertura || 'Sin registrar')}</p><p>${s.estado === 'cerrada' ? `Cierre: ${escapeHtml(time(s.hora_cierre, s.ts_cierre))} · Cierra: ${escapeHtml(s.cajero_cierre || 'Sin registrar')}` : 'Pendiente de cierre'}</p></header><h3>Cobros por concepto</h3>${receiptsTable(m)}${adjustmentsTable(m)}${balanceHtml(s, m)}${s.observacion_apertura ? `<p>Observación de apertura: ${escapeHtml(s.observacion_apertura)}</p>` : ''}${s.observacion_cierre || s.observacion ? `<p>Observación: ${escapeHtml(s.observacion_cierre || s.observacion)}</p>` : ''}</section>`;
    }).join('');
    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Cierre de caja ${escapeHtml(report.fecha)}</title><style>
    @page { size:A4; margin:14mm 12mm 16mm; }
    * { box-sizing:border-box; } body { margin:0; font:11px/1.4 "Segoe UI",sans-serif; color:#18212b; background:white; }
    h1 { font-size:28px; margin:5px 0 8px; } h2 { font-size:20px; margin:0 0 8px; } h3 { font-size:14px; margin:18px 0 7px; break-after:avoid; }
    p { margin:5px 0; } .brand,.note { color:#586574; font-size:10px; } header { break-inside:avoid; break-after:avoid; } .meta { margin:16px 0; padding:10px; background:#f4f5f7; border:1px solid #dde2e7; }
    table { width:100%; border-collapse:collapse; table-layout:fixed; margin:5px 0; font-size:11px; } th,td { padding:7px 8px; border-bottom:1px solid #dde2e7; vertical-align:top; text-align:right; overflow-wrap:anywhere; } th { background:#eef1f4; font-weight:600; } th:first-child,td:first-child { text-align:left; width:36%; } .receipts th:nth-child(2) { width:11%; } .cash { background:#e2f3e9; } .transfer { background:#e3eefc; } th.cash { color:#166548; } th.transfer { color:#245a91; } .total { border-left:1px solid #cbd2d9; font-weight:700; } .grand td { background:#18212b; color:white; font-weight:700; padding-top:10px; padding-bottom:10px; } .subtotal td { background:#eef1f4; font-weight:700; }
    thead { display:table-header-group; } tr { break-inside:avoid; } .balance { break-inside:avoid; margin-top:12px; } .final-balance { display:flex; justify-content:space-between; gap:20px; background:#18212b; color:white; font-weight:700; padding:12px; margin:8px 0; font-size:13px; }
    .session { break-before:page; } .pending { break-before:page; } .note { margin-top:7px; }
    </style></head><body><section><header><p class="brand">UNDER-FIT</p><h1>Cierre de caja</h1><p>${dateLabel(report.fecha)} · Caja central · ${closed} ${closed === 1 ? 'cierre registrado' : 'cierres registrados'}${sessions.some(s => s.estado !== 'cerrada') ? ' · Hay una caja abierta' : ''}</p></header>${first ? `<div class="meta"><p><b>Apertura del día:</b> ${escapeHtml(time(first.hora_apertura, first.ts_apertura))} · ${escapeHtml(first.cajero_apertura || 'Sin registrar')}</p><p><b>${last.estado === 'cerrada' ? 'Último cierre' : 'Último turno (abierto)'}:</b> ${last.estado === 'cerrada' ? escapeHtml(time(last.hora_cierre, last.ts_cierre)) : 'Pendiente'} · ${escapeHtml(last.cajero_cierre || last.cajero_apertura || 'Sin registrar')}</p></div>` : ''}<h3>Cobros por concepto</h3>${receiptsTable(model)}${adjustmentsTable(model)}${first ? `<div class="balance"><h3>Control del efectivo del día</h3><p>Inicial <b>${money(cents(first.monto_inicial_efectivo))}</b> + cobros <b>${money(model.receipts.efectivo)}</b> + salidas y correcciones <b>${money(model.net.efectivo - model.receipts.efectivo)}</b>${carry ? ` + variación entre aperturas <b>${money(carry)}</b>` : ''}</p><div class="final-balance"><span>Efectivo final calculado</span><strong>${money(cents(last.monto_inicial_efectivo) + lastModel.net.efectivo)}</strong></div><p>Transferencias netas: <b>${money(model.net.transferencia)}</b></p></div>` : ''}</section>${sections}${pending.length ? `<section class="pending"><h2>Ventas entregadas sin cobrar</h2><p>No incluidas en los cobros.</p><table><thead><tr><th>Producto</th><th>Socio</th><th>Registró</th><th>Pendiente</th></tr></thead><tbody>${pending.map(s => `<tr><td>${escapeHtml(s.productoNombre || s.producto_nombre)}</td><td>${escapeHtml(s.usuarioNombre || s.usuario_nombre)}</td><td>${escapeHtml(s.profesor)}</td><td>${money(cents(s.total))}</td></tr>`).join('')}</tbody></table></section>` : ''}</body></html>`;
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
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate: '<div style="font-size:8px;color:#586574;width:100%;padding:0 12mm;display:flex;justify-content:space-between"><span>UNDER-FIT · Importes en pesos uruguayos</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
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
