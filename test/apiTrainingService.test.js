const test = require('node:test');
const assert = require('node:assert/strict');
const { createApiTrainingService } = require('../services/apiTrainingService');

test('API training service preserves exercise catalog and assigned workout groupings', async () => {
  const calls = [];
  const service = createApiTrainingService({
    apiClient: {
      listExercises: async includeInactive => {
        calls.push(['list', includeInactive]);
        return [{ id: 8, name: 'Press de banca', muscleGroup: 'Pecho' }];
      },
      createExercise: async payload => {
        calls.push(['create', payload]);
        return { id: 8, ...payload, isActive: true };
      },
      updateExercise: async (id, payload) => {
        calls.push(['update', id, payload]);
        return { id, ...payload };
      },
      assignWorkoutPlan: async (identityNumber, payload) => {
        calls.push(['assign', identityNumber, payload]);
        return { id: 'plan-1', ...payload };
      },
      listMemberWorkoutPlans: async () => {
        calls.push(['member-plans']);
        return [{ identityNumber: 'TEST-MOBILE-001', plan: { id: 'plan-1' } }];
      },
    },
  });
  const grouping = {
    position: 1,
    name: 'Día A',
    muscleGroups: 'Pecho y tríceps',
    exercises: [{
      exerciseId: 8,
      position: 1,
      sets: 4,
      repetitions: '12 / 10 / 8 / 8',
      load: null,
      restSeconds: 60,
      notes: 'Controlar técnica',
    }],
  };

  await service.listExercises(false);
  await service.listMemberPlans();
  await service.assignWorkoutPlan('TEST-MOBILE-001', {
    name: 'Rutina inicial',
    professorId: 2,
    days: [grouping],
  });

  assert.deepEqual(calls, [
    ['list', false],
    ['member-plans'],
    ['assign', 'TEST-MOBILE-001', {
      name: 'Rutina inicial',
      professorId: 2,
      days: [grouping],
    }],
  ]);
});
