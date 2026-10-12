const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const model = require('../tablet-app/model');

function setup(queue = []) {
  const snapshot = { classes: [{ id: '7', roster: [{ memberId: '0012', name: 'Socio', presence: null }] }],
    schedules: [], members: [{ id: '0012', ci: '0012', name: 'Socio' }], products: [],
    professors: [{ id: 3, name: 'Profesor' }], exercises: [], templates: [], assignments: [] };
  const events = [], calls = [];
  let failRead = false;
  const client = { pending: () => queue.slice(), dismiss: key => { queue.splice(queue.findIndex(x => x.key === key), 1); }, request: async () => {
    if (failRead) throw new Error('Disconnected');
    return structuredClone(snapshot);
  }, send: async (url, body, options) => { calls.push({ url, body, options }); return { id: 10, version: 'new-version' }; } };
  const root = { TabletModel: { ...model, professors: [] }, TabletApi: { createClient: () => client },
    dispatchEvent: event => events.push(event.type) };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../tablet-app/live.js'), 'utf8'), { window: root, Event });
  return { live: root.TabletLive, client, calls, events, snapshot, disconnect: () => { failRead = true; } };
}

test('a delayed snapshot cannot undo attendance saved while that read was in flight', async () => {
  const { live, client, snapshot } = setup();
  await live.load('2026-09-23');
  let finish;
  client.request = () => new Promise(resolve => { finish = resolve; });
  const reading = live.load();
  const cls = live.store.classes[0];
  await live.attendance(cls, cls.roster[0]);
  finish(structuredClone(snapshot));
  assert.equal(await reading, false);
  assert.equal(cls.roster[0].presence, 'present');
});

test('a refresh cannot change data after an editor opens, and is applied on the next safe read', async () => {
  const { live, snapshot } = setup();
  await live.load('2026-09-23');
  snapshot.members[0].name = 'Cambio remoto';
  assert.equal(await live.load('2026-09-23', () => false), false);
  assert.equal(live.store.members[0].name, 'Socio');
  assert.equal(await live.load('2026-09-23', () => true), true);
  assert.equal(live.store.members[0].name, 'Cambio remoto');
});

test('old rejected attendance is cleared only when the server confirms the requested state', async () => {
  const queue = [{ key: 'old', path: '/classes/7/attendance', body: { identityNumber: '0012', present: true }, state: 'failed', error: 'Conflict' }];
  const { live, snapshot, calls } = setup(queue);
  await live.load('2026-09-23');
  assert.equal(queue.length, 1, 'keep a rejection that disagrees with the server');
  snapshot.classes[0].roster[0].presence = 'present';
  assert.equal(await live.load(), true);
  assert.equal(queue.length, 0);
  assert.equal(live.store.classes[0].roster[0].presence, 'present');
  assert.equal(calls.length, 0, 'reconciliation must not write attendance again');
});

test('queue completion refreshes pending UI even when server data did not change', async () => {
  const queue = [{ key: 'pending', path: '/classes/7/attendance', body: { identityNumber: '0012', present: true }, state: 'pending' }];
  const { live, snapshot } = setup(queue);
  snapshot.classes[0].roster[0].presence = 'present';
  await live.load('2026-09-23');
  assert.equal(live.store.classes[0].roster[0].pending, true);
  queue.length = 0;
  assert.equal(await live.load(), true);
  assert.ok(!live.store.classes[0].roster[0].pending);
});

test('live adapter retains identity zeros and saves attendance with expected server state', async () => {
  const { live, calls } = setup();
  await live.load('2026-09-23');
  const cls = live.store.classes[0];
  await live.attendance(cls, cls.roster[0]);
  assert.equal(calls[0].body.identityNumber, '0012');
  assert.equal(calls[0].body.expectedPresent, false);
  assert.equal(calls[0].body.present, true);
  assert.equal(calls[0].options.offline, true);
});

test('confirmed template save stays successful when the subsequent refresh loses connection', async () => {
  const { live, calls, events, disconnect } = setup();
  await live.load('2026-09-23'); disconnect();
  const result = await live.routineData.save({ name: 'Rutina', professor: 'Profesor', days: [{ exercises: [{ exerciseId: 1, sets: 3, reps: '10' }] }] });
  assert.equal(result.id, '10');
  assert.equal(result.version, 'new-version');
  assert.equal(calls.length, 1);
  assert.deepEqual(events, ['tablet-refresh-failed']);
});

test('template removal sends its version to reject changes made from the other tablet', async () => {
  const { live, calls } = setup();
  await live.load('2026-09-23');
  await live.routineData.remove({ id: '10', version: 'abc' });
  assert.equal(calls[0].url, '/templates/10?expectedVersion=abc');
  assert.equal(calls[0].options.method, 'DELETE');
});
