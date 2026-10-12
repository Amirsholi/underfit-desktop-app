const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  agregarUsuario: (datos) => ipcRenderer.invoke('agregar-usuario', datos),

  obtenerUsuarios: () => ipcRenderer.invoke('obtener-usuarios'),

  obtenerUsuario: (ci) => ipcRenderer.invoke('obtener-usuario', ci),

  obtenerPagosMembresiaUsuario: (ci) => ipcRenderer.invoke('obtener-pagos-membresia-usuario', ci),

  validarYRegistrarIngreso: (ci, fuente = 'kiosk', observacion = null, contexto = {}) =>
    ipcRenderer.invoke('validar-y-registrar-ingreso', { ...contexto, ci, fuente, observacion }),

  guardarEdicionManualUsuario: (ci, datos) =>
    ipcRenderer.invoke('guardar-edicion-manual-usuario', ci, datos),

  renovarMembresia: (payload) => ipcRenderer.invoke('renovar-membresia', payload),

  obtenerUltimosIngresos: () => ipcRenderer.invoke('obtener-ultimos-ingresos'),
  obtenerIngresos: (desde, hasta, socioCi) =>
    ipcRenderer.invoke('obtener-ingresos', { desde, hasta, socioCi }),

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
  actualizarProgramacionClase: (payload) => ipcRenderer.invoke('actualizar-programacion-clase', payload),
  marcarClasePrueba: (payload) => ipcRenderer.invoke('marcar-clase-prueba', payload),

  obtenerInscripcionesClase: (claseId) => ipcRenderer.invoke('obtener-inscripciones-clase', claseId),

  inscribirSocioClase: (payload) => ipcRenderer.invoke('inscribir-socio-clase', payload),
  quitarAlumnoClase: (payload) => ipcRenderer.invoke('quitar-alumno-clase', payload),
  eliminarClase: id => ipcRenderer.invoke('eliminar-clase', id),

  obtenerClaseActual: (payload) => ipcRenderer.invoke('obtener-clase-actual', payload),

  registrarAsistenciaClase: (payload) => ipcRenderer.invoke('registrar-asistencia-clase', payload),

  obtenerRegistrosClases: (fecha) => ipcRenderer.invoke('obtener-registros-clases', fecha),

  obtenerDetalleRegistroClase: (claseId) => ipcRenderer.invoke('obtener-detalle-registro-clase', claseId),

  marcarEstadoClase: (payload) => ipcRenderer.invoke('marcar-estado-clase', payload),

  puntuarAsistenciaClase: (payload) => ipcRenderer.invoke('puntuar-asistencia-clase', payload),

  corregirAsistenciaClase: (payload) => ipcRenderer.invoke('corregir-asistencia-clase', payload),

  obtenerVentasPendientes: () => ipcRenderer.invoke('obtener-ventas-pendientes'),

  obtenerResumenVentasPendientes: (fecha) => ipcRenderer.invoke('obtener-resumen-ventas-pendientes', fecha),

  crearVentaPendiente: (payload) => ipcRenderer.invoke('crear-venta-pendiente', payload),

  cobrarVentaPendiente: (payload) => ipcRenderer.invoke('cobrar-venta-pendiente', payload),

  obtenerProfesores: (incluirInactivos = false) => ipcRenderer.invoke('obtener-profesores', incluirInactivos),

  crearProfesor: (payload) => ipcRenderer.invoke('crear-profesor', payload),

  actualizarProfesor: (id, datos) => ipcRenderer.invoke('actualizar-profesor', { id, datos }),
  obtenerEjercicios: (incluirInactivos = false) =>
    ipcRenderer.invoke('obtener-ejercicios', incluirInactivos),
  crearEjercicio: (payload) => ipcRenderer.invoke('crear-ejercicio', payload),
  actualizarEjercicio: (id, datos) =>
    ipcRenderer.invoke('actualizar-ejercicio', { id, datos }),
  asignarRutinaSocio: (identityNumber, plan) =>
    ipcRenderer.invoke('asignar-rutina-socio', { identityNumber, plan }),
  obtenerPreRutinas: () => ipcRenderer.invoke('obtener-pre-rutinas'),
  obtenerRutinasSocios: () => ipcRenderer.invoke('obtener-rutinas-socios'),
  guardarPreRutina: (payload) => ipcRenderer.invoke('guardar-pre-rutina', payload),
  subirVideoEjercicio: (filePath) => ipcRenderer.invoke('subir-video-ejercicio', filePath),

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

  registrarSalidaCaja: (fecha, monto, formaPago = 'efectivo', observacion = null, responsable = null) =>
    ipcRenderer.invoke('registrar-salida-caja', { fecha, monto, formaPago, observacion, responsable }),

  abrirCarpetaCierres: (fecha) => ipcRenderer.invoke('abrir-carpeta-cierres', fecha),

  corregirMovimientoCaja: (payload) => ipcRenderer.invoke('corregir-movimiento-caja', payload),

  obtenerInfoSistema: () => ipcRenderer.invoke('obtener-info-sistema'),
  obtenerSonidosIngreso: () => ipcRenderer.invoke('obtener-sonidos-ingreso'),
  guardarSonidosIngreso: muted => ipcRenderer.invoke('guardar-sonidos-ingreso', muted),
  cargarSonidoIngreso: kind => ipcRenderer.invoke('cargar-sonido-ingreso', kind),
  onSonidosIngresoActualizados: callback => {
    const listener = (_event, preferences) => callback(preferences);
    ipcRenderer.on('sonidos-ingreso-actualizados', listener);
    return () => ipcRenderer.removeListener('sonidos-ingreso-actualizados', listener);
  },

  guardarConfiguracionNegocio: (payload) => ipcRenderer.invoke('guardar-configuracion-negocio', payload),
  crearCodigoTablet: deviceId => ipcRenderer.invoke('crear-codigo-tablet', deviceId),
  onEventoActualizado: callback => {
    const listener = (_event, settings) => callback(settings);
    ipcRenderer.on('evento-actualizado', listener);
    return () => ipcRenderer.removeListener('evento-actualizado', listener);
  },

  crearBackupManual: () => ipcRenderer.invoke('crear-backup-manual'),

  cambiarPantallaPuerta: () => ipcRenderer.invoke('cambiar-pantalla-puerta'),

  abrirPantallaTablet: () => ipcRenderer.invoke('abrir-pantalla-tablet'),

  eliminarUsuario: (ci) => ipcRenderer.invoke('eliminar-usuario', ci),
  restablecerAccesoMovil: (ci, password) =>
    ipcRenderer.invoke('restablecer-acceso-movil', { ci, password }),

  onEnfocarInput: (callback) => {
    ipcRenderer.removeAllListeners('enfocar-input');
    ipcRenderer.on('enfocar-input', callback);
  },

  onTeclaPadIngreso: (callback) => {
    ipcRenderer.removeAllListeners('tecla-pad-ingreso');
    ipcRenderer.on('tecla-pad-ingreso', (_event, key) => callback(key));
  }
});
