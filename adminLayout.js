function createAdminLayoutController() {
  const btnGoHome = document.getElementById('btn-go-home');
  const btnOpenSettings = document.getElementById('btn-open-settings');
  const workspaceMain = document.querySelector('.workspace-main');

  function promoteModalToPage(modalId, viewId) {
    const page = document.getElementById(modalId);
    if (!page || !workspaceMain) return null;
    page.classList.remove('app-modal');
    page.classList.add('app-view', 'route-page');
    page.dataset.adminView = viewId;
    page.style.display = '';
    page.querySelector('.app-modal-close')?.remove();
    page.querySelector('.app-modal-card')?.classList.add('route-page-card');
    workspaceMain.appendChild(page);
    return page;
  }

  promoteModalToPage('modal-dashboard', 'operations');
  promoteModalToPage('modal-configuracion', 'settings');
  const navigationButtons = Array.from(document.querySelectorAll('[data-admin-section]'));
  const views = Array.from(document.querySelectorAll('[data-admin-view]'));

  function openModalById(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'flex';
    }
  }

  function closeModalById(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'none';
    }
  }

  function initModalTriggers() {
    const modalCopy = {
      'modal-ingreso-manual-caja': ['fa-arrow-right-to-bracket', 'Registra un ingreso manual a la caja.'],
      'modal-salida-caja': ['fa-arrow-right-from-bracket', 'Registra un egreso y su metodo de pago.'],
      'modal-corregir-movimiento': ['fa-pen-to-square', 'Anula el movimiento original y guarda la correccion.'],
      'modal-cierre-caja': ['fa-lock', 'Compara el efectivo contado antes de cerrar la jornada.'],
      'modal-ajuste-total': ['fa-scale-balanced', 'Ajusta el total conservando un registro de auditoria.'],
      'modal-alta-usuario': ['fa-user-plus', 'Completa los datos principales del nuevo socio.'],
      'modal-renovar-suscripcion': ['fa-arrows-rotate', 'Selecciona el socio y el periodo de renovacion.'],
      'modal-nuevo-producto': ['fa-bag-shopping', 'Agrega un articulo al inventario.'],
      'modal-vender-producto': ['fa-cart-shopping', 'Registra una venta y actualiza el stock.'],
      'modal-editar-producto': ['fa-pen', 'Actualiza los datos y existencias del articulo.'],
      'modal-anular-ingreso': ['fa-ban', 'El registro quedara anulado con trazabilidad.'],
    };
    document.querySelectorAll('.app-modal:not(.route-page)').forEach(modal => {
      const header = modal.querySelector('.app-modal-header');
      const title = header?.querySelector('h3');
      const close = header?.querySelector('.app-modal-close');
      if (!header || !title) return;
      modal.classList.add('refined-modal');
      const [icon, subtitle] = modalCopy[modal.id] || ['fa-sliders', 'Completa la informacion para continuar.'];
      title.innerHTML = `<span class="modal-title-icon"><i class="fa-solid ${icon}"></i></span><span class="modal-title-copy"><span>${title.textContent}</span><small>${subtitle}</small></span>`;
      if (close) {
        close.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        close.setAttribute('aria-label', 'Cerrar');
        close.setAttribute('title', 'Cerrar');
      }
      const footer = modal.querySelector('.app-modal-footer');
      if (footer && !footer.querySelector('.modal-cancel-action')) {
        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'app-button modal-cancel-action';
        cancel.dataset.closeModal = modal.id;
        cancel.textContent = 'Cancelar';
        footer.prepend(cancel);
      }
    });

    document.querySelectorAll('[data-open-modal]').forEach(button => {
      button.addEventListener('click', () => {
        openModalById(button.getAttribute('data-open-modal'));
      });
    });

    document.querySelectorAll('[data-close-modal]').forEach(button => {
      button.addEventListener('click', () => {
        closeModalById(button.getAttribute('data-close-modal'));
      });
    });
  }

  function init() {
    initModalTriggers();

    function showSection(section) {
      if (section === 'cash' || section === 'records') {
        views.forEach(view => view.classList.toggle('is-active', view.dataset.adminView === 'operations'));
        document.querySelectorAll('.workspace-sidebar [data-admin-section]').forEach(button => {
          button.classList.toggle('is-active', button.dataset.adminSection === section);
        });
        document.dispatchEvent(new CustomEvent('admin-dashboard:show', { detail: { tab: section === 'cash' ? 'caja' : 'ingresos' } }));
        return;
      }
      if (section === 'settings') {
        views.forEach(view => view.classList.toggle('is-active', view.dataset.adminView === 'settings'));
        document.querySelectorAll('.workspace-sidebar [data-admin-section]').forEach(button => button.classList.toggle('is-active', button.dataset.adminSection === section));
        document.dispatchEvent(new CustomEvent('admin-settings:show'));
        return;
      }
      views.forEach(view => view.classList.toggle('is-active', view.dataset.adminView === section));
      document.querySelectorAll('.workspace-sidebar [data-admin-section]').forEach(button => {
        button.classList.toggle('is-active', button.dataset.adminSection === section);
      });
    }

    navigationButtons.forEach(button => button.addEventListener('click', () => showSection(button.dataset.adminSection)));
    btnGoHome?.addEventListener('click', () => {
      showSection('home');
    });
    btnOpenSettings?.addEventListener('click', () => showSection('settings'));
  }

  return {
    init,
    openModalById,
    closeModalById,
  };
}

window.createAdminLayoutController = createAdminLayoutController;
