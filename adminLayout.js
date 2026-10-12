function createAdminLayoutController() {
  const btnGoHome = document.getElementById('btn-go-home');
  const btnOpenSettings = document.getElementById('btn-open-settings');
  const workspaceMain = document.querySelector('.workspace-main');

  function promoteModalToPage(modalId, viewId, { preserveClose = false } = {}) {
    const page = document.getElementById(modalId);
    if (!page || !workspaceMain) return null;
    page.classList.remove('app-modal');
    page.classList.add('app-view');
    if (!['operations', 'settings'].includes(viewId)) page.classList.add('route-page');
    page.dataset.adminView = viewId;
    page.style.display = '';
    if (!preserveClose) page.querySelector('.app-modal-close')?.remove();
    page.querySelector('.app-modal-card')?.classList.add('route-page-card');
    workspaceMain.appendChild(page);
    return page;
  }

  promoteModalToPage('modal-dashboard', 'operations');
  promoteModalToPage('modal-configuracion', 'settings');
  promoteModalToPage('detalle', 'user-detail', { preserveClose: true });
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
    document.querySelectorAll('.app-modal:not(.route-page)').forEach(modal => {
      const header = modal.querySelector('.app-modal-header');
      const title = header?.querySelector('h3');
      const close = header?.querySelector('.app-modal-close');
      if (!header || !title) return;
      modal.classList.add('refined-modal');
      if (close) {
        // Todos los modales usan el mismo cierre visible y accesible.
        close.textContent = '×';
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
      if (section === 'locations') section = 'products';
      if (section === 'records') {
        document.dispatchEvent(new CustomEvent('admin-records:show'));
        return;
      }
      // Cada vista empieza en su encabezado. Sin este reinicio, el scroll de una
      // pantalla larga (por ejemplo ejercicios o detalle) se heredaba al abrir
      // Registros/Caja y hacía que parecieran recortadas.
      workspaceMain?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.dispatchEvent(new CustomEvent('admin-section:show', { detail: { section } }));
      if (section === 'cash') {
        views.forEach(view => view.classList.toggle('is-active', view.dataset.adminView === 'operations'));
        document.querySelectorAll('.workspace-sidebar [data-admin-section]').forEach(button => {
          button.classList.toggle('is-active', button.dataset.adminSection === section);
        });
        document.dispatchEvent(new CustomEvent('admin-dashboard:show', { detail: { tab: 'caja' } }));
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
        const activeSection = section === 'user-detail' ? 'users' : section;
        button.classList.toggle('is-active', button.dataset.adminSection === activeSection);
      });
      if (section === 'home') document.dispatchEvent(new CustomEvent('admin-home:show'));
    }

    navigationButtons.forEach(button => button.addEventListener('click', () => showSection(button.dataset.adminSection)));
    document.querySelectorAll('[data-scroll-to]').forEach(button => {
      button.addEventListener('click', () => {
        const target = document.getElementById(button.dataset.scrollTo);
        target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
    btnGoHome?.addEventListener('click', () => {
      showSection('home');
    });
    btnOpenSettings?.addEventListener('click', () => showSection('settings'));
    document.addEventListener('admin:navigate', event => {
      const section = event.detail?.section;
      if (section) showSection(section);
    });

    const reviewSections = ['home', 'cash', 'users', 'classes', 'training', 'products', 'pending', 'records', 'settings'];
    document.addEventListener('keydown', event => {
      if (!event.altKey || event.ctrlKey || event.metaKey) return;
      const index = Number(event.key) - 1;
      if (index < 0 || index >= reviewSections.length) return;
      event.preventDefault();
      showSection(reviewSections[index]);
    });
  }

  return {
    init,
    openModalById,
    closeModalById,
  };
}

window.createAdminLayoutController = createAdminLayoutController;
