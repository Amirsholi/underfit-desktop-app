function createAdminUsersController({ shared }) {
  const shortDateFormatter = new Intl.DateTimeFormat('es-UY', { day: '2-digit', month: 'short' });
  const tablaUsuarios = document.querySelector('#tabla-usuarios tbody');
  const contadorUsuarios = document.getElementById('contador-usuarios');
  const totalUsuarios = document.getElementById('users-total-count');
  const activosUsuarios = document.getElementById('users-active-count');
  const buscador = document.getElementById('filtro-busqueda');
  const filtros = Array.from(document.querySelectorAll('[data-users-filter]'));
  const estadoVacio = document.getElementById('users-empty');
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
  const detalleAvatar = document.getElementById('detalle-avatar');
  const detalleHeaderNombre = document.getElementById('detalle-header-nombre');
  const detalleHeaderMeta = document.getElementById('detalle-header-meta');
  const detalleHeaderStatus = document.getElementById('detalle-header-status');
  const detalleVencimientoResumen = document.getElementById('detalle-vencimiento-resumen');
  const detalleDiasResumen = document.getElementById('detalle-dias-resumen');
  const detalleFormaPagoAlta = document.querySelectorAll('input[name="detalle-forma-pago-alta"]');
  const detalleAutorizacionImagen = document.querySelectorAll('input[name="detalle-autorizacion-imagen"]');
  const guardarCambiosBtn = document.getElementById('guardar-cambios');
  const eliminarBtn = document.getElementById('eliminar');
  const resetMobileButton = document.getElementById('restablecer-password-movil');
  const mobilePassword = document.getElementById('detalle-password-movil');
  const cerrarBtn = document.getElementById('cerrar');
  const botonAgregar = document.getElementById('guardar');

  let todosLosUsuarios = [];
  let usuarioSeleccionado = null;
  let ultimosAccesos = new Map();
  let filtroEstado = 'all';

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

  function formatearCedula(valor) {
    const digits = String(valor ?? '').replace(/\D/g, '');
    if (digits.length < 2) return String(valor ?? '');
    const body = Number(digits.slice(0, -1)).toLocaleString('es-UY');
    return `${body}-${digits.slice(-1)}`;
  }

  function fechaLocal(value) {
    return window.membershipRules?.parseLocalDate(value) || null;
  }

  function formatearFechaCorta(value) {
    const date = fechaLocal(value);
    if (!date) return '—';
    return shortDateFormatter
      .format(date)
      .replace('.', '')
      .toLowerCase();
  }

  function diasFirmados(value) {
    const expiration = fechaLocal(value);
    const reference = window.membershipRules?.todayLocal();
    if (!expiration || !reference) return null;
    return Math.round((expiration - reference) / 86400000);
  }

  function estadoMembresia(dias) {
    if (dias == null) return { type: 'unknown', label: 'Sin vencimiento' };
    if (dias < 0) {
      const amount = Math.abs(dias);
      return { type: 'expired', label: `Vencida hace ${amount} ${amount === 1 ? 'día' : 'días'}` };
    }
    if (dias <= 15) {
      return { type: 'expiring', label: `Vence en ${dias} ${dias === 1 ? 'día' : 'días'}` };
    }
    return { type: 'active', label: `Quedan ${dias} días` };
  }

  function construirUltimosAccesos(registros) {
    const map = new Map();
    (Array.isArray(registros) ? registros : []).forEach(registro => {
      const ci = String(registro?.ci ?? '');
      if (ci && !map.has(ci)) map.set(ci, registro);
    });
    return map;
  }

  function formatearUltimoAcceso(usuario) {
    const acceso = ultimosAccesos.get(String(usuario?.ci ?? ''));
    if (!acceso?.fecha) return 'Sin ingresos';
    const date = fechaLocal(acceso.fecha);
    const today = window.membershipRules?.todayLocal();
    if (!date || !today) return `${acceso.fecha} · ${String(acceso.hora || '').slice(0, 5)}`;
    const diff = Math.round((today - date) / 86400000);
    const day = diff === 0
      ? 'Hoy'
      : diff === 1
        ? 'Ayer'
        : shortDateFormatter.format(date).replace('.', '');
    return `${day} · ${String(acceso.hora || '').slice(0, 5) || '—'}`;
  }

  async function cargarHistorialPagos(ci) {
    if (!detalleHistorialPagos) return;
    detalleHistorialPagos.textContent = 'Cargando pagos...';

    if (!window.api?.obtenerPagosMembresiaUsuario) {
      detalleHistorialPagos.textContent = 'Sin pagos registrados.';
      return;
    }

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
    tablaUsuarios.querySelectorAll('tr[data-ci]').forEach(row => {
      // The name remains a native keyboard-operable button; the full row is its pointer target.
      row.addEventListener('click', () => {
        const ci = row.dataset.ci;
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
      ultimosAccesos = construirUltimosAccesos([
        { ci: 49876543, fecha: '2026-08-23', hora: '18:42' },
        { ci: 43219876, fecha: '2026-08-23', hora: '07:16' },
        { ci: 51234567, fecha: '2026-08-22', hora: '20:10' },
      ]);
      aplicarFiltros();
      return;
    }
    try {
      const [usuarios, ingresos] = await Promise.all([
        window.api.obtenerUsuarios(),
        window.api.obtenerUltimosIngresos ? window.api.obtenerUltimosIngresos() : Promise.resolve([]),
      ]);
      todosLosUsuarios = Array.isArray(usuarios) ? usuarios : [];
      ultimosAccesos = construirUltimosAccesos(ingresos);
      aplicarFiltros();
    } catch (e) {
      console.error('Error al cargar usuarios:', e);
      shared.mostrarNotificacion('Error al cargar usuarios', 'error');
    }
  }

  function renderizarTabla(usuarios) {
    if (!tablaUsuarios || !contadorUsuarios) return;

    const ordenados = shared.ordenarSociosPorVencimiento(usuarios);

    const activos = todosLosUsuarios.filter(u => shared.esMembresiaActiva(u?.fecha_vencimiento)).length;
    contadorUsuarios.textContent = String(activos);
    if (totalUsuarios) totalUsuarios.textContent = String(todosLosUsuarios.length);
    if (activosUsuarios) activosUsuarios.textContent = String(activos);
    const filteredCount = document.getElementById('users-filtered-count');
    if (filteredCount) filteredCount.textContent = `${usuarios.length} de ${todosLosUsuarios.length} socios`;

    tablaUsuarios.innerHTML = '';
    const frag = document.createDocumentFragment();

    ordenados.forEach(usuario => {
      const dias = diasFirmados(usuario?.fecha_vencimiento);
      const estado = estadoMembresia(dias);

      const tr = document.createElement('tr');
      tr.dataset.ci = String(usuario?.ci ?? '');
      tr.innerHTML = `
        <td class="user-table-cell user-identity-cell">
          <span class="user-list-avatar"></span>
          <span class="user-list-identity"><button class="user-name-button" type="button"><strong></strong></button><small></small></span>
        </td>
        <td class="user-table-cell user-membership-cell">
          <span class="user-expiration-date"></span>
          <span class="user-membership-state is-${estado.type}"><i></i><strong></strong></span>
        </td>
        <td class="user-table-cell user-last-access"></td>
      `;
      const initials = String(usuario?.nombre || '').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'UF';
      tr.querySelector('.user-list-avatar').textContent = initials;
      tr.querySelector('.user-list-identity strong').textContent = usuario?.nombre || 'Sin nombre';
      tr.querySelector('.user-name-button').setAttribute('aria-label', `Abrir ficha de ${usuario?.nombre || 'socio'}`);
      tr.querySelector('.user-list-identity small').textContent = `CI ${formatearCedula(usuario?.ci)}`;
      tr.querySelector('.user-expiration-date').textContent = formatearFechaCorta(usuario?.fecha_vencimiento);
      tr.querySelector('.user-membership-state strong').textContent = estado.label;
      tr.querySelector('.user-last-access').textContent = formatearUltimoAcceso(usuario);
      frag.appendChild(tr);
    });

    tablaUsuarios.appendChild(frag);
    if (estadoVacio) estadoVacio.hidden = ordenados.length > 0;
    asignarEventosBotonesVer();
  }

  function aplicarFiltros() {
    const query = buscador?.value.trim().toLocaleLowerCase('es') || '';
    const usuarios = todosLosUsuarios.filter(usuario => {
      const matchesSearch = !query
        || String(usuario?.ci ?? '').toLocaleLowerCase('es').includes(query)
        || String(usuario?.nombre ?? '').toLocaleLowerCase('es').includes(query);
      if (!matchesSearch) return false;
      const dias = diasFirmados(usuario?.fecha_vencimiento);
      if (filtroEstado === 'active') return dias != null && dias > 15;
      if (filtroEstado === 'expiring') return dias != null && dias >= 0 && dias <= 15;
      if (filtroEstado === 'expired') return dias != null && dias < 0;
      return true;
    });
    renderizarTabla(usuarios);
  }

  function mostrarDetalleUsuario(usuario) {
    usuarioSeleccionado = { ...usuario };
    actualizarAccesoRutina(usuario.ci);

    const dias = diasFirmados(usuario.fecha_vencimiento);
    const estado = estadoMembresia(dias);
    const nombre = usuario.nombre || 'Socio';
    if (detalleAvatar) detalleAvatar.textContent = nombre.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'UF';
    if (detalleHeaderNombre) detalleHeaderNombre.textContent = nombre;
    if (detalleHeaderMeta) {
      const alta = fechaLocal(usuario.fecha_creacion);
      const altaLabel = alta ? new Intl.DateTimeFormat('es-UY', { month: 'long', year: 'numeric' }).format(alta) : 'fecha no registrada';
      detalleHeaderMeta.textContent = `CI ${formatearCedula(usuario.ci)} · Socio desde ${altaLabel}`;
    }
    if (detalleHeaderStatus) {
      detalleHeaderStatus.className = `user-detail-status is-${estado.type}`;
      detalleHeaderStatus.innerHTML = `<i></i>${dias != null && dias >= 0 ? 'Membresía vigente' : 'Membresía vencida'}`;
    }
    if (detalleVencimientoResumen) {
      const vencimiento = fechaLocal(usuario.fecha_vencimiento);
      detalleVencimientoResumen.textContent = vencimiento
        ? `Vence el ${new Intl.DateTimeFormat('es-UY', { day: 'numeric', month: 'long', year: 'numeric' }).format(vencimiento)}`
        : 'Sin vencimiento registrado';
    }
    if (detalleDiasResumen) detalleDiasResumen.textContent = estado.label;

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

    document.dispatchEvent(new CustomEvent('admin:navigate', { detail: { section: 'user-detail' } }));
    cargarHistorialPagos(usuario.ci);
  }

  async function actualizarAccesoRutina(ci) {
    const button = document.getElementById('detalle-rutina');
    button.disabled = true;
    button.querySelector('span').textContent = 'Rutina';
    try {
      const plans = await window.api.obtenerRutinasSocios();
      if (String(usuarioSeleccionado?.ci) !== String(ci)) return;
      button.querySelector('span').textContent = plans.some(item => String(item.identityNumber) === String(ci) && item.plan) ? 'Ver rutina' : 'Crear rutina';
      button.disabled = false;
    } catch (_) {
      if (String(usuarioSeleccionado?.ci) !== String(ci)) return;
      button.querySelector('span').textContent = 'Consultar rutina';
      button.disabled = false;
    }
  }

  document.getElementById('detalle-rutina')?.addEventListener('click', () => {
    if (!usuarioSeleccionado) return;
    document.dispatchEvent(new CustomEvent('training:open-member', { detail: { ci: usuarioSeleccionado.ci } }));
  });
  document.addEventListener('training:member-saved', () => {
    if (usuarioSeleccionado) actualizarAccesoRutina(usuarioSeleccionado.ci);
  });

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
    document.querySelectorAll('[data-membership-duration]').forEach(button => {
      button.classList.toggle('is-active', button.dataset.membershipDuration === 'mensual');
    });
  }

  function inicializarAlta() {
    if (!botonAgregar) return;

    document.querySelectorAll('[data-membership-duration]').forEach(button => {
      button.addEventListener('click', () => {
        const tipoMembresia = document.getElementById('tipo-membresia');
        if (tipoMembresia) tipoMembresia.value = button.dataset.membershipDuration || 'mensual';
        document.querySelectorAll('[data-membership-duration]').forEach(option => option.classList.toggle('is-active', option === button));
      });
    });

    abrirAltaBtn?.addEventListener('click', limpiarFormularioAlta);
    document.querySelectorAll('[data-open-modal="modal-alta-usuario"]').forEach(button => {
      button.addEventListener('click', limpiarFormularioAlta);
    });

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

    buscador.addEventListener('input', aplicarFiltros);
    filtros.forEach(button => button.addEventListener('click', () => {
      filtroEstado = button.dataset.usersFilter || 'all';
      filtros.forEach(option => option.classList.toggle('is-active', option === button));
      aplicarFiltros();
    }));
    document.addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        document.dispatchEvent(new CustomEvent('admin:navigate', { detail: { section: 'users' } }));
        buscador.focus();
      }
    });
    document.addEventListener('member:open', event => {
      const usuario = todosLosUsuarios.find(item => String(item?.ci) === String(event.detail?.ci));
      if (usuario) mostrarDetalleUsuario(usuario);
    });
  }

  function inicializarModal() {
    resetMobileButton?.addEventListener('click', async () => {
      if (!usuarioSeleccionado) return;
      const password = mobilePassword?.value || '';
      if (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
        shared.mostrarNotificacion(
          'La contraseña debe tener 10 caracteres, una letra y un número',
          'warning'
        );
        return;
      }
      try {
        await window.api.restablecerAccesoMovil(usuarioSeleccionado.ci, password);
        mobilePassword.value = '';
        shared.mostrarNotificacion(
          'Acceso móvil restablecido y sesiones anteriores cerradas',
          'success'
        );
      } catch (error) {
        shared.mostrarNotificacion(error?.message || 'No se pudo restablecer el acceso', 'error');
      }
    });

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
          document.dispatchEvent(new CustomEvent('admin:navigate', { detail: { section: 'users' } }));
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
          document.dispatchEvent(new CustomEvent('admin:navigate', { detail: { section: 'users' } }));
          shared.mostrarNotificacion('Usuario eliminado', 'success');
          await actualizarTabla();
        },
      });

      if (!confirmado) {
        shared.mostrarNotificacion('Cancelado', 'warning');
      }
    });

    cerrarBtn.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('admin:navigate', { detail: { section: 'users' } }));
    });
  }

  function init() {
    window.adminSync?.watch({
      enabled: () => Boolean(window.api && window.adminSync.active('users')),
      read: () => Promise.all([window.api.obtenerUsuarios(), window.api.obtenerUltimosIngresos()]),
      apply: ([usuarios, ingresos]) => {
        todosLosUsuarios = usuarios; ultimosAccesos = construirUltimosAccesos(ingresos); aplicarFiltros();
      },
    });
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
