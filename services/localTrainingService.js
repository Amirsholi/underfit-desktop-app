const { createExerciseVideoProcessor } = require('./exerciseVideoProcessor');

function createLocalTrainingService({ trainingRepository, userRepository, staffRepository, processVideo = createExerciseVideoProcessor() }) {
  function required(value, label) {
    const normalized = String(value || '').trim();
    if (!normalized) throw new Error(`${label} es obligatorio.`);
    return normalized;
  }

  function normalizeDays(days) {
    if (!Array.isArray(days) || !days.length) throw new Error('La rutina necesita al menos un día.');
    return days.map((day, dayIndex) => {
      const exercises = Array.isArray(day.exercises) ? day.exercises : [];
      if (!exercises.length) throw new Error('Cada día necesita al menos un ejercicio.');
      return {
        position: Number(day.position) || dayIndex + 1,
        name: required(day.name, 'El nombre del día'),
        muscleGroups: String(day.muscleGroups || day.name || '').trim(),
        exercises: exercises.map((item, exerciseIndex) => ({
          exerciseId: Number(item.exerciseId),
          position: Number(item.position) || exerciseIndex + 1,
          sets: Math.max(1, Number(item.sets) || 1),
          repetitions: required(item.repetitions, 'Las repeticiones'),
          load: item.load == null ? null : String(item.load),
          restSeconds: item.restSeconds == null ? null : Number(item.restSeconds),
          notes: item.notes == null ? null : String(item.notes),
        })),
      };
    });
  }

  function mapTemplate(row) {
    return { id: row.id, name: row.name, days: JSON.parse(row.daysJson || '[]'), isActive: Boolean(row.isActive), updatedAtUtc: row.updatedAtUtc };
  }

  async function hydratePlan(row) {
    const days = JSON.parse(row.daysJson || '[]');
    const exercises = await trainingRepository.listExercises(true);
    const byId = new Map(exercises.map(item => [Number(item.id), item]));
    return {
      identityNumber: String(row.identityNumber),
      memberName: row.memberName,
      assignedAtUtc: row.assignedAtUtc,
      plan: {
        id: String(row.id),
        name: row.name,
        professorId: row.professorId,
        professorName: row.professorName,
        days: days.map((day, dayIndex) => ({
          id: `${row.id}-${dayIndex + 1}`,
          ...day,
          exercises: day.exercises.map((item, itemIndex) => {
            const exercise = byId.get(Number(item.exerciseId)) || {};
            return {
              id: `${row.id}-${dayIndex + 1}-${itemIndex + 1}`,
              ...item,
              name: exercise.name || 'Ejercicio',
              muscleGroup: exercise.muscleGroup || '',
              instructions: exercise.instructions || null,
              gifUrl: exercise.gifUrl || null,
            };
          }),
        })),
      },
    };
  }

  return {
    listExercises: includeInactive => trainingRepository.listExercises(includeInactive).then(items => items.map(item => ({ ...item, isActive: Boolean(item.isActive) }))),
    createExercise: payload => trainingRepository.createExercise({
      name: required(payload.name, 'El nombre'),
      muscleGroup: required(payload.muscleGroup, 'El grupo muscular'),
      instructions: payload.instructions,
      gifUrl: payload.gifUrl,
    }),
    updateExercise: async (id, payload) => {
      if (!Number(id)) throw new Error('Ejercicio inválido.');
      return trainingRepository.updateExercise(Number(id), {
        name: required(payload.name, 'El nombre'),
        muscleGroup: required(payload.muscleGroup, 'El grupo muscular'),
        instructions: payload.instructions,
        gifUrl: payload.gifUrl,
        isActive: payload.isActive !== false,
      });
    },
    listTemplates: async () => (await trainingRepository.listTemplates()).map(mapTemplate),
    saveTemplate: async payload => mapTemplate(await trainingRepository.saveTemplate({ name: required(payload.name, 'El nombre de la rutina'), days: normalizeDays(payload.days) })),
    listMemberPlans: async () => Promise.all((await trainingRepository.listMemberPlans()).map(hydratePlan)),
    assignWorkoutPlan: async (identityNumber, payload) => {
      const user = await userRepository.findByCi(identityNumber);
      if (!user) throw new Error('No encontramos al socio.');
      const professor = await staffRepository.findProfessorById(Number(payload.professorId));
      if (!professor || !professor.activo) throw new Error('Seleccioná un profesor activo.');
      return hydratePlan(await trainingRepository.assignMemberPlan(identityNumber, {
        name: required(payload.name, 'El nombre de la rutina'),
        professorId: professor.id,
        professorName: professor.nombre,
        days: normalizeDays(payload.days),
      }));
    },
    uploadVideo: processVideo,
  };
}

module.exports = { createLocalTrainingService };
