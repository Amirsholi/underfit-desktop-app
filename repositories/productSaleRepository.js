function createProductSaleRepository(db) {
  function create({
    productoId,
    nombre,
    cantidad,
    total,
    fecha,
    hora,
    ts,
    formaPago = 'efectivo',
    montoRecibido = total,
    cambio = 0,
    observacion = null,
  }) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO ventas_productos (
          producto_id, nombre, cantidad, total, fecha, hora, ts, forma_pago, monto_recibido, cambio, observacion
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [productoId, nombre, cantidad, total, fecha, hora, ts, formaPago, montoRecibido, cambio, observacion],
        function (err) {
          if (err) return reject(err);
          resolve({
            id: this.lastID,
            productoId,
            nombre,
            cantidad,
            total,
            fecha,
            hora,
            ts,
            formaPago,
            montoRecibido,
            cambio,
            observacion,
          });
        }
      );
    });
  }

  function findByDate(fecha) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT id, producto_id AS productoId, nombre, cantidad, total, fecha, hora, ts,
                forma_pago AS formaPago, monto_recibido AS montoRecibido, cambio, observacion
         FROM ventas_productos
         WHERE fecha = ?
         ORDER BY hora DESC, id DESC`,
        [fecha],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });
  }

  function totalByDate(fecha) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT COALESCE(SUM(total), 0) AS total
         FROM ventas_productos
         WHERE fecha = ?`,
        [fecha],
        (err, row) => {
          if (err) return reject(err);
          resolve(Number(row?.total || 0));
        }
      );
    });
  }

  return {
    create,
    findByDate,
    totalByDate,
  };
}

module.exports = { createProductSaleRepository };
