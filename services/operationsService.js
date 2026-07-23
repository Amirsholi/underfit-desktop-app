function createOperationsService({
  operationsRepository,
  userRepository,
  productRepository,
  cashService,
  staffService = null,
  membershipRules = null,
  clock = () => new Date(),
}) {
  function nowLocalParts() {
    const d = clock();
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

  function normalizeTime(value, fieldName = 'Hora') {
    const normalized = requiredText(value, fieldName);
    if (!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(normalized)) throw new Error(`${fieldName} invalida`);
    return normalized.length === 5 ? `${normalized}:00` : normalized;
  }

  function timeToMinutes(value) {
    const [hours, minutes] = String(value).split(':').map(Number);
    return (hours * 60) + minutes;
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

  async function reconcileUnstartedClasses(referenceDate = clock()) {
    if (!operationsRepository.listUnstartedClassesThrough || !operationsRepository.cancelUnstartedClass) return [];
    const referenceDay = formatLocalDate(referenceDate);
    const classes = await operationsRepository.listUnstartedClassesThrough(referenceDay);
    const cancelled = [];
    for (const item of classes) {
      const scheduledStart = new Date(`${item.fecha}T${String(item.hora || '00:00').slice(0, 8)}`);
      if (Number.isNaN(scheduledStart.getTime())) continue;
      const deadline = new Date(scheduledStart.getTime() + ((Number(item.duracionMinutos || 60) + 30) * 60000));
      if (referenceDate <= deadline) continue;
      const result = await operationsRepository.cancelUnstartedClass({
        classId: item.id,
        cancelledTs: referenceDate.toISOString(),
        reason: 'sin_registro_profesor',
      });
      if (result.changed) cancelled.push(item.id);
    }
    return cancelled;
  }

  async function listUpcomingClasses(fromDate = null) {
    const normalizedFromDate = normalizeDate(fromDate || nowLocalParts().fecha, 'Fecha');
    await ensureUpcomingClasses(normalizedFromDate);
    await reconcileUnstartedClasses();
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

  async function getCurrentClass(payload = {}) {
    const localId = normalizePositiveInteger(payload.localId || 1, 'Local');
    const now = nowLocalParts();
    const fecha = normalizeDate(payload.fecha || now.fecha, 'Fecha');
    const hora = normalizeTime(payload.hora || now.hora);
    await ensureUpcomingClasses(fecha);
    await reconcileUnstartedClasses();
    const candidates = await operationsRepository.listClassCandidates({ localId, fecha });
    const currentMinutes = timeToMinutes(hora);
    const matching = candidates.filter(item => {
      const start = timeToMinutes(item.hora);
      const end = start + Number(item.duracionMinutos || 60);
      return currentMinutes >= start - 45 && currentMinutes <= end + 30;
    });
    const ordered = [...matching].sort((a, b) => {
      if (a.estado === 'en_curso' && b.estado !== 'en_curso') return -1;
      if (b.estado === 'en_curso' && a.estado !== 'en_curso') return 1;
      return Math.abs(timeToMinutes(a.hora) - currentMinutes) - Math.abs(timeToMinutes(b.hora) - currentMinutes);
    });
    return {
      localId,
      fecha,
      hora,
      clase: ordered.length === 1 ? ordered[0] : null,
      requiereSeleccion: ordered.length > 1,
      candidatas: ordered,
    };
  }

  async function startClass(payload = {}) {
    const staff = await resolveActiveStaffSession(payload);
    const current = await getCurrentClass({
      localId: staff.localId,
      fecha: payload.fecha,
      hora: payload.hora,
    });
    let classId = payload.claseId ? normalizePositiveInteger(payload.claseId, 'Clase') : null;
    if (!classId) {
      if (current.requiereSeleccion) return { started: false, reason: 'class_selection_required', ...current };
      classId = current.clase?.id || null;
    }
    const selected = current.candidatas.find(item => Number(item.id) === Number(classId));
    if (!selected) throw new Error('No hay una clase vigente para este local y horario');
    const result = await operationsRepository.startClass({
      classId,
      localId: staff.localId,
      professorId: staff.profesorId,
      professorSessionId: staff.profesorSesionId,
      startedTs: clock().toISOString(),
    });
    return {
      started: true,
      reason: result.alreadyStarted ? 'already_started' : 'class_started',
      class: { ...selected, estado: 'en_curso', inicioRealTs: result.inicioRealTs },
      professor: { id: staff.profesorId, nombre: staff.profesorNombre },
    };
  }

  async function resolveActiveStaffSession(payload = {}) {
    if (!payload.profesorSesionId) throw new Error('El profesor debe iniciar su turno en este dispositivo');
    const identity = await resolveProfessor({ profesorSesionId: payload.profesorSesionId });
    if (!identity.profesorSesionId || !identity.profesorId) throw new Error('La sesion del profesor no esta activa');
    if (payload.dispositivoId && identity.dispositivoId !== String(payload.dispositivoId).trim()) {
      throw new Error('La sesion pertenece a otro dispositivo');
    }
    if (payload.localId && Number(identity.localId) !== Number(payload.localId)) {
      throw new Error('La sesion pertenece a otro local');
    }
    return identity;
  }

  async function registerClassAttendance(payload = {}) {
    const ci = normalizePositiveInteger(payload.ci || payload.usuarioCi, 'Socio');
    const user = await userRepository.findByCi(ci);
    if (!user) throw new Error('Socio no encontrado');
    if (!membershipRules?.isMembershipActive?.(user.fecha_vencimiento)) {
      throw new Error('La membresia del socio no esta activa');
    }

    const staff = await resolveActiveStaffSession(payload);
    const localId = Number(staff.localId);
    const dispositivoId = staff.dispositivoId;
    const current = await getCurrentClass({
      localId,
      fecha: payload.fecha,
      hora: payload.hora,
    });
    let classId = payload.claseId ? normalizePositiveInteger(payload.claseId, 'Clase') : null;
    if (!classId) {
      if (current.requiereSeleccion) {
        return { registered: false, reason: 'class_selection_required', ...current };
      }
      classId = current.clase?.id || null;
    }
    const selected = current.candidatas.find(item => Number(item.id) === Number(classId));
    if (!selected) throw new Error('No hay una clase activa para este local y horario');

    const now = nowLocalParts();
    const attendance = await operationsRepository.registerClassAttendance({
      claseId: classId,
      usuarioCi: ci,
      localId,
      dispositivoId,
      profesorId: staff.profesorId,
      profesorSesionId: staff.profesorSesionId,
      observacion: `Asistencia a ${selected.nombre}`,
      ...now,
    });
    return {
      registered: true,
      reason: 'attendance_registered',
      user: { ci: user.ci, nombre: user.nombre },
      class: selected,
      professor: { id: staff.profesorId, nombre: staff.profesorNombre },
      attendance,
    };
  }

  async function finishClass(payload = {}) {
    const staff = await resolveActiveStaffSession(payload);
    const classId = normalizePositiveInteger(payload.claseId, 'Clase');
    const detail = await operationsRepository.getClassRecordDetail(classId);
    if (!detail) throw new Error('Clase no encontrada');
    if (Number(detail.localId) !== Number(staff.localId)) throw new Error('La clase pertenece a otro local');
    return operationsRepository.finishClass({
      classId,
      professorId: staff.profesorId,
      professorSessionId: staff.profesorSesionId,
      finishedTs: clock().toISOString(),
    });
  }

  async function listClassRecordsByDate(fecha = null) {
    await reconcileUnstartedClasses();
    return operationsRepository.listClassRecordsByDate(normalizeDate(fecha || nowLocalParts().fecha, 'Fecha'));
  }

  async function getClassRecordDetail(classId) {
    const detail = await operationsRepository.getClassRecordDetail(normalizePositiveInteger(classId, 'Clase'));
    if (!detail) throw new Error('Clase no encontrada');
    return detail;
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
      localId: professor.localId || normalizePositiveInteger(payload.localId || 2, 'Local'),
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
      observacion: observacion || `Cobro pendiente del Local ${sale.local_id || 2} - ${sale.profesor}`,
    });
    const collectionDate = nowLocalParts().fecha;
    const movement = await cashService.registerMovement({
      tipoIngreso: 'venta_producto',
      descripcion: `${sale.producto_nombre} · venta pendiente Local ${sale.local_id || 2}`,
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
    getCurrentClass,
    startClass,
    registerClassAttendance,
    finishClass,
    listClassRecordsByDate,
    getClassRecordDetail,
    listPendingSales,
    getPendingSummaryByDate,
    createPendingSale,
    collectPendingSale,
  };
}

module.exports = { createOperationsService };
