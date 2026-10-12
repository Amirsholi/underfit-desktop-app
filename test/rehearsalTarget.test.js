const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateTarget } = require('../scripts/import-rehearsal');
const { validateHistorySessions, buildHistoryImportSql } = require('../scripts/importLegacyMasters');
const target = () => ({
  Name: '/underfit-rehearsal-postgres-1',
  Config: { Labels: { 'com.docker.compose.project': 'underfit-rehearsal', 'com.docker.compose.service': 'postgres' } },
  Mounts: [{ Name: 'underfit-rehearsal_rehearsal-postgres', Destination: '/var/lib/postgresql' }],
});
test('missing historical sessions remain unassigned; dangling references are rejected', () => {
  const data = { cashSessions: [{ id: 1 }], cashMovements: [{ caja_sesion_id: 1 }] };
  assert.doesNotThrow(() => validateHistorySessions(data));
  for (const caja_sesion_id of [null, undefined]) {
    assert.doesNotThrow(() => validateHistorySessions({ ...data, cashMovements: [{ caja_sesion_id }] }));
  }
  for (const caja_sesion_id of [999]) {
    assert.throws(() => validateHistorySessions({ ...data, cashMovements: [{ caja_sesion_id }] }), /1 movimientos sin sesión/);
  }
});
test('unassigned historical movement preserves NULL session and explicit legacy marker', () => {
  const sql = buildHistoryImportSql({ cashSessions: [], cashMovements: [{ id: 1, caja_sesion_id: null, monto: 95, tipo_ingreso: 'venta_producto' }], renewals: [], entries: [] });
  assert.match(sql, /'[^']+',NULL,NULL,/);
  assert.match(sql, /NULL,TRUE\s*\)/);
  assert.match(sql, /"IsLegacyUnassigned"/);
});
test('anonymous product sales retain empty member labels, not SQL NULL', () => {
  const sql = buildHistoryImportSql({ cashSessions: [], cashMovements: [{ id: 1, caja_sesion_id: 1, monto: 95, tipo_ingreso: 'venta_producto' }], renewals: [], entries: [] });
  assert.match(sql, /NULL,\s*'','',/);
});
test('accepts only the isolated rehearsal container and volume', () => {
  assert.doesNotThrow(() => validateTarget(target()));
  for (const change of [
    t => { t.Name = '/underfit-postgres-1'; },
    t => { t.Config.Labels['com.docker.compose.project'] = 'underfit'; },
    t => { t.Mounts[0].Name = 'underfit_underfit-postgres'; },
    t => { t.Mounts = []; },
  ]) {
    const t = target(); change(t);
    assert.throws(() => validateTarget(t), /Destino rechazado/);
  }
});
