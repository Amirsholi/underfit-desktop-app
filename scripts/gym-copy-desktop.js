// Dedicated development profile: never opens or changes the received SQLite file.
const { app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const directory = path.join(process.env.LOCALAPPDATA, 'UnderFitRehearsal/gym-copy');
const config = JSON.parse(fs.readFileSync(path.join(directory, 'server.json'), 'utf8'));
assert.match(config.ConnectionStrings.UnderFit, /^Host=127\.0\.0\.1;Port=55432;Database=underfit_gym_preview_\d+;/);
assert.ok(!app.isPackaged);
const profile = path.join(directory, 'desktop-profile');
fs.mkdirSync(profile, { recursive: true });
app.setPath('userData', profile);
app.setName('UnderFit - Copia del gym');
Object.assign(process.env, { UNDERFIT_DATA_MODE: 'api', UNDERFIT_INSTALLATION_ROLE: 'client',
  UNDERFIT_API_BASE_URL: 'http://127.0.0.1:5192', UNDERFIT_DEVICE_KEY: config.Authentication.DeviceKey });
app.on('browser-window-created', (_event, window) => {
  window.webContents.on('did-finish-load', () => window.setTitle('UnderFit · ENSAYO · COPIA DEL GYM'));
});
require('../main');
