const test = require('node:test');
const assert = require('node:assert/strict');
const groups = require('../exerciseGroups');

test('one filter for all capitalizations and surrounding whitespace', () => {
  const catalog = ['pecho', 'Pecho', 'PECHO', ' PeChO ', 'Piernas', 'PIERNAS', ''].map(muscleGroup => ({ muscleGroup }));
  assert.deepEqual(groups.list(catalog), ['Pecho', 'Piernas']);
  assert.equal(catalog.filter(e => groups.key(e.muscleGroup) === groups.key('Pecho')).length, 4);
});

test('labels and comparisons normalize internal spaces and Unicode composition', () => {
  assert.equal(groups.label('  ESPALDA   ALTA '), 'Espalda alta');
  assert.equal(groups.key('Glúteos'), groups.key('GLU\u0301TEOS'));
  assert.deepEqual(groups.list([{ muscleGroup: 'glúteos' }, { muscleGroup: 'GLÚTEOS' }]), ['Glúteos']);
});

test('grouping does not mutate the existing catalog or merge distinct muscles', () => {
  const catalog = [{ id: 1, muscleGroup: 'pecho' }, { id: 2, muscleGroup: 'PECHO SUPERIOR' }, { id: 3, muscleGroup: null }];
  const before = structuredClone(catalog);
  assert.deepEqual(groups.list(catalog), ['Pecho', 'Pecho superior']);
  assert.deepEqual(catalog, before);
  assert.equal(groups.label(null), '');
});
