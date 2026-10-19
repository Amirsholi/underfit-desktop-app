const test = require('node:test');
const assert = require('node:assert/strict');
const { createApiProductService } = require('../services/apiProductService');
const { createApiClassOperationsService } = require('../services/apiClassOperationsService');

test('local availability is independent of product activation and keeps the other local', async () => {
  let sent;
  const service = createApiProductService({ apiClient: { updateProduct: async (id, payload) => { sent = payload; } } });
  await service.updateProduct(4, { nombre: 'Agua', precio: 75, activo: true, availableLocal1: false, availableLocal2: true });
  assert.equal(sent.availableLocal1, false);
  assert.equal(sent.availableLocal2, true);
  assert.equal(sent.activo, true);
});

test('api product service preserves product and sale payload contracts', async () => {
  const calls = [];
  const service = createApiProductService({
    apiClient: {
      listProducts: async () => [{ id: 1, nombre: 'Agua', precio: 100, activo: true }],
      createProduct: async payload => (calls.push(['create', payload]), { id: 2, ...payload }),
      updateProduct: async (id, payload) => (calls.push(['update', id, payload]), {}),
      deleteProduct: async id => (calls.push(['delete', id]), {}),
      sellProduct: async (id, payload) => (calls.push(['sell', id, payload]), { success: true }),
      listProductSales: async date => (calls.push(['listSales', date]), []),
      getProductSalesTotal: async date => (calls.push(['total', date]), { total: 250 }),
    },
  });

  assert.equal((await service.listProducts())[0].nombre, 'Agua');
  await service.createProduct({ nombre: 'Barra', precio: '80' });
  await service.sellOneProduct({
    id: 1,
    quantity: 2,
    payment: { monto: 200, formaPago: 'efectivo', observacion: 'mostrador' },
  });
  assert.equal(await service.getSalesTotalByDate('2026-07-28'), 250);
  assert.deepEqual(calls[0], ['create', { nombre: 'Barra', precio: 80, activo: true }]);
  assert.deepEqual(calls[1], ['sell', 1, {
    id: 1,
    quantity: 2,
    payment: {
      monto: 200,
      formaPago: 'efectivo',
      montoRecibido: undefined,
      observacion: 'mostrador',
    },
  }]);
});

test('API pending sales preserve tablet contracts without stock quantities', async () => {
  const calls = [];
  const apiClient = {
    listProducts: async () => [{ id: 3, nombre: 'Agua', precio: 80, activo: true }],
    listPendingSales: async () => [{ id: 7, estado: 'pendiente' }],
    getPendingSalesSummary: async () => ({ cantidad: 1, total: 160 }),
    createPendingSale: async payload => (calls.push(['create', payload]), { id: 7, ...payload }),
    collectPendingSale: async (id, payload) => (calls.push(['collect', id, payload]), { saleId: id, movement: { id: 'm' } }),
  };
  const service = createApiClassOperationsService({ apiClient, localOperationsService: {} });

  const products = await service.listStock();
  await service.createPendingSale({
    productoId: 3, usuarioCi: 456, cantidad: 2,
    profesorSesionId: 9, localId: 2,
  });
  const collected = await service.collectPendingSale({ id: 7, formaPago: 'transferencia' });

  assert.equal(products[0].activo, true);
  assert.equal(products[0].local2, 1);
  assert.equal(collected.saleId, 7);
  assert.equal(calls[0][1].usuarioCi, '456');
});
