function createMembershipService({ userRepository, membershipPaymentRepository, membershipRules, cashService, settingsService }) {
  const MEMBERSHIP_PLANS = {
    mensual: { dias: 30, label: '1 Mes' },
    trimestral: { dias: 90, label: '3 Meses' },
    semestral: { dias: 180, label: '6 Meses' },
  };

  function normalizePlan({ tipo = null, dias = null } = {}) {
    const normalizedType = String(tipo || '').trim().toLowerCase();
    if (MEMBERSHIP_PLANS[normalizedType]) {
      return { tipo: normalizedType, ...MEMBERSHIP_PLANS[normalizedType] };
    }

    const numericDays = Number(dias);
    if (numericDays === 90) return { tipo: 'trimestral', ...MEMBERSHIP_PLANS.trimestral };
    if (numericDays === 180) return { tipo: 'semestral', ...MEMBERSHIP_PLANS.semestral };
    return { tipo: 'mensual', ...MEMBERSHIP_PLANS.mensual };
  }

  function nowLocalParts() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return {
      fecha: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      hora: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
      ts: d.toISOString(),
    };
  }

  async function renewMembership({ ci, dias, tipo = null, formaPago = 'efectivo' }) {
    const plan = normalizePlan({ tipo, dias });
    const usuario = await userRepository.findByCi(ci);

    if (!usuario) {
      return {
        success: false,
        reason: 'not_found',
        changes: 0,
        user: null,
      };
    }

    const fechaPago = membershipRules.formatLocalDate(membershipRules.todayLocal());
    const fechaVencimiento = membershipRules.calculateRenewalExpiration(usuario.fecha_vencimiento, plan.dias);
    const resultado = await userRepository.updateMembershipDates(ci, {
      ultima_actualizacion: fechaPago,
      fecha_vencimiento: fechaVencimiento,
      tipo_membresia: plan.tipo,
      preferencia_pago: formaPago,
    });

    let movimientoCaja = null;
    const precioMembresia = await settingsService.getMembershipPriceByType(plan.tipo);
    if (precioMembresia > 0) {
      movimientoCaja = await cashService.registerMovement({
        tipoIngreso: 'renovacion',
        descripcion: `${usuario.nombre} - ${plan.label}`,
        payment: {
          monto: precioMembresia,
          formaPago,
        },
        usuario: {
          ci: usuario.ci,
          nombre: usuario.nombre,
        },
        referencia: { tabla: 'usuarios', id: usuario.ci },
      });
    }

    let pagoMembresia = null;
    if (membershipPaymentRepository) {
      const now = nowLocalParts();
      pagoMembresia = await membershipPaymentRepository.create({
        usuario_ci: usuario.ci,
        usuario_nombre: usuario.nombre,
        fecha_pago: fechaPago,
        hora_pago: now.hora,
        ts: now.ts,
        tipo_membresia: plan.tipo,
        dias_agregados: plan.dias,
        monto: precioMembresia,
        forma_pago: formaPago,
        vencimiento_anterior: usuario.fecha_vencimiento,
        vencimiento_nuevo: fechaVencimiento,
        caja_movimiento_id: movimientoCaja?.id ?? null,
        caja_sesion_id: movimientoCaja?.caja_sesion_id ?? null,
      });
    }

    return {
      success: resultado.success,
      reason: 'renewed',
      changes: resultado.changes,
      user: {
        ci: usuario.ci,
        nombre: usuario.nombre,
      },
      previousExpiration: usuario.fecha_vencimiento,
      paymentDate: fechaPago,
      expirationDate: fechaVencimiento,
      membershipType: plan.tipo,
      daysAdded: plan.dias,
      movimientoCaja,
      pagoMembresia,
    };
  }

  return {
    renewMembership,
  };
}

module.exports = { createMembershipService };
