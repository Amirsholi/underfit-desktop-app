const test = require('node:test');
const assert = require('node:assert/strict');
const { createScheduler } = require('../adminSync');

test('refresh avoids overlapping reads and does not replace a form opened during a request', async () => {
  let safe = true, finish, reads = 0, applied = 0;
  const sync = createScheduler({ safe: () => safe });
  sync.watch({ enabled: () => true, read: () => { reads++; return new Promise(resolve => { finish = resolve; }); }, apply: () => applied++ });
  const first = sync.refresh();
  await sync.refresh();
  assert.equal(reads, 1);
  safe = false; finish(['remote change']); await first;
  assert.equal(applied, 0);
  safe = true;
  const second = sync.refresh(); finish(['remote change']); await second;
  assert.equal(applied, 1);
});

test('failed reads retain confirmed data and recover without repeating unchanged renders', async () => {
  let fail = false, value = 1, visible = true;
  const applied = [], status = [];
  const sync = createScheduler({ safe: () => true, status: failed => status.push(failed) });
  sync.watch({ enabled: () => visible, read: async () => { if (fail) throw Error('offline'); return value; }, apply: data => applied.push(data) });
  await sync.refresh(); fail = true; await sync.refresh();
  assert.deepEqual(applied, [1]); assert.equal(status.at(-1), true);
  fail = false; await sync.refresh(); assert.equal(status.at(-1), false);
  assert.deepEqual(applied, [1]);
  visible = false; value = 2; await sync.refresh(); assert.deepEqual(applied, [1]);
  visible = true; await sync.refresh(); assert.deepEqual(applied, [1, 2]);
});

test('navigation away during a read discards its response', async () => {
  let visible = true, finish, applied = false;
  const sync = createScheduler({ safe: () => true });
  sync.watch({ enabled: () => visible, read: () => new Promise(resolve => { finish = resolve; }), apply: () => { applied = true; } });
  const pending = sync.refresh(); visible = false; finish(1); await pending;
  assert.equal(applied, false);
});
