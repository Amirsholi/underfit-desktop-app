function registerTrainingHandlers(ipcMain, trainingService) {
  ipcMain.handle(
    'obtener-ejercicios',
    (_event, includeInactive = false) =>
      trainingService.listExercises(includeInactive)
  );
  ipcMain.handle(
    'crear-ejercicio',
    (_event, payload) => trainingService.createExercise(payload || {})
  );
  ipcMain.handle(
    'actualizar-ejercicio',
    (_event, { id, datos } = {}) =>
      trainingService.updateExercise(id, datos || {})
  );
  ipcMain.handle(
    'asignar-rutina-socio',
    (_event, { identityNumber, plan } = {}) =>
      trainingService.assignWorkoutPlan(identityNumber, plan || {})
  );
  ipcMain.handle(
    'obtener-pre-rutinas',
    () => trainingService.listTemplates()
  );
  ipcMain.handle(
    'obtener-rutinas-socios',
    () => trainingService.listMemberPlans()
  );
  ipcMain.handle(
    'guardar-pre-rutina',
    (_event, payload) => trainingService.saveTemplate(payload || {})
  );
  ipcMain.handle(
    'subir-video-ejercicio',
    (_event, filePath) => trainingService.uploadVideo(filePath)
  );
}

module.exports = { registerTrainingHandlers };
