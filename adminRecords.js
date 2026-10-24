function createAdminRecordsController({ shared }) {
  const view = document.getElementById('modal-concurrencia');
  let returnFocus = null;
  const isOpen = () => view?.style.display === 'flex';
  function close() {
    view.style.display = 'none';
    returnFocus?.focus();
  }
  const dateInput = document.getElementById('records-date');
  const modeInput = document.getElementById('records-mode');
  const memberInput = document.getElementById('records-member');
  const historyMode = () => modeInput?.value === 'member';
  const selectedMember = () => String(memberInput?.value || '').trim();
  const refreshButton = document.getElementById('records-refresh');
  const entryBody = document.getElementById('records-entry-body');
  const entryEmpty = document.getElementById('records-entry-empty');
  const entryStatus = document.getElementById('records-entry-status');
  const entryCount = document.getElementById('records-entry-count');
  const recordsSearch = document.getElementById('records-search');
  const recordsOverviewCopy = document.getElementById('records-overview-copy');
  let allEntries = [];
  let entries = new Map();
  let loadVersion = 0;
  let loadFailed = false;
  const normalizeSearch = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
  function renderEmpty(element, hasResults, searching, kind) {
    element.style.display = hasResults ? 'none' : 'grid';
    element.querySelector('strong').textContent = loadFailed
      ? 'No se pudieron cargar los registros'
      : searching ? 'Sin coincidencias' : historyMode() ? 'Este socio no tiene ingresos registrados' : `No hay ${kind} en esta jornada`;
    element.querySelector('span').textContent = loadFailed
      ? 'Volvé a seleccionar la fecha para reintentar.'
      : searching ? 'Probá con otro nombre o limpiá el buscador.' : 'Seleccioná otra fecha para consultar el historial.';
  }


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


  function renderEntries(rows) {
    entries = new Map(rows.map(row => [String(row.id), row]));
    entryBody.innerHTML = '';
    entryEmpty.style.display = rows.length ? 'none' : 'grid';
    entryCount.textContent = String(rows.length);
    const query = normalizeSearch(recordsSearch?.value);
    const visible = rows.filter(row => !query
      || normalizeSearch(row.nombre).includes(query)
      || String(row.ci || '').includes(query.replace(/[.\s-]/g, '')) && /\d/.test(query));
    renderEmpty(entryEmpty, visible.length, query, 'ingresos');
    entryStatus.textContent = `${visible.length} ${visible.length === 1 ? 'ingreso' : 'ingresos'}`;
    visible.forEach(row => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${historyMode() ? `<small>${escapeHtml(row.fecha)}</small><br>` : ''}<strong class="record-time">${escapeHtml(String(row.hora || '—').slice(0, 5))}</strong></td>
        <td><span class="record-person"><span class="record-avatar">${escapeHtml(String(row.nombre || '?').split(/\s+/).slice(0, 2).map(part => part[0]).join(''))}</span><span><strong>${escapeHtml(row.nombre || 'Socio sin nombre')}</strong><small>CI ${escapeHtml(row.ci || '—')}</small></span></span></td>
        <td><span class="record-location">${escapeHtml(row.localNombre || 'Recepción principal')}</span>${row.claseId ? `<small>${escapeHtml(row.observacion || 'Asistencia a clase')}</small>` : ''}</td>
        <td>${row.fecha === today() && !row.claseId ? `<button class="record-annul-action" type="button" data-annul-entry="${escapeHtml(row.id)}">Anular ingreso</button>` : ''}</td>
      `;
      entryBody.appendChild(tr);
    });
  }


  async function loadRecords() {
    const version = ++loadVersion;
    loadFailed = false;
    const date = dateInput.value || today();
    dateInput.value = date;
    try {
      const history = historyMode(), member = selectedMember();
      dateInput.hidden = history; memberInput.hidden = !history;
      recordsSearch.closest('label').hidden = history;
      entryBody.closest('table').querySelector('th').textContent = history ? 'Fecha y hora' : 'Hora';
      if (history && !member) {
        allEntries = []; renderEntries([]);
        entryEmpty.querySelector('strong').textContent = 'Elegí un socio para consultar su historial';
        entryEmpty.querySelector('span').textContent = 'Incluye todos sus ingresos y asistencias a clases.';
        return;
      }
      const rows = window.api?.obtenerIngresos ? await window.api.obtenerIngresos(history ? null : date, history ? null : date, history ? member : null) : [];
      if (version !== loadVersion) return;
      allEntries = (Array.isArray(rows) ? rows : []).filter(row => history || (!row.claseId && !row.claseNombre && Number(row.localId || 1) === 1));
      renderEntries(allEntries);
      recordsOverviewCopy.textContent = `${allEntries.length} ${allEntries.length === 1 ? 'ingreso al gimnasio' : 'ingresos al gimnasio'}`;
    } catch (error) {
      if (version !== loadVersion) return;
      console.error('Error cargando concurrencia:', error);
      loadFailed = true;
      allEntries = [];
      renderEntries([]);
      recordsOverviewCopy.textContent = 'No se pudo cargar la concurrencia';
    }
  }
  function openAnnulModal(id) {
    const row = entries.get(String(id));
    if (!row) return;
    document.getElementById('anular-ingreso-id').value = String(row.id);
    document.getElementById('anular-ingreso-detalle').textContent = `${String(row.hora || '').slice(0, 5)} · ${row.ci || '—'} · ${row.nombre || 'Socio'}`;
    document.getElementById('anular-ingreso-motivo').value = '';
    document.getElementById('modal-anular-ingreso').style.display = 'flex';
    document.getElementById('anular-ingreso-motivo').focus();
  }


  function init() {
    if (!view) return;
    // Keep the overlay outside page containers and their clipping/stacking contexts.
    document.body.appendChild(view);
    view.querySelectorAll('[data-close-modal="modal-concurrencia"]').forEach(button => button.addEventListener('click', close));
    view.addEventListener('click', event => { if (event.target === view) close(); });
    dateInput.value = today();
    refreshButton?.addEventListener('click', loadRecords);
    dateInput.addEventListener('change', loadRecords);
    modeInput?.addEventListener('change', () => { recordsSearch.value = ''; loadRecords(); if (historyMode()) memberInput.focus(); });
    memberInput?.addEventListener('change', () => { recordsSearch.value = ''; loadRecords(); });
    recordsSearch.addEventListener('input', () => renderEntries(allEntries));
    document.addEventListener('keydown', event => {
      if (!isOpen()) return;
      const annul = document.getElementById('modal-anular-ingreso');
      if (annul?.style.display === 'flex') return;
      if (event.key === 'Escape') { event.preventDefault(); close(); return; }
      if (event.key === 'Tab') {
        const controls = [...view.querySelectorAll('button, input, [tabindex="0"]')].filter(element => !element.disabled && element.getClientRects().length);
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && (document.activeElement === first || !view.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !view.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        (historyMode() ? memberInput : recordsSearch).focus();
      }
    });
    entryBody.addEventListener('click', event => {
      const button = event.target.closest('[data-annul-entry]');
      if (button) openAnnulModal(button.dataset.annulEntry);
    });
    document.addEventListener('admin-records:show', () => {
      if (!isOpen()) returnFocus = document.activeElement;
      view.style.display = 'flex';
      recordsSearch.focus();
      loadRecords();
      window.api.obtenerUsuarios().then(users => {
        const options = document.getElementById('records-member-options');
        options.replaceChildren(...users.map(user => {
          const option = document.createElement('option'); option.value = String(user.ci); option.label = user.nombre; return option;
        }));
      }).catch(() => shared.mostrarNotificacion('No se pudo cargar la lista de socios del historial.', 'error'));
    });
    document.addEventListener('entries:updated', () => {
      if (isOpen()) loadRecords();
    });
  }
  window.adminSync?.watch({
    enabled: () => Boolean(window.api && isOpen() && !historyMode()),
    read: async () => {
      const date = dateInput.value || today();
      return { date, rows: await window.api.obtenerIngresos(date, date) };
    },
    apply: ({ date, rows }) => {
      if (historyMode() || date !== (dateInput.value || today())) return;
      loadFailed = false;
      allEntries = rows.filter(row => !row.claseId && !row.claseNombre && Number(row.localId || 1) === 1);
      renderEntries(allEntries);
      recordsOverviewCopy.textContent = `${allEntries.length} ingresos al gimnasio`;
    },
  });
  return { init, loadRecords };
}
window.createAdminRecordsController = createAdminRecordsController;
