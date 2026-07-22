const sqlite3 = require('sqlite3').verbose();

function openDb(dbPath) {
  return new sqlite3.Database(dbPath);
}

function runAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function allAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function closeAsync(db) {
  return new Promise((resolve, reject) => {
    db.close(err => {
      if (err) return reject(err);
      resolve();
    });
  });
}

async function addColumnIfMissing(db, tableName, name, type, def = null) {
  const rows = await allAsync(db, `PRAGMA table_info(${tableName})`);
  const have = new Set(rows.map(r => r.name));

  if (have.has(name)) return;

  const defClause = def !== null ? ` DEFAULT ${def}` : '';
  await runAsync(db, `ALTER TABLE ${tableName} ADD COLUMN ${name} ${type}${defClause}`);
}

async function migrarUsuarios(dbPath) {
  const db = openDb(dbPath);
  try {
    await runAsync(db, `
      CREATE TABLE IF NOT EXISTS usuarios (
        ci INTEGER PRIMARY KEY,
        nombre TEXT NOT NULL,
        numero TEXT,
        email TEXT,
        fecha_creacion TEXT NOT NULL,
        ultima_actualizacion TEXT NOT NULL,
        fecha_vencimiento TEXT NOT NULL
      )
    `);

    await addColumnIfMissing(db, 'usuarios', 'detalle', 'TEXT');
    await addColumnIfMissing(db, 'usuarios', 'contacto_emergencia', 'TEXT');
    await addColumnIfMissing(db, 'usuarios', 'telefono_emergencia', 'TEXT');
    await addColumnIfMissing(db, 'usuarios', 'forma_pago_alta', 'TEXT');
    await addColumnIfMissing(db, 'usuarios', 'autorizacion_imagen', 'INTEGER', '0');
    await addColumnIfMissing(db, 'usuarios', 'fecha_nacimiento', 'TEXT');
    await addColumnIfMissing(db, 'usuarios', 'direccion', 'TEXT');
    await addColumnIfMissing(db, 'usuarios', 'relacion_emergencia', 'TEXT');
    await addColumnIfMissing(db, 'usuarios', 'condicion_medica', 'TEXT');
    await addColumnIfMissing(db, 'usuarios', 'objetivo', 'TEXT');
    await addColumnIfMissing(db, 'usuarios', 'tipo_membresia', 'TEXT', `'mensual'`);
    await addColumnIfMissing(db, 'usuarios', 'preferencia_pago', 'TEXT', `'efectivo'`);

    await runAsync(db, `
      CREATE TABLE IF NOT EXISTS pagos_membresia (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_ci INTEGER NOT NULL,
        usuario_nombre TEXT,
        fecha_pago TEXT NOT NULL,
        hora_pago TEXT,
        ts TEXT NOT NULL,
        tipo_membresia TEXT NOT NULL,
        dias_agregados INTEGER NOT NULL DEFAULT 0,
        monto REAL NOT NULL DEFAULT 0,
        forma_pago TEXT NOT NULL DEFAULT 'efectivo',
        vencimiento_anterior TEXT,
        vencimiento_nuevo TEXT,
        caja_movimiento_id INTEGER,
        caja_sesion_id INTEGER,
        observacion TEXT
      )
    `);

    await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_pagos_membresia_usuario ON pagos_membresia(usuario_ci)`);
    await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_pagos_membresia_fecha ON pagos_membresia(fecha_pago)`);

    await runAsync(db, `UPDATE usuarios SET detalle = '' WHERE detalle IS NULL`);
    await runAsync(db, `UPDATE usuarios SET autorizacion_imagen = 0 WHERE autorizacion_imagen IS NULL`);
    await runAsync(db, `UPDATE usuarios SET tipo_membresia = 'mensual' WHERE tipo_membresia IS NULL OR tipo_membresia = ''`);
    await runAsync(db, `UPDATE usuarios SET preferencia_pago = COALESCE(NULLIF(forma_pago_alta, ''), 'efectivo') WHERE preferencia_pago IS NULL OR preferencia_pago = ''`);
  } finally {
    await closeAsync(db);
  }
}

async function migrarIngresos(dbPath) {
  const db = openDb(dbPath);
  try {
    await runAsync(db, `
      CREATE TABLE IF NOT EXISTS ingresos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ci INTEGER NOT NULL,
        fecha TEXT NOT NULL,
        hora TEXT NOT NULL,
        ts TEXT NOT NULL,
        fuente TEXT DEFAULT 'kiosk',
        observacion TEXT
      )
    `);

    await addColumnIfMissing(db, 'ingresos', 'fecha', 'TEXT');
    await addColumnIfMissing(db, 'ingresos', 'hora', 'TEXT');
    await addColumnIfMissing(db, 'ingresos', 'ts', 'TEXT');
    await addColumnIfMissing(db, 'ingresos', 'fuente', 'TEXT', `'kiosk'`);
    await addColumnIfMissing(db, 'ingresos', 'observacion', 'TEXT');
    await addColumnIfMissing(db, 'ingresos', 'anulado', 'INTEGER', '0');
    await addColumnIfMissing(db, 'ingresos', 'anulado_ts', 'TEXT');
    await addColumnIfMissing(db, 'ingresos', 'motivo_anulacion', 'TEXT');

    await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_ingresos_fecha ON ingresos(fecha)`);
    await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_ingresos_ci ON ingresos(ci)`);
    await runAsync(db, `DROP INDEX IF EXISTS unq_ingresos_ci_fecha`);
  } finally {
    await closeAsync(db);
  }
}

async function migrarProductos(dbPath) {
  const db = openDb(dbPath);
  try {
    await runAsync(db, `
      CREATE TABLE IF NOT EXISTS productos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        precio REAL NOT NULL DEFAULT 0,
        stock INTEGER NOT NULL DEFAULT 0
      )
    `);

    await runAsync(db, `
      CREATE TABLE IF NOT EXISTS ventas_productos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        producto_id INTEGER NOT NULL,
        nombre TEXT NOT NULL,
        cantidad INTEGER NOT NULL DEFAULT 1,
        total REAL NOT NULL DEFAULT 0,
        fecha TEXT NOT NULL,
        hora TEXT NOT NULL,
        ts TEXT NOT NULL
      )
    `);

    await addColumnIfMissing(db, 'ventas_productos', 'forma_pago', 'TEXT', `'efectivo'`);
    await addColumnIfMissing(db, 'ventas_productos', 'monto_recibido', 'REAL', '0');
    await addColumnIfMissing(db, 'ventas_productos', 'cambio', 'REAL', '0');
    await addColumnIfMissing(db, 'ventas_productos', 'observacion', 'TEXT');

    await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_ventas_productos_fecha ON ventas_productos(fecha)`);
    await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_ventas_productos_producto ON ventas_productos(producto_id)`);
  } finally {
    await closeAsync(db);
  }
}

async function migrarCaja(dbPath) {
  const db = openDb(dbPath);
  try {
    await runAsync(db, `
      CREATE TABLE IF NOT EXISTS aperturas_caja (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha TEXT NOT NULL UNIQUE,
        hora_apertura TEXT NOT NULL,
        ts_apertura TEXT NOT NULL,
        monto_inicial_efectivo REAL NOT NULL DEFAULT 0,
        observacion TEXT
      )
    `);

    await runAsync(db, `
      CREATE TABLE IF NOT EXISTS caja_movimientos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        caja_sesion_id INTEGER,
        fecha TEXT NOT NULL,
        hora TEXT NOT NULL,
        ts TEXT NOT NULL,
        tipo_ingreso TEXT NOT NULL,
        forma_pago TEXT NOT NULL DEFAULT 'efectivo',
        monto REAL NOT NULL DEFAULT 0,
        monto_recibido REAL NOT NULL DEFAULT 0,
        cambio REAL NOT NULL DEFAULT 0,
        descripcion TEXT,
        observacion TEXT,
        usuario_ci INTEGER,
        usuario_nombre TEXT,
        producto_id INTEGER,
        producto_nombre TEXT,
        cantidad INTEGER NOT NULL DEFAULT 1,
        referencia_tabla TEXT,
        referencia_id INTEGER
      )
    `);

    await runAsync(db, `
      CREATE TABLE IF NOT EXISTS cierres_caja (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha TEXT NOT NULL UNIQUE,
        hora_cierre TEXT NOT NULL,
        ts_cierre TEXT NOT NULL,
        total_ingresos REAL NOT NULL DEFAULT 0,
        cantidad_movimientos INTEGER NOT NULL DEFAULT 0,
        total_efectivo REAL NOT NULL DEFAULT 0,
        total_transferencia REAL NOT NULL DEFAULT 0,
        total_debito REAL NOT NULL DEFAULT 0,
        total_credito REAL NOT NULL DEFAULT 0,
        total_otros REAL NOT NULL DEFAULT 0,
        observacion TEXT
      )
    `);

    await addColumnIfMissing(db, 'cierres_caja', 'efectivo_esperado', 'REAL', '0');
    await addColumnIfMissing(db, 'cierres_caja', 'efectivo_contado', 'REAL', '0');
    await addColumnIfMissing(db, 'cierres_caja', 'diferencia_efectivo', 'REAL', '0');
    await addColumnIfMissing(db, 'aperturas_caja', 'cajero_apertura', 'TEXT');
    await addColumnIfMissing(db, 'cierres_caja', 'cajero_cierre', 'TEXT');
    await addColumnIfMissing(db, 'caja_movimientos', 'caja_sesion_id', 'INTEGER');
    await addColumnIfMissing(db, 'caja_movimientos', 'correccion_de_id', 'INTEGER');
    await addColumnIfMissing(db, 'caja_movimientos', 'motivo_correccion', 'TEXT');

    await runAsync(db, `
      CREATE TABLE IF NOT EXISTS caja_sesiones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha TEXT NOT NULL,
        hora_apertura TEXT NOT NULL,
        ts_apertura TEXT NOT NULL,
        cajero_apertura TEXT NOT NULL,
        monto_inicial_efectivo REAL NOT NULL DEFAULT 0,
        observacion_apertura TEXT,
        hora_cierre TEXT,
        ts_cierre TEXT,
        cajero_cierre TEXT,
        total_ingresos REAL NOT NULL DEFAULT 0,
        cantidad_movimientos INTEGER NOT NULL DEFAULT 0,
        total_efectivo REAL NOT NULL DEFAULT 0,
        total_transferencia REAL NOT NULL DEFAULT 0,
        total_debito REAL NOT NULL DEFAULT 0,
        total_credito REAL NOT NULL DEFAULT 0,
        total_otros REAL NOT NULL DEFAULT 0,
        efectivo_esperado REAL NOT NULL DEFAULT 0,
        efectivo_contado REAL NOT NULL DEFAULT 0,
        diferencia_efectivo REAL NOT NULL DEFAULT 0,
        observacion_cierre TEXT,
        estado TEXT NOT NULL DEFAULT 'abierta'
      )
    `);

    await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_aperturas_caja_fecha ON aperturas_caja(fecha)`);
    await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_caja_movimientos_fecha ON caja_movimientos(fecha)`);
    await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_caja_movimientos_sesion ON caja_movimientos(caja_sesion_id)`);
    await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_caja_movimientos_tipo ON caja_movimientos(tipo_ingreso)`);
    await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_caja_movimientos_usuario ON caja_movimientos(usuario_ci)`);
    await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_caja_sesiones_fecha ON caja_sesiones(fecha)`);
    await runAsync(db, `CREATE UNIQUE INDEX IF NOT EXISTS unq_caja_sesion_abierta ON caja_sesiones(estado) WHERE estado = 'abierta'`);

    const existingSessions = await allAsync(db, `SELECT COUNT(*) AS total FROM caja_sesiones`);
    if (Number(existingSessions?.[0]?.total || 0) === 0) {
      const legacyOpenings = await allAsync(db, `
        SELECT a.fecha, a.hora_apertura, a.ts_apertura, a.monto_inicial_efectivo,
               a.observacion AS observacion_apertura, a.cajero_apertura,
               c.hora_cierre, c.ts_cierre, c.cajero_cierre, c.total_ingresos,
               c.cantidad_movimientos, c.total_efectivo, c.total_transferencia,
               c.total_debito, c.total_credito, c.total_otros, c.efectivo_esperado,
               c.efectivo_contado, c.diferencia_efectivo, c.observacion AS observacion_cierre
        FROM aperturas_caja a
        LEFT JOIN cierres_caja c ON c.fecha = a.fecha
        ORDER BY a.fecha ASC
      `);

      for (const row of legacyOpenings) {
        const estado = row.hora_cierre ? 'cerrada' : 'abierta';
        const inserted = await runAsync(db, `
          INSERT INTO caja_sesiones (
            fecha, hora_apertura, ts_apertura, cajero_apertura, monto_inicial_efectivo,
            observacion_apertura, hora_cierre, ts_cierre, cajero_cierre, total_ingresos,
            cantidad_movimientos, total_efectivo, total_transferencia, total_debito,
            total_credito, total_otros, efectivo_esperado, efectivo_contado,
            diferencia_efectivo, observacion_cierre, estado
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          row.fecha,
          row.hora_apertura,
          row.ts_apertura,
          row.cajero_apertura || 'Sin registrar',
          row.monto_inicial_efectivo || 0,
          row.observacion_apertura || null,
          row.hora_cierre || null,
          row.ts_cierre || null,
          row.cajero_cierre || (row.hora_cierre ? 'Sin registrar' : null),
          row.total_ingresos || 0,
          row.cantidad_movimientos || 0,
          row.total_efectivo || 0,
          row.total_transferencia || 0,
          row.total_debito || 0,
          row.total_credito || 0,
          row.total_otros || 0,
          row.efectivo_esperado || 0,
          row.efectivo_contado || 0,
          row.diferencia_efectivo || 0,
          row.observacion_cierre || null,
          estado,
        ]);

        await runAsync(db, `
          UPDATE caja_movimientos
          SET caja_sesion_id = ?
          WHERE fecha = ? AND caja_sesion_id IS NULL
        `, [inserted.lastID, row.fecha]);
      }
    }
  } finally {
    await closeAsync(db);
  }
}

async function migrarConfiguracion(dbPath) {
  const db = openDb(dbPath);
  try {
    await runAsync(db, `
      CREATE TABLE IF NOT EXISTS app_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    await runAsync(
      db,
      `INSERT INTO app_config (key, value)
       VALUES ('precio_inscripcion', '0')
       ON CONFLICT(key) DO NOTHING`
    );
    await runAsync(
      db,
      `INSERT INTO app_config (key, value)
       VALUES ('precio_membresia_mensual', '0')
       ON CONFLICT(key) DO NOTHING`
    );
    await runAsync(
      db,
      `INSERT INTO app_config (key, value)
       VALUES ('precio_membresia_trimestral', '0')
       ON CONFLICT(key) DO NOTHING`
    );
    await runAsync(
      db,
      `INSERT INTO app_config (key, value)
       VALUES ('precio_membresia_semestral', '0')
       ON CONFLICT(key) DO NOTHING`
    );
    await runAsync(
      db,
      `INSERT INTO app_config (key, value)
       VALUES ('evento_running_activo', 'false')
       ON CONFLICT(key) DO NOTHING`
    );
    await runAsync(
      db,
      `INSERT INTO app_config (key, value)
       VALUES ('evento_running_nombre', 'UNDER RUNNING')
       ON CONFLICT(key) DO NOTHING`
    );
    await runAsync(
      db,
      `INSERT INTO app_config (key, value)
       VALUES ('evento_running_distancias', '3KM & 5KM')
       ON CONFLICT(key) DO NOTHING`
    );
    await runAsync(
      db,
      `INSERT INTO app_config (key, value)
       VALUES ('evento_running_fecha', '2026-05-24')
       ON CONFLICT(key) DO NOTHING`
    );
  } finally {
    await closeAsync(db);
  }
}

async function migrarOperacionesMultiLocal(dbPath) {
  const db = openDb(dbPath);
  try {
    await runAsync(db, `
      CREATE TABLE IF NOT EXISTS locales (
        id INTEGER PRIMARY KEY,
        codigo TEXT NOT NULL UNIQUE,
        nombre TEXT NOT NULL,
        tipo TEXT NOT NULL,
        activo INTEGER NOT NULL DEFAULT 1
      )
    `);

    await runAsync(db, `
      INSERT OR IGNORE INTO locales (id, codigo, nombre, tipo, activo)
      VALUES (1, 'principal', 'Recepcion principal', 'principal', 1),
             (2, 'funcional', 'Salon funcional', 'clases', 1)
    `);

    await runAsync(db, `
      CREATE TABLE IF NOT EXISTS stock_local (
        local_id INTEGER NOT NULL,
        producto_id INTEGER NOT NULL,
        cantidad INTEGER NOT NULL DEFAULT 0,
        actualizado_ts TEXT NOT NULL,
        PRIMARY KEY (local_id, producto_id)
      )
    `);

    await runAsync(db, `
      CREATE TABLE IF NOT EXISTS transferencias_stock (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        producto_id INTEGER NOT NULL,
        origen_local_id INTEGER NOT NULL,
        destino_local_id INTEGER NOT NULL,
        cantidad INTEGER NOT NULL,
        responsable TEXT,
        fecha TEXT NOT NULL,
        hora TEXT NOT NULL,
        ts TEXT NOT NULL
      )
    `);

    await runAsync(db, `
      CREATE TABLE IF NOT EXISTS clases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        fecha TEXT NOT NULL,
        hora TEXT NOT NULL,
        duracion_minutos INTEGER NOT NULL DEFAULT 60,
        capacidad INTEGER NOT NULL DEFAULT 12,
        profesor TEXT NOT NULL,
        local_id INTEGER NOT NULL DEFAULT 2,
        notas TEXT,
        estado TEXT NOT NULL DEFAULT 'programada',
        creado_ts TEXT NOT NULL
      )
    `);

    await runAsync(db, `
      CREATE TABLE IF NOT EXISTS inscripciones_clase (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        clase_id INTEGER NOT NULL,
        usuario_ci INTEGER NOT NULL,
        usuario_nombre TEXT NOT NULL,
        estado TEXT NOT NULL DEFAULT 'inscripto',
        creado_ts TEXT NOT NULL,
        UNIQUE (clase_id, usuario_ci)
      )
    `);

    await runAsync(db, `
      CREATE TABLE IF NOT EXISTS ventas_pendientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        local_id INTEGER NOT NULL DEFAULT 2,
        producto_id INTEGER NOT NULL,
        producto_nombre TEXT NOT NULL,
        usuario_ci INTEGER NOT NULL,
        usuario_nombre TEXT NOT NULL,
        cantidad INTEGER NOT NULL DEFAULT 1,
        total REAL NOT NULL DEFAULT 0,
        profesor TEXT NOT NULL,
        fecha TEXT NOT NULL,
        hora TEXT NOT NULL,
        ts TEXT NOT NULL,
        estado TEXT NOT NULL DEFAULT 'pendiente',
        cobrado_ts TEXT,
        forma_pago TEXT,
        caja_movimiento_id INTEGER,
        observacion TEXT
      )
    `);

    await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_clases_fecha ON clases(fecha, hora)`);
    await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_inscripciones_clase ON inscripciones_clase(clase_id)`);
    await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_stock_transferencias_fecha ON transferencias_stock(fecha)`);
    await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_ventas_pendientes_estado ON ventas_pendientes(estado, fecha)`);

    await runAsync(db, `
      INSERT OR IGNORE INTO stock_local (local_id, producto_id, cantidad, actualizado_ts)
      SELECT 1, id, stock, datetime('now') FROM productos
    `);
    await runAsync(db, `
      INSERT OR IGNORE INTO stock_local (local_id, producto_id, cantidad, actualizado_ts)
      SELECT 2, id, 0, datetime('now') FROM productos
    `);
  } finally {
    await closeAsync(db);
  }
}

async function migrarProfesores(dbPath) {
  const db = openDb(dbPath);
  try {
    await runAsync(db, `
      CREATE TABLE IF NOT EXISTS profesores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL COLLATE NOCASE UNIQUE,
        pin_hash TEXT NOT NULL,
        pin_salt TEXT NOT NULL,
        activo INTEGER NOT NULL DEFAULT 1,
        creado_ts TEXT NOT NULL,
        actualizado_ts TEXT NOT NULL
      )
    `);

    await runAsync(db, `
      CREATE TABLE IF NOT EXISTS sesiones_profesor (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profesor_id INTEGER NOT NULL,
        local_id INTEGER NOT NULL DEFAULT 2,
        dispositivo_id TEXT NOT NULL,
        inicio_ts TEXT NOT NULL,
        fin_ts TEXT,
        estado TEXT NOT NULL DEFAULT 'activa'
      )
    `);

    await addColumnIfMissing(db, 'clases', 'profesor_id', 'INTEGER');
    await addColumnIfMissing(db, 'ventas_pendientes', 'profesor_id', 'INTEGER');
    await addColumnIfMissing(db, 'ventas_pendientes', 'profesor_sesion_id', 'INTEGER');

    await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_profesores_activo ON profesores(activo, nombre)`);
    await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_sesiones_profesor_estado ON sesiones_profesor(estado, dispositivo_id)`);
    await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_sesiones_profesor_profesor ON sesiones_profesor(profesor_id, inicio_ts)`);
    await runAsync(db, `CREATE UNIQUE INDEX IF NOT EXISTS unq_sesion_profesor_dispositivo_activa ON sesiones_profesor(dispositivo_id) WHERE estado = 'activa'`);
  } finally {
    await closeAsync(db);
  }
}

async function ejecutarMigraciones(dbPath) {
  await migrarUsuarios(dbPath);
  await migrarIngresos(dbPath);
  await migrarProductos(dbPath);
  await migrarCaja(dbPath);
  await migrarConfiguracion(dbPath);
  await migrarOperacionesMultiLocal(dbPath);
  await migrarProfesores(dbPath);
}

module.exports = {
  migrarUsuarios,
  migrarIngresos,
  migrarProductos,
  migrarCaja,
  migrarConfiguracion,
  migrarOperacionesMultiLocal,
  migrarProfesores,
  ejecutarMigraciones,
};
