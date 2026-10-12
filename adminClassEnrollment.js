function createAdminClassEnrollmentController({ loadUsers, loadEnrollments, save, onSaved, formatSchedule }) {
  const byId = id => document.getElementById(id);
  const modal = byId('modal-inscribir-clase'), search = byId('class-enroll-search');
  const results = byId('class-enroll-results'), submit = byId('class-enroll-save');
  const status = byId('class-enroll-status'), member = byId('class-enroll-member');
  const selection = byId('class-enroll-selection');
  const closeButtons = [...modal.querySelectorAll('[data-close-modal]')];
  let group, users = [], enrolled = new Set(), loading = false, failed = false, saving = false, generation = 0, returnFocus;
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const formatCi = value => String(value).replace(/^(\d)(\d{3})(\d{3})(\d)$/, '$1.$2.$3-$4');
  const isOpen = () => modal.style.display === 'flex';
  function setStatus(message, error = false) {
    status.textContent = message;
    status.classList.toggle('is-error', error);
  }
  function renderSelection() {
    const selectedUser = users.find(user => String(user.ci) === member.value);
    if (!selectedUser) {
      selection.innerHTML = '<span class="class-enroll-selection-empty">Todavía no seleccionaste un alumno.</span>';
      return;
    }
    const initials = String(selectedUser.nombre || '').trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('');
    selection.innerHTML = `<span class="class-enroll-avatar" aria-hidden="true">${escape(initials)}</span><span class="class-enroll-identity"><strong>${escape(selectedUser.nombre)}</strong><small>CI ${escape(formatCi(selectedUser.ci))}</small></span><button type="button" data-enroll-change>Cambiar</button>`;
  }
  function render() {
    const query = normalize(search.value), digits = query.replace(/\D/g, '');
    const ciQuery = /^[\d.\s-]+$/.test(query) && digits;
    const matchRank = user => {
      const name = normalize(user.nombre), words = name.split(/\s+/);
      if (words[0]?.startsWith(query)) return 0;
      if (words.slice(1).some(word => word.startsWith(query))) return 1;
      if (name.includes(query)) return 2;
      return ciQuery && String(user.ci).includes(digits) ? 3 : 9;
    };
    const found = users.filter(user => matchRank(user) < 9).sort((a, b) => matchRank(a) - matchRank(b));
    submit.disabled = loading || failed || saving || !member.value || enrolled.has(member.value) || enrolled.size >= Number(group.capacidad);
    const showResults = !member.value && (loading || failed || Boolean(query));
    results.hidden = !showResults;
    search.setAttribute('aria-expanded', String(showResults));
    results.setAttribute('aria-busy', String(loading));
    renderSelection();
    if (!showResults) {
      results.innerHTML = '';
      if (!failed) setStatus(enrolled.size >= Number(group.capacidad) ? 'El grupo ya tiene el cupo completo.' : '', enrolled.size >= Number(group.capacidad));
      return;
    }
    if (loading || failed || !found.length) {
      const message = loading ? 'Cargando socios…' : failed ? 'No se pudieron cargar los socios.' : !query ? 'Escribí un nombre o CI para buscar.' : 'No hay socios que coincidan.';
      results.innerHTML = `<div class="class-enroll-empty">${message}${failed ? '<button type="button" class="app-button" data-enroll-retry>Reintentar</button>' : ''}</div>`;
      if (!failed) setStatus(enrolled.size >= Number(group.capacidad) ? 'El grupo ya tiene el cupo completo.' : '', enrolled.size >= Number(group.capacidad));
      return;
    }
    results.innerHTML = found.map(user => {
      const ci = String(user.ci), selected = member.value === ci, exists = enrolled.has(ci);
      const initials = String(user.nombre || '').trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('');
      return `<button type="button" role="option" data-enroll-member="${escape(ci)}" aria-selected="${selected}" ${exists || saving ? 'disabled' : ''} class="${selected ? 'is-selected' : ''}">
        <span class="class-enroll-avatar" aria-hidden="true">${escape(initials)}</span>
        <span class="class-enroll-identity"><strong>${escape(user.nombre)}</strong><small>CI ${escape(formatCi(ci))}</small></span>
        <span class="class-enroll-choice">${exists ? 'Ya en el grupo' : selected ? '<i class="fa-solid fa-check" aria-hidden="true"></i> Seleccionado' : ''}</span>
      </button>`;
    }).join('');
    const full = enrolled.size >= Number(group.capacidad);
    setStatus(full ? 'El grupo ya tiene el cupo completo.' : '', full);
  }
  async function load() {
    const ticket = ++generation, classId = group.id;
    loading = true; failed = false; users = []; enrolled = new Set(); member.value = ''; render();
    try {
      const [nextUsers, nextEnrollments] = await Promise.all([loadUsers(), loadEnrollments(classId)]);
      if (ticket !== generation || !isOpen()) return;
      users = [...nextUsers].sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es', { sensitivity: 'base' }));
      enrolled = new Set(nextEnrollments.map(item => String(item.usuarioCi)));
      byId('class-enroll-capacity').textContent = `${enrolled.size} / ${group.capacidad} alumnos`;
      if (enrolled.size >= Number(group.capacidad)) setStatus('El grupo ya tiene el cupo completo.', true);
    } catch (error) {
      if (ticket !== generation || !isOpen()) return;
      failed = true;
      setStatus('Reintentá para poder seleccionar un socio.', true);
    } finally {
      if (ticket === generation && isOpen()) { loading = false; render(); }
    }
  }
  function close() {
    if (saving) return;
    ++generation;
    modal.style.display = 'none';
    returnFocus?.focus({ preventScroll: true });
  }
  async function open(item) {
    if (saving || !item) return;
    group = { ...item };
    returnFocus = document.activeElement;
    search.value = ''; member.value = ''; setStatus('');
    byId('class-enroll-context-main').innerHTML = `<strong>${escape(group.nombre)}</strong><span>${escape(formatSchedule(group))}</span>`;
    byId('class-enroll-capacity').textContent = `${Number(group.inscriptos || 0)} / ${Number(group.capacidad)} alumnos`;
    byId('class-enroll-help').textContent = group.programacionId ? 'Se suma al grupo y a sus próximas clases.' : 'Se suma únicamente a esta clase.';
    modal.style.display = 'flex'; search.focus();
    await load();
  }
  async function confirm() {
    if (submit.disabled || saving || !isOpen()) return;
    const selectedGroup = { ...group }, userCi = Number(member.value);
    saving = true; search.disabled = true; closeButtons.forEach(button => { button.disabled = true; });
    submit.textContent = 'Agregando…'; render();
    let saved = false;
    try {
      await save({ classId: selectedGroup.id, userCi });
      saved = true;
    } catch (error) {
      saving = false; render();
      setStatus(error?.message || 'No se pudo agregar. Intentá nuevamente.', true);
    } finally {
      saving = false; search.disabled = false; closeButtons.forEach(button => { button.disabled = false; });
      submit.textContent = 'Agregar alumno';
    }
    if (saved) {
      close();
      // A refresh failure must not invite a second enrollment after a successful save.
      try { await onSaved(selectedGroup.id); }
      catch (error) { console.error('Alumno agregado; no se pudo actualizar la vista.', error); }
    }
  }
  search.addEventListener('input', () => { member.value = ''; render(); results.scrollTop = 0; });
  search.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') { event.preventDefault(); results.querySelector('button:not(:disabled)')?.focus(); }
  });
  results.addEventListener('click', event => {
    if (event.target.closest('[data-enroll-retry]')) { load(); return; }
    const button = event.target.closest('[data-enroll-member]');
    if (!button || button.disabled || saving) return;
    member.value = button.dataset.enrollMember;
    const scroll = results.scrollTop;
    render(); results.scrollTop = scroll;
    [...results.querySelectorAll('[data-enroll-member]')].find(node => node.dataset.enrollMember === member.value)?.focus({ preventScroll: true });
  });
  selection.addEventListener('click', event => {
    if (!event.target.closest('[data-enroll-change]') || saving) return;
    member.value = '';
    search.select();
    render();
  });
  results.addEventListener('keydown', event => {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    const buttons = [...results.querySelectorAll('button:not(:disabled)')], index = buttons.indexOf(document.activeElement);
    event.preventDefault();
    if (event.key === 'ArrowUp' && index <= 0) search.focus();
    else buttons[Math.min(buttons.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))]?.focus();
  });
  // Capture avoids the generic close handler bypassing the saving guard.
  closeButtons.forEach(button => button.addEventListener('click', event => { event.stopImmediatePropagation(); close(); }, true));
  modal.addEventListener('click', event => { if (event.target === modal) close(); });
  document.addEventListener('keydown', event => {
    if (!isOpen()) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); }
    if (event.key === 'Tab') {
      const nodes = [...modal.querySelectorAll('button:not(:disabled),input:not(:disabled):not([type="hidden"])')].filter(node => node.getClientRects().length);
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (!nodes.includes(document.activeElement) || (event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
        event.preventDefault(); (event.shiftKey ? last : first)?.focus();
      }
    }
  }, true);
  submit.addEventListener('click', confirm);
  return { open };
}
window.createAdminClassEnrollmentController = createAdminClassEnrollmentController;
