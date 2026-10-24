const test = require('node:test');
const assert = require('node:assert/strict');
const { summarizeMovements } = require('../services/closureReportModel');
const { createClosureExportService } = require('../services/closureExportService');
const { createApiCashService } = require('../services/apiCashService');
const movement = (type, amount, method = 'efectivo', extra = {}) => ({ tipo_ingreso: type, monto: amount, forma_pago: method, ...extra });
const service = () => createClosureExportService({ cashService: {}, getDbPath: () => 'unused.db' });
function report() {
  return { fecha: '2026-10-12', sesiones: [{ estado: 'cerrada', cajero_apertura: 'Ana', cajero_cierre: 'Bea', ts_apertura: '2026-10-12T11:00:00Z', ts_cierre: '2026-10-12T20:00:00Z', monto_inicial_efectivo: 100, efectivoEsperado: 180, efectivo_contado: 175,
    movimientos: [movement('registration', 50), movement('productsale', 60, 'transferencia', { producto_id: 1, producto_nombre: 'Agua <600>', cantidad: 3 }), movement('renovacion', 40), movement('egreso', -10, 'efectivo', { observacion: 'Retiro' })] }] };
}
test('receipts reconcile every payment and keep corrections separate from sales', () => {
 const m = summarizeMovements([movement('registration', 50), movement('productsale', 60, 'transferencia', { producto_nombre: 'Agua', cantidad: 3 }), movement('egreso', -10), movement('anulacion', 10), movement('ajuste_manual', -2.25)]);
 assert.equal(m.totalReceipts, 11000);
 assert.equal(m.totalNet, 10775);
 assert.equal(m.adjustments.length, 3);
 assert.equal(m.groups.find(g => g.label === 'Agua').quantity, 3);
 assert.equal(m.groups.find(g => g.label === 'Inscripciones').quantity, 1);
 assert.equal(m.net.efectivo, 4775);
});
test('unknown historical units stay unknown, renamed products group by identity and sum actual prices', () => {
 const m = summarizeMovements([movement('productsale', 60, 'efectivo', { producto_id: 1, producto_nombre: 'Agua', cantidad: 2 }), movement('venta_producto', 25, 'transferencia', { producto_id: 1, producto_nombre: 'Agua nueva' })]);
 assert.equal(m.groups.length, 1);
 assert.equal(m.groups[0].knownQuantity, false);
 assert.equal(m.totalReceipts, 8500);
});
test('other payment methods remain visible and counted', () => {
 const m=summarizeMovements([movement('ingreso_manual', 1.15, 'otro')]);
 assert.equal(m.hasOther,true);assert.equal(m.totalReceipts,115);
});
test('PDF renders grouped concepts, all sessions, closing times and registered difference', () => {
 const r=report();r.sesiones.push({ ...r.sesiones[0], cajero_cierre:'Carla', ts_apertura:'2026-10-12T20:01:00Z', monto_inicial_efectivo:180, movimientos:[] });
 const html=service().buildReportHtml(r);
 assert.match(html,/Cierre 1 · Bea/);assert.match(html,/Cierre 2 · Carla/);
 assert.match(html,/17:00:00/);assert.match(html,/Inscripciones/);assert.match(html,/Agua &lt;600&gt;/);assert.match(html,/×3/);assert.match(html,/Faltante/);
 assert.doesNotMatch(html, /productsale|registration|Movimientos de caja|MUESTRA|ChatGPT|<th>Hora/);
 assert.match(html,/table-header-group/);assert.match(html,/tr \{ break-inside:avoid/);
});
test('pending section is present only when needed, without changing collections', () => {
 const r=report();assert.doesNotMatch(service().buildReportHtml(r),/Ventas entregadas sin cobrar/);
 r.ventasPendientes=[{ productoNombre:'Agua', usuarioNombre:'Socio de prueba', profesor:'Ana', total:60 }];
 assert.match(service().buildReportHtml(r),/Ventas entregadas sin cobrar/);
 assert.equal(summarizeMovements(r.sesiones[0].movimientos).totalReceipts,15000);
});
test('API report normalizes aliases, preserves units and uses last balance rather than adding carried balances', async () => {
 const make=(id,at,opening,expected) => ({businessDate:'2026-10-12',opening:{id,businessDate:'2026-10-12',cashier:'Ana',openingCash:opening,openedAtUtc:at,status:'closed'},closure:{id,businessDate:'2026-10-12',openingCashier:'Ana',openingCash:opening,openedAtUtc:at,closingCashier:'Bea',closedAtUtc:'2026-10-12T20:00:00Z',totalIncome:10,movementCount:1,totalCash:10,totalTransfer:0,expectedCash:expected,countedCash:expected,cashDifference:0,status:'closed'},movements:[{id:'m'+id,type:'productsale',amount:10,paymentMethod:'efectivo',productId:5,productName:'Agua',productQuantity:2}],totalIncome:10,movementCount:1,totalsByPaymentMethod:[{key:'efectivo',total:10}],totalsByType:[{key:'productsale',total:10}],expectedCash:expected,status:'cerrada'});
 const svc=createApiCashService({apiClient:{getCashDailyReport:async()=>({sessions:[make('2','2026-10-12T15:00:00Z',110,120),make('1','2026-10-12T11:00:00Z',100,110)]})}});
 const r=await svc.getDailyReport('2026-10-12');assert.equal(r.efectivoEsperado,120);assert.equal(r.cajaInicial,100);assert.equal(r.totalesPorTipoIngreso.ventasProductos,20);assert.equal(r.sesiones[0].movimientos[0].cantidad,2);assert.equal(r.sesiones[0].hora_cierre,'17:00:00');
});
