function createOperationsService({ operationsRepository, userRepository, productRepository, cashService, staffService = null }) {
  function nowLocalParts() {
    const d = new Date();
    const pad = value => String(value).padStart(2, '0');
    return {
      fecha: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      hora: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
      ts: d.toISOString(),
    };
  }

  function normalizePositiveInteger(value, fieldName) {
    const normalized = Number.parseInt(value, 10);
    if (!Number.isInteger(normalized) || normalized <= 0) throw new Error(`${fieldName} invalida`);
    return normalized;
  }

  function requiredText(value, fieldName) {
    const normalized = String(value || '').trim();
    if (!normalized) throw new Error(`${fieldName} obligatorio`);
    return normalized;
  }

  function normalizeDate(value, fieldName) {
    const normalized = requiredText(value, fieldName);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) throw new Error(`${fieldName} invalida`);
    const parsed = new Date(`${normalized}T12:00:00`);
    if (Number.isNaN(parsed.getTime()) || formatLocalDate(parsed) !== normalized) throw new Error(`${fieldName} invalida`);
    return normalized;
  }

  function formatLocalDate(date) {
    const pad = value => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function addDays(dateText, days) {
    const date = new Date(`${dateText}T12:00:00`);
    date.setDate(date.getDate() + days);
    return formatLocalDate(date);
  }

  function normalizeWeekdays(value) {
    const source = Array.isArray(value) ? value : String(value || '').split(',');
    const days = [...new Set(source.map(day => Number.parseInt(day, 10)))]
      .filter(day => Number.isInteger(day) && day >= 0 && day <= 6)
      .sort((a, b) => (a || 7) - (b || 7));
    if (!days.length) throw new Error('Selecciona al menos un dia de clase');
    return days;
  }

  function generateOccurrenceDates(schedule, fromDate, throughDate) {
    const weekdays = normalizeWeekdays(schedule.diasSemana);
    const effectiveStart = schedule.fechaInicio > fromDate ? schedule.fechaInicio : fromDate;
    let effectiveEnd = throughDate;
    if (schedule.fechaFin && schedule.fechaFin < effectiveEnd) effectiveEnd = schedule.fechaFin;
    if (effectiveEnd < effectiveStart) return [];
    const dates = [];
    for (let cursor = effectiveStart; cursor <= effectiveEnd; cursor = addDays(cursor, 1)) {
      if (weekdays.includes(new Date(`${cursor}T12:00:00`).getDay())) dates.push(cursor);
    }
    return dates;
  }

  async function resolveProfessor(payload = {}) {
    if (staffService) return staffService.resolveIdentity(payload);
    return {
      id: payload.profesorId ? normalizePositiveInteger(payload.profesorId, 'Profesor') : null,
      sesionId: payload.profesorSesionId ? normalizePositiveInteger(payload.profesorSesionId, 'Sesion') : null,
      nombre: requiredText(payload.profesor, 'Profesor'),
    };
  }

  function listStock() {
    return operationsRepository.listStockByLocation();
  }

  function listLocations() {
    return operationsRepository.listLocations();
  }

  async function transferStock(payload = {}) {
    const now = nowLocalParts();
    return operationsRepository.transferStock({
      productoId: normalizePositiveInteger(payload.productoId, 'Producto'),
      cantidad: normalizePositiveInteger(payload.cantidad, 'Cantidad'),
      responsable: String(payload.responsable || 'Recepcion').trim(),
      ...now,
    });
  }

  async function ensureUpcomingClasses(fromDate) {
    if (!operationsRepository.listActiveClassSchedules || !operationsRepository.addScheduleOccurrences) return;
    const schedules = await operationsRepository.listActiveClassSchedules();
    const throughDate = addDays(fromDate, 70);
    const createdTs = new Date().toISOString();
    for (const schedule of schedules) {
      const dates = generateOccurrenceDates(schedule, fromDate, throughDate);
      await operationsRepository.addScheduleOccurrences(schedule, dates, createdTs);
    }
  }

  async function listUpcomingClasses(fromDate = null) {
    const normalizedFromDate = normalizeDate(fromDate || nowLocalParts().fecha, 'Fecha');
    await ensureUpcomingClasses(normalizedFromDate);
    return operationsRepository.listClasses({ fromDate: normalizedFromDate });
  }

  async function createClass(payload = {}) {
    const hora = requiredText(payload.hora, 'Hora');
    const professor = await resolveProfessor(payload);
    if (payload.diasSemana !== undefined) {
      const fechaInicio = normalizeDate(payload.fechaInicio || nowLocalParts().fecha, 'Fecha de inicio');
      const fechaFin = payload.fechaFin ? normalizeDate(payload.fechaFin, 'Fecha de fin') : null;
      if (fechaFin && fechaFin < fechaInicio) throw new Error('La fecha de fin no puede ser anterior al inicio');
      const weekdays = normalizeWeekdays(payload.diasSemana);
      const localId = normalizePositiveInteger(payload.localId || 2, 'Local');
      const professorId = professor.profesorId || professor.id;
      if (!professorId) throw new Error('Selecciona un profesor registrado');
      const locations = await operationsRepository.listLocations();
      if (!locations.some(location => Number(location.id) === localId)) throw new Error('Local no disponible');
      const schedule = {
        nombre: requiredText(payload.nombre, 'Nombre'),
        profesor: professor.profesorNombre || professor.nombre,
        profesorId: professorId,
        localId,
        diasSemana: weekdays.join(','),
        hora,
        capacidad: normalizePositiveInteger(payload.capacidad || 12, 'Capacidad'),
        duracionMinutos: normalizePositiveInteger(payload.duracionMinutos || 60, 'Duracion'),
        fechaInicio,
        fechaFin,
        notas: String(payload.notas || '').trim() || null,
        creadoTs: new Date().toISOString(),
      };
      const fromDate = fechaInicio > nowLocalParts().fecha ? fechaInicio : nowLocalParts().fecha;
      schedule.occurrenceDates = generateOccurrenceDates(schedule, fromDate, addDays(fromDate, 70));
      if (!schedule.occurrenceDates.length) throw new Error('La programacion no genera ninguna clase en el periodo seleccionado');
      return operationsRepository.createClassSchedule(schedule);
    }
    const fecha = normalizeDate(payload.fecha, 'Fecha');
    return operationsRepository.createClass({
      nombre: requiredText(payload.nombre, 'Nombre'),
      profesor: professor.profesorNombre || professor.nombre,
      profesorId: professor.profesorId || professor.id,
      fecha,
      hora,
      capacidad: normalizePositiveInteger(payload.capacidad || 12, 'Capacidad'),
      duracionMinutos: normalizePositiveInteger(payload.duracionMinutos || 60, 'Duracion'),
      notas: String(payload.notas || '').trim() || null,
      creadoTs: new Date().toISOString(),
    });
  }

  function listClassEnrollments(classId) {
    return operationsRepository.listClassEnrollments(normalizePositiveInteger(classId, 'Clase'));
  }

  async function enrollMember({ classId, userCi } = {}) {
    const ci = normalizePositiveInteger(userCi, 'Socio');
    const user = await userRepository.findByCi(ci);
    if (!user) throw new Error('Socio no encontrado');
    return operationsRepository.enrollMember({
      classId: normalizePositiveInteger(classId, 'Clase'),
      userCi: ci,
      userName: user.nombre,
      createdTs: new Date().toISOString(),
    });
  }

  function listPendingSales() {
    return operationsRepository.listPendingSales({ estado: 'pendiente' });
  }

  function getPendingSummaryByDate(fecha) {
    return operationsRepository.getPendingSummaryByDate(String(fecha || nowLocalParts().fecha));
  }

  async function createPendingSale(payload = {}) {
    const productId = normalizePositiveInteger(payload.productoId, 'Producto');
    const userCi = normalizePositiveInteger(payload.usuarioCi, 'Socio');
    const quantity = normalizePositiveInteger(payload.cantidad || 1, 'Cantidad');
    const [product, user] = await Promise.all([
      productRepository.findById(productId),
      userRepository.findByCi(userCi),
    ]);
    if (!product) throw new Error('Producto no encontrado');
    if (!user) throw new Error('Socio no encontrado');
    const professor = await resolveProfessor(payload);
    const now = nowLocalParts();
    return operationsRepository.createPendingSale({
      productoId: productId,
      productoNombre: product.nombre,
      usuarioCi: userCi,
      usuarioNombre: user.nombre,
      cantidad: quantity,
      total: Number(product.precio || 0) * quantity,
      profesor: professor.profesorNombre || professor.nombre,
      profesorId: professor.profesorId || professor.id,
      profesorSesionId: professor.profesorSesionId || professor.sesionId,
      observacion: String(payload.observacion || '').trim() || null,
      ...now,
    });
  }

  async function collectPendingSale({ id, formaPago = 'efectivo', observacion = null } = {}) {
    const saleId = normalizePositiveInteger(id, 'Venta');
    const sale = await operationsRepository.findPendingSaleById(saleId);
    if (!sale || sale.estado !== 'pendiente') throw new Error('El cobro ya no esta pendiente');

    const payment = cashService.normalizePaymentDetails({
      monto: Number(sale.total || 0),
      formaPago,
      observacion: observacion || `Cobro pendiente del Local 2 - ${sale.profesor}`,
    });
    const collectionDate = nowLocalParts().fecha;
    const movement = await cashService.registerMovement({
      tipoIngreso: 'venta_producto',
      descripcion: `${sale.producto_nombre} · venta pendiente Local 2`,
      payment,
      usuario: { ci: sale.usuario_ci, nombre: sale.usuario_nombre },
      producto: { id: sale.producto_id, nombre: sale.producto_nombre },
      cantidad: sale.cantidad,
      referencia: { tabla: 'ventas_pendientes', id: sale.id },
      fecha: collectionDate,
    });
    await operationsRepository.markPendingSaleCollected({
      id: sale.id,
      formaPago: payment.formaPago,
      cobradoTs: new Date().toISOString(),
      cajaMovimientoId: movement.id,
    });
    return { saleId: sale.id, movement };
  }

  return {
    listStock,
    transferStock,
    listLocations,
    listUpcomingClasses,
    createClass,
    listClassEnrollments,
    enrollMember,
    listPendingSales,
    getPendingSummaryByDate,
    createPendingSale,
    collectPendingSale,
  };
}

module.exports = { createOperationsService };
