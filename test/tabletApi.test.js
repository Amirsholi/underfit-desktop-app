const test = require('node:test');
const assert = require('node:assert/strict');
const { createClient } = require('../tablet-app/api');
function storage() { const values = new Map(); return { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) }; }
const ok = { ok: true, status: 200, json: async () => ({}) };

test('changing device with queued work is blocked before consuming a pairing code', async () => {
  const saved = storage(); let requests = 0;
  saved.setItem('underfit.tablet.credentials.v1', JSON.stringify({ id: 'tablet1', key: 'old-key' }));
  saved.setItem('underfit.tablet.queue.v1', JSON.stringify([{ key: 'pending', state: 'pending' }]));
  const client = createClient({ storage: saved, fetchImpl: async () => { requests++; return ok; } });
  assert.equal(client.deviceId(), 'tablet1');
  await assert.rejects(client.pairWithCode('tablet2', '123456'), /operaciones pendientes/);
  assert.equal(requests, 0); assert.equal(client.pending().length, 1);
  assert.equal(client.deviceId(), 'tablet1');
});

test('short pairing code stores a device credential once and survives a new client', async () => {
  const saved = storage(), calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return { ...ok, json: async () => ({ id: 'tablet2', key: 'x'.repeat(48) }) };
  };
  const client = createClient({ storage: saved, fetchImpl });
  await client.pairWithCode('tablet2', '001234');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/v1/tablet-pairing/exchange');
  assert.deepEqual(JSON.parse(calls[0].options.body), { deviceId: 'tablet2', code: '001234' });
  const restored = createClient({ storage: saved, fetchImpl });
  await restored.request('/state');
  assert.equal(calls[1].options.headers['X-UnderFit-Tablet-Key'], 'x'.repeat(48));
  assert.equal(calls[1].options.headers['X-UnderFit-Tablet-Id'], 'tablet2');
});

test('invalid or expired short code does not replace the linked device', async () => {
  const saved = storage();
  saved.setItem('underfit.tablet.credentials.v1', JSON.stringify({ id: 'tablet1', key: 'old-key' }));
  const client = createClient({ storage: saved, fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({ title: 'Código vencido' }) }) });
  await assert.rejects(client.pairWithCode('tablet2', '123456'), /Código vencido/);
  await assert.rejects(client.pairWithCode('tablet2', 'underfit2027'), /6 números/);
  assert.equal(JSON.parse(saved.getItem('underfit.tablet.credentials.v1')).id, 'tablet1');
});

test('rapid taps drain arrivals during an active send without waiting for the next refresh', async () => {
  let release, entered;
  const started = new Promise(resolve => { entered = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const sent = [];
  const client = createClient({ storage: storage(), fetchImpl: async (url, options) => {
    if (url.endsWith('/session')) return ok;
    sent.push(JSON.parse(options.body).identityNumber);
    if (sent.length === 1) { entered(); await gate; }
    return ok;
  } });
  await client.pair('tablet1', 'key');
  const first = client.send('/classes/1/attendance', { identityNumber: '01' }, { offline: true });
  await started;
  const second = client.send('/classes/1/attendance', { identityNumber: '02' }, { offline: true });
  release();
  const results = await Promise.all([first, second]);
  assert.deepEqual(sent, ['01', '02']);
  assert.ok(results.every(x => !x.queued));
  assert.equal(client.pending().length, 0);
});

test('rejected attendance remains visible without blocking a different student', async () => {
  const sent = [];
  const client = createClient({ storage: storage(), fetchImpl: async (url, options) => {
    if (url.endsWith('/session')) return ok;
    const identity = JSON.parse(options.body).identityNumber; sent.push(identity);
    return identity === '01' ? { ok: false, status: 422, json: async () => ({ title: 'Fecha futura' }) } : ok;
  } });
  await client.pair('tablet1', 'key');
  await assert.rejects(client.send('/classes/1/attendance', { identityNumber: '01' }, { offline: true }));
  const result = await client.send('/classes/2/attendance', { identityNumber: '02' }, { offline: true });
  assert.equal(result.queued, false);
  assert.deepEqual(sent, ['01', '02']);
  assert.equal(client.pending()[0].state, 'failed');
});

test('online-only save retries a lost response with the same key after reload', async () => {
  const disk = storage(), calls = [];
  let lost = false;
  const fetchImpl = async (url, options) => {
    calls.push(options);
    if (lost) throw new Error('response lost');
    return ok;
  };
  const first = createClient({ storage: disk, fetchImpl, newKey: () => 'original-key' });
  await first.pair('tablet1', 'key'); lost = true;
  await assert.rejects(first.send('/templates', { name: 'A' }));
  lost = false;
  const second = createClient({ storage: disk, fetchImpl, newKey: () => 'new-key' });
  await second.send('/templates', { name: 'A' });
  assert.equal(calls.at(-1).headers['Idempotency-Key'], 'original-key');
  await second.send('/templates', { name: 'A' });
  assert.equal(calls.at(-1).headers['Idempotency-Key'], 'new-key');
});

test('tablet persists a lost response and retries with the original idempotency key after reload', async () => {
  const disk = storage(), calls = [];
  let offline = false;
  const fetchImpl = async (url, options) => { calls.push({ url, ...options }); if (offline) throw new Error('lost response'); return ok; };
  const client = createClient({ storage: disk, fetchImpl, newKey: () => 'operation-1' });
  await client.pair('tablet-1', 'scoped-tablet-key');
  offline = true;
  assert.deepEqual(await client.send('/classes/1/attendance', { identityNumber: '0012', present: true }, { offline: true }), { queued: true });
  assert.equal(client.pending().length, 1);
  offline = false;
  const reopened = createClient({ storage: disk, fetchImpl });
  await reopened.flush();
  assert.equal(reopened.pending().length, 0);
  assert.equal(calls.at(-1).headers['Idempotency-Key'], 'operation-1');
  assert.equal(JSON.parse(calls.at(-1).body).identityNumber, '0012');
  assert.equal(calls.at(-1).headers['X-UnderFit-Device-Key'], undefined);
});

test('business rejection stays visible and stops dependent operations until explicitly dismissed', async () => {
  let reject = false;
  const client = createClient({ storage: storage(), fetchImpl: async () => reject
    ? { ok: false, status: 409, json: async () => ({ title: 'La clase cambió.' }) } : ok,
  newKey: () => 'conflict-1' });
  await client.pair('tablet-1', 'scoped-tablet-key'); reject = true;
  await assert.rejects(client.send('/attendance', {}, { offline: true }), /clase cambió/);
  assert.equal(client.pending()[0].state, 'failed');
  client.dismiss('conflict-1'); assert.equal(client.pending().length, 0);
});

test('failed pairing preserves the previously authorized device', async () => {
  let reject = false, lastHeaders;
  const client = createClient({ storage: storage(), fetchImpl: async (_, options) => {
    lastHeaders = options.headers;
    return reject ? { ok: false, status: 401, json: async () => ({ title: 'No autorizada' }) } : ok;
  } });
  await client.pair('first', 'scoped-key'); reject = true;
  await assert.rejects(client.pair('second', 'wrong'));
  reject = false; await client.request('/session');
  assert.equal(lastHeaders['X-UnderFit-Tablet-Id'], 'first');
});
