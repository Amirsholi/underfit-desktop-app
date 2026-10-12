const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ensureDockerReady } = require('../services/dockerRuntime');
test('ready Docker is reused without launching Desktop', async () => {
  let launches = 0;
  assert.equal(await ensureDockerReady({ executable: 'test-docker', probe: async () => true,
    launch: async () => launches++ }), 'test-docker');
  assert.equal(launches, 0);
});
test('host waits for engine startup and launches Desktop once', async () => {
  let calls = 0, launches = 0, waits = 0;
  await ensureDockerReady({ executable: 'test-docker', autoStart: true,
    probe: async () => ++calls === 4, launch: async () => launches++, sleep: async () => waits++ });
  assert.equal(launches, 1); assert.equal(waits, 3);
});
test('unavailable engine fails after a bounded wait', async () => {
  let calls = 0;
  await assert.rejects(ensureDockerReady({ executable: 'test-docker', autoStart: true,
    probe: async () => { calls++; return false; }, launch: async () => {}, sleep: async () => {}, attempts: 2 }), /no terminó/);
  assert.equal(calls, 3);
});
test('development mode does not start Docker automatically', async () => {
  await assert.rejects(ensureDockerReady({ executable: 'test-docker', probe: async () => false,
    launch: async () => assert.fail('must not launch') }), /todavía no está disponible/);
});
