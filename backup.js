const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { findDockerExecutable } = require('./services/dockerRuntime');

function pad(value) {
  return String(value).padStart(2, '0');
}

function getWeekKey(date = new Date()) {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((utcDate - yearStart) / 86400000) + 1) / 7);
  return `${utcDate.getUTCFullYear()}-W${pad(weekNo)}`;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyIfExists(sourcePath, targetPath) {
  if (!fs.existsSync(sourcePath)) return false;
  fs.copyFileSync(sourcePath, targetPath);
  return true;
}

function pruneOldBackups(backupDir, keepCount = 12) {
  const files = fs.readdirSync(backupDir)
    .filter(name => name.startsWith('gym-') && !name.endsWith('-media'))
    .map(name => {
      const fullPath = path.join(backupDir, name);
      return {
        name,
        fullPath,
        mtimeMs: fs.statSync(fullPath).mtimeMs,
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  files.slice(keepCount).forEach(file => {
    fs.rmSync(file.fullPath, { force: true });
    const mediaPath = path.join(
      backupDir,
      `${path.basename(file.name, path.extname(file.name))}-media`
    );
    fs.rmSync(mediaPath, { recursive: true, force: true });
  });
}

function getBackupDirectory(dbPath) {
  return path.join(path.dirname(dbPath), 'backups');
}

function createPostgresDump({ dbPath, prefix }) {
  const backupDir = getBackupDirectory(dbPath);
  ensureDir(backupDir);
  const composeFile = process.env.UNDERFIT_COMPOSE_FILE
    || path.join(__dirname, 'infrastructure', 'compose', 'compose.yaml');
  const result = spawnSync(
    findDockerExecutable(),
    [
      'compose', '-f', composeFile, 'exec', '-T', 'postgres',
      'pg_dump', '-U', 'underfit', '-d', 'underfit', '--format=custom',
    ],
    { encoding: null, maxBuffer: 1024 * 1024 * 256, windowsHide: true }
  );
  if (result.error || result.status !== 0) {
    const detail = result.stderr ? result.stderr.toString('utf8').trim() : result.error?.message;
    return { created: false, reason: 'postgres_dump_failed', detail: detail || null };
  }
  const targetPath = path.join(backupDir, `${prefix}.dump`);
  fs.writeFileSync(targetPath, result.stdout);
  const sourceMediaPath = process.env.UNDERFIT_MEDIA_PATH;
  const mediaPath = path.join(backupDir, `${prefix}-media`);
  if (sourceMediaPath && fs.existsSync(sourceMediaPath)) {
    fs.cpSync(sourceMediaPath, mediaPath, { recursive: true, force: true });
  }
  pruneOldBackups(backupDir);
  return {
    created: true,
    path: targetPath,
    mediaPath: fs.existsSync(mediaPath) ? mediaPath : null,
    format: 'postgres-custom',
  };
}

function createManualPostgresBackup(dbPath) {
  const now = new Date();
  const timestamp = [
    now.getFullYear(), pad(now.getMonth() + 1), pad(now.getDate()), '-',
    pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds()),
  ].join('');
  return createPostgresDump({ dbPath, prefix: `gym-manual-${timestamp}` });
}

function ensureWeeklyPostgresBackup(dbPath) {
  const backupDir = getBackupDirectory(dbPath);
  ensureDir(backupDir);
  const targetPath = path.join(backupDir, `gym-${getWeekKey()}.dump`);
  if (fs.existsSync(targetPath)) {
    return { created: false, reason: 'already_exists', path: targetPath };
  }
  return createPostgresDump({
    dbPath,
    prefix: path.basename(targetPath, '.dump'),
  });
}

function ensureDailyPostgresBackup(dbPath, date = new Date()) {
  const backupDir = getBackupDirectory(dbPath);
  ensureDir(backupDir);
  const dateKey = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const targetPath = path.join(backupDir, `gym-daily-${dateKey}.dump`);
  if (fs.existsSync(targetPath)) {
    return { created: false, reason: 'already_exists', path: targetPath };
  }
  return createPostgresDump({
    dbPath,
    prefix: path.basename(targetPath, '.dump'),
  });
}

function createManualBackup(dbPath) {
  if (!dbPath || !fs.existsSync(dbPath)) {
    return { created: false, reason: 'db_missing' };
  }

  const backupDir = getBackupDirectory(dbPath);
  ensureDir(backupDir);

  const now = new Date();
  const timestamp = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '-',
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('');

  const dbExt = path.extname(dbPath) || '.db';
  const backupBase = path.join(backupDir, `gym-manual-${timestamp}`);
  const backupDbPath = `${backupBase}${dbExt}`;

  fs.copyFileSync(dbPath, backupDbPath);
  copyIfExists(`${dbPath}-wal`, `${backupDbPath}-wal`);
  copyIfExists(`${dbPath}-shm`, `${backupDbPath}-shm`);
  pruneOldBackups(backupDir);

  return { created: true, path: backupDbPath };
}

function ensureWeeklyBackup(dbPath) {
  if (!dbPath || !fs.existsSync(dbPath)) {
    return { created: false, reason: 'db_missing' };
  }

  const backupDir = getBackupDirectory(dbPath);
  ensureDir(backupDir);

  const weekKey = getWeekKey();
  const dbExt = path.extname(dbPath) || '.db';
  const backupBase = path.join(backupDir, `gym-${weekKey}`);
  const backupDbPath = `${backupBase}${dbExt}`;

  if (fs.existsSync(backupDbPath)) {
    return { created: false, reason: 'already_exists', path: backupDbPath };
  }

  fs.copyFileSync(dbPath, backupDbPath);
  copyIfExists(`${dbPath}-wal`, `${backupDbPath}-wal`);
  copyIfExists(`${dbPath}-shm`, `${backupDbPath}-shm`);
  pruneOldBackups(backupDir);

  return { created: true, path: backupDbPath };
}

module.exports = {
  ensureWeeklyBackup,
  createManualBackup,
  getBackupDirectory,
  createManualPostgresBackup,
  ensureWeeklyPostgresBackup,
  ensureDailyPostgresBackup,
};
