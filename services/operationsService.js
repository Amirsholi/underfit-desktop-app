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

  async function transferStock(payload = {}) {
    const now = nowLocalParts();
    return operationsRepository.transferStock({
      productoId: normalizePositiveInteger(payload.productoId, 'Producto'),
      cantidad: normalizePositiveInteger(payload.cantidad, 'Cantidad'),
      responsable: String(payload.responsable || 'Recepcion').trim(),
      ...now,
    });
  }

  function listUpcomingClasses(fromDate = null) {
    return operationsRepository.listClasses({ fromDate: String(fromDate || nowLocalParts().fecha) });
  }

  async function createClass(payload = {}) {
    const fecha = requiredText(payload.fecha, 'Fecha');
    const hora = requiredText(payload.hora, 'Hora');
    const professor = await resolveProfessor(payload);
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
