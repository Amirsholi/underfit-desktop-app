function createAdminRecordsController({ shared }) {
  const view = document.querySelector('[data-admin-view="records"]');
  const dateInput = document.getElementById('records-date');
  const refreshButton = document.getElementById('records-refresh');
  const tabButtons = Array.from(document.querySelectorAll('[data-records-tab]'));
  const panels = Array.from(document.querySelectorAll('[data-records-panel]'));
  const entryBody = document.getElementById('records-entry-body');
  const entryEmpty = document.getElementById('records-entry-empty');
  const entryStatus = document.getElementById('records-entry-status');
  const classBody = document.getElementById('records-class-body');
  const classEmpty = document.getElementById('records-class-empty');
  const detailTitle = document.getElementById('records-detail-title');
  const detailMeta = document.getElementById('records-detail-meta');
  const detailSummary = document.getElementById('records-detail-summary');
  const detailRoster = document.getElementById('records-detail-roster');
  const detailEmpty = document.getElementById('records-detail-empty');
  const entryCount = document.getElementById('records-entry-count');
  const classCount = document.getElementById('records-class-count');
  const attendanceCount = document.getElementById('records-attendance-count');
  let entries = new Map();
  let classes = [];
  let selectedClassId = null;
  let selectedClassDetail = null;
  let activeTab = 'entries';

  const demoEntries = [
    { id: 1, hora: '08:04', ci: 49876543, nombre: 'Martina Silva', localNombre: 'Recepción principal', fuente: 'tablet_clase', claseNombre: 'Funcional mañana' },
    { id: 2, hora: '08:16', ci: 43219876, nombre: 'Bruno Rodríguez', localNombre: 'Recepción principal', fuente: 'kiosk' },
    { id: 3, hora: '09:42', ci: 51234567, nombre: 'Lucas Pereira', localNombre: 'Salón funcional', fuente: 'tablet_clase', claseNombre: 'Funcional mañana' },
    { id: 4, hora: '17:10', ci: 37654321, nombre: 'Camila Fernández', localNombre: 'Recepción principal', fuente: 'recepcion' },
  ];
  const demoClasses = [
    { id: 1, nombre: 'Funcional mañana', hora: '08:00', duracionMinutos: 60, localNombre: 'Salón funcional', profesorProgramado: 'Santiago Lima', presentes: 9, inscriptos: 12, estado: 'dictada' },
    { id: 2, nombre: 'Funcional tarde', hora: '17:00', duracionMinutos: 60, localNombre: 'Recepción principal', profesorProgramado: 'Santiago Lima', presentes: 0, inscriptos: 8, estado: 'programada' },
    { id: 3, nombre: 'Circuito nocturno', hora: '20:00', duracionMinutos: 45, localNombre: 'Salón funcional', profesorProgramado: 'Martín Cabrera', presentes: 0, inscriptos: 6, estado: 'cancelada' },
  ];

  function today() {
    const date = new Date();
    const pad = value => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
    })[character]);
  }

  function sourceLabel(row) {
    if (row.claseNombre) return `<span class="record-origin-icon class"><i class="fa-solid fa-people-group"></i></span><span><strong>${escapeHtml(row.claseNombre)}</strong><small>Asistencia a clase</small></span>`;
    const labels = {
      kiosk: ['fa-keyboard', 'Pantalla de ingreso'],
      recepcion: ['fa-desktop', 'Recepción'],
      tablet_clase: ['fa-tablet-screen-button', 'Tablet de clase'],
    };
    const [icon, label] = labels[row.fuente] || ['fa-door-open', 'Ingreso general'];
    return `<span class="record-origin-icon"><i class="fa-solid ${icon}"></i></span><span><strong>${label}</strong><small>${escapeHtml(row.fuente || 'registro')}</small></span>`;
  }

  function classState(state) {
    const labels = {
      programada: 'Programada',
      en_curso: 'En curso',
      dictada: 'Realizada',
      cancelada: 'No se dio',
    };
    return labels[state] || state || 'Programada';
  }

  function renderEntries(rows) {
    entries = new Map(rows.map(row => [Number(row.id), row]));
    entryBody.innerHTML = '';
    entryEmpty.style.display = rows.length ? 'none' : 'grid';
    entryStatus.textContent = `${rows.length} ${rows.length === 1 ? 'ingreso' : 'ingresos'}`;
    entryCount.textContent = String(rows.length);
    rows.forEach(row => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong class="record-time">${escapeHtml(String(row.hora || '—').slice(0, 5))}</strong></td>
        <td><span class="record-person"><span class="record-avatar">${escapeHtml(String(row.nombre || '?').split(/\s+/).slice(0, 2).map(part => part[0]).join(''))}</span><span><strong>${escapeHtml(row.nombre || 'Socio sin nombre')}</strong><small>CI ${escapeHtml(row.ci || '—')}</small></span></span></td>
        <td><span class="record-location"><i class="fa-solid fa-location-dot"></i>${escapeHtml(row.localNombre || 'Recepción principal')}</span></td>
        <td><span class="record-origin">${sourceLabel(row)}</span></td>
        <td>${dateInput.value === today() ? `<button class="row-more-action" type="button" data-annul-entry="${Number(row.id)}" title="Anular registro"><i class="fa-solid fa-ellipsis"></i></button>` : ''}</td>
      `;
      entryBody.appendChild(tr);
    });
  }

  function renderClasses(rows) {
    classes = rows;
    classBody.innerHTML = '';
    classEmpty.style.display = rows.length ? 'none' : 'grid';
    classCount.textContent = String(rows.length);
    attendanceCount.textContent = String(rows.reduce((total, row) => total + Number(row.presentes || 0), 0));
    rows.forEach(row => {
      const tr = document.createElement('tr');
      tr.className = Number(row.id) === Number(selectedClassId) ? 'is-selected' : '';
      tr.dataset.classRecord = row.id;
      tr.tabIndex = 0;
      tr.innerHTML = `
        <td><strong class="record-time">${escapeHtml(String(row.hora || '—').slice(0, 5))}</strong><small>${Number(row.duracionMinutos || 60)} min</small></td>
        <td><strong>${escapeHtml(row.nombre)}</strong><small><i class="fa-solid fa-location-dot"></i>${escapeHtml(row.localNombre || `Local ${row.localId || '—'}`)}</small></td>
        <td><strong>${escapeHtml(row.profesorProgramado || 'Sin asignar')}</strong><small>Profesor asignado</small></td>
        <td><strong>${Number(row.presentes || 0)} <span>/ ${Number(row.inscriptos || 0)}</span></strong><small>presentes</small></td>
        <td><span class="class-state state-${escapeHtml(row.estado || 'programada')}">${classState(row.estado)}</span></td>
      `;
      classBody.appendChild(tr);
    });
  }

  function demoDetail(classId) {
    const row = demoClasses.find(item => Number(item.id) === Number(classId));
    if (!row) return null;
    return {
      ...row,
      students: row.id === 1
        ? [
            { usuarioCi: 49876543, usuarioNombre: 'Martina Silva', presente: true, horaIngreso: '08:04' },
            { usuarioCi: 43219876, usuarioNombre: 'Bruno Rodríguez', presente: true, horaIngreso: '08:07' },
            { usuarioCi: 51234567, usuarioNombre: 'Lucas Pereira', presente: true, horaIngreso: '08:09' },
            { usuarioCi: 56781234, usuarioNombre: 'Diego Martínez', presente: true, horaIngreso: '08:10' },
            { usuarioCi: 37654321, usuarioNombre: 'Camila Fernández', presente: true, horaIngreso: '08:12' },
            { usuarioCi: 48561237, usuarioNombre: 'Sofía Cabrera', presente: true, horaIngreso: '08:13' },
            { usuarioCi: 45219876, usuarioNombre: 'Nicolás Silva', presente: true, horaIngreso: '08:15' },
            { usuarioCi: 51987654, usuarioNombre: 'Lucía Fernández', presente: true, horaIngreso: '08:16' },
            { usuarioCi: 49321567, usuarioNombre: 'Mateo Pereira', presente: true, horaIngreso: '08:18' },
            { usuarioCi: 46789123, usuarioNombre: 'Julieta Suárez', presente: false },
            { usuarioCi: 53678912, usuarioNombre: 'Agustín López', presente: false },
            { usuarioCi: 47896521, usuarioNombre: 'Florencia Núñez', presente: false },
          ]
        : row.id === 2
          ? [
              { usuarioCi: 37654321, usuarioNombre: 'Camila Fernández', presente: false },
              { usuarioCi: 56781234, usuarioNombre: 'Diego Martínez', presente: false },
              { usuarioCi: 48561237, usuarioNombre: 'Sofía Cabrera', presente: false },
              { usuarioCi: 45219876, usuarioNombre: 'Nicolás Silva', presente: false },
              { usuarioCi: 51987654, usuarioNombre: 'Lucía Fernández', presente: false },
              { usuarioCi: 49321567, usuarioNombre: 'Mateo Pereira', presente: false },
              { usuarioCi: 46789123, usuarioNombre: 'Julieta Suárez', presente: false },
              { usuarioCi: 53678912, usuarioNombre: 'Agustín López', presente: false },
            ]
          : [
              { usuarioCi: 49876543, usuarioNombre: 'Martina Silva', presente: false },
              { usuarioCi: 43219876, usuarioNombre: 'Bruno Rodríguez', presente: false },
              { usuarioCi: 51234567, usuarioNombre: 'Lucas Pereira', presente: false },
              { usuarioCi: 56781234, usuarioNombre: 'Diego Martínez', presente: false },
              { usuarioCi: 37654321, usuarioNombre: 'Camila Fernández', presente: false },
              { usuarioCi: 48561237, usuarioNombre: 'Sofía Cabrera', presente: false },
            ],
    };
  }

  async function showClassDetail(classId) {
    selectedClassId = Number(classId);
    renderClasses(classes);
    detailEmpty.style.display = 'none';
    detailSummary.innerHTML = '<span class="records-loading">Cargando asistencia…</span>';
    detailRoster.innerHTML = '';
    try {
      const detail = window.api?.obtenerDetalleRegistroClase
        ? await window.api.obtenerDetalleRegistroClase(selectedClassId)
        : demoDetail(selectedClassId);
      if (!detail) throw new Error('Clase no encontrada');
      selectedClassDetail = detail;
      const presentCount = detail.students.filter(student => student.presente).length;
      detailTitle.textContent = detail.nombre;
      detailMeta.textContent = `${String(detail.hora || '').slice(0, 5)} · ${detail.localNombre || `Local ${detail.localId}`}`;
      const canCorrectResult = ['dictada', 'cancelada'].includes(detail.estado);
      const nextResult = detail.estado === 'cancelada';
      detailSummary.innerHTML = `
        <article><span>Profesor asignado</span><strong>${escapeHtml(detail.profesorProgramado || 'Sin asignar')}</strong></article>
        <article><span>Estado</span><strong>${escapeHtml(classState(detail.estado))}</strong>${canCorrectResult ? `<button class="record-status-action" type="button" data-class-held="${nextResult ? 'true' : 'false'}">${nextResult ? 'Marcar como realizada' : 'Marcar: no se dio'}</button>` : ''}</article>
        <article><span>Asistencia</span><strong>${presentCount} de ${detail.students.length}</strong></article>
      `;
      detailRoster.innerHTML = detail.students.map(student => `
        <div class="records-roster-row ${student.presente ? 'is-present' : 'is-absent'}">
          <span class="roster-status"><i class="fa-solid ${student.presente ? 'fa-check' : 'fa-minus'}"></i></span>
          <span><strong>${escapeHtml(student.usuarioNombre)}</strong><small>CI ${escapeHtml(student.usuarioCi)}${student.noInscripto ? ' · No estaba inscripto' : ''}</small></span>
          <span>${student.presente ? escapeHtml(String(student.horaIngreso || '').slice(0, 5)) : 'Ausente'}</span>
        </div>
      `).join('') || '<div class="surface-empty compact"><span>No hay alumnos asociados a esta clase.</span></div>';
    } catch (error) {
      console.error('Error cargando detalle de clase:', error);
      selectedClassDetail = null;
      detailSummary.innerHTML = '';
      detailRoster.innerHTML = '<div class="surface-empty compact"><span>No se pudo cargar el detalle.</span></div>';
    }
  }

  async function loadRecords() {
    const date = dateInput.value || today();
    dateInput.value = date;
    refreshButton?.classList.add('is-loading');
    try {
      const [entryRows, classRows] = await Promise.all([
        window.api?.obtenerIngresos ? window.api.obtenerIngresos(date, date) : demoEntries,
        window.api?.obtenerRegistrosClases ? window.api.obtenerRegistrosClases(date) : demoClasses,
      ]);
      const normalizedEntries = Array.isArray(entryRows) ? entryRows : [];
      const normalizedClasses = Array.isArray(classRows) ? classRows : [];
      renderEntries(normalizedEntries);
      renderClasses(normalizedClasses);
      if (selectedClassId && normalizedClasses.some(row => Number(row.id) === Number(selectedClassId))) {
        await showClassDetail(selectedClassId);
      } else {
        selectedClassId = null;
        selectedClassDetail = null;
        detailTitle.textContent = 'Seleccioná una clase';
        detailMeta.textContent = 'El detalle se abre en esta misma página.';
        detailSummary.innerHTML = '';
        detailRoster.innerHTML = '';
        detailEmpty.style.display = 'grid';
      }
    } catch (error) {
      console.error('Error cargando registros:', error);
      shared.mostrarNotificacion(error?.message || 'No se pudieron cargar los registros', 'error');
      renderEntries([]);
      renderClasses([]);
    } finally {
      refreshButton?.classList.remove('is-loading');
    }
  }

  function showTab(tab) {
    activeTab = tab;
    tabButtons.forEach(button => button.classList.toggle('is-active', button.dataset.recordsTab === tab));
    panels.forEach(panel => panel.classList.toggle('is-active', panel.dataset.recordsPanel === tab));
  }

  async function updateClassResult(realizada) {
    if (!selectedClassId || !selectedClassDetail) return;
    const button = detailSummary.querySelector('[data-class-held]');
    if (button) button.disabled = true;
    try {
      if (window.api?.marcarEstadoClase) {
        await window.api.marcarEstadoClase({ claseId: selectedClassId, realizada });
      } else {
        const demoClass = demoClasses.find(item => Number(item.id) === Number(selectedClassId));
        if (demoClass) demoClass.estado = realizada ? 'dictada' : 'cancelada';
      }
      shared.mostrarNotificacion(realizada ? 'Clase marcada como realizada' : 'Clase marcada como no realizada', 'success');
      await loadRecords();
    } catch (error) {
      shared.mostrarNotificacion(error?.message || 'No se pudo actualizar la clase', 'error');
      if (button) button.disabled = false;
    }
  }

  function openAnnulModal(id) {
    const row = entries.get(Number(id));
    if (!row) return;
    document.getElementById('anular-ingreso-id').value = String(row.id);
    document.getElementById('anular-ingreso-detalle').textContent = `${String(row.hora || '').slice(0, 5)} · ${row.ci || '—'} · ${row.nombre || 'Socio'}`;
    document.getElementById('anular-ingreso-motivo').value = '';
    document.getElementById('modal-anular-ingreso').style.display = 'flex';
  }

  function init() {
    if (!view) return;
    dateInput.value = today();
    tabButtons.forEach(button => button.addEventListener('click', () => showTab(button.dataset.recordsTab)));
    refreshButton?.addEventListener('click', loadRecords);
    dateInput.addEventListener('change', loadRecords);
    entryBody.addEventListener('click', event => {
      const button = event.target.closest('[data-annul-entry]');
      if (button) openAnnulModal(button.dataset.annulEntry);
    });
    classBody.addEventListener('click', event => {
      const row = event.target.closest('[data-class-record]');
      if (row) showClassDetail(row.dataset.classRecord);
    });
    classBody.addEventListener('keydown', event => {
      if (!['Enter', ' '].includes(event.key)) return;
      const row = event.target.closest('[data-class-record]');
      if (row) {
        event.preventDefault();
        showClassDetail(row.dataset.classRecord);
      }
    });
    detailSummary.addEventListener('click', event => {
      const button = event.target.closest('[data-class-held]');
      if (button) updateClassResult(button.dataset.classHeld === 'true');
    });
    document.addEventListener('admin-records:show', loadRecords);
    document.addEventListener('entries:updated', loadRecords);
    showTab(activeTab);
  }

  return { init, loadRecords };
}

window.createAdminRecordsController = createAdminRecordsController;
