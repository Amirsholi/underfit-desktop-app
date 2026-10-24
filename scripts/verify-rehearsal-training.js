const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { validateCopy, validateTarget } = require('./import-rehearsal');
const { readTraining } = require('./importLegacyTraining');
const { deterministicUuid: uuid } = require('./importLegacyMasters');
const container = 'underfit-rehearsal-postgres-1';
function docker(args) {
  const r = spawnSync('docker', args, { encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) throw new Error(r.stderr || 'Docker failed');
  return r.stdout.trim();
}
function table(name) {
  return JSON.parse(docker(['exec', container, 'psql', '-U', 'underfit', '-d', 'underfit', '-At', '-c', `SELECT COALESCE(json_agg(t),'[]') FROM ${name} t;`]));
}
async function main() {
  const source = process.argv[2];
  const manifest = JSON.parse(fs.readFileSync(source.replace(/\.db$/i, '.manifest.json'), 'utf8'));
  validateCopy(source, manifest);
  validateTarget(JSON.parse(docker(['inspect', container]))[0]);
  const data = await readTraining(source);
  const exercises = table('exercises'), templates = table('workout_templates'), plans = table('workout_plans'), days = table('workout_days'), items = table('workout_day_exercises');
  assert.equal(exercises.length, data.exercises.length);
  assert.equal(templates.length, data.templates.length);
  assert.equal(plans.length, data.plans.length);
  for (const row of data.exercises) {
    const actual = exercises.find(e => e.Id === row.id);
    assert.ok(actual);
    for (const [key, original] of Object.entries({ Name: row.nombre, MuscleGroup: row.grupo_muscular, Instructions: row.instrucciones, GifUrl: row.gif_url, IsActive: !!row.activo })) assert.deepEqual(actual[key], original);
  }
  for (const row of data.templates) {
    const actual = templates.find(t => t.Id === row.id);
    assert.equal(actual.Name, row.nombre);
    assert.deepEqual(actual.DaysJson, JSON.parse(row.dias_json));
  }
  let dayCount = 0, itemCount = 0;
  for (const row of data.plans) {
    const plan = plans.find(p => p.Id === uuid('underfit-legacy-workout-plan', row.id));
    assert.equal(plan.Name, row.nombre);
    assert.equal(plan.MemberId, uuid('underfit-member', row.usuario_ci));
    assert.equal(plan.ProfessorId, row.profesor_id);
    assert.equal(plan.IsActive, !!row.activo);
    for (const day of JSON.parse(row.dias_json)) {
      dayCount++;
      const target = days.find(d => d.WorkoutPlanId === plan.Id && d.Position === day.position);
      assert.equal(target.Name, day.name);
      assert.equal(target.MuscleGroups, day.muscleGroups);
      for (const exercise of day.exercises) {
        itemCount++;
        const item = items.find(i => i.WorkoutDayId === target.Id && i.Position === exercise.position);
        assert.ok(item);
        for (const [key, original] of Object.entries({ ExerciseId: exercise.exerciseId, Sets: exercise.sets, Repetitions: String(exercise.repetitions), Load: exercise.load ?? null, RestSeconds: exercise.restSeconds ?? null, Notes: exercise.notes ?? null })) assert.deepEqual(item[key], original);
      }
    }
  }
  assert.equal(days.length, dayCount);
  assert.equal(items.length, itemCount);
  validateCopy(source, manifest);
  console.log(JSON.stringify({ verified: true, exercises: exercises.length, templates: templates.length, plans: plans.length, days: dayCount, assignments: itemCount, sourceUnchanged: true, mediaNotCopied: true }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
