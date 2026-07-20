function createCashRepository(db) {
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
        resolve(rows);
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

  function normalizeSessionRow(row) {
    if (!row) return null;
    return {
      ...row,
      observacion: row.observacion_apertura ?? row.observacion ?? null,
    };
  }

  async function createOrUpdateOpening({
    fecha,
    hora_apertura,
    ts_apertura,
    cajero_apertura = 'Sin registrar',
    monto_inicial_efectivo,
    observacion = null,
  }) {
    const result = await run(
      `INSERT INTO caja_sesiones (
        fecha, hora_apertura, ts_apertura, cajero_apertura,
        monto_inicial_efectivo, observacion_apertura, estado
      ) VALUES (?, ?, ?, ?, ?, ?, 'abierta')`,
      [fecha, hora_apertura, ts_apertura, cajero_apertura, monto_inicial_efectivo, observacion]
    );

    return findSessionById(result.lastID);
  }

  async function findOpeningByDate(fecha) {
    const row = await get(
      `SELECT *
       FROM caja_sesiones
       WHERE fecha = ?
       ORDER BY estado = 'abierta' DESC, id DESC
       LIMIT 1`,
      [fecha]
    );
    return normalizeSessionRow(row);
  }

  async function findSessionById(id) {
    const row = await get(
      `SELECT *
       FROM caja_sesiones
       WHERE id = ?`,
      [id]
    );
    return normalizeSessionRow(row);
  }

  async function findOpenSession() {
    const row = await get(
      `SELECT *
       FROM caja_sesiones
       WHERE estado = 'abierta'
       ORDER BY id DESC
       LIMIT 1`
    );
    return normalizeSessionRow(row);
  }

  function findSessionsByDate(fecha) {
    return all(
      `SELECT *
       FROM caja_sesiones
       WHERE fecha = ?
       ORDER BY id ASC`,
      [fecha]
    );
  }

  function findLastClosedSession() {
    return get(
      `SELECT *
       FROM caja_sesiones
       WHERE estado = 'cerrada'
       ORDER BY ts_cierre DESC, id DESC
       LIMIT 1`
    );
  }

  async function createMovement({
    caja_sesion_id = null,
    fecha,
    hora,
    ts,
    tipo_ingreso,
    forma_pago,
    monto,
    monto_recibido,
    cambio,
    descripcion = null,
    observacion = null,
    usuario_ci = null,
    usuario_nombre = null,
    producto_id = null,
    producto_nombre = null,
    cantidad = 1,
    referencia_tabla = null,
    referencia_id = null,
    correccion_de_id = null,
    motivo_correccion = null,
  }) {
    const result = await run(
      `INSERT INTO caja_movimientos (
        caja_sesion_id, fecha, hora, ts, tipo_ingreso, forma_pago, monto, monto_recibido, cambio,
        descripcion, observacion, usuario_ci, usuario_nombre, producto_id,
        producto_nombre, cantidad, referencia_tabla, referencia_id, correccion_de_id, motivo_correccion
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        caja_sesion_id,
        fecha,
        hora,
        ts,
        tipo_ingreso,
        forma_pago,
        monto,
        monto_recibido,
        cambio,
        descripcion,
        observacion,
        usuario_ci,
        usuario_nombre,
        producto_id,
        producto_nombre,
        cantidad,
        referencia_tabla,
        referencia_id,
        correccion_de_id,
        motivo_correccion,
      ]
    );

    return { id: result.lastID };
  }

  function findByDate(fecha) {
    return all(
      `SELECT id, caja_sesion_id, fecha, hora, ts, tipo_ingreso, forma_pago, monto, monto_recibido, cambio,
              descripcion, observacion, usuario_ci, usuario_nombre, producto_id, producto_nombre,
              cantidad, referencia_tabla, referencia_id, correccion_de_id, motivo_correccion
       FROM caja_movimientos
       WHERE fecha = ?
       ORDER BY hora DESC, id DESC`,
      [fecha]
    );
  }

  function findBySessionId(sessionId) {
    return all(
      `SELECT id, caja_sesion_id, fecha, hora, ts, tipo_ingreso, forma_pago, monto, monto_recibido, cambio,
              descripcion, observacion, usuario_ci, usuario_nombre, producto_id, producto_nombre,
              cantidad, referencia_tabla, referencia_id, correccion_de_id, motivo_correccion
       FROM caja_movimientos
       WHERE caja_sesion_id = ?
       ORDER BY hora ASC, id ASC`,
      [sessionId]
    );
  }

  function findMovementById(id) {
    return get(`SELECT * FROM caja_movimientos WHERE id = ?`, [id]);
  }

  async function getCurrentTotalByDate(fecha) {
    const row = await get(
      `SELECT COALESCE(SUM(monto), 0) AS total
       FROM caja_movimientos
       WHERE fecha = ?`,
      [fecha]
    );
    return Number(row?.total || 0);
  }

  async function getCurrentCashByDate(fecha) {
    const row = await get(
      `SELECT COALESCE(SUM(monto), 0) AS total
       FROM caja_movimientos
       WHERE fecha = ?
         AND forma_pago = 'efectivo'`,
      [fecha]
    );
    return Number(row?.total || 0);
  }

  async function getTotalsByDate(fecha) {
    const totals = await get(
      `SELECT COALESCE(SUM(monto), 0) AS total_ingresos,
              COUNT(*) AS cantidad_movimientos
       FROM caja_movimientos
       WHERE fecha = ?`,
      [fecha]
    );

    const byPaymentRows = await all(
      `SELECT forma_pago, COALESCE(SUM(monto), 0) AS total
       FROM caja_movimientos
       WHERE fecha = ?
         AND forma_pago IN ('efectivo', 'transferencia')
       GROUP BY forma_pago
       ORDER BY forma_pago ASC`,
      [fecha]
    );

    const byTypeRows = await all(
      `SELECT tipo_ingreso, COALESCE(SUM(monto), 0) AS total
       FROM caja_movimientos
       WHERE fecha = ?
       GROUP BY tipo_ingreso
       ORDER BY tipo_ingreso ASC`,
      [fecha]
    );

    return {
      totalIngresos: Number(totals?.total_ingresos || 0),
      cantidadMovimientos: Number(totals?.cantidad_movimientos || 0),
      totalPorFormaPago: byPaymentRows.map(row => ({
        formaPago: row.forma_pago,
        total: Number(row.total || 0),
      })),
      totalPorTipoIngreso: byTypeRows.map(row => ({
        tipoIngreso: row.tipo_ingreso,
        total: Number(row.total || 0),
      })),
    };
  }

  async function getDailySummary(fecha) {
    const totals = await getTotalsByDate(fecha);
    const apertura = await findOpeningByDate(fecha);
    const openSession = await findOpenSession();
    const activeSession = openSession?.fecha === fecha ? openSession : null;
    const efectivoEsperado = activeSession
      ? (await getSessionSummary(activeSession.id)).efectivoEsperado
      : Number((Number(apertura?.efectivo_contado || apertura?.monto_inicial_efectivo || 0)).toFixed(2));

    return {
      fecha,
      apertura,
      totalIngresos: totals.totalIngresos,
      cantidadMovimientos: totals.cantidadMovimientos,
      totalPorFormaPago: totals.totalPorFormaPago,
      totalPorTipoIngreso: totals.totalPorTipoIngreso,
      efectivoEsperado,
    };
  }

  async function getSessionSummary(sessionId) {
    const session = await findSessionById(sessionId);
    if (!session) return null;

    const totals = await get(
      `SELECT COALESCE(SUM(monto), 0) AS total_ingresos,
              COUNT(*) AS cantidad_movimientos
       FROM caja_movimientos
       WHERE caja_sesion_id = ?`,
      [sessionId]
    );

    const byPaymentRows = await all(
      `SELECT forma_pago, COALESCE(SUM(monto), 0) AS total
       FROM caja_movimientos
       WHERE caja_sesion_id = ?
         AND forma_pago IN ('efectivo', 'transferencia')
       GROUP BY forma_pago
       ORDER BY forma_pago ASC`,
      [sessionId]
    );

    const byTypeRows = await all(
      `SELECT tipo_ingreso, COALESCE(SUM(monto), 0) AS total
       FROM caja_movimientos
       WHERE caja_sesion_id = ?
       GROUP BY tipo_ingreso
       ORDER BY tipo_ingreso ASC`,
      [sessionId]
    );

    const cashMovements = await get(
      `SELECT COALESCE(SUM(monto), 0) AS total
       FROM caja_movimientos
       WHERE caja_sesion_id = ?
         AND forma_pago = 'efectivo'`,
      [sessionId]
    );

    const expectedCash = Number((Number(session.monto_inicial_efectivo || 0) + Number(cashMovements?.total || 0)).toFixed(2));

    return {
      sesion: session,
      totalIngresos: Number(totals?.total_ingresos || 0),
      cantidadMovimientos: Number(totals?.cantidad_movimientos || 0),
      totalPorFormaPago: byPaymentRows.map(row => ({
        formaPago: row.forma_pago,
        total: Number(row.total || 0),
      })),
      totalPorTipoIngreso: byTypeRows.map(row => ({
        tipoIngreso: row.tipo_ingreso,
        total: Number(row.total || 0),
      })),
      efectivoEsperado: expectedCash,
    };
  }

  async function saveDayClosure({
    caja_sesion_id = null,
    fecha,
    hora_cierre,
    ts_cierre,
    total_ingresos,
    cantidad_movimientos,
    total_efectivo,
    total_transferencia,
    total_debito,
    total_credito,
    total_otros,
    efectivo_esperado,
    efectivo_contado,
    diferencia_efectivo,
    observacion = null,
    cajero_cierre = 'Sin registrar',
  }) {
    if (caja_sesion_id) {
      await run(
        `UPDATE caja_sesiones
         SET hora_cierre = ?,
             ts_cierre = ?,
             cajero_cierre = ?,
             total_ingresos = ?,
             cantidad_movimientos = ?,
             total_efectivo = ?,
             total_transferencia = ?,
             total_debito = ?,
             total_credito = ?,
             total_otros = ?,
             efectivo_esperado = ?,
             efectivo_contado = ?,
             diferencia_efectivo = ?,
             observacion_cierre = ?,
             estado = 'cerrada'
         WHERE id = ?`,
        [
          hora_cierre,
          ts_cierre,
          cajero_cierre,
          total_ingresos,
          cantidad_movimientos,
          total_efectivo,
          total_transferencia,
          total_debito,
          total_credito,
          total_otros,
          efectivo_esperado,
          efectivo_contado,
          diferencia_efectivo,
          observacion,
          caja_sesion_id,
        ]
      );
      return;
    }

    await run(
      `INSERT INTO cierres_caja (
        fecha, hora_cierre, ts_cierre, total_ingresos, cantidad_movimientos,
        total_efectivo, total_transferencia, total_debito, total_credito,
        total_otros, efectivo_esperado, efectivo_contado, diferencia_efectivo, observacion, cajero_cierre
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(fecha) DO UPDATE SET
        hora_cierre = excluded.hora_cierre,
        ts_cierre = excluded.ts_cierre,
        total_ingresos = excluded.total_ingresos,
        cantidad_movimientos = excluded.cantidad_movimientos,
        total_efectivo = excluded.total_efectivo,
        total_transferencia = excluded.total_transferencia,
        total_debito = excluded.total_debito,
        total_credito = excluded.total_credito,
        total_otros = excluded.total_otros,
        efectivo_esperado = excluded.efectivo_esperado,
        efectivo_contado = excluded.efectivo_contado,
        diferencia_efectivo = excluded.diferencia_efectivo,
        observacion = excluded.observacion,
        cajero_cierre = excluded.cajero_cierre`,
      [
        fecha,
        hora_cierre,
        ts_cierre,
        total_ingresos,
        cantidad_movimientos,
        total_efectivo,
        total_transferencia,
        total_debito,
        total_credito,
        total_otros,
        efectivo_esperado,
        efectivo_contado,
        diferencia_efectivo,
        observacion,
        cajero_cierre,
      ]
    );
  }

  function findClosureByDate(fecha) {
    return get(
      `SELECT id, fecha, hora_cierre, ts_cierre, cajero_cierre, total_ingresos, cantidad_movimientos,
              total_efectivo, total_transferencia, total_debito, total_credito, total_otros,
              efectivo_esperado, efectivo_contado, diferencia_efectivo, observacion_cierre AS observacion
       FROM caja_sesiones
       WHERE fecha = ?
         AND estado = 'cerrada'
       ORDER BY id DESC
       LIMIT 1`,
      [fecha]
    );
  }

  return {
    createOrUpdateOpening,
    findOpeningByDate,
    findSessionById,
    findOpenSession,
    findSessionsByDate,
    findLastClosedSession,
    createMovement,
    findMovementById,
    inTransaction,
    findByDate,
    findBySessionId,
    getCurrentTotalByDate,
    getCurrentCashByDate,
    getDailySummary,
    getSessionSummary,
    saveDayClosure,
    findClosureByDate,
  };
}

module.exports = { createCashRepository };
