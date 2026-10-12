const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { validateTarget } = require('./import-rehearsal');

const container = 'underfit-rehearsal-postgres-1';
const source = process.argv[2] || 'underfit_tablet_test';
if (source !== 'underfit_tablet_test' && !/^underfit_migration_check_\d+$/.test(source)) {
  throw new Error('Solo se permite restaurar bases aisladas de ensayo.');
}
const target = `underfit_restore_check_${Date.now()}`;
const directory = path.join(process.env.LOCALAPPDATA, 'UnderFitRehearsal', 'restore-checks', target);
const docker = path.join(process.env.LOCALAPPDATA, 'Programs/DockerDesktop/resources/bin/docker.exe');
function run(args, input) {
  const result = spawnSync(docker, args, { input, encoding: null, windowsHide: true, maxBuffer: 256 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr?.toString().trim() || 'Docker falló.');
  return result.stdout;
}
function exec(args, input) { return run(['exec', '-i', container, ...args], input); }
function query(database, sql) {
  return exec(['psql', '-X', '-U', 'underfit', '-d', database, '-v', 'ON_ERROR_STOP=1', '-tAc', sql]).toString().trim();
}
function inventory(database) {
  const names = query(database, "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;").split('\n').filter(Boolean);
  if (!names.includes('__EFMigrationsHistory')) throw new Error('La base no tiene el esquema esperado.');
  return names.map(name => {
    const identifier = `"${name.replaceAll('"', '""')}"`;
    const [count, digest] = query(database, `SELECT count(*) || '|' || md5(COALESCE(string_agg(row_to_json(t)::text, E'\\n' ORDER BY row_to_json(t)::text), '')) FROM public.${identifier} t;`).split('|');
    return { table: name, rows: Number(count), digest };
  });
}

let created = false;
try {
  assert.match(target, /^underfit_restore_check_\d+$/);
  const inspected = JSON.parse(run(['inspect', container]).toString())[0];
  validateTarget(inspected);
  if (!inspected.State.Running) throw new Error('Iniciá el contenedor de ensayo antes de verificar el respaldo.');
  fs.mkdirSync(directory, { recursive: true });
  const before = inventory(source);
  const backup = exec(['pg_dump', '-U', 'underfit', '-d', source, '--format=custom']);
  const backupPath = path.join(directory, 'rehearsal.dump');
  fs.writeFileSync(backupPath, backup, { flag: 'wx' });
  exec(['createdb', '-U', 'underfit', target]); created = true;
  exec(['pg_restore', '-U', 'underfit', '-d', target, '--exit-on-error', '--no-owner', '--no-privileges'], backup);
  const restored = inventory(target);
  const after = inventory(source);
  assert.deepEqual(after, before, 'El ensayo cambió durante la verificación. Repetí sin realizar operaciones.');
  assert.deepEqual(restored, before, 'Los registros restaurados difieren del origen.');
  const report = { verified: true, scope: 'rehearsal-database-only', verifiedAtUtc: new Date().toISOString(),
    source, backupPath, sha256: crypto.createHash('sha256').update(backup).digest('hex'),
    tables: restored, mediaVerified: false };
  fs.writeFileSync(path.join(directory, 'verification.json'), JSON.stringify(report, null, 2), { flag: 'wx' });
  console.log(`PASS: ${restored.length} tablas y ${restored.reduce((sum, row) => sum + row.rows, 0)} registros restaurados idénticos. Base de ensayo sin modificar.`);
  console.log(`Respaldo e informe: ${directory}`);
  console.log('Esta prueba valida la base indicada; no valida archivos multimedia ni la instalación en la PC del gimnasio.');
} catch (error) {
  console.error(error.message); process.exitCode = 1;
} finally {
  if (created) {
    assert.match(target, /^underfit_restore_check_\d+$/);
    exec(['dropdb', '-U', 'underfit', target]);
  }
}
