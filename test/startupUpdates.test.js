const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { runStartupUpdate } = require('../services/startupUpdates');
function setup() {
  const updater = new EventEmitter();
  const calls = [];
  updater.checkForUpdates = async () => {
    calls.push('check'); updater.emit('update-available');
    return { updateInfo: { version: '2.6.0' }, cancellationToken: { cancel: () => calls.push('cancel') } };
  };
  updater.downloadUpdate = async () => { calls.push('download'); };
  return { updater, calls, backup: async () => { calls.push('backup'); return { created: true }; },
    install: async () => { calls.push('install'); } };
}
test('startup update backs up before install and disables background/quit installs', async () => {
  const o = setup(); const result = await runStartupUpdate(o);
  assert.equal(result.installing, true);
  assert.deepEqual(o.calls, ['check','download','backup','install']);
  for (const key of ['autoDownload','autoInstallOnAppQuit','allowPrerelease','allowDowngrade']) assert.equal(o.updater[key], false);
});
test('failed backup keeps installed version', async () => {
  const o = setup(); o.backup = async () => ({ created: false });
  assert.equal((await runStartupUpdate(o)).installing, false);
  assert.ok(!o.calls.includes('install'));
});
test('offline startup continues without downloading or installing', async () => {
  const o = setup(); o.updater.checkForUpdates = async () => { throw new Error('offline'); };
  assert.equal((await runStartupUpdate(o)).installing, false);
  assert.deepEqual(o.calls, []);
});
test('a late available event after timeout cannot install during attention', async () => {
  const o = setup(); o.timeoutMs = 5;
  o.updater.checkForUpdates = () => new Promise(resolve => setTimeout(() => {
    o.updater.emit('update-available'); resolve({ updateInfo: { version: '2.6.0' } });
  }, 20));
  assert.equal((await runStartupUpdate(o)).installing, false);
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.deepEqual(o.calls, []);
});
test('download timeout cancels without backing up or installing', async () => {
  const o = setup(); o.downloadTimeoutMs = 5;
  o.updater.downloadUpdate = () => new Promise(() => {});
  assert.equal((await runStartupUpdate(o)).installing, false);
  assert.deepEqual(o.calls, ['check','cancel']);
});
test('installer failure allows normal startup', async () => {
  const o = setup(); o.install = async () => { throw new Error('installer unavailable'); };
  assert.equal((await runStartupUpdate(o)).installing, false);
});
