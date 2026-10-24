function createEntryRepository(db) {
  function create({
    ci,
    fecha,
    hora,
    ts,
    fuente = 'kiosk',
    observacion = null,
    localId = 1,
    dispositivoId = null,
    claseId = null,
  }) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO ingresos (
          ci, fecha, hora, ts, fuente, observacion, local_id, dispositivo_id, clase_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      db.run(sql, [ci, fecha, hora, ts, fuente, observacion, localId, dispositivoId, claseId], function (err) {
        if (err) return reject(err);
        resolve({ id: this.lastID, fecha, hora, ts, localId, dispositivoId, claseId });
      });
    });
  }

  function findByDateRange({ desde, hasta }) {
    return new Promise((resolve, reject) => {
      const params = [];
      let where = '';

      if (desde && hasta) {
        where = 'WHERE i.fecha BETWEEN ? AND ?';
        params.push(desde, hasta);
      } else if (desde) {
        where = 'WHERE i.fecha >= ?';
        params.push(desde);
      } else if (hasta) {
        where = 'WHERE i.fecha <= ?';
        params.push(hasta);
      }

      const sql = `
        SELECT i.id, i.fecha, i.hora, i.ci, u.nombre, i.fuente, i.observacion,
               i.local_id AS localId, l.nombre AS localNombre,
               i.dispositivo_id AS dispositivoId, i.clase_id AS claseId,
               c.nombre AS claseNombre
        FROM ingresos i
        LEFT JOIN usuarios u ON u.ci = i.ci
        LEFT JOIN locales l ON l.id = i.local_id
        LEFT JOIN clases c ON c.id = i.clase_id
        ${where ? `${where} AND` : 'WHERE'} COALESCE(i.anulado, 0) = 0
        ORDER BY i.fecha DESC, i.hora DESC
      `;

      db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  function findById(id) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM ingresos WHERE id = ?`, [id], (err, row) => {
        if (err) return reject(err);
        resolve(row || null);
      });
    });
  }

  function run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (error) {
        if (error) return reject(error);
        resolve(this);
      });
    });
  }

  async function annul({ id, ts, motivo }) {
    await run('BEGIN IMMEDIATE TRANSACTION');
    try {
      const entry = await run(
        `UPDATE ingresos
         SET anulado = 1, anulado_ts = ?, motivo_anulacion = ?
         WHERE id = ? AND COALESCE(anulado, 0) = 0`,
        [ts, motivo, id],
      );
      if (entry.changes > 0) {
        await run(
          `UPDATE asistencias_clase
           SET anulado = 1, anulado_ts = ?, motivo_anulacion = ?
           WHERE ingreso_id = ? AND COALESCE(anulado, 0) = 0`,
          [ts, motivo, id],
        );
      }
      await run('COMMIT');
      return { changed: entry.changes > 0 };
    } catch (error) {
      try { await run('ROLLBACK'); } catch (_) {}
      throw error;
    }
  }

  return {
    create,
    findByDateRange,
    findById,
    annul,
  };
}

module.exports = { createEntryRepository };
