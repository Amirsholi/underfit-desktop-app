function registerStaffHandlers(ipcMain, staffService) {
  ipcMain.handle('obtener-profesores', (_event, includeInactive = false) => staffService.listProfessors(includeInactive));
  ipcMain.handle('crear-profesor', (_event, payload) => staffService.createProfessor(payload || {}));
  ipcMain.handle('actualizar-profesor', (_event, { id, datos } = {}) => staffService.updateProfessor(id, datos || {}));
  ipcMain.handle('iniciar-sesion-profesor', (_event, payload) => staffService.startSession(payload || {}));
  ipcMain.handle('obtener-sesion-profesor-activa', (_event, deviceId) => staffService.getActiveSession(deviceId));
  ipcMain.handle('finalizar-sesion-profesor', (_event, sessionId) => staffService.finishSession(sessionId));
}

module.exports = { registerStaffHandlers };
