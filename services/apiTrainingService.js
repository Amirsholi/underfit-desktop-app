const fs = require('fs/promises');
const path = require('path');
const { File } = require('buffer');

function createApiTrainingService({ apiClient }) {
  return {
    listExercises: includeInactive => apiClient.listExercises(includeInactive),
    createExercise: payload => apiClient.createExercise(payload),
    updateExercise: (id, payload) => apiClient.updateExercise(id, payload),
    assignWorkoutPlan: (identityNumber, payload) =>
      apiClient.assignWorkoutPlan(identityNumber, payload),
    listTemplates: () => apiClient.listWorkoutTemplates(),
    listMemberPlans: () => apiClient.listMemberWorkoutPlans(),
    saveTemplate: payload => apiClient.saveWorkoutTemplate(payload),
    uploadVideo: async filePath => {
      const bytes = await fs.readFile(filePath);
      const file = new File([bytes], path.basename(filePath), {
        type: 'application/octet-stream',
      });
      return apiClient.uploadExerciseVideo(file);
    },
  };
}

function createUnavailableTrainingService() {
  const unavailable = () => {
    throw new Error('La gestión de rutinas requiere la plataforma .NET/PostgreSQL.');
  };
  return {
    listExercises: unavailable,
    createExercise: unavailable,
    updateExercise: unavailable,
    assignWorkoutPlan: unavailable,
    listTemplates: unavailable,
    listMemberPlans: async () => [],
    saveTemplate: unavailable,
    uploadVideo: unavailable,
  };
}

module.exports = { createApiTrainingService, createUnavailableTrainingService };
