// Electron entry point for the isolated, shared tablet rehearsal.
const { app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
if (app.isPackaged) throw new Error('El ensayo no es una instalación de producción.');
const directory = path.join(process.env.LOCALAPPDATA, 'UnderFitRehearsal/tablet-test');
const config = JSON.parse(fs.readFileSync(path.join(directory, 'server.json'), 'utf8'));
if (!config.ConnectionStrings?.UnderFit?.startsWith('Host=127.0.0.1;Port=55432;Database=underfit_tablet_test;'))
  throw new Error('La configuración no corresponde a la base de ensayo de tablets.');
const profile = path.join(directory, 'desktop-profile');
fs.mkdirSync(profile, { recursive: true });
app.setPath('userData', profile);
app.setName('UnderFit - Ensayo conectado');
process.env.UNDERFIT_DATA_MODE = 'api';
process.env.UNDERFIT_INSTALLATION_ROLE = 'client';
process.env.UNDERFIT_API_BASE_URL = 'http://127.0.0.1:5190';
process.env.UNDERFIT_DEVICE_KEY = config.Authentication.DeviceKey;
app.on('browser-window-created', (_event, window) => {
  window.webContents.on('did-finish-load', () => window.setTitle('UnderFit · ENSAYO CONECTADO · datos ficticios'));
});
require('../main');
