const fs = require('node:fs');
const path = require('node:path');

function resolveInstallation({ role, apiBaseUrl, allowLoopbackClient = false }) {
  if (!['host', 'client'].includes(role)) throw new Error('El tipo de instalación debe ser host o client.');
  let url;
  try { url = new URL(apiBaseUrl); } catch { throw new Error('La dirección del servidor no es válida.'); }
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('La dirección del servidor debe contener solo protocolo, nombre y puerto.');
  }
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if (role === 'host' && (!local || url.protocol !== 'http:')) {
    throw new Error('La PC principal debe usar una API HTTP en loopback.');
  }
  if (role === 'client' && url.protocol !== 'https:' && !(allowLoopbackClient && local && url.protocol === 'http:')) {
    throw new Error('Una PC adicional requiere una dirección HTTPS del gimnasio.');
  }
  return { role, apiBaseUrl: url.origin };
}

function loadInstallationEnvironment({ userDataPath, isPackaged, env = process.env }) {
  const file = path.join(userDataPath, 'platform', 'installation.json');
  if (!fs.existsSync(file)) {
    if (isPackaged) throw new Error('Falta configurar esta instalación. Ejecutá la preparación de la PC principal o vinculá esta PC al gimnasio.');
    return;
  }
  const config = resolveInstallation({ ...JSON.parse(fs.readFileSync(file, 'utf8')), allowLoopbackClient: !isPackaged });
  env.UNDERFIT_INSTALLATION_ROLE = config.role;
  env.UNDERFIT_API_BASE_URL = config.apiBaseUrl;
  env.UNDERFIT_DATA_MODE = 'api';
}

module.exports = { resolveInstallation, loadInstallationEnvironment };
