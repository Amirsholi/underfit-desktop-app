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
      <section class="config-section">
        <div class="config-section-heading">
          <div><h4>Cuotas y membresías</h4><p>Importes en pesos para altas y renovaciones.</p></div>
        </div>
        <div class="config-price-grid">
        <div class="form-field">
          <label for="config-precio-inscripcion">Inscripción</label>
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
      <section class="config-section config-storage">
        <div class="config-section-heading">
          <div><h4>Datos y respaldos</h4><p>Ubicación de los archivos de esta instalación.</p></div>
        </div>
        <div class="config-paths-grid">
        <div class="form-field">
          <label for="config-db-path">Base de datos</label>
          <input id="config-db-path" readonly>
        </div>
        <div class="form-field">
          <label for="config-backup-path">Carpeta de respaldos locales</label>
          <input id="config-backup-path" readonly>
        </div>
        </div>
        <div class="config-sync-note"><i class="fa-solid fa-hard-drive"></i><span><strong id="config-data-mode-title">Modo local activo</strong><span id="config-data-mode-copy">La base compartida en línea se habilitará al conectar el servicio central.</span></span></div>
        <button id="config-crear-backup" class="app-button" type="button"><i class="fa-solid fa-box-archive" aria-hidden="true"></i>Crear respaldo local</button>
        <p id="config-backup-status" class="config-status-copy" role="status"></p>
        <div class="config-entry-audio">
          <h4>Sonidos de ingreso</h4>
          <label class="switch-control" for="config-silenciar-ingreso">
            <input id="config-silenciar-ingreso" type="checkbox" role="switch" checked>
            <span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span>
            <span class="switch-label">Silenciar sonidos de ingreso</span>
          </label>
          <div class="config-audio-files">
            <div class="config-audio-file"><div><strong>Ingreso permitido</strong><span id="config-audio-success-name">Sin sonido</span></div><button id="config-cargar-ingreso" class="app-button" type="button">Cargar sonido</button></div>
            <div class="config-audio-file"><div><strong>Membresía vencida</strong><span id="config-audio-expired-name">Sin sonido</span></div><button id="config-cargar-vencido" class="app-button" type="button">Cargar sonido</button></div>
          </div>
          <p id="config-audio-status" class="config-status-copy" role="status">Opcionales · MP3, WAV, OGG o M4A · Hasta 10 MB.</p>
        </div>
      </section>
      <section class="config-section">
        <div class="config-section-heading"><div><h4>Vincular tablets</h4><p>Elegí la tablet y generá un código. Ingresalo en esa tablet una sola vez.</p></div></div>
        <div class="form-field"><label for="config-tablet-device">Dispositivo</label><select id="config-tablet-device"><option value="tablet1">Tablet 1</option><option value="tablet2">Tablet 2</option></select></div>
        <button id="config-tablet-code" class="app-button" type="button">Generar código de vinculación</button>
        <div id="config-tablet-code-display" class="tablet-pairing-display" hidden>
          <span id="config-tablet-code-label"></span>
          <output id="config-tablet-code-value" aria-label="Código de vinculación"></output>
          <span>Ingresá estos 6 números en la tablet seleccionada.</span>
        </div>
        <p id="config-tablet-result" class="config-status-copy" role="status"></p>
      </section>
      <section class="config-section config-event-panel">
        <div class="config-section-heading config-event-heading">
          <div><h4>Eventos</h4><p>Un evento destacado en la pantalla de ingreso.</p></div>
          <button id="config-nuevo-evento" class="app-button" type="button">+ Nuevo evento</button>
        </div>
        <div class="config-event-visibility">
          <label class="switch-control" for="config-evento-running-activo">
            <input id="config-evento-running-activo" type="checkbox">
            <span class="switch-track"><span class="switch-thumb"></span></span>
            <span class="switch-label">Mostrar al ingresar</span>
          </label>
        </div>
        <div class="config-event-fields">
          <div class="form-field">
            <label for="config-evento-running-nombre">Título</label>
            <input id="config-evento-running-nombre" type="text" maxlength="80" value="UNDER RUNNING" placeholder="Ej. Under Running">
          </div>
          <div class="form-field">
            <label for="config-evento-running-distancias">Subtítulo</label>
            <input id="config-evento-running-distancias" type="text" maxlength="100" value="3KM & 5KM" placeholder="Ej. 3 y 5 km">
          </div>
          <div class="form-field">
            <label for="config-evento-running-fecha">Fecha del evento</label>
            <input id="config-evento-running-fecha" type="date">
          </div>
          <div class="form-field config-event-legend">
            <label for="config-evento-running-leyenda">Leyenda al registrar un ingreso</label>
            <input id="config-evento-running-leyenda" type="text" maxlength="160" value="ya falta menos" placeholder="Ej. ¿Listos para correr?">
          </div>
        </div>
        <div id="config-event-draft" hidden><span>El evento actual se reemplazará al guardar.</span><button id="config-descartar-evento" type="button">Descartar nuevo evento</button></div>
      </section>
    `;

    // Separate controls by function, all visible on the same settings page.
    const audioPanel = document.createElement('section');
    audioPanel.className = 'config-section';
    audioPanel.innerHTML = '<div class="config-section-heading"><div><h4>Sonidos de ingreso</h4><p>Audio de ingreso permitido y membresía vencida en esta PC.</p></div></div>';
    const audioControls = modalBody.querySelector('.config-entry-audio');
    audioControls.querySelector('h4').remove();
    audioPanel.appendChild(audioControls);
    modalBody.appendChild(audioPanel);
    const sections = [
      ['cuotas', 'Cuotas y membresías', modalBody.querySelector('.config-section')],
      ['tablets', 'Tablets', document.getElementById('config-tablet-device').closest('section')],
      ['sonidos', 'Sonidos', audioPanel],
      ['eventos', 'Eventos', modalBody.querySelector('.config-event-panel')],
      ['respaldos', 'Datos y respaldos', modalBody.querySelector('.config-storage')],
    ];
    sections.forEach(([id, label, panel]) => {
      panel.id = 'settings-panel-' + id;
      panel.setAttribute('aria-label', label);
      modalBody.appendChild(panel);
    });
    const footer = document.createElement('div');
    let tabletCodeTimer;
    const tabletResult = document.getElementById('config-tablet-result');
    const codeDisplay = document.getElementById('config-tablet-code-display');
    const codeValue = document.getElementById('config-tablet-code-value');
    function clearTabletCode() { clearTimeout(tabletCodeTimer); codeDisplay.hidden = true; codeValue.textContent = ''; }
    document.getElementById('config-tablet-device').addEventListener('change', () => {
      clearTabletCode(); tabletResult.textContent = '';
    });
    document.getElementById('config-tablet-code').addEventListener('click', async event => {
      const button = event.currentTarget, select = document.getElementById('config-tablet-device');
      button.disabled = true; select.disabled = true;
      clearTabletCode(); tabletResult.textContent = 'Generando código…';
      try {
        const result = await window.api.crearCodigoTablet(select.value);
        document.getElementById('config-tablet-code-label').textContent = `Código para ${select.options[select.selectedIndex].text}`;
        codeValue.textContent = result.code;
        codeDisplay.hidden = false;
        tabletResult.textContent = 'Válido por 5 minutos y para una sola vinculación.';
        tabletCodeTimer = setTimeout(() => { clearTabletCode(); tabletResult.textContent = 'El código venció. Podés generar uno nuevo.'; }, Math.max(0, Date.parse(result.expiresAt) - Date.now()));
      } catch (error) { tabletResult.textContent = error.message; }
      finally { button.disabled = false; select.disabled = false; }
    });
    footer.className = 'settings-save-actions';
    footer.innerHTML = `
      <span id="settings-save-status" role="status"></span>
      <button id="config-guardar-negocio" class="app-button app-button-primary" type="submit" form="settings-form">Guardar cambios</button>
    `;
    document.getElementById('settings-header-actions').appendChild(footer);
    modalBody.querySelectorAll('input[type="number"]').forEach(input => { input.required = true; input.step = '0.01'; });
    document.getElementById('config-evento-running-fecha').classList.add('admin-business-date');

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
    const inputEventoRunningLeyenda = document.getElementById('config-evento-running-leyenda');
    const eventDraft = document.getElementById('config-event-draft');
    let previousEvent = null;
    const eventInputs = [inputEventoRunningNombre, inputEventoRunningDistancias, inputEventoRunningFecha, inputEventoRunningLeyenda];
    document.getElementById('config-nuevo-evento').addEventListener('click', () => {
      if (saveBusinessButton.disabled) return;
      previousEvent ??= { active: inputEventoRunningActivo.checked, values: eventInputs.map(input => input.value) };
      eventInputs.forEach(input => { input.value = ''; });
      inputEventoRunningActivo.checked = true;
      eventDraft.hidden = false;
      updateEventFields();
      inputEventoRunningNombre.focus();
    });
    document.getElementById('config-descartar-evento').addEventListener('click', () => {
      if (!previousEvent || saveBusinessButton.disabled) return;
      eventInputs.forEach((input, index) => { input.value = previousEvent.values[index]; });
      inputEventoRunningActivo.checked = previousEvent.active;
      previousEvent = null;
      eventDraft.hidden = true;
      updateEventFields();
    });
    const backupStatus = document.getElementById('config-backup-status');
    const saveBusinessButton = document.getElementById('config-guardar-negocio');
    const backupButton = document.getElementById('config-crear-backup');
    const dataModeTitle = document.getElementById('config-data-mode-title');
    const dataModeCopy = document.getElementById('config-data-mode-copy');
    const saveStatus = document.getElementById('settings-save-status');
    const muteInput = document.getElementById('config-silenciar-ingreso');
    const audioStatus = document.getElementById('config-audio-status');
    const audioButtons = [document.getElementById('config-cargar-ingreso'), document.getElementById('config-cargar-vencido')];
    let audioPreferences = {muted: true, sounds: {}};
    function updateAudioControls(preferences = audioPreferences) {
      audioPreferences = preferences;
      muteInput.checked = preferences.muted !== false;
      ['success', 'expired'].forEach((kind, index) => {
        const filename = document.getElementById(`config-audio-${kind}-name`);
        filename.textContent = preferences.sounds?.[kind]?.name || 'Sin sonido';
        filename.title = filename.textContent;
        audioButtons[index].textContent = preferences.sounds?.[kind] ? 'Cambiar sonido' : 'Cargar sonido';
        audioButtons[index].setAttribute('aria-label', `${audioButtons[index].textContent}: ${index === 0 ? 'ingreso permitido' : 'membresía vencida'}`);
      });
    }
    audioButtons.forEach((button, index) => button.addEventListener('click', async () => {
      audioButtons.forEach(item => { item.disabled = true; });
      muteInput.disabled = true;
      try {
        const preferences = await window.api.cargarSonidoIngreso(index === 0 ? 'success' : 'expired');
        if (!preferences) return; // Closing the picker leaves the existing selection untouched.
        updateAudioControls(preferences);
        audioStatus.textContent = preferences.muted ? 'Audio guardado. Desactivá el silencio para escucharlo al ingresar.' : 'Audio guardado en esta PC.';
      } catch (error) {
        audioStatus.textContent = (error.message || 'No se pudo cargar el audio.').replace(/^Error invoking remote method '[^']+': Error: /, '');
      } finally {
        audioButtons.forEach(item => { item.disabled = false; });
        muteInput.disabled = false;
      }
    }));
    muteInput.addEventListener('change', async () => {
      const muted = muteInput.checked;
      muteInput.disabled = true;
      audioButtons.forEach(button => { button.disabled = true; });
      try {
        if (!window.api?.guardarSonidosIngreso) throw new Error('No disponible');
        updateAudioControls(await window.api.guardarSonidosIngreso(muted));
        audioStatus.textContent = muted ? 'Sonidos silenciados en esta PC.' : 'Sonidos de ingreso activados en esta PC.';
      } catch (_) {
        updateAudioControls();
        audioStatus.textContent = 'No se pudo guardar el silencio. Volvé a intentarlo.';
      } finally { muteInput.disabled = false; audioButtons.forEach(button => { button.disabled = false; }); }
    });
    async function loadAudioPreferences() {
      muteInput.disabled = true;
      audioButtons.forEach(button => { button.disabled = true; });
      try {
        const preferences = await window.api?.obtenerSonidosIngreso?.();
        updateAudioControls(preferences || {muted: true, sounds: {}});
        audioStatus.textContent = 'Opcionales · MP3, WAV, OGG o M4A · Hasta 10 MB. Se reproducen hasta 2 segundos.';
      } catch (_) {
        updateAudioControls({muted: true, sounds: {}});
        audioStatus.textContent = 'No se pudo cargar el ajuste de sonido. Volvé a abrir Configuración.';
        return;
      }
      muteInput.disabled = false;
      audioButtons.forEach(button => { button.disabled = false; });
    }
    function updateEventFields() {
      modalBody.querySelectorAll('.config-event-fields input').forEach(input => {
        input.disabled = !inputEventoRunningActivo.checked;
        input.required = inputEventoRunningActivo.checked;
      });
    }
    inputEventoRunningActivo.addEventListener('change', async () => {
      updateEventFields();
      // A new event remains a draft until its required fields are saved.
      if (previousEvent || !window.api?.guardarConfiguracionNegocio) return;
      const enabled = inputEventoRunningActivo.checked;
      inputEventoRunningActivo.disabled = true;
      saveBusinessButton.disabled = true;
      saveStatus.textContent = 'Actualizando evento…';
      try {
        const info = await window.api.obtenerInfoSistema();
        await window.api.guardarConfiguracionNegocio({ ...info.settings, eventoRunningActivo: enabled });
        saveStatus.textContent = enabled ? 'Evento activado' : 'Evento desactivado';
      } catch (error) {
        inputEventoRunningActivo.checked = !enabled;
        updateEventFields();
        saveStatus.textContent = 'No se pudo actualizar el evento. Volvé a intentarlo.';
      } finally {
        inputEventoRunningActivo.disabled = false;
        saveBusinessButton.disabled = false;
      }
    });

    async function cargarInfoSistema() {
      void loadAudioPreferences();
      previousEvent = null;
      eventDraft.hidden = true;
      saveStatus.textContent = '';
      saveBusinessButton.disabled = true;
      if (!window.api?.obtenerInfoSistema) {
        inputEventoRunningFecha.value = '2026-05-24';
        inputDbPath.value = 'C:\\Under-Fit\\datos\\under-fit.db';
        inputBackupPath.value = 'C:\\Under-Fit\\respaldos';
        backupStatus.textContent = 'Vista previa. Los respaldos se crean desde la app.';
        saveBusinessButton.disabled = false;
        updateEventFields();
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
        inputEventoRunningLeyenda.value = info?.settings?.eventoRunningLeyenda || 'ya falta menos';
        inputDbPath.value = info?.dbPath || '';
        inputBackupPath.value = info?.backupDir || '';
        const postgres = info?.dataMode === 'api';
        dataModeTitle.textContent = postgres ? 'PostgreSQL activo' : 'Modo SQLite local';
        dataModeCopy.textContent = postgres
          ? 'La aplicación de escritorio está conectada al servicio .NET y PostgreSQL.'
          : 'La aplicación continúa usando la base SQLite local.';
        backupStatus.textContent = postgres ? 'Crea un respaldo de la base PostgreSQL de esta instalación.' : 'Respaldo local de los datos de esta instalación.';
        saveBusinessButton.disabled = false;
        updateEventFields();
      } catch (error) {
        console.error(error);
        saveStatus.textContent = 'No se pudo cargar. Volvé a abrir Configuración.';
      }
    }

    btnOpenSettings?.addEventListener('click', cargarInfoSistema);
    document.addEventListener('admin-settings:show', cargarInfoSistema);
    modalBody.addEventListener('submit', async event => {
      event.preventDefault();
      if (saveBusinessButton.disabled || !modalBody.reportValidity()) return;
      if (!window.api?.guardarConfiguracionNegocio) {
        saveStatus.textContent = 'Vista previa: no se guardaron cambios.';
        return;
      }
      try {
        saveBusinessButton.disabled = true;
        saveBusinessButton.textContent = 'Guardando…';
        saveStatus.textContent = '';
        await window.api.guardarConfiguracionNegocio({
          precioInscripcion: Number(inputPrecioInscripcion.value || 0),
          precioMembresiaMensual: Number(inputPrecioMembresiaMensual.value || 0),
          precioMembresiaTrimestral: Number(inputPrecioMembresiaTrimestral.value || 0),
          precioMembresiaSemestral: Number(inputPrecioMembresiaSemestral.value || 0),
          eventoRunningActivo: inputEventoRunningActivo.checked,
          eventoRunningNombre: inputEventoRunningNombre.value.trim(),
          eventoRunningDistancias: inputEventoRunningDistancias.value.trim(),
          eventoRunningFecha: inputEventoRunningFecha.value,
          eventoRunningLeyenda: inputEventoRunningLeyenda.value.trim(),
        });
        previousEvent = null;
        eventDraft.hidden = true;
        saveStatus.textContent = 'Cambios guardados';
        shared.mostrarNotificacion('Configuración actualizada', 'success');
      } catch (error) {
        console.error(error);
        saveStatus.textContent = 'No se pudieron guardar los cambios.';
        shared.mostrarNotificacion('No se pudo guardar la configuración', 'error');
      } finally { saveBusinessButton.disabled = false; saveBusinessButton.textContent = 'Guardar cambios'; }
    });
    backupButton.addEventListener('click', async () => {
      if (backupButton.disabled) return;
      if (!window.api?.crearBackupManual) {
        backupStatus.textContent = 'Vista previa: el respaldo se creará desde la aplicación de escritorio.';
        return;
      }
      try {
        backupButton.disabled = true;
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
      } finally { backupButton.disabled = false; }
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

  const systemStatus = document.getElementById('system-status');
  const systemStatusTitle = document.getElementById('system-status-title');
  const systemStatusCopy = document.getElementById('system-status-copy');
  async function updateSystemStatus() {
    if (!systemStatus || !systemStatusTitle || !systemStatusCopy) return;
    systemStatus.classList.remove('is-connected', 'is-offline');
    systemStatus.classList.add('is-connecting');
    systemStatusTitle.textContent = 'Conectando';
    systemStatusCopy.textContent = 'Verificando servicios';
    try {
      if (window.api?.obtenerInfoSistema) await window.api.obtenerInfoSistema();
      systemStatus.classList.remove('is-connecting', 'is-offline');
      systemStatus.classList.add('is-connected');
      systemStatusTitle.textContent = 'Conectado';
      systemStatusCopy.textContent = 'Sistema operativo';
    } catch (error) {
      systemStatus.classList.remove('is-connecting', 'is-connected');
      systemStatus.classList.add('is-offline');
      systemStatusTitle.textContent = 'Sin conexión';
      systemStatusCopy.textContent = 'Servicio no disponible';
    }
  }
  updateSystemStatus();

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
  window.createAdminRecordsController({ shared }).init();
  try {
    await window.createAdminOperationsController({ shared }).init();
  } catch (error) {
    console.error('No se pudieron inicializar las operaciones multi-local:', error);
  }
});
