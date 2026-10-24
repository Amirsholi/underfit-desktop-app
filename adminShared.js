function createAdminShared(membershipRules) {
  let confirmState = null;

  function mostrarNotificacion(mensaje, tipo = 'success') {
    const contenedor = document.getElementById('notificaciones');
    if (!contenedor) return;

    const noti = document.createElement('div');
    noti.className = `noti ${tipo}`;
    noti.textContent = mensaje;
    noti.setAttribute('role', 'status');

    contenedor.appendChild(noti);

    setTimeout(() => {
      noti.remove();
    }, 4000);
  }

  function cerrarConfirmacion(resultado = false) {
    if (!confirmState) return;

    const { modal, btnSi, btnNo, resolve } = confirmState;
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    btnSi.onclick = null;
    btnNo.onclick = null;
    confirmState = null;
    resolve(resultado);
  }

  function confirmAction({ message, onConfirm } = {}) {
    return new Promise((resolve) => {
      const modal = document.getElementById('confirmacion-modal');
      const texto = document.getElementById('confirmacion-mensaje');
      const btnSi = document.getElementById('confirmar-si');
      const btnNo = document.getElementById('confirmar-no');
      if (!modal || !texto || !btnSi || !btnNo) {
        resolve(false);
        return;
      }

      texto.textContent = message || '';
      btnSi.textContent = 'Confirmar';
      btnNo.textContent = 'Cancelar';
      modal.style.display = 'flex';
      modal.setAttribute('aria-hidden', 'false');

      confirmState = { modal, btnSi, btnNo, resolve };

      btnSi.onclick = async () => {
        try {
          if (typeof onConfirm === 'function') {
            await onConfirm();
          }
          cerrarConfirmacion(true);
        } catch (error) {
          cerrarConfirmacion(false);
          throw error;
        }
      };
      btnNo.onclick = () => {
        cerrarConfirmacion(false);
      };
    });
  }

  function confirmarAccion(mensaje) {
    return confirmAction({ message: mensaje });
  }

  function calcularDiasRestantes(fechaVencimientoISO) {
    return membershipRules.daysRemaining(fechaVencimientoISO);
  }

  function esMembresiaActiva(fechaVencimientoISO) {
    return membershipRules.isMembershipActive(fechaVencimientoISO);
  }

  function ordenarSociosPorVencimiento(usuarios = []) {
    return [...usuarios].sort((a, b) => {
      const urgency = membershipRules.compareMembershipUrgency(a?.fecha_vencimiento, b?.fecha_vencimiento);
      if (urgency !== 0) return urgency;
      return String(a?.nombre || '').localeCompare(String(b?.nombre || ''), 'es');
    });
  }

  return {
    mostrarNotificacion,
    confirmAction,
    confirmarAccion,
    calcularDiasRestantes,
    esMembresiaActiva,
    ordenarSociosPorVencimiento,
  };
}

window.createAdminShared = createAdminShared;
