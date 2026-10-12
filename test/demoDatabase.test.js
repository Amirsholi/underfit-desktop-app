const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { resolveDemoDatabase } = require('../scripts/demoDatabase');
const { prepareDemoDatabase } = require('../scripts/prepare-demo-database');

test('demo preparation refuses existing data and seeds require a matching marker', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'underfit-demo-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const original = path.join(directory, 'original.db');
  fs.writeFileSync(original, 'must remain untouched');
  await assert.rejects(prepareDemoDatabase(original), /ya existe/);
  assert.equal(fs.readFileSync(original, 'utf8'), 'must remain untouched');
  assert.throws(() => resolveDemoDatabase(original), /sin identificación/);
  assert.throws(() => resolveDemoDatabase('relative.db'), /absoluta/);
  const demo = path.join(directory, 'review.db');
  await prepareDemoDatabase(demo);
  assert.equal(resolveDemoDatabase(demo), demo);
  fs.copyFileSync(`${demo}.demo.json`, `${original}.demo.json`);
  assert.throws(() => resolveDemoDatabase(original), /no coincide/);
  await assert.rejects(prepareDemoDatabase(demo), /ya existe/);
});
