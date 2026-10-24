function pendingCashIsReady(summary, date) {
  return Boolean(summary?.sesionAbierta && summary.sesionAbierta.fecha === date);
}

function createAdminOperationsController({ shared }) {
  const classesList = document.getElementById('classes-list');
  const classesEmpty = document.getElementById('classes-empty');
  const classesWeekCount = document.getElementById('classes-week-count');
  const classesEnrolledCount = document.getElementById('classes-enrolled-count');
  const classesProfessorsCount = document.getElementById('classes-professors-count');
  const classEnrollOpen = document.getElementById('class-enroll-open');
  const classesRefresh = document.getElementById('classes-refresh');
  const classesWeekLabel = document.getElementById('classes-week-label');
  const classesDaySummary = document.getElementById('classes-day-summary');
  const classesSelectedDate = document.getElementById('classes-selected-date');
  const classesDayPicker = document.getElementById('classes-day-picker');
  const classesWeekPrev = document.getElementById('classes-week-prev');
  const classesWeekNext = document.getElementById('classes-week-next');
  const classesWeekToday = document.getElementById('classes-week-today');
  const classesOpenProfessors = document.getElementById('classes-open-professors');
  const modalNewClass = document.getElementById('modal-nueva-clase');
  const classSave = document.getElementById('class-save');
  const classCoach = document.getElementById('class-coach');
  const classLocal = document.getElementById('class-local');
  const classEditOpen = document.getElementById('class-edit-open');
  const classEditModal = document.getElementById('modal-editar-clase');
  const classEditSave = document.getElementById('class-edit-save');
  const classEditCoach = document.getElementById('class-edit-coach');
  const classEditLocal = document.getElementById('class-edit-local');
  const professorsList = document.getElementById('professors-list');
  const professorsEmpty = document.getElementById('professors-empty');
  const professorsCount = document.getElementById('professors-count');
  const professorModal = document.getElementById('modal-profesor');
  const professorName = document.getElementById('professor-name');
  const professorSave = document.getElementById('professor-save');
  const openTabletButton = document.getElementById('classes-open-tablet');

  const stockQuantity = document.getElementById('stock-transfer-quantity');
  const stockProduct = document.getElementById('stock-transfer-product');
  const stockAvailability = document.getElementById('stock-transfer-availability');
  const stockTransferSubmit = document.getElementById('stock-transfer-submit');
  const stockBody = document.getElementById('location-stock-body');
  const stockUpdated = document.getElementById('location-stock-updated');

  const pendingBody = document.getElementById('pending-sales-body');
  const pendingTotal = document.getElementById('pending-sales-total');
  const pendingNavCount = document.getElementById('pending-sales-count');
  const pendingHomeCount = document.getElementById('widget-cobros-pendientes');
  const pendingCashTotal = document.getElementById('dashboard-total-pendiente');
  const pendingCashCount = document.getElementById('dashboard-pending-count');
  const pendingCollectModal = document.getElementById('modal-cobrar-pendiente');
  const pendingCollectSummary = document.getElementById('pending-collect-summary');
  const pendingCollectNote = document.getElementById('pending-collect-note');
  const pendingCollectSave = document.getElementById('pending-collect-save');
  const pendingSearch = document.getElementById('pending-search');
  const pendingResultsSummary = document.getElementById('pending-results-summary');
  const pendingListPanel = document.getElementById('pending-list-panel');
  const pendingPaymentPanel = document.getElementById('pending-payment-panel');
  const pendingBack = document.getElementById('pending-collect-back');
  const pendingError = document.getElementById('pending-collect-error');
  const pendingRetry = document.getElementById('pending-retry');
  const pendingCashButton = document.getElementById('dashboard-cobrar');
  const pendingCashNotice = document.getElementById('pending-cash-notice');
  const pendingReviewCash = document.getElementById('pending-review-cash');

  let classes = [];
  let professors = [];
  let locations = [];
  let selectedClass = null;
  let enrollments = new Map();
  let stock = [];
  let selectedStockProductId = null;
  let pendingSales = [];
  let pendingSaleSelected = null;
  let pendingLoaded = false;
  let pendingLoadError = false;
  let pendingSaving = false;
  let pendingCashReady = false;
  let pendingCashCheck = 0;
  let selectedClassDate = today();
  let currentWeekStart = startOfWeek(selectedClassDate);
  let agendaScroll = 0;
  let classesRequestId = 0;
  let classesLoadQueue = Promise.resolve();
  const classDetail = window.createAdminClassDetailController({
    shared,
    showScreen: showClassesScreen,
    onEnrollmentChanged: () => loadClasses(),
    onBack: classId => {
      showClassesScreen('agenda');
      renderClasses();
      classesList.scrollTop = agendaScroll;
      classesList.querySelector(`[data-open-class="${Number(classId)}"]`)?.focus({ preventScroll: true });
    },
    onUpdated: detail => {
      const row = classes.find(item => Number(item.id) === Number(detail.id));
      if (row) Object.assign(row, {
        estado: detail.estado,
        esPrueba: detail.esPrueba,
        inscriptos: detail.inscriptos ?? row.inscriptos,
        canEditSchedule: detail.canEditSchedule,
        diasSemana: detail.diasSemana,
        fechaInicio: detail.fechaInicio,
        fechaFin: detail.fechaFin,
      });
      if (selectedClass?.id === detail.id) selectedClass = { ...selectedClass, ...detail };
    },
  });

  function today() {
    const date = new Date();
    const pad = value => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function addDays(base, days) {
    const date = new Date(`${base}T12:00:00`);
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function startOfWeek(value) {
    const date = new Date(`${value}T12:00:00`);
    const offset = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - offset);
    return date.toISOString().slice(0, 10);
  }

  function minutesBetween(start, end) {
    const toMinutes = value => {
      const [hours, minutes] = String(value || '').split(':').map(Number);
      return (hours * 60) + minutes;
    };
    return toMinutes(end) - toMinutes(start);
  }

  function money(value) {
    return new Intl.NumberFormat('es-UY', {
      style: 'currency',
      currency: 'UYU',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(value || 0));
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
    })[character]);
  }

  function shortDate(value) {
    if (!value) return { day: '--', month: '---' };
    const date = new Date(`${value}T12:00:00`);
    return {
      day: String(date.getDate()).padStart(2, '0'),
      month: new Intl.DateTimeFormat('es-UY', { month: 'short' }).format(date).replace('.', '').toUpperCase(),
    };
  }

  function formatDateTime(fecha, hora) {
    const date = new Date(`${fecha}T${hora || '00:00:00'}`);
    return new Intl.DateTimeFormat('es-UY', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  const weekdayLabels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  function formatWeekdays(value) {
    const days = Array.isArray(value) ? value : String(value || '').split(',');
    return days
      .map(day => Number.parseInt(day, 10))
      .filter(day => Number.isInteger(day) && day >= 0 && day <= 6)
      .map(day => weekdayLabels[day])
      .join(' · ');
  }

  function demoClasses() {
    const base = today();
    return [
      { id: 1, programacionId: 1, nombre: 'Funcional mañana', fecha: base, hora: '08:00', duracionMinutos: 60, capacidad: 12, profesor: 'Santiago', localNombre: 'Salón funcional', diasSemana: '1,3,5', inscriptos: 6 },
      { id: 2, programacionId: 2, nombre: 'Funcional tarde', fecha: base, hora: '17:00', duracionMinutos: 60, capacidad: 10, profesor: 'Valentina', localNombre: 'Salón funcional', diasSemana: '2,4', inscriptos: 8 },
      { id: 3, programacionId: 1, nombre: 'Funcional mañana', fecha: addDays(base, 2), hora: '08:00', duracionMinutos: 60, capacidad: 12, profesor: 'Santiago', localNombre: 'Salón funcional', diasSemana: '1,3,5', inscriptos: 6 },
    ];
  }

  function demoProfessors() {
    return [
      { id: 1, nombre: 'Santiago', activo: true, pinConfigurado: false },
      { id: 2, nombre: 'Valentina', activo: true, pinConfigurado: false },
    ];
  }

  function demoLocations() {
    return [
      { id: 1, codigo: 'principal', nombre: 'Recepción principal', tipo: 'principal', activo: 1 },
      { id: 2, codigo: 'funcional', nombre: 'Salón funcional', tipo: 'clases', activo: 1 },
    ];
  }

  async function loadLocations() {
    try {
      if (window.api) locations = await window.api.obtenerLocales();
      else if (!locations.length) locations = demoLocations();
    } catch (error) {
      console.error('No se pudieron cargar los locales:', error);
      locations = [];
    }
    populateLocationSelect();
  }

  function populateLocationSelect() {
    if (!classLocal) return;
    const selectedValue = classLocal.value || '2';
    classLocal.innerHTML = '<option value="">Seleccionar local</option>';
    locations.forEach(item => {
      const option = document.createElement('option');
      option.value = String(item.id);
      option.textContent = item.nombre;
      classLocal.appendChild(option);
    });
    if ([...classLocal.options].some(option => option.value === selectedValue)) classLocal.value = selectedValue;
  }

  async function loadProfessors() {
    try {
      if (window.api) professors = await window.api.obtenerProfesores(true);
      else if (!professors.length) professors = demoProfessors();
    } catch (error) {
      console.error('No se pudieron cargar los profesores:', error);
      professors = [];
      shared.mostrarNotificacion('No se pudieron cargar los profesores', 'error');
    }
    renderProfessors();
    populateProfessorSelect();
  }

  function populateProfessorSelect() {
    if (!classCoach) return;
  }

  function renderProfessors() {
    if (!professorsList || !professorsEmpty || !professorsCount) return;
    professorsList.innerHTML = '';
    const activeCount = professors.filter(item => item.activo === true || Number(item.activo) === 1).length;
    const visible = professors.filter(item => item.activo === true || Number(item.activo) === 1);
    professorsEmpty.style.display = visible.length ? 'none' : 'grid';
    professorsCount.textContent = `${activeCount} ${activeCount === 1 ? 'profesor' : 'profesores'}`;
    if (classesProfessorsCount) classesProfessorsCount.textContent = String(activeCount);
    visible.forEach(item => {
      const row = document.createElement('article');
      row.className = 'professor-row';
      const identity = document.createElement('div');
      identity.className = 'professor-identity';
      const initials = item.nombre.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
      identity.innerHTML = `<span class="professor-avatar">${initials}</span>`;
      const copy = document.createElement('span');
      const name = document.createElement('strong');
      name.textContent = item.nombre;
      copy.append(name);
      identity.appendChild(copy);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'professor-remove-button';
      remove.dataset.removeProfessor = String(item.id);
      remove.textContent = 'Eliminar';
      row.append(identity, remove);
      professorsList.appendChild(row);
    });
  }

  async function removeProfessor(id) {
    const professor = professors.find(item => Number(item.id) === Number(id));
    if (!professor) return;
    const confirmed = await shared.confirmarAccion(`¿Eliminar a ${professor.nombre} de la lista de profesores?`);
    if (!confirmed) return;
    try {
      if (window.api) await window.api.actualizarProfesor(professor.id, { nombre: professor.nombre, activo: false });
      else professor.activo = false;
      shared.mostrarNotificacion('Profesor eliminado', 'success');
      await loadProfessors();
    } catch (error) {
      shared.mostrarNotificacion(error?.message || 'No se pudo eliminar el profesor', 'error');
    }
  }

  function openProfessorManager() {
    professorName.value = '';
    professorModal.style.display = 'flex';
    requestAnimationFrame(() => professorName.focus());
  }

  async function saveProfessor() {
    const payload = {
      nombre: professorName.value.trim(),
      activo: true,
    };
    if (!payload.nombre) {
      shared.mostrarNotificacion('Ingresá el nombre del profesor', 'warning');
      professorName.focus();
      return;
    }
    const originalLabel = professorSave.textContent;
    professorSave.disabled = true;
    professorSave.textContent = 'Guardando…';
    try {
      if (window.api) {
        await window.api.crearProfesor(payload);
      } else {
        professors.push({ id: Date.now(), ...payload, activo: true, pinConfigurado: false });
      }
      professorName.value = '';
      shared.mostrarNotificacion('Profesor agregado', 'success');
      await loadProfessors();
      professorName.focus();
    } catch (error) {
      shared.mostrarNotificacion(error?.message || 'No se pudo guardar el profesor', 'error');
    } finally {
      professorSave.disabled = false;
      professorSave.textContent = originalLabel;
    }
  }

  function demoStock() {
    return [
      { productoId: 1, nombre: 'Agua mineral 1.5 L', precio: 95, local1: 18, local2: 6, total: 24 },
      { productoId: 2, nombre: 'Agua mineral 600 ml', precio: 60, local1: 38, local2: 12, total: 50 },
      { productoId: 3, nombre: 'Agua saborizada 500 ml', precio: 85, local1: 22, local2: 8, total: 30 },
      { productoId: 4, nombre: 'Barrita de cereal chocolate', precio: 70, local1: 28, local2: 10, total: 38 },
      { productoId: 5, nombre: 'Barrita de cereal frutos rojos', precio: 70, local1: 24, local2: 8, total: 32 },
    ];
  }

  function demoPending() {
    return [
      { id: 1, localId: 2, localNombre: 'Salón funcional', fecha: today(), hora: '18:42', usuarioNombre: 'Martina Silva', productoNombre: 'Agua mineral 600 ml', cantidad: 1, profesor: 'Santiago', total: 60, estado: 'pendiente' },
      { id: 2, localId: 1, localNombre: 'Recepción principal', fecha: today(), hora: '19:08', usuarioNombre: 'Bruno Rodriguez', productoNombre: 'Barrita de cereal chocolate', cantidad: 2, profesor: 'Valentina', total: 140, estado: 'pendiente' },
    ];
  }

  function loadClasses(fromDate = currentWeekStart) {
    // Initial load, sidebar navigation and week controls may overlap. The local
    // query also generates occurrences in a transaction, so never run it twice.
    const date = typeof fromDate === 'string' ? fromDate : currentWeekStart;
    const ticket = ++classesRequestId;
    classesLoadQueue = classesLoadQueue.then(async () => {
      if (ticket !== classesRequestId) return;
      try {
        const next = window.api ? await window.api.obtenerClasesProximas(date) : classes.length ? classes : demoClasses();
        if (ticket !== classesRequestId) return;
        classes = next;
      } catch (error) {
        if (ticket !== classesRequestId) return;
        console.error('No se pudieron cargar las clases:', error);
        shared.mostrarNotificacion('No se pudieron cargar las clases', 'error');
      }
      if (ticket === classesRequestId) renderClasses();
    });
    return classesLoadQueue;
  }

  function renderClasses() {
    if (!classesList || !classesEmpty) return;
    const upcomingClasses = [...classes]
      .sort((a, b) => `${a.fecha}T${a.hora || '00:00'}`.localeCompare(`${b.fecha}T${b.hora || '00:00'}`));
    const weekEnd = addDays(currentWeekStart, 6);
    const weekClasses = upcomingClasses.filter(item => item.fecha >= currentWeekStart && item.fecha <= weekEnd);
    renderWeekPicker(weekClasses);
    const visibleClasses = weekClasses.filter(item => item.fecha === selectedClassDate);
    classesList.innerHTML = '';
    classesList.hidden = !visibleClasses.length;
    classesEmpty.style.display = visibleClasses.length ? 'none' : 'grid';
    classesWeekCount.textContent = String(weekClasses.length);
    classesWeekCount.nextSibling.textContent = ` ${weekClasses.length === 1 ? 'clase' : 'clases'} esta semana`;
    const enrolledCount = visibleClasses.reduce((sum, item) => sum + Number(item.inscriptos || 0), 0);
    classesEnrolledCount.textContent = String(enrolledCount);
    classesEnrolledCount.nextSibling.textContent = ` ${enrolledCount === 1 ? 'inscripción' : 'inscripciones'} del día`;
    classesSelectedDate.textContent = new Intl.DateTimeFormat('es-UY', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${selectedClassDate}T12:00:00`));
    classesDaySummary.textContent = `${visibleClasses.length} ${visibleClasses.length === 1 ? 'clase' : 'clases'}`;

    const now = new Date();
    const displayState = item => {
      const start = new Date(`${item.fecha}T${String(item.hora || '00:00').slice(0, 5)}:00`);
      const end = new Date(start.getTime() + Number(item.duracionMinutos || 60) * 60000);
      if (item.estado === 'cancelada') return { key: 'cancelled', label: 'No se dio' };
      if (item.estado === 'dictada' || now >= end) return { key: 'finished', label: 'Finalizada' };
      if (now >= start) return { key: 'current', label: 'En curso' };
      return { key: 'scheduled', label: 'Programada' };
    };
    const nextId = visibleClasses.find(item => displayState(item).key === 'scheduled')?.id;
    visibleClasses.forEach(item => {
      const available = Math.max(0, Number(item.capacidad || 0) - Number(item.inscriptos || 0));
      const row = document.createElement('article');
      const display = displayState(item);
      row.className = `class-row agenda-class-card ${display.key}${item.id === nextId ? ' is-next' : ''}`;
      row.dataset.classId = String(item.id);
      const startTime = String(item.hora || '').slice(0, 5);
      row.innerHTML = `
        <button class="agenda-class-open" type="button" data-open-class="${Number(item.id)}" aria-label="Abrir ${escapeHtml(item.nombre)}, ${escapeHtml(startTime)}">
          <span class="agenda-class-time"><strong>${escapeHtml(startTime)}</strong><small>${Number(item.duracionMinutos || 60)} min</small></span>
          <span class="agenda-class-identity"><strong>${escapeHtml(item.nombre)}</strong><small>${escapeHtml(item.profesor || 'Profesor sin asignar')}${item.esPrueba ? ' · Prueba' : ''}</small></span>
          <span class="agenda-class-info"><span>${item.id === nextId ? 'Próxima clase' : display.label}</span><small>${Number(item.inscriptos || 0)} / ${Number(item.capacidad || 0)} alumnos${available === 0 ? ' · Completo' : ''}</small></span>
          <span class="agenda-class-arrow" aria-hidden="true">›</span>
        </button>
        ${item.estado === 'programada' && item.programacionId && item.canEditSchedule === true ? `<button type="button" class="agenda-class-edit" data-edit-agenda-class="${Number(item.id)}" aria-label="Editar ${escapeHtml(item.nombre)}">Editar</button>` : '<span class="agenda-class-action-space" aria-hidden="true"></span>'}
      `;
      classesList.appendChild(row);
    });
  }

  function renderWeekPicker(weekClasses) {
    const start = new Date(`${currentWeekStart}T12:00:00`);
    const end = new Date(`${addDays(currentWeekStart, 6)}T12:00:00`);
    const formatDayMonth = date => new Intl.DateTimeFormat('es-UY', { day: 'numeric', month: 'long' }).format(date);
    classesWeekLabel.textContent = `${formatDayMonth(start)} – ${formatDayMonth(end)}`;
    classesWeekToday.disabled = selectedClassDate === today();
    classesDayPicker.innerHTML = '';
    for (let index = 0; index < 7; index += 1) {
      const dateValue = addDays(currentWeekStart, index);
      const date = new Date(`${dateValue}T12:00:00`);
      const count = weekClasses.filter(item => item.fecha === dateValue).length;
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.classDate = dateValue;
      button.className = dateValue === selectedClassDate ? 'is-active' : '';
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', String(dateValue === selectedClassDate));
      button.setAttribute('aria-controls', 'classes-list');
      button.tabIndex = dateValue === selectedClassDate ? 0 : -1;
      button.id = `classes-day-${dateValue}`;
      button.setAttribute('aria-label', `${new Intl.DateTimeFormat('es-UY', { weekday: 'long', day: 'numeric', month: 'long' }).format(date)}, ${count} ${count === 1 ? 'clase' : 'clases'}${dateValue === today() ? ', hoy' : ''}`);
      if (dateValue === today()) button.setAttribute('aria-current', 'date');
      button.innerHTML = `<span>${weekdayLabels[date.getDay()]}</span><strong>${date.getDate()}</strong><small>${count} ${count === 1 ? 'clase' : 'clases'}${dateValue === today() ? ' · Hoy' : ''}</small>`;
      classesDayPicker.appendChild(button);
    }
  }

  async function setClassTrial(classId, checked) {
    const item = classes.find(current => Number(current.id) === Number(classId));
    if (!item) return;
    const previous = Boolean(item.esPrueba);
    item.esPrueba = checked;
    renderClasses();
    try {
      if (window.api?.marcarClasePrueba) await window.api.marcarClasePrueba({ claseId: item.id, esPrueba: checked });
      shared.mostrarNotificacion(checked ? 'Clase marcada como prueba' : 'Clase de prueba desmarcada', 'success');
    } catch (error) {
      item.esPrueba = previous;
      renderClasses();
      shared.mostrarNotificacion(error?.message || 'No se pudo cambiar la clase', 'error');
    }
  }

  async function selectClass(classId) {
    selectedClass = classes.find(item => Number(item.id) === Number(classId)) || null;
    if (!selectedClass) return;
    if (document.querySelector('[data-classes-screen="agenda"].is-active')) agendaScroll = classesList.scrollTop;
    await classDetail.show(selectedClass);
  }

  async function saveClass() {
    const diasSemana = [...document.querySelectorAll('input[name="class-weekday"]:checked')]
      .map(input => Number(input.value));
    const payload = {
      nombre: document.getElementById('class-name').value.trim(),
      profesorId: 0,
      profesor: classCoach.value.trim(),
      localId: Number(classLocal.value || 0),
      diasSemana,
      fechaInicio: document.getElementById('class-start-date').value,
      fechaFin: document.getElementById('class-end-date').value || null,
      hora: document.getElementById('class-time').value,
      capacidad: Number(document.getElementById('class-capacity').value || 0),
      duracionMinutos: minutesBetween(document.getElementById('class-time').value, document.getElementById('class-end-time').value),
      notas: document.getElementById('class-notes').value.trim(),
    };
    if (!payload.nombre || !payload.profesor || !payload.localId || !payload.fechaInicio || !payload.hora || !payload.diasSemana.length || payload.capacidad <= 0 || payload.duracionMinutos <= 0) {
      shared.mostrarNotificacion('Completá nombre, local, profesor, días, horario y cupos', 'warning');
      return;
    }
    const originalLabel = classSave.textContent;
    classSave.disabled = true;
    classSave.textContent = 'Creando…';
    try {
      if (window.api) {
        await window.api.crearClase(payload);
      } else {
        let nextDate = payload.fechaInicio;
        while (!payload.diasSemana.includes(new Date(`${nextDate}T12:00:00`).getDay())) nextDate = addDays(nextDate, 1);
        classes.push({
          id: Date.now(),
          programacionId: Date.now(),
          ...payload,
          fecha: nextDate,
          diasSemana: payload.diasSemana.join(','),
          localNombre: locations.find(item => Number(item.id) === payload.localId)?.nombre || 'Local',
          inscriptos: 0,
        });
      }
      modalNewClass.style.display = 'none';
      shared.mostrarNotificacion('Programación de clases creada', 'success');
      await loadClasses();
    } catch (error) {
      shared.mostrarNotificacion(error?.message || 'No se pudo programar la clase', 'error');
    } finally {
      classSave.disabled = false;
      classSave.textContent = originalLabel;
    }
  }

  function setTimeFromDuration(startInput, endInput, duration) {
    const start = String(startInput.value || '').slice(0, 5);
    if (!start) { endInput.value = ''; return; }
    const [hours, minutes] = start.split(':').map(Number);
    const total = (hours * 60) + minutes + Number(duration || 60);
    endInput.value = `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }

  function populateClassEditSelectors() {
    classEditLocal.innerHTML = '<option value="">Seleccionar local</option>';
    locations.forEach(item => {
      const option = document.createElement('option');
      option.value = String(item.id); option.textContent = item.nombre;
      classEditLocal.appendChild(option);
    });
  }

  function openClassEdit() {
    const item = selectedClass;
    if (!item || item.estado !== 'programada' || !item.programacionId || item.canEditSchedule !== true) return;
    populateClassEditSelectors();
    document.getElementById('class-edit-name').value = item.nombre || '';
    classEditCoach.value = item.profesorProgramado || item.profesor || '';
    classEditLocal.value = String(item.localId || '');
    document.getElementById('class-edit-time').value = String(item.hora || '').slice(0, 5);
    setTimeFromDuration(document.getElementById('class-edit-time'), document.getElementById('class-edit-end-time'), item.duracionMinutos);
    document.getElementById('class-edit-capacity').value = String(item.capacidad || 12);
    document.getElementById('class-edit-end-date').value = item.fechaFin || '';
    document.getElementById('class-edit-end-date').min = item.fecha;
    const selectedDays = String(item.diasSemana || '').split(',').map(Number);
    document.querySelectorAll('input[name="class-edit-weekday"]').forEach(input => {
      input.checked = selectedDays.includes(Number(input.value));
    });
    const date = new Intl.DateTimeFormat('es-UY', { weekday: 'long', day: 'numeric', month: 'long' })
      .format(new Date(`${item.fecha}T12:00:00`));
    document.getElementById('class-edit-scope').textContent = `Los cambios se aplicarán desde el ${date}. El historial anterior no se modifica.`;
    classEditModal.dataset.scheduleId = String(item.programacionId);
    classEditModal.dataset.effectiveFrom = item.fecha;
    classEditModal.style.display = 'flex';
    document.getElementById('class-edit-name').focus();
  }

  async function saveClassEdit() {
    const diasSemana = [...document.querySelectorAll('input[name="class-edit-weekday"]:checked')]
      .map(input => Number(input.value));
    const payload = {
      programacionId: Number(classEditModal.dataset.scheduleId || 0),
      desdeFecha: classEditModal.dataset.effectiveFrom,
      nombre: document.getElementById('class-edit-name').value.trim(),
      profesorId: 0,
      profesor: classEditCoach.value.trim(),
      localId: Number(classEditLocal.value || 0),
      diasSemana,
      hora: document.getElementById('class-edit-time').value,
      duracionMinutos: minutesBetween(document.getElementById('class-edit-time').value, document.getElementById('class-edit-end-time').value),
      capacidad: Number(document.getElementById('class-edit-capacity').value || 0),
      fechaFin: document.getElementById('class-edit-end-date').value || null,
      notas: selectedClass?.notas || '',
    };
    if (!payload.programacionId || !payload.nombre || !payload.profesor || !payload.localId || !payload.desdeFecha || !payload.hora || !payload.diasSemana.length || payload.capacidad <= 0 || payload.duracionMinutos <= 0) {
      shared.mostrarNotificacion('Completá nombre, local, profesor, días, horario y cupo', 'warning');
      return;
    }
    classEditSave.disabled = true;
    classEditSave.textContent = 'Guardando…';
    try {
      if (!window.api?.actualizarProgramacionClase) throw new Error('La edición de clases no está disponible');
      await window.api.actualizarProgramacionClase(payload);
      classEditModal.style.display = 'none';
      shared.mostrarNotificacion('Programación actualizada. El historial anterior se conservó.', 'success');
      showClassesScreen('agenda');
      selectedClass = null;
      selectedClassDate = payload.desdeFecha;
      currentWeekStart = startOfWeek(selectedClassDate);
      await loadClasses();
    } catch (error) {
      shared.mostrarNotificacion(error?.message || 'No se pudo editar la clase', 'error');
    } finally {
      classEditSave.disabled = false;
      classEditSave.textContent = 'Guardar cambios';
    }
  }

  const classEnrollment = window.createAdminClassEnrollmentController({
    loadUsers: () => window.api ? window.api.obtenerUsuarios() : Promise.resolve([
      { ci: 49876543, nombre: 'Martina Silva' }, { ci: 43219876, nombre: 'Bruno Rodríguez' },
      { ci: 51234567, nombre: 'Lucas Pereira' }, { ci: 56781234, nombre: 'Diego Martínez' },
    ]),
    loadEnrollments: id => window.api ? window.api.obtenerInscripcionesClase(id) : Promise.resolve(enrollments.get(Number(id)) || []),
    formatSchedule: item => `${item.profesorProgramado || item.profesor || 'Sin profesor'} · ${item.diasSemana ? `${formatWeekdays(item.diasSemana)} · ${String(item.hora).slice(0, 5)}` : formatDateTime(item.fecha, item.hora)}`,
    save: async ({ classId, userCi }) => {
      if (window.api) return window.api.inscribirSocioClase({ classId, userCi });
      const users = [{ ci: 49876543, nombre: 'Martina Silva' }, { ci: 43219876, nombre: 'Bruno Rodríguez' }, { ci: 51234567, nombre: 'Lucas Pereira' }, { ci: 56781234, nombre: 'Diego Martínez' }];
      const list = enrollments.get(Number(classId)) || [];
      if (list.some(item => Number(item.usuarioCi) === userCi)) throw new Error('El socio ya está en el grupo.');
      list.push({ usuarioCi: userCi, usuarioNombre: users.find(user => user.ci === userCi)?.nombre || String(userCi) });
      enrollments.set(Number(classId), list);
      const item = classes.find(row => Number(row.id) === Number(classId));
      if (item) item.inscriptos = list.length;
    },
    onSaved: async id => {
      shared.mostrarNotificacion('Alumno agregado', 'success');
      await loadClasses();
      await selectClass(id);
    },
  });

  async function loadStock() {
    try {
      stock = window.api ? await window.api.obtenerStockLocales() : demoStock();
    } catch (error) {
      stock = [];
      shared.mostrarNotificacion('No se pudo cargar el stock por local', 'error');
    }
    renderStock();
  }

  function renderStock() {
    if (!stockBody) return;
    if (!stock.some(item => Number(item.productoId) === Number(selectedStockProductId))) selectedStockProductId = null;
    stockBody.innerHTML = '';
    const assignedStock = stock.filter(item => Number(item.asignadoLocal2 ?? (Number(item.local2) > 0)) === 1);
    assignedStock.forEach(item => {
      const tr = document.createElement('tr');
      tr.dataset.stockProduct = String(item.productoId);
      tr.tabIndex = 0;
      tr.classList.toggle('is-selected', Number(item.productoId) === Number(selectedStockProductId));
      tr.innerHTML = `<td><strong>${item.nombre}</strong></td><td>${money(item.precio)}</td><td><span class="stock-local-two">${item.local2}</span></td><td>${item.local1}</td>`;
      const selectRow = () => {
        selectedStockProductId = Number(item.productoId);
        if (stockProduct) stockProduct.value = String(item.productoId);
        renderStock();
      };
      tr.addEventListener('click', selectRow);
      tr.addEventListener('keydown', event => {
        if (!['Enter', ' '].includes(event.key)) return;
        event.preventDefault();
        selectRow();
      });
      stockBody.appendChild(tr);
    });
    if (!assignedStock.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="4" class="table-inline-empty">Todavía no hay productos asignados a este local.</td>';
      stockBody.appendChild(tr);
    }
    if (stockProduct) {
      const currentValue = String(selectedStockProductId || '');
      stockProduct.innerHTML = '<option value="">Seleccionar producto</option>';
      stock
        .filter(item => Number(item.local1) > 0)
        .forEach(item => {
          const option = document.createElement('option');
          option.value = String(item.productoId);
          option.textContent = `${item.nombre} · ${item.local1} disponibles`;
          stockProduct.appendChild(option);
        });
      stockProduct.value = [...stockProduct.options].some(option => option.value === currentValue) ? currentValue : '';
    }
    stockUpdated.textContent = `Actualizado ${new Date().toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' })}`;
    updateStockAvailability();
  }

  function updateStockAvailability() {
    const item = stock.find(row => Number(row.productoId) === Number(selectedStockProductId));
    stockAvailability.querySelector('strong').textContent = item?.nombre || 'Ninguno';
    const detail = stockAvailability.querySelector('small');
    if (detail) detail.textContent = item ? `${item.local1} unidades disponibles en Local 1` : 'Elegí un producto del Local 1';
    if (item) stockQuantity.max = String(item.local1);
    stockTransferSubmit.disabled = !item || Number(item.local1) <= 0;
  }

  async function transferStock() {
    const productoId = Number(selectedStockProductId || 0);
    const cantidad = Number(stockQuantity.value || 0);
    const item = stock.find(row => Number(row.productoId) === productoId);
    if (!item || !Number.isInteger(cantidad) || cantidad <= 0 || cantidad > Number(item.local1)) {
      shared.mostrarNotificacion('Seleccioná un producto y una cantidad disponible', 'warning');
      return;
    }
    try {
      if (window.api) {
        await window.api.transferirStockLocal({ productoId, cantidad, responsable: 'Recepcion' });
      } else {
        item.local1 -= cantidad;
        item.local2 += cantidad;
        item.total = item.local1 + item.local2;
      }
      stockQuantity.value = '1';
      shared.mostrarNotificacion(`${cantidad} unidad(es) asignadas al Local 2`, 'success');
      if (window.api) await loadStock(); else renderStock();
      document.dispatchEvent(new CustomEvent('stock:updated'));
    } catch (error) {
      shared.mostrarNotificacion(error?.message || 'No se pudo asignar el stock', 'warning');
    }
  }

  async function loadPending() {
    try {
      pendingSales = window.api ? await window.api.obtenerVentasPendientes() : pendingLoaded ? pendingSales : demoPending();
      pendingLoaded = true;
      pendingLoadError = false;
    } catch (error) {
      pendingLoadError = true;
    }
    renderPending();
  }

  function renderPending() {
    if (!pendingBody) return;
    const empty = document.querySelector('.pending-empty-state');
    pendingRetry.hidden = !pendingLoadError;
    if (pendingLoadError) {
      pendingBody.replaceChildren();
      empty.style.display = 'grid';
      empty.querySelector('strong').textContent = 'No se pudieron cargar los pendientes';
      empty.querySelector('span').textContent = 'Revisá la conexión y volvé a intentar.';
      pendingResultsSummary.textContent = 'No se pudo actualizar la información.';
      return;
    }
    const query = String(pendingSearch?.value || '').trim().toLocaleLowerCase('es');
    const visible = pendingSales.filter(item => !query
      || String(item.usuarioNombre || '').toLocaleLowerCase('es').includes(query)
      || String(item.productoNombre || '').toLocaleLowerCase('es').includes(query));
    pendingBody.innerHTML = '';
    empty.style.display = visible.length ? 'none' : 'grid';
    empty.querySelector('strong').textContent = query ? 'No hay coincidencias' : 'No hay cobros pendientes';
    empty.querySelector('span').textContent = query ? 'Probá con otro nombre de socio o producto.' : 'Las entregas sin cobrar aparecerán aquí.';
    const total = pendingSales.reduce((sum, item) => sum + Number(item.total || 0), 0);
    pendingTotal.textContent = money(total);
    if (pendingResultsSummary) pendingResultsSummary.textContent = `${visible.length} ${visible.length === 1 ? 'venta' : 'ventas'} · ${money(visible.reduce((sum, item) => sum + Number(item.total || 0), 0))} pendientes`;
    pendingNavCount.textContent = String(pendingSales.length);
    pendingNavCount.hidden = pendingSales.length === 0;
    pendingCashButton.setAttribute('aria-label', `Cobros pendientes, ${pendingSales.length}`);
    pendingHomeCount.textContent = String(pendingSales.length);
    pendingHomeCount.closest('article')?.classList.toggle('has-pending', pendingSales.length > 0);
    pendingCashTotal.textContent = money(total);
    pendingCashCount.textContent = `${pendingSales.length} ${pendingSales.length === 1 ? 'venta' : 'ventas'}`;
    visible.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="pending-member"><span aria-hidden="true">${escapeHtml(String(item.usuarioNombre || '?').split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase())}</span><span><strong>${escapeHtml(item.usuarioNombre)}</strong><small>${Number(item.cantidad || 1)} × ${escapeHtml(item.productoNombre)}</small></span></span></td>
        <td><span class="pending-registered"><span>${item.fecha === today() ? 'Hoy' : escapeHtml(item.fecha || 'Sin fecha')} · ${escapeHtml(String(item.hora || '').slice(0, 5))}</span><small>${escapeHtml(item.localNombre || `Local ${item.localId || 2}`)}${item.profesor ? ` · ${escapeHtml(item.profesor)}` : ''}</small></span></td>
        <td><strong>${money(item.total)}</strong></td>
        <td><button class="pending-collect-button" type="button" data-collect-pending="${escapeHtml(item.id)}" aria-label="Cobrar a ${escapeHtml(item.usuarioNombre)} por ${escapeHtml(item.productoNombre)}">Cobrar</button></td>
      `;
      pendingBody.appendChild(tr);
    });
  }

  function showPendingList() {
    pendingCashCheck += 1;
    pendingCashReady = false;
    pendingSaleSelected = null;
    pendingCollectModal.classList.remove('is-confirming');
    pendingListPanel.hidden = false;
    pendingPaymentPanel.hidden = true;
    pendingBack.hidden = true;
    pendingCollectSave.hidden = true;
    document.getElementById('pending-modal-title').textContent = 'Cobros pendientes';
    pendingError.hidden = true;
    pendingCashNotice.hidden = true;
    pendingReviewCash.hidden = true;
    pendingSearch.focus();
  }

  async function openPendingModal() {
    pendingSearch.value = '';
    pendingCollectModal.style.display = 'flex';
    showPendingList();
    await loadPending();
  }

  function openPendingCollection(id) {
    pendingSaleSelected = pendingSales.find(item => String(item.id) === String(id)) || null;
    if (!pendingSaleSelected) return;
    const sale = pendingSaleSelected;
    pendingCollectSummary.innerHTML = `<div class="pending-payer"><strong>${escapeHtml(sale.usuarioNombre)}</strong><span>${Number(sale.cantidad || 1)} × ${escapeHtml(sale.productoNombre)}</span><small>${escapeHtml(sale.localNombre || `Local ${sale.localId || 2}`)} · ${sale.fecha === today() ? 'Hoy' : escapeHtml(sale.fecha || '')} ${escapeHtml(String(sale.hora || '').slice(0, 5))}</small></div><div class="pending-payment-amount"><span>Total a cobrar</span><strong>${money(sale.total)}</strong></div>`;
    pendingCollectModal.classList.add('is-confirming');
    pendingCollectNote.value = '';
    document.querySelectorAll('input[name="pending-payment-method"]').forEach(input => { input.checked = input.value === 'efectivo'; });
    pendingListPanel.hidden = true;
    pendingPaymentPanel.hidden = false;
    pendingBack.hidden = false;
    pendingCollectSave.hidden = false;
    pendingCollectSave.textContent = `Cobrar ${money(sale.total)}`;
    pendingError.hidden = true;
    document.getElementById('pending-modal-title').textContent = 'Registrar cobro';
    pendingPaymentPanel.querySelector('input[type="radio"]:checked').focus();
    verifyPendingCash();
  }

  async function verifyPendingCash() {
    const check = ++pendingCashCheck;
    const date = today();
    pendingCashReady = false;
    pendingCollectSave.disabled = true;
    pendingCashNotice.hidden = false;
    pendingCashNotice.textContent = 'Comprobando la caja de hoy…';
    pendingReviewCash.hidden = true;
    try {
      const summary = window.api
        ? await window.api.obtenerResumenCajaDia(date)
        : { sesionAbierta: { fecha: date } };
      if (check !== pendingCashCheck) return false;
      pendingCashReady = pendingCashIsReady(summary, date);
      pendingCashNotice.textContent = pendingCashReady ? '' : 'No hay una caja abierta para hoy. Revisá Caja para continuar.';
      pendingCashNotice.hidden = pendingCashReady;
      pendingReviewCash.hidden = pendingCashReady;
    } catch (_) {
      if (check !== pendingCashCheck) return false;
      pendingCashNotice.textContent = 'No se pudo comprobar la caja de hoy. Revisá la conexión antes de cobrar.';
      pendingReviewCash.hidden = false;
    }
    pendingCollectSave.disabled = !pendingCashReady || pendingSaving;
    return pendingCashReady;
  }

  async function savePendingCollection() {
    if (!pendingSaleSelected || pendingSaving) return;
    const saleId = pendingSaleSelected.id;
    const formaPago = document.querySelector('input[name="pending-payment-method"]:checked')?.value || 'efectivo';
    try {
      pendingSaving = true;
      pendingCollectSave.textContent = 'Registrando…';
      pendingCollectModal.querySelectorAll('button').forEach(button => { button.disabled = true; });
      pendingError.hidden = true;
      if (!await verifyPendingCash()) return;
      if (window.api) {
        await window.api.cobrarVentaPendiente({ id: saleId, formaPago, observacion: pendingCollectNote.value.trim() });
      }
      pendingSales = pendingSales.filter(item => String(item.id) !== String(saleId));
      shared.mostrarNotificacion('Cobro ingresado a caja', 'success');
      renderPending();
      document.dispatchEvent(new CustomEvent('cash:updated'));
      showPendingList();
      if (window.api) await loadPending();
    } catch (error) {
      const message = String(error?.message || '').replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '');
      if (/caja|cash.*session/i.test(message)) await verifyPendingCash();
      pendingError.textContent = pendingCashReady ? (message || 'No se pudo registrar el cobro. Volvé a intentar.') : 'El cobro no se registró. Revisá la caja antes de continuar.';
      pendingError.hidden = false;
    } finally {
      pendingSaving = false;
      pendingCollectSave.textContent = pendingSaleSelected ? `Cobrar ${money(pendingSaleSelected.total)}` : 'Registrar cobro';
      pendingCollectModal.querySelectorAll('button').forEach(button => { button.disabled = false; });
      pendingCollectSave.disabled = !pendingCashReady;
    }
  }

  function initializeNewClassDefaults({ reset = false } = {}) {
    const nameInput = document.getElementById('class-name');
    const dateInput = document.getElementById('class-start-date');
    const timeInput = document.getElementById('class-time');
    const endTimeInput = document.getElementById('class-end-time');
    const endDateInput = document.getElementById('class-end-date');
    const capacityInput = document.getElementById('class-capacity');
    if (reset && nameInput) nameInput.value = '';
    if (dateInput && (reset || !dateInput.value)) dateInput.value = today();
    if (dateInput) dateInput.min = today();
    if (timeInput && (reset || !timeInput.value)) timeInput.value = '18:00';
    if (endTimeInput && (reset || !endTimeInput.value)) endTimeInput.value = '19:00';
    if (capacityInput && reset) capacityInput.value = '12';
    if (endDateInput) {
      if (reset) endDateInput.value = '';
      endDateInput.min = dateInput?.value || today();
    }
    if (reset) {
      document.querySelectorAll('input[name="class-weekday"]').forEach(input => {
        input.checked = ['1', '3', '5'].includes(input.value);
      });
    }
  }

  function openNewClass() {
    initializeNewClassDefaults({ reset: true });
    document.getElementById('class-name')?.focus();
  }

  function showClassesScreen(name) {
    document.querySelectorAll('[data-classes-screen]').forEach(screen => screen.classList.toggle('is-active', screen.dataset.classesScreen === name));
  }

  async function refreshAll() {
    await loadLocations();
    await Promise.all([loadClasses(), loadStock(), loadPending()]);
  }

  function init() {
    if (window.api && window.adminSync) {
      const sync = window.adminSync;
      sync.watch({
        enabled: () => sync.active('classes'),
        read: async () => {
          await classesLoadQueue;
          const date = currentWeekStart;
          const rows = await window.api.obtenerClasesProximas(date); const teachers = [];
          return { date, rows, teachers };
        },
        apply: ({ date, rows, teachers }) => {
          if (date !== currentWeekStart) return;
          classes = rows; professors = teachers;
          renderClasses(); renderProfessors(); populateProfessorSelect();
        },
      });
      sync.watch({
        enabled: () => sync.visible(pendingBody) || sync.active('home') || sync.visible(pendingCashButton),
        read: () => window.api.obtenerVentasPendientes(),
        apply: rows => { pendingSales = rows; pendingLoaded = true; pendingLoadError = false; renderPending(); },
      });
      sync.watch({
        enabled: () => sync.visible(stockBody),
        read: () => window.api.obtenerStockLocales(),
        apply: rows => { stock = rows; renderStock(); },
      });
    }
    const refreshClock = () => {
      if (document.querySelector('[data-admin-view="classes"].is-active')) renderClasses();
    };
    const clockTimer = window.setInterval(refreshClock, 30000);
    window.addEventListener('focus', refreshClock);
    window.addEventListener('beforeunload', () => window.clearInterval(clockTimer), { once: true });
    initializeNewClassDefaults();
    document.querySelectorAll('[data-open-modal="modal-nueva-clase"]').forEach(button => button.addEventListener('click', openNewClass));
    classesOpenProfessors?.addEventListener('click', openProfessorManager);
    professorSave?.addEventListener('click', saveProfessor);
    professorName?.addEventListener('keydown', event => {
      if (event.key === 'Enter') saveProfessor();
    });
    professorsList?.addEventListener('click', event => {
      const button = event.target.closest('[data-remove-professor]');
      if (button) removeProfessor(button.dataset.removeProfessor);
    });
    classSave?.addEventListener('click', saveClass);
    document.getElementById('class-time')?.addEventListener('change', event => {
      setTimeFromDuration(event.currentTarget, document.getElementById('class-end-time'), 60);
    });
    document.getElementById('class-start-date')?.addEventListener('change', event => {
      const endDateInput = document.getElementById('class-end-date');
      endDateInput.min = event.currentTarget.value || today();
      if (endDateInput.value && endDateInput.value < endDateInput.min) endDateInput.value = '';
    });
    classEditOpen?.addEventListener('click', openClassEdit);
    classEditSave?.addEventListener('click', saveClassEdit);
    document.getElementById('class-edit-time')?.addEventListener('change', event => {
      setTimeFromDuration(event.currentTarget, document.getElementById('class-edit-end-time'), selectedClass?.duracionMinutos || 60);
    });
    classEnrollOpen?.addEventListener('click', () => classEnrollment.open(selectedClass));
    classesRefresh?.addEventListener('click', loadClasses);
    classesDayPicker?.addEventListener('click', event => {
      const button = event.target.closest('[data-class-date]');
      if (!button) return;
      selectedClassDate = button.dataset.classDate;
      selectedClass = null;
      renderClasses();
      document.getElementById(`classes-day-${selectedClassDate}`)?.focus({ preventScroll: true });
    });
    classesDayPicker?.addEventListener('keydown', event => {
      const tabs = [...classesDayPicker.querySelectorAll('[data-class-date]')];
      const index = tabs.indexOf(event.target);
      if (index < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? 6 : (index + (event.key === 'ArrowRight' ? 1 : -1) + 7) % 7;
      tabs[next].click();
    });
    classesWeekToday?.addEventListener('click', async () => {
      selectedClassDate = today();
      currentWeekStart = startOfWeek(selectedClassDate);
      selectedClass = null;
      await loadClasses();
    });
    classesWeekPrev?.addEventListener('click', async () => {
      currentWeekStart = addDays(currentWeekStart, -7);
      selectedClassDate = currentWeekStart;
      selectedClass = null;
      await loadClasses();
    });
    classesWeekNext?.addEventListener('click', async () => {
      currentWeekStart = addDays(currentWeekStart, 7);
      selectedClassDate = currentWeekStart;
      selectedClass = null;
      await loadClasses();
    });
    classesList?.addEventListener('click', event => {
      const edit = event.target.closest('[data-edit-agenda-class]');
      if (edit) {
        selectedClass = classes.find(item => Number(item.id) === Number(edit.dataset.editAgendaClass)) || null;
        openClassEdit();
        return;
      }
      const trial = event.target.closest('[data-class-trial]');
      if (trial) {
        setClassTrial(trial.dataset.classTrial, trial.checked);
        return;
      }
      // Clicking the checkbox label must only change the trial flag, not open the class.
      if (event.target.closest('.class-trial-toggle')) return;
      const open = event.target.closest('[data-open-class]');
      const row = event.target.closest('.class-row[data-class-id]');
      if (open || row) selectClass(open?.dataset.openClass || row.dataset.classId);
    });
    openTabletButton?.addEventListener('click', async () => {
      if (window.api?.abrirPantallaTablet) await window.api.abrirPantallaTablet();
      else window.open('tablet.html', 'underfit-tablet-preview', 'width=1100,height=780');
    });
    stockTransferSubmit?.addEventListener('click', transferStock);
    stockProduct?.addEventListener('change', () => {
      selectedStockProductId = Number(stockProduct.value || 0) || null;
      renderStock();
    });
    document.addEventListener('stock:show', loadStock);
    document.addEventListener('stock:updated', loadStock);
    pendingBody?.addEventListener('click', event => {
      const button = event.target.closest('[data-collect-pending]');
      if (button) openPendingCollection(button.dataset.collectPending);
    });
    pendingCollectSave?.addEventListener('click', savePendingCollection);
    pendingSearch?.addEventListener('input', renderPending);
    pendingBack?.addEventListener('click', showPendingList);
    pendingRetry?.addEventListener('click', loadPending);
    pendingReviewCash?.addEventListener('click', () => {
      pendingCashCheck += 1;
      pendingCollectModal.style.display = 'none';
      document.getElementById('dashboard-fecha').value = today();
      document.querySelector('.workspace-sidebar [data-admin-section="cash"]').click();
    });
    document.querySelectorAll('[data-open-pending]').forEach(button => {
      button.addEventListener('click', openPendingModal);
      if (button.tagName !== 'BUTTON') button.addEventListener('keydown', event => {
        if (['Enter', ' '].includes(event.key)) { event.preventDefault(); button.click(); }
      });
    });
    pendingCollectModal.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !pendingSaving) {
        event.preventDefault();
        pendingCollectModal.style.display = 'none';
        pendingCashButton.focus();
      }
      if (event.key === 'Tab') {
        const controls = [...pendingCollectModal.querySelectorAll('button:not(:disabled), input:not(:disabled)')].filter(el => el.getClientRects().length);
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    });
    pendingCollectModal.querySelectorAll('[data-close-modal]').forEach(button => button.addEventListener('click', () => pendingCashButton.focus()));
    document.addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && pendingCollectModal.style.display === 'flex' && !pendingListPanel.hidden) {
        event.preventDefault();
        pendingSearch?.focus();
      }
    });
    document.addEventListener('admin-section:show', event => {
      classDetail.hide();
      if (event.detail?.section === 'classes') {
        // Profesores y detalle son subrutas: al volver desde la barra lateral la
        // agenda siempre debe ser el punto de entrada de Clases.
        showClassesScreen('agenda');
        Promise.all([loadLocations(), loadClasses()]);
      }
      if (event.detail?.section === 'locations') loadStock();
    });
    document.addEventListener('admin-dashboard:show', loadPending);
    return refreshAll();
  }

  return { init, refreshAll };
}

window.createAdminOperationsController = createAdminOperationsController;
