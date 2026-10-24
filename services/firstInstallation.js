const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const sqlite3 = require('sqlite3');
const { inspectLegacyDatabase } = require('./legacyMigration/inspectLegacyDatabase');
const imports = require('./legacyMigration/importLegacyMasters');
const { verifyMigratedData } = require('./legacyMigration/verify-migrated-data');
const { findDockerExecutable } = require('./dockerRuntime');

const counts = { usuarios: 'members', productos: 'products', caja_sesiones: 'cash_sessions',
  caja_movimientos: 'cash_movements', pagos_membresia: 'membership_renewals',
  ingresos: 'entries', ventas_productos: 'product_sales' };
const statePath = root => path.join(root, 'platform', 'first-installation.json');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function save(file, value) {
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(value, null, 2));
  fs.renameSync(`${file}.tmp`, file);
}
function readState(root) {
  const file = statePath(root);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

async function snapshot(source, destination) {
  // SQLite itself creates a consistent snapshot, including committed WAL data.
  // The original is opened read-only and is never upgraded or removed.
  const db = new sqlite3.Database(source, sqlite3.OPEN_READONLY);
  try {
    await new Promise((resolve, reject) => db.run(
      `VACUUM INTO '${destination.replaceAll("'", "''")}'`, error => error ? reject(error) : resolve()));
  } finally { await new Promise(resolve => db.close(resolve)); }
}

async function inspectSource(source) {
  const inspection = await inspectLegacyDatabase(source);
  if (!inspection.canImport || Object.keys(counts).some(table => inspection.counts[table] == null))
    throw new Error('La base no corresponde a la versión anterior compatible o contiene errores. No se importaron datos.');
  // The gym's main release has no training/classes. Do not silently drop data
  // from newer, custom installations that need a separate media/PIN migration.
  const unsupported = ['clases', 'profesores', 'programaciones_clase', 'ventas_pendientes'];
  if (unsupported.some(table => inspection.counts[table] > 0))
    throw new Error('Esta base contiene clases, profesores o entregas pendientes. Requiere la migración asistida completa.');
  const db = new sqlite3.Database(source, sqlite3.OPEN_READONLY);
  try {
    const rows = await new Promise((resolve, reject) => db.all(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('ejercicios','plantillas_rutina','rutinas_socios')",
      (error, result) => error ? reject(error) : resolve(result)));
    for (const { name } of rows) {
      const row = await new Promise((resolve, reject) => db.get(`SELECT count(*) n FROM "${name}"`,
        (error, result) => error ? reject(error) : resolve(result)));
      if (row.n) throw new Error('Esta base contiene ejercicios o rutinas. Requiere migración asistida de sus archivos.');
    }
    const integrity = await new Promise((resolve, reject) => db.get('PRAGMA integrity_check',
      (error, result) => error ? reject(error) : resolve(result)));
    if (integrity.integrity_check !== 'ok') throw new Error('La copia SQLite no pasó la comprobación de integridad.');
  } finally { await new Promise(resolve => db.close(resolve)); }
  return inspection;
}

async function prepareFirstInstallation({ userDataPath, resourcesPath, legacyPath, dialog }) {
  if (fs.existsSync(path.join(userDataPath, 'platform', 'installation.json'))) return true;
  const choice = await dialog.showMessageBox({ type: 'question', title: 'Preparar Under-Fit',
    message: '¿Esta es la PC principal del gimnasio?',
    detail: 'Se preparará el servidor y se importarán los datos de la versión anterior. Cerrá el programa anterior antes de continuar. Para una PC adicional, usá la vinculación al servidor existente.',
    buttons: ['Preparar PC del gimnasio', 'Cancelar'], defaultId: 0, cancelId: 1 });
  if (choice.response !== 0) return false;
  let source = fs.existsSync(legacyPath) ? legacyPath : null;
  const selection = await dialog.showMessageBox({ type: 'question', title: 'Datos del gimnasio',
    message: source ? 'Se encontró la base anterior.' : 'No se encontró la base anterior.',
    detail: source ? `${source}\nSe guardará una copia antes de importar. Confirmá que cerraste la versión anterior.`
      : 'Seleccioná la base del gimnasio. Elegí empezar sin datos solamente para una instalación nueva.',
    buttons: source ? ['Respaldar e importar esta base', 'Elegir otra base', 'Cancelar']
      : ['Elegir base SQLite', 'Empezar sin datos', 'Cancelar'], defaultId: 0, cancelId: 2 });
  if (selection.response === 2) return false;
  const chooseFile = source ? selection.response === 1 : selection.response === 0;
  if (chooseFile) {
    const selected = await dialog.showOpenDialog({ title: 'Base SQLite del gimnasio', properties: ['openFile'],
      filters: [{ name: 'Base SQLite', extensions: ['db', 'sqlite', 'sqlite3'] }] });
    if (selected.canceled) return false;
    source = selected.filePaths[0];
  }
  const directory = path.join(userDataPath, 'platform');
  fs.mkdirSync(directory, { recursive: true });
  save(statePath(userDataPath), { status: 'pending', source, startedAt: new Date().toISOString() });
  // Use the packaged configuration script, including its Windows ACL protection.
  const configured = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
    path.join(resourcesPath, 'installation', 'configure-installation.ps1'), '-Role', 'host',
    '-UserDataPath', userDataPath], { windowsHide: true, encoding: 'utf8' });
  if (configured.error || configured.status !== 0) throw new Error('No se pudo preparar la configuración del servidor.');
  // Persist pending status before any subsequent work. Failure must never open
  // an empty desktop as if migration had succeeded.
  return true;
}

function productionQuery(resourcesPath) {
  const docker = findDockerExecutable();
  const compose = path.join(resourcesPath, 'platform', 'compose.yaml');
  return sql => {
    const result = spawnSync(docker, ['compose', '-f', compose, 'exec', '-T', 'postgres',
      'psql', '-X', '-U', 'underfit', '-d', 'underfit', '-v', 'ON_ERROR_STOP=1', '-qAt'],
    { input: sql, encoding: 'utf8', windowsHide: true, maxBuffer: 128 * 1024 * 1024 });
    if (result.error || result.status !== 0)
      throw new Error('No se pudo completar la importación en PostgreSQL. La base original y su respaldo se conservan.');
    return result.stdout.trim();
  };
}

function transactionBody(sql) {
  if (!sql.startsWith('BEGIN;') || !sql.trimEnd().endsWith('COMMIT;')) throw new Error('Formato de migración inesperado.');
  return sql.slice(6).trimEnd().slice(0, -7);
}

async function completeFirstInstallation({ userDataPath, resourcesPath, query = productionQuery(resourcesPath), onProgress = async () => {} }) {
  const state = readState(userDataPath);
  if (!state || state.status === 'complete') return;
  if (!['pending', 'imported'].includes(state.status)) throw new Error('Estado de instalación desconocido.');
  query('CREATE TABLE IF NOT EXISTS underfit_initial_import (id integer PRIMARY KEY CHECK(id=1), fingerprint text NOT NULL);');
  if (state.source && !state.backup) {
    await onProgress('Guardando y comprobando una copia de la base anterior…');
    const backupDir = path.join(userDataPath, 'platform', 'migration-backups', crypto.randomUUID());
    fs.mkdirSync(backupDir, { recursive: true });
    const backup = path.join(backupDir, 'gym.db');
    await snapshot(state.source, backup);
    await inspectSource(backup);
    state.backup = backup;
    state.fingerprint = hash(backup);
    save(statePath(userDataPath), state);
  }
  if (state.backup && (!/^[a-f0-9]{64}$/.test(state.fingerprint || '') || hash(state.backup) !== state.fingerprint))
    throw new Error('El respaldo de migración cambió. Se detuvo la instalación.');
  const marker = query('SELECT fingerprint FROM underfit_initial_import WHERE id=1');
  const fingerprint = state.fingerprint || 'empty-installation';
  if (marker && marker !== fingerprint) throw new Error('Este servidor ya recibió otra base. No se sobrescribieron datos.');
  if (!marker) {
    await onProgress('Importando los datos del gimnasio…');
    const occupied = query(`SELECT ${Object.values(counts).map(table => `(SELECT count(*) FROM ${table})`).join('+')}`);
    if (Number(occupied) !== 0) throw new Error('El servidor ya contiene datos. Se requiere revisar la migración antes de continuar.');
    let sql = '';
    if (state.backup) {
      const masters = await imports.readMasters(state.backup);
      const history = await imports.readHistory(state.backup);
      imports.validateHistorySessions(history);
      const commercial = await imports.readCommercial(state.backup);
      sql = [imports.buildImportSql(masters), imports.buildHistoryImportSql(history),
        imports.buildCommercialImportSql(commercial)].map(transactionBody).join('\n');
    }
    // One transaction, including the receipt. Interrupted imports can retry;
    // a committed import is verified without replaying stale membership data.
    query(`BEGIN;\n${sql}\nINSERT INTO underfit_initial_import VALUES (1,'${fingerprint}');\nCOMMIT;`);
    state.status = 'imported';
    save(statePath(userDataPath), state);
  }
  if (state.backup) {
    await onProgress('Verificando socios, vencimientos, caja, pagos e historial…');
    const inspection = await inspectSource(state.backup);
    for (const [old, current] of Object.entries(counts)) {
      const filter = old === 'productos' ? ` WHERE "Id"::text IN (SELECT "TargetKey" FROM legacy_import_map WHERE "SourceTable"='productos')` : '';
      if (Number(query(`SELECT count(*) FROM ${current}${filter}`)) !== inspection.counts[old])
        throw new Error(`La verificación de ${old} no coincide. La atención permanece bloqueada.`);
    }
    state.checks = await verifyMigratedData(state.backup, query);
    state.counts = inspection.counts;
  }
  state.status = 'complete';
  state.completedAt = new Date().toISOString();
  save(statePath(userDataPath), state);
}

function runFirstInstallation({ userDataPath, resourcesPath, onProgress = async () => {} }) {
  const { Worker } = require('node:worker_threads');
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'firstInstallationWorker.js'), {
      workerData: { userDataPath, resourcesPath },
    });
    let finished = false;
    worker.on('message', message => {
      if (message.progress) Promise.resolve(onProgress(message.progress)).catch(reject);
      if (message.error) { finished = true; reject(new Error(message.error)); }
      if (message.complete) { finished = true; resolve(); }
    });
    worker.once('error', reject);
    worker.once('exit', () => { if (!finished) reject(new Error('La preparación se interrumpió. Volvé a abrir Under-Fit para reintentar.')); });
  });
}

module.exports = { prepareFirstInstallation, completeFirstInstallation, runFirstInstallation, readState, snapshot, inspectSource, transactionBody };
