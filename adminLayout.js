function createAdminLayoutController() {
  const btnGoHome = document.getElementById('btn-go-home');
  const btnOpenDashboard = document.getElementById('btn-open-dashboard');
  const btnOpenSettings = document.getElementById('btn-open-settings');

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

    btnGoHome?.addEventListener('click', () => closeModalById('modal-dashboard'));
    btnOpenDashboard?.addEventListener('click', () => {
      openModalById('modal-dashboard');
      document.dispatchEvent(new CustomEvent('admin-dashboard:show'));
    });
    btnOpenSettings?.addEventListener('click', () => openModalById('modal-configuracion'));
  }

  return {
    init,
    openModalById,
    closeModalById,
  };
}

window.createAdminLayoutController = createAdminLayoutController;
