const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const sqlite3 = require('sqlite3');
const { validateTarget, validateCopy } = require('./import-rehearsal');
const { deterministicUuid } = require('./importLegacyMasters');
const container = 'underfit-rehearsal-postgres-1';
function docker(args) {
  const result = spawnSync('docker', args, { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error(result.stderr || 'Docker verification failed');
  return result.stdout.trim();
}
async function main() {
  const source = process.argv[2];
  if (!source) throw new Error('Provide the verified rehearsal copy.');
  const manifest = JSON.parse(fs.readFileSync(source.replace(/\.db$/i, '.manifest.json'), 'utf8'));
  validateCopy(source, manifest);
  validateTarget(JSON.parse(docker(['inspect', container]))[0]);
  const db = new sqlite3.Database(source, sqlite3.OPEN_READONLY);
  let rows;
  try {
    rows = await new Promise((resolve, reject) => db.all('SELECT id, caja_sesion_id, monto FROM caja_movimientos ORDER BY id', (error, data) => error ? reject(error) : resolve(data)));
  } finally { await new Promise(resolve => db.close(resolve)); }
  const query = `SELECT COALESCE(json_agg(t), '[]') FROM (SELECT m."SourceId" AS source_id, c."Amount" AS amount, c."CashSessionId" AS session_id, c."IsLegacyUnassigned" AS legacy FROM cash_movements c JOIN legacy_import_map m ON m."TargetKey" = c."Id"::text AND m."SourceTable" = 'caja_movimientos') t;`;
  const actual = JSON.parse(docker(['exec', container, 'psql', '-U', 'underfit', '-d', 'underfit', '-At', '-c', query]));
  if (actual.length !== rows.length) throw new Error('Movement count differs.');
  let cents = 0, unassignedCents = 0;
  for (const row of rows) {
    const target = actual.find(item => item.source_id === String(row.id));
    const expectedSession = row.caja_sesion_id == null ? null : deterministicUuid('underfit-cash-session', row.caja_sesion_id);
    const amount = Math.round(Number(row.monto) * 100);
    if (!target || Math.round(Number(target.amount) * 100) !== amount || target.session_id !== expectedSession || target.legacy !== (row.caja_sesion_id == null)) {
      throw new Error(`Cash reconciliation failed for legacy record ${row.id}.`);
    }
    cents += amount;
    if (row.caja_sesion_id == null) unassignedCents += amount;
  }
  validateCopy(source, manifest);
  console.log(JSON.stringify({ verified: true, movements: rows.length, total: cents / 100, unassigned: rows.filter(r => r.caja_sesion_id == null).length, unassignedTotal: unassignedCents / 100, sourceUnchanged: true }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
