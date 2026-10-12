const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const context = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../adminEntries.js'), 'utf8'), context);
const order = context.orderCashMovementsByRegistration;

test('new real sales precede demo movements with later clock times', () => {
  const rows = [
    { id: 104, hora: '20:38' },
    { id: 106, hora: '11:04:51' },
    { id: 105, hora: '10:45:14' },
  ];
  assert.deepEqual(Array.from(order(rows), row => row.id), [106, 105, 104]);
  assert.deepEqual(rows.map(row => row.id), [104, 106, 105]);
});

test('empty results and numeric string IDs are supported', () => {
  assert.equal(order(null).length, 0);
  assert.deepEqual(Array.from(order([{ id: '9' }, { id: '10' }]), row => row.id), ['10', '9']);
});
