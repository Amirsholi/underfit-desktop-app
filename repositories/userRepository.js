function createUserRepository(db) {
  function isMissingColumnError(err) {
    const message = String(err?.message || '').toLowerCase();
    return message.includes('no column named') || message.includes('no such column');
  }

  function run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve(this);
      });
    });
  }

  async function create({
    ci,
    nombre,
    numero,
    email,
    detalle = '',
    contacto_emergencia = '',
    telefono_emergencia = '',
    forma_pago_alta = '',
    autorizacion_imagen = 0,
    fecha_nacimiento = '',
    direccion = '',
    relacion_emergencia = '',
    condicion_medica = '',
    objetivo = '',
    tipo_membresia = 'mensual',
    preferencia_pago = 'efectivo',
    fecha_vencimiento = null,
  }) {
    const expirationExpression = fecha_vencimiento ? '?' : "DATE('now', '+30 day')";
    const expirationParams = fecha_vencimiento ? [fecha_vencimiento] : [];
    try {
      const result = await run(
        `INSERT INTO usuarios (
          ci, nombre, numero, email, fecha_creacion, ultima_actualizacion, fecha_vencimiento,
          detalle, contacto_emergencia, telefono_emergencia, forma_pago_alta, autorizacion_imagen,
          fecha_nacimiento, direccion, relacion_emergencia, condicion_medica, objetivo,
          tipo_membresia, preferencia_pago
        ) VALUES (?, ?, ?, ?, DATE('now'), DATE('now'), ${expirationExpression}, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ci,
          nombre,
          numero,
          email,
          ...expirationParams,
          detalle,
          contacto_emergencia,
          telefono_emergencia,
          forma_pago_alta,
          autorizacion_imagen,
          fecha_nacimiento,
          direccion,
          relacion_emergencia,
          condicion_medica,
          objetivo,
          tipo_membresia,
          preferencia_pago,
        ]
      );
      return { success: true, id: result.lastID };
    } catch (err) {
      if (!isMissingColumnError(err)) {
        throw err;
      }

      const legacyResult = await run(
        `INSERT INTO usuarios (ci, nombre, numero, email, fecha_creacion, ultima_actualizacion, fecha_vencimiento)
         VALUES (?, ?, ?, ?, DATE('now'), DATE('now'), DATE('now', '+30 day'))`,
        [ci, nombre, numero, email]
      );
      return { success: true, id: legacyResult.lastID, legacySchema: true };
    }
  }

  function findAll() {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM usuarios`, [], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  function findByCi(ci) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM usuarios WHERE ci = ?`, [ci], (err, usuario) => {
        if (err) return reject(err);
        resolve(usuario || null);
      });
    });
  }

  async function update(ci, nuevosDatos) {
    const params = [
      nuevosDatos.nombre,
      nuevosDatos.numero,
      nuevosDatos.email,
      nuevosDatos.fecha_creacion,
      nuevosDatos.ultima_actualizacion,
      nuevosDatos.fecha_vencimiento,
      nuevosDatos.detalle,
      nuevosDatos.contacto_emergencia,
      nuevosDatos.telefono_emergencia,
      nuevosDatos.forma_pago_alta,
      nuevosDatos.autorizacion_imagen,
      nuevosDatos.fecha_nacimiento,
      nuevosDatos.direccion,
      nuevosDatos.relacion_emergencia,
      nuevosDatos.condicion_medica,
      nuevosDatos.objetivo,
      nuevosDatos.tipo_membresia,
      nuevosDatos.preferencia_pago,
      ci,
    ];

    try {
      const result = await run(
        `UPDATE usuarios
         SET nombre = ?, numero = ?, email = ?, fecha_creacion = ?, ultima_actualizacion = ?,
             fecha_vencimiento = ?, detalle = ?, contacto_emergencia = ?, telefono_emergencia = ?,
             forma_pago_alta = ?, autorizacion_imagen = ?, fecha_nacimiento = ?, direccion = ?,
             relacion_emergencia = ?, condicion_medica = ?, objetivo = ?, tipo_membresia = ?,
             preferencia_pago = ?
         WHERE ci = ?`,
        params
      );
      return { success: true, changes: result.changes };
    } catch (err) {
      if (!isMissingColumnError(err)) {
        throw err;
      }

      const legacyResult = await run(
        `UPDATE usuarios
         SET nombre = ?, numero = ?, email = ?, fecha_creacion = ?, ultima_actualizacion = ?, fecha_vencimiento = ?
         WHERE ci = ?`,
        [
          nuevosDatos.nombre,
          nuevosDatos.numero,
          nuevosDatos.email,
          nuevosDatos.fecha_creacion,
          nuevosDatos.ultima_actualizacion,
          nuevosDatos.fecha_vencimiento,
          ci,
        ]
      );
      return { success: true, changes: legacyResult.changes, legacySchema: true };
    }
  }

  function updateMembershipDates(ci, { ultima_actualizacion, fecha_vencimiento, tipo_membresia = null, preferencia_pago = null }) {
    const fields = [
      'ultima_actualizacion = ?',
      'fecha_vencimiento = ?',
    ];
    const params = [ultima_actualizacion, fecha_vencimiento];

    if (tipo_membresia) {
      fields.push('tipo_membresia = ?');
      params.push(tipo_membresia);
    }

    if (preferencia_pago) {
      fields.push('preferencia_pago = ?');
      params.push(preferencia_pago);
    }

    params.push(ci);

    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE usuarios
         SET ${fields.join(', ')}
         WHERE ci = ?`,
        params,
        function (err) {
          if (err) return reject(err);
          resolve({ success: true, changes: this.changes });
        }
      );
    });
  }

  function remove(ci) {
    return new Promise((resolve, reject) => {
      db.run(`DELETE FROM usuarios WHERE ci = ?`, [ci], function (err) {
        if (err) return reject(err);
        resolve({ success: true, changes: this.changes });
      });
    });
  }

  return {
    create,
    findAll,
    findByCi,
    update,
    updateMembershipDates,
    remove,
  };
}

module.exports = { createUserRepository };
