const { createDatabase } = require('../database/database');
const { getDbPathFromConfigOrDefault } = require('../config');
const { createManualBackup, getBackupDirectory } = require('../backup');
const { createSettingsRepository } = require('../repositories/settingsRepository');
const { createSettingsService } = require('../services/settingsService');

function registerSystemHandlers(ipcMain) {
  const db = createDatabase();
  const settingsService = createSettingsService({
    settingsRepository: createSettingsRepository(db),
  });

  ipcMain.handle('obtener-info-sistema', async () => {
    const dbPath = getDbPathFromConfigOrDefault();
    const settings = await settingsService.getSettings();
    return {
      dbPath,
      backupDir: getBackupDirectory(dbPath),
      settings,
    };
  });

  ipcMain.handle('crear-backup-manual', async () => {
    const dbPath = getDbPathFromConfigOrDefault();
    return createManualBackup(dbPath);
  });

  ipcMain.handle('guardar-configuracion-negocio', async (_evt, payload) => {
    return settingsService.saveSettings(payload);
  });
}

module.exports = { registerSystemHandlers };
