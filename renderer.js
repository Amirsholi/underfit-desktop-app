document.addEventListener('DOMContentLoaded', async () => {
  const membershipRules = window.membershipRules;
  if (!membershipRules) {
    console.error('No se cargaron las reglas de membresia');
    return;
  }

  function initSettingsModal(shared) {
    const btnOpenSettings = document.getElementById('btn-open-settings');
    const modal = document.getElementById('modal-configuracion');
    const modalBody = modal?.querySelector('.app-modal-body');
    const modalCard = modal?.querySelector('.app-modal-card');

    if (!modal || !modalBody || !modalCard || modal.dataset.settingsReady === 'true') {
      return;
    }

    modalCard.classList.add('app-modal-card-wide');

    modalBody.innerHTML = `
      <div class="config-page-intro">
        <span class="config-page-kicker">Administracion del sistema</span>
        <p>Valores comerciales, almacenamiento y funciones especiales de Under-Fit.</p>
      </div>
      <section class="config-section">
        <div class="config-section-heading">
          <div class="config-section-icon"><i class="fa-solid fa-tags"></i></div>
          <div><h4>Cuotas y membresias</h4><p>Importes utilizados al registrar altas y renovaciones.</p></div>
        </div>
        <div class="config-price-grid">
        <div class="form-field">
          <label for="config-precio-inscripcion">Inscripcion</label>
          <input id="config-precio-inscripcion" type="number" min="0" step="1" value="0">
        </div>
        <div class="form-field">
          <label for="config-precio-membresia-mensual">1 Mes</label>
          <input id="config-precio-membresia-mensual" type="number" min="0" step="1" value="1600">
        </div>
        <div class="form-field">
          <label for="config-precio-membresia-trimestral">3 Meses</label>
          <input id="config-precio-membresia-trimestral" type="number" min="0" step="1" value="0">
        </div>
        <div class="form-field">
          <label for="config-precio-membresia-semestral">6 Meses</label>
          <input id="config-precio-membresia-semestral" type="number" min="0" step="1" value="0">
        </div>
        </div>
      </section>
      <section class="config-section">
        <div class="config-section-heading">
          <div class="config-section-icon"><i class="fa-solid fa-database"></i></div>
          <div><h4>Datos del sistema</h4><p>Estado de la instalación actual y transición al servicio central.</p></div>
        </div>
        <div class="config-paths-grid">
        <div class="form-field">
          <label for="config-db-path">Base de datos</label>
          <input id="config-db-path" readonly>
        </div>
        <div class="form-field">
          <label for="config-backup-path">Carpeta de backups</label>
          <input id="config-backup-path" readonly>
        </div>
        </div>
        <div class="config-sync-note"><i class="fa-solid fa-hard-drive"></i><span><strong>Modo local activo</strong>La base compartida en línea se habilitará al conectar el servicio central.</span></div>
        <p id="config-backup-status" class="config-status-copy">Backup semanal automatico activo.</p>
      </section>
      <section class="config-section config-event-panel">
        <div class="config-section-heading config-event-heading">
          <div class="config-section-icon"><i class="fa-solid fa-person-running"></i></div>
          <div><h4>Under Running</h4><p>Contenido especial para la pantalla de ingreso.</p></div>
          <label class="switch-control" for="config-evento-running-activo">
            <input id="config-evento-running-activo" type="checkbox">
            <span class="switch-track"><span class="switch-thumb"></span></span>
            <span class="switch-label">Activar evento</span>
          </label>
        </div>
        <div class="config-event-fields">
          <div class="form-field">
            <label for="config-evento-running-nombre">Nombre</label>
            <input id="config-evento-running-nombre" type="text" value="UNDER RUNNING">
          </div>
          <div class="form-field">
            <label for="config-evento-running-distancias">Distancias</label>
            <input id="config-evento-running-distancias" type="text" value="3KM & 5KM">
          </div>
          <div class="form-field">
            <label for="config-evento-running-fecha">Fecha del evento</label>
            <input id="config-evento-running-fecha" type="date">
          </div>
        </div>
      </section>
    `;

    const footer = document.createElement('div');
    footer.className = 'app-modal-footer';
    footer.innerHTML = `
      <button id="config-crear-backup" class="app-button" type="button"><i class="fa-solid fa-box-archive"></i> Crear respaldo local</button>
      <button id="config-guardar-negocio" class="app-button app-button-primary" type="button"><i class="fa-solid fa-check"></i> Guardar cambios</button>
    `;
    modalCard.appendChild(footer);

    const inputPrecioInscripcion = document.getElementById('config-precio-inscripcion');
    const inputPrecioMembresiaMensual = document.getElementById('config-precio-membresia-mensual');
    const inputPrecioMembresiaTrimestral = document.getElementById('config-precio-membresia-trimestral');
    const inputPrecioMembresiaSemestral = document.getElementById('config-precio-membresia-semestral');
    const inputDbPath = document.getElementById('config-db-path');
    const inputBackupPath = document.getElementById('config-backup-path');
    const inputEventoRunningActivo = document.getElementById('config-evento-running-activo');
    const inputEventoRunningNombre = document.getElementById('config-evento-running-nombre');
    const inputEventoRunningDistancias = document.getElementById('config-evento-running-distancias');
    const inputEventoRunningFecha = document.getElementById('config-evento-running-fecha');
    const backupStatus = document.getElementById('config-backup-status');
    const saveBusinessButton = document.getElementById('config-guardar-negocio');
    const backupButton = document.getElementById('config-crear-backup');

    async function cargarInfoSistema() {
      if (!window.api?.obtenerInfoSistema) {
        inputEventoRunningFecha.value = '2026-05-24';
        inputDbPath.value = 'C:\\Under-Fit\\datos\\under-fit.db';
        inputBackupPath.value = 'C:\\Under-Fit\\respaldos';
        backupStatus.textContent = 'Respaldo local automático activo.';
        return;
      }
      try {
        const info = await window.api.obtenerInfoSistema();
        inputPrecioInscripcion.value = String(info?.settings?.precioInscripcion ?? 0);
        inputPrecioMembresiaMensual.value = String(info?.settings?.precioMembresiaMensual ?? 1600);
        inputPrecioMembresiaTrimestral.value = String(info?.settings?.precioMembresiaTrimestral ?? 0);
        inputPrecioMembresiaSemestral.value = String(info?.settings?.precioMembresiaSemestral ?? 0);
        inputEventoRunningActivo.checked = info?.settings?.eventoRunningActivo === true;
        inputEventoRunningNombre.value = info?.settings?.eventoRunningNombre || 'UNDER RUNNING';
        inputEventoRunningDistancias.value = info?.settings?.eventoRunningDistancias || '3KM & 5KM';
        inputEventoRunningFecha.value = info?.settings?.eventoRunningFecha || '2026-05-24';
        inputDbPath.value = info?.dbPath || '';
        inputBackupPath.value = info?.backupDir || '';
        backupStatus.textContent = 'Backup semanal automatico activo.';
      } catch (error) {
        console.error(error);
        backupStatus.textContent = 'No se pudo cargar la informacion del sistema.';
      }
    }

    btnOpenSettings?.addEventListener('click', cargarInfoSistema);
    document.addEventListener('admin-settings:show', cargarInfoSistema);
    saveBusinessButton.addEventListener('click', async () => {
      if (!window.api?.guardarConfiguracionNegocio) {
        backupStatus.textContent = 'Vista previa: los cambios se guardarán en la aplicación de escritorio.';
        return;
      }
      try {
        await window.api.guardarConfiguracionNegocio({
          precioInscripcion: Number(inputPrecioInscripcion.value || 0),
          precioMembresiaMensual: Number(inputPrecioMembresiaMensual.value || 0),
          precioMembresiaTrimestral: Number(inputPrecioMembresiaTrimestral.value || 0),
          precioMembresiaSemestral: Number(inputPrecioMembresiaSemestral.value || 0),
          eventoRunningActivo: inputEventoRunningActivo.checked,
          eventoRunningNombre: inputEventoRunningNombre.value.trim(),
          eventoRunningDistancias: inputEventoRunningDistancias.value.trim(),
          eventoRunningFecha: inputEventoRunningFecha.value,
        });
        backupStatus.textContent = 'Montos del negocio guardados.';
        shared.mostrarNotificacion('Montos actualizados', 'success');
      } catch (error) {
        console.error(error);
        backupStatus.textContent = 'No se pudieron guardar los montos.';
        shared.mostrarNotificacion('No se pudieron guardar los montos', 'error');
      }
    });
    backupButton.addEventListener('click', async () => {
      if (!window.api?.crearBackupManual) {
        backupStatus.textContent = 'Vista previa: el respaldo se creará desde la aplicación de escritorio.';
        return;
      }
      try {
        const resultado = await window.api.crearBackupManual();
        if (resultado?.created) {
          backupStatus.textContent = `Backup manual creado en: ${resultado.path}`;
          shared.mostrarNotificacion('Backup creado', 'success');
        } else {
          backupStatus.textContent = 'No se pudo crear el backup manual.';
          shared.mostrarNotificacion('No se pudo crear el backup', 'error');
        }
      } catch (error) {
        console.error(error);
        backupStatus.textContent = 'No se pudo crear el backup manual.';
        shared.mostrarNotificacion('No se pudo crear el backup', 'error');
      }
    });
    modal.dataset.settingsReady = 'true';
  }

  const shared = window.createAdminShared(membershipRules);
  const layoutController = window.createAdminLayoutController();
  layoutController.init();
  initSettingsModal(shared);

  const dateElement = document.getElementById('topbar-date');
  const timeElement = document.getElementById('topbar-time');
  function updateTopbarClock() {
    const now = new Date();
    if (dateElement) dateElement.textContent = now.toLocaleDateString('es-UY', { day: '2-digit', month: 'long', year: 'numeric' });
    if (timeElement) timeElement.textContent = now.toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' });
  }
  updateTopbarClock();
  setInterval(updateTopbarClock, 30000);

  const usersController = window.createAdminUsersController({ shared });
  await usersController.init();

  window.createAdminMembershipsController({
    shared,
    actualizarTabla: usersController.actualizarTabla,
  }).init();

  try {
    await window.createAdminProductsController({ shared }).init();
  } catch (error) {
    console.error('No se pudo inicializar productos:', error);
  }
  window.createHomeDashboardController({ shared }).init();
  window.createAdminEntriesController({ shared }).init();
  try {
    await window.createAdminOperationsController({ shared }).init();
  } catch (error) {
    console.error('No se pudieron inicializar las operaciones multi-local:', error);
  }
});
