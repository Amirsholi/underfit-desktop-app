function createAdminEntriesController({ shared }) {
  const fechaDashboard = document.getElementById('dashboard-fecha');
  const estadoDashboard = document.getElementById('dashboard-estado-ingresos');
  const tablaDashboardIngresos = document.getElementById('tabla-dashboard-ingresos');
  const sinIngresos = document.getElementById('dashboard-sin-ingresos');
  const widgetIngresosHoy = document.getElementById('widget-ingresos-hoy');
  const widgetDineroHoy = document.getElementById('widget-ventas-hoy');

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

  const ingresoManualButton = document.getElementById('dashboard-registrar-ingreso-manual');
  const salidaButton = document.getElementById('dashboard-registrar-salida');
  const cerrarCajaButton = document.getElementById('dashboard-cerrar-caja');

  const adjustmentModal = document.getElementById('modal-ajuste-total');
  const adjustmentTotalInput = document.getElementById('ajuste-total-nuevo');
  const adjustmentReasonInput = document.getElementById('ajuste-total-observacion');
  const adjustmentSaveButton = document.getElementById('guardar-ajuste-total');

  const outputModal = document.getElementById('modal-salida-caja');
  const outputAmountInput = document.getElementById('salida-caja-monto');
  const outputReasonInput = document.getElementById('salida-caja-observacion');
  const outputSaveButton = document.getElementById('guardar-salida-caja');

  const correctionModal = document.getElementById('modal-corregir-movimiento');
  const correctionIdInput = document.getElementById('corregir-movimiento-id');
  const correctionAmountInput = document.getElementById('corregir-movimiento-monto');
  const correctionObservationInput = document.getElementById('corregir-movimiento-observacion');
  const correctionReasonInput = document.getElementById('corregir-movimiento-motivo');
  const correctionSaveButton = document.getElementById('guardar-correccion-movimiento');

  const manualIncomeModal = document.getElementById('modal-ingreso-manual-caja');
  const manualIncomeAmountInput = document.getElementById('ingreso-manual-monto');
  const manualIncomeObservationInput = document.getElementById('ingreso-manual-observacion');
  const manualIncomeSaveButton = document.getElementById('guardar-ingreso-manual-caja');

  const closeModal = document.getElementById('modal-cierre-caja');
  const closeExpectedCashInput = document.getElementById('cierre-efectivo-esperado');
  const closeCountedCashInput = document.getElementById('cierre-efectivo-contado');
  const closeCashierInput = document.getElementById('cierre-cajero');
  const closeDifferenceInput = document.getElementById('cierre-diferencia');
  const closeObservationInput = document.getElementById('cierre-observacion');
  const closeSaveButton = document.getElementById('guardar-cierre-caja');

  let currentSummary = null;
  let currentMovements = new Map();

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
      renovacion: 'Renovacion',
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
    aperturaCard.style.display = mostrar ? 'block' : 'none';
  }

  async function cargarIngresosDelDia(fecha) {
    if (!tablaDashboardIngresos || !sinIngresos) return;

    try {
      estadoDashboard.textContent = 'Cargando...';
      tablaDashboardIngresos.innerHTML = '';
      sinIngresos.style.display = 'none';

      const filas = await window.api.obtenerIngresos(fecha, fecha);
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
        `;
        tablaDashboardIngresos.appendChild(tr);
      });
    } catch (error) {
      console.error('Error cargando ingresos:', error);
      estadoDashboard.textContent = 'Error al cargar ingresos';
    }
  }

  async function actualizarWidgetIngresosHoy() {
    if (!widgetIngresosHoy) return;

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
      mostrarFormularioApertura(esHoy);
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
      mostrarFormularioApertura(esHoy);
      aperturaResumen.style.display = 'none';
      aperturaEstado.textContent = esHoy ? 'Sin apertura registrada.' : 'Fecha historica sin apertura.';
      aperturaCajeroInput.value = '';
      aperturaMontoInput.value = esHoy && resumen?.ultimoCierreGlobal?.efectivo_contado !== undefined
        ? String(resumen.ultimoCierreGlobal.efectivo_contado || 0)
        : '';
      aperturaObservacionInput.value = '';
      aperturaGuardarButton.textContent = esHoy ? 'Guardar' : 'Fecha historica';
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
      cerrarCajaButton.style.display = 'inline-flex';
      cerrarCajaButton.disabled = true;
    } else {
      estadoCajaPill.classList.remove('cash-state-open');
      estadoCajaPill.classList.add('cash-state-closed');
      estadoCajaTexto.textContent = 'Caja cerrada';
      cierreEstado.textContent = esHoy ? 'Pendiente de apertura.' : 'Fecha historica.';
      cierreResumenCard.style.display = 'none';
      setCajaActionsEnabled(esHoy);
      ingresoManualButton.disabled = true;
      salidaButton.disabled = true;
      cerrarCajaButton.style.display = 'inline-flex';
      cerrarCajaButton.disabled = true;
    }
  }

  async function cargarCajaDelDia(fecha) {
    try {
      const [resumen, movimientos] = await Promise.all([
        window.api.obtenerResumenCajaDia(fecha),
        window.api.obtenerMovimientosCaja(fecha),
      ]);

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

      tablaDashboardCaja.innerHTML = '';
      currentMovements = new Map((movimientos || []).map(row => [Number(row.id), row]));
      const correctedMovementIds = new Set(
        (movimientos || [])
          .filter(row => row.tipo_ingreso === 'anulacion' && row.correccion_de_id)
          .map(row => Number(row.correccion_de_id))
      );
      sinCaja.style.display = movimientos?.length ? 'none' : 'block';

      (movimientos || []).forEach(row => {
        const detalle = row.usuario_nombre || row.producto_nombre || row.descripcion || '-';
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${row.hora || '-'}</td>
          <td>${formatearTipoMovimiento(row.tipo_ingreso)}</td>
          <td>${detalle}</td>
          <td>${capitalizarFormaPago(row.forma_pago)}</td>
          <td>${formatearMoneda(row.monto)}</td>
          <td>${['ingreso_manual', 'egreso'].includes(row.tipo_ingreso) && resumen?.sesionAbierta && !correctedMovementIds.has(Number(row.id)) ? `<button class="table-action-button" type="button" data-corregir-movimiento="${row.id}">Corregir</button>` : ''}</td>
        `;
        tablaDashboardCaja.appendChild(tr);
      });
    } catch (error) {
      console.error('Error cargando caja del dia:', error);
      totalIngresosCaja.textContent = formatearMoneda(0);
      totalEfectivoCaja.textContent = formatearMoneda(0);
      totalTransferenciaCaja.textContent = formatearMoneda(0);
      totalEgresosCaja.textContent = formatearMoneda(0);
      aperturaEstado.textContent = 'Error al cargar apertura';
      cierreEstado.textContent = 'Error al cargar caja';
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
    outputReasonInput.value = '';
    document.querySelectorAll('input[name="salida-caja-forma-pago"]').forEach(input => {
      input.checked = input.value === 'efectivo';
    });
    outputModal.style.display = 'flex';
  }

  async function guardarSalidaCaja() {
    const fecha = fechaDashboard?.value || hoyYYYYMMDD();
    const monto = Number(outputAmountInput.value || 0);
    const observacion = outputReasonInput.value.trim();
    const formaPago = getCheckedValue('salida-caja-forma-pago', 'efectivo');

    if (Number.isNaN(monto) || monto <= 0) {
      shared.mostrarNotificacion('Ingresa un monto valido', 'warning');
      return;
    }

    try {
      await window.api.registrarSalidaCaja(fecha, monto, formaPago, observacion);
      outputModal.style.display = 'none';
      shared.mostrarNotificacion('Egreso registrado', 'success');
      await cargarCajaDelDia(fecha);
      await actualizarWidgetDineroHoy();
    } catch (error) {
      console.error('Error registrando egreso:', error);
      shared.mostrarNotificacion(error?.message || 'No se pudo registrar el egreso', 'error');
    }
  }

  function abrirCorreccionMovimiento(id) {
    const row = currentMovements.get(Number(id));
    if (!row || !['ingreso_manual', 'egreso'].includes(row.tipo_ingreso)) return;
    correctionIdInput.value = String(row.id);
    correctionAmountInput.value = String(Math.abs(Number(row.monto || 0)));
    correctionObservationInput.value = row.descripcion || row.observacion || '';
    correctionReasonInput.value = '';
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
    manualIncomeObservationInput.value = '';
    document.querySelectorAll('input[name="ingreso-manual-forma-pago"]').forEach(input => {
      input.checked = input.value === 'efectivo';
    });
    manualIncomeModal.style.display = 'flex';
  }

  async function guardarIngresoManual() {
    const fecha = fechaDashboard?.value || hoyYYYYMMDD();
    const monto = Number(manualIncomeAmountInput.value || 0);
    const formaPago = getCheckedValue('ingreso-manual-forma-pago', 'efectivo');
    const observacion = manualIncomeObservationInput.value.trim();

    if (Number.isNaN(monto) || monto <= 0) {
      shared.mostrarNotificacion('Ingresa un monto valido', 'warning');
      return;
    }

    try {
      await window.api.registrarIngresoManualCaja({ fecha, monto, formaPago, observacion });
      manualIncomeModal.style.display = 'none';
      shared.mostrarNotificacion('Ingreso manual registrado', 'success');
      await cargarCajaDelDia(fecha);
      await actualizarWidgetDineroHoy();
    } catch (error) {
      console.error('Error registrando ingreso manual:', error);
      shared.mostrarNotificacion(error?.message || 'No se pudo registrar el ingreso', 'error');
    }
  }

  function abrirModalCierreCaja() {
    const efectivoEsperado = Number(currentSummary?.efectivoEsperado || 0);
    closeExpectedCashInput.value = formatearMoneda(efectivoEsperado);
    closeCountedCashInput.value = String(efectivoEsperado);
    closeCashierInput.value = currentSummary?.sesionAbierta?.cajero_apertura || '';
    closeDifferenceInput.value = formatearDiferenciaCaja(0);
    closeObservationInput.value = '';
    closeModal.style.display = 'flex';
  }

  function actualizarDiferenciaCierre() {
    const esperado = Number(currentSummary?.efectivoEsperado || 0);
    const contado = Number(closeCountedCashInput.value || 0);

    if (!Number.isFinite(contado)) {
      closeDifferenceInput.value = formatearMoneda(0);
      return;
    }

    const diferencia = Number((contado - esperado).toFixed(2));
    closeDifferenceInput.value = formatearDiferenciaCaja(diferencia);
  }

  async function guardarCierreCaja() {
    const fecha = fechaDashboard?.value || hoyYYYYMMDD();
    const efectivoContado = Number(closeCountedCashInput.value || 0);
    const cajeroCierre = closeCashierInput?.value.trim() || '';
    const observacion = closeObservationInput.value.trim();

    if (Number.isNaN(efectivoContado) || efectivoContado < 0) {
      shared.mostrarNotificacion('Ingresa un efectivo contado valido', 'warning');
      return;
    }

    if (!cajeroCierre) {
      shared.mostrarNotificacion('Ingresa el nombre de quien cierra', 'warning');
      return;
    }

    try {
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
      shared.mostrarNotificacion(error?.message || 'No se pudo cerrar la caja', 'error');
    }
  }

  function initDashboardTabs() {
    const buttons = Array.from(document.querySelectorAll('[data-dashboard-tab]'));
    const panels = Array.from(document.querySelectorAll('[data-dashboard-panel]'));
    const cajaOnlyElements = Array.from(document.querySelectorAll('[data-caja-only]'));

    function showTab(tabId) {
      buttons.forEach(button => {
        button.classList.toggle('is-active', button.getAttribute('data-dashboard-tab') === tabId);
      });

      panels.forEach(panel => {
        panel.style.display = panel.getAttribute('data-dashboard-panel') === tabId ? 'grid' : 'none';
      });

      cajaOnlyElements.forEach(element => {
        if (tabId === 'caja') {
          element.style.display = element.dataset.previousDisplay || '';
          delete element.dataset.previousDisplay;
        } else {
          element.dataset.previousDisplay = element.style.display || '';
          element.style.display = 'none';
        }
      });
    }

    buttons.forEach(button => {
      button.addEventListener('click', () => showTab(button.getAttribute('data-dashboard-tab')));
    });

    showTab('caja');
  }

  async function refreshDashboard(fecha) {
    await Promise.all([
      cargarCajaDelDia(fecha),
      cargarIngresosDelDia(fecha),
    ]);
  }

  function init() {
    if (!fechaDashboard) return;

    fechaDashboard.value = hoyYYYYMMDD();
    initDashboardTabs();
    actualizarWidgetIngresosHoy();
    actualizarWidgetDineroHoy();

    totalIngresosCaja?.addEventListener('click', abrirModalAjusteTotal);
    aperturaGuardarButton?.addEventListener('click', guardarApertura);
    aperturaEditarButton?.addEventListener('click', () => mostrarFormularioApertura(true));
    adjustmentSaveButton?.addEventListener('click', guardarAjusteTotal);
    salidaButton?.addEventListener('click', abrirModalSalidaCaja);
    outputSaveButton?.addEventListener('click', guardarSalidaCaja);
    correctionSaveButton?.addEventListener('click', guardarCorreccionMovimiento);
    tablaDashboardCaja?.addEventListener('click', event => {
      const button = event.target.closest('[data-corregir-movimiento]');
      if (button) abrirCorreccionMovimiento(button.dataset.corregirMovimiento);
    });
    ingresoManualButton?.addEventListener('click', abrirModalIngresoManual);
    manualIncomeSaveButton?.addEventListener('click', guardarIngresoManual);
    cerrarCajaButton?.addEventListener('click', abrirModalCierreCaja);
    closeCountedCashInput?.addEventListener('input', actualizarDiferenciaCierre);
    closeSaveButton?.addEventListener('click', guardarCierreCaja);

    fechaDashboard.addEventListener('change', async () => {
      if (!fechaDashboard.value) return;
      await refreshDashboard(fechaDashboard.value);
    });

    document.addEventListener('admin-dashboard:show', async () => {
      const fecha = fechaDashboard.value || hoyYYYYMMDD();
      fechaDashboard.value = fecha;
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
