function createOperationsRepository(db) {
  function run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve(this);
      });
    });
  }

  function get(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) return reject(err);
        resolve(row || null);
      });
    });
  }

  function all(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
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

  async function syncLocationOneStock() {
    await run(`
      INSERT OR IGNORE INTO stock_local (local_id, producto_id, cantidad, actualizado_ts)
      SELECT 1, id, stock, datetime('now') FROM productos
    `);
    await run(`
      UPDATE stock_local
      SET cantidad = (SELECT p.stock FROM productos p WHERE p.id = stock_local.producto_id),
          actualizado_ts = datetime('now')
      WHERE local_id = 1
        AND EXISTS (SELECT 1 FROM productos p WHERE p.id = stock_local.producto_id)
    `);
    await run(`
      INSERT OR IGNORE INTO stock_local (local_id, producto_id, cantidad, actualizado_ts)
      SELECT 2, id, 0, datetime('now') FROM productos
    `);
  }

  async function listStockByLocation() {
    await syncLocationOneStock();
    return all(`
      SELECT p.id AS productoId, p.nombre, p.precio,
             COALESCE(s1.cantidad, p.stock, 0) AS local1,
             COALESCE(s2.cantidad, 0) AS local2,
             COALESCE(s1.cantidad, p.stock, 0) + COALESCE(s2.cantidad, 0) AS total,
             EXISTS (
               SELECT 1
               FROM transferencias_stock t
               WHERE t.producto_id = p.id
                 AND t.origen_local_id = 1
                 AND t.destino_local_id = 2
             ) AS asignadoLocal2,
             MAX(COALESCE(s1.actualizado_ts, ''), COALESCE(s2.actualizado_ts, '')) AS actualizadoTs
      FROM productos p
      LEFT JOIN stock_local s1 ON s1.producto_id = p.id AND s1.local_id = 1
      LEFT JOIN stock_local s2 ON s2.producto_id = p.id AND s2.local_id = 2
      GROUP BY p.id, p.nombre, p.precio, p.stock, s1.cantidad, s2.cantidad
      ORDER BY LOWER(p.nombre), p.id
    `);
  }

  async function transferStock({ productoId, cantidad, responsable, fecha, hora, ts }) {
    return inTransaction(async () => {
      const product = await get(`SELECT id, nombre, precio, stock FROM productos WHERE id = ?`, [productoId]);
      if (!product) throw new Error('Producto no encontrado');
      if (Number(product.stock) < cantidad) throw new Error('Stock insuficiente en el Local 1');

      const newMainStock = Number(product.stock) - cantidad;
      await run(`UPDATE productos SET stock = ? WHERE id = ?`, [newMainStock, productoId]);
      await run(`
        INSERT INTO stock_local (local_id, producto_id, cantidad, actualizado_ts)
        VALUES (1, ?, ?, ?)
        ON CONFLICT(local_id, producto_id) DO UPDATE SET cantidad = excluded.cantidad, actualizado_ts = excluded.actualizado_ts
      `, [productoId, newMainStock, ts]);
      await run(`
        INSERT INTO stock_local (local_id, producto_id, cantidad, actualizado_ts)
        VALUES (2, ?, ?, ?)
        ON CONFLICT(local_id, producto_id) DO UPDATE SET cantidad = stock_local.cantidad + excluded.cantidad, actualizado_ts = excluded.actualizado_ts
      `, [productoId, cantidad, ts]);
      const transfer = await run(`
        INSERT INTO transferencias_stock (
          producto_id, origen_local_id, destino_local_id, cantidad, responsable, fecha, hora, ts
        ) VALUES (?, 1, 2, ?, ?, ?, ?, ?)
      `, [productoId, cantidad, responsable || null, fecha, hora, ts]);

      return { id: transfer.lastID, producto: product.nombre, cantidad, local1: newMainStock };
    });
  }

  function listLocations() {
    return all(`
      SELECT id, codigo, nombre, tipo, activo
      FROM locales
      WHERE activo = 1
      ORDER BY id
    `);
  }

  function listActiveClassSchedules() {
    return all(`
      SELECT id, nombre, local_id AS localId, profesor_id AS profesorId,
             profesor_nombre AS profesor, dias_semana AS diasSemana, hora,
             duracion_minutos AS duracionMinutos, capacidad,
             fecha_inicio AS fechaInicio, fecha_fin AS fechaFin, notas, estado,
             creado_ts AS creadoTs, actualizado_ts AS actualizadoTs
      FROM programaciones_clase
      WHERE estado = 'activa'
      ORDER BY hora, LOWER(nombre), id
    `);
  }

  async function addScheduleOccurrences(schedule, dates, createdTs) {
    if (!dates.length) return { added: 0 };
    return inTransaction(async () => {
      let added = 0;
      for (const date of dates) {
        const result = await run(`
          INSERT OR IGNORE INTO clases (
            nombre, fecha, hora, duracion_minutos, capacidad, profesor, profesor_id,
            local_id, notas, estado, creado_ts, programacion_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'programada', ?, ?)
        `, [schedule.nombre, date, schedule.hora, schedule.duracionMinutos, schedule.capacidad,
          schedule.profesor, schedule.profesorId, schedule.localId, schedule.notas, createdTs, schedule.id]);
        added += Number(result.changes || 0);
      }
      return { added };
    });
  }

  async function createClassSchedule(data) {
    return inTransaction(async () => {
      const result = await run(`
        INSERT INTO programaciones_clase (
          nombre, local_id, profesor_id, profesor_nombre, dias_semana, hora,
          duracion_minutos, capacidad, fecha_inicio, fecha_fin, notas, estado,
          creado_ts, actualizado_ts
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'activa', ?, ?)
      `, [data.nombre, data.localId, data.profesorId, data.profesor, data.diasSemana,
        data.hora, data.duracionMinutos, data.capacidad, data.fechaInicio, data.fechaFin,
        data.notas, data.creadoTs, data.creadoTs]);
      const schedule = { id: result.lastID, ...data, estado: 'activa' };
      for (const date of data.occurrenceDates) {
        await run(`
          INSERT OR IGNORE INTO clases (
            nombre, fecha, hora, duracion_minutos, capacidad, profesor, profesor_id,
            local_id, notas, estado, creado_ts, programacion_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'programada', ?, ?)
        `, [data.nombre, date, data.hora, data.duracionMinutos, data.capacidad,
          data.profesor, data.profesorId, data.localId, data.notas, data.creadoTs, result.lastID]);
      }
      return schedule;
    });
  }

  function listClasses({ fromDate, limit = 50 }) {
    return all(`
      SELECT c.id, c.nombre, c.fecha, c.hora, c.duracion_minutos AS duracionMinutos,
             c.capacidad, c.profesor, c.profesor_id AS profesorId, c.local_id AS localId,
             l.nombre AS localNombre, c.notas, c.estado, c.programacion_id AS programacionId,
             pc.dias_semana AS diasSemana,
             CASE
               WHEN c.programacion_id IS NOT NULL THEN (
                 SELECT COUNT(*) FROM inscripciones_programacion_clase ip
                 WHERE ip.programacion_id = c.programacion_id AND ip.estado = 'inscripto'
               )
               ELSE (
                 SELECT COUNT(*) FROM inscripciones_clase ic
                 WHERE ic.clase_id = c.id AND ic.estado = 'inscripto'
               )
             END AS inscriptos
      FROM clases c
      LEFT JOIN programaciones_clase pc ON pc.id = c.programacion_id
      LEFT JOIN locales l ON l.id = c.local_id
      WHERE c.fecha >= ? AND c.estado IN ('programada', 'en_curso')
      ORDER BY c.fecha ASC, c.hora ASC, c.id ASC
      LIMIT ?
    `, [fromDate, limit]);
  }

  async function createClass(data) {
    const result = await run(`
      INSERT INTO clases (
        nombre, fecha, hora, duracion_minutos, capacidad, profesor, profesor_id, local_id, notas, estado, creado_ts
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 2, ?, 'programada', ?)
    `, [data.nombre, data.fecha, data.hora, data.duracionMinutos, data.capacidad, data.profesor,
      data.profesorId, data.notas, data.creadoTs]);
    return get(`SELECT * FROM clases WHERE id = ?`, [result.lastID]);
  }

  async function listClassEnrollments(classId) {
    const classRow = await get(`SELECT id, programacion_id AS programacionId FROM clases WHERE id = ?`, [classId]);
    if (!classRow) return [];
    if (classRow.programacionId) {
      return all(`
        SELECT id, programacion_id AS programacionId, usuario_ci AS usuarioCi,
               usuario_nombre AS usuarioNombre, estado, creado_ts AS creadoTs
        FROM inscripciones_programacion_clase
        WHERE programacion_id = ? AND estado = 'inscripto'
        ORDER BY LOWER(usuario_nombre), id
      `, [classRow.programacionId]);
    }
    return all(`
        SELECT id, clase_id AS claseId, usuario_ci AS usuarioCi, usuario_nombre AS usuarioNombre, estado, creado_ts AS creadoTs
        FROM inscripciones_clase
        WHERE clase_id = ? AND estado = 'inscripto'
        ORDER BY LOWER(usuario_nombre), id
      `, [classId]);
  }

  async function enrollMember({ classId, userCi, userName, createdTs }) {
    return inTransaction(async () => {
      const classRow = await get(`SELECT id, capacidad, estado, programacion_id AS programacionId FROM clases WHERE id = ?`, [classId]);
      if (!classRow || classRow.estado !== 'programada') throw new Error('Clase no disponible');
      const existing = classRow.programacionId
        ? await get(`SELECT id FROM inscripciones_programacion_clase WHERE programacion_id = ? AND usuario_ci = ? AND estado = 'inscripto'`, [classRow.programacionId, userCi])
        : await get(`SELECT id FROM inscripciones_clase WHERE clase_id = ? AND usuario_ci = ? AND estado = 'inscripto'`, [classId, userCi]);
      if (existing) throw new Error('El socio ya está inscripto en esta clase');
      const count = classRow.programacionId
        ? await get(`SELECT COUNT(*) AS total FROM inscripciones_programacion_clase WHERE programacion_id = ? AND estado = 'inscripto'`, [classRow.programacionId])
        : await get(`SELECT COUNT(*) AS total FROM inscripciones_clase WHERE clase_id = ? AND estado = 'inscripto'`, [classId]);
      if (Number(count?.total || 0) >= Number(classRow.capacidad || 0)) throw new Error('La clase no tiene cupos disponibles');
      try {
        if (classRow.programacionId) {
          const result = await run(`
            INSERT INTO inscripciones_programacion_clase (programacion_id, usuario_ci, usuario_nombre, estado, creado_ts)
            VALUES (?, ?, ?, 'inscripto', ?)
          `, [classRow.programacionId, userCi, userName, createdTs]);
          return { id: result.lastID, classId, programacionId: classRow.programacionId, userCi, userName };
        }
        const result = await run(`
            INSERT INTO inscripciones_clase (clase_id, usuario_ci, usuario_nombre, estado, creado_ts)
            VALUES (?, ?, ?, 'inscripto', ?)
          `, [classId, userCi, userName, createdTs]);
        return { id: result.lastID, classId, programacionId: null, userCi, userName };
      } catch (error) {
        if (String(error?.message || '').includes('UNIQUE')) throw new Error('El socio ya está inscripto en esta clase');
        throw error;
      }
    });
  }

  function listClassCandidates({ localId, fecha }) {
    return all(`
      SELECT c.id, c.nombre, c.fecha, c.hora,
             c.duracion_minutos AS duracionMinutos, c.capacidad,
             c.profesor AS profesorProgramado, c.profesor_id AS profesorProgramadoId,
             c.local_id AS localId, l.nombre AS localNombre, c.estado,
             c.programacion_id AS programacionId
      FROM clases c
      LEFT JOIN locales l ON l.id = c.local_id
      WHERE c.local_id = ? AND c.fecha = ? AND c.estado IN ('programada', 'en_curso')
      ORDER BY c.hora, c.id
    `, [localId, fecha]);
  }

  function findNextClass({ localId, fecha, hora }) {
    return get(`
      SELECT c.id, c.nombre, c.fecha, c.hora,
             c.duracion_minutos AS duracionMinutos, c.capacidad,
             c.profesor AS profesorProgramado, c.profesor_id AS profesorProgramadoId,
             c.local_id AS localId, l.nombre AS localNombre, c.estado,
             c.programacion_id AS programacionId
      FROM clases c
      LEFT JOIN locales l ON l.id = c.local_id
      WHERE c.local_id = ? AND c.estado = 'programada'
        AND (c.fecha > ? OR (c.fecha = ? AND c.hora > ?))
      ORDER BY c.fecha, c.hora, c.id
      LIMIT 1
    `, [localId, fecha, fecha, hora]);
  }

  function listClassLifecycleCandidates(fecha) {
    return all(`
      SELECT id, nombre, fecha, hora, duracion_minutos AS duracionMinutos,
             local_id AS localId, estado, inicio_real_ts AS inicioRealTs
      FROM clases
      WHERE fecha <= ? AND estado IN ('programada', 'en_curso')
      ORDER BY fecha, hora, id
    `, [fecha]);
  }

  async function setClassLifecycleState({ classId, estado, inicioTs, finTs }) {
    const result = estado === 'en_curso'
      ? await run(`
          UPDATE clases
          SET estado = 'en_curso', inicio_real_ts = COALESCE(inicio_real_ts, ?)
          WHERE id = ? AND estado = 'programada'
        `, [inicioTs, classId])
      : await run(`
          UPDATE clases
          SET estado = 'dictada',
              inicio_real_ts = COALESCE(inicio_real_ts, ?),
              fin_real_ts = COALESCE(fin_real_ts, ?)
          WHERE id = ? AND estado IN ('programada', 'en_curso')
        `, [inicioTs, finTs, classId]);
    return { classId, estado, changed: result.changes > 0 };
  }

  async function registerClassAttendance(data) {
    return inTransaction(async () => {
      const classRow = await get(`
        SELECT id, nombre, fecha, hora, duracion_minutos AS duracionMinutos,
               local_id AS localId, programacion_id AS programacionId, estado
        FROM clases
        WHERE id = ?
      `, [data.claseId]);
      if (!classRow || !['programada', 'en_curso'].includes(classRow.estado)) {
        throw new Error('La clase no esta disponible para registrar asistencia');
      }
      if (Number(classRow.localId) !== Number(data.localId)) {
        throw new Error('La clase pertenece a otro local');
      }

      const duplicate = await get(`
        SELECT id FROM asistencias_clase
        WHERE clase_id = ? AND usuario_ci = ? AND COALESCE(anulado, 0) = 0
      `, [data.claseId, data.usuarioCi]);
      if (duplicate) throw new Error('La asistencia de este socio ya fue registrada');

      const entry = await run(`
        INSERT INTO ingresos (
          ci, fecha, hora, ts, fuente, observacion, local_id, dispositivo_id, clase_id
        ) VALUES (?, ?, ?, ?, 'tablet_clase', ?, ?, ?, ?)
      `, [data.usuarioCi, data.fecha, data.hora, data.ts, data.observacion,
        data.localId, data.dispositivoId, data.claseId]);

      let attendance;
      try {
        attendance = await run(`
          INSERT INTO asistencias_clase (
            clase_id, programacion_id, usuario_ci, ingreso_id, local_id,
            profesor_id, profesor_sesion_id, dispositivo_id, fecha, hora, ts, estado
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'presente')
        `, [data.claseId, classRow.programacionId, data.usuarioCi, entry.lastID, data.localId,
          data.profesorId, data.profesorSesionId, data.dispositivoId, data.fecha, data.hora, data.ts]);
      } catch (error) {
        if (String(error?.message || '').includes('UNIQUE')) {
          throw new Error('La asistencia de este socio ya fue registrada');
        }
        throw error;
      }

      return {
        id: attendance.lastID,
        ingresoId: entry.lastID,
        claseId: data.claseId,
        claseNombre: classRow.nombre,
        usuarioCi: data.usuarioCi,
        fecha: data.fecha,
        hora: data.hora,
      };
    });
  }

  async function setClassHeldStatus({ classId, estado, changedTs }) {
    const result = estado === 'cancelada'
      ? await run(`
          UPDATE clases
          SET estado = 'cancelada', cancelada_ts = ?, motivo_cancelacion = NULL
          WHERE id = ? AND estado = 'dictada'
        `, [changedTs, classId])
      : await run(`
          UPDATE clases
          SET estado = 'dictada', cancelada_ts = NULL, motivo_cancelacion = NULL
          WHERE id = ? AND estado = 'cancelada'
        `, [classId]);
    if (!result.changes) throw new Error('El estado de la clase no cambio');
    return { classId, estado, realizada: estado === 'dictada' };
  }

  function listClassRecordsByDate(fecha) {
    return all(`
      SELECT c.id, c.nombre, c.fecha, c.hora,
             c.duracion_minutos AS duracionMinutos, c.capacidad,
             c.local_id AS localId, l.nombre AS localNombre,
             c.profesor AS profesorProgramado,
             c.profesor_id AS profesorProgramadoId,
             c.estado, c.inicio_real_ts AS inicioRealTs, c.fin_real_ts AS finRealTs,
             c.programacion_id AS programacionId,
             CASE WHEN c.programacion_id IS NOT NULL THEN (
               SELECT COUNT(*) FROM inscripciones_programacion_clase ip
               WHERE ip.programacion_id = c.programacion_id AND ip.estado = 'inscripto'
             ) ELSE (
               SELECT COUNT(*) FROM inscripciones_clase ic
               WHERE ic.clase_id = c.id AND ic.estado = 'inscripto'
             ) END AS inscriptos,
             (SELECT COUNT(*) FROM asistencias_clase ac
              WHERE ac.clase_id = c.id AND COALESCE(ac.anulado, 0) = 0) AS presentes
      FROM clases c
      LEFT JOIN locales l ON l.id = c.local_id
      WHERE c.fecha = ?
      ORDER BY c.hora, c.id
    `, [fecha]);
  }

  async function getClassRecordDetail(classId) {
    const classRow = await get(`
      SELECT c.id, c.nombre, c.fecha, c.hora,
             c.duracion_minutos AS duracionMinutos, c.capacidad,
             c.local_id AS localId, l.nombre AS localNombre,
             c.profesor AS profesorProgramado,
             c.profesor_id AS profesorProgramadoId,
             c.estado, c.inicio_real_ts AS inicioRealTs, c.fin_real_ts AS finRealTs,
             c.programacion_id AS programacionId
      FROM clases c
      LEFT JOIN locales l ON l.id = c.local_id
      WHERE c.id = ?
    `, [classId]);
    if (!classRow) return null;

    const enrolledSql = classRow.programacionId
      ? `SELECT usuario_ci AS usuarioCi, usuario_nombre AS usuarioNombre
         FROM inscripciones_programacion_clase
         WHERE programacion_id = ? AND estado = 'inscripto'`
      : `SELECT usuario_ci AS usuarioCi, usuario_nombre AS usuarioNombre
         FROM inscripciones_clase
         WHERE clase_id = ? AND estado = 'inscripto'`;
    const enrolled = await all(enrolledSql, [classRow.programacionId || classId]);
    const attendances = await all(`
      SELECT ac.id, ac.usuario_ci AS usuarioCi, u.nombre AS usuarioNombre,
             ac.hora, ac.dispositivo_id AS dispositivoId
      FROM asistencias_clase ac
      LEFT JOIN usuarios u ON u.ci = ac.usuario_ci
      WHERE ac.clase_id = ? AND COALESCE(ac.anulado, 0) = 0
      ORDER BY ac.hora, LOWER(u.nombre), ac.id
    `, [classId]);
    const attendanceByUser = new Map(attendances.map(row => [Number(row.usuarioCi), row]));
    const students = enrolled.map(student => {
      const attendance = attendanceByUser.get(Number(student.usuarioCi));
      attendanceByUser.delete(Number(student.usuarioCi));
      return {
        ...student,
        presente: Boolean(attendance),
        horaIngreso: attendance?.hora || null,
        dispositivoId: attendance?.dispositivoId || null,
      };
    });
    for (const attendance of attendanceByUser.values()) {
      students.push({
        usuarioCi: attendance.usuarioCi,
        usuarioNombre: attendance.usuarioNombre || `Socio ${attendance.usuarioCi}`,
        presente: true,
        noInscripto: true,
        horaIngreso: attendance.hora,
        dispositivoId: attendance.dispositivoId,
      });
    }
    students.sort((a, b) => Number(b.presente) - Number(a.presente)
      || String(a.usuarioNombre).localeCompare(String(b.usuarioNombre), 'es'));
    return { ...classRow, students };
  }

  function listPendingSales({ estado = 'pendiente', fecha = null } = {}) {
    const conditions = [];
    const params = [];
    if (estado) {
      conditions.push('vp.estado = ?');
      params.push(estado);
    }
    if (fecha) {
      conditions.push('vp.fecha = ?');
      params.push(fecha);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return all(`
      SELECT vp.id, vp.local_id AS localId, l.nombre AS localNombre,
             vp.producto_id AS productoId, vp.producto_nombre AS productoNombre,
             vp.usuario_ci AS usuarioCi, vp.usuario_nombre AS usuarioNombre,
             vp.cantidad, vp.total, vp.profesor,
             vp.profesor_id AS profesorId, vp.profesor_sesion_id AS profesorSesionId,
             vp.fecha, vp.hora, vp.ts, vp.estado, vp.cobrado_ts AS cobradoTs,
             vp.forma_pago AS formaPago, vp.caja_movimiento_id AS cajaMovimientoId,
             vp.observacion
      FROM ventas_pendientes vp
      LEFT JOIN locales l ON l.id = vp.local_id
      ${where}
      ORDER BY vp.ts DESC, vp.id DESC
    `, params);
  }

  async function getPendingSummaryByDate(fecha) {
    const row = await get(`
      SELECT COUNT(*) AS cantidad, COALESCE(SUM(total), 0) AS total
      FROM ventas_pendientes
      WHERE fecha = ? AND estado = 'pendiente'
    `, [fecha]);
    return { cantidad: Number(row?.cantidad || 0), total: Number(row?.total || 0) };
  }

  function findPendingSaleById(id) {
    return get(`SELECT * FROM ventas_pendientes WHERE id = ?`, [id]);
  }

  function markPendingSaleCollected({ id, formaPago, cobradoTs, cajaMovimientoId }) {
    return run(`
      UPDATE ventas_pendientes
      SET estado = 'cobrada', forma_pago = ?, cobrado_ts = ?, caja_movimiento_id = ?
      WHERE id = ? AND estado = 'pendiente'
    `, [formaPago, cobradoTs, cajaMovimientoId, id]);
  }

  async function createPendingSale(data) {
    return inTransaction(async () => {
      const localId = Number(data.localId || 2);
      if (localId === 1) {
        const product = await get(`SELECT stock FROM productos WHERE id = ?`, [data.productoId]);
        if (!product || Number(product.stock) < data.cantidad) throw new Error('Stock insuficiente en el local de la tablet');
        const nextStock = Number(product.stock) - data.cantidad;
        await run(`UPDATE productos SET stock = ? WHERE id = ?`, [nextStock, data.productoId]);
        await run(`
          INSERT INTO stock_local (local_id, producto_id, cantidad, actualizado_ts)
          VALUES (1, ?, ?, ?)
          ON CONFLICT(local_id, producto_id) DO UPDATE
          SET cantidad = excluded.cantidad, actualizado_ts = excluded.actualizado_ts
        `, [data.productoId, nextStock, data.ts]);
      } else {
        const stock = await get(`SELECT cantidad FROM stock_local WHERE local_id = ? AND producto_id = ?`, [localId, data.productoId]);
        if (!stock || Number(stock.cantidad) < data.cantidad) throw new Error('Stock insuficiente en el local de la tablet');
        await run(`UPDATE stock_local SET cantidad = cantidad - ?, actualizado_ts = ? WHERE local_id = ? AND producto_id = ?`, [data.cantidad, data.ts, localId, data.productoId]);
      }
      const result = await run(`
        INSERT INTO ventas_pendientes (
          local_id, producto_id, producto_nombre, usuario_ci, usuario_nombre, cantidad, total,
          profesor, profesor_id, profesor_sesion_id, fecha, hora, ts, estado, observacion
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', ?)
      `, [localId, data.productoId, data.productoNombre, data.usuarioCi, data.usuarioNombre, data.cantidad,
        data.total, data.profesor, data.profesorId, data.profesorSesionId, data.fecha, data.hora,
        data.ts, data.observacion]);
      return { id: result.lastID, ...data, localId, estado: 'pendiente' };
    });
  }

  return {
    listStockByLocation,
    transferStock,
    listLocations,
    listActiveClassSchedules,
    addScheduleOccurrences,
    createClassSchedule,
    listClasses,
    createClass,
    listClassEnrollments,
    enrollMember,
    listClassCandidates,
    findNextClass,
    listClassLifecycleCandidates,
    setClassLifecycleState,
    registerClassAttendance,
    setClassHeldStatus,
    listClassRecordsByDate,
    getClassRecordDetail,
    listPendingSales,
    getPendingSummaryByDate,
    findPendingSaleById,
    markPendingSaleCollected,
    createPendingSale,
  };
}

module.exports = { createOperationsRepository };
