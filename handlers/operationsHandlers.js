function registerOperationsHandlers(ipcMain, operationsService) {
  ipcMain.handle('obtener-stock-locales', () => operationsService.listStock());
  ipcMain.handle('transferir-stock-local', (_evt, payload) => operationsService.transferStock(payload || {}));
  ipcMain.handle('obtener-locales', () => operationsService.listLocations());
  ipcMain.handle('obtener-clases-proximas', (_evt, fromDate) => operationsService.listUpcomingClasses(fromDate));
  ipcMain.handle('crear-clase', (_evt, payload) => operationsService.createClass(payload || {}));
  ipcMain.handle('actualizar-programacion-clase', (_evt, payload) => {
    if (!operationsService.updateClassSchedule) throw new Error('Editar clases todavía no está disponible en este servidor.');
    return operationsService.updateClassSchedule(payload || {});
  });
  ipcMain.handle('marcar-clase-prueba', (_evt, payload) => operationsService.setClassTrial(payload || {}));
  ipcMain.handle('obtener-inscripciones-clase', (_evt, classId) => operationsService.listClassEnrollments(classId));
  ipcMain.handle('inscribir-socio-clase', (_evt, payload) => operationsService.enrollMember(payload || {}));
  ipcMain.handle('quitar-alumno-clase', (_evt, payload) => {
    if (!operationsService.removeEnrollment) throw new Error('Quitar alumnos todavía no está disponible en este servidor.');
    return operationsService.removeEnrollment(payload || {});
  });
  ipcMain.handle('eliminar-clase', (_evt, id) => operationsService.deleteClass(Number(id)));
  ipcMain.handle('obtener-clase-actual', (_evt, payload) => operationsService.getCurrentClass(payload || {}));
  ipcMain.handle('registrar-asistencia-clase', (_evt, payload) => operationsService.registerClassAttendance(payload || {}));
  ipcMain.handle('obtener-registros-clases', (_evt, fecha) => operationsService.listClassRecordsByDate(fecha));
  ipcMain.handle('obtener-detalle-registro-clase', (_evt, classId) => operationsService.getClassRecordDetail(classId));
  ipcMain.handle('marcar-estado-clase', (_evt, payload) => operationsService.setClassHeldStatus(payload || {}));
  ipcMain.handle('puntuar-asistencia-clase', (_evt, payload) => operationsService.setClassPerformanceRating(payload || {}));
  ipcMain.handle('corregir-asistencia-clase', (_evt, payload) => operationsService.correctClassAttendance(payload || {}));
  ipcMain.handle('obtener-ventas-pendientes', () => operationsService.listPendingSales());
  ipcMain.handle('obtener-resumen-ventas-pendientes', (_evt, fecha) => operationsService.getPendingSummaryByDate(fecha));
  ipcMain.handle('crear-venta-pendiente', (_evt, payload) => operationsService.createPendingSale(payload || {}));
  ipcMain.handle('cobrar-venta-pendiente', (_evt, payload) => operationsService.collectPendingSale(payload || {}));
}

module.exports = { registerOperationsHandlers };
