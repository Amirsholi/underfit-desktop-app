(function () {
  const api = window.api || null;
  const loginScreen = document.getElementById('tablet-login');
  const workspace = document.getElementById('tablet-workspace');
  const locationSelect = document.getElementById('tablet-location-select');
  const professorList = document.getElementById('tablet-professor-list');
  const loginPin = document.getElementById('tablet-login-pin');
  const loginSubmit = document.getElementById('tablet-login-submit');
  const loginMessage = document.getElementById('tablet-login-message');
  const classPicker = document.getElementById('tablet-class-picker');
  const classOptions = document.getElementById('tablet-class-options');
  const sessionProfessor = document.getElementById('tablet-session-professor');
  const sessionAvatar = document.getElementById('tablet-session-avatar');
  const classState = document.getElementById('tablet-class-state');
  const className = document.getElementById('tablet-class-name');
  const classMeta = document.getElementById('tablet-class-meta');
  const attendanceCount = document.getElementById('tablet-attendance-count');
  const entryDisplay = document.getElementById('tablet-entry-display');
  const entrySubmit = document.getElementById('tablet-entry-submit');
  const entryFeedback = document.getElementById('tablet-entry-feedback');
  const entryTitle = document.getElementById('tablet-entry-title');
  const entryCopy = document.getElementById('tablet-entry-copy');
  const saleModal = document.getElementById('tablet-sale-modal');
  const openSaleButton = document.getElementById('tablet-open-sale');
  const closeSaleButton = document.getElementById('tablet-close-sale');
  const productGrid = document.getElementById('tablet-product-grid');
  const memberSearch = document.getElementById('tablet-member-search');
  const memberResults = document.getElementById('tablet-member-results');
  const saleLocal = document.getElementById('tablet-sale-local');
  const saleProductName = document.getElementById('tablet-sale-product-name');
  const saleMemberName = document.getElementById('tablet-sale-member-name');
  const saleQuantity = document.getElementById('tablet-sale-quantity');
  const saleTotal = document.getElementById('tablet-sale-total');
  const saleSubmit = document.getElementById('tablet-sale-submit');
  const quantityMinus = document.getElementById('tablet-quantity-minus');
  const quantityPlus = document.getElementById('tablet-quantity-plus');
  const toast = document.getElementById('tablet-toast');
  const ratingsModal = document.getElementById('tablet-ratings-modal');
  const openRatingsButton = document.getElementById('tablet-open-ratings');
  const closeRatingsButton = document.getElementById('tablet-close-ratings');
  const ratingClasses = document.getElementById('tablet-rating-classes');
  const ratingRoster = document.getElementById('tablet-rating-roster');

  const state = {
    deviceId: getDeviceId(),
    localId: Number(localStorage.getItem('underfit-tablet-local') || 2),
    locations: [],
    professors: [],
    selectedProfessorId: null,
    session: null,
    activeClass: null,
    upcomingClass: null,
    classCandidates: [],
    classMembers: [],
    attendanceCount: 0,
    entryDigits: '',
    users: [],
    stock: [],
    selectedProduct: null,
    selectedMember: null,
    saleCandidates: [],
    quantity: 1,
    classPoll: null,
    autoLogoutTimer: null,
    isLoggingOut: false,
    feedbackTimer: null,
    toastTimer: null,
    attendanceOperation: null,
    saleOperation: null,
    retryTimer: null,
    processingQueue: false,
  };

  const SESSION_DURATION_MS = 2 * 60 * 60 * 1000;

  function getDeviceId() {
    const stored = localStorage.getItem('underfit-tablet-device');
    if (stored) return stored;
    const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const value = `tablet-${random}`;
    localStorage.setItem('underfit-tablet-device', value);
    return value;
  }

  function newOperationKey() {
    return globalThis.crypto?.randomUUID?.()
      || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
    })[character]);
  }

  function initials(name) {
    return String(name || '?').trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  }

  function money(value) {
    return new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU', maximumFractionDigits: 0 }).format(Number(value || 0));
  }

  function localDateKey() {
    const date = new Date();
    const pad = value => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  async function openRatings() {
    ratingsModal.hidden = false;
    document.body.classList.add('tablet-modal-open');
    ratingClasses.innerHTML = '<span>Cargando clases…</span>';
    ratingRoster.innerHTML = '';
    try {
      const records = api?.obtenerRegistrosClases
        ? await api.obtenerRegistrosClases(localDateKey()) : [];
      const completed = records.filter(item =>
        item.estado === 'dictada' && Number(item.localId) === Number(state.localId));
      ratingClasses.innerHTML = completed.map(item => `
        <button type="button" data-rating-class="${Number(item.id)}"><strong>${escapeHtml(item.nombre)}</strong><small>${escapeHtml(String(item.hora || '').slice(0,5))}</small></button>
      `).join('') || '<span>No hay clases realizadas para calificar hoy.</span>';
      if (completed.length) await loadRatingRoster(completed[0].id);
    } catch (error) {
      ratingClasses.innerHTML = '<span>No se pudieron cargar las clases.</span>';
      showToast(error?.message || 'No se pudieron cargar las clases', 'error');
    }
  }

  function closeRatings() {
    ratingsModal.hidden = true;
    if (saleModal.hidden) document.body.classList.remove('tablet-modal-open');
  }

  async function loadRatingRoster(classId) {
    ratingRoster.innerHTML = '<span>Cargando asistencias…</span>';
    const detail = await api.obtenerDetalleRegistroClase(Number(classId));
    const present = detail.students.filter(item => item.presente);
    ratingRoster.innerHTML = present.map(student => `
      <article><span><strong>${escapeHtml(student.usuarioNombre)}</strong><small>CI ${escapeHtml(student.usuarioCi)}</small></span>
      <span class="tablet-stars">${[1,2,3,4,5].map(score => `<button type="button" data-tablet-rate="${escapeHtml(student.asistenciaId)}" data-class-id="${Number(classId)}" data-score="${score}" class="${Number(student.puntuacion||0)>=score?'is-active':''}">★</button>`).join('')}</span></article>
    `).join('') || '<span>No hay asistencias registradas.</span>';
  }

  async function rateStudent(button) {
    button.disabled = true;
    try {
      await api.puntuarAsistenciaClase({
        asistenciaId: button.dataset.tabletRate,
        puntuacion: Number(button.dataset.score),
        profesorId: state.session.profesorId,
        profesorSesionId: state.session.id,
        dispositivoId: state.deviceId,
      });
      showToast(`Puntuación guardada: ${button.dataset.score}/5`);
      await loadRatingRoster(Number(button.dataset.classId));
    } catch (error) {
      button.disabled = false;
      showToast(error?.message || 'No se pudo guardar la puntuación', 'error');
    }
  }

  function currentLocal() {
    return state.locations.find(item => Number(item.id) === Number(state.localId)) || { id: state.localId, nombre: `Local ${state.localId}` };
  }

  function showToast(message, type = 'success') {
    clearTimeout(state.toastTimer);
    toast.textContent = message;
    toast.className = `tablet-toast is-visible${type === 'error' ? ' is-error' : ''}`;
    state.toastTimer = setTimeout(() => { toast.className = 'tablet-toast'; }, 2600);
  }

  const RETRY_QUEUE_KEY = 'underfit-tablet-retry-queue';

  function readRetryQueue() {
    try {
      const value = JSON.parse(localStorage.getItem(RETRY_QUEUE_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (_) {
      return [];
    }
  }

  function writeRetryQueue(queue) {
    localStorage.setItem(RETRY_QUEUE_KEY, JSON.stringify(queue));
  }

  function isConnectionError(error) {
    return /no se pudo conectar|no respondio|timeout|api\.unavailable|api\.timeout|fetch failed|network/i
      .test(String(error?.message || error || ''));
  }

  function queueRetry(type, payload) {
    const queue = readRetryQueue();
    if (!queue.some(item => item.payload?.idempotencyKey === payload.idempotencyKey)) {
      queue.push({
        id: newOperationKey(),
        type,
        payload,
        createdAt: new Date().toISOString(),
      });
      writeRetryQueue(queue);
    }
  }

  async function processRetryQueue() {
    if (state.processingQueue || !api) return;
    state.processingQueue = true;
    let queue = readRetryQueue();
    let sent = 0;
    try {
      for (const operation of [...queue]) {
        try {
          if (operation.type === 'attendance') {
            await api.registrarAsistenciaClase(operation.payload);
          } else if (operation.type === 'pending-sale') {
            await api.crearVentaPendiente(operation.payload);
          }
          queue = queue.filter(item => item.id !== operation.id);
          writeRetryQueue(queue);
          sent++;
        } catch (error) {
          if (isConnectionError(error)) break;
          queue = queue.filter(item => item.id !== operation.id);
          writeRetryQueue(queue);
          showToast('Una operacion pendiente ya no era valida', 'error');
        }
      }
      if (sent > 0) {
        showToast(`${sent} operacion${sent === 1 ? '' : 'es'} pendiente${sent === 1 ? '' : 's'} enviada${sent === 1 ? '' : 's'}`);
      }
    } finally {
      state.processingQueue = false;
    }
  }

  function demoLocations() {
    return [
      { id: 1, nombre: 'Recepción principal', codigo: 'principal' },
      { id: 2, nombre: 'Salón funcional', codigo: 'funcional' },
    ];
  }

  function demoProfessors() {
    return [
      { id: 1, nombre: 'Santiago Lima', activo: true },
      { id: 2, nombre: 'Valentina Suárez', activo: true },
      { id: 3, nombre: 'Martín Cabrera', activo: true },
    ];
  }

  function demoUsers() {
    return [
      { ci: 49876543, nombre: 'Martina Silva' },
      { ci: 43219876, nombre: 'Bruno Rodríguez' },
      { ci: 51234567, nombre: 'Lucas Pereira' },
      { ci: 56781234, nombre: 'Diego Martínez' },
      { ci: 37654321, nombre: 'Camila Fernández' },
    ];
  }

  function demoStock() {
    return [
      { productoId: 1, nombre: 'Agua mineral 1.5 L', precio: 95, local1: 18, local2: 6 },
      { productoId: 2, nombre: 'Agua mineral 600 ml', precio: 60, local1: 38, local2: 12 },
      { productoId: 3, nombre: 'Agua saborizada 500 ml', precio: 85, local1: 22, local2: 8 },
      { productoId: 4, nombre: 'Barrita de cereal chocolate', precio: 70, local1: 28, local2: 10 },
      { productoId: 5, nombre: 'Barrita de cereal frutos rojos', precio: 70, local1: 24, local2: 8 },
      { productoId: 6, nombre: 'Bebida isotónica 500 ml', precio: 120, local1: 16, local2: 4 },
    ];
  }

  function demoCurrentClass() {
    const now = new Date();
    const pad = value => String(value).padStart(2, '0');
    return {
      id: 701,
      nombre: 'Funcional de la tarde',
      fecha: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      hora: `${pad(now.getHours())}:${pad(Math.floor(now.getMinutes() / 15) * 15)}`,
      duracionMinutos: 60,
      localId: state.localId,
      localNombre: currentLocal().nombre,
      estado: 'en_curso',
    };
  }

  function renderLocations() {
    locationSelect.innerHTML = state.locations.map(location => `<option value="${Number(location.id)}">${escapeHtml(location.nombre)}</option>`).join('');
    if (!state.locations.some(location => Number(location.id) === state.localId)) state.localId = Number(state.locations[0]?.id || 2);
    locationSelect.value = String(state.localId);
  }

  function renderProfessors() {
    professorList.innerHTML = state.professors.map(professor => `
      <button class="tablet-professor-option${Number(professor.id) === Number(state.selectedProfessorId) ? ' is-selected' : ''}" type="button" data-professor-id="${Number(professor.id)}">
        <span>${escapeHtml(initials(professor.nombre))}</span><strong>${escapeHtml(professor.nombre)}</strong>
      </button>
    `).join('') || '<p class="tablet-form-message">No hay profesores activos.</p>';
    updateLoginButton();
  }

  function updateLoginButton() {
    loginSubmit.disabled = !(state.selectedProfessorId && loginPin.value.length === 4);
  }

  function handleLoginKey(key) {
    if (key === 'clear') loginPin.value = '';
    else if (key === 'backspace') loginPin.value = loginPin.value.slice(0, -1);
    else if (/^\d$/.test(key) && loginPin.value.length < 4) loginPin.value += key;
    loginMessage.textContent = '';
    updateLoginButton();
  }

  async function login() {
    if (loginSubmit.disabled) return;
    loginSubmit.disabled = true;
    loginMessage.textContent = 'Iniciando turno…';
    try {
      state.localId = Number(locationSelect.value);
      localStorage.setItem('underfit-tablet-local', String(state.localId));
      state.session = api?.iniciarSesionProfesor
        ? await api.iniciarSesionProfesor({
            profesorId: state.selectedProfessorId,
            pin: loginPin.value,
            localId: state.localId,
            dispositivoId: state.deviceId,
          })
        : {
            id: 900,
            profesorId: state.selectedProfessorId,
            profesorNombre: state.professors.find(item => Number(item.id) === Number(state.selectedProfessorId))?.nombre,
            localId: state.localId,
            dispositivoId: state.deviceId,
            inicioTs: new Date().toISOString(),
          };
      loginPin.value = '';
      await enterWorkspace();
    } catch (error) {
      loginMessage.textContent = String(error?.message || 'No se pudo iniciar el turno').replace(/^Error invoking remote method '[^']+': Error: /, '');
      updateLoginButton();
    }
  }

  async function restoreSession() {
    if (!api?.obtenerSesionProfesorActiva) return false;
    try {
      const session = await api.obtenerSesionProfesorActiva(state.deviceId);
      if (!session) return false;
      const startedAt = new Date(session.inicioTs || 0).getTime();
      if (Number.isFinite(startedAt) && startedAt > 0 && Date.now() - startedAt >= SESSION_DURATION_MS) {
        try {
          await api.finalizarSesionProfesor(session.id);
        } catch (_) {}
        return false;
      }
      state.session = session;
      state.localId = Number(session.localId);
      await enterWorkspace();
      return true;
    } catch (_) {
      return false;
    }
  }

  async function enterWorkspace() {
    loginScreen.hidden = true;
    workspace.hidden = false;
    state.attendanceCount = 0;
    attendanceCount.textContent = '0';
    sessionProfessor.textContent = state.session.profesorNombre || 'Profesor';
    sessionAvatar.textContent = initials(state.session.profesorNombre);
    saleLocal.textContent = currentLocal().nombre;
    await Promise.all([loadUsers(), loadStock()]);
    await connectToCurrentClass();
    scheduleAutomaticLogout();
    clearInterval(state.classPoll);
    state.classPoll = setInterval(() => {
      if (state.session) connectToCurrentClass();
    }, 30000);
  }

  function scheduleAutomaticLogout(delayOverride = null) {
    clearTimeout(state.autoLogoutTimer);
    if (!state.session) return;
    if (!state.session.inicioTs) state.session.inicioTs = new Date().toISOString();
    const startedAt = new Date(state.session.inicioTs).getTime();
    const remaining = delayOverride ?? Math.max(0, (startedAt + SESSION_DURATION_MS) - Date.now());
    state.autoLogoutTimer = setTimeout(() => logout({ automatic: true }), remaining);
  }

  async function connectToCurrentClass() {
    try {
      const current = api?.obtenerClaseActual
        ? await api.obtenerClaseActual({ localId: state.localId })
        : { clase: demoCurrentClass(), candidatas: [demoCurrentClass()], requiereSeleccion: false };
      state.classCandidates = current.candidatas || [];
      state.upcomingClass = current.proxima || null;
      if (current.requiereSeleccion) {
        const selected = state.classCandidates.find(item => Number(item.id) === Number(state.activeClass?.id));
        if (selected) {
          selectClass(selected);
          return;
        }
        renderClassPicker(state.classCandidates);
        return;
      }
      if (current.clase) {
        selectClass(current.clase);
        return;
      }
      if (state.activeClass) {
        state.attendanceCount = 0;
        attendanceCount.textContent = '0';
      }
      state.activeClass = null;
      state.classMembers = [];
      classPicker.hidden = true;
      renderCurrentClass();
    } catch (error) {
      state.activeClass = null;
      renderCurrentClass();
      showToast(error?.message || 'No se pudo consultar la clase actual', 'error');
    }
  }

  function renderClassPicker(classes) {
    classOptions.innerHTML = classes.map(item => `
      <button type="button" data-select-class="${Number(item.id)}"><strong>${escapeHtml(item.nombre)}</strong><small>${escapeHtml(String(item.hora || '').slice(0, 5))} · ${Number(item.duracionMinutos || 60)} min</small></button>
    `).join('');
    classPicker.hidden = false;
  }

  function selectClass(selected) {
    if (Number(state.activeClass?.id) !== Number(selected?.id)) {
      state.attendanceCount = 0;
      attendanceCount.textContent = '0';
    }
    state.activeClass = selected;
    classPicker.hidden = true;
    renderCurrentClass();
    loadClassMembers();
  }

  function formatUpcomingClass(item) {
    if (!item) return 'No hay otra clase programada';
    const date = new Date(`${item.fecha}T${item.hora || '00:00'}`);
    const label = Number.isNaN(date.getTime())
      ? `${item.fecha || ''} · ${String(item.hora || '').slice(0, 5)}`
      : new Intl.DateTimeFormat('es-UY', { weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
    const professor = state.session?.profesorNombre ? ` · Prof. ${state.session.profesorNombre}` : '';
    return `${label} · ${currentLocal().nombre}${professor}`;
  }

  function renderCurrentClass() {
    if (!state.activeClass) {
      classState.textContent = 'Próxima clase';
      classState.classList.add('is-idle');
      className.textContent = state.upcomingClass?.nombre || 'No hay clases programadas';
      classMeta.textContent = formatUpcomingClass(state.upcomingClass);
      entrySubmit.disabled = true;
      state.entryDigits = '';
      entryDisplay.value = '';
      resetEntryFeedback();
      return;
    }
    const inProgress = state.activeClass.estado === 'en_curso';
    classState.textContent = inProgress ? 'Clase en curso' : 'Próxima clase';
    classState.classList.toggle('is-idle', !inProgress);
    className.textContent = state.activeClass.nombre;
    const professor = state.session?.profesorNombre ? ` · Prof. ${state.session.profesorNombre}` : '';
    classMeta.textContent = `${String(state.activeClass.hora || '').slice(0, 5)} · ${Number(state.activeClass.duracionMinutos || 60)} min · ${currentLocal().nombre}${professor}`;
    entrySubmit.disabled = false;
    resetEntryFeedback();
  }

  function handleEntryKey(key) {
    if (key === 'clear') state.entryDigits = '';
    else if (key === 'backspace') state.entryDigits = state.entryDigits.slice(0, -1);
    else if (/^\d$/.test(key) && state.entryDigits.length < 8) state.entryDigits += key;
    entryDisplay.value = state.entryDigits;
    if (!entryFeedback.classList.contains('is-success') && !entryFeedback.classList.contains('is-error')) return;
    resetEntryFeedback();
  }

  function resetEntryFeedback() {
    clearTimeout(state.feedbackTimer);
    entryFeedback.classList.remove('is-success', 'is-error');
    entryFeedback.hidden = true;
    entryTitle.textContent = '';
    entryCopy.textContent = '';
  }

  async function registerAttendance() {
    if (!state.activeClass) return showToast('No hay una clase activa', 'error');
    if (state.entryDigits.length < 6) return showToast('Ingresá un documento válido', 'error');
    const ci = state.entryDigits;
    const attendanceSignature = `${state.activeClass.id}:${ci}`;
    if (state.attendanceOperation?.signature !== attendanceSignature) {
      state.attendanceOperation = {
        signature: attendanceSignature,
        key: newOperationKey(),
      };
    }
    const attendancePayload = {
      ci,
      claseId: state.activeClass.id,
      profesorSesionId: state.session.id,
      localId: state.localId,
      dispositivoId: state.deviceId,
      idempotencyKey: state.attendanceOperation.key,
    };
    entrySubmit.disabled = true;
    try {
      const result = api?.registrarAsistenciaClase
        ? await api.registrarAsistenciaClase(attendancePayload)
        : { registered: true, user: demoUsers().find(item => String(item.ci) === ci) || { ci, nombre: 'Martina Silva' } };
      if (!result.registered) throw new Error('No se pudo registrar la asistencia');
      state.attendanceCount += 1;
      attendanceCount.textContent = String(state.attendanceCount);
      entryFeedback.classList.remove('is-error');
      entryFeedback.classList.add('is-success');
      entryFeedback.hidden = false;
      entryTitle.textContent = 'Ingreso registrado';
      entryCopy.textContent = result.user?.nombre || 'Socio';
      state.entryDigits = '';
      state.attendanceOperation = null;
      entryDisplay.value = '';
      state.feedbackTimer = setTimeout(resetEntryFeedback, 1800);
      loadClassMembers();
    } catch (error) {
      if (isConnectionError(error)) {
        queueRetry('attendance', attendancePayload);
        entryFeedback.classList.remove('is-error');
        entryFeedback.classList.add('is-success');
        entryFeedback.hidden = false;
        entryTitle.textContent = 'Ingreso guardado';
        entryCopy.textContent = 'Se enviara cuando vuelva la conexion';
        state.entryDigits = '';
        state.attendanceOperation = null;
        entryDisplay.value = '';
        state.feedbackTimer = setTimeout(resetEntryFeedback, 2300);
        return;
      }
      entryFeedback.classList.remove('is-success');
      entryFeedback.classList.add('is-error');
      entryFeedback.hidden = false;
      entryTitle.textContent = 'No se pudo registrar';
      entryCopy.textContent = String(error?.message || 'Revisá el documento').replace(/^Error invoking remote method '[^']+': Error: /, '');
      state.entryDigits = '';
      entryDisplay.value = '';
      state.feedbackTimer = setTimeout(resetEntryFeedback, 2300);
    } finally {
      entrySubmit.disabled = !state.activeClass;
    }
  }

  async function loadUsers() {
    try {
      state.users = api?.obtenerUsuarios ? await api.obtenerUsuarios() : demoUsers();
    } catch (_) {
      state.users = [];
    }
  }

  function stockAmount(item) {
    if (item.activo !== undefined) return Number(item.activo) === 0 ? 0 : 1;
    return Number(state.localId === 1 ? item.local1 : item.local2 || 0);
  }

  async function loadStock() {
    try {
      const stock = api?.obtenerStockLocales ? await api.obtenerStockLocales() : demoStock();
      state.stock = state.localId === 2
        ? stock.filter(item => Number(item.asignadoLocal2 ?? 1) === 1)
        : stock;
    } catch (_) {
      state.stock = [];
    }
    renderProducts();
  }

  function renderProducts() {
    productGrid.innerHTML = state.stock.map(item => {
      const amount = stockAmount(item);
      return `
        <button class="tablet-product-card${Number(state.selectedProduct?.productoId) === Number(item.productoId) ? ' is-selected' : ''}" type="button" data-product-id="${Number(item.productoId)}" ${amount <= 0 ? 'disabled' : ''}>
          <span><strong>${escapeHtml(item.nombre)}</strong><small>${money(item.precio)}</small></span><b>${item.activo !== undefined ? 'Disponible' : amount}</b>
        </button>
      `;
    }).join('') || '<p class="tablet-form-message">No hay productos disponibles.</p>';
  }

  async function loadClassMembers() {
    if (!state.activeClass) {
      state.classMembers = [];
      return;
    }
    try {
      const detail = api?.obtenerDetalleRegistroClase
        ? await api.obtenerDetalleRegistroClase(state.activeClass.id)
        : { students: demoUsers().slice(0, 3).map((user, index) => ({ usuarioCi: user.ci, usuarioNombre: user.nombre, presente: index < 2 })) };
      state.classMembers = Array.isArray(detail?.students) ? detail.students : [];
    } catch (_) {
      state.classMembers = [];
    }
  }

  function hasActiveMembership(user) {
    if (!user?.fecha_vencimiento) return true;
    const expiration = new Date(`${user.fecha_vencimiento}T23:59:59`);
    return !Number.isNaN(expiration.getTime()) && expiration >= new Date();
  }

  function searchMembers() {
    const query = memberSearch.value.trim().toLocaleLowerCase('es');
    const presentIds = new Set(state.classMembers.filter(item => item.presente).map(item => Number(item.usuarioCi)));
    const ordered = [...state.users]
      .filter(hasActiveMembership)
      .sort((a, b) => Number(presentIds.has(Number(b.ci))) - Number(presentIds.has(Number(a.ci))) || String(a.nombre).localeCompare(String(b.nombre), 'es'));
    const matches = ordered
      .filter(user => query.length < 2 ? presentIds.has(Number(user.ci)) : String(user.ci).includes(query) || String(user.nombre || '').toLocaleLowerCase('es').includes(query))
      .slice(0, 8);
    state.saleCandidates = matches;
    memberResults.innerHTML = matches.map(user => `
      <button class="tablet-member-result${Number(state.selectedMember?.ci) === Number(user.ci) ? ' is-selected' : ''}" type="button" data-member-ci="${Number(user.ci)}"><span><strong>${escapeHtml(user.nombre)}</strong><small>CI ${escapeHtml(user.ci)}</small></span><em>${presentIds.has(Number(user.ci)) ? 'Ingresó a clase' : 'Socio activo'}</em><i class="fa-solid fa-chevron-right"></i></button>
    `).join('');
    if (!matches.length) memberResults.innerHTML = `<p class="tablet-form-message">${query.length < 2 ? 'Buscá un socio activo por nombre o CI.' : 'No se encontraron socios activos.'}</p>`;
  }

  function updateSaleSummary() {
    saleProductName.textContent = state.selectedProduct?.nombre || 'Sin seleccionar';
    saleMemberName.textContent = state.selectedMember?.nombre || 'Sin seleccionar';
    saleQuantity.textContent = String(state.quantity);
    saleTotal.textContent = money(Number(state.selectedProduct?.precio || 0) * state.quantity);
    saleSubmit.disabled = !(state.selectedProduct && state.selectedMember && stockAmount(state.selectedProduct) >= state.quantity);
    renderProducts();
  }

  function resetSale() {
    state.selectedProduct = null;
    state.selectedMember = null;
    state.quantity = 1;
    state.saleOperation = null;
    memberSearch.value = '';
    memberResults.innerHTML = '';
    updateSaleSummary();
  }

  async function openSale() {
    resetSale();
    saleModal.hidden = false;
    document.body.classList.add('tablet-modal-open');
    await Promise.all([loadUsers(), loadStock(), loadClassMembers()]);
    searchMembers();
  }

  function closeSale() {
    saleModal.hidden = true;
    document.body.classList.remove('tablet-modal-open');
    resetSale();
  }

  async function submitSale() {
    if (saleSubmit.disabled) return;
    const saleSignature = [
      state.selectedProduct.productoId,
      state.selectedMember.ci,
      state.quantity,
      state.session.id,
      state.localId,
    ].join(':');
    if (state.saleOperation?.signature !== saleSignature) {
      state.saleOperation = { signature: saleSignature, key: newOperationKey() };
    }
    const salePayload = {
      productoId: state.selectedProduct.productoId,
      usuarioCi: state.selectedMember.ci,
      cantidad: state.quantity,
      profesorSesionId: state.session.id,
      localId: state.localId,
      idempotencyKey: state.saleOperation.key,
    };
    saleSubmit.disabled = true;
    try {
      await (api?.crearVentaPendiente
        ? api.crearVentaPendiente(salePayload)
        : Promise.resolve({ id: Date.now() }));
      const memberName = state.selectedMember.nombre;
      showToast(`Venta enviada · queda pendiente para ${memberName}`);
      await loadStock();
      closeSale();
    } catch (error) {
      if (isConnectionError(error)) {
        const memberName = state.selectedMember.nombre;
        queueRetry('pending-sale', salePayload);
        showToast(`Venta guardada para ${memberName}; se enviara al volver la conexion`);
        closeSale();
        return;
      }
      showToast(String(error?.message || 'No se pudo enviar la venta').replace(/^Error invoking remote method '[^']+': Error: /, ''), 'error');
      updateSaleSummary();
    }
  }

  async function logout({ automatic = false } = {}) {
    if (!state.session || state.isLoggingOut) return;
    state.isLoggingOut = true;
    try {
      if (api?.finalizarSesionProfesor) await api.finalizarSesionProfesor(state.session.id);
    } catch (error) {
      showToast(automatic ? 'No se pudo cerrar el turno; se reintentará automáticamente.' : (error?.message || 'No se pudo cerrar el turno'), 'error');
      state.isLoggingOut = false;
      if (automatic) scheduleAutomaticLogout(60000);
      return;
    }
    clearInterval(state.classPoll);
    clearTimeout(state.autoLogoutTimer);
    state.session = null;
    state.activeClass = null;
    state.upcomingClass = null;
    state.selectedProfessorId = null;
    saleModal.hidden = true;
    document.body.classList.remove('tablet-modal-open');
    resetSale();
    workspace.hidden = true;
    loginScreen.hidden = false;
    loginMessage.textContent = '';
    renderProfessors();
    state.isLoggingOut = false;
  }

  function bindEvents() {
    professorList.addEventListener('click', event => {
      const button = event.target.closest('[data-professor-id]');
      if (!button) return;
      state.selectedProfessorId = Number(button.dataset.professorId);
      renderProfessors();
    });
    locationSelect.addEventListener('change', () => {
      state.localId = Number(locationSelect.value);
      localStorage.setItem('underfit-tablet-local', String(state.localId));
    });
    document.querySelector('.tablet-login-keypad').addEventListener('click', event => {
      const button = event.target.closest('[data-login-key]');
      if (button) handleLoginKey(button.dataset.loginKey);
    });
    loginSubmit.addEventListener('click', login);
    document.querySelector('.tablet-entry-keypad').addEventListener('click', event => {
      const button = event.target.closest('[data-entry-key]');
      if (button) handleEntryKey(button.dataset.entryKey);
    });
    entrySubmit.addEventListener('click', registerAttendance);
    classOptions.addEventListener('click', event => {
      const button = event.target.closest('[data-select-class]');
      if (!button) return;
      const selected = state.classCandidates.find(item => Number(item.id) === Number(button.dataset.selectClass));
      if (selected) selectClass(selected);
    });
    openSaleButton.addEventListener('click', openSale);
    openRatingsButton.addEventListener('click', openRatings);
    closeRatingsButton.addEventListener('click', closeRatings);
    ratingClasses.addEventListener('click', event => {
      const button = event.target.closest('[data-rating-class]');
      if (button) loadRatingRoster(Number(button.dataset.ratingClass));
    });
    ratingRoster.addEventListener('click', event => {
      const button = event.target.closest('[data-tablet-rate]');
      if (button) rateStudent(button);
    });
    ratingsModal.addEventListener('click', event => {
      if (event.target === ratingsModal) closeRatings();
    });
    closeSaleButton.addEventListener('click', closeSale);
    saleModal.addEventListener('click', event => {
      if (event.target === saleModal) closeSale();
    });
    productGrid.addEventListener('click', event => {
      const button = event.target.closest('[data-product-id]');
      if (!button) return;
      state.selectedProduct = state.stock.find(item => Number(item.productoId) === Number(button.dataset.productId)) || null;
      state.quantity = 1;
      updateSaleSummary();
    });
    memberSearch.addEventListener('input', () => {
      state.selectedMember = null;
      searchMembers();
      updateSaleSummary();
    });
    memberResults.addEventListener('click', event => {
      const button = event.target.closest('[data-member-ci]');
      if (!button) return;
      state.selectedMember = state.users.find(item => Number(item.ci) === Number(button.dataset.memberCi)) || null;
      memberSearch.value = state.selectedMember?.nombre || '';
      searchMembers();
      updateSaleSummary();
    });
    quantityMinus.addEventListener('click', () => { state.quantity = Math.max(1, state.quantity - 1); updateSaleSummary(); });
    quantityPlus.addEventListener('click', () => {
      if (!state.selectedProduct) return;
      state.quantity = Math.max(1, Math.min(stockAmount(state.selectedProduct), state.quantity + 1));
      updateSaleSummary();
    });
    saleSubmit.addEventListener('click', submitSale);
    window.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !ratingsModal.hidden) {
        closeRatings();
        return;
      }
      if (event.key === 'Escape' && !saleModal.hidden) {
        closeSale();
        return;
      }
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
      if (!saleModal.hidden) return;
      if (!workspace.hidden) {
        if (/^\d$/.test(event.key)) handleEntryKey(event.key);
        if (event.key === 'Backspace') handleEntryKey('backspace');
        if (event.key === 'Enter') registerAttendance();
      }
    });
    window.addEventListener('beforeunload', () => {
      clearInterval(state.classPoll);
      clearInterval(state.retryTimer);
      clearTimeout(state.autoLogoutTimer);
    });
    window.addEventListener('online', processRetryQueue);
  }

  async function init() {
    bindEvents();
    try {
      [state.locations, state.professors] = await Promise.all([
        api?.obtenerLocales ? api.obtenerLocales() : demoLocations(),
        api?.obtenerProfesores ? api.obtenerProfesores(false) : demoProfessors(),
      ]);
    } catch (error) {
      state.locations = demoLocations();
      state.professors = demoProfessors();
      loginMessage.textContent = 'No se pudieron cargar los datos; revisá la conexión.';
    }
    renderLocations();
    renderProfessors();
    await restoreSession();
    await processRetryQueue();
    state.retryTimer = setInterval(processRetryQueue, 10000);
  }

  init();
})();
