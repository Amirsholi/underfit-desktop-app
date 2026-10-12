const { getDbPathFromConfigOrDefault } = require('../config');
const { createManualBackup, createManualPostgresBackup, getBackupDirectory } = require('../backup');
function registerSystemHandlers(ipcMain, settingsService, dataSource = { mode: 'local' }) {
  ipcMain.handle('crear-codigo-tablet', (_event, deviceId) => {
    if (!['tablet1', 'tablet2'].includes(deviceId)) throw new Error('Seleccioná Tablet 1 o Tablet 2.');
    if (!settingsService.createTabletPairingCode) throw new Error('La vinculación requiere el escritorio conectado al servidor.');
    return settingsService.createTabletPairingCode(deviceId);
  });
  const { app, BrowserWindow, dialog } = require('electron');
  const audioPreferences = require('../services/kioskPreferences').createKioskPreferences(app.getPath('userData'));
  ipcMain.handle('obtener-sonidos-ingreso', () => audioPreferences.get());
  ipcMain.handle('guardar-sonidos-ingreso', async (_event, muted) => {
    const preferences = await audioPreferences.save(muted);
    BrowserWindow.getAllWindows().forEach(window => {
      if (!window.isDestroyed()) window.webContents.send('sonidos-ingreso-actualizados', preferences);
    });
    return preferences;
  });

  ipcMain.handle('cargar-sonido-ingreso', async (event, kind) => {
    if (!['success', 'expired'].includes(kind)) throw new Error('Tipo de sonido no válido');
    const options = {title: kind === 'success' ? 'Sonido de ingreso' : 'Sonido de membresía vencida',
      properties: ['openFile'], filters: [{name: 'Audio (máximo 10 MB)', extensions: ['mp3', 'wav', 'ogg', 'm4a']}]};
    const owner = BrowserWindow.fromWebContents(event.sender);
    const selected = owner ? await dialog.showOpenDialog(owner, options) : await dialog.showOpenDialog(options);
    if (selected.canceled || !selected.filePaths.length) return null;
    const preferences = await audioPreferences.importSound(kind, selected.filePaths[0]);
    BrowserWindow.getAllWindows().forEach(window => {
      if (!window.isDestroyed()) window.webContents.send('sonidos-ingreso-actualizados', preferences);
    });
    return preferences;
  });

  ipcMain.handle('obtener-info-sistema', async () => {
    const dbPath = getDbPathFromConfigOrDefault();
    const settings = await settingsService.getSettings();
    return {
      dbPath: dataSource.mode === 'api' ? (process.env.UNDERFIT_INSTALLATION_ROLE === 'client'
        ? 'PostgreSQL · PC del gimnasio' : 'PostgreSQL · Docker local') : dbPath,
      backupDir: process.env.UNDERFIT_INSTALLATION_ROLE === 'client'
        ? 'Los respaldos se guardan en la PC del gimnasio' : getBackupDirectory(dbPath),
      dataMode: dataSource.mode,
      databaseEngine: dataSource.mode === 'api' ? 'PostgreSQL' : 'SQLite',
      settings,
    };
  });

  ipcMain.handle('crear-backup-manual', async () => {
    if (process.env.UNDERFIT_INSTALLATION_ROLE === 'client') {
      throw new Error('El respaldo debe crearse en la PC principal del gimnasio.');
    }
    const dbPath = getDbPathFromConfigOrDefault();
    return dataSource.mode === 'api'
      ? createManualPostgresBackup(dbPath)
      : createManualBackup(dbPath);
  });

  ipcMain.handle('guardar-configuracion-negocio', async (_evt, payload) => {
    const settings = await settingsService.saveSettings(payload);
    const { BrowserWindow } = require('electron');
    const event = Object.fromEntries(Object.entries(settings).filter(([key]) => key.startsWith('eventoRunning')));
    BrowserWindow.getAllWindows().forEach(window => {
      if (!window.isDestroyed()) window.webContents.send('evento-actualizado', event);
    });
    return settings;
  });
}

module.exports = { registerSystemHandlers };
