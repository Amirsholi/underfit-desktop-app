const test = require('node:test');
const assert = require('node:assert/strict');
const membershipRules = require('../membershipRules');

test('membership urgency puts positive days first and every zero-day result last', () => {
  const reference = new Date(2026, 6, 22);
  const expirations = ['2026-07-22', '2026-08-21', '2026-07-23', '2026-06-30', '2026-07-27'];
  const ordered = [...expirations].sort((a, b) => membershipRules.compareMembershipUrgency(a, b, reference));

  assert.deepEqual(ordered, [
    '2026-07-23',
    '2026-07-27',
    '2026-08-21',
    '2026-07-22',
    '2026-06-30',
  ]);
});
