const fs = require('fs');
const path = require('path');

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
    .filter(name => name.startsWith('gym-'))
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
  });
}

function getBackupDirectory(dbPath) {
  return path.join(path.dirname(dbPath), 'backups');
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
};
