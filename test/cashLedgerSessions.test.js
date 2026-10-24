const test = require('node:test');
const assert = require('node:assert/strict');
const { createApiCashService } = require('../services/apiCashService');

test('daily ledger retains closed sessions without adding them to active reconciliation', async () => {
  const summary = (id, status, amount) => ({
    businessDate: '2026-10-12', status,
    opening: { id, businessDate: '2026-10-12', openedAtUtc: `2026-10-12T${id === 1 ? '10' : '15'}:00:00Z`, openingCash: 100, status: status === 'abierta' ? 'open' : 'closed' },
    closure: null, totalIncome: amount, expectedCash: 100 + amount, movementCount: 1,
    totalsByPaymentMethod: [{ key: 'efectivo', total: amount }], totalsByType: [],
    movements: [{ id, cashSessionId: id, businessDate: '2026-10-12', occurredAtUtc: '2026-10-12T15:30:00Z', amount, type: 'productsale' }],
  });
  const first = summary(1, 'cerrada', 50);
  const last = summary(2, 'abierta', 20);
  const service = createApiCashService({ apiClient: {
    getCashSummary: async () => last,
    getCashDailyReport: async () => ({ sessions: [first, last] }),
  } });
  assert.equal((await service.listMovementsByDate('2026-10-12')).length, 2);
  const result = await service.getDailySummary('2026-10-12');
  assert.equal(result.sesiones.length, 2);
  assert.equal(result.totalIngresos, 20);
  assert.equal(result.efectivoEsperado, 120);
  assert.equal(result.sesionAbierta.id, 2);
  last.status = 'cerrada';
  assert.equal((await service.getDailySummary('2026-10-12')).sesionAbierta, null);
  assert.equal((await service.listMovementsByDate('2026-10-12')).length, 2);
});
