const sqlite3 = require('sqlite3');
const { deterministicUuid: uuid, executeSql } = require('./importLegacyMasters');
const text = value => value == null ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`;
const flag = value => Number(value) === 1 ? 'TRUE' : 'FALSE';
const all = (db, sql) => new Promise((resolve, reject) => db.all(sql, (e, rows) => e ? reject(e) : resolve(rows)));
async function readTraining(source) {
  const db = new sqlite3.Database(source, sqlite3.OPEN_READONLY);
  try {
    const names = new Set((await all(db, "SELECT name FROM sqlite_master WHERE type='table'")).map(r => r.name));
    const read = name => names.has(name) ? all(db, `SELECT * FROM ${name}`) : [];
    return { exercises: await read('ejercicios'), templates: await read('plantillas_rutina'), plans: await read('rutinas_socios'), members: await read('usuarios'), professors: await read('profesores') };
  } finally { await new Promise(resolve => db.close(resolve)); }
}
function daysOf(row, exercises) {
  const days = JSON.parse(row.dias_json);
  if (!Array.isArray(days)) throw new Error(`Rutina ${row.id}: días inválidos`);
  const positions = new Set();
  for (const day of days) {
    if (!Number.isInteger(day.position) || day.position < 1 || positions.has(day.position)) throw new Error(`Rutina ${row.id}: orden de días inválido`);
    positions.add(day.position);
    if (!Array.isArray(day.exercises)) throw new Error(`Rutina ${row.id}: ejercicios inválidos`);
    const exercisePositions = new Set();
    for (const exercise of day.exercises) {
      if (!exercises.has(exercise.exerciseId) || !Number.isInteger(exercise.sets) || exercise.sets < 1 || exercise.sets > 20 || !String(exercise.repetitions ?? '').trim() || !Number.isInteger(exercise.position) || exercise.position < 1 || exercisePositions.has(exercise.position)) throw new Error(`Rutina ${row.id}: referencia, series, repeticiones u orden inválidos`);
      exercisePositions.add(exercise.position);
    }
  }
  return days;
}
function buildTrainingSql(data) {
  const exercises = new Set(data.exercises.map(r => r.id));
  const members = new Set(data.members.map(r => String(r.ci)));
  const professors = new Set(data.professors.map(r => r.id));
  const sql = ['BEGIN;', `CREATE TABLE IF NOT EXISTS legacy_training_source ("SourceTable" text NOT NULL,"SourceId" text NOT NULL,"Payload" jsonb NOT NULL, PRIMARY KEY ("SourceTable","SourceId"));`];
  function provenance(table, row, target) {
    sql.push(`INSERT INTO legacy_training_source VALUES (${text(table)},${text(row.id)},${text(JSON.stringify(row))}::jsonb) ON CONFLICT DO NOTHING;`);
    sql.push(`INSERT INTO legacy_import_map ("SourceTable","SourceId","TargetKey") VALUES (${text(table)},${text(row.id)},${text(target)}) ON CONFLICT DO NOTHING;`);
  }
  function guard(table, sourceTable, id) {
    sql.push(`DO $$ BEGIN IF EXISTS (SELECT 1 FROM ${table} WHERE "Id"=${Number(id)}) AND NOT EXISTS (SELECT 1 FROM legacy_import_map WHERE "SourceTable"=${text(sourceTable)} AND "SourceId"=${text(id)} AND "TargetKey"=${text(id)}) THEN RAISE EXCEPTION 'Training ID collision'; END IF; END $$;`);
  }
  for (const row of data.exercises) {
    guard('exercises', 'ejercicios', row.id);
    sql.push(`INSERT INTO exercises ("Id","Name","MuscleGroup","Instructions","GifUrl","IsActive") VALUES (${Number(row.id)},${text(row.nombre)},${text(row.grupo_muscular)},${text(row.instrucciones)},${text(row.gif_url)},${flag(row.activo)}) ON CONFLICT ("Id") DO NOTHING;`);
    provenance('ejercicios', row, row.id);
  }
  for (const row of data.templates) {
    daysOf(row, exercises);
    guard('workout_templates', 'plantillas_rutina', row.id);
    sql.push(`INSERT INTO workout_templates ("Id","Name","DaysJson","IsActive","CreatedAtUtc","UpdatedAtUtc") VALUES (${Number(row.id)},${text(row.nombre)},${text(row.dias_json)}::jsonb,${flag(row.activo)},${text(row.creado_ts)},${text(row.actualizado_ts)}) ON CONFLICT ("Id") DO NOTHING;`);
    provenance('plantillas_rutina', row, row.id);
  }
  for (const row of data.plans) {
    if (!members.has(String(row.usuario_ci)) || !professors.has(row.profesor_id)) throw new Error(`Rutina ${row.id}: socio o profesor inexistente`);
    const days = daysOf(row, exercises);
    const planId = uuid('underfit-legacy-workout-plan', row.id);
    sql.push(`INSERT INTO workout_plans ("Id","MemberId","Name","ProfessorId","IsActive","CreatedAtUtc","FinishedAtUtc") VALUES (${text(planId)},(SELECT "Id" FROM members WHERE "IdentityNumber"=${text(row.usuario_ci)}),${text(row.nombre)},${Number(row.profesor_id)},${flag(row.activo)},${text(row.asignado_ts)},NULL) ON CONFLICT ("Id") DO NOTHING;`);
    for (const day of days) {
      const dayId = uuid('underfit-legacy-workout-day', `${row.id}:${day.position}`);
      sql.push(`INSERT INTO workout_days ("Id","WorkoutPlanId","Position","Name","MuscleGroups") VALUES (${text(dayId)},${text(planId)},${day.position},${text(day.name)},${text(day.muscleGroups)}) ON CONFLICT ("Id") DO NOTHING;`);
      for (const item of day.exercises) {
        const itemId = uuid('underfit-legacy-workout-item', `${row.id}:${day.position}:${item.position}`);
        sql.push(`INSERT INTO workout_day_exercises ("Id","WorkoutDayId","ExerciseId","Position","Sets","Repetitions","Load","RestSeconds","Notes") VALUES (${text(itemId)},${text(dayId)},${item.exerciseId},${item.position},${item.sets},${text(item.repetitions)},${text(item.load)},${item.restSeconds == null ? 'NULL' : Number(item.restSeconds)},${text(item.notes)}) ON CONFLICT ("Id") DO NOTHING;`);
      }
    }
    provenance('rutinas_socios', row, planId);
  }
  for (const table of ['exercises', 'workout_templates']) sql.push(`SELECT setval(pg_get_serial_sequence('${table}','Id'),GREATEST(COALESCE((SELECT MAX("Id") FROM ${table}),1),1),true);`);
  sql.push('COMMIT;');
  return sql.join('\n');
}
async function importLegacyTraining(source, { apply = false } = {}) {
  const data = await readTraining(source);
  const sql = buildTrainingSql(data);
  if (apply) executeSql(sql);
  return { applied: apply, exercises: data.exercises.length, templates: data.templates.length, plans: data.plans.length, mediaFilesCopied: false };
}
module.exports = { importLegacyTraining, buildTrainingSql, readTraining };
