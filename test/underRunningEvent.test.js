const test = require('node:test');
const assert = require('node:assert/strict');

const { buildConfig, isActive } = require('../underRunningEvent');

test('Under Running follows the enabled switch even when the configured date has passed', () => {
  const config = buildConfig({
    eventoRunningActivo: true,
    eventoRunningFecha: '2026-05-24',
  });

  assert.equal(isActive(config, new Date('2026-07-22T12:00:00')), true);
});

test('Under Running stays hidden when its switch is disabled', () => {
  const config = buildConfig({
    eventoRunningActivo: false,
    eventoRunningFecha: '2027-05-24',
  });

  assert.equal(isActive(config, new Date('2026-07-22T12:00:00')), false);
});
