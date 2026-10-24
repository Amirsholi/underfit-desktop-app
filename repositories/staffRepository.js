function createStaffRepository(db) {
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

  async function inTransaction(work) {
    await run('BEGIN IMMEDIATE TRANSACTION');
    try {
      const result = await work();
      await run('COMMIT');
      return result;
    } catch (error) {
      try { await run('ROLLBACK'); } catch (_) {}
      throw error;
    }
  }

  function listProfessors({ includeInactive = false } = {}) {
    return all(`
      SELECT id, nombre, activo, creado_ts AS creadoTs, actualizado_ts AS actualizadoTs,
             CASE WHEN pin_hash <> '' AND pin_salt <> '' THEN 1 ELSE 0 END AS pinConfigurado
      FROM profesores
      ${includeInactive ? '' : 'WHERE activo = 1'}
      ORDER BY activo DESC, LOWER(nombre), id
    `);
  }

  function findProfessorById(id) {
    return get(`
      SELECT id, nombre, pin_hash AS pinHash, pin_salt AS pinSalt, activo,
             creado_ts AS creadoTs, actualizado_ts AS actualizadoTs
      FROM profesores
      WHERE id = ?
    `, [id]);
  }

  async function createProfessor(data) {
    try {
      const result = await run(`
        INSERT INTO profesores (nombre, pin_hash, pin_salt, activo, creado_ts, actualizado_ts)
        VALUES (?, ?, ?, 1, ?, ?)
      `, [data.nombre, data.pinHash, data.pinSalt, data.creadoTs, data.actualizadoTs]);
      return findProfessorById(result.lastID);
    } catch (error) {
      if (String(error?.message || '').includes('UNIQUE')) throw new Error('Ya existe un profesor con ese nombre');
      throw error;
    }
  }

  async function updateProfessor(data) {
    try {
      await run(`
        UPDATE profesores
        SET nombre = ?, pin_hash = ?, pin_salt = ?, activo = ?, actualizado_ts = ?
        WHERE id = ?
      `, [data.nombre, data.pinHash, data.pinSalt, data.activo ? 1 : 0, data.actualizadoTs, data.id]);
      return findProfessorById(data.id);
    } catch (error) {
      if (String(error?.message || '').includes('UNIQUE')) throw new Error('Ya existe un profesor con ese nombre');
      throw error;
    }
  }

  async function closeProfessorSessions(professorId, finishedTs) {
    const result = await run(`
      UPDATE sesiones_profesor
      SET estado = 'cerrada', fin_ts = ?
      WHERE profesor_id = ? AND estado = 'activa'
    `, [finishedTs, professorId]);
    return { changed: result.changes };
  }

  async function startProfessorSession({ professorId, localId, deviceId, startedTs }) {
    return inTransaction(async () => {
      await run(`
        UPDATE sesiones_profesor
        SET estado = 'cerrada', fin_ts = ?
        WHERE dispositivo_id = ? AND estado = 'activa'
      `, [startedTs, deviceId]);

      const result = await run(`
        INSERT INTO sesiones_profesor (profesor_id, local_id, dispositivo_id, inicio_ts, estado)
        VALUES (?, ?, ?, ?, 'activa')
      `, [professorId, localId, deviceId, startedTs]);
      return findActiveSessionById(result.lastID);
    });
  }

  function findActiveSessionById(id) {
    return get(`
      SELECT s.id, s.profesor_id AS profesorId, p.nombre AS profesorNombre,
             s.local_id AS localId, s.dispositivo_id AS dispositivoId,
             s.inicio_ts AS inicioTs, s.estado
      FROM sesiones_profesor s
      JOIN profesores p ON p.id = s.profesor_id
      WHERE s.id = ? AND s.estado = 'activa' AND p.activo = 1
    `, [id]);
  }

  function findActiveSessionByDevice(deviceId) {
    return get(`
      SELECT s.id, s.profesor_id AS profesorId, p.nombre AS profesorNombre,
             s.local_id AS localId, s.dispositivo_id AS dispositivoId,
             s.inicio_ts AS inicioTs, s.estado
      FROM sesiones_profesor s
      JOIN profesores p ON p.id = s.profesor_id
      WHERE s.dispositivo_id = ? AND s.estado = 'activa' AND p.activo = 1
      ORDER BY s.inicio_ts DESC, s.id DESC
      LIMIT 1
    `, [deviceId]);
  }

  async function finishProfessorSession({ id, finishedTs }) {
    const result = await run(`
      UPDATE sesiones_profesor
      SET estado = 'cerrada', fin_ts = ?
      WHERE id = ? AND estado = 'activa'
    `, [finishedTs, id]);
    return { changed: result.changes > 0, id };
  }

  return {
    listProfessors,
    findProfessorById,
    createProfessor,
    updateProfessor,
    closeProfessorSessions,
    startProfessorSession,
    findActiveSessionById,
    findActiveSessionByDevice,
    finishProfessorSession,
  };
}

module.exports = { createStaffRepository };
