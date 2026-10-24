function createTrainingRepository(db) {
  function run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (error) {
        if (error) return reject(error);
        resolve(this);
      });
    });
  }

  function get(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (error, row) => {
        if (error) return reject(error);
        resolve(row || null);
      });
    });
  }

  function all(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (error, rows) => {
        if (error) return reject(error);
        resolve(rows || []);
      });
    });
  }

  function listExercises(includeInactive = false) {
    return all(`
      SELECT id, nombre AS name, grupo_muscular AS muscleGroup,
             instrucciones AS instructions, gif_url AS gifUrl, activo AS isActive
      FROM ejercicios
      ${includeInactive ? '' : 'WHERE activo = 1'}
      ORDER BY activo DESC, LOWER(nombre), id
    `);
  }

  async function createExercise(data) {
    const now = new Date().toISOString();
    const result = await run(`
      INSERT INTO ejercicios (nombre, grupo_muscular, instrucciones, gif_url, activo, creado_ts, actualizado_ts)
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `, [data.name, data.muscleGroup, data.instructions || null, data.gifUrl || null, now, now]);
    return getExercise(result.lastID);
  }

  function getExercise(id) {
    return get(`
      SELECT id, nombre AS name, grupo_muscular AS muscleGroup,
             instrucciones AS instructions, gif_url AS gifUrl, activo AS isActive
      FROM ejercicios WHERE id = ?
    `, [id]);
  }

  async function updateExercise(id, data) {
    await run(`
      UPDATE ejercicios
      SET nombre = ?, grupo_muscular = ?, instrucciones = ?, gif_url = ?, activo = ?, actualizado_ts = ?
      WHERE id = ?
    `, [data.name, data.muscleGroup, data.instructions || null, data.gifUrl || null, data.isActive ? 1 : 0, new Date().toISOString(), id]);
    return getExercise(id);
  }

  function listTemplates() {
    return all(`
      SELECT id, nombre AS name, dias_json AS daysJson, activo AS isActive, actualizado_ts AS updatedAtUtc
      FROM plantillas_rutina WHERE activo = 1
      ORDER BY LOWER(nombre), id
    `);
  }

  async function saveTemplate(data) {
    const now = new Date().toISOString();
    await run(`
      INSERT INTO plantillas_rutina (nombre, dias_json, activo, creado_ts, actualizado_ts)
      VALUES (?, ?, 1, ?, ?)
      ON CONFLICT(nombre) DO UPDATE SET dias_json = excluded.dias_json, activo = 1, actualizado_ts = excluded.actualizado_ts
    `, [data.name, JSON.stringify(data.days), now, now]);
    return get(`
      SELECT id, nombre AS name, dias_json AS daysJson, activo AS isActive, actualizado_ts AS updatedAtUtc
      FROM plantillas_rutina WHERE nombre = ?
    `, [data.name]);
  }

  function listMemberPlans() {
    return all(`
      SELECT r.id, r.usuario_ci AS identityNumber, u.nombre AS memberName,
             r.nombre AS name, r.profesor_id AS professorId,
             r.profesor_nombre AS professorName, r.dias_json AS daysJson,
             r.asignado_ts AS assignedAtUtc
      FROM rutinas_socios r
      JOIN usuarios u ON u.ci = r.usuario_ci
      WHERE r.activo = 1
      ORDER BY LOWER(u.nombre), r.id
    `);
  }

  async function assignMemberPlan(identityNumber, data) {
    const now = new Date().toISOString();
    await run(`
      INSERT INTO rutinas_socios (
        usuario_ci, nombre, profesor_id, profesor_nombre, dias_json,
        asignado_ts, actualizado_ts, activo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      ON CONFLICT(usuario_ci) DO UPDATE SET
        nombre = excluded.nombre,
        profesor_id = excluded.profesor_id,
        profesor_nombre = excluded.profesor_nombre,
        dias_json = excluded.dias_json,
        actualizado_ts = excluded.actualizado_ts,
        activo = 1
    `, [identityNumber, data.name, data.professorId, data.professorName, JSON.stringify(data.days), now, now]);
    return get(`
      SELECT r.id, r.usuario_ci AS identityNumber, u.nombre AS memberName,
             r.nombre AS name, r.profesor_id AS professorId,
             r.profesor_nombre AS professorName, r.dias_json AS daysJson,
             r.asignado_ts AS assignedAtUtc
      FROM rutinas_socios r JOIN usuarios u ON u.ci = r.usuario_ci
      WHERE r.usuario_ci = ?
    `, [identityNumber]);
  }

  return {
    listExercises,
    createExercise,
    getExercise,
    updateExercise,
    listTemplates,
    saveTemplate,
    listMemberPlans,
    assignMemberPlan,
  };
}

module.exports = { createTrainingRepository };
