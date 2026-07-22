const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  agregarUsuario: (datos) => ipcRenderer.invoke('agregar-usuario', datos),

  obtenerUsuarios: () => ipcRenderer.invoke('obtener-usuarios'),

  obtenerUsuario: (ci) => ipcRenderer.invoke('obtener-usuario', ci),

  obtenerPagosMembresiaUsuario: (ci) => ipcRenderer.invoke('obtener-pagos-membresia-usuario', ci),

  validarYRegistrarIngreso: (ci, fuente = 'kiosk', observacion = null) =>
    ipcRenderer.invoke('validar-y-registrar-ingreso', { ci, fuente, observacion }),

  guardarEdicionManualUsuario: (ci, datos) =>
    ipcRenderer.invoke('guardar-edicion-manual-usuario', ci, datos),

  renovarMembresia: (payload) => ipcRenderer.invoke('renovar-membresia', payload),

  obtenerIngresos: (desde, hasta) =>
    ipcRenderer.invoke('obtener-ingresos', { desde, hasta }),

  anularIngreso: (payload) => ipcRenderer.invoke('anular-ingreso', payload),

  obtenerProductos: () => ipcRenderer.invoke('obtener-productos'),

  crearProducto: (datos) => ipcRenderer.invoke('crear-producto', datos),

  actualizarProducto: (id, datos) => ipcRenderer.invoke('actualizar-producto', { id, datos }),

  eliminarProducto: (id) => ipcRenderer.invoke('eliminar-producto', id),

  venderProducto: (payload) => ipcRenderer.invoke('vender-producto', payload),

  obtenerVentasProductos: (fecha) => ipcRenderer.invoke('obtener-ventas-productos', fecha),

  obtenerTotalVentasProductos: (fecha) => ipcRenderer.invoke('obtener-total-ventas-productos', fecha),

  obtenerStockLocales: () => ipcRenderer.invoke('obtener-stock-locales'),

  transferirStockLocal: (payload) => ipcRenderer.invoke('transferir-stock-local', payload),

  obtenerLocales: () => ipcRenderer.invoke('obtener-locales'),

  obtenerClasesProximas: (desde) => ipcRenderer.invoke('obtener-clases-proximas', desde),

  crearClase: (payload) => ipcRenderer.invoke('crear-clase', payload),

  obtenerInscripcionesClase: (claseId) => ipcRenderer.invoke('obtener-inscripciones-clase', claseId),

  inscribirSocioClase: (payload) => ipcRenderer.invoke('inscribir-socio-clase', payload),

  obtenerVentasPendientes: () => ipcRenderer.invoke('obtener-ventas-pendientes'),

  obtenerResumenVentasPendientes: (fecha) => ipcRenderer.invoke('obtener-resumen-ventas-pendientes', fecha),

  crearVentaPendiente: (payload) => ipcRenderer.invoke('crear-venta-pendiente', payload),

  cobrarVentaPendiente: (payload) => ipcRenderer.invoke('cobrar-venta-pendiente', payload),

  obtenerProfesores: (incluirInactivos = false) => ipcRenderer.invoke('obtener-profesores', incluirInactivos),

  crearProfesor: (payload) => ipcRenderer.invoke('crear-profesor', payload),

  actualizarProfesor: (id, datos) => ipcRenderer.invoke('actualizar-profesor', { id, datos }),

  iniciarSesionProfesor: (payload) => ipcRenderer.invoke('iniciar-sesion-profesor', payload),

  obtenerSesionProfesorActiva: (dispositivoId) => ipcRenderer.invoke('obtener-sesion-profesor-activa', dispositivoId),

  finalizarSesionProfesor: (sesionId) => ipcRenderer.invoke('finalizar-sesion-profesor', sesionId),

  abrirCajaDia: (payload) => ipcRenderer.invoke('abrir-caja-dia', payload),

  obtenerAperturaCajaDia: (fecha) => ipcRenderer.invoke('obtener-apertura-caja-dia', fecha),

  obtenerMovimientosCaja: (fecha) => ipcRenderer.invoke('obtener-movimientos-caja', fecha),

  obtenerResumenCajaDia: (fecha) => ipcRenderer.invoke('obtener-resumen-caja-dia', fecha),

  obtenerReporteCajaDia: (fecha) => ipcRenderer.invoke('obtener-reporte-caja-dia', fecha),

  registrarIngresoManualCaja: (payload) => ipcRenderer.invoke('registrar-ingreso-manual-caja', payload),

  cerrarCajaDia: (fecha, efectivoContadoOrObservacion = null, observacion = null, cajeroCierre = null) => {
    const payload = typeof efectivoContadoOrObservacion === 'string' && observacion === null
      ? { fecha, efectivoContado: null, observacion: efectivoContadoOrObservacion }
      : { fecha, efectivoContado: efectivoContadoOrObservacion, observacion, cajeroCierre };

    return ipcRenderer.invoke('cerrar-caja-dia', payload);
  },

  obtenerCierreCajaDia: (fecha) => ipcRenderer.invoke('obtener-cierre-caja-dia', fecha),

  ajustarTotalCajaDia: (fecha, nuevoTotal, observacion = null) =>
    ipcRenderer.invoke('ajustar-total-caja-dia', { fecha, nuevoTotal, observacion }),

  registrarSalidaCaja: (fecha, monto, formaPago = 'efectivo', observacion = null) =>
    ipcRenderer.invoke('registrar-salida-caja', { fecha, monto, formaPago, observacion }),

  corregirMovimientoCaja: (payload) => ipcRenderer.invoke('corregir-movimiento-caja', payload),

  obtenerInfoSistema: () => ipcRenderer.invoke('obtener-info-sistema'),

  guardarConfiguracionNegocio: (payload) => ipcRenderer.invoke('guardar-configuracion-negocio', payload),

  crearBackupManual: () => ipcRenderer.invoke('crear-backup-manual'),

  cambiarPantallaPuerta: () => ipcRenderer.invoke('cambiar-pantalla-puerta'),

  eliminarUsuario: (ci) => ipcRenderer.invoke('eliminar-usuario', ci),

  onEnfocarInput: (callback) => {
    ipcRenderer.removeAllListeners('enfocar-input');
    ipcRenderer.on('enfocar-input', callback);
  }
});
