// Unpublished desktop preview against this PC's existing local test server.
const { app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
if (app.isPackaged) throw new Error('Preview is development-only.');
const installedProfile = path.join(process.env.APPDATA, 'under-fit');
const installation = JSON.parse(fs.readFileSync(path.join(installedProfile, 'platform/installation.json'), 'utf8'));
if (installation.apiBaseUrl !== 'http://127.0.0.1:5187') throw new Error('Preview requires the local test server.');
const profile = path.join(process.env.LOCALAPPDATA, 'UnderFitGymTest/preview-profile');
fs.mkdirSync(profile, { recursive: true });
app.setPath('userData', profile);
app.setName('UnderFit - Vista previa');
process.env.UNDERFIT_DATA_MODE = 'api';
process.env.UNDERFIT_INSTALLATION_ROLE = 'client';
process.env.UNDERFIT_API_BASE_URL = installation.apiBaseUrl;
process.env.UNDERFIT_DEVICE_KEY = fs.readFileSync(path.join(installedProfile, 'platform/device.key'), 'utf8').trim();
app.on('browser-window-created', (_event, window) => {
  window.webContents.on('did-finish-load', () => window.setTitle('Under-Fit · PRUEBA SIN PUBLICAR'));
});
require('../main');
