function createAdminMembershipsController({ shared, actualizarTabla }) {
  const inputActualizarCI = document.getElementById('actualizar-ci');
  const contenedorBotonesMembresia = document.getElementById('botones-membresia');
  const modalRenovar = document.getElementById('modal-renovar-suscripcion');
  const abrirRenovarBtn = document.getElementById('btn-open-renew');
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

  async function actualizarMembresiaDesdeInput(tipo) {
    const ci = inputActualizarCI?.value.trim();
    if (!ci) return shared.mostrarNotificacion('Ingrese CI para actualizar');
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

    abrirRenovarBtn?.addEventListener('click', async () => {
      inputActualizarCI.value = '';
      document.querySelectorAll('input[name="renovar-forma-pago"]').forEach(input => {
        input.checked = input.value === 'efectivo';
      });
      await cargarPreciosBotones();
    });

    contenedorBotonesMembresia.innerHTML = `
      <button class="app-button app-button-primary" type="button" data-renovar-tipo="mensual">1 Mes</button>
      <button class="app-button app-button-primary" type="button" data-renovar-tipo="trimestral">3 Meses</button>
      <button class="app-button app-button-primary" type="button" data-renovar-tipo="semestral">6 Meses</button>
    `;

    contenedorBotonesMembresia.querySelectorAll('[data-renovar-tipo]').forEach(button => {
      button.addEventListener('click', async () => {
        await actualizarMembresiaDesdeInput(button.dataset.renovarTipo);
      });
    });

    cargarPreciosBotones();
  }

  return {
    init,
  };
}

window.createAdminMembershipsController = createAdminMembershipsController;
