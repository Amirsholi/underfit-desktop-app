const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sqlite3 = require('sqlite3').verbose();
const { migrarUsuarios, migrarEntrenamientoLocal } = require('../migrations');
const { createTrainingRepository } = require('../repositories/trainingRepository');
const { createLocalTrainingService } = require('../services/localTrainingService');

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => db.run(sql, params, error => error ? reject(error) : resolve()));
}

function close(db) {
  return new Promise((resolve, reject) => db.close(error => error ? reject(error) : resolve()));
}

test('local training persists exercises, templates and an assigned member plan', async () => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'under-fit-training-'));
  const dbPath = path.join(tempDirectory, 'training.db');
  let db;

  try {
    await migrarUsuarios(dbPath);
    await migrarEntrenamientoLocal(dbPath);
    db = new sqlite3.Database(dbPath);
    await run(db, `
      INSERT INTO usuarios (
        ci, nombre, numero, email, fecha_creacion, ultima_actualizacion,
        fecha_vencimiento, fecha_nacimiento, direccion
      ) VALUES (
        49990001, 'Martina Silva', '099000001', 'martina@example.com',
        '2026-01-01', '2026-08-01', '2026-09-01', '1994-05-14', 'Montevideo'
      )
    `);

    const service = createLocalTrainingService({
      trainingRepository: createTrainingRepository(db),
      userRepository: { findByCi: async ci => Number(ci) === 49990001 ? { ci, nombre: 'Martina Silva' } : null },
      staffRepository: { findProfessorById: async id => Number(id) === 7 ? { id: 7, nombre: 'Santiago Pérez', activo: 1 } : null },
    });
    const exercise = await service.createExercise({
      name: 'Sentadilla goblet',
      muscleGroup: 'Piernas',
      instructions: 'Mantener el torso estable.',
      gifUrl: 'assets/exercises/squat.svg',
    });
    const days = [{
      name: 'Día A',
      muscleGroups: 'Piernas',
      exercises: [{ exerciseId: exercise.id, sets: 4, repetitions: '10', restSeconds: 75, notes: 'Usar un banco como referencia.' }],
    }];

    await service.saveTemplate({ name: 'Fuerza inicial', days });
    await service.assignWorkoutPlan(49990001, { name: 'Rutina de Martina', professorId: 7, days });

    const [exercises, templates, plans] = await Promise.all([
      service.listExercises(false),
      service.listTemplates(),
      service.listMemberPlans(),
    ]);
    assert.equal(exercises[0].name, 'Sentadilla goblet');
    assert.equal(templates[0].days[0].exercises[0].sets, 4);
    assert.equal(templates[0].days[0].exercises[0].notes, 'Usar un banco como referencia.');
    assert.equal(plans[0].memberName, 'Martina Silva');
    assert.equal(plans[0].plan.professorName, 'Santiago Pérez');
    assert.equal(plans[0].plan.days[0].exercises[0].name, 'Sentadilla goblet');
    assert.equal(plans[0].plan.days[0].exercises[0].notes, 'Usar un banco como referencia.');
  } finally {
    if (db) await close(db);
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
});
