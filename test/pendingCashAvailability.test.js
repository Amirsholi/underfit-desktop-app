const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const context = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../adminOperations.js'), 'utf8'), context);
const ready = context.pendingCashIsReady;
test('pending collection requires an open session for the collection date', () => {
  assert.equal(ready({ sesionAbierta: { fecha: '2026-09-10' } }, '2026-09-10'), true);
  assert.equal(ready({ sesionAbierta: { fecha: '2026-09-09' } }, '2026-09-10'), false);
  assert.equal(ready({ sesionAbierta: null }, '2026-09-10'), false);
  assert.equal(ready(undefined, '2026-09-10'), false);
});
