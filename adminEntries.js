function orderCashMovementsByRegistration(movements) {
  return [...(movements || [])].sort((a, b) => Number(b.id) - Number(a.id));
}

function createAdminEntriesController({ shared }) {
  const fechaDashboard = document.getElementById('dashboard-fecha');
  const dashboardPageTitle = document.querySelector('#modal-dashboard > .admin-section-heading h3');
  const dashboardPageKicker = document.getElementById('dashboard-page-kicker');
  const dashboardPageHeading = document.getElementById('dashboard-page-heading');
  const dashboardPageCopy = document.getElementById('dashboard-page-copy');
  const estadoDashboard = document.getElementById('dashboard-estado-ingresos');
  const tablaDashboardIngresos = document.getElementById('tabla-dashboard-ingresos');
  const sinIngresos = document.getElementById('dashboard-sin-ingresos');
  const widgetIngresosHoy = document.getElementById('widget-ingresos-hoy');
  const widgetDineroHoy = document.getElementById('widget-ventas-hoy');
  const annulEntryModal = document.getElementById('modal-anular-ingreso');
  const annulEntryIdInput = document.getElementById('anular-ingreso-id');
  const annulEntryDetail = document.getElementById('anular-ingreso-detalle');
  const annulEntryReasonInput = document.getElementById('anular-ingreso-motivo');
  const annulEntrySaveButton = document.getElementById('guardar-anulacion-ingreso');

  const estadoCajaPill = document.getElementById('dashboard-estado-caja-pill');
  const estadoCajaTexto = document.getElementById('dashboard-estado-caja-texto');
  const aperturaCard = document.getElementById('dashboard-apertura-card');
  const aperturaResumen = document.getElementById('dashboard-apertura-resumen');
  const aperturaEstado = document.getElementById('dashboard-apertura-estado');
  const aperturaResumenMonto = document.getElementById('dashboard-apertura-resumen-monto');
  const aperturaResumenObservacion = document.getElementById('dashboard-apertura-resumen-observacion');
  const aperturaEditarButton = document.getElementById('dashboard-editar-apertura');
  const aperturaCajeroInput = document.getElementById('dashboard-apertura-cajero');
  const aperturaMontoInput = document.getElementById('dashboard-apertura-monto');
  const aperturaObservacionInput = document.getElementById('dashboard-apertura-observacion');
  const aperturaGuardarButton = document.getElementById('dashboard-guardar-apertura');
  const cierreEstado = document.getElementById('dashboard-cierre-estado');
  const cierreResumenCard = document.getElementById('dashboard-cierre-resumen');
  const cierreHoraResumen = document.getElementById('dashboard-cierre-hora');
  const cierreContadoResumen = document.getElementById('dashboard-cierre-contado');
  const cierreDiferenciaResumen = document.getElementById('dashboard-cierre-diferencia');
  const cierreObservacionResumen = document.getElementById('dashboard-cierre-observacion-resumen');

  const totalIngresosCaja = document.getElementById('dashboard-total-ingresos');
  const totalEfectivoCaja = document.getElementById('dashboard-total-efectivo');
  const totalTransferenciaCaja = document.getElementById('dashboard-total-tarjeta');
  const totalEgresosCaja = document.getElementById('dashboard-total-egresos');
  const tablaDashboardCaja = document.getElementById('tabla-dashboard-caja');
  const sinCaja = document.getElementById('dashboard-sin-caja');
  const homeActivityBody = document.getElementById('home-activity-body');
  const homeActivityEmpty = document.getElementById('home-activity-empty');

  const ingresoManualButton = document.getElementById('dashboard-registrar-ingreso-manual');
  const salidaButton = document.getElementById('dashboard-registrar-salida');
  const cerrarCajaButton = document.getElementById('dashboard-cerrar-caja');
  const abrirCajaButton = document.getElementById('dashboard-abrir-caja');
  const verCierreButton = document.getElementById('dashboard-ver-cierre');

  const adjustmentModal = document.getElementById('modal-ajuste-total');
  const adjustmentTotalInput = document.getElementById('ajuste-total-nuevo');
  const adjustmentReasonInput = document.getElementById('ajuste-total-observacion');
  const adjustmentSaveButton = document.getElementById('guardar-ajuste-total');

  const outputModal = document.getElementById('modal-salida-caja');
  const outputAmountInput = document.getElementById('salida-caja-monto');
  const outputResponsibleInput = document.getElementById('salida-caja-responsable');
  const outputReasonInput = document.getElementById('salida-caja-observacion');
  const outputSaveButton = document.getElementById('guardar-salida-caja');

  const correctionModal = document.getElementById('modal-corregir-movimiento');
  const correctionIdInput = document.getElementById('corregir-movimiento-id');
  const correctionAmountInput = document.getElementById('corregir-movimiento-monto');
  const correctionObservationInput = document.getElementById('corregir-movimiento-observacion');
  const correctionReasonInput = document.getElementById('corregir-movimiento-motivo');
  const correctionSaveButton = document.getElementById('guardar-correccion-movimiento');
  const correctionOriginal = document.getElementById('corregir-movimiento-original');

  const manualIncomeModal = document.getElementById('modal-ingreso-manual-caja');
  const manualIncomeAmountInput = document.getElementById('ingreso-manual-monto');
  const manualIncomeResponsibleInput = document.getElementById('ingreso-manual-responsable');
  const manualIncomeObservationInput = document.getElementById('ingreso-manual-observacion');
  const manualIncomeSaveButton = document.getElementById('guardar-ingreso-manual-caja');

  const closeModal = document.getElementById('modal-cierre-caja');
  const closeExpectedCashInput = document.getElementById('cierre-efectivo-esperado');
  const closePendingSummary = document.getElementById('cierre-pendientes-resumen');
  const closeCountedCashInput = document.getElementById('cierre-efectivo-contado');
  const closeCashierInput = document.getElementById('cierre-cajero');
  const closeDifferenceInput = document.getElementById('cierre-diferencia');
  const closeObservationInput = document.getElementById('cierre-observacion');
  const closeSaveButton = document.getElementById('guardar-cierre-caja');

  let currentSummary = null;
  let currentMovements = new Map();
  let currentEntries = new Map();
  let showDashboardTab = () => {};

  function cashEscape(value) {
    const span = document.createElement('span');
    span.textContent = String(value ?? '');
    return span.innerHTML;
  }

  function hoyYYYYMMDD() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function formatearMoneda(valor) {
    return new Intl.NumberFormat('es-UY', {
      style: 'currency',
      currency: 'UYU',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(valor || 0));
  }

  function formatearTipoMovimiento(tipo) {
    const labels = {
      alta: 'Alta',
      renovacion: 'Renovación',
      membresia: 'Renovación',
      venta_producto: 'Venta',
      ingreso_manual: 'Entrada',
      egreso: 'Salida',
      ajuste_manual: 'Ajuste',
    };
    return labels[tipo] || tipo || '-';
  }

  function capitalizarFormaPago(formaPago) {
    const labels = {
      efectivo: 'Efectivo',
      transferencia: 'Transferencia',
    };
    return labels[formaPago] || formaPago || '-';
  }

  function formatearDiferenciaCaja(valor) {
    const diferencia = Number(valor || 0);
    if (diferencia > 0) {
      return `Sobrante: ${formatearMoneda(diferencia)}`;
    }
    if (diferencia < 0) {
      return `Faltante: ${formatearMoneda(diferencia)}`;
    }
    return `Sin diferencia: ${formatearMoneda(0)}`;
  }

  function getCheckedValue(name, fallback = '') {
    const checked = document.querySelector(`input[name="${name}"]:checked`);
    return checked?.value || fallback;
  }

  function setCajaActionsEnabled(enabled) {
    [aperturaCajeroInput, aperturaMontoInput, aperturaObservacionInput, aperturaGuardarButton, ingresoManualButton, salidaButton, cerrarCajaButton]
      .forEach(element => {
        if (element) element.disabled = !enabled;
      });
  }

  function mostrarFormularioApertura(mostrar) {
    aperturaCard.style.display = mostrar ? 'grid' : 'none';
  }

  async function cargarIngresosDelDia(fecha) {
    if (!tablaDashboardIngresos || !sinIngresos) return;

    try {
      estadoDashboard.textContent = 'Cargando...';
      tablaDashboardIngresos.innerHTML = '';
      sinIngresos.style.display = 'none';

      const filas = window.api?.obtenerIngresos
        ? await window.api.obtenerIngresos(fecha, fecha)
        : [
            { id: 1, hora: '08:14', ci: 49876543, nombre: 'Martina Silva' },
            { id: 2, hora: '09:02', ci: 43219876, nombre: 'Bruno Rodríguez' },
            { id: 3, hora: '10:37', ci: 51234567, nombre: 'Lucas Pereira' },
            { id: 4, hora: '17:46', ci: 37654321, nombre: 'Camila Fernández' },
          ];
      currentEntries = new Map((filas || []).map(row => [Number(row.id), row]));
      estadoDashboard.textContent = '';

      if (!filas?.length) {
        sinIngresos.style.display = 'block';
        return;
      }

      filas.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${row.hora || '-'}</td>
          <td>${row.ci ?? '-'}</td>
          <td>${row.nombre ?? '-'}</td>
          <td>${fecha === hoyYYYYMMDD() ? `<button class="table-action-button" type="button" data-anular-ingreso="${row.id}">Anular</button>` : ''}</td>
        `;
        tablaDashboardIngresos.appendChild(tr);
      });
    } catch (error) {
      console.error('Error cargando ingresos:', error);
      estadoDashboard.textContent = 'Error al cargar ingresos';
      sinIngresos.style.display = 'grid';
    }
  }

  function abrirAnulacionIngreso(id) {
    const row = currentEntries.get(Number(id));
    if (!row) return;
    annulEntryIdInput.value = String(row.id);
    annulEntryDetail.textContent = `${row.hora || '-'} · ${row.ci || '-'} · ${row.nombre || '-'}`;
    annulEntryReasonInput.value = '';
    annulEntryModal.style.display = 'flex';
  }

  async function guardarAnulacionIngreso() {
    const motivo = annulEntryReasonInput.value.trim();
    if (!motivo) {
      shared.mostrarNotificacion('Ingresa el motivo de la anulacion', 'warning');
      return;
    }
    try {
      await window.api.anularIngreso({ id: annulEntryIdInput.value, motivo });
      annulEntryModal.style.display = 'none';
      shared.mostrarNotificacion('Ingreso anulado con trazabilidad', 'success');
      const fecha = fechaDashboard?.value || hoyYYYYMMDD();
      await cargarIngresosDelDia(fecha);
      await actualizarWidgetIngresosHoy();
      document.dispatchEvent(new CustomEvent('entries:updated'));
    } catch (error) {
      shared.mostrarNotificacion(error?.message || 'No se pudo anular el ingreso', 'error');
    }
  }

  async function actualizarWidgetIngresosHoy() {
    if (!widgetIngresosHoy) return;

    if (!window.api?.obtenerIngresos) {
      widgetIngresosHoy.textContent = '7';
      return;
    }

    try {
      const hoy = hoyYYYYMMDD();
      const filas = await window.api.obtenerIngresos(hoy, hoy);
      widgetIngresosHoy.textContent = String(Array.isArray(filas) ? filas.length : 0);
    } catch (error) {
      console.error('Error cargando widget de ingresos:', error);
      widgetIngresosHoy.textContent = '0';
    }
  }

  async function actualizarWidgetDineroHoy() {
    if (!widgetDineroHoy) return;

    if (!window.api?.obtenerResumenCajaDia) {
      widgetDineroHoy.textContent = formatearMoneda(10545);
      return;
    }

    try {
      const resumen = await window.api.obtenerResumenCajaDia(hoyYYYYMMDD());
      widgetDineroHoy.textContent = formatearMoneda(resumen?.totalIngresos || 0);
    } catch (error) {
      console.error('Error cargando widget de dinero:', error);
      widgetDineroHoy.textContent = formatearMoneda(0);
    }
  }

  function actualizarEstadoAperturaYCierre(resumen) {
    const apertura = resumen?.apertura;
    const cierre = resumen?.cierre;
    const sesionAbierta = resumen?.sesionAbierta;
    const esHoy = (fechaDashboard?.value || hoyYYYYMMDD()) === hoyYYYYMMDD();
    currentSummary = resumen;

    if (sesionAbierta) {
      mostrarFormularioApertura(false);
      aperturaResumen.style.display = 'grid';
      aperturaEstado.textContent = `Caja abierta por ${sesionAbierta.cajero_apertura || 'Sin registrar'} a las ${sesionAbierta.hora_apertura}`;
      aperturaResumenMonto.textContent = `Monto inicial: ${formatearMoneda(sesionAbierta.monto_inicial_efectivo)}`;
      aperturaResumenObservacion.textContent = sesionAbierta.observacion ? `Observacion: ${sesionAbierta.observacion}` : '';
      aperturaCajeroInput.value = sesionAbierta.cajero_apertura || '';
      aperturaMontoInput.value = String(sesionAbierta.monto_inicial_efectivo ?? 0);
      aperturaObservacionInput.value = sesionAbierta.observacion || '';
      aperturaGuardarButton.textContent = 'Guardar';
      aperturaEditarButton.style.display = 'none';
    } else if (apertura) {
      mostrarFormularioApertura(false);
      aperturaResumen.style.display = 'none';
      aperturaEstado.textContent = `Ultima caja: ${apertura.cajero_apertura || 'Sin registrar'} a las ${apertura.hora_apertura}`;
      aperturaResumenMonto.textContent = `Monto inicial: ${formatearMoneda(apertura.monto_inicial_efectivo)}`;
      aperturaResumenObservacion.textContent = apertura.observacion ? `Observacion: ${apertura.observacion}` : '';
      aperturaCajeroInput.value = '';
      aperturaMontoInput.value = String(apertura.monto_inicial_efectivo ?? 0);
      if (cierre?.efectivo_contado !== undefined && esHoy) {
        aperturaMontoInput.value = String(cierre.efectivo_contado || 0);
      }
      aperturaObservacionInput.value = '';
      aperturaGuardarButton.textContent = esHoy ? 'Abrir caja' : 'Fecha historica';
      aperturaEditarButton.style.display = 'none';
    } else {
      mostrarFormularioApertura(false);
      aperturaResumen.style.display = 'none';
      aperturaEstado.textContent = esHoy ? 'Sin apertura registrada.' : 'Fecha historica sin apertura.';
      aperturaCajeroInput.value = '';
      aperturaMontoInput.value = esHoy && resumen?.ultimoCierreGlobal?.efectivo_contado !== undefined
        ? String(resumen.ultimoCierreGlobal.efectivo_contado || 0)
        : '';
      aperturaObservacionInput.value = '';
      aperturaGuardarButton.textContent = esHoy ? 'Abrir caja' : 'Fecha historica';
    }

    if (sesionAbierta) {
      estadoCajaPill.classList.remove('cash-state-closed');
      estadoCajaPill.classList.add('cash-state-open');
      estadoCajaTexto.textContent = 'Caja abierta';
      cierreEstado.textContent = 'Caja abierta y operativa.';
      cierreResumenCard.style.display = 'none';
      setCajaActionsEnabled(true);
      cerrarCajaButton.style.display = 'inline-flex';
      cerrarCajaButton.disabled = false;
      if (abrirCajaButton) abrirCajaButton.hidden = true;
      if (verCierreButton) verCierreButton.hidden = true;
    } else if (cierre) {
      estadoCajaPill.classList.remove('cash-state-open');
      estadoCajaPill.classList.add('cash-state-closed');
      estadoCajaTexto.textContent = 'Caja cerrada';
      cierreEstado.textContent = esHoy ? 'Pendiente de apertura.' : 'Fecha historica.';
      cierreResumenCard.style.display = 'none';
      cierreHoraResumen.textContent = cierre.hora_cierre || '-';
      cierreContadoResumen.textContent = formatearMoneda(cierre.efectivo_contado || 0);
      cierreDiferenciaResumen.textContent = formatearDiferenciaCaja(cierre.diferencia_efectivo || 0);
      cierreObservacionResumen.textContent = cierre.observacion || cierre.cajero_cierre || '-';
      setCajaActionsEnabled(esHoy);
      ingresoManualButton.disabled = true;
      salidaButton.disabled = true;
      cerrarCajaButton.style.display = 'none';
      cerrarCajaButton.disabled = true;
      if (abrirCajaButton) abrirCajaButton.hidden = !esHoy;
      if (verCierreButton) verCierreButton.hidden = false;
    } else {
      estadoCajaPill.classList.remove('cash-state-open');
      estadoCajaPill.classList.add('cash-state-closed');
      estadoCajaTexto.textContent = 'Caja cerrada';
      cierreEstado.textContent = esHoy ? 'Pendiente de apertura.' : 'Fecha historica.';
      cierreResumenCard.style.display = 'none';
      setCajaActionsEnabled(esHoy);
      ingresoManualButton.disabled = true;
      salidaButton.disabled = true;
      cerrarCajaButton.style.display = 'none';
      cerrarCajaButton.disabled = true;
      if (abrirCajaButton) abrirCajaButton.hidden = !esHoy;
      if (verCierreButton) verCierreButton.hidden = true;
    }
  }

  async function cargarCajaDelDia(fecha) {
    try {
      const previewMovements = [
        { id: 12, hora: '20:50', tipo_ingreso: 'venta_producto', producto_nombre: 'Shaker Under-Fit', usuario_nombre: 'Martina Silva', forma_pago: 'transferencia', monto: 390, cantidad: 1, responsable: 'Laura Méndez' },
        { id: 11, hora: '20:45', tipo_ingreso: 'renovacion', usuario_nombre: 'Carolina Díaz', forma_pago: 'efectivo', monto: 1600, cantidad: 1, responsable: 'Laura Méndez' },
        { id: 10, hora: '20:31', tipo_ingreso: 'venta_producto', producto_nombre: 'Proteína individual', usuario_nombre: 'Nicolás Torres', forma_pago: 'efectivo', monto: 180, cantidad: 1, responsable: 'Laura Méndez' },
        { id: 9, hora: '20:02', tipo_ingreso: 'egreso', descripcion: 'Compra de limpieza', forma_pago: 'efectivo', monto: -280, cantidad: 1, responsable: 'Laura Méndez' },
        { id: 8, hora: '19:34', tipo_ingreso: 'renovacion', usuario_nombre: 'Sofía Núñez', forma_pago: 'transferencia', monto: 4400, cantidad: 1, responsable: 'Laura Méndez' },
        { id: 7, hora: '19:16', tipo_ingreso: 'ingreso_manual', descripcion: 'Entrada eventual', forma_pago: 'efectivo', monto: 500, cantidad: 1, responsable: 'Laura Méndez' },
        { id: 6, hora: '18:42', tipo_ingreso: 'venta_producto', producto_nombre: 'Barrita de cereal chocolate', usuario_nombre: 'Ana Pereira', forma_pago: 'efectivo', monto: 70, cantidad: 1, responsable: 'Laura Méndez' },
        { id: 5, hora: '18:24', tipo_ingreso: 'venta_producto', producto_nombre: 'Agua mineral 1.5 L', usuario_nombre: 'Agustín Moreira', forma_pago: 'efectivo', monto: 95, cantidad: 1, responsable: 'Laura Méndez' },
        { id: 4, hora: '17:58', tipo_ingreso: 'renovacion', usuario_nombre: 'Federico Ramos', forma_pago: 'transferencia', monto: 1600, cantidad: 1, responsable: 'Laura Méndez' },
        { id: 3, hora: '16:12', tipo_ingreso: 'venta_producto', producto_nombre: 'Bebida isotónica 500 ml', usuario_nombre: 'Camila Bentancur', forma_pago: 'efectivo', monto: 120, cantidad: 1, responsable: 'Laura Méndez' },
        { id: 2, hora: '11:36', tipo_ingreso: 'egreso', descripcion: 'Insumos de recepción', forma_pago: 'transferencia', monto: -450, cantidad: 1, responsable: 'Laura Méndez' },
        { id: 1, hora: '09:18', tipo_ingreso: 'alta', usuario_nombre: 'Federico Núñez', forma_pago: 'efectivo', monto: 1600, cantidad: 1, responsable: 'Laura Méndez' },
      ];
      const previewSummary = {
        totalIngresos: 10545,
        efectivoEsperado: 6745,
        totalPorFormaPago: [
          { formaPago: 'efectivo', total: 7245 },
          { formaPago: 'transferencia', total: 3300 },
        ],
        totalPorTipoIngreso: [
          { tipoIngreso: 'alta', total: 1600 },
          { tipoIngreso: 'renovacion', total: 8810 },
          { tipoIngreso: 'venta_producto', total: 635 },
          { tipoIngreso: 'egreso', total: -500 },
        ],
        sesionAbierta: {
          id: 1,
          fecha,
          hora_apertura: '08:00',
          cajero_apertura: 'Recepción',
          monto_inicial_efectivo: 10000,
          observacion: 'Turno mañana',
        },
        apertura: null,
        cierre: null,
        sesiones: [],
      };
      const [resumen, loadedMovements] = window.api?.obtenerResumenCajaDia && window.api?.obtenerMovimientosCaja
        ? await Promise.all([
            window.api.obtenerResumenCajaDia(fecha),
            window.api.obtenerMovimientosCaja(fecha),
          ])
        : [previewSummary, previewMovements];
      renderCashSnapshot(fecha, resumen, loadedMovements);
    } catch (error) {
      console.error('Error cargando caja del dia:', error);
      totalIngresosCaja.textContent = formatearMoneda(0);
      totalEfectivoCaja.textContent = formatearMoneda(0);
      totalTransferenciaCaja.textContent = formatearMoneda(0);
      totalEgresosCaja.textContent = formatearMoneda(0);
      aperturaEstado.textContent = 'Error al cargar apertura';
      cierreEstado.textContent = 'Error al cargar caja';
      sinCaja.style.display = 'grid';
    }
  }

  function renderCashSnapshot(fecha, resumen, loadedMovements) {
      // Show newly recorded operations first, including when imported/demo
      // movements have a later clock time than the current real transaction.
      const movimientos = orderCashMovementsByRegistration(loadedMovements);

      const totalPorForma = Object.fromEntries(
        (resumen?.totalPorFormaPago || []).map(item => [item.formaPago, item.total])
      );
      const totalPorTipo = Object.fromEntries(
        (resumen?.totalPorTipoIngreso || []).map(item => [item.tipoIngreso, item.total])
      );
      const totalEgresos = Math.abs(Number(totalPorTipo.egreso || 0));

      totalIngresosCaja.textContent = formatearMoneda(resumen?.totalIngresos || 0);
      totalEfectivoCaja.textContent = formatearMoneda(resumen?.efectivoEsperado || 0);
      totalTransferenciaCaja.textContent = formatearMoneda(totalPorForma.transferencia || 0);
      totalEgresosCaja.textContent = formatearMoneda(totalEgresos);
      actualizarEstadoAperturaYCierre(resumen);

      const movementRows = document.createDocumentFragment();
      currentMovements = new Map((movimientos || []).map(row => [Number(row.id), row]));
      const correctedMovementIds = new Set(
        (movimientos || [])
          .filter(row => row.tipo_ingreso === 'anulacion' && row.correccion_de_id)
          .map(row => Number(row.correccion_de_id))
      );
      const sessions = [...(resumen?.sesiones || [])].sort((a, b) => String(b.ts_apertura || '').localeCompare(String(a.ts_apertura || '')));
      sinCaja.style.display = movimientos?.length || sessions.length ? 'none' : 'block';
      document.getElementById('ledger-movement-count').textContent = `${movimientos?.length || 0} movimientos · ${sessions.length} cajas del día`;

      const groups = sessions.map((session, index) => ({ session, number: sessions.length - index,
        rows: movimientos.filter(row => String(row.caja_sesion_id) === String(session.id)) }));
      const ungrouped = movimientos.filter(row => !sessions.some(session => String(row.caja_sesion_id) === String(session.id)));
      if (ungrouped.length) groups.push({ rows: ungrouped });
      groups.forEach(({ session, number, rows }) => {
        if (session) {
          const separator = document.createElement('tr');
          separator.className = 'ledger-session-separator';
          const cell = document.createElement('th');
          cell.colSpan = 5;
          cell.textContent = `Caja ${number} · Apertura ${session.hora_apertura || '—'} · ${session.estado === 'cerrada' ? `Cierre ${session.hora_cierre || '—'}` : 'Abierta'}${rows.length ? '' : ' · Sin movimientos'}`;
          separator.appendChild(cell);
          movementRows.appendChild(separator);
        }
      rows.forEach(row => {
        const isSale = row.tipo_ingreso === 'venta_producto';
        const detalle = isSale ? row.producto_nombre || row.descripcion || 'Venta de producto' : row.usuario_nombre || row.descripcion || 'Movimiento de caja';
        const esSalida = Number(row.monto || 0) < 0 || row.tipo_ingreso === 'egreso';
        const esManual = ['ingreso_manual', 'egreso'].includes(row.tipo_ingreso);
        const canCorrect = esManual && Boolean(resumen?.sesionAbierta) && String(row.caja_sesion_id) === String(resumen.sesionAbierta.id) && !correctedMovementIds.has(Number(row.id));
        const metadata = [formatearTipoMovimiento(row.tipo_ingreso)];
        if (isSale && row.cantidad) metadata.push(`${row.cantidad} ${Number(row.cantidad) === 1 ? 'unidad' : 'unidades'}`);
        if (isSale && row.usuario_nombre) metadata.push(row.usuario_nombre);
        if (esManual && row.responsable) metadata.push(`Responsable: ${row.responsable}`);
        const tr = document.createElement('tr');
        tr.className = esSalida ? 'ledger-row ledger-row-output' : 'ledger-row';
        tr.innerHTML = `
          <td>${cashEscape(row.hora || '-')}</td>
          <td><div class="ledger-identity"><strong>${cashEscape(detalle)}</strong><span>${cashEscape(metadata.join(' · '))}</span></div></td>
          <td>${cashEscape(capitalizarFormaPago(row.forma_pago))}</td>
          <td class="ledger-amount">${cashEscape(formatearMoneda(row.monto))}</td>
          <td>${canCorrect ? `<button class="ledger-correct" type="button" data-corregir-movimiento="${Number(row.id)}">Corregir</button>` : ''}</td>
        `;
        movementRows.appendChild(tr);
      });
      });
      tablaDashboardCaja.replaceChildren(movementRows);

      if (fecha === hoyYYYYMMDD() && homeActivityBody && homeActivityEmpty) {
        homeActivityBody.innerHTML = '';
        const recent = (movimientos || []).slice(0, 7);
        homeActivityEmpty.style.display = recent.length ? 'none' : 'block';
        recent.forEach(row => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${row.hora || '-'}</td>
            <td>${formatearTipoMovimiento(row.tipo_ingreso)}</td>
            <td>${row.usuario_nombre || row.producto_nombre || row.descripcion || '-'}</td>
            <td>${capitalizarFormaPago(row.forma_pago)}</td>
            <td>${formatearMoneda(row.monto)}</td>
          `;
          homeActivityBody.appendChild(tr);
        });
      }
  }

  async function guardarApertura() {
    const fecha = fechaDashboard?.value || hoyYYYYMMDD();
    const cajeroApertura = aperturaCajeroInput?.value.trim() || '';
    const montoInicialEfectivo = Number(aperturaMontoInput.value || 0);
    const observacion = aperturaObservacionInput.value.trim();

    if (fecha !== hoyYYYYMMDD()) {
      shared.mostrarNotificacion('Solo se puede abrir caja en el dia actual', 'warning');
      return;
    }

    if (!cajeroApertura) {
      shared.mostrarNotificacion('Ingresa el nombre del cajero', 'warning');
      return;
    }

    if (Number.isNaN(montoInicialEfectivo) || montoInicialEfectivo < 0) {
      shared.mostrarNotificacion('Ingresa un monto inicial valido', 'warning');
      return;
    }

    try {
      await window.api.abrirCajaDia({ fecha, montoInicialEfectivo, cajeroApertura, observacion });
      shared.mostrarNotificacion('Apertura guardada', 'success');
      await cargarCajaDelDia(fecha);
      await actualizarWidgetDineroHoy();
    } catch (error) {
      console.error('Error guardando apertura:', error);
      shared.mostrarNotificacion(error?.message || 'No se pudo guardar la apertura', 'error');
    }
  }

  function abrirModalAjusteTotal() {
    const totalActualTexto = totalIngresosCaja?.textContent || '';
    const totalActual = Number(totalActualTexto.replace(/[^\d-]/g, '')) || 0;
    adjustmentTotalInput.value = String(totalActual);
    adjustmentReasonInput.value = '';
    adjustmentModal.style.display = 'flex';
  }

  async function guardarAjusteTotal() {
    const fecha = fechaDashboard?.value || hoyYYYYMMDD();
    const nuevoTotal = Number(adjustmentTotalInput.value || 0);
    const observacion = adjustmentReasonInput.value.trim();

    if (Number.isNaN(nuevoTotal) || nuevoTotal < 0) {
      shared.mostrarNotificacion('Ingresa un total valido', 'warning');
      return;
    }

    try {
      const resultado = await window.api.ajustarTotalCajaDia(fecha, nuevoTotal, observacion);
      adjustmentModal.style.display = 'none';
      if (resultado?.applied) {
        shared.mostrarNotificacion('Total ajustado y registrado', 'success');
      } else {
        shared.mostrarNotificacion('El total ya coincide', 'warning');
      }
      await cargarCajaDelDia(fecha);
      await actualizarWidgetDineroHoy();
    } catch (error) {
      console.error('Error ajustando total:', error);
      shared.mostrarNotificacion(error?.message || 'No se pudo ajustar el total', 'error');
    }
  }

  function abrirModalSalidaCaja() {
    outputAmountInput.value = '';
    if (outputResponsibleInput) outputResponsibleInput.value = '';
    outputReasonInput.value = '';
    document.querySelectorAll('input[name="salida-caja-forma-pago"]').forEach(input => {
      input.checked = input.value === 'efectivo';
    });
    outputModal.style.display = 'flex';
    outputAmountInput.focus();
  }

  async function guardarSalidaCaja() {
    if (outputSaveButton.disabled) return;
    const fecha = fechaDashboard?.value || hoyYYYYMMDD();
    const monto = Number(outputAmountInput.value || 0);
    const observacion = outputReasonInput.value.trim();
    const responsable = outputResponsibleInput?.value.trim() || '';
    const formaPago = getCheckedValue('salida-caja-forma-pago', 'efectivo');

    if (Number.isNaN(monto) || monto <= 0) {
      shared.mostrarNotificacion('Ingresa un monto valido', 'warning');
      return;
    }
    if (!responsable) {
      shared.mostrarNotificacion('Ingresa el responsable de la salida', 'warning');
      return;
    }

    try {
      outputSaveButton.disabled = true;
      outputSaveButton.textContent = 'Registrando…';
      await window.api.registrarSalidaCaja(fecha, monto, formaPago, observacion, responsable);
      outputModal.style.display = 'none';
      shared.mostrarNotificacion('Egreso registrado', 'success');
      await cargarCajaDelDia(fecha);
      await actualizarWidgetDineroHoy();
    } catch (error) {
      console.error('Error registrando egreso:', error);
      shared.mostrarNotificacion(error?.message || 'No se pudo registrar el egreso', 'error');
    } finally {
      outputSaveButton.disabled = false;
      outputSaveButton.textContent = 'Registrar salida';
    }
  }

  function abrirCorreccionMovimiento(id) {
    const row = currentMovements.get(Number(id));
    if (!row || !['ingreso_manual', 'egreso'].includes(row.tipo_ingreso)) return;
    correctionIdInput.value = String(row.id);
    correctionAmountInput.value = String(Math.abs(Number(row.monto || 0)));
    correctionObservationInput.value = row.descripcion || row.observacion || '';
    correctionReasonInput.value = '';
    if (correctionOriginal) {
      correctionOriginal.innerHTML = `<span>${formatearTipoMovimiento(row.tipo_ingreso)}</span><small>#${row.id}</small><strong>${formatearMoneda(row.monto)}</strong>`;
    }
    document.querySelectorAll('input[name="corregir-movimiento-forma-pago"]').forEach(input => {
      input.checked = input.value === row.forma_pago;
    });
    correctionModal.style.display = 'flex';
  }

  async function guardarCorreccionMovimiento() {
    const payload = {
      id: Number(correctionIdInput.value),
      monto: Number(correctionAmountInput.value),
      formaPago: getCheckedValue('corregir-movimiento-forma-pago', 'efectivo'),
      observacion: correctionObservationInput.value.trim(),
      motivo: correctionReasonInput.value.trim(),
    };
    if (!payload.motivo) {
      shared.mostrarNotificacion('Ingresa el motivo de la correccion', 'warning');
      return;
    }
    try {
      await window.api.corregirMovimientoCaja(payload);
      correctionModal.style.display = 'none';
      shared.mostrarNotificacion('Movimiento corregido con trazabilidad', 'success');
      await cargarCajaDelDia(fechaDashboard?.value || hoyYYYYMMDD());
      await actualizarWidgetDineroHoy();
    } catch (error) {
      shared.mostrarNotificacion(error?.message || 'No se pudo corregir el movimiento', 'error');
    }
  }

  function abrirModalIngresoManual() {
    manualIncomeAmountInput.value = '';
    if (manualIncomeResponsibleInput) manualIncomeResponsibleInput.value = '';
    manualIncomeObservationInput.value = '';
    document.querySelectorAll('input[name="ingreso-manual-forma-pago"]').forEach(input => {
      input.checked = input.value === 'efectivo';
    });
    manualIncomeModal.style.display = 'flex';
    manualIncomeAmountInput.focus();
  }

  async function guardarIngresoManual() {
    if (manualIncomeSaveButton.disabled) return;
    const fecha = fechaDashboard?.value || hoyYYYYMMDD();
    const monto = Number(manualIncomeAmountInput.value || 0);
    const formaPago = getCheckedValue('ingreso-manual-forma-pago', 'efectivo');
    const observacion = manualIncomeObservationInput.value.trim();
    const responsable = manualIncomeResponsibleInput?.value.trim() || '';

    if (Number.isNaN(monto) || monto <= 0) {
      shared.mostrarNotificacion('Ingresa un monto valido', 'warning');
      return;
    }
    if (!responsable) {
      shared.mostrarNotificacion('Ingresa el responsable de la entrada', 'warning');
      return;
    }

    try {
      manualIncomeSaveButton.disabled = true;
      manualIncomeSaveButton.textContent = 'Registrando…';
      await window.api.registrarIngresoManualCaja({ fecha, monto, formaPago, observacion, responsable });
      manualIncomeModal.style.display = 'none';
      shared.mostrarNotificacion('Ingreso manual registrado', 'success');
      await cargarCajaDelDia(fecha);
      await actualizarWidgetDineroHoy();
    } catch (error) {
      console.error('Error registrando ingreso manual:', error);
      shared.mostrarNotificacion(error?.message || 'No se pudo registrar el ingreso', 'error');
    } finally {
      manualIncomeSaveButton.disabled = false;
      manualIncomeSaveButton.textContent = 'Registrar entrada';
    }
  }

  function abrirModalCierreCaja() {
    const efectivoEsperado = Number(currentSummary?.efectivoEsperado || 0);
    const pendingCount = Number(currentSummary?.pendientes?.cantidad || 0);
    const pendingTotal = Number(currentSummary?.pendientes?.total || 0);
    if (closePendingSummary) {
      closePendingSummary.hidden = pendingCount === 0;
      closePendingSummary.textContent = `${pendingCount} ${pendingCount === 1 ? 'venta pendiente' : 'ventas pendientes'} · ${formatearMoneda(pendingTotal)} sin cobrar. No impide cerrar la caja.`;
    }
    document.getElementById('closure-date').textContent = `Cierre del ${String(fechaDashboard.value).split('-').reverse().join('/')}`;
    document.getElementById('closure-error').hidden = true;
    closeExpectedCashInput.value = formatearMoneda(efectivoEsperado);
    closeCountedCashInput.value = String(efectivoEsperado);
    closeCashierInput.value = currentSummary?.sesionAbierta?.cajero_apertura || '';
    closeDifferenceInput.value = formatearMoneda(0);
    document.querySelector('label[for="cierre-diferencia"]').textContent = 'Diferencia';
    closeObservationInput.value = '';
    closeModal.style.display = 'flex';
    closeCountedCashInput.focus();
    closeCountedCashInput.select();
  }

  function actualizarDiferenciaCierre() {
    const esperado = Number(currentSummary?.efectivoEsperado || 0);
    const contado = Number(closeCountedCashInput.value || 0);

    if (!Number.isFinite(contado)) {
      closeDifferenceInput.value = formatearMoneda(0);
      return;
    }

    const diferencia = Number((contado - esperado).toFixed(2));
    closeDifferenceInput.value = formatearMoneda(diferencia);
    document.querySelector('label[for="cierre-diferencia"]').textContent = diferencia < 0 ? 'Diferencia · faltante' : diferencia > 0 ? 'Diferencia · sobrante' : 'Diferencia';
  }

  async function guardarCierreCaja() {
    if (closeSaveButton.disabled || !document.getElementById('closure-form').reportValidity()) return;
    const fecha = fechaDashboard?.value || hoyYYYYMMDD();
    const efectivoContado = Number(closeCountedCashInput.value || 0);
    const cajeroCierre = closeCashierInput?.value.trim() || '';
    const observacion = closeObservationInput.value.trim();

    if (!Number.isFinite(efectivoContado) || efectivoContado < 0) {
      shared.mostrarNotificacion('Ingresa un efectivo contado valido', 'warning');
      return;
    }

    if (!cajeroCierre) {
      shared.mostrarNotificacion('Ingresa el nombre de quien cierra', 'warning');
      return;
    }

    try {
      closeSaveButton.disabled = true;
      closeSaveButton.textContent = 'Cerrando…';
      document.getElementById('closure-error').hidden = true;
      const resultado = await window.api.cerrarCajaDia(fecha, efectivoContado, observacion, cajeroCierre);
      closeModal.style.display = 'none';
      if (resultado?.exportacion?.created) {
        shared.mostrarNotificacion('Caja cerrada y PDF generado', 'success');
      } else if (resultado?.exportacion?.created === false) {
        shared.mostrarNotificacion('Caja cerrada. No se pudo generar el PDF del cierre', 'warning');
      } else {
        shared.mostrarNotificacion('Caja cerrada', 'success');
      }
      await cargarCajaDelDia(fecha);
      await actualizarWidgetDineroHoy();
    } catch (error) {
      console.error('Error cerrando caja:', error);
      const message = String(error?.message || 'No se pudo cerrar la caja. Volvé a intentar.').replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '');
      document.getElementById('closure-error').textContent = message;
      document.getElementById('closure-error').hidden = false;
    } finally {
      closeSaveButton.disabled = false;
      closeSaveButton.textContent = 'Cerrar caja';
    }
  }

  async function abrirCarpetaDeCierres() {
    try {
      const fecha = fechaDashboard?.value || hoyYYYYMMDD();
      await window.api.abrirCarpetaCierres(fecha);
    } catch (error) {
      shared.mostrarNotificacion(error?.message || 'No se pudo abrir la carpeta de cierres', 'error');
    }
  }

  function initDashboardTabs() {
    const buttons = Array.from(document.querySelectorAll('[data-dashboard-tab]'));
    const panels = Array.from(document.querySelectorAll('[data-dashboard-panel]'));

    function showTab(tabId) {
      buttons.forEach(button => {
        button.classList.toggle('is-active', button.getAttribute('data-dashboard-tab') === tabId);
      });

      panels.forEach(panel => {
        panel.style.display = panel.getAttribute('data-dashboard-panel') === tabId ? 'grid' : 'none';
      });

    }
    showDashboardTab = showTab;

    buttons.forEach(button => {
      button.addEventListener('click', () => showTab(button.getAttribute('data-dashboard-tab')));
    });

    showTab('caja');
  }

  async function refreshDashboard(fecha) {
    renderCashWeek(fecha);
    await Promise.all([
      cargarCajaDelDia(fecha),
      cargarIngresosDelDia(fecha),
    ]);
  }

  function cashDateValue(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function renderCashWeek(selected) {
    const strip = document.getElementById('ledger-week');
    if (!strip || !selected) return;
    const date = new Date(`${selected}T12:00:00`);
    if (Number.isNaN(date.valueOf())) return;
    date.setDate(date.getDate() - (date.getDay() + 6) % 7);
    const today = hoyYYYYMMDD();
    const focusedDate = strip.contains(document.activeElement) ? document.activeElement.dataset.cashDate : null;
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < 7; index++) {
      const value = cashDateValue(date);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `ledger-day${value === today ? ' is-today' : ''}`;
      button.dataset.cashDate = value;
      button.setAttribute('aria-pressed', String(value === selected));
      button.setAttribute('aria-label', date.toLocaleDateString('es-UY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
      if (value === today) button.setAttribute('aria-current', 'date');
      const weekday = document.createElement('span');
      weekday.textContent = value === today ? 'Hoy' : ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'][index];
      const number = document.createElement('strong');
      number.textContent = String(date.getDate());
      button.append(weekday, number);
      fragment.appendChild(button);
      date.setDate(date.getDate() + 1);
    }
    strip.replaceChildren(fragment);
    if (focusedDate) strip.querySelector(`[data-cash-date="${focusedDate}"]`)?.focus();
    document.getElementById('ledger-today').disabled = selected === today;
  }

  function selectCashDay(value) {
    fechaDashboard.value = value;
    fechaDashboard.dispatchEvent(new Event('change'));
  }

  function init() {
    if (!fechaDashboard) return;
    document.getElementById('ledger-week')?.addEventListener('click', event => {
      const button = event.target.closest('[data-cash-date]');
      if (button) selectCashDay(button.dataset.cashDate);
    });
    document.getElementById('ledger-today')?.addEventListener('click', () => selectCashDay(hoyYYYYMMDD()));
    for (const [id, offset] of [['ledger-previous-day', -1], ['ledger-next-day', 1]]) {
      document.getElementById(id)?.addEventListener('click', () => {
        const date = new Date(`${fechaDashboard.value || hoyYYYYMMDD()}T12:00:00`);
        date.setDate(date.getDate() + offset);
        selectCashDay(cashDateValue(date));
      });
    }
    window.adminSync?.watch({
      enabled: () => Boolean(window.api && window.adminSync.active('home')),
      read: async () => {
        const today = hoyYYYYMMDD();
        return Promise.all([window.api.obtenerIngresos(today, today), window.api.obtenerResumenCajaDia(today)]);
      },
      apply: ([entries, summary]) => {
        if (widgetIngresosHoy) widgetIngresosHoy.textContent = String(entries.length);
        if (widgetDineroHoy) widgetDineroHoy.textContent = formatearMoneda(summary?.totalIngresos || 0);
      },
    });
    window.adminSync?.watch({
      enabled: () => Boolean(window.api && window.adminSync.active('operations') &&
        !window.adminSync.visible(aperturaCajeroInput)),
      read: async () => {
        const date = fechaDashboard.value || hoyYYYYMMDD();
        const [summary, movements] = await Promise.all([window.api.obtenerResumenCajaDia(date), window.api.obtenerMovimientosCaja(date)]);
        return { date, summary, movements };
      },
      apply: ({ date, summary, movements }) => {
        if (date !== (fechaDashboard.value || hoyYYYYMMDD())) return;
        renderCashSnapshot(date, summary, movements);
      },
    });

    fechaDashboard.value = hoyYYYYMMDD();
    initDashboardTabs();
    actualizarWidgetIngresosHoy();
    actualizarWidgetDineroHoy();

    totalIngresosCaja?.addEventListener('click', abrirModalAjusteTotal);
    aperturaGuardarButton?.addEventListener('click', guardarApertura);
    abrirCajaButton?.addEventListener('click', () => mostrarFormularioApertura(true));
    verCierreButton?.addEventListener('click', abrirCarpetaDeCierres);
    aperturaEditarButton?.addEventListener('click', () => mostrarFormularioApertura(true));
    adjustmentSaveButton?.addEventListener('click', guardarAjusteTotal);
    salidaButton?.addEventListener('click', abrirModalSalidaCaja);
    document.getElementById('form-salida-caja')?.addEventListener('submit', event => {
      event.preventDefault();
      guardarSalidaCaja();
    });
    correctionSaveButton?.addEventListener('click', guardarCorreccionMovimiento);
    tablaDashboardCaja?.addEventListener('click', event => {
      const button = event.target.closest('[data-corregir-movimiento]');
      if (button) abrirCorreccionMovimiento(button.dataset.corregirMovimiento);
    });
    ingresoManualButton?.addEventListener('click', abrirModalIngresoManual);
    document.getElementById('form-ingreso-manual-caja')?.addEventListener('submit', event => {
      event.preventDefault();
      guardarIngresoManual();
    });
    cerrarCajaButton?.addEventListener('click', abrirModalCierreCaja);
    closeCountedCashInput?.addEventListener('input', actualizarDiferenciaCierre);
    document.getElementById('closure-form')?.addEventListener('submit', event => { event.preventDefault(); guardarCierreCaja(); });
    closeModal?.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !closeSaveButton.disabled) {
        event.preventDefault(); closeModal.style.display = 'none'; cerrarCajaButton.focus();
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(closeModal.querySelectorAll('button:not(:disabled), input:not([readonly]):not(:disabled)')).filter(el => el.getClientRects().length);
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    closeModal?.addEventListener('click', event => {
      if (!event.target.closest('[data-close-modal]')) return;
      if (closeSaveButton.disabled) { event.preventDefault(); event.stopImmediatePropagation(); }
      else cerrarCajaButton.focus();
    }, true);
    annulEntrySaveButton?.addEventListener('click', guardarAnulacionIngreso);
    tablaDashboardIngresos?.addEventListener('click', event => {
      const button = event.target.closest('[data-anular-ingreso]');
      if (button) abrirAnulacionIngreso(button.dataset.anularIngreso);
    });

    fechaDashboard.addEventListener('change', async () => {
      if (!fechaDashboard.value) return;
      await refreshDashboard(fechaDashboard.value);
    });

    document.addEventListener('admin-dashboard:show', async event => {
      const fecha = fechaDashboard.value || hoyYYYYMMDD();
      fechaDashboard.value = fecha;
      const selectedTab = event.detail?.tab || 'caja';
      showDashboardTab(selectedTab);
      if (dashboardPageTitle) dashboardPageTitle.textContent = selectedTab === 'caja' ? 'Caja' : 'Registros';
      if (dashboardPageKicker) dashboardPageKicker.textContent = selectedTab === 'caja' ? 'Control de jornada' : 'Control de accesos';
      if (dashboardPageHeading) dashboardPageHeading.textContent = selectedTab === 'caja' ? 'Caja del local principal' : 'Ingresos al gimnasio';
      if (dashboardPageCopy) {
        dashboardPageCopy.textContent = selectedTab === 'caja'
          ? 'Abrí la jornada, controlá los movimientos y cerrá con el detalle completo.'
          : 'Consultá quién ingresó, a qué hora y anulá registros incorrectos con trazabilidad.';
      }
      await refreshDashboard(fecha);
      await actualizarWidgetIngresosHoy();
      await actualizarWidgetDineroHoy();
    });

    document.addEventListener('cash:updated', async () => {
      const fecha = fechaDashboard?.value || hoyYYYYMMDD();
      await refreshDashboard(fecha);
      await actualizarWidgetDineroHoy();
    });
  }

  return {
    init,
  };
}

window.createAdminEntriesController = createAdminEntriesController;
