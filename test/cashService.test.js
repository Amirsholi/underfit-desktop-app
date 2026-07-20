const test = require('node:test');
const assert = require('node:assert/strict');
const { createCashService } = require('../services/cashService');

function createRepository(original) {
  const created = [];
  return {
    created,
    findMovementById: async () => original,
    findOpenSession: async () => ({ id: 7, fecha: original.fecha }),
    createMovement: async movement => {
      created.push(movement);
      return { id: 100 + created.length };
    },
    inTransaction: async work => work(),
  };
}

test('cash output keeps the selected payment method', async () => {
  const repository = createRepository({ fecha: '2099-01-01' });
  const service = createCashService({ cashRepository: repository });
  const today = new Date();
  const pad = value => String(value).padStart(2, '0');
  const fecha = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  repository.findOpenSession = async () => ({ id: 7, fecha });

  await service.registerCashOutput({ fecha, monto: 500, formaPago: 'transferencia', observacion: 'Proveedor' });

  assert.equal(repository.created[0].forma_pago, 'transferencia');
  assert.equal(repository.created[0].monto, -500);
});

test('correction annuls the original and creates the corrected movement', async () => {
  const original = {
    id: 4,
    caja_sesion_id: 7,
    fecha: '2099-01-01',
    tipo_ingreso: 'egreso',
    forma_pago: 'efectivo',
    monto: -300,
    descripcion: 'Compra',
  };
  const repository = createRepository(original);
  const service = createCashService({ cashRepository: repository });

  const result = await service.correctMovement({
    id: 4,
    monto: 250,
    formaPago: 'transferencia',
    observacion: 'Compra corregida',
    motivo: 'Se ingreso un importe incorrecto',
  });

  assert.equal(result.corrected, true);
  assert.equal(repository.created.length, 2);
  assert.equal(repository.created[0].tipo_ingreso, 'anulacion');
  assert.equal(repository.created[0].monto, 300);
  assert.equal(repository.created[1].tipo_ingreso, 'egreso');
  assert.equal(repository.created[1].monto, -250);
  assert.equal(repository.created[1].forma_pago, 'transferencia');
});
