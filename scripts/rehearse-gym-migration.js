const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { validateTarget, validateCopy } = require('./import-rehearsal');
const imports = require('./importLegacyMasters');
const { importLegacyTraining } = require('./importLegacyTraining');

async function main() {
  const source = path.resolve(process.argv[2] || '');
  const manifest = JSON.parse(fs.readFileSync(source.replace(/\.db$/i, '.manifest.json'), 'utf8'));
  validateCopy(source, manifest);
  const container = 'underfit-rehearsal-postgres-1';
  const database = `underfit_migration_check_${Date.now()}`;
  const dockerDir = path.join(process.env.LOCALAPPDATA, 'Programs/DockerDesktop/resources/bin');
  const docker = path.join(dockerDir, 'docker.exe');
  function run(args, input) {
    const r = spawnSync(docker, args, { input, windowsHide: true, maxBuffer: 256 * 1024 * 1024 });
    if (r.error || r.status !== 0) throw new Error(r.error?.message || r.stderr.toString());
    return r.stdout;
  }
  function exec(args, input) { return run(['exec', '-i', container, ...args], input); }
  function query(db, sql) {
    return exec(['psql', '-X', '-U', 'underfit', '-d', db, '-v', 'ON_ERROR_STOP=1', '-tAc', sql]).toString().trim();
  }
  validateTarget(JSON.parse(run(['inspect', container]))[0]);
  const stages = [imports.importLegacyMasters, imports.importLegacyHistory, imports.importLegacyClasses,
    imports.importLegacyCommercial, importLegacyTraining];
  for (const stage of stages) await stage(source, { apply: false });
  // Copy structure only: no fictional members, classes, credentials or payments.
  const schema = exec(['pg_dump', '-U', 'underfit', '-d', 'underfit_tablet_test', '--schema-only', '--no-owner', '--no-privileges']);
  exec(['createdb', '-U', 'underfit', database]);
  const reportPath = path.join(path.dirname(source), `${database}.json`);
  const report = { database, source, schemaSource: 'underfit_tablet_test', verified: false, stages: [] };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), { flag: 'wx' });
  try {
    exec(['psql', '-X', '-U', 'underfit', '-d', database, '-v', 'ON_ERROR_STOP=1'], schema);
    const history = query('underfit_tablet_test', 'SELECT COALESCE(json_agg(t),\'[]\') FROM "__EFMigrationsHistory" t');
    query(database, `INSERT INTO "__EFMigrationsHistory" SELECT * FROM json_populate_recordset(NULL::"__EFMigrationsHistory", '${history.replaceAll("'", "''")}');`);
    process.env.PATH = `${dockerDir}${path.delimiter}${process.env.PATH}`;
    process.env.UNDERFIT_POSTGRES_CONTAINER = container;
    process.env.UNDERFIT_IMPORT_DATABASE = database;
    for (const stage of stages) {
      report.stages.push(await stage(source, { apply: true }));
      console.log(`${stage.name}: importado`);
    }
    const mapping = { usuarios: 'members', productos: 'products', caja_sesiones: 'cash_sessions',
      caja_movimientos: 'cash_movements', pagos_membresia: 'membership_renewals', ingresos: 'entries', ventas_productos: 'product_sales' };
    report.counts = {};
    for (const [old, current] of Object.entries(mapping)) {
      const filter = old === 'productos' ? ` WHERE "Id"::text IN (SELECT "TargetKey" FROM legacy_import_map WHERE "SourceTable"='productos')` : '';
      const actual = Number(query(database, `SELECT count(*) FROM ${current}${filter}`));
      const expected = manifest.tables[old]?.rows || 0;
      assert.equal(actual, expected, `Cantidad diferente: ${old}`);
      report.counts[old] = { expected, actual };
    }
    report.historicalProducts = Number(query(database, `SELECT count(*) FROM products WHERE "Id"::text NOT IN (SELECT "TargetKey" FROM legacy_import_map WHERE "SourceTable"='productos') AND NOT "IsActive"`));
    report.dataChecks = await require('./verify-migrated-data').verifyMigratedData(source, sql => query(database, sql));
    // Re-import the same snapshot: IDs must remain stable and records must not duplicate.
    function fingerprints() {
      return Object.values(mapping).map(table => query(database,
        `SELECT md5(COALESCE(string_agg(row_to_json(t)::text, E'\\n' ORDER BY row_to_json(t)::text), '')) FROM ${table} t`));
    }
    const before = fingerprints();
    for (const stage of stages) await stage(source, { apply: true });
    assert.deepEqual(fingerprints(), before, 'Repetir la importación cambió los registros.');
    validateCopy(source, manifest);
    report.repeatImportVerified = true;
    report.verified = true;
    report.completedAtUtc = new Date().toISOString();
    console.log(`PASS: cantidades y repetición verificadas. ${reportPath}`);
  } finally {
    // Retain this isolated database for inspection, including failed attempts.
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  }
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
