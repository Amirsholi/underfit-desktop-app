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
