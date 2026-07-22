const test = require('node:test');
const assert = require('node:assert/strict');
const { createOperationsService } = require('../services/operationsService');

test('collecting a pending sale records it in the current cash session', async () => {
  const calls = { movements: [], collected: [] };
  const operationsRepository = {
    findPendingSaleById: async () => ({
      id: 9,
      estado: 'pendiente',
      total: 120,
      profesor: 'Santiago',
      producto_id: 3,
      producto_nombre: 'Agua 600 ml',
      usuario_ci: 49876543,
      usuario_nombre: 'Martina Silva',
      cantidad: 2,
    }),
    markPendingSaleCollected: async payload => calls.collected.push(payload),
  };
  const cashService = {
    normalizePaymentDetails: payment => ({
      monto: Number(payment.monto),
      formaPago: payment.formaPago,
      montoRecibido: Number(payment.monto),
      cambio: 0,
      observacion: payment.observacion,
    }),
    registerMovement: async payload => {
      calls.movements.push(payload);
      return { id: 55 };
    },
  };
  const service = createOperationsService({
    operationsRepository,
    userRepository: {},
    productRepository: {},
    cashService,
  });

  const result = await service.collectPendingSale({ id: 9, formaPago: 'transferencia' });

  assert.equal(result.movement.id, 55);
  assert.equal(calls.movements[0].payment.formaPago, 'transferencia');
  assert.equal(calls.movements[0].payment.monto, 120);
  assert.equal(calls.movements[0].referencia.tabla, 'ventas_pendientes');
  assert.match(calls.movements[0].fecha, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(calls.collected[0], {
    id: 9,
    formaPago: 'transferencia',
    cobradoTs: calls.collected[0].cobradoTs,
    cajaMovimientoId: 55,
  });
});

test('creating a Local 2 sale ties together product, member and professor', async () => {
  let created;
  const service = createOperationsService({
    operationsRepository: {
      createPendingSale: async payload => {
        created = payload;
        return { id: 18, ...payload };
      },
    },
    userRepository: { findByCi: async () => ({ ci: 49876543, nombre: 'Martina Silva' }) },
    productRepository: { findById: async () => ({ id: 3, nombre: 'Agua 600 ml', precio: 60 }) },
    cashService: {},
  });

  await service.createPendingSale({ productoId: 3, usuarioCi: 49876543, cantidad: 2, profesor: 'Santiago' });

  assert.equal(created.productoNombre, 'Agua 600 ml');
  assert.equal(created.usuarioNombre, 'Martina Silva');
  assert.equal(created.profesor, 'Santiago');
  assert.equal(created.cantidad, 2);
  assert.equal(created.total, 120);
});

test('a tablet sale records the exact active professor session', async () => {
  let created;
  const service = createOperationsService({
    operationsRepository: {
      createPendingSale: async payload => {
        created = payload;
        return { id: 19, ...payload };
      },
    },
    userRepository: { findByCi: async () => ({ ci: 49876543, nombre: 'Martina Silva' }) },
    productRepository: { findById: async () => ({ id: 3, nombre: 'Agua 600 ml', precio: 60 }) },
    cashService: {},
    staffService: {
      resolveIdentity: async payload => {
        assert.equal(payload.profesorSesionId, 41);
        return { profesorId: 7, profesorSesionId: 41, profesorNombre: 'Valentina' };
      },
    },
  });

  await service.createPendingSale({
    productoId: 3,
    usuarioCi: 49876543,
    cantidad: 1,
    profesorSesionId: 41,
  });

  assert.equal(created.profesor, 'Valentina');
  assert.equal(created.profesorId, 7);
  assert.equal(created.profesorSesionId, 41);
});
