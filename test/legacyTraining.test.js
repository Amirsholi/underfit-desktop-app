const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildTrainingSql } = require('../scripts/importLegacyTraining');
function fixture() {
  const days = [{ position: 1, name: 'Día 1', muscleGroups: 'Pecho', exercises: [{ exerciseId: 1, position: 1, sets: 3, repetitions: '30 s', load: null, restSeconds: 0, notes: "Sin 'rebote'" }] }];
  return { exercises: [{ id: 1, nombre: 'Press', grupo_muscular: 'Pecho', activo: 1 }], templates: [{ id: 1, dias_json: JSON.stringify(days) }], plans: [{ id: 1, usuario_ci: '123', profesor_id: 1, dias_json: JSON.stringify(days) }], members: [{ ci: '123' }], professors: [{ id: 1 }] };
}
test('preserves repetitions, zero rest and notes; guards collisions and archives source', () => {
  const sql = buildTrainingSql(fixture());
  assert.match(sql, /'30 s',NULL,0,'Sin ''rebote'''/);
  assert.match(sql, /Training ID collision/);
  assert.match(sql, /legacy_training_source/);
  assert.match(sql, /ON CONFLICT \("Id"\) DO NOTHING/);
  assert.equal(buildTrainingSql(fixture()), sql);
});
test('rejects missing exercises, duplicated positions and missing members', () => {
  for (const change of [
    d => { d.exercises = []; },
    d => { d.members = []; },
    d => { const days = JSON.parse(d.plans[0].dias_json); days[0].exercises.push(days[0].exercises[0]); d.plans[0].dias_json = JSON.stringify(days); },
  ]) {
    const data = fixture(); change(data);
    assert.throws(() => buildTrainingSql(data));
  }
});
test('main versions without training tables produce an empty import', () => {
  assert.doesNotThrow(() => buildTrainingSql({ exercises: [], templates: [], plans: [], members: [], professors: [] }));
});
