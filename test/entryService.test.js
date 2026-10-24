const test = require('node:test');
const assert = require('node:assert/strict');
const { createEntryService } = require('../services/entryService');

test('annulling an entry requires a reason and preserves an audit record', async () => {
  const today = new Date();
  const pad = value => String(value).padStart(2, '0');
  const fecha = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  let annulPayload = null;
  const service = createEntryService({
    userRepository: {},
    membershipRules: {},
    entryRepository: {
      findById: async () => ({ id: 9, fecha, anulado: 0 }),
      annul: async payload => {
        annulPayload = payload;
        return { changed: true };
      },
    },
  });

  const result = await service.annulEntry({ id: 9, motivo: 'Registro duplicado' });

  assert.equal(result.annulled, true);
  assert.equal(annulPayload.id, 9);
  assert.equal(annulPayload.motivo, 'Registro duplicado');
  assert.ok(annulPayload.ts);
});
