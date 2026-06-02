// config.js
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

function readJsonSafe(p) {
  try {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_) {}
  return null;
}

function findConfigJson() {
  // 1) Carpeta del ejecutable (build instalado)
  try {
    const execDir = path.dirname(process.execPath);
    const p = path.join(execDir, 'config.json');
    if (fs.existsSync(p)) return p;
  } catch (_) {}

  // 2) resourcesPath (dentro de app.asar / carpeta resources)
  try {
    const p = path.join(process.resourcesPath || '', 'config.json');
    if (p && fs.existsSync(p)) return p;
  } catch (_) {}

  // 3) directorio de la app (dev)
  try {
    const appDir = app?.getAppPath?.() || process.cwd();
    const p = path.join(appDir, 'config.json');
    if (fs.existsSync(p)) return p;
  } catch (_) {}

  // 4) cwd por si acaso
  const p4 = path.join(process.cwd(), 'config.json');
  if (fs.existsSync(p4)) return p4;

  return null;
}

function getDbPathFromConfigOrDefault() {
  // Intentar leer config.json
  const cfgPath = findConfigJson();
  if (cfgPath) {
    const cfg = readJsonSafe(cfgPath);
    if (cfg?.db_path) {
      // Normalizar y asegurar carpeta
      const dbPath = cfg.db_path;
      const dir = path.dirname(dbPath);
      fs.mkdirSync(dir, { recursive: true });
      return dbPath;
    }
  }

  // Default: C:\Users\<usuario>\GymAppData\gym.db
  const home = app.getPath('home'); // robusto en win/mac/linux
  const baseDir = path.join(home, 'GymAppData');
  fs.mkdirSync(baseDir, { recursive: true });
  return path.join(baseDir, 'gym.db');
}

module.exports = { getDbPathFromConfigOrDefault };