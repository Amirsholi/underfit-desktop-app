function createMembershipPaymentRepository(db) {
  function run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve(this);
      });
    });
  }

  function all(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  async function create({
    usuario_ci,
    usuario_nombre = null,
    fecha_pago,
    hora_pago = null,
    ts,
    tipo_membresia,
    dias_agregados,
    monto,
    forma_pago,
    vencimiento_anterior = null,
    vencimiento_nuevo = null,
    caja_movimiento_id = null,
    caja_sesion_id = null,
    observacion = null,
  }) {
    const result = await run(
      `INSERT INTO pagos_membresia (
        usuario_ci, usuario_nombre, fecha_pago, hora_pago, ts, tipo_membresia,
        dias_agregados, monto, forma_pago, vencimiento_anterior, vencimiento_nuevo,
        caja_movimiento_id, caja_sesion_id, observacion
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        usuario_ci,
        usuario_nombre,
        fecha_pago,
        hora_pago,
        ts,
        tipo_membresia,
        dias_agregados,
        monto,
        forma_pago,
        vencimiento_anterior,
        vencimiento_nuevo,
        caja_movimiento_id,
        caja_sesion_id,
        observacion,
      ]
    );

    return { id: result.lastID };
  }

  function findByUserCi(ci) {
    return all(
      `SELECT *
       FROM pagos_membresia
       WHERE usuario_ci = ?
       ORDER BY ts DESC, id DESC`,
      [ci]
    );
  }

  return {
    create,
    findByUserCi,
  };
}

module.exports = { createMembershipPaymentRepository };
