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
  const logoutButton = document.getElementById('tablet-logout');
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
  const stockBody = document.getElementById('tablet-stock-body');
  const stockRefresh = document.getElementById('tablet-stock-refresh');
  const toast = document.getElementById('tablet-toast');

  const state = {
    deviceId: getDeviceId(),
    localId: Number(localStorage.getItem('underfit-tablet-local') || 2),
    locations: [],
    professors: [],
    selectedProfessorId: null,
    session: null,
    activeClass: null,
    attendanceCount: 0,
    entryDigits: '',
    users: [],
    stock: [],
    selectedProduct: null,
    selectedMember: null,
    quantity: 1,
    classPoll: null,
    feedbackTimer: null,
    toastTimer: null,
  };

  function getDeviceId() {
    const stored = localStorage.getItem('underfit-tablet-device');
    if (stored) return stored;
    const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const value = `tablet-${random}`;
    localStorage.setItem('underfit-tablet-device', value);
    return value;
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

  function currentLocal() {
    return state.locations.find(item => Number(item.id) === Number(state.localId)) || { id: state.localId, nombre: `Local ${state.localId}` };
  }

  function showToast(message, type = 'success') {
    clearTimeout(state.toastTimer);
    toast.textContent = message;
    toast.className = `tablet-toast is-visible${type === 'error' ? ' is-error' : ''}`;
    state.toastTimer = setTimeout(() => { toast.className = 'tablet-toast'; }, 2600);
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
      estado: 'programada',
    };
  }

  function updateClock() {
    document.getElementById('tablet-clock').textContent = new Date().toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' });
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
    clearInterval(state.classPoll);
    state.classPoll = setInterval(() => {
      if (state.session && !state.activeClass) connectToCurrentClass();
    }, 30000);
  }

  async function connectToCurrentClass() {
    try {
      const current = api?.obtenerClaseActual
        ? await api.obtenerClaseActual({ localId: state.localId })
        : { clase: demoCurrentClass(), candidatas: [demoCurrentClass()], requiereSeleccion: false };
      if (current.requiereSeleccion) {
        renderClassPicker(current.candidatas || []);
        return;
      }
      if (current.clase) {
        await beginClass(current.clase.id, current.clase);
        return;
      }
      state.activeClass = null;
      renderCurrentClass();
    } catch (error) {
      state.activeClass = null;
      renderCurrentClass();
      showToast(error?.message || 'No se pudo consultar la clase actual', 'error');
    }
  }

  function renderClassPicker(classes) {
    classOptions.innerHTML = classes.map(item => `
      <button type="button" data-start-class="${Number(item.id)}"><strong>${escapeHtml(item.nombre)}</strong><small>${escapeHtml(String(item.hora || '').slice(0, 5))} · ${Number(item.duracionMinutos || 60)} min</small></button>
    `).join('');
    classPicker.hidden = false;
  }

  async function beginClass(classId, fallbackClass = null) {
    const result = api?.iniciarClase
      ? await api.iniciarClase({
          claseId: classId,
          profesorSesionId: state.session.id,
          localId: state.localId,
          dispositivoId: state.deviceId,
        })
      : { started: true, class: { ...(fallbackClass || demoCurrentClass()), estado: 'en_curso' } };
    if (result.requiereSeleccion) {
      renderClassPicker(result.candidatas || []);
      return;
    }
    state.activeClass = result.class;
    classPicker.hidden = true;
    renderCurrentClass();
  }

  function renderCurrentClass() {
    if (!state.activeClass) {
      classState.textContent = 'Sin clase vigente';
      classState.classList.add('is-idle');
      className.textContent = 'Esperando próxima clase';
      classMeta.textContent = `${currentLocal().nombre} · se actualizará automáticamente`;
      entrySubmit.disabled = true;
      entryTitle.textContent = 'Aún no hay una clase activa';
      entryCopy.textContent = 'La pantalla quedará habilitada al entrar en la franja programada.';
      return;
    }
    classState.textContent = 'Clase en curso';
    classState.classList.remove('is-idle');
    className.textContent = state.activeClass.nombre;
    classMeta.textContent = `${String(state.activeClass.hora || '').slice(0, 5)} · ${currentLocal().nombre}`;
    entrySubmit.disabled = false;
    resetEntryFeedback();
  }

  function handleEntryKey(key) {
    if (key === 'clear') state.entryDigits = '';
    else if (key === 'backspace') state.entryDigits = state.entryDigits.slice(0, -1);
    else if (/^\d$/.test(key) && state.entryDigits.length < 8) state.entryDigits += key;
    entryDisplay.textContent = state.entryDigits || '—';
    if (!entryFeedback.classList.contains('is-success') && !entryFeedback.classList.contains('is-error')) return;
    resetEntryFeedback();
  }

  function resetEntryFeedback() {
    clearTimeout(state.feedbackTimer);
    entryFeedback.classList.remove('is-success', 'is-error');
    entryTitle.textContent = state.activeClass ? 'Ingresá tu documento' : 'Aún no hay una clase activa';
    entryCopy.textContent = state.activeClass ? 'Marcá tu CI y presioná Ingresar.' : 'La pantalla quedará habilitada al entrar en la franja programada.';
  }

  async function registerAttendance() {
    if (!state.activeClass) return showToast('No hay una clase activa', 'error');
    if (state.entryDigits.length < 6) return showToast('Ingresá un documento válido', 'error');
    const ci = state.entryDigits;
    entrySubmit.disabled = true;
    try {
      const result = api?.registrarAsistenciaClase
        ? await api.registrarAsistenciaClase({
            ci,
            claseId: state.activeClass.id,
            profesorSesionId: state.session.id,
            localId: state.localId,
            dispositivoId: state.deviceId,
          })
        : { registered: true, user: demoUsers().find(item => String(item.ci) === ci) || { ci, nombre: 'Martina Silva' } };
      if (!result.registered) throw new Error('No se pudo registrar la asistencia');
      state.attendanceCount += 1;
      attendanceCount.textContent = String(state.attendanceCount);
      entryFeedback.classList.remove('is-error');
      entryFeedback.classList.add('is-success');
      entryTitle.textContent = 'Ingreso registrado';
      entryCopy.textContent = `${result.user?.nombre || 'Socio'} · ${state.activeClass.nombre}`;
      state.entryDigits = '';
      entryDisplay.textContent = '—';
      state.feedbackTimer = setTimeout(resetEntryFeedback, 1800);
    } catch (error) {
      entryFeedback.classList.remove('is-success');
      entryFeedback.classList.add('is-error');
      entryTitle.textContent = 'No se pudo registrar';
      entryCopy.textContent = String(error?.message || 'Revisá el documento').replace(/^Error invoking remote method '[^']+': Error: /, '');
      state.entryDigits = '';
      entryDisplay.textContent = '—';
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
    return Number(state.localId === 1 ? item.local1 : item.local2 || 0);
  }

  async function loadStock() {
    try {
      state.stock = api?.obtenerStockLocales ? await api.obtenerStockLocales() : demoStock();
    } catch (_) {
      state.stock = [];
    }
    renderProducts();
    renderStock();
  }

  function renderProducts() {
    productGrid.innerHTML = state.stock.map(item => {
      const amount = stockAmount(item);
      return `
        <button class="tablet-product-card${Number(state.selectedProduct?.productoId) === Number(item.productoId) ? ' is-selected' : ''}" type="button" data-product-id="${Number(item.productoId)}" ${amount <= 0 ? 'disabled' : ''}>
          <span><strong>${escapeHtml(item.nombre)}</strong><small>${money(item.precio)}</small></span><b>${amount}</b>
        </button>
      `;
    }).join('') || '<p class="tablet-form-message">No hay productos disponibles.</p>';
  }

  function renderStock() {
    stockBody.innerHTML = state.stock.map(item => `
      <div class="tablet-stock-row"><strong>${escapeHtml(item.nombre)}</strong><span>${money(item.precio)}</span><strong>${stockAmount(item)}</strong></div>
    `).join('') || '<div class="tablet-stock-row"><span>Sin stock cargado</span><span>—</span><strong>0</strong></div>';
  }

  function searchMembers() {
    const query = memberSearch.value.trim().toLocaleLowerCase('es');
    const matches = query.length < 2 ? [] : state.users.filter(user => String(user.ci).includes(query) || String(user.nombre || '').toLocaleLowerCase('es').includes(query)).slice(0, 6);
    memberResults.innerHTML = matches.map(user => `
      <button class="tablet-member-result${Number(state.selectedMember?.ci) === Number(user.ci) ? ' is-selected' : ''}" type="button" data-member-ci="${Number(user.ci)}"><span><strong>${escapeHtml(user.nombre)}</strong><small>CI ${escapeHtml(user.ci)}</small></span><i class="fa-solid fa-chevron-right"></i></button>
    `).join('');
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
    memberSearch.value = '';
    memberResults.innerHTML = '';
    updateSaleSummary();
  }

  async function submitSale() {
    if (saleSubmit.disabled) return;
    saleSubmit.disabled = true;
    try {
      await (api?.crearVentaPendiente
        ? api.crearVentaPendiente({
            productoId: state.selectedProduct.productoId,
            usuarioCi: state.selectedMember.ci,
            cantidad: state.quantity,
            profesorSesionId: state.session.id,
            localId: state.localId,
          })
        : Promise.resolve({ id: Date.now() }));
      const memberName = state.selectedMember.nombre;
      showToast(`Venta enviada · queda pendiente para ${memberName}`);
      await loadStock();
      resetSale();
      showView('attendance');
    } catch (error) {
      showToast(String(error?.message || 'No se pudo enviar la venta').replace(/^Error invoking remote method '[^']+': Error: /, ''), 'error');
      updateSaleSummary();
    }
  }

  function showView(viewId) {
    document.querySelectorAll('[data-tablet-view]').forEach(button => button.classList.toggle('is-active', button.dataset.tabletView === viewId));
    document.querySelectorAll('[data-tablet-panel]').forEach(panel => panel.classList.toggle('is-active', panel.dataset.tabletPanel === viewId));
    if (viewId === 'sale') Promise.all([loadUsers(), loadStock()]);
    if (viewId === 'stock') loadStock();
  }

  async function logout() {
    logoutButton.disabled = true;
    try {
      if (state.activeClass && api?.finalizarClase) {
        await api.finalizarClase({
          claseId: state.activeClass.id,
          profesorSesionId: state.session.id,
          localId: state.localId,
          dispositivoId: state.deviceId,
        });
      }
      if (api?.finalizarSesionProfesor) await api.finalizarSesionProfesor(state.session.id);
    } catch (error) {
      showToast(error?.message || 'No se pudo cerrar el turno', 'error');
      logoutButton.disabled = false;
      return;
    }
    clearInterval(state.classPoll);
    state.session = null;
    state.activeClass = null;
    state.selectedProfessorId = null;
    resetSale();
    workspace.hidden = true;
    loginScreen.hidden = false;
    loginMessage.textContent = '';
    renderProfessors();
    logoutButton.disabled = false;
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
      const button = event.target.closest('[data-start-class]');
      if (button) beginClass(Number(button.dataset.startClass));
    });
    document.querySelectorAll('[data-tablet-view]').forEach(button => button.addEventListener('click', () => showView(button.dataset.tabletView)));
    productGrid.addEventListener('click', event => {
      const button = event.target.closest('[data-product-id]');
      if (!button) return;
      state.selectedProduct = state.stock.find(item => Number(item.productoId) === Number(button.dataset.productId)) || null;
      state.quantity = 1;
      updateSaleSummary();
    });
    memberSearch.addEventListener('input', searchMembers);
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
    stockRefresh.addEventListener('click', loadStock);
    logoutButton.addEventListener('click', logout);
    window.addEventListener('keydown', event => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
      if (!workspace.hidden && document.querySelector('[data-tablet-panel="attendance"]')?.classList.contains('is-active')) {
        if (/^\d$/.test(event.key)) handleEntryKey(event.key);
        if (event.key === 'Backspace') handleEntryKey('backspace');
        if (event.key === 'Enter') registerAttendance();
      }
    });
  }

  async function init() {
    updateClock();
    setInterval(updateClock, 30000);
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
  }

  init();
})();
