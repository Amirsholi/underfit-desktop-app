function createAdminOperationsController({ shared }) {
  const classesList = document.getElementById('classes-list');
  const classesEmpty = document.getElementById('classes-empty');
  const classesTodayCount = document.getElementById('classes-today-count');
  const classesEnrolledCount = document.getElementById('classes-enrolled-count');
  const classesCapacityCount = document.getElementById('classes-capacity-count');
  const classDetailTitle = document.getElementById('class-detail-title');
  const classDetailMeta = document.getElementById('class-detail-meta');
  const classDetailEmpty = document.getElementById('class-detail-empty');
  const classEnrollmentList = document.getElementById('class-enrollment-list');
  const classEnrollOpen = document.getElementById('class-enroll-open');
  const classEnrollSummary = document.getElementById('class-enroll-summary');
  const classEnrollMember = document.getElementById('class-enroll-member');
  const classEnrollSave = document.getElementById('class-enroll-save');
  const classesRefresh = document.getElementById('classes-refresh');
  const modalNewClass = document.getElementById('modal-nueva-clase');
  const modalEnrollClass = document.getElementById('modal-inscribir-clase');
  const classSave = document.getElementById('class-save');

  const stockProduct = document.getElementById('stock-transfer-product');
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
  let selectedClass = null;
  let enrollments = new Map();
  let stock = [];
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

  function demoClasses() {
    const base = today();
    return [
      { id: 1, nombre: 'Funcional inicial', fecha: base, hora: '18:00', duracionMinutos: 60, capacidad: 12, profesor: 'Santiago', inscriptos: 6 },
      { id: 2, nombre: 'Funcional intenso', fecha: base, hora: '19:15', duracionMinutos: 60, capacidad: 10, profesor: 'Santiago', inscriptos: 8 },
      { id: 3, nombre: 'Movilidad y core', fecha: addDays(base, 1), hora: '17:30', duracionMinutos: 45, capacidad: 12, profesor: 'Valentina', inscriptos: 4 },
    ];
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
      { id: 1, fecha: today(), hora: '18:42', usuarioNombre: 'Martina Silva', productoNombre: 'Agua mineral 600 ml', cantidad: 1, profesor: 'Santiago', total: 60, estado: 'pendiente' },
      { id: 2, fecha: today(), hora: '19:08', usuarioNombre: 'Bruno Rodriguez', productoNombre: 'Barrita de cereal chocolate', cantidad: 2, profesor: 'Santiago', total: 140, estado: 'pendiente' },
    ];
  }

  async function loadClasses() {
    try {
      classes = window.api ? await window.api.obtenerClasesProximas(today()) : demoClasses();
    } catch (error) {
      console.error('No se pudieron cargar las clases:', error);
      classes = [];
      shared.mostrarNotificacion('No se pudieron cargar las clases', 'error');
    }
    renderClasses();
  }

  function renderClasses() {
    if (!classesList || !classesEmpty) return;
    classesList.innerHTML = '';
    classesEmpty.style.display = classes.length ? 'none' : 'grid';
    classesTodayCount.textContent = String(classes.filter(item => item.fecha === today()).length);
    classesEnrolledCount.textContent = String(classes.reduce((sum, item) => sum + Number(item.inscriptos || 0), 0));
    classesCapacityCount.textContent = String(classes.reduce((sum, item) => sum + Math.max(0, Number(item.capacidad || 0) - Number(item.inscriptos || 0)), 0));

    classes.forEach(item => {
      const date = shortDate(item.fecha);
      const available = Math.max(0, Number(item.capacidad || 0) - Number(item.inscriptos || 0));
      const row = document.createElement('button');
      row.type = 'button';
      row.className = `class-row${selectedClass?.id === item.id ? ' is-selected' : ''}`;
      row.dataset.classId = String(item.id);
      row.innerHTML = `
        <span class="class-date-badge"><strong>${date.day}</strong><span>${date.month}</span></span>
        <span class="class-row-title"><strong>${item.nombre}</strong><span class="class-row-meta"><i class="fa-regular fa-clock"></i> ${item.hora} · ${item.duracionMinutos || 60} min</span></span>
        <span class="class-row-title"><strong>${item.profesor}</strong><span class="class-row-meta">Profesor</span></span>
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
    classDetailMeta.textContent = `${formatDateTime(selectedClass.fecha, selectedClass.hora)} · ${selectedClass.profesor}`;
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
    const payload = {
      nombre: document.getElementById('class-name').value.trim(),
      profesor: document.getElementById('class-coach').value.trim(),
      fecha: document.getElementById('class-date').value,
      hora: document.getElementById('class-time').value,
      capacidad: Number(document.getElementById('class-capacity').value || 0),
      duracionMinutos: Number(document.getElementById('class-duration').value || 60),
      notas: document.getElementById('class-notes').value.trim(),
    };
    if (!payload.nombre || !payload.profesor || !payload.fecha || !payload.hora || payload.capacidad <= 0) {
      shared.mostrarNotificacion('Completá nombre, profesor, fecha, hora y cupos', 'warning');
      return;
    }
    try {
      if (window.api) {
        await window.api.crearClase(payload);
      } else {
        classes.push({ id: Date.now(), ...payload, inscriptos: 0 });
      }
      modalNewClass.style.display = 'none';
      shared.mostrarNotificacion('Clase programada', 'success');
      await loadClasses();
    } catch (error) {
      shared.mostrarNotificacion(error?.message || 'No se pudo programar la clase', 'error');
    }
  }

  async function openEnrollment() {
    if (!selectedClass) return;
    classEnrollSummary.innerHTML = `<span>Clase seleccionada</span><strong>${selectedClass.nombre}</strong><span>${formatDateTime(selectedClass.fecha, selectedClass.hora)} · ${selectedClass.profesor}</span>`;
    classEnrollMember.innerHTML = '<option value="">Seleccionar socio</option>';
    try {
      const users = window.api ? await window.api.obtenerUsuarios() : [
        { ci: 49876543, nombre: 'Martina Silva' },
        { ci: 43219876, nombre: 'Bruno Rodriguez' },
        { ci: 51234567, nombre: 'Lucas Pereira' },
        { ci: 56781234, nombre: 'Diego Martinez' },
      ];
      users.forEach(user => {
        const option = document.createElement('option');
        option.value = String(user.ci);
        option.textContent = `${user.nombre} · CI ${user.ci}`;
        classEnrollMember.appendChild(option);
      });
      modalEnrollClass.style.display = 'flex';
    } catch (error) {
      shared.mostrarNotificacion('No se pudieron cargar los socios', 'error');
    }
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
        const text = classEnrollMember.options[classEnrollMember.selectedIndex]?.textContent || String(userCi);
        const userName = text.split(' · ')[0];
        const list = enrollments.get(Number(selectedClass.id)) || [];
        if (!list.some(item => Number(item.usuarioCi) === userCi)) list.push({ usuarioCi: userCi, usuarioNombre: userName });
        enrollments.set(Number(selectedClass.id), list);
        selectedClass.inscriptos = Number(selectedClass.inscriptos || 0) + 1;
      }
      modalEnrollClass.style.display = 'none';
      shared.mostrarNotificacion('Socio inscripto', 'success');
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
    if (!stockBody || !stockProduct) return;
    const selectedValue = stockProduct.value;
    stockBody.innerHTML = '';
    stockProduct.innerHTML = '<option value="">Seleccionar producto</option>';
    stock.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><strong>${item.nombre}</strong></td><td>${money(item.precio)}</td><td>${item.local1}</td><td><span class="stock-local-two">${item.local2}</span></td><td>${item.total}</td>`;
      stockBody.appendChild(tr);
      const option = document.createElement('option');
      option.value = String(item.productoId);
      option.textContent = item.nombre;
      stockProduct.appendChild(option);
    });
    if ([...stockProduct.options].some(option => option.value === selectedValue)) stockProduct.value = selectedValue;
    stockUpdated.textContent = `Actualizado ${new Date().toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' })}`;
    updateStockAvailability();
  }

  function updateStockAvailability() {
    const item = stock.find(row => String(row.productoId) === stockProduct.value);
    stockAvailability.querySelector('strong').textContent = item ? `${item.local1} unidades` : '—';
    if (item) stockQuantity.max = String(item.local1);
  }

  async function transferStock() {
    const productoId = Number(stockProduct.value || 0);
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
        <td>${item.profesor}</td>
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
    pendingCollectSummary.innerHTML = `<span>Venta de ${pendingSaleSelected.productoNombre}</span><strong>${money(pendingSaleSelected.total)}</strong><span>${pendingSaleSelected.usuarioNombre} · registrado por ${pendingSaleSelected.profesor}</span>`;
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
    const dateInput = document.getElementById('class-date');
    const timeInput = document.getElementById('class-time');
    if (dateInput && !dateInput.value) dateInput.value = today();
    if (timeInput && !timeInput.value) timeInput.value = '18:00';
  }

  async function refreshAll() {
    await Promise.all([loadClasses(), loadStock(), loadPending()]);
  }

  function init() {
    initializeNewClassDefaults();
    classSave?.addEventListener('click', saveClass);
    classEnrollOpen?.addEventListener('click', openEnrollment);
    classEnrollSave?.addEventListener('click', saveEnrollment);
    classesRefresh?.addEventListener('click', loadClasses);
    stockProduct?.addEventListener('change', updateStockAvailability);
    stockTransferSubmit?.addEventListener('click', transferStock);
    pendingBody?.addEventListener('click', event => {
      const button = event.target.closest('[data-collect-pending]');
      if (button) openPendingCollection(button.dataset.collectPending);
    });
    pendingCollectSave?.addEventListener('click', savePendingCollection);
    document.addEventListener('admin-section:show', event => {
      if (event.detail?.section === 'classes') loadClasses();
      if (event.detail?.section === 'locations') loadStock();
      if (event.detail?.section === 'pending') loadPending();
    });
    document.addEventListener('admin-dashboard:show', loadPending);
    return refreshAll();
  }

  return { init, refreshAll };
}

window.createAdminOperationsController = createAdminOperationsController;
