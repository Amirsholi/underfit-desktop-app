const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ensureTabletAccess } = require('../services/tabletAccess');

test('host keeps two independent tablet keys across restarts and rejects damaged configuration', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'underfit-tablet-access-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = ensureTabletAccess(directory);
  const original = fs.readFileSync(file, 'utf8');
  const devices = JSON.parse(original).Authentication.TabletDevices;
  assert.notEqual(devices.tablet1, devices.tablet2);
  assert.ok(devices.tablet1.length >= 48);
  assert.equal(ensureTabletAccess(directory), file);
  assert.equal(fs.readFileSync(file, 'utf8'), original);
  fs.writeFileSync(file, '{}');
  assert.throws(() => ensureTabletAccess(directory), /no es válida/);
  assert.equal(fs.readFileSync(file, 'utf8'), '{}');
});
