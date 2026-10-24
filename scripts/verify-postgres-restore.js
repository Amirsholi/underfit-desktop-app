const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { createManualPostgresBackup } = require('../backup');

const workspace = path.resolve(__dirname, '..');
const composeFile = process.env.UNDERFIT_COMPOSE_FILE
  || path.join(workspace, 'infrastructure', 'compose', 'compose.yaml');
const scratchDbPath = path.join(workspace, 'tmp', 'restore-verification', 'gym.db');
const verificationDatabase = `underfit_restore_check_${Date.now()}`;

if (!/^underfit_restore_check_\d+$/.test(verificationDatabase)) {
  throw new Error('Nombre de base temporal inválido.');
}

process.env.UNDERFIT_COMPOSE_FILE = composeFile;
process.env.UNDERFIT_MEDIA_PATH = process.env.UNDERFIT_MEDIA_PATH
  || path.join(
    process.env.LOCALAPPDATA || path.join(workspace, 'tmp'),
    'UnderFit',
    'media',
    'exercises'
  );
fs.mkdirSync(path.dirname(scratchDbPath), { recursive: true });

function composeExec(args, options = {}) {
  const result = spawnSync(
    'docker',
    ['compose', '-f', composeFile, 'exec', '-T', 'postgres', ...args],
    { encoding: 'utf8', windowsHide: true, ...options }
  );
  if (result.error || result.status !== 0) {
    throw new Error(
      result.stderr?.trim() || result.error?.message || `Falló ${args[0]}.`
    );
  }
  return Buffer.isBuffer(result.stdout)
    ? result.stdout.toString('utf8').trim()
    : result.stdout.trim();
}

let databaseCreated = false;
try {
  const backup = createManualPostgresBackup(scratchDbPath);
  if (!backup.created) {
    throw new Error(backup.detail || 'No se pudo crear el respaldo de verificación.');
  }

  composeExec(['createdb', '-U', 'underfit', verificationDatabase]);
  databaseCreated = true;

  const dump = fs.readFileSync(backup.path);
  composeExec(
    [
      'pg_restore',
      '-U', 'underfit',
      '-d', verificationDatabase,
      '--no-owner',
      '--no-privileges',
    ],
    { input: dump, encoding: null, maxBuffer: 1024 * 1024 * 256 }
  );

  const tableCount = Number(composeExec([
    'psql', '-U', 'underfit', '-d', verificationDatabase,
    '-tAc',
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';",
  ]));
  const migrationCount = Number(composeExec([
    'psql', '-U', 'underfit', '-d', verificationDatabase,
    '-tAc',
    'SELECT count(*) FROM "__EFMigrationsHistory";',
  ]));
  if (!Number.isInteger(tableCount) || tableCount < 1 || migrationCount < 1) {
    throw new Error('La copia restauró sin la estructura esperada.');
  }

  console.log(JSON.stringify({
    verified: true,
    backupPath: backup.path,
    mediaPath: backup.mediaPath,
    restoredTables: tableCount,
    restoredMigrations: migrationCount,
  }, null, 2));
} finally {
  if (databaseCreated) {
    composeExec(['dropdb', '-U', 'underfit', '--if-exists', verificationDatabase]);
  }
}
