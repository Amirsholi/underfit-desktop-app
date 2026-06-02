function createCashService({ cashRepository }) {
  const ALLOWED_PAYMENT_METHODS = new Set(['efectivo', 'transferencia']);

  function nowLocalParts() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return {
      fecha: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      hora: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
      ts: d.toISOString(),
    };
  }

  function normalizeDate(fecha = null) {
    return String(fecha || nowLocalParts().fecha).trim();
  }

  function todayDate() {
    return nowLocalParts().fecha;
  }

  function normalizeName(value, fieldName) {
    const name = String(value || '').trim();
    if (!name) throw new Error(`${fieldName} obligatorio`);
    return name;
  }

  function normalizePaymentMethod(value) {
    const raw = String(value || 'efectivo').trim().toLowerCase();
    if (raw === 'tarjeta') return 'transferencia';
    if (!ALLOWED_PAYMENT_METHODS.has(raw)) {
      throw new Error('Forma de pago obligatoria');
    }
    return raw;
  }

  function normalizePaymentDetails(payment = {}, fallbackAmount = null) {
    const monto = Number(payment.monto ?? fallbackAmount ?? 0);
    const formaPago = normalizePaymentMethod(payment.formaPago);
    const observacion = String(payment.observacion || '').trim();

    if (!Number.isFinite(monto) || monto < 0) {
      throw new Error('Monto invalido');
    }

    return {
      monto,
      formaPago,
      montoRecibido: monto,
      cambio: 0,
      observacion: observacion || null,
    };
  }

  function ensureDateIsToday(fecha) {
    if (fecha !== todayDate()) {
      throw new Error('Solo se puede abrir caja en el dia actual');
    }
  }

  async function ensureNoOpenSession() {
    const openSession = await cashRepository.findOpenSession();
    if (openSession) {
      throw new Error('Ya hay una caja abierta');
    }
  }

  async function getActiveSessionForDate(fecha) {
    const openSession = await cashRepository.findOpenSession();
    if (!openSession) {
      throw new Error('Debe abrir una caja antes de registrar movimientos');
    }
    if (openSession.fecha !== fecha) {
      throw new Error('La caja abierta no corresponde a esta fecha');
    }
    return openSession;
  }

  async function openDay({ fecha = null, montoInicialEfectivo, cajeroApertura = null, observacion = null }) {
    const openingDate = normalizeDate(fecha);
    ensureDateIsToday(openingDate);
    await ensureNoOpenSession();

    const amount = Number(montoInicialEfectivo);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error('Monto inicial invalido');
    }

    const cashierName = normalizeName(cajeroApertura, 'Nombre de cajero');
    const now = nowLocalParts();
    return cashRepository.createOrUpdateOpening({
      fecha: openingDate,
      hora_apertura: now.hora,
      ts_apertura: now.ts,
      cajero_apertura: cashierName,
      monto_inicial_efectivo: Number(amount.toFixed(2)),
      observacion: observacion ? String(observacion).trim() : null,
    });
  }

  function getOpeningByDate(fecha) {
    return cashRepository.findOpeningByDate(normalizeDate(fecha));
  }

  async function registerMovement({
    tipoIngreso,
    descripcion,
    payment,
    usuario = null,
    producto = null,
    cantidad = 1,
    referencia = null,
    fecha = null,
  }) {
    const normalizedPayment = normalizePaymentDetails(payment);
    const movementDate = normalizeDate(fecha);

    if (normalizedPayment.monto <= 0) {
      return { skipped: true };
    }

    const activeSession = await getActiveSessionForDate(movementDate);

    const now = nowLocalParts();
    const created = await cashRepository.createMovement({
      caja_sesion_id: activeSession.id,
      fecha: movementDate,
      hora: now.hora,
      ts: now.ts,
      tipo_ingreso: tipoIngreso,
      forma_pago: normalizedPayment.formaPago,
      monto: normalizedPayment.monto,
      monto_recibido: normalizedPayment.montoRecibido,
      cambio: normalizedPayment.cambio,
      descripcion,
      observacion: normalizedPayment.observacion,
      usuario_ci: usuario?.ci ?? null,
      usuario_nombre: usuario?.nombre ?? null,
      producto_id: producto?.id ?? null,
      producto_nombre: producto?.nombre ?? null,
      cantidad,
      referencia_tabla: referencia?.tabla ?? null,
      referencia_id: referencia?.id ?? null,
    });

    return {
      ...created,
      ...normalizedPayment,
      caja_sesion_id: activeSession.id,
      fecha: movementDate,
      hora: now.hora,
      ts: now.ts,
    };
  }

  function listMovementsByDate(fecha) {
    return cashRepository.findByDate(normalizeDate(fecha));
  }

  async function getDailySummary(fecha) {
    const summaryDate = normalizeDate(fecha);
    const resumen = await cashRepository.getDailySummary(summaryDate);
    const openSession = await cashRepository.findOpenSession();
    const sesiones = await cashRepository.findSessionsByDate(summaryDate);
    const ultimoCierreGlobal = await cashRepository.findLastClosedSession();
    const activeSession = openSession?.fecha === summaryDate ? openSession : null;
    const cierre = await cashRepository.findClosureByDate(summaryDate);
    return {
      ...resumen,
      sesiones,
      sesionAbierta: activeSession,
      ultimoCierreGlobal,
      cierre,
      estado: activeSession ? 'abierta' : (sesiones.length ? 'cerrada' : 'sin_apertura'),
    };
  }

  async function closeDay({ fecha = null, efectivoContado = null, observacion = null, cajeroCierre = null }) {
    const closingDate = normalizeDate(fecha);
    const activeSession = await getActiveSessionForDate(closingDate);

    const resumen = await cashRepository.getSessionSummary(activeSession.id);
    const totalsByPayment = Object.fromEntries(
      resumen.totalPorFormaPago.map(item => [item.formaPago, item.total])
    );
    const now = nowLocalParts();

    const efectivoEsperado = Number(resumen.efectivoEsperado || 0);
    const efectivoContadoNormalizado = efectivoContado === null || efectivoContado === undefined || efectivoContado === ''
      ? efectivoEsperado
      : Number(efectivoContado);

    if (!Number.isFinite(efectivoContadoNormalizado) || efectivoContadoNormalizado < 0) {
      throw new Error('Efectivo contado invalido');
    }

    const diferenciaEfectivo = Number((efectivoContadoNormalizado - efectivoEsperado).toFixed(2));
    const cashierName = normalizeName(cajeroCierre || activeSession.cajero_apertura, 'Nombre de quien cierra');

    await cashRepository.saveDayClosure({
      caja_sesion_id: activeSession.id,
      fecha: closingDate,
      hora_cierre: now.hora,
      ts_cierre: now.ts,
      total_ingresos: resumen.totalIngresos,
      cantidad_movimientos: resumen.cantidadMovimientos,
      total_efectivo: Number(totalsByPayment.efectivo || 0),
      total_transferencia: Number(totalsByPayment.transferencia || 0),
      total_debito: 0,
      total_credito: 0,
      total_otros: 0,
      efectivo_esperado: efectivoEsperado,
      efectivo_contado: Number(efectivoContadoNormalizado.toFixed(2)),
      diferencia_efectivo: diferenciaEfectivo,
      observacion: observacion ? String(observacion).trim() : null,
      cajero_cierre: cashierName,
    });

    return cashRepository.findSessionById(activeSession.id);
  }

  function getClosureByDate(fecha) {
    return cashRepository.findClosureByDate(normalizeDate(fecha));
  }

  async function registerCashOutput({ fecha = null, monto, observacion = null }) {
    const normalizedAmount = Number(monto);
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      throw new Error('Monto invalido');
    }

    const movementDate = normalizeDate(fecha);
    const activeSession = await getActiveSessionForDate(movementDate);

    const now = nowLocalParts();
    const created = await cashRepository.createMovement({
      caja_sesion_id: activeSession.id,
      fecha: movementDate,
      hora: now.hora,
      ts: now.ts,
      tipo_ingreso: 'egreso',
      forma_pago: 'efectivo',
      monto: Number((-normalizedAmount).toFixed(2)),
      monto_recibido: 0,
      cambio: 0,
      descripcion: observacion || 'Egreso',
      observacion: observacion || null,
      cantidad: 1,
      referencia_tabla: 'caja_movimientos',
      referencia_id: null,
    });

    return {
      ...created,
      fecha: movementDate,
      hora: now.hora,
      ts: now.ts,
    };
  }

  async function registerManualIncome({
    fecha = null,
    monto,
    formaPago = 'efectivo',
    observacion = null,
  }) {
    return registerMovement({
      tipoIngreso: 'ingreso_manual',
      descripcion: observacion || 'Ingreso manual',
      payment: {
        monto,
        formaPago,
        observacion,
      },
      fecha,
    });
  }

  async function adjustDailyTotal(fecha, nuevoTotal, observacion = null) {
    const adjustmentDate = normalizeDate(fecha);
    const activeSession = await getActiveSessionForDate(adjustmentDate);

    const sessionSummary = await cashRepository.getSessionSummary(activeSession.id);
    const currentTotal = Number(sessionSummary?.totalIngresos || 0);
    const targetTotal = Number(nuevoTotal);

    if (!Number.isFinite(targetTotal) || targetTotal < 0) {
      throw new Error('Total invalido');
    }

    const difference = Number((targetTotal - currentTotal).toFixed(2));
    if (difference === 0) {
      return {
        applied: false,
        previousTotal: currentTotal,
        newTotal: currentTotal,
      };
    }

    const now = nowLocalParts();
    await cashRepository.createMovement({
      caja_sesion_id: activeSession.id,
      fecha: adjustmentDate,
      hora: now.hora,
      ts: now.ts,
      tipo_ingreso: 'ajuste_manual',
      forma_pago: 'ajuste',
      monto: difference,
      monto_recibido: difference,
      cambio: 0,
      descripcion: 'Ajuste manual de total diario',
      observacion: observacion || null,
      cantidad: 1,
      referencia_tabla: 'caja_movimientos',
      referencia_id: null,
    });

    return {
      applied: true,
      previousTotal: currentTotal,
      newTotal: targetTotal,
      difference,
    };
  }

  async function getDailyReport(fecha) {
    const reportDate = normalizeDate(fecha);
    const resumen = await getDailySummary(reportDate);
    const totalsByType = Object.fromEntries(
      resumen.totalPorTipoIngreso.map(item => [item.tipoIngreso, item.total])
    );
    const totalsByPayment = Object.fromEntries(
      resumen.totalPorFormaPago.map(item => [item.formaPago, item.total])
    );

    const sesiones = await Promise.all((resumen.sesiones || []).map(async sesion => {
      const sessionSummary = await cashRepository.getSessionSummary(sesion.id);
      const movimientos = await cashRepository.findBySessionId(sesion.id);
      const sessionTotalsByType = Object.fromEntries(
        sessionSummary.totalPorTipoIngreso.map(item => [item.tipoIngreso, item.total])
      );
      const sessionTotalsByPayment = Object.fromEntries(
        sessionSummary.totalPorFormaPago.map(item => [item.formaPago, item.total])
      );

      return {
        ...sesion,
        movimientos,
        totalGeneral: Number(sessionSummary.totalIngresos || 0),
        efectivoEsperado: Number(sessionSummary.efectivoEsperado || 0),
        totalesPorTipoIngreso: {
          altas: Number(sessionTotalsByType.alta || 0),
          renovaciones: Number(sessionTotalsByType.renovacion || 0),
          ventasProductos: Number(sessionTotalsByType.venta_producto || 0),
          ingresosManuales: Number(sessionTotalsByType.ingreso_manual || 0),
          egresos: Number(sessionTotalsByType.egreso || 0),
          ajustes: Number(sessionTotalsByType.ajuste_manual || 0),
        },
        totalesPorFormaPago: {
          efectivo: Number(sessionTotalsByPayment.efectivo || 0),
          transferencia: Number(sessionTotalsByPayment.transferencia || 0),
        },
      };
    }));

    return {
      fecha: reportDate,
      cajaInicial: Number(resumen.apertura?.monto_inicial_efectivo || 0),
      totalGeneral: Number(resumen.totalIngresos || 0),
      efectivoEsperado: Number(resumen.efectivoEsperado || 0),
      totalesPorTipoIngreso: {
        altas: Number(totalsByType.alta || 0),
        renovaciones: Number(totalsByType.renovacion || 0),
        ventasProductos: Number(totalsByType.venta_producto || 0),
        ingresosManuales: Number(totalsByType.ingreso_manual || 0),
        egresos: Number(totalsByType.egreso || 0),
        ajustes: Number(totalsByType.ajuste_manual || 0),
      },
      totalesPorFormaPago: {
        efectivo: Number(totalsByPayment.efectivo || 0),
        transferencia: Number(totalsByPayment.transferencia || 0),
      },
      cierre: resumen.cierre,
      sesiones,
      sesionAbierta: resumen.sesionAbierta,
      diferenciaCaja: Number(resumen.cierre?.diferencia_efectivo || 0),
      observaciones: resumen.cierre?.observacion || null,
    };
  }

  return {
    normalizePaymentDetails,
    openDay,
    getOpeningByDate,
    registerMovement,
    listMovementsByDate,
    getDailySummary,
    closeDay,
    getClosureByDate,
    registerCashOutput,
    registerManualIncome,
    adjustDailyTotal,
    getDailyReport,
  };
}

module.exports = { createCashService };
