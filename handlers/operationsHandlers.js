function registerOperationsHandlers(ipcMain, operationsService) {
  ipcMain.handle('obtener-stock-locales', () => operationsService.listStock());
  ipcMain.handle('transferir-stock-local', (_evt, payload) => operationsService.transferStock(payload || {}));
  ipcMain.handle('obtener-locales', () => operationsService.listLocations());
  ipcMain.handle('obtener-clases-proximas', (_evt, fromDate) => operationsService.listUpcomingClasses(fromDate));
  ipcMain.handle('crear-clase', (_evt, payload) => operationsService.createClass(payload || {}));
  ipcMain.handle('obtener-inscripciones-clase', (_evt, classId) => operationsService.listClassEnrollments(classId));
  ipcMain.handle('inscribir-socio-clase', (_evt, payload) => operationsService.enrollMember(payload || {}));
  ipcMain.handle('obtener-clase-actual', (_evt, payload) => operationsService.getCurrentClass(payload || {}));
  ipcMain.handle('registrar-asistencia-clase', (_evt, payload) => operationsService.registerClassAttendance(payload || {}));
  ipcMain.handle('finalizar-clase', (_evt, payload) => operationsService.finishClass(payload || {}));
  ipcMain.handle('obtener-registros-clases', (_evt, fecha) => operationsService.listClassRecordsByDate(fecha));
  ipcMain.handle('obtener-detalle-registro-clase', (_evt, classId) => operationsService.getClassRecordDetail(classId));
  ipcMain.handle('obtener-ventas-pendientes', () => operationsService.listPendingSales());
  ipcMain.handle('obtener-resumen-ventas-pendientes', (_evt, fecha) => operationsService.getPendingSummaryByDate(fecha));
  ipcMain.handle('crear-venta-pendiente', (_evt, payload) => operationsService.createPendingSale(payload || {}));
  ipcMain.handle('cobrar-venta-pendiente', (_evt, payload) => operationsService.collectPendingSale(payload || {}));
}

module.exports = { registerOperationsHandlers };
