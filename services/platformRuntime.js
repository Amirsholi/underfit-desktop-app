const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn, execFile } = require('child_process');
const net = require('net');
const { resolveInstallation } = require('./installationConfig');
const { ensureTabletAccess } = require('./tabletAccess');
const { ensureDockerReady } = require('./dockerRuntime');

let apiProcess = null;
let tunnelProcess = null;
let tunnelRestartTimer = null;
let stopping = false;

function jwtKey(options) {
  if (process.env.UNDERFIT_JWT_KEY) return process.env.UNDERFIT_JWT_KEY;
  if (!options.isPackaged) return 'underfit-development-only-jwt-key-change-me';
  const directory = path.join(options.userDataPath, 'platform');
  const keyPath = path.join(directory, 'jwt.key');
  fs.mkdirSync(directory, { recursive: true });
  if (fs.existsSync(keyPath)) return fs.readFileSync(keyPath, 'utf8').trim();
  const key = crypto.randomBytes(48).toString('base64url');
  fs.writeFileSync(keyPath, key, { encoding: 'utf8', mode: 0o600 });
  return key;
}

function deviceKey(options) {
  if (process.env.UNDERFIT_DEVICE_KEY) return process.env.UNDERFIT_DEVICE_KEY;
  if (!options.isPackaged) return 'underfit-development-device-key-change-me';
  const directory = path.join(options.userDataPath, 'platform');
  const keyPath = path.join(directory, 'device.key');
  fs.mkdirSync(directory, { recursive: true });
  if (fs.existsSync(keyPath)) return fs.readFileSync(keyPath, 'utf8').trim();
  const key = crypto.randomBytes(48).toString('base64url');
  fs.writeFileSync(keyPath, key, { encoding: 'utf8', mode: 0o600 });
  return key;
}

function composeFile({ isPackaged, resourcesPath }) {
  return isPackaged
    ? path.join(resourcesPath, 'platform', 'compose.yaml')
    : path.join(__dirname, '..', 'infrastructure', 'compose', 'compose.yaml');
}

function postgresPassword(options) {
  if (process.env.UNDERFIT_POSTGRES_PASSWORD) return process.env.UNDERFIT_POSTGRES_PASSWORD;
  if (!options.isPackaged) return 'underfit_dev';
  const directory = path.join(options.userDataPath, 'platform');
  const file = path.join(directory, 'postgres.key');
  fs.mkdirSync(directory, { recursive: true });
  if (fs.existsSync(file)) {
    const value = fs.readFileSync(file, 'utf8').trim();
    if (!/^[A-Za-z0-9_-]{48,}$/.test(value)) throw new Error('La credencial local de PostgreSQL no es válida.');
    return value;
  }
  const value = crypto.randomBytes(48).toString('base64url');
  fs.writeFileSync(file, value, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  return value;
}

function apiExecutable({ isPackaged, resourcesPath }) {
  return isPackaged
    ? path.join(resourcesPath, 'api', 'UnderFit.Api.exe')
    : null;
}

function tunnelExecutable({ isPackaged, resourcesPath }) {
  if (process.env.UNDERFIT_CLOUDFLARED_PATH) {
    return process.env.UNDERFIT_CLOUDFLARED_PATH;
  }
  return isPackaged
    ? path.join(resourcesPath, 'tools', 'cloudflared.exe')
    : path.join(__dirname, '..', 'release', 'tools', 'cloudflared.exe');
}

function tunnelTokenFile(options) {
  const tokenPath = path.join(options.userDataPath, 'platform', 'tunnel.token');
  if (process.env.UNDERFIT_TUNNEL_TOKEN) {
    const token = process.env.UNDERFIT_TUNNEL_TOKEN.trim();
    if (!token) return null;
    fs.mkdirSync(path.dirname(tokenPath), { recursive: true });
    fs.writeFileSync(tokenPath, token, { encoding: 'utf8', mode: 0o600 });
    delete process.env.UNDERFIT_TUNNEL_TOKEN;
    return tokenPath;
  }
  if (!fs.existsSync(tokenPath)) return null;
  return fs.readFileSync(tokenPath, 'utf8').trim() ? tokenPath : null;
}

async function isReady(baseUrl) {
  try {
    const response = await fetch(`${baseUrl}/health/ready`, {
      signal: AbortSignal.timeout(1500),
    });
    return response.ok;
  } catch (_) {
    return false;
  }
}

function isPortOpen(port = 5432, host = '127.0.0.1') {
  return new Promise(resolve => {
    const socket = net.createConnection({ port, host });
    const finish = value => {
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(1000);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

async function startPostgres(options) {
  // Production must start its named Compose project, never silently adopt an
  // unrelated database merely because something is listening on port 5432.
  if (!options.isPackaged && await isPortOpen()) return;
  const docker = await ensureDockerReady({ autoStart: options.isPackaged });
  await new Promise((resolve, reject) => execFile(docker,
    ['compose', '-f', composeFile(options), 'up', '-d', '--wait', 'postgres'],
    { encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 },
    (error, stdout, stderr) => error
      ? reject(new Error(`No se pudo iniciar PostgreSQL con Docker: ${stderr?.trim() || error.message}`))
      : resolve()));
}

function startApi(options) {
  const mediaPath = process.env.UNDERFIT_MEDIA_PATH;
  const env = {
    ...process.env,
    ASPNETCORE_URLS: options.baseUrl,
    ASPNETCORE_ENVIRONMENT: options.isPackaged ? 'Production' : 'Development',
    ConnectionStrings__UnderFit:
      process.env.UNDERFIT_POSTGRES_CONNECTION
      || `Host=localhost;Port=5432;Database=underfit;Username=underfit;Password=${
        process.env.UNDERFIT_POSTGRES_PASSWORD
      }`,
    Authentication__JwtKey: jwtKey(options),
    Authentication__DeviceKey: process.env.UNDERFIT_DEVICE_KEY,
    TabletDevicesFile: ensureTabletAccess(options.userDataPath),
    Media__StoragePath: mediaPath,
    Media__FfmpegPath: options.isPackaged
      ? path.join(options.resourcesPath, 'tools', 'ffmpeg.exe')
      : (process.env.UNDERFIT_FFMPEG_PATH || 'ffmpeg'),
  };
  if (options.isPackaged) {
    apiProcess = spawn(apiExecutable(options), [], {
      env,
      cwd: path.dirname(apiExecutable(options)),
      windowsHide: true,
      stdio: 'ignore',
    });
  } else {
    const dotnet = process.env.UNDERFIT_DOTNET_PATH || 'dotnet';
    apiProcess = spawn(
      dotnet,
      ['run', '--no-launch-profile', '--project', path.join(__dirname, '..', 'backend', 'UnderFit.Api')],
      { env, windowsHide: true, stdio: 'ignore' }
    );
  }
  apiProcess.once('error', error => {
    console.error('No se pudo iniciar UnderFit API:', error);
  });
}

function startTunnel(options) {
  const tokenPath = tunnelTokenFile(options);
  if (!tokenPath) return false;
  const executable = tunnelExecutable(options);
  if (!fs.existsSync(executable)) {
    throw new Error('Cloudflared no está incluido en la instalación.');
  }
  stopping = false;
  tunnelProcess = spawn(
    executable,
    ['tunnel', '--no-autoupdate', 'run', '--token-file', tokenPath],
    { windowsHide: true, stdio: 'ignore' }
  );
  tunnelProcess.once('error', error => {
    console.error('No se pudo iniciar el túnel de UnderFit:', error);
  });
  tunnelProcess.once('exit', () => {
    tunnelProcess = null;
    if (stopping) return;
    tunnelRestartTimer = setTimeout(() => {
      try {
        startTunnel(options);
      } catch (error) {
        console.error('No se pudo reiniciar el túnel de UnderFit:', error);
      }
    }, 10000);
  });
  return true;
}

async function waitUntilReady(baseUrl, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isReady(baseUrl)) return;
    await new Promise(resolve => setTimeout(resolve, 750));
  }
  throw new Error('UnderFit API no quedo disponible dentro del tiempo esperado');
}

async function ensurePlatformReady(options) {
  const inferredRole = ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(options.baseUrl).hostname)
    ? 'host' : 'client';
  const connection = resolveInstallation({
    role: process.env.UNDERFIT_INSTALLATION_ROLE || inferredRole,
    apiBaseUrl: options.baseUrl,
    allowLoopbackClient: !options.isPackaged,
  });
  process.env.UNDERFIT_INSTALLATION_ROLE = connection.role;
  if (connection.role === 'client') {
    if (options.beforeStart && await options.beforeStart()) return { updating: true, role: 'client' };
    // No local server, database, tunnel, generated key or backup on a client.
    const keyPath = path.join(options.userDataPath, 'platform', 'device.key');
    const key = process.env.UNDERFIT_DEVICE_KEY || (fs.existsSync(keyPath)
      ? fs.readFileSync(keyPath, 'utf8').trim() : '');
    if (key.length < 32 || key.includes('development')) {
      throw new Error('Esta PC todavía no está vinculada al gimnasio. Falta su credencial de acceso.');
    }
    const request = options.fetchImpl || globalThis.fetch;
    let response;
    try {
      response = await request(`${connection.apiBaseUrl}/api/v1/settings/business/`, {
        headers: { 'X-UnderFit-Device-Key': key }, signal: AbortSignal.timeout(8000), redirect: 'error',
      });
    } catch {
      throw new Error('No se pudo conectar con el gimnasio. Comprobá que su PC esté encendida y tenga internet.');
    }
    if (!response.ok) {
      throw new Error(response.status === 401 || response.status === 403
        ? 'El gimnasio rechazó la credencial de esta PC.' : 'El servidor del gimnasio no está disponible.');
    }
    process.env.UNDERFIT_DEVICE_KEY = key;
    return { alreadyRunning: true, tunnelConfigured: false, role: 'client' };
  }
  process.env.UNDERFIT_POSTGRES_PASSWORD = postgresPassword(options);
  process.env.UNDERFIT_DEVICE_KEY = deviceKey(options);
  process.env.UNDERFIT_COMPOSE_FILE = composeFile(options);
  process.env.UNDERFIT_MEDIA_PATH = path.join(
    options.userDataPath,
    'media',
    'exercises'
  );
  const alreadyRunning = await isReady(options.baseUrl);
  if (!alreadyRunning) {
    if (options.onProgress) await options.onProgress('Iniciando Docker y preparando la base de datos…');
    await startPostgres(options);
    if (options.beforeStart && await options.beforeStart()) {
      return { updating: true, role: 'host' };
    }
    if (options.onProgress) await options.onProgress('Iniciando el servidor de Under-Fit…');
    startApi(options);
    await waitUntilReady(options.baseUrl);
  }
  if (options.beforeExpose) await options.beforeExpose();
  const tunnelConfigured = startTunnel(options);
  return { alreadyRunning, tunnelConfigured, role: 'host' };
}

function stopManagedApi() {
  stopping = true;
  if (tunnelRestartTimer) clearTimeout(tunnelRestartTimer);
  tunnelRestartTimer = null;
  if (tunnelProcess && !tunnelProcess.killed) tunnelProcess.kill();
  tunnelProcess = null;
  if (apiProcess && !apiProcess.killed) apiProcess.kill();
  apiProcess = null;
}

module.exports = {
  ensurePlatformReady,
  stopManagedApi,
  jwtKey,
  deviceKey,
  composeFile,
  tunnelExecutable,
  tunnelTokenFile,
  postgresPassword,
};
