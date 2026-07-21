function registerOperationsHandlers(ipcMain, operationsService) {
  ipcMain.handle('obtener-stock-locales', () => operationsService.listStock());
  ipcMain.handle('transferir-stock-local', (_evt, payload) => operationsService.transferStock(payload || {}));
  ipcMain.handle('obtener-clases-proximas', (_evt, fromDate) => operationsService.listUpcomingClasses(fromDate));
  ipcMain.handle('crear-clase', (_evt, payload) => operationsService.createClass(payload || {}));
  ipcMain.handle('obtener-inscripciones-clase', (_evt, classId) => operationsService.listClassEnrollments(classId));
  ipcMain.handle('inscribir-socio-clase', (_evt, payload) => operationsService.enrollMember(payload || {}));
  ipcMain.handle('obtener-ventas-pendientes', () => operationsService.listPendingSales());
  ipcMain.handle('obtener-resumen-ventas-pendientes', (_evt, fecha) => operationsService.getPendingSummaryByDate(fecha));
  ipcMain.handle('crear-venta-pendiente', (_evt, payload) => operationsService.createPendingSale(payload || {}));
  ipcMain.handle('cobrar-venta-pendiente', (_evt, payload) => operationsService.collectPendingSale(payload || {}));
}

module.exports = { registerOperationsHandlers };
