const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// Kept alongside the host's existing private keys, outside the application bundle.
function ensureTabletAccess(userDataPath) {
  const directory = path.join(userDataPath, 'platform');
  const file = path.join(directory, 'tablet-devices.key');
  fs.mkdirSync(directory, { recursive: true });
  if (!fs.existsSync(file)) {
    const TabletDevices = Object.fromEntries(['tablet1', 'tablet2'].map(id => [id, crypto.randomBytes(48).toString('base64url')]));
    fs.writeFileSync(file, JSON.stringify({ Authentication: { TabletDevices } }, null, 2), { flag: 'wx', mode: 0o600 });
  }
  const devices = JSON.parse(fs.readFileSync(file, 'utf8')).Authentication?.TabletDevices;
  if (!devices || !Object.keys(devices).length || Object.entries(devices).some(([id, key]) =>
    !/^[a-zA-Z0-9_-]{1,32}$/.test(id) || typeof key !== 'string' || !/^[a-zA-Z0-9_-]{48,}$/.test(key))) {
    throw new Error('La configuración de las tablets no es válida. Revisá las claves de vinculación del servidor.');
  }
  return file;
}

module.exports = { ensureTabletAccess };
