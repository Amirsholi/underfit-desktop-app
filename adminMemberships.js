function createAdminMembershipsController({ shared, actualizarTabla }) {
  const inputActualizarCI = document.getElementById('actualizar-ci');
  const inputSocioSeleccionado = document.getElementById('actualizar-socio-ci');
  const selectorSocio = document.getElementById('renewal-member-picker');
  const sugerenciasSocio = document.getElementById('renewal-member-suggestions');
  const contenedorBotonesMembresia = document.getElementById('botones-membresia');
  const modalRenovar = document.getElementById('modal-renovar-suscripcion');
  const abrirRenovarBtn = document.getElementById('btn-open-renew');
  const confirmarRenovacion = document.getElementById('renovar-confirmar');
  let tipoSeleccionado = 'mensual';
  let usuariosRenovacion = [];
  let usuarioRenovacionSeleccionado = null;
  let indiceSugerenciaActivo = -1;
  const planLabels = {
    mensual: '1 Mes',
    trimestral: '3 Meses',
    semestral: '6 Meses',
  };

  function formatearMoneda(valor) {
    return new Intl.NumberFormat('es-UY', {
      style: 'currency',
      currency: 'UYU',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(valor || 0));
  }

  function normalizarBusqueda(valor) {
    return String(valor ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('es')
      .trim();
  }

  function formatearCedula(valor) {
    const digits = String(valor ?? '').replace(/\D/g, '');
    if (digits.length < 2) return String(valor ?? '');
    return `${Number(digits.slice(0, -1)).toLocaleString('es-UY')}-${digits.slice(-1)}`;
  }

  function inicialesUsuario(nombre) {
    return String(nombre || '?')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(parte => parte[0])
      .join('')
      .toUpperCase();
  }

  function cerrarSugerencias() {
    if (!sugerenciasSocio || !inputActualizarCI) return;
    sugerenciasSocio.hidden = true;
    selectorSocio?.classList.remove('is-open');
    inputActualizarCI.setAttribute('aria-expanded', 'false');
    inputActualizarCI.removeAttribute('aria-activedescendant');
    indiceSugerenciaActivo = -1;
  }

  function marcarSugerenciaActiva(indice) {
    if (!sugerenciasSocio || !inputActualizarCI) return;
    const opciones = Array.from(sugerenciasSocio.querySelectorAll('[data-renewal-member]'));
    if (!opciones.length) return;
    indiceSugerenciaActivo = Math.max(0, Math.min(indice, opciones.length - 1));
    opciones.forEach((opcion, index) => opcion.classList.toggle('is-keyboard-active', index === indiceSugerenciaActivo));
    const activa = opciones[indiceSugerenciaActivo];
    inputActualizarCI.setAttribute('aria-activedescendant', activa.id);
    activa.scrollIntoView({ block: 'nearest' });
  }

  function seleccionarUsuario(usuario) {
    if (!usuario || !inputActualizarCI || !inputSocioSeleccionado) return;
    usuarioRenovacionSeleccionado = usuario;
    inputSocioSeleccionado.value = String(usuario.ci);
    inputActualizarCI.value = `${usuario.nombre} · CI ${formatearCedula(usuario.ci)}`;
    selectorSocio?.classList.add('has-selection');
    cerrarSugerencias();
  }

  function limpiarUsuarioSeleccionado() {
    usuarioRenovacionSeleccionado = null;
    if (inputSocioSeleccionado) inputSocioSeleccionado.value = '';
    selectorSocio?.classList.remove('has-selection');
  }

  function renderizarSugerenciasSocio(valor = '') {
    if (!sugerenciasSocio || !inputActualizarCI) return;
    const query = normalizarBusqueda(valor);
    if (!query) {
      sugerenciasSocio.innerHTML = '';
      cerrarSugerencias();
      return;
    }
    const queryDigits = String(valor ?? '').replace(/\D/g, '');
    const visibles = usuariosRenovacion
      .filter(usuario => {
        if (!query) return true;
        return normalizarBusqueda(usuario.nombre).includes(query)
          || (queryDigits && String(usuario.ci ?? '').replace(/\D/g, '').includes(queryDigits));
      })
      .sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'))
      .slice(0, 6);

    sugerenciasSocio.innerHTML = '';
    visibles.forEach((usuario, index) => {
      const opcion = document.createElement('button');
      opcion.type = 'button';
      opcion.id = `renewal-member-option-${index}`;
      opcion.dataset.renewalMember = String(usuario.ci);
      opcion.setAttribute('role', 'option');
      const seleccionada = Number(usuarioRenovacionSeleccionado?.ci) === Number(usuario.ci);
      opcion.setAttribute('aria-selected', String(seleccionada));
      opcion.classList.toggle('is-selected', seleccionada);

      const avatar = document.createElement('span');
      avatar.className = 'renewal-member-avatar';
      avatar.textContent = inicialesUsuario(usuario.nombre);
      const identidad = document.createElement('span');
      identidad.className = 'renewal-member-identity';
      const nombre = document.createElement('strong');
      nombre.textContent = usuario.nombre;
      const cedula = document.createElement('small');
      cedula.textContent = `CI ${formatearCedula(usuario.ci)}`;
      identidad.append(nombre, cedula);
      const marca = document.createElement('span');
      marca.className = 'renewal-member-check';
      marca.setAttribute('aria-hidden', 'true');
      marca.textContent = seleccionada ? '✓' : '';
      opcion.append(avatar, identidad, marca);
      sugerenciasSocio.appendChild(opcion);
    });

    if (!visibles.length) {
      const vacio = document.createElement('div');
      vacio.className = 'renewal-member-empty';
      vacio.textContent = 'No se encontraron socios.';
      sugerenciasSocio.appendChild(vacio);
    }
    sugerenciasSocio.hidden = false;
    selectorSocio?.classList.add('is-open');
    inputActualizarCI.setAttribute('aria-expanded', 'true');
    indiceSugerenciaActivo = -1;
  }

  async function cargarUsuariosRenovacion() {
    try {
      usuariosRenovacion = window.api?.obtenerUsuarios
        ? await window.api.obtenerUsuarios()
        : [];
    } catch (error) {
      console.error('Error cargando socios para renovar:', error);
      usuariosRenovacion = [];
      shared.mostrarNotificacion('No se pudieron cargar los socios', 'error');
    }
  }

  async function prepararSelectorSocio(ci = '') {
    limpiarUsuarioSeleccionado();
    if (inputActualizarCI) inputActualizarCI.value = '';
    cerrarSugerencias();
    await cargarUsuariosRenovacion();
    if (!ci) return;
    const usuario = usuariosRenovacion.find(item => Number(item.ci) === Number(ci));
    if (usuario) seleccionarUsuario(usuario);
    else if (inputActualizarCI) inputActualizarCI.value = String(ci);
  }

  function resolverUsuarioIngresado() {
    if (usuarioRenovacionSeleccionado) return usuarioRenovacionSeleccionado;
    const valor = inputActualizarCI?.value.trim() || '';
    if (!valor) return null;
    const digits = valor.replace(/\D/g, '');
    const query = normalizarBusqueda(valor);
    const coincidencias = usuariosRenovacion.filter(usuario => (
      (digits && String(usuario.ci ?? '').replace(/\D/g, '') === digits)
      || normalizarBusqueda(usuario.nombre) === query
    ));
    if (coincidencias.length === 1) {
      seleccionarUsuario(coincidencias[0]);
      return coincidencias[0];
    }
    return null;
  }

  async function actualizarMembresiaDesdeInput(tipo) {
    const usuarioElegido = resolverUsuarioIngresado();
    if (!usuarioElegido) {
      renderizarSugerenciasSocio(inputActualizarCI?.value || '');
      return shared.mostrarNotificacion('Seleccioná un socio de la lista', 'warning');
    }
    const ci = String(usuarioElegido.ci);
    const formaPago = document.querySelector('input[name="renovar-forma-pago"]:checked')?.value || 'efectivo';

    try {
      const usuario = await window.api.obtenerUsuario(ci);
      if (!usuario) return shared.mostrarNotificacion('Usuario no encontrado');

      const confirmado = await shared.confirmAction({
        message: `Deseas renovar ${planLabels[tipo].toLowerCase()} a ${usuario.nombre}?`,
        onConfirm: async () => {
          await window.api.renovarMembresia({ ci, tipo, formaPago });
          shared.mostrarNotificacion('Membresia actualizada');
          modalRenovar.style.display = 'none';
          inputActualizarCI.value = '';
          limpiarUsuarioSeleccionado();
          cerrarSugerencias();
          document.querySelectorAll('input[name="renovar-forma-pago"]').forEach(input => {
            input.checked = input.value === 'efectivo';
          });
          await actualizarTabla();
          document.dispatchEvent(new CustomEvent('cash:updated'));
        },
      });

      if (!confirmado) {
        shared.mostrarNotificacion('Actualizacion cancelada', 'warning');
      }
    } catch (e) {
      console.error(e);
      shared.mostrarNotificacion(e?.message || 'Error al actualizar', 'error');
    }
  }

  async function cargarPreciosBotones() {
    if (!window.api?.obtenerInfoSistema) return;
    try {
      const info = await window.api.obtenerInfoSistema();
      const settings = info?.settings || {};
      const precios = {
        mensual: settings.precioMembresiaMensual,
        trimestral: settings.precioMembresiaTrimestral,
        semestral: settings.precioMembresiaSemestral,
      };

      Object.keys(precios).forEach((tipo) => {
        const button = document.querySelector(`[data-renovar-tipo="${tipo}"]`);
        if (!button) return;
        button.textContent = planLabels[tipo];
      });
    } catch (error) {
      console.error('Error cargando precios de membresia:', error);
    }
  }

  function init() {
    if (!contenedorBotonesMembresia) return;

    contenedorBotonesMembresia.innerHTML = `
      <button class="is-active" type="button" data-renovar-tipo="mensual">1 Mes</button>
      <button type="button" data-renovar-tipo="trimestral">3 Meses</button>
      <button type="button" data-renovar-tipo="semestral">6 Meses</button>
    `;

    contenedorBotonesMembresia.querySelectorAll('[data-renovar-tipo]').forEach(button => {
      button.addEventListener('click', () => {
        tipoSeleccionado = button.dataset.renovarTipo || 'mensual';
        contenedorBotonesMembresia.querySelectorAll('[data-renovar-tipo]').forEach(option => option.classList.toggle('is-active', option === button));
      });
    });

    document.querySelectorAll('[data-open-modal="modal-renovar-suscripcion"]').forEach(button => {
      button.addEventListener('click', async () => {
        const currentCi = button.closest('#detalle') ? document.getElementById('detalle-ci')?.value : '';
        await prepararSelectorSocio(currentCi || '');
        tipoSeleccionado = 'mensual';
        contenedorBotonesMembresia.querySelectorAll('[data-renovar-tipo]').forEach(option => option.classList.toggle('is-active', option.dataset.renovarTipo === tipoSeleccionado));
        document.querySelectorAll('input[name="renovar-forma-pago"]').forEach(input => { input.checked = input.value === 'efectivo'; });
        await cargarPreciosBotones();
      });
    });

    abrirRenovarBtn?.addEventListener('click', () => prepararSelectorSocio(''));
    inputActualizarCI?.addEventListener('focus', () => {
      if (!usuarioRenovacionSeleccionado && inputActualizarCI.value.trim()) renderizarSugerenciasSocio(inputActualizarCI.value);
      else cerrarSugerencias();
    });
    inputActualizarCI?.addEventListener('input', () => {
      limpiarUsuarioSeleccionado();
      renderizarSugerenciasSocio(inputActualizarCI.value);
    });
    inputActualizarCI?.addEventListener('keydown', event => {
      const opciones = Array.from(sugerenciasSocio?.querySelectorAll('[data-renewal-member]') || []);
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (!inputActualizarCI.value.trim()) return;
        if (sugerenciasSocio?.hidden) renderizarSugerenciasSocio(inputActualizarCI.value);
        marcarSugerenciaActiva(indiceSugerenciaActivo + 1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        marcarSugerenciaActiva(indiceSugerenciaActivo <= 0 ? opciones.length - 1 : indiceSugerenciaActivo - 1);
      } else if (event.key === 'Enter' && indiceSugerenciaActivo >= 0) {
        event.preventDefault();
        opciones[indiceSugerenciaActivo]?.click();
      } else if (event.key === 'Escape') {
        cerrarSugerencias();
      }
    });
    sugerenciasSocio?.addEventListener('click', event => {
      const opcion = event.target.closest('[data-renewal-member]');
      if (!opcion) return;
      const usuario = usuariosRenovacion.find(item => Number(item.ci) === Number(opcion.dataset.renewalMember));
      if (usuario) seleccionarUsuario(usuario);
    });
    document.addEventListener('pointerdown', event => {
      if (!selectorSocio?.contains(event.target)) cerrarSugerencias();
    });
    confirmarRenovacion?.addEventListener('click', () => actualizarMembresiaDesdeInput(tipoSeleccionado));

    cargarPreciosBotones();
  }

  return {
    init,
  };
}

window.createAdminMembershipsController = createAdminMembershipsController;
