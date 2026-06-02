function createUserService({ db, userRepository, membershipPaymentRepository, membershipRules, cashService, settingsService }) {
  const MEMBERSHIP_DAYS = {
    mensual: 30,
    trimestral: 90,
    semestral: 180,
  };

  function run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve(this);
      });
    });
  }

  function normalizeMembershipType(value) {
    const type = String(value || 'mensual').trim().toLowerCase();
    return MEMBERSHIP_DAYS[type] ? type : 'mensual';
  }

  function calculateInitialExpiration(tipoMembresia) {
    const type = normalizeMembershipType(tipoMembresia);
    return membershipRules.formatLocalDate(
      membershipRules.addDays(membershipRules.todayLocal(), MEMBERSHIP_DAYS[type])
    );
  }

  async function createUser({
    ci,
    nombre,
    numero,
    email,
    detalle = '',
    contactoEmergencia = '',
    telefonoEmergencia = '',
    autorizacionImagen = false,
    fechaNacimiento = '',
    formaPagoAlta = 'efectivo',
    direccion = '',
    relacionEmergencia = '',
    condicionMedica = '',
    objetivo = '',
    tipoMembresia = 'mensual',
    preferenciaPago = '',
  }) {
    await run('BEGIN IMMEDIATE TRANSACTION');
    try {
      const precioInscripcion = await settingsService.getRegistrationPrice();
      const normalizedMembershipType = normalizeMembershipType(tipoMembresia);
      const created = await userRepository.create({
        ci,
        nombre,
        numero,
        email,
        detalle,
        contacto_emergencia: contactoEmergencia,
        telefono_emergencia: telefonoEmergencia,
        forma_pago_alta: formaPagoAlta,
        autorizacion_imagen: autorizacionImagen ? 1 : 0,
        fecha_nacimiento: fechaNacimiento,
        direccion,
        relacion_emergencia: relacionEmergencia,
        condicion_medica: condicionMedica,
        objetivo,
        tipo_membresia: normalizedMembershipType,
        preferencia_pago: preferenciaPago || formaPagoAlta,
        fecha_vencimiento: calculateInitialExpiration(normalizedMembershipType),
      });

      let movimientoCaja = null;
      if (precioInscripcion > 0) {
        movimientoCaja = await cashService.registerMovement({
          tipoIngreso: 'alta',
          descripcion: nombre,
          payment: {
            monto: precioInscripcion,
            formaPago: formaPagoAlta || 'efectivo',
          },
          usuario: { ci, nombre },
          referencia: { tabla: 'usuarios', id: ci },
        });
      }

      await run('COMMIT');
      return { ...created, movimientoCaja };
    } catch (error) {
      try {
        await run('ROLLBACK');
      } catch (_) {}
      throw error;
    }
  }

  function listUsers() {
    return userRepository.findAll();
  }

  function getUserByCi(ci) {
    return userRepository.findByCi(ci);
  }

  function listMembershipPayments(ci) {
    if (!membershipPaymentRepository) return [];
    return membershipPaymentRepository.findByUserCi(ci);
  }

  async function saveAdminManualEdit(ci, datos) {
    const diasRestantes = parseInt(datos.diasRestantes, 10);
    const fechaVencimiento = membershipRules.calculateManualExpirationFromToday(diasRestantes);

    return userRepository.update(ci, {
      nombre: datos.nombre,
      numero: datos.numero,
      email: datos.email,
      detalle: datos.detalle,
      contacto_emergencia: datos.contactoEmergencia,
      telefono_emergencia: datos.telefonoEmergencia,
      forma_pago_alta: datos.formaPagoAlta,
      autorizacion_imagen: datos.autorizacionImagen ? 1 : 0,
      fecha_nacimiento: datos.fechaNacimiento,
      direccion: datos.direccion || '',
      relacion_emergencia: datos.relacionEmergencia || '',
      condicion_medica: datos.condicionMedica || '',
      objetivo: datos.objetivo || '',
      tipo_membresia: datos.tipoMembresia || 'mensual',
      preferencia_pago: datos.preferenciaPago || datos.formaPagoAlta || 'efectivo',
      fecha_creacion: datos.fecha_creacion,
      ultima_actualizacion: datos.ultima_actualizacion,
      fecha_vencimiento: fechaVencimiento,
    });
  }

  function deleteUser(ci) {
    return userRepository.remove(ci);
  }

  return {
    createUser,
    listUsers,
    getUserByCi,
    listMembershipPayments,
    saveAdminManualEdit,
    deleteUser,
  };
}

module.exports = { createUserService };
