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

    if (!btnOpenSettings || !modal || !modalBody || !modalCard || modal.dataset.settingsReady === 'true') {
      return;
    }

    modalCard.classList.add('app-modal-card-wide');

    modalBody.innerHTML = `
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
      <p id="config-backup-status" class="placeholder-copy">Backup semanal automatico activo.</p>
      <div class="config-event-panel">
        <h4>Modo evento Under Running</h4>
        <label class="config-event-toggle">
          <input id="config-evento-running-activo" type="checkbox">
          <span>Activar evento en pantalla de ingreso</span>
        </label>
        <div class="config-price-grid">
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
      </div>
    `;

    const footer = document.createElement('div');
    footer.className = 'app-modal-footer';
    footer.innerHTML = `
      <button id="config-guardar-negocio" class="app-button" type="button">Guardar montos</button>
      <button id="config-crear-backup" class="app-button app-button-primary" type="button">Crear backup ahora</button>
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

    btnOpenSettings.addEventListener('click', cargarInfoSistema);
    saveBusinessButton.addEventListener('click', async () => {
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
  const usersController = window.createAdminUsersController({ shared });
  await usersController.init();

  layoutController.init();
  initSettingsModal(shared);

  window.createAdminMembershipsController({
    shared,
    actualizarTabla: usersController.actualizarTabla,
  }).init();

  await window.createAdminProductsController({ shared }).init();
  window.createAdminEntriesController({ shared }).init();
});
