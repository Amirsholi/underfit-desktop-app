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
        SELECT i.fecha, i.hora, i.ci, u.nombre, i.fuente, i.observacion
        FROM ingresos i
        LEFT JOIN usuarios u ON u.ci = i.ci
        ${where}
        ORDER BY i.fecha DESC, i.hora DESC
      `;

      db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  return {
    create,
    findByDateRange,
  };
}

module.exports = { createEntryRepository };
