function createEntryRepository(db) {
  function create({ ci, fecha, hora, ts, fuente = 'kiosk', observacion = null }) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO ingresos (ci, fecha, hora, ts, fuente, observacion)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      db.run(sql, [ci, fecha, hora, ts, fuente, observacion], function (err) {
        if (err) return reject(err);
        resolve({ id: this.lastID, fecha, hora, ts });
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
        SELECT i.id, i.fecha, i.hora, i.ci, u.nombre, i.fuente, i.observacion
        FROM ingresos i
        LEFT JOIN usuarios u ON u.ci = i.ci
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

  function annul({ id, ts, motivo }) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE ingresos
         SET anulado = 1, anulado_ts = ?, motivo_anulacion = ?
         WHERE id = ? AND COALESCE(anulado, 0) = 0`,
        [ts, motivo, id],
        function (err) {
          if (err) return reject(err);
          resolve({ changed: this.changes > 0 });
        }
      );
    });
  }

  return {
    create,
    findByDateRange,
    findById,
    annul,
  };
}

module.exports = { createEntryRepository };
