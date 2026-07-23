function createAdminOperationsController({ shared }) {
  const classesList = document.getElementById('classes-list');
  const classesEmpty = document.getElementById('classes-empty');
  const classesTodayCount = document.getElementById('classes-today-count');
  const classesEnrolledCount = document.getElementById('classes-enrolled-count');
  const classesProfessorsCount = document.getElementById('classes-professors-count');
  const classDetailTitle = document.getElementById('class-detail-title');
  const classDetailMeta = document.getElementById('class-detail-meta');
  const classDetailEmpty = document.getElementById('class-detail-empty');
  const classEnrollmentList = document.getElementById('class-enrollment-list');
  const classEnrollOpen = document.getElementById('class-enroll-open');
  const classEnrollSummary = document.getElementById('class-enroll-summary');
  const classEnrollMember = document.getElementById('class-enroll-member');
  const classEnrollSearch = document.getElementById('class-enroll-search');
  const classEnrollResults = document.getElementById('class-enroll-results');
  const classEnrollSave = document.getElementById('class-enroll-save');
  const classesRefresh = document.getElementById('classes-refresh');
  const modalNewClass = document.getElementById('modal-nueva-clase');
  const modalEnrollClass = document.getElementById('modal-inscribir-clase');
  const classSave = document.getElementById('class-save');
  const classCoach = document.getElementById('class-coach');
  const classLocal = document.getElementById('class-local');
  const classEnrollHelp = document.getElementById('class-enroll-help');
  const professorsList = document.getElementById('professors-list');
  const professorsEmpty = document.getElementById('professors-empty');
  const professorsCount = document.getElementById('professors-count');
  const professorModal = document.getElementById('modal-profesor');
  const professorId = document.getElementById('professor-id');
  const professorName = document.getElementById('professor-name');
  const professorPin = document.getElementById('professor-pin');
  const professorPinHelp = document.getElementById('professor-pin-help');
  const professorActive = document.getElementById('professor-active');
  const professorSave = document.getElementById('professor-save');
  const openTabletButton = document.getElementById('classes-open-tablet');

  const stockQuantity = document.getElementById('stock-transfer-quantity');
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

  let classes = [];
  let professors = [];
  let locations = [];
  let selectedClass = null;
  let enrollments = new Map();
  let enrollmentUsers = [];
  let stock = [];
  let selectedStockProductId = null;
  let pendingSales = [];
  let pendingSaleSelected = null;

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

  function money(value) {
    return new Intl.NumberFormat('es-UY', {
      style: 'currency',
      currency: 'UYU',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(value || 0));
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
      { id: 1, nombre: 'Santiago', activo: true, pinConfigurado: true },
      { id: 2, nombre: 'Valentina', activo: true, pinConfigurado: true },
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
    const selectedValue = classCoach.value;
    const activeProfessors = professors.filter(item => item.activo === true || Number(item.activo) === 1);
    classCoach.innerHTML = '<option value="">Seleccionar profesor</option>';
    activeProfessors.forEach(item => {
      const option = document.createElement('option');
      option.value = String(item.id);
      option.textContent = item.nombre;
      classCoach.appendChild(option);
    });
    if ([...classCoach.options].some(option => option.value === selectedValue)) classCoach.value = selectedValue;
  }

  function renderProfessors() {
    if (!professorsList || !professorsEmpty || !professorsCount) return;
    professorsList.innerHTML = '';
    professorsEmpty.style.display = professors.length ? 'none' : 'grid';
    const activeCount = professors.filter(item => item.activo === true || Number(item.activo) === 1).length;
    professorsCount.textContent = `${activeCount} ${activeCount === 1 ? 'activo' : 'activos'}`;
    if (classesProfessorsCount) classesProfessorsCount.textContent = String(activeCount);
    professors.forEach(item => {
      const active = item.activo === true || Number(item.activo) === 1;
      const row = document.createElement('article');
      row.className = `professor-row${active ? '' : ' is-inactive'}`;
      const identity = document.createElement('div');
      identity.className = 'professor-identity';
      const initials = item.nombre.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
      identity.innerHTML = `<span class="professor-avatar">${initials}</span>`;
      const copy = document.createElement('span');
      const name = document.createElement('strong');
      name.textContent = item.nombre;
      const detail = document.createElement('small');
      detail.textContent = item.pinConfigurado ? 'PIN configurado' : 'PIN pendiente';
      copy.append(name, detail);
      identity.appendChild(copy);
      const status = document.createElement('span');
      status.className = `professor-status${active ? ' is-active' : ''}`;
      status.textContent = active ? 'Activo' : 'Inactivo';
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'table-action-button';
      edit.dataset.editProfessor = String(item.id);
      edit.textContent = 'Editar';
      row.append(identity, status, edit);
      professorsList.appendChild(row);
    });
  }

  function setProfessorModalTitle(text) {
    const refinedTitle = professorModal?.querySelector('.modal-title-copy > span');
    const plainTitle = professorModal?.querySelector('.app-modal-header > h3');
    if (refinedTitle) refinedTitle.textContent = text;
    else if (plainTitle) plainTitle.textContent = text;
  }

  function openNewProfessor() {
    professorId.value = '';
    professorName.value = '';
    professorPin.value = '';
    professorActive.checked = true;
    professorActive.disabled = true;
    professorPinHelp.textContent = 'Se usará solamente para identificar al profesor al iniciar su turno.';
    setProfessorModalTitle('Agregar profesor');
  }

  function openEditProfessor(id) {
    const professor = professors.find(item => Number(item.id) === Number(id));
    if (!professor) return;
    professorId.value = String(professor.id);
    professorName.value = professor.nombre;
    professorPin.value = '';
    professorActive.checked = professor.activo === true || Number(professor.activo) === 1;
    professorActive.disabled = false;
    professorPinHelp.textContent = 'Dejá el PIN vacío para conservar el actual.';
    setProfessorModalTitle('Editar profesor');
    professorModal.style.display = 'flex';
  }

  async function saveProfessor() {
    const id = Number(professorId.value || 0);
    const pin = professorPin.value.trim();
    const payload = {
      nombre: professorName.value.trim(),
      activo: professorActive.checked,
    };
    if (pin) payload.pin = pin;
    if (!payload.nombre || (!id && !/^\d{4}$/.test(pin)) || (pin && !/^\d{4}$/.test(pin))) {
      shared.mostrarNotificacion('Ingresá un nombre y un PIN de exactamente 4 números', 'warning');
      return;
    }
    try {
      if (window.api) {
        if (id) await window.api.actualizarProfesor(id, payload);
        else await window.api.crearProfesor(payload);
      } else if (id) {
        const current = professors.find(item => Number(item.id) === id);
        Object.assign(current, payload, { pinConfigurado: true });
      } else {
        professors.push({ id: Date.now(), ...payload, activo: true, pinConfigurado: true });
      }
      professorModal.style.display = 'none';
      shared.mostrarNotificacion(id ? 'Profesor actualizado' : 'Profesor agregado', 'success');
      await loadProfessors();
    } catch (error) {
      shared.mostrarNotificacion(error?.message || 'No se pudo guardar el profesor', 'error');
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

  async function loadClasses() {
    try {
      if (window.api) classes = await window.api.obtenerClasesProximas(today());
      else if (!classes.length) classes = demoClasses();
    } catch (error) {
      console.error('No se pudieron cargar las clases:', error);
      classes = [];
      shared.mostrarNotificacion('No se pudieron cargar las clases', 'error');
    }
    renderClasses();
  }

  function renderClasses() {
    if (!classesList || !classesEmpty) return;
    const upcomingClasses = [...classes]
      .sort((a, b) => `${a.fecha}T${a.hora || '00:00'}`.localeCompare(`${b.fecha}T${b.hora || '00:00'}`));
    classesList.innerHTML = '';
    classesEmpty.style.display = upcomingClasses.length ? 'none' : 'grid';
    classesTodayCount.textContent = String(upcomingClasses.filter(item => item.fecha === today()).length);
    const groups = new Map();
    upcomingClasses.forEach(item => {
      const key = item.programacionId ? `schedule-${item.programacionId}` : `class-${item.id}`;
      if (!groups.has(key)) groups.set(key, item);
    });
    const groupRows = [...groups.values()];
    classesEnrolledCount.textContent = String(groupRows.reduce((sum, item) => sum + Number(item.inscriptos || 0), 0));

    upcomingClasses.forEach(item => {
      const date = shortDate(item.fecha);
      const available = Math.max(0, Number(item.capacidad || 0) - Number(item.inscriptos || 0));
      const row = document.createElement('button');
      row.type = 'button';
      row.className = `class-row${selectedClass?.id === item.id ? ' is-selected' : ''}`;
      row.dataset.classId = String(item.id);
      row.innerHTML = `
        <span class="class-date-badge"><strong>${date.day}</strong><span>${date.month}</span></span>
        <span class="class-row-title"><strong>${item.nombre}</strong><span class="class-row-meta"><i class="fa-regular fa-clock"></i> ${item.hora} · ${item.duracionMinutos || 60} min${item.diasSemana ? ` · ${formatWeekdays(item.diasSemana)}` : ''}</span></span>
        <span class="class-row-title"><strong>${item.profesor}</strong><span class="class-row-meta">${item.localNombre || 'Profesor'}</span></span>
        <span class="class-capacity"><strong>${item.inscriptos || 0}/${item.capacidad}</strong><br>${available} cupos</span>
        <i class="fa-solid fa-chevron-right"></i>
      `;
      row.addEventListener('click', () => selectClass(item.id));
      classesList.appendChild(row);
    });
  }

  async function selectClass(classId) {
    selectedClass = classes.find(item => Number(item.id) === Number(classId)) || null;
    renderClasses();
    if (!selectedClass) return;
    classDetailTitle.textContent = selectedClass.nombre;
    const recurrence = selectedClass.diasSemana ? ` · ${formatWeekdays(selectedClass.diasSemana)}` : '';
    classDetailMeta.textContent = `${formatDateTime(selectedClass.fecha, selectedClass.hora)} · ${selectedClass.profesor} · ${selectedClass.localNombre || 'Local 2'}${recurrence}`;
    classEnrollOpen.innerHTML = selectedClass.programacionId
      ? '<i class="fa-solid fa-user-plus"></i>Inscribir al grupo'
      : '<i class="fa-solid fa-user-plus"></i>Inscribir socio';
    classEnrollOpen.disabled = Number(selectedClass.inscriptos || 0) >= Number(selectedClass.capacidad || 0);
    classDetailEmpty.style.display = 'none';
    try {
      const list = window.api
        ? await window.api.obtenerInscripcionesClase(selectedClass.id)
        : (enrollments.get(Number(selectedClass.id)) || [
            { usuarioCi: 49876543, usuarioNombre: 'Martina Silva' },
            { usuarioCi: 43219876, usuarioNombre: 'Bruno Rodriguez' },
            { usuarioCi: 51234567, usuarioNombre: 'Lucas Pereira' },
            { usuarioCi: 56781234, usuarioNombre: 'Diego Martínez' },
            { usuarioCi: 37654321, usuarioNombre: 'Camila Fernández' },
            { usuarioCi: 40127896, usuarioNombre: 'Valentina Suárez' },
            { usuarioCi: 48723901, usuarioNombre: 'Federico Núñez' },
            { usuarioCi: 39281745, usuarioNombre: 'Lucía Ramos' },
          ]).slice(0, Number(selectedClass.inscriptos || 0));
      renderEnrollments(list);
    } catch (error) {
      renderEnrollments([]);
    }
  }

  function renderEnrollments(items) {
    classEnrollmentList.innerHTML = '';
    if (!items.length) {
      classEnrollmentList.innerHTML = '<div class="surface-empty compact"><i class="fa-solid fa-user-plus"></i><span>Todavía no hay alumnos inscriptos.</span></div>';
      return;
    }
    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'class-enrollment-item';
      row.innerHTML = `<i class="fa-solid fa-circle-check"></i><span><strong>${item.usuarioNombre}</strong><small>CI ${item.usuarioCi}</small></span>`;
      classEnrollmentList.appendChild(row);
    });
  }

  async function saveClass() {
    const selectedProfessor = professors.find(item => String(item.id) === classCoach.value);
    const diasSemana = [...document.querySelectorAll('input[name="class-weekday"]:checked')]
      .map(input => Number(input.value));
    const payload = {
      nombre: document.getElementById('class-name').value.trim(),
      profesorId: Number(classCoach.value || 0),
      profesor: selectedProfessor?.nombre || '',
      localId: Number(classLocal.value || 0),
      diasSemana,
      fechaInicio: document.getElementById('class-start-date').value,
      fechaFin: document.getElementById('class-end-date').value || null,
      hora: document.getElementById('class-time').value,
      capacidad: Number(document.getElementById('class-capacity').value || 0),
      duracionMinutos: Number(document.getElementById('class-duration').value || 60),
      notas: document.getElementById('class-notes').value.trim(),
    };
    if (!payload.nombre || !payload.profesorId || !payload.localId || !payload.fechaInicio || !payload.hora || !payload.diasSemana.length || payload.capacidad <= 0) {
      shared.mostrarNotificacion('Completá nombre, local, profesor, días, horario y cupos', 'warning');
      return;
    }
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
    }
  }

  async function openEnrollment() {
    if (!selectedClass) return;
    classEnrollSummary.innerHTML = `<span>${selectedClass.programacionId ? 'Grupo seleccionado' : 'Clase seleccionada'}</span><strong>${selectedClass.nombre}</strong><span>${formatDateTime(selectedClass.fecha, selectedClass.hora)} · ${selectedClass.profesor}${selectedClass.diasSemana ? ` · ${formatWeekdays(selectedClass.diasSemana)}` : ''}</span>`;
    if (classEnrollHelp) classEnrollHelp.textContent = selectedClass.programacionId
      ? 'El socio quedará inscripto en todas las próximas fechas de esta programación.'
      : 'La inscripción corresponde solamente a esta fecha.';
    classEnrollMember.value = '';
    classEnrollSearch.value = '';
    classEnrollResults.innerHTML = '';
    try {
      enrollmentUsers = window.api ? await window.api.obtenerUsuarios() : [
        { ci: 49876543, nombre: 'Martina Silva', fecha_vencimiento: '2026-08-11' },
        { ci: 43219876, nombre: 'Bruno Rodriguez', fecha_vencimiento: '2026-08-20' },
        { ci: 51234567, nombre: 'Lucas Pereira', fecha_vencimiento: '2026-08-30' },
        { ci: 56781234, nombre: 'Diego Martinez', fecha_vencimiento: '2026-10-16' },
      ];
      renderEnrollmentSearch('');
      modalEnrollClass.style.display = 'flex';
      setTimeout(() => classEnrollSearch.focus(), 50);
    } catch (error) {
      shared.mostrarNotificacion('No se pudieron cargar los socios', 'error');
    }
  }

  function renderEnrollmentSearch(filter = '') {
    const query = filter.trim().toLocaleLowerCase('es');
    const visible = shared.ordenarSociosPorVencimiento(enrollmentUsers)
      .filter(user => !query || String(user.ci).includes(query) || String(user.nombre || '').toLocaleLowerCase('es').includes(query))
      .slice(0, 8);
    classEnrollResults.innerHTML = '';
    visible.forEach(user => {
      const active = shared.esMembresiaActiva(user.fecha_vencimiento);
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.enrollMember = String(user.ci);
      button.className = Number(classEnrollMember.value) === Number(user.ci) ? 'is-selected' : '';
      const identity = document.createElement('span');
      const name = document.createElement('strong');
      const detail = document.createElement('small');
      name.textContent = user.nombre;
      detail.textContent = `CI ${user.ci}`;
      identity.append(name, detail);
      const status = document.createElement('span');
      status.className = `member-search-status${active ? ' is-active' : ''}`;
      status.textContent = active ? 'Activo' : 'Vencido';
      button.append(identity, status);
      classEnrollResults.appendChild(button);
    });
    if (!visible.length) classEnrollResults.innerHTML = '<div class="modal-search-empty">No se encontraron socios.</div>';
  }

  async function saveEnrollment() {
    const userCi = Number(classEnrollMember.value || 0);
    if (!selectedClass || !userCi) {
      shared.mostrarNotificacion('Seleccioná un socio', 'warning');
      return;
    }
    try {
      if (window.api) {
        await window.api.inscribirSocioClase({ classId: selectedClass.id, userCi });
      } else {
        const userName = enrollmentUsers.find(user => Number(user.ci) === userCi)?.nombre || String(userCi);
        const list = enrollments.get(Number(selectedClass.id)) || [];
        if (!list.some(item => Number(item.usuarioCi) === userCi)) list.push({ usuarioCi: userCi, usuarioNombre: userName });
        enrollments.set(Number(selectedClass.id), list);
        selectedClass.inscriptos = Number(selectedClass.inscriptos || 0) + 1;
      }
      modalEnrollClass.style.display = 'none';
      shared.mostrarNotificacion(selectedClass.programacionId ? 'Socio inscripto al grupo' : 'Socio inscripto', 'success');
      await loadClasses();
      await selectClass(selectedClass.id);
    } catch (error) {
      shared.mostrarNotificacion(error?.message || 'No se pudo inscribir al socio', 'warning');
    }
  }

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
    stock.forEach(item => {
      const tr = document.createElement('tr');
      tr.dataset.stockProduct = String(item.productoId);
      tr.tabIndex = 0;
      tr.classList.toggle('is-selected', Number(item.productoId) === Number(selectedStockProductId));
      tr.innerHTML = `<td><strong>${item.nombre}</strong></td><td>${money(item.precio)}</td><td><span class="stock-local-two">${item.local2}</span></td><td>${item.local1}</td>`;
      const selectRow = () => {
        selectedStockProductId = Number(item.productoId);
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
    stockUpdated.textContent = `Actualizado ${new Date().toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' })}`;
    updateStockAvailability();
  }

  function updateStockAvailability() {
    const item = stock.find(row => Number(row.productoId) === Number(selectedStockProductId));
    stockAvailability.querySelector('strong').textContent = item?.nombre || 'Ninguno';
    const detail = stockAvailability.querySelector('small');
    if (detail) detail.textContent = item ? `${item.local1} unidades disponibles en Local 1` : 'Selecciona una fila de la tabla';
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
      pendingSales = window.api ? await window.api.obtenerVentasPendientes() : demoPending();
    } catch (error) {
      pendingSales = [];
    }
    renderPending();
  }

  function renderPending() {
    if (!pendingBody) return;
    const empty = document.querySelector('.pending-empty-state');
    pendingBody.innerHTML = '';
    empty.style.display = pendingSales.length ? 'none' : 'grid';
    const total = pendingSales.reduce((sum, item) => sum + Number(item.total || 0), 0);
    pendingTotal.textContent = money(total);
    pendingNavCount.textContent = String(pendingSales.length);
    pendingHomeCount.textContent = String(pendingSales.length);
    pendingCashTotal.textContent = money(total);
    pendingCashCount.textContent = `${pendingSales.length} ${pendingSales.length === 1 ? 'venta' : 'ventas'}`;
    pendingSales.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${formatDateTime(item.fecha, item.hora)}</td>
        <td><strong>${item.usuarioNombre}</strong></td>
        <td>${item.productoNombre}${Number(item.cantidad || 1) > 1 ? ` × ${item.cantidad}` : ''}</td>
        <td><span class="pending-registered"><strong>${item.profesor}</strong><small>${item.localNombre || `Local ${item.localId || 2}`}</small></span></td>
        <td><strong>${money(item.total)}</strong></td>
        <td><span class="pending-status-pill">Pendiente</span></td>
        <td><button class="table-action-button primary" type="button" data-collect-pending="${item.id}">Cobrar</button></td>
      `;
      pendingBody.appendChild(tr);
    });
  }

  function openPendingCollection(id) {
    pendingSaleSelected = pendingSales.find(item => Number(item.id) === Number(id)) || null;
    if (!pendingSaleSelected) return;
    pendingCollectSummary.innerHTML = `<span>Venta de ${pendingSaleSelected.productoNombre}</span><strong>${money(pendingSaleSelected.total)}</strong><span>${pendingSaleSelected.usuarioNombre} · ${pendingSaleSelected.localNombre || `Local ${pendingSaleSelected.localId || 2}`} · registrado por ${pendingSaleSelected.profesor}</span>`;
    pendingCollectNote.value = '';
    document.querySelectorAll('input[name="pending-payment-method"]').forEach(input => { input.checked = input.value === 'efectivo'; });
    pendingCollectModal.style.display = 'flex';
  }

  async function savePendingCollection() {
    if (!pendingSaleSelected) return;
    const formaPago = document.querySelector('input[name="pending-payment-method"]:checked')?.value || 'efectivo';
    try {
      if (window.api) {
        await window.api.cobrarVentaPendiente({ id: pendingSaleSelected.id, formaPago, observacion: pendingCollectNote.value.trim() });
      } else {
        pendingSales = pendingSales.filter(item => Number(item.id) !== Number(pendingSaleSelected.id));
      }
      pendingCollectModal.style.display = 'none';
      shared.mostrarNotificacion('Cobro ingresado a caja', 'success');
      if (window.api) await loadPending(); else renderPending();
      document.dispatchEvent(new CustomEvent('cash:updated'));
    } catch (error) {
      shared.mostrarNotificacion(error?.message || 'No se pudo registrar el cobro', 'warning');
    }
  }

  function initializeNewClassDefaults() {
    const dateInput = document.getElementById('class-start-date');
    const timeInput = document.getElementById('class-time');
    if (dateInput && !dateInput.value) dateInput.value = today();
    if (timeInput && !timeInput.value) timeInput.value = '18:00';
  }

  async function refreshAll() {
    await Promise.all([loadProfessors(), loadLocations()]);
    await Promise.all([loadClasses(), loadStock(), loadPending()]);
  }

  function init() {
    initializeNewClassDefaults();
    document.querySelector('[data-open-modal="modal-profesor"]')?.addEventListener('click', openNewProfessor);
    professorSave?.addEventListener('click', saveProfessor);
    professorsList?.addEventListener('click', event => {
      const button = event.target.closest('[data-edit-professor]');
      if (button) openEditProfessor(button.dataset.editProfessor);
    });
    classSave?.addEventListener('click', saveClass);
    classEnrollOpen?.addEventListener('click', openEnrollment);
    classEnrollSave?.addEventListener('click', saveEnrollment);
    classEnrollSearch?.addEventListener('input', () => {
      classEnrollMember.value = '';
      renderEnrollmentSearch(classEnrollSearch.value);
    });
    classEnrollResults?.addEventListener('click', event => {
      const button = event.target.closest('[data-enroll-member]');
      if (!button) return;
      const user = enrollmentUsers.find(item => Number(item.ci) === Number(button.dataset.enrollMember));
      if (!user) return;
      classEnrollMember.value = String(user.ci);
      classEnrollSearch.value = `${user.nombre} · ${user.ci}`;
      renderEnrollmentSearch(user.nombre);
    });
    classesRefresh?.addEventListener('click', loadClasses);
    openTabletButton?.addEventListener('click', async () => {
      if (window.api?.abrirPantallaTablet) await window.api.abrirPantallaTablet();
      else window.open('tablet.html', 'underfit-tablet-preview', 'width=1100,height=780');
    });
    stockTransferSubmit?.addEventListener('click', transferStock);
    document.addEventListener('stock:show', loadStock);
    document.addEventListener('stock:updated', loadStock);
    pendingBody?.addEventListener('click', event => {
      const button = event.target.closest('[data-collect-pending]');
      if (button) openPendingCollection(button.dataset.collectPending);
    });
    pendingCollectSave?.addEventListener('click', savePendingCollection);
    document.addEventListener('admin-section:show', event => {
      if (event.detail?.section === 'classes') Promise.all([loadProfessors(), loadLocations(), loadClasses()]);
      if (event.detail?.section === 'locations') loadStock();
      if (event.detail?.section === 'pending') loadPending();
    });
    document.addEventListener('admin-dashboard:show', loadPending);
    return refreshAll();
  }

  return { init, refreshAll };
}

window.createAdminOperationsController = createAdminOperationsController;
