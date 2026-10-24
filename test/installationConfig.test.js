const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { resolveInstallation, loadInstallationEnvironment } = require('../services/installationConfig');
const { ensurePlatformReady, postgresPassword } = require('../services/platformRuntime');

test('development client may use loopback HTTP while production and LAN clients still require HTTPS', () => {
  assert.equal(resolveInstallation({ role: 'client', apiBaseUrl: 'http://127.0.0.1:5190', allowLoopbackClient: true }).role, 'client');
  assert.throws(() => resolveInstallation({ role: 'client', apiBaseUrl: 'http://127.0.0.1:5190' }));
  assert.throws(() => resolveInstallation({ role: 'client', apiBaseUrl: 'http://192.168.1.4:5190', allowLoopbackClient: true }));
});

test('installation separates a local host from HTTPS clients and rejects ambiguous addresses', () => {
  assert.deepEqual(resolveInstallation({ role: 'host', apiBaseUrl: 'http://127.0.0.1:5187/' }),
    { role: 'host', apiBaseUrl: 'http://127.0.0.1:5187' });
  for (const input of [
    { role: 'host', apiBaseUrl: 'https://gym.example' },
    { role: 'client', apiBaseUrl: 'http://gym.example' },
    { role: 'client', apiBaseUrl: 'https://user:secret@gym.example' },
    { role: 'client', apiBaseUrl: 'https://gym.example/path' },
    { role: 'client', apiBaseUrl: 'https://gym.example/?key=secret' },
    { role: 'other', apiBaseUrl: 'https://gym.example' },
  ]) assert.throws(() => resolveInstallation(input));
});

test('packaged installation requires explicit configuration and uses it consistently', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'underfit-install-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const env = {};
  assert.throws(() => loadInstallationEnvironment({ userDataPath: directory, isPackaged: true, env }), /Falta configurar/);
  fs.mkdirSync(path.join(directory, 'platform'));
  fs.writeFileSync(path.join(directory, 'platform', 'installation.json'), JSON.stringify({ role: 'client', apiBaseUrl: 'https://gym.example' }));
  loadInstallationEnvironment({ userDataPath: directory, isPackaged: true, env });
  assert.equal(env.UNDERFIT_INSTALLATION_ROLE, 'client');
  assert.equal(env.UNDERFIT_DATA_MODE, 'api');
  assert.equal(env.UNDERFIT_API_BASE_URL, 'https://gym.example');
});

test('remote failure never creates local data, keys or servers; authorization is checked', async t => {
  const original = { ...process.env };
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'underfit-remote-'));
  t.after(() => {
    for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key];
    Object.assign(process.env, original);
    fs.rmSync(directory, { recursive: true, force: true });
  });
  process.env.UNDERFIT_INSTALLATION_ROLE = 'client';
  delete process.env.UNDERFIT_DEVICE_KEY;
  const options = { userDataPath: directory, isPackaged: true, baseUrl: 'https://gym.example' };
  await assert.rejects(ensurePlatformReady(options), /Falta su credencial/);
  process.env.UNDERFIT_DEVICE_KEY = 'x'.repeat(48);
  await assert.rejects(ensurePlatformReady({ ...options, fetchImpl: async () => { throw new Error('offline'); } }), /No se pudo conectar/);
  await assert.rejects(ensurePlatformReady({ ...options, fetchImpl: async () => ({ ok: false, status: 401 }) }), /rechazó/);
  const result = await ensurePlatformReady({ ...options, fetchImpl: async (url, request) => {
    assert.equal(url, 'https://gym.example/api/v1/settings/business/');
    assert.equal(request.headers['X-UnderFit-Device-Key'], 'x'.repeat(48));
    assert.equal(request.redirect, 'error');
    return { ok: true };
  } });
  assert.equal(result.role, 'client');
  assert.deepEqual(fs.readdirSync(directory), []);
});

test('production PostgreSQL gets a stable random credential distinct from development', t => {
  const previous = process.env.UNDERFIT_POSTGRES_PASSWORD;
  delete process.env.UNDERFIT_POSTGRES_PASSWORD;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'underfit-secret-'));
  t.after(() => {
    if (previous === undefined) delete process.env.UNDERFIT_POSTGRES_PASSWORD;
    else process.env.UNDERFIT_POSTGRES_PASSWORD = previous;
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const options = { isPackaged: true, userDataPath: directory };
  const password = postgresPassword(options);
  assert.match(password, /^[A-Za-z0-9_-]{64}$/);
  assert.equal(postgresPassword(options), password);
});
