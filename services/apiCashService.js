function createApiCashService({ apiClient, clock = () => new Date() }) {
  function today() {
    const date = clock();
    const pad = value => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  const normalizeType = type => ({ registration: 'alta', productsale: 'venta_producto', membershiprenewal: 'renovacion' }[type] || type);
  function localTime(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? null : date.toLocaleTimeString('es-UY', { hour12: false, timeZone: 'America/Montevideo' });
  }
  function mapSession(session) {
    if (!session) return null;
    const opened = new Date(session.openedAtUtc);
    return {
      id: session.id,
      fecha: session.businessDate,
      hora_apertura: Number.isNaN(opened.valueOf())
        ? null
        : localTime(session.openedAtUtc),
      ts_apertura: session.openedAtUtc,
      cajero_apertura: session.cashier,
      monto_inicial_efectivo: Number(session.openingCash),
      observacion: session.note || null,
      estado: session.status === 'open' ? 'abierta' : 'cerrada',
    };
  }

  function mapClosure(closure) {
    if (!closure) return null;
    return {
      id: closure.id,
      fecha: closure.businessDate,
      cajero_apertura: closure.openingCashier,
      monto_inicial_efectivo: Number(closure.openingCash),
      ts_apertura: closure.openedAtUtc,
      cajero_cierre: closure.closingCashier,
      ts_cierre: closure.closedAtUtc,
      hora_apertura: localTime(closure.openedAtUtc),
      hora_cierre: localTime(closure.closedAtUtc),
      total_ingresos: Number(closure.totalIncome),
      cantidad_movimientos: Number(closure.movementCount),
      total_efectivo: Number(closure.totalCash),
      total_transferencia: Number(closure.totalTransfer),
      total_debito: 0,
      total_credito: 0,
      total_otros: 0,
      efectivo_esperado: Number(closure.expectedCash),
      efectivo_contado: Number(closure.countedCash),
      diferencia_efectivo: Number(closure.cashDifference),
      observacion: closure.note || null,
      observacion_cierre: closure.note || null,
      estado: closure.status === 'closed' ? 'cerrada' : 'abierta',
    };
  }

  function mapMovement(movement) {
    const occurred = new Date(movement.occurredAtUtc);
    return {
      id: movement.id,
      caja_sesion_id: movement.cashSessionId,
      fecha: movement.businessDate,
      hora: Number.isNaN(occurred.valueOf())
        ? null
        : occurred.toLocaleTimeString('es-UY', { hour12: false }),
      ts: movement.occurredAtUtc,
      tipo_ingreso: normalizeType(movement.type),
      forma_pago: movement.paymentMethod,
      monto: Number(movement.amount),
      monto_recibido: Number(movement.amount),
      cambio: 0,
      descripcion: movement.description,
      observacion: movement.note || null,
      usuario_ci: movement.memberIdentityNumber || null,
      usuario_nombre: movement.memberName || null,
      producto_id: movement.productId ?? null,
      producto_nombre: movement.productName ?? null,
      cantidad: movement.productQuantity ?? null,
      referencia_tabla: 'membership_renewals',
      referencia_id: movement.correctionOfId || null,
      correccion_de_id: movement.correctionOfId || null,
      motivo_correccion: movement.correctionReason || null,
    };
  }

  function mapSummary(summary) {
    const opening = mapSession(summary.opening);
    const closure = mapClosure(summary.closure);
    return {
      fecha: summary.businessDate,
      apertura: opening,
      totalIngresos: Number(summary.totalIncome),
      cantidadMovimientos: Number(summary.movementCount),
      totalPorFormaPago: summary.totalsByPaymentMethod.map(item => ({
        formaPago: item.key,
        total: Number(item.total),
      })),
      totalPorTipoIngreso: summary.totalsByType.map(item => ({
        tipoIngreso: normalizeType(item.key),
        total: Number(item.total),
      })),
      efectivoEsperado: Number(summary.expectedCash),
      sesiones: opening ? [closure ? { ...opening, ...closure } : opening] : [],
      sesionAbierta: summary.status === 'abierta' ? opening : null,
      ultimoCierreGlobal: null,
      cierre: closure,
      pendientes: { cantidad: 0, total: 0 },
      estado: summary.status,
      movimientos: summary.movements.map(mapMovement),
    };
  }

  function totalsObject(items, keyName) {
    return Object.fromEntries(items.map(item => [item[keyName], Number(item.total)]));
  }

  async function getDailyReport(fecha) {
    const reportDate = fecha || today();
    const report = await apiClient.getCashDailyReport(reportDate);
    const summaries = [...report.sessions].sort((a, b) => String(a.opening?.openedAtUtc || '').localeCompare(String(b.opening?.openedAtUtc || ''))).map(mapSummary);
    const sessions = summaries.map(summary => {
      const byType = totalsObject(summary.totalPorTipoIngreso, 'tipoIngreso');
      const byPayment = totalsObject(summary.totalPorFormaPago, 'formaPago');
      const base = summary.cierre
        ? { ...summary.apertura, ...summary.cierre }
        : summary.apertura;
      return {
        ...base,
        movimientos: summary.movimientos,
        ventasPorProducto: [],
        totalGeneral: summary.totalIngresos,
        efectivoEsperado: summary.efectivoEsperado,
        totalesPorTipoIngreso: {
          altas: Number(byType.alta || 0),
          renovaciones: Number(byType.renovacion || 0),
          ventasProductos: Number(byType.venta_producto || 0),
          ingresosManuales: Number(byType.ingreso_manual || 0),
          egresos: Number(byType.egreso || 0),
          ajustes: Number(byType.ajuste_manual || 0),
        },
        totalesPorFormaPago: {
          efectivo: Number(byPayment.efectivo || 0),
          transferencia: Number(byPayment.transferencia || 0),
        },
      };
    });
    const totalByType = {};
    const totalByPayment = {};
    for (const summary of summaries) {
      for (const item of summary.totalPorTipoIngreso) {
        totalByType[item.tipoIngreso] = (totalByType[item.tipoIngreso] || 0) + Number(item.total);
      }
      for (const item of summary.totalPorFormaPago) {
        totalByPayment[item.formaPago] = (totalByPayment[item.formaPago] || 0) + Number(item.total);
      }
    }
    const closure = [...summaries].reverse().find(item => item.cierre)?.cierre || null;
    const open = summaries.find(item => item.estado === 'abierta')?.sesionAbierta || null;
    return {
      fecha: reportDate,
      cajaInicial: Number(summaries[0]?.apertura?.monto_inicial_efectivo || 0),
      totalGeneral: summaries.reduce((total, item) => total + item.totalIngresos, 0),
      efectivoEsperado: Number(summaries.at(-1)?.efectivoEsperado || 0),
      totalesPorTipoIngreso: {
        altas: Number(totalByType.alta || 0),
        renovaciones: Number(totalByType.renovacion || 0),
        ventasProductos: Number(totalByType.venta_producto || 0),
        ingresosManuales: Number(totalByType.ingreso_manual || 0),
        egresos: Number(totalByType.egreso || 0),
        ajustes: Number(totalByType.ajuste_manual || 0),
      },
      totalesPorFormaPago: {
        efectivo: Number(totalByPayment.efectivo || 0),
        transferencia: Number(totalByPayment.transferencia || 0),
      },
      cierre: closure,
      sesiones: sessions,
      sesionAbierta: open,
      diferenciaCaja: Number(closure?.diferencia_efectivo || 0),
      observaciones: closure?.observacion || null,
      pendientes: { cantidad: 0, total: 0 },
      ventasPendientes: [],
    };
  }

  return {
    openDay: async ({ fecha, montoInicialEfectivo, cajeroApertura, observacion = null }) =>
      mapSession(await apiClient.openCashSession({
        businessDate: fecha || today(),
        cashier: cajeroApertura,
        openingCash: Number(montoInicialEfectivo),
        note: observacion,
      })),
    getOpeningByDate: async fecha => {
      const session = await apiClient.getCurrentCashSession();
      return session?.businessDate === (fecha || today()) ? mapSession(session) : null;
    },
    listMovementsByDate: async fecha =>
      (await apiClient.getCashSummary(fecha || today())).movements.map(mapMovement),
    getDailySummary: async fecha =>
      mapSummary(await apiClient.getCashSummary(fecha || today())),
    getDailyReport,
    registerManualIncome: async ({ fecha, monto, formaPago = 'efectivo', observacion = null }) =>
      mapMovement(await apiClient.createManualCashIncome({
        businessDate: fecha || today(),
        amount: Number(monto),
        paymentMethod: formaPago,
        note: observacion,
      })),
    closeDay: async ({ fecha, efectivoContado, observacion, cajeroCierre }) =>
      mapClosure(await apiClient.closeCurrentCashSession({
        businessDate: fecha || today(),
        countedCash: efectivoContado === null || efectivoContado === undefined || efectivoContado === ''
          ? null
          : Number(efectivoContado),
        note: observacion || null,
        closingCashier: cajeroCierre || null,
      })),
    getClosureByDate: async fecha =>
      mapClosure(await apiClient.getCashClosure(fecha || today())),
    adjustDailyTotal: (fecha, nuevoTotal, observacion = null) =>
      apiClient.adjustCashTotal({
        businessDate: fecha || today(),
        newTotal: Number(nuevoTotal),
        note: observacion,
      }).then(result => ({
        applied: result.applied,
        previousTotal: Number(result.previousTotal),
        newTotal: Number(result.newTotal),
        ...(result.difference === null ? {} : { difference: Number(result.difference) }),
      })),
    registerCashOutput: async ({ fecha, monto, formaPago = 'efectivo', observacion = null }) =>
      mapMovement(await apiClient.createCashOutput({
        businessDate: fecha || today(),
        amount: Number(monto),
        paymentMethod: formaPago,
        note: observacion,
      })),
    correctMovement: ({ id, monto, formaPago, observacion = null, motivo }) =>
      apiClient.correctCashMovement(id, {
        amount: Number(monto),
        paymentMethod: formaPago,
        note: observacion,
        reason: motivo,
      }).then(result => ({
        corrected: result.corrected,
        originalId: result.originalId,
        replacementId: result.replacementId,
      })),
  };
}

function unsupported() {
  throw new Error('Esta operacion de caja todavia no esta disponible en modo API');
}

module.exports = { createApiCashService };
