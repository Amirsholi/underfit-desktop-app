const test = require('node:test');
const assert = require('node:assert/strict');
const { createClosureExportService } = require('../services/closureExportService');

function createReport({ pending = false } = {}) {
  return {
    fecha: '2026-07-23',
    totalGeneral: 650,
    totalesPorFormaPago: {
      efectivo: 450,
      transferencia: 200,
    },
    totalesPorTipoIngreso: {
      altas: 0,
      renovaciones: 400,
      ventasProductos: 250,
      ingresosManuales: 0,
      egresos: -80,
      ajustes: 0,
    },
    pendientes: {
      cantidad: pending ? 1 : 0,
      total: pending ? 60 : 0,
    },
    ventasPendientes: pending
      ? [{
          hora: '20:15',
          usuarioNombre: 'Martina Silva',
          productoNombre: 'Agua mineral 600 ml',
          profesor: 'Santiago Lima',
          total: 60,
        }]
      : [],
    sesiones: [{
      estado: 'cerrada',
      cajero_apertura: 'Lucia',
      cajero_cierre: 'Lucia',
      hora_apertura: '08:00',
      hora_cierre: '22:00',
      monto_inicial_efectivo: 1000,
      efectivoEsperado: 1450,
      efectivo_contado: 1450,
      diferencia_efectivo: 0,
      movimientos: [{
        hora: '10:30',
        tipo_ingreso: 'renovacion',
        usuario_nombre: 'Bruno Rodriguez',
        forma_pago: 'efectivo',
        monto: 400,
      }],
      ventasPorProducto: [{
        nombre: 'Agua mineral 600 ml',
        cantidad: 1,
        efectivo: 60,
        transferencia: 0,
        total: 60,
      }],
    }],
  };
}

function createService() {
  return createClosureExportService({
    cashService: { getDailyReport: async () => createReport() },
    getDbPath: () => 'C:\\GymApp\\tmp\\underfit-test.db',
  });
}

test('closure report omits the pending-sales section when there are no pending sales', () => {
  const html = createService().buildReportHtml(createReport());

  assert.doesNotMatch(html, /Ventas entregadas sin cobrar/);
  assert.doesNotMatch(html, /Entregado sin cobrar/);
  assert.doesNotMatch(html, /Sin ventas pendientes/);
  assert.doesNotMatch(html, /Resumen del dia/);
  assert.doesNotMatch(html, /Sin observaciones/);
});

test('closure report includes pending sales only when they exist', () => {
  const html = createService().buildReportHtml(createReport({ pending: true }));

  assert.match(html, /Ventas entregadas sin cobrar/);
  assert.match(html, /Martina Silva/);
  assert.match(html, /Agua mineral 600 ml/);
  assert.match(html, /\$\s60/);
});

test('closure report keeps useful product and concept breakdowns without zero rows', () => {
  const html = createService().buildReportHtml(createReport());

  assert.match(html, /Ventas por producto/);
  assert.match(html, /Ingresos y salidas por concepto/);
  assert.match(html, /Renovaciones/);
  assert.doesNotMatch(html, /<td>Altas<\/td>/);
  assert.doesNotMatch(html, /<td>Ajustes<\/td>/);
});
