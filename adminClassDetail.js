function createAdminClassDetailController({ shared, showScreen, onBack, onUpdated, onEnrollmentChanged }) {
  const byId = id => document.getElementById(id);
  const model = window.classDetailModel;
  const page = byId('class-detail-panel'), body = byId('class-enrollment-list');
  const search = byId('class-detail-search'), empty = byId('class-detail-empty');
  const memberDialog = byId('class-member-dialog');
  const removeDialog = byId('class-remove-dialog');
  let removal = null, removing = false;
  let selected = null, detail = null, generation = 0, dialogStudent = null, rosterFilter = 'all';
  const saving = new Set();
  let mutationRevision = 0;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  function stateLabel(value) { return ({ programada: 'Programada', en_curso: 'En curso', dictada: 'Finalizada', cancelada: 'No se dio' })[value] || 'Programada'; }
  function dateLabel(value) { return new Intl.DateTimeFormat('es-UY', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${value}T12:00:00`)); }
  function timeRange(item) {
    const start = String(item.hora || '').slice(0, 5), [h, m] = start.split(':').map(Number);
    const minutes = h * 60 + m + Number(item.duracionMinutos || 0);
    const end = `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    return Number(item.duracionMinutos) > 0 ? `${start}–${end}` : start;
  }
  function renderHeader(item) {
    byId('class-detail-title').textContent = item.nombre;
    byId('class-detail-meta').textContent = `${dateLabel(item.fecha)} · ${timeRange(item)} · ${item.profesorProgramado || item.profesor || 'Profesor sin asignar'}`;
    byId('class-detail-state').textContent = stateLabel(item.estado);
    byId('class-detail-trial').hidden = !item.esPrueba;
    const enroll = byId('class-enroll-open');
    enroll.querySelector('span').textContent = 'Nuevo Alumno';
    enroll.hidden = ['dictada', 'cancelada', 'en_curso'].includes(item.estado);
    enroll.disabled = !detail || Number(item.inscriptos || 0) >= Number(item.capacidad || 0);
    enroll.title = enroll.disabled && detail ? 'Cupo completo' : '';
    const edit = byId('class-edit-open');
    edit.hidden = item.estado !== 'programada' || item.canEditSchedule !== true;
    byId('class-delete').hidden = !detail?.canDeleteClass;
  }
  function showEmpty(message, retry = false) {
    byId('class-roster-scroll').hidden = true;
    empty.hidden = false;
    empty.innerHTML = `<strong>${escape(message)}</strong>${retry ? '<button class="app-button" type="button" data-class-detail-retry>Reintentar</button>' : ''}`;
  }
  function ratingCell(student) {
    if (!model.isPresent(student)) return '<span class="class-rating-unavailable" aria-label="Sin asistencia: no corresponde evaluar">—</span>';
    if (!model.canRate(detail, student)) return '<span class="class-rating-unavailable">Evaluación no disponible</span>';
    const score = Number(student.puntuacion || 0), busy = saving.has(String(student.asistenciaId));
    return `<div class="class-rating-content"><div class="class-rating" role="group" aria-label="Evaluar a ${escape(student.usuarioNombre)}">
      ${[1, 2, 3, 4, 5].map(value => `<button type="button" data-class-rating="${value}" data-attendance="${escape(student.asistenciaId)}" class="${value <= score ? 'is-filled' : ''}" aria-label="${value} de 5 estrellas" aria-pressed="${value === score}" ${busy ? 'disabled' : ''}><i class="${value <= score ? 'fa-solid' : 'fa-regular'} fa-star" aria-hidden="true"></i></button>`).join('')}
      </div><small class="class-rating-note">${busy ? 'Guardando…' : score ? '' : 'Sin evaluar'}</small></div>`;
  }
  function renderRows() {
    if (!detail) return;
    const students = detail.students || [];
    const evaluation = model.hasEvaluation(detail);
    const canRemove = detail.canRemoveEnrollment === true && detail.estado === 'programada' && typeof window.api?.quitarAlumnoClase === 'function';
    if (!evaluation && rosterFilter === 'unrated') rosterFilter = 'all';
    const visible = model.filterStudents(students, search.value).filter(student => model.matchesFilter(detail, student, rosterFilter));
    page.classList.toggle('has-evaluation', evaluation);
    byId('class-rating-heading').hidden = !evaluation;
    byId('class-remove-heading').hidden = !canRemove;
    page.classList.toggle('has-enrollment-actions', canRemove);
    const present = students.filter(model.isPresent).length, missing = students.length - present;
    byId('class-detail-count').innerHTML = `<span><strong>${students.length}</strong> ${students.length === 1 ? 'socio' : 'socios'}</span><span><strong>${present}</strong> presentes</span>${detail.estado === 'dictada' ? `<span><strong>${missing}</strong> ausentes</span>` : ''}`;
    byId('class-roster-filters').querySelectorAll('[data-roster-filter]').forEach(button => {
      const filter = button.dataset.rosterFilter;
      button.hidden = filter === 'unrated' && !evaluation;
      button.setAttribute('aria-pressed', String(filter === rosterFilter));
      button.querySelector('span').textContent = String(students.filter(student => model.matchesFilter(detail, student, filter)).length);
    });
    body.innerHTML = visible.map(student => {
      const state = model.attendance(detail, student);
      const initials = String(student.usuarioNombre || '').split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase();
      return `<tr data-class-member="${escape(student.usuarioCi)}">
        <td><div class="class-roster-identity"><span class="class-member-avatar" aria-hidden="true">${escape(initials)}</span><span><button class="class-member-name" type="button" aria-label="Ver participación de ${escape(student.usuarioNombre)}">${escape(student.usuarioNombre)}</button><small>CI ${escape(model.identity(student.usuarioCi))}${student.noInscripto ? ' · Sin inscripción previa' : ''}</small></span></div></td>
        <td><span class="class-attendance is-${state.type}">${escape(state.label)}</span>${state.time ? `<span class="class-entry-time">${escape(state.time)}</span>` : ''}</td>
        ${evaluation ? `<td class="class-rating-cell">${ratingCell(student)}</td>` : ''}
        ${canRemove ? `<td class="class-remove-cell">${!student.noInscripto ? `<button type="button" class="class-remove-link" data-remove-student="${escape(student.usuarioCi)}" aria-label="Quitar a ${escape(student.usuarioNombre)} del grupo">Quitar</button>` : ''}</td>` : ''}
      </tr>`;
    }).join('');
    byId('class-roster-scroll').hidden = !visible.length;
    empty.hidden = visible.length > 0;
    if (!visible.length) showEmpty(!students.length ? 'Todavía no hay socios en esta clase.' : search.value.trim() ? 'No encontramos socios con esa búsqueda y filtro.' : rosterFilter === 'unrated' ? 'No quedan socios presentes sin evaluar.' : 'Todavía no hay asistencias registradas.');
  }
  async function show(item, { preserve = false } = {}) {
    const ticket = ++generation;
    selected = { ...item }; detail = null;
    if (!preserve) { search.value = ''; rosterFilter = 'all'; }
    page.hidden = false;
    showScreen('detail');
    page.setAttribute('aria-busy', 'true');
    renderHeader(selected);
    byId('class-detail-count').textContent = '';
    byId('class-roster-filters').querySelectorAll('button').forEach(button => { button.disabled = true; button.querySelector('span').textContent = ''; });
    showEmpty('Cargando socios y asistencia…');
    if (!preserve) byId('class-detail-title').focus({ preventScroll: true });
    try {
      if (!window.api?.obtenerDetalleRegistroClase) throw new Error('No está disponible el servicio de asistencia.');
      const record = await window.api.obtenerDetalleRegistroClase(selected.id);
      if (ticket !== generation) return;
      if (!record || !Array.isArray(record.students)) throw new Error('No se encontró el registro de esta clase.');
      detail = { ...selected, ...record };
      renderHeader(detail); renderRows();
      onUpdated?.(detail);
    } catch (error) {
      if (ticket !== generation) return;
      showEmpty(error.message || 'No se pudo cargar la asistencia.', true);
    } finally {
      if (ticket === generation) {
        page.removeAttribute('aria-busy');
        byId('class-roster-filters').querySelectorAll('button').forEach(button => { button.disabled = !detail; });
      }
    }
  }
  function hide() {
    generation += 1;
    page.removeAttribute('aria-busy');
    if (memberDialog.open) memberDialog.close();
    if (removeDialog.open && !removing) removeDialog.close();
  }
  async function saveRating(button) {
    const attendanceId = button.dataset.attendance, score = Number(button.dataset.classRating);
    const student = detail?.students.find(row => String(row.asistenciaId) === attendanceId);
    if (!student || !model.canRate(detail, student) || saving.has(attendanceId)) return;
    const item = detail, ticket = generation;
    mutationRevision++;
    saving.add(attendanceId); renderRows();
    try {
      await window.api.puntuarAsistenciaClase({ asistenciaId: attendanceId, puntuacion: score, profesorId: item.profesorProgramadoId || item.profesorId });
      student.puntuacion = score;
      byId('class-detail-feedback').textContent = `Evaluación guardada para ${student.usuarioNombre}: ${score} de 5.`;
      shared.mostrarNotificacion('Evaluación guardada', 'success');
    } catch (error) {
      shared.mostrarNotificacion(error.message || 'No se pudo guardar la evaluación', 'error');
    } finally {
      saving.delete(attendanceId);
      if (ticket === generation) {
        renderRows();
        const nextFocus = [...body.querySelectorAll('[data-attendance]')].find(node => node.dataset.attendance === attendanceId && Number(node.dataset.classRating) === score)
          || body.querySelector('[data-class-rating]') || byId('class-roster-filters').querySelector('[aria-pressed="true"]');
        nextFocus?.focus({ preventScroll: true });
      }
    }
  }
  function openMember(identity, trigger) {
    const student = detail?.students.find(row => String(row.usuarioCi) === identity);
    if (!student) return;
    dialogStudent = student;
    const status = model.attendance(detail, student);
    byId('class-member-title').textContent = student.usuarioNombre;
    byId('class-member-ci').textContent = `CI ${model.identity(identity)}`;
    byId('class-member-context').textContent = `${detail.nombre} · ${dateLabel(detail.fecha)}`;
    byId('class-member-facts').innerHTML = `<div><dt>Asistencia</dt><dd class="class-attendance is-${status.type}">${escape(status.label)}</dd></div>
      <div><dt>Ingreso</dt><dd>${escape(status.time || 'Sin registro')}</dd></div>
      <div><dt>Profesor de la clase</dt><dd>${escape(detail.profesorProgramado || detail.profesor || 'Sin asignar')}</dd></div>
      ${detail.esPrueba ? `<div><dt>Evaluación de prueba</dt><dd>${student.puntuacion ? `${Number(student.puntuacion)} de 5` : detail.estado !== 'dictada' ? 'Disponible al finalizar' : model.isPresent(student) ? 'Sin evaluar' : 'Sin asistencia'}</dd></div>` : ''}`;
    const canCorrect = detail.estado === 'dictada' && Number(detail.profesorProgramadoId || detail.profesorId) > 0;
    byId('class-member-correct').hidden = !canCorrect;
    byId('class-member-correct').textContent = model.isPresent(student) ? 'Corregir a ausente' : 'Corregir a presente';
    byId('class-member-correction').hidden = true;
    byId('class-member-reason').value = '';
    byId('class-member-error').textContent = '';
    trigger?.focus({ preventScroll: true }); memberDialog.showModal();
  }
  async function correctAttendance(event) {
    event.preventDefault();
    const reason = byId('class-member-reason').value.trim(), item = detail, student = dialogStudent, ticket = generation;
    if (!reason || !student || item.estado !== 'dictada') return;
    const save = byId('class-member-save'); save.disabled = true;
    try {
      await window.api.corregirAsistenciaClase({ claseId: item.id, usuarioCi: student.usuarioCi, presente: !model.isPresent(student), profesorId: item.profesorProgramadoId || item.profesorId, motivo: reason });
      shared.mostrarNotificacion('Asistencia corregida', 'success');
      if (ticket === generation && dialogStudent === student) {
        memberDialog.close();
        await show(item, { preserve: true });
      }
    } catch (error) { if (ticket === generation && dialogStudent === student) byId('class-member-error').textContent = error.message || 'No se pudo corregir la asistencia.'; }
    finally { save.disabled = false; }
  }
  function openRemoval(identity) {
    const student = detail?.students.find(row => String(row.usuarioCi) === identity);
    if (!student || student.noInscripto || detail.estado !== 'programada' || removing) return;
    removal = { classId: detail.id, userCi: student.usuarioCi, item: { ...detail }, ticket: generation };
    byId('class-remove-description').textContent = `¿Quitar a ${student.usuarioNombre} ${detail.programacionId ? `del grupo ${detail.nombre} y sus próximas clases` : `de la clase ${detail.nombre}`}?`;
    byId('class-remove-confirm').textContent = detail.programacionId ? 'Quitar del grupo' : 'Quitar de la clase';
    byId('class-remove-error').textContent = '';
    removeDialog.showModal();
  }
  async function confirmRemoval() {
    if (!removal || removing) return;
    const pending = removal;
    removing = true;
    byId('class-remove-confirm').disabled = true; byId('class-remove-cancel').disabled = true;
    byId('class-remove-error').textContent = '';
    let saved = false;
    try {
      await window.api.quitarAlumnoClase({ classId: pending.classId, userCi: pending.userCi });
      saved = true;
    } catch (error) { byId('class-remove-error').textContent = error.message || 'No se pudo quitar al alumno. Reintentá.'; }
    finally { removing = false; byId('class-remove-confirm').disabled = false; byId('class-remove-cancel').disabled = false; }
    if (!saved) return;
    removeDialog.close(); removal = null;
    shared.mostrarNotificacion('Alumno retirado. El historial se conserva.', 'success');
    if (pending.ticket === generation) {
      await show(pending.item, { preserve: true });
      search.focus({ preventScroll: true });
    }
    try { await onEnrollmentChanged?.(); } catch (error) { console.error('No se pudo actualizar la agenda tras quitar al alumno.', error); }
  }
  byId('class-remove-cancel').addEventListener('click', () => { if (!removing) removeDialog.close(); });
  byId('class-remove-confirm').addEventListener('click', confirmRemoval);
  removeDialog.addEventListener('cancel', event => { if (removing) event.preventDefault(); });
  byId('class-detail-close').addEventListener('click', () => { hide(); onBack(selected?.id); });
  byId('class-detail-refresh').addEventListener('click', () => selected && show(selected, { preserve: true }));
  byId('class-delete').addEventListener('click', async () => {
    const item = detail;
    if (!item || !await shared.confirmarAccion(`¿Eliminar la clase ${item.nombre} del ${item.fecha}? ${item.programacionId ? 'Se eliminarán también todas las fechas posteriores de esta serie. Las clases anteriores se conservan.' : ''}`)) return;
    const button = byId('class-delete'); button.disabled = true;
    try {
      await window.api.eliminarClase(item.id);
      hide(); onBack(item.id); await onEnrollmentChanged?.();
      shared.mostrarNotificacion('Clase eliminada.', 'success');
    } catch (error) { shared.mostrarNotificacion(error.message || 'No se pudo eliminar la clase.', 'error'); }
    finally { button.disabled = false; }
  });
  empty.addEventListener('click', event => { if (event.target.closest('[data-class-detail-retry]')) show(selected, { preserve: true }); });
  search.addEventListener('input', renderRows);
  byId('class-roster-filters').addEventListener('click', event => {
    const button = event.target.closest('[data-roster-filter]');
    if (!button || !detail) return;
    rosterFilter = button.dataset.rosterFilter;
    renderRows();
    byId('class-roster-scroll').scrollTop = 0;
  });
  body.addEventListener('click', event => {
    const remove = event.target.closest('[data-remove-student]');
    if (remove) { openRemoval(remove.dataset.removeStudent); return; }
    const rating = event.target.closest('[data-class-rating]');
    if (rating) { saveRating(rating); return; }
    if (event.target.closest('.class-rating-cell')) return;
    const row = event.target.closest('[data-class-member]');
    if (row) openMember(row.dataset.classMember, row.querySelector('.class-member-name'));
  });
  byId('class-member-close').addEventListener('click', () => memberDialog.close());
  byId('class-member-correct').addEventListener('click', () => { byId('class-member-correction').hidden = false; byId('class-member-correct').hidden = true; byId('class-member-reason').focus(); });
  byId('class-member-cancel').addEventListener('click', () => { byId('class-member-correction').hidden = true; byId('class-member-correct').hidden = false; byId('class-member-correct').focus(); });
  byId('class-member-correction').addEventListener('submit', correctAttendance);
  window.adminSync?.watch({
    enabled: () => Boolean(window.api && detail && page.classList.contains('is-active') &&
      window.adminSync.active('classes') && !saving.size && !removing && !page.hasAttribute('aria-busy')),
    read: async () => ({ ticket: generation, revision: mutationRevision, record: await window.api.obtenerDetalleRegistroClase(selected.id) }),
    apply: ({ ticket, revision, record }) => {
      if (ticket !== generation || revision !== mutationRevision || !record || !Array.isArray(record.students)) return;
      detail = { ...selected, ...record };
      renderHeader(detail); renderRows(); onUpdated?.(detail);
    },
  });
  return { show, hide };
}
window.createAdminClassDetailController = createAdminClassDetailController;
