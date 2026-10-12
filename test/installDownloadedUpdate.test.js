const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { installDownloadedUpdate } = require('../services/installDownloadedUpdate');
test('installation waits for Electron confirmation and removes temporary listeners', async () => {
  const updater = new EventEmitter(); const native = new EventEmitter();
  updater.quitAndInstall = (silent, restart) => {
    assert.equal(silent, true); assert.equal(restart, true);
    setImmediate(() => native.emit('before-quit-for-update'));
  };
  await installDownloadedUpdate(updater, native);
  assert.equal(native.listenerCount('before-quit-for-update'), 0);
  assert.equal(updater.listenerCount('error'), 0);
});
test('installer error rejects instead of leaving startup waiting forever', async () => {
  const updater = new EventEmitter(); const native = new EventEmitter();
  updater.quitAndInstall = () => setImmediate(() => updater.emit('error', new Error('Installer failed')));
  await assert.rejects(installDownloadedUpdate(updater, native), /Installer failed/);
  assert.equal(native.listenerCount('before-quit-for-update'), 0);
});
test('missing installer confirmation times out', async () => {
  const updater = new EventEmitter(); const native = new EventEmitter();
  updater.quitAndInstall = () => {};
  await assert.rejects(installDownloadedUpdate(updater, native, 5), /no confirmó/);
});
