function createAdminUsersController({ shared }) {
  const tablaUsuarios = document.querySelector('#tabla-usuarios tbody');
  const contadorUsuarios = document.getElementById('contador-usuarios');
  const buscador = document.getElementById('filtro-busqueda');
  const modal = document.getElementById('detalle');
  const modalAlta = document.getElementById('modal-alta-usuario');
  const abrirAltaBtn = document.getElementById('btn-open-add-user');
  const detalleCI = document.getElementById('detalle-ci');
  const detalleNombre = document.getElementById('detalle-nombre');
  const detalleTelefono = document.getElementById('detalle-telefono');
  const detalleEmail = document.getElementById('detalle-email');
  const detalleDireccion = document.getElementById('detalle-direccion');
  const detalleInicio = document.getElementById('detalle-inicio');
  const detallePago = document.getElementById('detalle-pago');
  const detalleDias = document.getElementById('detalle-dias');
  const detalleDetalle = document.getElementById('detalle-detalle');
  const detalleFechaNacimiento = document.getElementById('detalle-fecha-nacimiento');
  const detalleContactoEmergencia = document.getElementById('detalle-contacto-emergencia');
  const detalleTelefonoEmergencia = document.getElementById('detalle-telefono-emergencia');
  const detalleRelacionEmergencia = document.getElementById('detalle-relacion-emergencia');
  const detalleCondicionMedica = document.getElementById('detalle-condicion-medica');
  const detalleObjetivo = document.getElementById('detalle-objetivo');
  const detalleTipoMembresia = document.getElementById('detalle-tipo-membresia');
  const detalleHistorialPagos = document.getElementById('detalle-historial-pagos');
  const detalleFormaPagoAlta = document.querySelectorAll('input[name="detalle-forma-pago-alta"]');
  const detalleAutorizacionImagen = document.querySelectorAll('input[name="detalle-autorizacion-imagen"]');
  const guardarCambiosBtn = document.getElementById('guardar-cambios');
  const eliminarBtn = document.getElementById('eliminar');
  const cerrarBtn = document.getElementById('cerrar');
  const botonAgregar = document.getElementById('guardar');

  let todosLosUsuarios = [];
  let usuarioSeleccionado = null;

  function getCheckedValue(name, fallback = '') {
    const checked = document.querySelector(`input[name="${name}"]:checked`);
    return checked?.value || fallback;
  }

  function formatearMoneda(valor) {
    return new Intl.NumberFormat('es-UY', {
      style: 'currency',
      currency: 'UYU',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(valor || 0));
  }

  function formatearTipoMembresia(tipo) {
    const labels = {
      mensual: '1 Mes',
      trimestral: '3 Meses',
      semestral: '6 Meses',
    };
    return labels[tipo] || tipo || '-';
  }

  async function cargarHistorialPagos(ci) {
    if (!detalleHistorialPagos) return;
    detalleHistorialPagos.textContent = 'Cargando pagos...';

    try {
      const pagos = await window.api.obtenerPagosMembresiaUsuario(ci);
      if (!Array.isArray(pagos) || !pagos.length) {
        detalleHistorialPagos.textContent = 'Sin pagos registrados.';
        return;
      }

      detalleHistorialPagos.innerHTML = '';
      pagos.slice(0, 8).forEach(pago => {
        const item = document.createElement('div');
        item.className = 'payment-history-item';
        item.innerHTML = `
          <span>${pago.fecha_pago || '-'}</span>
          <strong>${formatearTipoMembresia(pago.tipo_membresia)}</strong>
          <span>${formatearMoneda(pago.monto)}</span>
          <span>${pago.forma_pago || '-'}</span>
        `;
        detalleHistorialPagos.appendChild(item);
      });
    } catch (error) {
      console.error('Error cargando historial de pagos:', error);
      detalleHistorialPagos.textContent = 'No se pudo cargar el historial.';
    }
  }

  function asignarEventosBotonesVer() {
    document.querySelectorAll('.table-action-button[data-ci]').forEach(btn => {
      btn.addEventListener('click', () => {
        const ci = btn.getAttribute('data-ci');
        const usuario = todosLosUsuarios.find(u => u.ci == ci);
        if (usuario) mostrarDetalleUsuario(usuario);
      });
    });
  }

  async function actualizarTabla() {
    if (!window.api) {
      todosLosUsuarios = [
        { ci: 49876543, nombre: 'Martina Silva', numero: '099 123 456', email: 'martina@ejemplo.com', fecha_vencimiento: '2026-08-11', tipo_membresia: 'mensual' },
        { ci: 43219876, nombre: 'Bruno Rodriguez', numero: '098 456 789', email: 'bruno@ejemplo.com', fecha_vencimiento: '2026-08-20', tipo_membresia: 'mensual' },
        { ci: 51234567, nombre: 'Lucas Pereira', numero: '097 111 222', email: 'lucas@ejemplo.com', fecha_vencimiento: '2026-08-30', tipo_membresia: 'trimestral' },
        { ci: 56781234, nombre: 'Diego Martinez', numero: '096 333 444', email: 'diego@ejemplo.com', fecha_vencimiento: '2026-10-16', tipo_membresia: 'semestral' },
        { ci: 37654321, nombre: 'Camila Fernandez', numero: '095 555 666', email: 'camila@ejemplo.com', fecha_vencimiento: '2027-02-26', tipo_membresia: 'semestral' },
      ];
      renderizarTabla(todosLosUsuarios);
      return;
    }
    try {
      const usuarios = await window.api.obtenerUsuarios();
      todosLosUsuarios = Array.isArray(usuarios) ? usuarios : [];
      renderizarTabla(todosLosUsuarios);
    } catch (e) {
      console.error('Error al cargar usuarios:', e);
      shared.mostrarNotificacion('Error al cargar usuarios', 'error');
    }
  }

  function renderizarTabla(usuarios) {
    if (!tablaUsuarios || !contadorUsuarios) return;

    const ordenados = [...usuarios].sort((a, b) => {
      const da = shared.calcularDiasRestantes(a.fecha_vencimiento);
      const db = shared.calcularDiasRestantes(b.fecha_vencimiento);
      const activaA = shared.esMembresiaActiva(a?.fecha_vencimiento) ? 0 : 1;
      const activaB = shared.esMembresiaActiva(b?.fecha_vencimiento) ? 0 : 1;
      return activaA - activaB || da - db;
    });

    const activos = ordenados.filter(u => shared.esMembresiaActiva(u?.fecha_vencimiento)).length;
    contadorUsuarios.textContent = String(activos);

    tablaUsuarios.innerHTML = '';
    const frag = document.createDocumentFragment();

    ordenados.forEach(usuario => {
      const dias = shared.calcularDiasRestantes(usuario?.fecha_vencimiento);
      const activo = shared.esMembresiaActiva(usuario?.fecha_vencimiento);

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="user-table-cell">${usuario?.ci ?? ''}</td>
        <td class="user-table-cell">${usuario?.nombre ?? ''}</td>
        <td class="user-table-cell">
          <span class="days-pill ${activo ? 'days-pill-active' : 'days-pill-expired'}">${dias}</span>
        </td>
        <td class="user-table-cell user-actions-cell">
          <button class="table-action-button" data-ci="${usuario?.ci ?? ''}">
            Editar
          </button>
        </td>
      `;
      frag.appendChild(tr);
    });

    tablaUsuarios.appendChild(frag);
    asignarEventosBotonesVer();
  }

  function mostrarDetalleUsuario(usuario) {
    usuarioSeleccionado = { ...usuario };

    detalleCI.value = usuario.ci;
    detalleNombre.value = usuario.nombre;
    detalleTelefono.value = usuario.numero || '';
    detalleEmail.value = usuario.email || '';
    detalleDireccion.value = usuario.direccion || '';
    detalleDetalle.value = usuario.detalle || '';
    detalleInicio.value = usuario.fecha_creacion || '';
    detallePago.value = usuario.ultima_actualizacion || '';
    detalleDias.value = shared.calcularDiasRestantes(usuario.fecha_vencimiento);
    detalleFechaNacimiento.value = usuario.fecha_nacimiento || '';
    detalleContactoEmergencia.value = usuario.contacto_emergencia || '';
    detalleTelefonoEmergencia.value = usuario.telefono_emergencia || '';
    detalleRelacionEmergencia.value = usuario.relacion_emergencia || '';
    detalleCondicionMedica.value = usuario.condicion_medica || '';
    detalleObjetivo.value = usuario.objetivo || '';
    detalleTipoMembresia.value = usuario.tipo_membresia || 'mensual';
    const formaPago = usuario.forma_pago_alta === 'tarjeta' ? 'transferencia' : (usuario.forma_pago_alta || 'efectivo');
    detalleFormaPagoAlta.forEach(input => {
      input.checked = input.value === formaPago;
    });

    const autorizacion = Number(usuario.autorizacion_imagen || 0) ? 'si' : 'no';
    detalleAutorizacionImagen.forEach(input => {
      input.checked = input.value === autorizacion;
    });

    modal.style.display = 'flex';
    cargarHistorialPagos(usuario.ci);
  }

  function limpiarFormularioAlta() {
    [
      'ci',
      'nombre',
      'numero',
      'email',
      'direccion',
      'fecha-nacimiento',
      'contacto-emergencia',
      'telefono-emergencia',
      'relacion-emergencia',
      'condicion-medica',
      'objetivo',
      'alta-detalle',
    ].forEach(id => {
      const input = document.getElementById(id);
      if (input) input.value = '';
    });

    document.querySelectorAll('input[name="forma-pago-alta"]').forEach(input => {
      input.checked = input.value === 'efectivo';
    });
    document.querySelectorAll('input[name="autorizacion-imagen"]').forEach(input => {
      input.checked = input.value === 'no';
    });
    const tipoMembresia = document.getElementById('tipo-membresia');
    if (tipoMembresia) tipoMembresia.value = 'mensual';
  }

  function inicializarAlta() {
    if (!botonAgregar) return;

    abrirAltaBtn?.addEventListener('click', limpiarFormularioAlta);

    botonAgregar.addEventListener('click', async () => {
      const ci = document.getElementById('ci')?.value.trim();
      const nombre = document.getElementById('nombre')?.value.trim();
      const numero = document.getElementById('numero')?.value.trim();
      const email = document.getElementById('email')?.value.trim();
      const direccion = document.getElementById('direccion')?.value.trim() || '';
      const fechaNacimiento = document.getElementById('fecha-nacimiento')?.value || '';
      const contactoEmergencia = document.getElementById('contacto-emergencia')?.value.trim() || '';
      const telefonoEmergencia = document.getElementById('telefono-emergencia')?.value.trim() || '';
      const relacionEmergencia = document.getElementById('relacion-emergencia')?.value.trim() || '';
      const condicionMedica = document.getElementById('condicion-medica')?.value.trim() || '';
      const objetivo = document.getElementById('objetivo')?.value.trim() || '';
      const tipoMembresia = document.getElementById('tipo-membresia')?.value || 'mensual';
      const formaPagoAlta = getCheckedValue('forma-pago-alta', 'efectivo');
      const autorizacionImagen = getCheckedValue('autorizacion-imagen', 'no') === 'si';
      const detalle = document.getElementById('alta-detalle')?.value.trim() || '';

      if (!ci || !nombre) {
        shared.mostrarNotificacion('Cedula y nombre obligatorios', 'warning');
        return;
      }

      try {
        await window.api.agregarUsuario({
          ci,
          nombre,
          numero,
          email,
          direccion,
          fechaNacimiento,
          contactoEmergencia,
          telefonoEmergencia,
          relacionEmergencia,
          condicionMedica,
          objetivo,
          tipoMembresia,
          preferenciaPago: formaPagoAlta,
          formaPagoAlta,
          autorizacionImagen,
          detalle,
        });

        limpiarFormularioAlta();
        shared.mostrarNotificacion('Usuario agregado con exito', 'success');
        modalAlta.style.display = 'none';
        await actualizarTabla();
        document.dispatchEvent(new CustomEvent('cash:updated'));
      } catch (e) {
        console.error(e);
        shared.mostrarNotificacion(e?.message || 'Error al agregar usuario', 'error');
      }
    });
  }

  function inicializarBusqueda() {
    if (!buscador) return;

    buscador.addEventListener('input', () => {
      const filtro = buscador.value.trim().toLowerCase();
      const filtrados = todosLosUsuarios.filter(u =>
        (u.ci ?? '').toString().toLowerCase().includes(filtro) ||
        (u.nombre ?? '').toLowerCase().includes(filtro)
      );
      renderizarTabla(filtrados);
    });
  }

  function inicializarModal() {
    guardarCambiosBtn.addEventListener('click', async () => {
      if (!usuarioSeleccionado) return;

      const fechaPago = detallePago.value;
      const diasExtras = parseInt(detalleDias.value, 10);

      if (!fechaPago || Number.isNaN(diasExtras)) {
        shared.mostrarNotificacion('Completa fecha de pago y dias', 'warning');
        return;
      }

      const nuevosDatos = {
        nombre: detalleNombre.value.trim(),
        numero: detalleTelefono.value.trim(),
        email: detalleEmail.value.trim(),
        direccion: detalleDireccion.value.trim(),
        detalle: detalleDetalle.value.trim(),
        fechaNacimiento: detalleFechaNacimiento.value || '',
        contactoEmergencia: detalleContactoEmergencia.value.trim(),
        telefonoEmergencia: detalleTelefonoEmergencia.value.trim(),
        relacionEmergencia: detalleRelacionEmergencia.value.trim(),
        condicionMedica: detalleCondicionMedica.value.trim(),
        objetivo: detalleObjetivo.value.trim(),
        tipoMembresia: detalleTipoMembresia.value || 'mensual',
        formaPagoAlta: getCheckedValue('detalle-forma-pago-alta', 'efectivo'),
        preferenciaPago: getCheckedValue('detalle-forma-pago-alta', 'efectivo'),
        autorizacionImagen: getCheckedValue('detalle-autorizacion-imagen', 'no') === 'si',
        fecha_creacion: detalleInicio.value,
        ultima_actualizacion: fechaPago,
        diasRestantes: diasExtras
      };

      try {
        const resultado = await window.api.guardarEdicionManualUsuario(usuarioSeleccionado.ci, nuevosDatos);
        if (resultado?.success) {
          modal.style.display = 'none';
          shared.mostrarNotificacion('Usuario actualizado', 'success');
          await actualizarTabla();
        }
      } catch (e) {
        console.error('Error al guardar cambios:', e);
        shared.mostrarNotificacion('Error al guardar cambios', 'error');
      }
    });

    eliminarBtn.addEventListener('click', async () => {
      if (!usuarioSeleccionado) return;

      const confirmado = await shared.confirmAction({
        message: 'Eliminar este usuario?',
        onConfirm: async () => {
          await window.api.eliminarUsuario(usuarioSeleccionado.ci);
          modal.style.display = 'none';
          shared.mostrarNotificacion('Usuario eliminado', 'success');
          await actualizarTabla();
        },
      });

      if (!confirmado) {
        shared.mostrarNotificacion('Cancelado', 'warning');
      }
    });

    cerrarBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  }

  function init() {
    inicializarAlta();
    inicializarBusqueda();
    inicializarModal();
    return actualizarTabla();
  }

  return {
    init,
    actualizarTabla,
  };
}

window.createAdminUsersController = createAdminUsersController;
