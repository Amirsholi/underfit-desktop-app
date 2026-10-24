(() => {
  const state = {
    exercises: [], templates: [], users: [], memberPlans: [],
    currentExercises: [], days: [], loaded: false, tab: 'templates',
    exerciseGroup: 'Todos', draggedIndex: null, activeDayIndex: 0, editorMode: 'template', exerciseReturnTab: 'templates',
  };
  const byId = id => document.getElementById(id);
  const muscleGroups = window.exerciseGroups;
  let exerciseEditorTrigger = null;
  let exerciseEditorSession = 0;
  let exerciseMediaLoading = false;
  let exerciseSaving = false;
  let muscleOptionIndex = -1;
  let returnToMember = false;
  let openingMember = false;

  function exerciseMedia(url) {
    if (!url) return '';
    return /\.(mp4|mov|m4v|webm)(?:[?#]|$)/i.test(url)
      ? `<video src="${escapeHtml(url)}" muted loop autoplay playsinline preload="metadata" aria-label="Demostración del ejercicio"></video>`
      : `<img src="${escapeHtml(url)}" alt="" decoding="async">`;
  }

  function notify(message, type = 'success') {
    const container = byId('notificaciones');
    if (!container) return;
    const item = document.createElement('div');
    item.className = `noti ${type}`;
    item.textContent = message;
    container.appendChild(item);
    setTimeout(() => item.remove(), 4000);
  }
  function escapeHtml(value) { const node = document.createElement('span'); node.textContent = value ?? ''; return node.innerHTML; }
  function normalizeSearchText(value = '') { return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim(); }
  function setEditorTitle(lead, accent) {
    const title = byId('workout-editor-title'); if (!title) return;
    title.textContent = `${lead}${accent ? ` ${accent}` : ''}`;
  }
  function initials(name = '') { return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'UF'; }
  function identity(value) {
    const digits = String(value ?? '').replace(/\D/g, '');
    if (digits.length < 2) return String(value ?? '');
    return `${Number(digits.slice(0, -1)).toLocaleString('es-UY')}-${digits.slice(-1)}`;
  }
  function shortDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    if (date.toDateString() === new Date().toDateString()) return 'Hoy';
    return new Intl.DateTimeFormat('es-UY', { day: '2-digit', month: 'short' }).format(date).replace('.', '');
  }
  function planFor(ci) { return state.memberPlans.find(item => String(item.identityNumber) === String(ci)); }
  function structureOf(days = []) { return { days: days.length, exercises: days.reduce((sum, day) => sum + (day.exercises?.length || 0), 0) }; }
  function routineLabel(value = '') { return String(value).replace(/\s*[·-]\s*\d+\s+d[ií]as?\s*$/i, '').trim(); }

  function showTab(name) {
    state.tab = name;
    const page = document.querySelector('[data-admin-view="training"]');
    page?.classList.toggle('is-editor', name === 'editor');
    page?.classList.toggle('is-exercises', name === 'exercises');
    document.querySelectorAll('[data-training-tab]').forEach(button => button.classList.toggle('is-active', button.dataset.trainingTab === name));
    document.querySelectorAll('[data-training-panel]').forEach(panel => panel.classList.toggle('is-active', panel.dataset.trainingPanel === name));
    document.querySelectorAll('[data-training-control]').forEach(control => { control.hidden = control.dataset.trainingControl !== name; });
    const copy = byId('training-heading-copy');
    const action = byId('training-primary-action');
    if (name === 'members') {
      if (copy) copy.textContent = 'Encontrá un socio por nombre o cédula y administrá su rutina.';
      if (action) action.hidden = true;
    } else if (name === 'templates') {
      if (copy) copy.textContent = 'Planes reutilizables para asignar a uno o varios socios.';
      if (action) { action.hidden = false; action.innerHTML = '<i class="fa-solid fa-plus"></i>Nueva plantilla'; }
    }
  }

  function renderTemplates() {
    const list = byId('template-list');
    const empty = byId('template-empty');
    const select = byId('workout-template');
    const query = byId('template-search')?.value.trim().toLocaleLowerCase('es') || '';
    const visible = state.templates.filter(item => !query || item.name.toLocaleLowerCase('es').includes(query));
    if (select) select.innerHTML = '<option value="">Empezar vacía</option><option value="custom" disabled hidden>Personalizada</option>' + state.templates.map(item => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('');
    if (byId('template-summary')) byId('template-summary').textContent = visible.length === state.templates.length ? `${state.templates.length} plantillas` : `${visible.length} resultados`;
    if (byId('training-active-count')) byId('training-active-count').textContent = String(state.templates.length);
    if (byId('training-assigned-count')) byId('training-assigned-count').textContent = String(state.memberPlans.length);
    if (byId('training-exercise-overview-count')) byId('training-exercise-overview-count').textContent = String(state.exercises.filter(item => item.isActive).length);
    if (empty) empty.hidden = visible.length > 0;
    if (!list) return;
    list.innerHTML = visible.map(item => {
      const structure = structureOf(item.days);
      const assigned = state.memberPlans.filter(plan => plan.plan?.name === item.name).length;
      const dayPreview = (item.days || []).slice(0, 3).map((day, index) => `<span><b>Día ${index + 1}</b><span class="training-day-exercises">${(day.exercises || []).slice(0, 2).map(entry => escapeHtml(state.exercises.find(ex => Number(ex.id) === Number(entry.exerciseId))?.name || entry.name || 'Ejercicio')).join('<br>')}</span><small>${day.exercises?.length || 0} ejercicios</small></span>`).join('');
      const extraDays = structure.days > 3 ? `<span class="training-extra-days">+${structure.days - 3}</span>` : '';
      return `<tr class="training-record-row" tabindex="0" role="button" data-use-template="${item.id}" aria-label="Abrir plantilla ${escapeHtml(routineLabel(item.name))}"><td><i class="fa-solid fa-file-lines training-routine-symbol" aria-hidden="true"></i><span class="training-row-identity"><strong>${escapeHtml(routineLabel(item.name))}</strong><small>${structure.days} ${structure.days === 1 ? 'día' : 'días'} · ${structure.exercises} ejercicios</small></span></td><td><span class="training-week-preview" aria-label="Distribución de ejercicios por día">${dayPreview || '<small>Sin días definidos</small>'}${extraDays}</span></td><td><span class="training-use-summary"><strong>${assigned} ${assigned === 1 ? 'socio' : 'socios'}</strong></span></td><td><span class="training-date-summary"><strong>${shortDate(item.updatedAtUtc)}</strong></span></td></tr>`;
    }).join('');
  }

  function renderMembers() {
    const list = byId('member-routines-list');
    const empty = byId('member-routines-empty');
    const query = byId('member-routine-search')?.value.trim().toLocaleLowerCase('es') || '';
    const visible = [...state.users].filter(user => !query || String(user.ci || '').includes(query) || String(user.nombre || '').toLocaleLowerCase('es').includes(query)).sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'));
    if (byId('member-routine-summary')) byId('member-routine-summary').textContent = visible.length === state.users.length ? `${state.users.length} socios` : `${visible.length} resultados`;
    if (byId('training-assigned-count')) byId('training-assigned-count').textContent = String(state.memberPlans.length);
    if (empty) empty.hidden = visible.length > 0;
    if (!list) return;
    list.innerHTML = visible.map(user => {
      const assigned = planFor(user.ci); const plan = assigned?.plan; const structure = structureOf(plan?.days || []);
      const routine = plan
        ? `<span class="training-plan-cell"><strong>${escapeHtml(routineLabel(plan.name))}</strong><small>${plan.professorName ? `Prof. ${escapeHtml(plan.professorName)}` : 'Profesor sin registrar'}</small></span>`
        : '<span class="training-plan-cell training-no-routine"><span class="training-unassigned-label">Sin rutina</span><small>Seleccioná la fila para crearla</small></span>';
      const planSummary = plan
        ? `<span class="training-plan-summary"><strong>${structure.days} ${structure.days === 1 ? 'día' : 'días'}</strong><small>${structure.exercises} ejercicios</small></span>`
        : '<span class="training-empty-value">Por definir</span>';
      const updated = plan
        ? `<span class="training-date-summary"><strong>${shortDate(assigned?.assignedAtUtc)}</strong></span>`
        : '<span class="training-empty-value">—</span>';
      return `<tr class="training-record-row ${plan ? '' : 'is-unassigned'}" tabindex="0" role="button" data-edit-member-routine="${escapeHtml(String(user.ci))}" aria-label="${plan ? 'Abrir' : 'Crear'} rutina de ${escapeHtml(user.nombre)}"><td><span class="training-member-avatar">${initials(user.nombre)}</span><span class="training-row-identity"><strong>${escapeHtml(user.nombre)}</strong><small>CI ${identity(user.ci)}</small></span></td><td class="${plan ? 'has-routine' : 'no-routine'}">${routine}</td><td>${planSummary}</td><td>${updated}</td></tr>`;
    }).join('');
  }

  function renderExercises() {
    const list = byId('exercise-list'); const empty = byId('exercise-library-empty');
    const query = normalizeSearchText(byId('exercise-library-search')?.value || '');
    const terms = query.split(/\s+/).filter(Boolean);
    const visible = state.exercises.filter(item => terms.every(term => normalizeSearchText(`${item.name} ${item.muscleGroup}`).includes(term)) && (state.exerciseGroup === 'Todos' || muscleGroups.key(item.muscleGroup) === muscleGroups.key(state.exerciseGroup)));
    if (byId('exercise-active-count')) byId('exercise-active-count').textContent = String(state.exercises.filter(item => item.isActive).length);
    if (byId('training-exercise-overview-count')) byId('training-exercise-overview-count').textContent = String(state.exercises.filter(item => item.isActive).length);
    if (empty) empty.hidden = visible.length > 0;
    if (!list) return;
    list.hidden = visible.length === 0;
    if (byId('exercise-library-results')) {
      byId('exercise-library-results').hidden = !query && state.exerciseGroup === 'Todos';
      byId('exercise-library-results').textContent = `${visible.length} ${visible.length === 1 ? 'resultado' : 'resultados'}`;
    }
    list.innerHTML = visible.map(item => {
      const used = state.memberPlans.filter(plan => plan.plan?.days?.some(day => day.exercises?.some(exercise => Number(exercise.exerciseId) === Number(item.id)))).length;
      const media = exerciseMedia(item.gifUrl) || '<span class="exercise-media-placeholder"><i class="fa-solid fa-dumbbell" aria-hidden="true"></i><span>Sin demostración</span></span>';
      const status = item.isActive ? '' : '<span class="exercise-inactive-label">Desactivado</span>';
      return `<button type="button" class="exercise-library-card" data-exercise-id="${item.id}" aria-label="Editar ejercicio ${escapeHtml(item.name)}"><span class="exercise-library-media">${media}${status}</span><span class="exercise-library-copy"><strong title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</strong><span class="exercise-muscle-label">${escapeHtml(muscleGroups.label(item.muscleGroup))}</span><span class="exercise-card-details"><span class="exercise-card-usage">${used ? `${used} ${used === 1 ? 'rutina de socio' : 'rutinas de socios'}` : 'Aún sin uso'}</span><span class="exercise-card-edit"><i class="fa-solid fa-pen" aria-hidden="true"></i>Editar</span></span></span></button>`;
    }).join('');
  }
  function renderMuscleFilters() {
    const container = byId('exercise-muscle-filters'); if (!container) return;
    const uniqueGroups = muscleGroups.list(state.exercises);
    const groups = ['Todos', ...uniqueGroups];
    container.innerHTML = groups.map(group => { const active = muscleGroups.key(group) === muscleGroups.key(state.exerciseGroup); return `<button class="${active ? 'is-active' : ''}" type="button" aria-pressed="${active}" data-exercise-group="${escapeHtml(group)}">${escapeHtml(group)}</button>`; }).join('');
    closeMuscleOptions();
  }
  function closeMuscleOptions() {
    byId('exercise-muscle-options').hidden = true;
    byId('exercise-muscle').setAttribute('aria-expanded', 'false');
    byId('exercise-muscle-toggle').setAttribute('aria-expanded', 'false');
    byId('exercise-muscle').removeAttribute('aria-activedescendant');
    muscleOptionIndex = -1;
  }
  function openMuscleOptions(showAll = false) {
    const query = muscleGroups.key(byId('exercise-muscle').value);
    const groups = muscleGroups.list(state.exercises).filter(group => showAll || muscleGroups.key(group).includes(query));
    const list = byId('exercise-muscle-options');
    muscleOptionIndex = -1;
    list.innerHTML = groups.map((group, index) => `<div id="exercise-muscle-option-${index}" role="option" aria-selected="false" data-muscle-option="${escapeHtml(group)}">${escapeHtml(group)}</div>`).join('');
    list.hidden = !groups.length;
    byId('exercise-muscle').setAttribute('aria-expanded', String(!!groups.length));
    byId('exercise-muscle-toggle').setAttribute('aria-expanded', String(!!groups.length));
    byId('exercise-muscle').removeAttribute('aria-activedescendant');
  }
  function selectMuscleOption(option) {
    byId('exercise-muscle').value = option.dataset.muscleOption;
    byId('exercise-muscle').focus();
    closeMuscleOptions();
  }
  function renderSearch(query = '') {
    const results = byId('workout-exercise-results'); if (!results) return;
    const normalized = normalizeSearchText(query);
    const terms = normalized.split(/\s+/).filter(Boolean);
    const activeExercises = state.exercises.filter(item => item.isActive);
    const matches = activeExercises.filter(item => {
      const searchable = normalizeSearchText(`${item.name} ${item.muscleGroup}`);
      return terms.every(term => searchable.includes(term));
    });
    results.innerHTML = matches.length ? matches.map(item => {
      const selected = state.currentExercises.some(current => Number(current.exerciseId) === Number(item.id));
      return `<button class="${selected ? 'is-selected' : ''}" type="button" data-search-exercise="${item.id}" ${selected ? 'disabled' : ''}><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.muscleGroup)}</small></span><i class="fa-solid ${selected ? 'fa-check' : 'fa-plus'}"></i></button>`;
    }).join('') : '<div class="training-empty">No encontramos ese ejercicio.</div>';
    results.hidden = false;
    if (byId('workout-exercise-catalog-count')) byId('workout-exercise-catalog-count').textContent = normalized ? `${matches.length} de ${activeExercises.length}` : `${activeExercises.length} disponibles`;
    if (byId('workout-exercise-search-clear')) byId('workout-exercise-search-clear').hidden = !normalized;
  }
  function makeEditorDay(index, source = {}) {
    return {
      ...structuredClone(source),
      position: index + 1,
      name: `Día ${index + 1}`,
      muscleGroups: source.muscleGroups || '',
      exercises: Array.isArray(source.exercises) ? structuredClone(source.exercises) : [],
    };
  }
  function prepareEditorDays(days = []) {
    const source = Array.isArray(days) && days.length ? days : [{}];
    return source.map((day, index) => makeEditorDay(index, day));
  }
  function reindexCurrent() { state.currentExercises.forEach((item, index) => { item.position = index + 1; }); }
  function syncActiveDay() {
    const day = state.days[state.activeDayIndex]; if (!day) return;
    reindexCurrent();
    day.position = state.activeDayIndex + 1;
    day.name = `Día ${state.activeDayIndex + 1}`;
    const groups = [...new Set(state.currentExercises.map(item => item.muscleGroup).filter(Boolean))].join(', ');
    day.muscleGroups = groups.length <= 250 ? groups : 'Varios grupos musculares';
    day.exercises = state.currentExercises.map(({ exerciseName, muscleGroup, gifUrl, ...item }) => ({ ...item }));
  }
  function updateEditorSummary() {
    const exercises = state.days.reduce((sum, day) => sum + (day.exercises?.length || 0), 0);
    const template = byId('workout-template');
    if (template && !template.value && exercises > 0) template.value = 'custom';
    if (byId('workout-editor-summary')) byId('workout-editor-summary').textContent = `${state.days.length} ${state.days.length === 1 ? 'día' : 'días'} · ${exercises} ${exercises === 1 ? 'ejercicio' : 'ejercicios'}`;
  }
  function renderDays() {
    const container = byId('workout-day-tabs'); if (!container) return;
    container.innerHTML = state.days.map((day, index) => {
      const active = index === state.activeDayIndex;
      const count = day.exercises?.length || 0;
      const close = state.days.length > 1 ? `<button class="training-day-close" type="button" data-remove-workout-day="${index}" aria-label="Quitar Día ${index + 1}" title="Quitar Día ${index + 1}"><i class="fa-solid fa-xmark"></i></button>` : '';
      return `<div class="training-day-tab ${active ? 'is-active' : ''}" role="presentation"><button id="workout-day-tab-${index}" class="training-day-select ${active ? 'is-active' : ''}" type="button" role="tab" data-workout-day="${index}" aria-label="Día ${index + 1}, ${count} ejercicios" aria-selected="${active}" aria-controls="workout-day-exercises" tabindex="${active ? 0 : -1}"><span><strong>Día ${index + 1}</strong><small>${count} ej.</small></span></button>${close}</div>`;
    }).join('');
    if (byId('workout-active-day-title')) byId('workout-active-day-title').textContent = `Día ${state.activeDayIndex + 1}`;
    byId('workout-day-exercises')?.setAttribute('aria-labelledby', `workout-day-tab-${state.activeDayIndex}`);
    updateEditorSummary();
  }
  function rowPositions() {
    return new Map([...document.querySelectorAll('#workout-day-exercises [data-exercise-key]')].map(row => [row.dataset.exerciseKey, row.getBoundingClientRect().top]));
  }
  function animateReorderedRows(previousPositions) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    requestAnimationFrame(() => {
      document.querySelectorAll('#workout-day-exercises [data-exercise-key]').forEach(row => {
        const previousTop = previousPositions.get(row.dataset.exerciseKey);
        if (previousTop === undefined) return;
        const delta = previousTop - row.getBoundingClientRect().top;
        if (Math.abs(delta) < 1) return;
        row.animate([{ transform: `translateY(${delta}px)`, backgroundColor: '#272d34' }, { transform: 'translateY(0)', backgroundColor: '#171b20' }], { duration: 200, easing: 'cubic-bezier(.2,.8,.2,1)' });
      });
    });
  }
  function animateDayContent() {
    const list = byId('workout-day-exercises'); if (!list?.animate) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    list.animate([{ opacity: .35 }, { opacity: 1 }], { duration: 150, easing: 'ease-out' });
  }
  function renderCurrentExercises() {
    syncActiveDay();
    const container = byId('workout-day-exercises'); if (!container) return;
    container.innerHTML = state.currentExercises.length ? state.currentExercises.map((item, index) => {
      const media = exerciseMedia(item.gifUrl) || '<i class="fa-solid fa-dumbbell"></i>';
      return `<article class="sortable-exercise" draggable="true" data-sort-index="${index}" data-exercise-key="${item.exerciseId}"><span class="drag-handle" title="Arrastrar para ordenar"><i class="fa-solid fa-grip-vertical"></i></span><button type="button" class="exercise-open" data-edit-workout-exercise="${item.exerciseId}" aria-label="Editar ejercicio ${escapeHtml(item.exerciseName)}" title="Editar ficha del ejercicio"><span class="training-selected-exercise-media">${media}</span><span class="exercise-identity"><strong>${escapeHtml(item.exerciseName)}</strong><small>${index + 1}. ${escapeHtml(item.muscleGroup)}</small></span></button><label>Series<input data-series-index="${index}" type="number" min="1" value="${item.sets}"></label><label>Repeticiones<input data-reps-index="${index}" value="${escapeHtml(item.repetitions)}"></label><button type="button" class="remove-exercise" data-remove-exercise="${index}" aria-label="Quitar ${escapeHtml(item.exerciseName)}" title="Quitar"><i class="fa-solid fa-xmark"></i></button><label class="exercise-routine-note"><span>Nota</span><input data-notes-index="${index}" aria-label="Nota para ${escapeHtml(item.exerciseName)}" maxlength="500" placeholder="Indicación para esta rutina (opcional)" value="${escapeHtml(item.notes || '')}"></label></article>`;
    }).join('') : '<div class="training-empty">Elegí ejercicios desde el catálogo de la izquierda.</div>';
    if (byId('workout-current-count')) byId('workout-current-count').textContent = `${state.currentExercises.length} ${state.currentExercises.length === 1 ? 'ejercicio' : 'ejercicios'}`;
    renderDays();
    renderSearch(byId('workout-exercise-search')?.value || '');
  }
  function activateDay(index) {
    if (!Number.isInteger(index) || index < 0 || index >= state.days.length || index === state.activeDayIndex) return;
    syncActiveDay();
    state.activeDayIndex = index;
    state.currentExercises = hydrateExerciseNames(state.days[index].exercises || []);
    renderCurrentExercises();
    animateDayContent();
  }
  function hydrateExerciseNames(exercises = []) {
    return exercises.map((item, index) => { const catalog = state.exercises.find(exercise => Number(exercise.id) === Number(item.exerciseId)); return { ...item, position: item.position || index + 1, exerciseName: catalog?.name || item.name || 'Ejercicio', muscleGroup: catalog?.muscleGroup || item.muscleGroup || '', gifUrl: catalog?.gifUrl || item.gifUrl || '' }; });
  }
  function openEditor({ ci = '', name = '', days = [], professorName = '', mode = 'template' } = {}) {
    state.editorMode = mode;
    const form = byId('workout-form');
    if (form) form.dataset.editorMode = mode;
    byId('workout-member').value = ci; byId('workout-name').value = name; byId('workout-template').value = ''; byId('workout-professor').value = professorName;
    state.days = prepareEditorDays(days); state.activeDayIndex = 0; state.currentExercises = hydrateExerciseNames(state.days[0].exercises || []);
    const member = state.users.find(user => String(user.ci) === String(ci));
    if (mode === 'member') setEditorTitle('Rutina de', member?.nombre || 'socio');
    else setEditorTitle(days.length ? 'Editar' : 'Crear', 'plantilla');
    byId('workout-name-label').textContent = mode === 'member' ? 'Nombre de la rutina' : 'Nombre de la plantilla';
    byId('workout-member-caption').hidden = mode !== 'member';
    byId('workout-member-caption').textContent = mode === 'member' ? `CI ${identity(ci)}` : '';
    byId('workout-editor-back').querySelector('span').textContent = mode === 'member' ? 'Volver a rutinas de socios' : 'Volver a plantillas';
    if (byId('workout-save-routine')) byId('workout-save-routine').hidden = mode === 'template';
    if (byId('workout-save-template')) { byId('workout-save-template').hidden = mode !== 'template'; byId('workout-save-template').textContent = 'Guardar plantilla'; byId('workout-save-template').classList.toggle('app-button-primary', mode === 'template'); }
    byId('workout-exercise-search').value = '';
    renderDays(); renderCurrentExercises(); renderSearch(''); showTab('editor');
  }
  function loadTemplate(id, preserveContext = false) {
    const template = state.templates.find(item => item.id === Number(id)); if (!template) return;
    if (preserveContext) { state.days = prepareEditorDays(template.days); state.activeDayIndex = 0; state.currentExercises = hydrateExerciseNames(state.days[0].exercises || []); byId('workout-name').value = template.name; renderCurrentExercises(); }
    else openEditor({ name: template.name, days: template.days, mode: 'template' });
    byId('workout-template').value = String(template.id);
  }
  function resetEditorToEmpty() {
    state.days = prepareEditorDays();
    state.activeDayIndex = 0;
    state.currentExercises = [];
    byId('workout-name').value = '';
    byId('workout-template').value = '';
    byId('workout-exercise-search').value = '';
    if (state.editorMode === 'template') setEditorTitle('Crear', 'plantilla');
    renderCurrentExercises();
  }
  function openMemberRoutine(ci) { const assigned = planFor(ci); openEditor({ ci, name: assigned?.plan?.name || 'Plan de entrenamiento', days: assigned?.plan?.days || [], professorName: assigned?.plan?.professorName || '', mode: 'member' }); }
  function showVideoPreview(url) {
    const preview = byId('exercise-video-preview');
    const video = preview?.querySelector('video');
    const image = preview?.querySelector('img');
    if (!preview || !video || !image) return;
    const isImage = /\.(gif|png|jpe?g|webp|svg)(?:[?#]|$)/i.test(url || '');
    preview.hidden = !url;
    byId('exercise-video-empty').hidden = !!url;
    byId('exercise-video-remove').hidden = !url;
    byId('exercise-video-choose').textContent = url ? 'Cambiar video' : 'Elegir video';
    video.hidden = !url || isImage;
    image.hidden = !url || !isImage;
    if (url && isImage) image.src = url; else image.removeAttribute('src');
    if (url && !isImage) video.src = url; else { video.pause(); video.removeAttribute('src'); }
  }
  function openExerciseEditor(item = null) {
    const overlay = byId('exercise-editor'); if (!overlay) return;
    byId('exercise-delete').hidden = !item;
    exerciseEditorSession++;
    closeMuscleOptions();
    setExerciseMediaLoading(false);
    byId('exercise-media-status').textContent = '';
    exerciseEditorTrigger = document.activeElement;
    byId('exercise-id').value = item?.id || ''; byId('exercise-name').value = item?.name || ''; byId('exercise-muscle').value = item?.muscleGroup || ''; byId('exercise-gif').value = item?.gifUrl || ''; byId('exercise-instructions').value = item?.instructions || ''; byId('exercise-editor-title').textContent = item ? 'Editar ejercicio' : 'Crear ejercicio'; showVideoPreview(item?.gifUrl || ''); overlay.hidden = false;
    byId('exercise-name').focus();
  }
  function closeExerciseEditor() {
    if (exerciseSaving) return;
    exerciseEditorSession++;
    closeMuscleOptions();
    setExerciseMediaLoading(false);
    byId('exercise-form')?.reset();
    byId('exercise-id').value = ''; byId('exercise-gif').value = '';
    byId('exercise-media-status').textContent = '';
    showVideoPreview(''); byId('exercise-editor').hidden = true;
    if (exerciseEditorTrigger?.isConnected) exerciseEditorTrigger.focus({ preventScroll: true });
  }

  async function saveTemplate() {
    if (!byId('workout-form').reportValidity()) return;
    syncActiveDay();
    const incompleteDay = state.days.findIndex(day => !day.exercises?.length);
    if (incompleteDay >= 0) return notify(`Agregá al menos un ejercicio en Día ${incompleteDay + 1}.`, 'error');
    try {
      await window.api.guardarPreRutina({ name: byId('workout-name').value.trim(), professorName: byId('workout-professor').value.trim(), days: state.days });
      state.templates = await window.api.obtenerPreRutinas();
      renderTemplates();
      if (byId('workout-template-help')) byId('workout-template-help').textContent = `${state.templates.length} plantillas disponibles`;
      notify('Plantilla guardada.');
      if (state.editorMode === 'template') showTab('templates');
    } catch (error) { notify(error.message, 'error'); }
  }

  async function load() {
    const [exercises, templates, users, plans] = await Promise.allSettled([window.api.obtenerEjercicios(false), window.api.obtenerPreRutinas(), window.api.obtenerUsuarios(), window.api.obtenerRutinasSocios ? window.api.obtenerRutinasSocios() : Promise.resolve([])]);
    state.exercises = exercises.status === 'fulfilled' && Array.isArray(exercises.value) ? exercises.value : [];
    state.templates = templates.status === 'fulfilled' && Array.isArray(templates.value) ? templates.value : [];
    state.users = users.status === 'fulfilled' && Array.isArray(users.value) ? users.value : [];
    state.memberPlans = plans.status === 'fulfilled' && Array.isArray(plans.value) ? plans.value : [];
    if (byId('workout-template-help')) byId('workout-template-help').textContent = `${state.templates.length} plantillas disponibles`;
    renderTemplates(); renderMembers(); renderExercises(); renderMuscleFilters(); renderSearch(''); showTab('templates'); state.loaded = true;
  }

  const refreshLibrary = () => window.adminSync?.refresh();
  window.adminSync?.watch({
    enabled: () => Boolean(window.api && state.loaded && state.tab !== 'editor' && !exerciseSaving && window.adminSync.active('training')),
    read: () => Promise.all([window.api.obtenerRutinasSocios(), window.api.obtenerPreRutinas(), window.api.obtenerEjercicios(false), window.api.obtenerUsuarios()]),
    apply: ([plans, templates, exercises, users]) => {
      state.memberPlans = plans; state.templates = templates; state.exercises = exercises; state.users = users;
      renderTemplates(); renderMembers(); renderExercises(); renderMuscleFilters();
    },
  });

  document.querySelector('.training-tabs')?.addEventListener('click', event => { const button = event.target.closest('[data-training-tab]'); if (button) showTab(button.dataset.trainingTab); });
  byId('training-open-exercises')?.addEventListener('click', () => { state.exerciseReturnTab = state.tab === 'members' ? 'members' : 'templates'; byId('exercises-back').querySelector('span').textContent = state.exerciseReturnTab === 'members' ? 'Volver a rutinas de socios' : 'Volver a plantillas'; showTab('exercises'); });
  byId('exercises-back')?.addEventListener('click', () => showTab(state.exerciseReturnTab || 'templates'));
  function leaveWorkoutEditor() {
    if (returnToMember) {
      returnToMember = false;
      document.dispatchEvent(new CustomEvent('admin:navigate', { detail: { section: 'user-detail' } }));
      byId('detalle-rutina')?.focus();
    } else showTab(state.editorMode === 'member' ? 'members' : 'templates');
  }
  byId('workout-editor-back')?.addEventListener('click', leaveWorkoutEditor);
  byId('workout-cancel')?.addEventListener('click', leaveWorkoutEditor);
  byId('training-primary-action')?.addEventListener('click', () => { if (state.tab === 'members') { byId('member-routine-search')?.focus(); return; } openEditor({ mode: 'template' }); });
  byId('template-search')?.addEventListener('input', renderTemplates);
  byId('member-routine-search')?.addEventListener('input', renderMembers);
  byId('exercise-library-search')?.addEventListener('input', renderExercises);
  byId('exercise-reset-filters')?.addEventListener('click', () => { byId('exercise-library-search').value = ''; state.exerciseGroup = 'Todos'; renderMuscleFilters(); renderExercises(); byId('exercise-library-search').focus(); });
  byId('exercise-muscle-filters')?.addEventListener('click', event => { const button = event.target.closest('[data-exercise-group]'); if (!button) return; state.exerciseGroup = button.dataset.exerciseGroup; renderMuscleFilters(); renderExercises(); });
  byId('template-list')?.addEventListener('click', event => { const button = event.target.closest('[data-use-template]'); if (button) loadTemplate(button.dataset.useTemplate, false); });
  byId('member-routines-list')?.addEventListener('click', event => { const button = event.target.closest('[data-edit-member-routine]'); if (button) openMemberRoutine(button.dataset.editMemberRoutine); });
  byId('template-list')?.addEventListener('keydown', event => { const row = event.target.closest('[data-use-template]'); if (row && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); loadTemplate(row.dataset.useTemplate, false); } });
  byId('member-routines-list')?.addEventListener('keydown', event => { const row = event.target.closest('[data-edit-member-routine]'); if (row && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); openMemberRoutine(row.dataset.editMemberRoutine); } });
  byId('workout-template')?.addEventListener('change', event => { if (event.target.value) loadTemplate(event.target.value, true); else resetEditorToEmpty(); });
  const workoutSearch = byId('workout-exercise-search');
  workoutSearch?.addEventListener('input', event => renderSearch(event.target.value));
  workoutSearch?.addEventListener('search', event => renderSearch(event.target.value));
  byId('workout-exercise-search-clear')?.addEventListener('click', () => { workoutSearch.value = ''; renderSearch(''); workoutSearch.focus(); });
  byId('workout-exercise-results')?.addEventListener('click', event => {
    const button = event.target.closest('[data-search-exercise]'); const exercise = state.exercises.find(item => item.id === Number(button?.dataset.searchExercise)); if (!exercise) return;
    if (state.currentExercises.some(item => item.exerciseId === exercise.id)) return notify('Ese ejercicio ya está en el día.', 'error');
    state.currentExercises.push({ exerciseId: exercise.id, exerciseName: exercise.name, muscleGroup: exercise.muscleGroup, gifUrl: exercise.gifUrl || '', position: state.currentExercises.length + 1, sets: 3, repetitions: '10', load: null, restSeconds: null, notes: null });
    byId('workout-exercise-search').value = ''; renderSearch(''); renderCurrentExercises();
  });
  byId('workout-create-exercise')?.addEventListener('click', () => openExerciseEditor());
  byId('workout-day-exercises')?.addEventListener('input', event => {
    if (event.target.matches('[data-series-index]')) state.currentExercises[Number(event.target.dataset.seriesIndex)].sets = Number(event.target.value);
    if (event.target.matches('[data-reps-index]')) state.currentExercises[Number(event.target.dataset.repsIndex)].repetitions = event.target.value;
    if (event.target.matches('[data-notes-index]')) state.currentExercises[Number(event.target.dataset.notesIndex)].notes = event.target.value || null;
    syncActiveDay();
  });
  byId('workout-day-exercises')?.addEventListener('click', event => {
    const button = event.target.closest('[data-remove-exercise]');
    if (button) { state.currentExercises.splice(Number(button.dataset.removeExercise), 1); reindexCurrent(); renderCurrentExercises(); return; }
    if (event.target.closest('input, label, .drag-handle')) return;
    const row = event.target.closest('[data-exercise-key]');
    const exercise = state.exercises.find(item => Number(item.id) === Number(row?.dataset.exerciseKey));
    if (exercise) openExerciseEditor(exercise);
  });
  const workoutDayExercises = byId('workout-day-exercises');
  workoutDayExercises?.addEventListener('dragstart', event => {
    const row = event.target.closest('[data-sort-index]');
    state.draggedIndex = row ? Number(row.dataset.sortIndex) : null;
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    row?.classList.add('is-dragging');
  });
  workoutDayExercises?.addEventListener('dragover', event => {
    event.preventDefault();
    const target = event.target.closest('[data-sort-index]');
    workoutDayExercises.querySelectorAll('[data-sort-index]').forEach(row => row.classList.toggle('is-drop-target', row === target && state.draggedIndex !== null && Number(row.dataset.sortIndex) !== state.draggedIndex));
  });
  workoutDayExercises?.addEventListener('dragleave', event => { if (!workoutDayExercises.contains(event.relatedTarget)) workoutDayExercises.querySelectorAll('.is-drop-target').forEach(row => row.classList.remove('is-drop-target')); });
  workoutDayExercises?.addEventListener('dragend', () => { state.draggedIndex = null; workoutDayExercises.querySelectorAll('.is-dragging, .is-drop-target').forEach(row => row.classList.remove('is-dragging', 'is-drop-target')); });
  workoutDayExercises?.addEventListener('drop', event => {
    event.preventDefault();
    const target = event.target.closest('[data-sort-index]');
    const targetIndex = target ? Number(target.dataset.sortIndex) : null;
    if (state.draggedIndex === null || targetIndex === null || state.draggedIndex === targetIndex) return;
    const positions = rowPositions();
    const [moved] = state.currentExercises.splice(state.draggedIndex, 1);
    state.currentExercises.splice(targetIndex, 0, moved);
    reindexCurrent(); state.draggedIndex = null; renderCurrentExercises(); animateReorderedRows(positions);
  });
  byId('workout-day-tabs')?.addEventListener('click', event => {
    const close = event.target.closest('[data-remove-workout-day]');
    if (close) { removeDay(Number(close.dataset.removeWorkoutDay)); return; }
    const button = event.target.closest('[data-workout-day]');
    if (button) activateDay(Number(button.dataset.workoutDay));
  });
  byId('workout-day-tabs')?.addEventListener('keydown', event => {
    if (!event.target.matches('[data-workout-day]')) return;
    let index = state.activeDayIndex;
    if (event.key === 'ArrowRight') index = (index + 1) % state.days.length;
    else if (event.key === 'ArrowLeft') index = (index - 1 + state.days.length) % state.days.length;
    else if (event.key === 'Home') index = 0;
    else if (event.key === 'End') index = state.days.length - 1;
    else return;
    event.preventDefault();
    activateDay(index);
    byId(`workout-day-tab-${index}`)?.focus({ preventScroll: true });
    byId(`workout-day-tab-${index}`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });
  byId('workout-add-day')?.addEventListener('click', () => {
    if (state.days.length >= 7) return notify('La rutina puede tener hasta 7 días.', 'error');
    syncActiveDay();
    state.days.push(makeEditorDay(state.days.length));
    state.activeDayIndex = state.days.length - 1;
    state.currentExercises = [];
    renderCurrentExercises();
    byId(`workout-day-tab-${state.activeDayIndex}`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });
  function removeDay(index) {
    if (state.days.length <= 1) return;
    syncActiveDay();
    const previousActive = state.activeDayIndex;
    state.days.splice(index, 1);
    state.days = state.days.map((day, index) => makeEditorDay(index, day));
    if (index < previousActive) state.activeDayIndex = previousActive - 1;
    else if (index === previousActive) state.activeDayIndex = Math.min(index, state.days.length - 1);
    else state.activeDayIndex = previousActive;
    state.currentExercises = hydrateExerciseNames(state.days[state.activeDayIndex].exercises || []);
    renderCurrentExercises();
    animateDayContent();
  }
  byId('workout-save-template')?.addEventListener('click', saveTemplate);
  byId('workout-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    if (state.editorMode === 'template') return saveTemplate();
    syncActiveDay();
    const incompleteDay = state.days.findIndex(day => !day.exercises?.length);
    if (incompleteDay >= 0) return notify(`Agregá al menos un ejercicio en Día ${incompleteDay + 1}.`, 'error');
    if (!byId('workout-member').value.trim() || !byId('workout-professor').value) return notify('Seleccioná un socio y escribí el nombre del profesor.', 'error');
    try { await window.api.asignarRutinaSocio(byId('workout-member').value.trim(), { name: byId('workout-name').value.trim(), professorId: 0, professorName: byId('workout-professor').value.trim(), days: state.days }); state.memberPlans = window.api.obtenerRutinasSocios ? await window.api.obtenerRutinasSocios() : state.memberPlans; renderMembers(); document.dispatchEvent(new CustomEvent('training:member-saved')); leaveWorkoutEditor(); notify('Rutina guardada. El socio ya puede verla.'); } catch (error) { notify(error.message, 'error'); }
  });

  byId('exercise-create')?.addEventListener('click', () => openExerciseEditor());
  byId('exercise-list')?.addEventListener('click', event => { const button = event.target.closest('[data-exercise-id]'); const item = state.exercises.find(row => row.id === Number(button?.dataset.exerciseId)); if (item) openExerciseEditor(item); });
  byId('exercise-editor-close')?.addEventListener('click', closeExerciseEditor);
  byId('exercise-cancel')?.addEventListener('click', closeExerciseEditor);
  byId('exercise-delete')?.addEventListener('click', async () => {
    if (exerciseSaving || exerciseMediaLoading) return;
    const item = state.exercises.find(row => row.id === Number(byId('exercise-id').value));
    if (!item || !window.confirm(`¿Eliminar «${item.name}» del catálogo? Las rutinas que ya lo incluyen conservarán el ejercicio.`)) return;
    try {
      exerciseSaving = true;
      for (const id of ['exercise-delete', 'exercise-save', 'exercise-cancel', 'exercise-editor-close']) byId(id).disabled = true;
      await window.api.actualizarEjercicio(item.id, { ...item, isActive: false });
      state.exercises = await window.api.obtenerEjercicios(false);
      renderExercises(); renderMuscleFilters();
      renderSearch(byId('workout-exercise-search')?.value || '');
      exerciseSaving = false;
      closeExerciseEditor();
      notify('Ejercicio eliminado del catálogo.');
    } catch (error) { notify(error.message, 'error'); }
    finally {
      exerciseSaving = false;
      for (const id of ['exercise-delete', 'exercise-save', 'exercise-cancel', 'exercise-editor-close']) byId(id).disabled = false;
    }
  });
  byId('exercise-muscle').addEventListener('input', () => openMuscleOptions());
  byId('exercise-muscle').addEventListener('click', () => {
    if (byId('exercise-muscle-options').hidden) openMuscleOptions(true);
    else closeMuscleOptions();
  });
  byId('exercise-muscle-toggle').addEventListener('click', () => {
    const wasOpen = !byId('exercise-muscle-options').hidden;
    byId('exercise-muscle').focus();
    if (wasOpen) closeMuscleOptions(); else openMuscleOptions(true);
  });
  byId('exercise-muscle-options').addEventListener('pointerdown', event => event.preventDefault());
  byId('exercise-muscle-options').addEventListener('click', event => {
    const option = event.target.closest('[data-muscle-option]');
    if (option) selectMuscleOption(option);
  });
  document.addEventListener('pointerdown', event => { if (!event.target.closest('.exercise-muscle-field')) closeMuscleOptions(); });
  document.addEventListener('focusin', event => { if (!event.target.closest('.exercise-muscle-field')) closeMuscleOptions(); });
  byId('exercise-muscle').addEventListener('keydown', event => {
    const list = byId('exercise-muscle-options');
    if (event.key === 'Escape' && !list.hidden) { event.preventDefault(); event.stopPropagation(); closeMuscleOptions(); return; }
    if (event.key === 'Tab') { closeMuscleOptions(); return; }
    if (event.key === 'Enter' && !list.hidden && muscleOptionIndex >= 0) {
      event.preventDefault(); selectMuscleOption(list.children[muscleOptionIndex]); return;
    }
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    if (list.hidden) openMuscleOptions(true);
    const options = [...list.children];
    if (!options.length) return;
    muscleOptionIndex = muscleOptionIndex < 0 ? (event.key === 'ArrowDown' ? 0 : options.length - 1)
      : (muscleOptionIndex + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
    options.forEach((option, index) => option.setAttribute('aria-selected', String(index === muscleOptionIndex)));
    byId('exercise-muscle').setAttribute('aria-activedescendant', options[muscleOptionIndex].id);
    options[muscleOptionIndex].scrollIntoView({ block: 'nearest' });
  });
  byId('exercise-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    if (exerciseMediaLoading || exerciseSaving) return;
    for (const field of [byId('exercise-name'), byId('exercise-muscle')]) field.value = field.value.trim();
    if (!byId('exercise-form').reportValidity()) return;
    const id = Number(byId('exercise-id').value || 0);
    const payload = { name: byId('exercise-name').value.trim(), muscleGroup: muscleGroups.label(byId('exercise-muscle').value), gifUrl: byId('exercise-gif').value.trim() || null, instructions: byId('exercise-instructions').value.trim() || null, ...(id ? { isActive: true } : {}) };
    try {
      exerciseSaving = true;
      byId('exercise-save').disabled = true;
      byId('exercise-save').textContent = 'Guardando…';
      byId('exercise-cancel').disabled = true;
      byId('exercise-editor-close').disabled = true;
      if (id) await window.api.actualizarEjercicio(id, payload); else await window.api.crearEjercicio(payload);
      state.exercises = await window.api.obtenerEjercicios(false);
      renderExercises(); renderMuscleFilters();
      if (state.tab === 'editor') { syncActiveDay(); state.currentExercises = hydrateExerciseNames(state.days[state.activeDayIndex].exercises); renderCurrentExercises(); }
      else renderSearch(byId('workout-exercise-search')?.value || '');
      exerciseSaving = false;
      closeExerciseEditor(); notify('Ejercicio guardado.');
    } catch (error) { notify(error.message, 'error'); }
    finally {
      exerciseSaving = false;
      byId('exercise-save').disabled = false;
      byId('exercise-save').textContent = 'Guardar';
      byId('exercise-cancel').disabled = false;
      byId('exercise-editor-close').disabled = false;
    }
  });
  byId('exercise-editor')?.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); closeExerciseEditor(); }
    if (event.key !== 'Tab') return;
    const focusable = [...byId('exercise-editor').querySelectorAll('button, input, textarea, [tabindex]')].filter(node => !node.disabled && node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden');
    const first = focusable[0]; const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  const videoDrop = byId('exercise-video-drop'); const videoInput = byId('exercise-video-file');
  byId('exercise-video-choose')?.addEventListener('click', () => videoInput?.click());
  byId('exercise-video-remove')?.addEventListener('click', () => {
    byId('exercise-gif').value = '';
    byId('exercise-media-status').textContent = '';
    showVideoPreview('');
    byId('exercise-video-choose').focus();
  });
  videoInput?.addEventListener('change', () => { const file = videoInput.files?.[0]; if (file) uploadVideo(file); });
  videoDrop?.addEventListener('dragover', event => { event.preventDefault(); videoDrop.classList.add('is-over'); });
  videoDrop?.addEventListener('dragleave', () => videoDrop.classList.remove('is-over'));
  videoDrop?.addEventListener('drop', event => { event.preventDefault(); videoDrop.classList.remove('is-over'); const file = event.dataTransfer.files[0]; if (file) uploadVideo(file); });
  function setExerciseMediaLoading(loading) {
    exerciseMediaLoading = loading;
    byId('exercise-video-drop').classList.toggle('is-loading', loading);
    byId('exercise-video-drop').setAttribute('aria-busy', String(loading));
    for (const id of ['exercise-video-choose', 'exercise-video-remove', 'exercise-save']) byId(id).disabled = loading;
  }
  async function uploadVideo(file) {
    if (exerciseMediaLoading || exerciseSaving) return;
    if (!/\.(mp4|mov|m4v|webm)$/i.test(file.name)) {
      videoInput.value = '';
      byId('exercise-media-status').textContent = 'Usá MP4, MOV, M4V o WebM.';
      return;
    }
    if (!file.path) return notify('No pudimos acceder al archivo seleccionado.', 'error');
    const session = exerciseEditorSession;
    setExerciseMediaLoading(true);
    byId('exercise-media-status').textContent = 'Ajustando y recortando video…';
    try {
      const result = await window.api.subirVideoEjercicio(file.path);
      if (session !== exerciseEditorSession) return;
      byId('exercise-gif').value = result.mediaUrl;
      showVideoPreview(result.previewUrl || result.mediaUrl);
      byId('exercise-media-status').textContent = '';
    } catch (error) {
      if (session === exerciseEditorSession) {
        byId('exercise-media-status').textContent = 'No se pudo cargar el video.';
        notify(error.message, 'error');
      }
    } finally {
      if (session === exerciseEditorSession) { setExerciseMediaLoading(false); videoInput.value = ''; }
    }
  }

  document.addEventListener('keydown', event => { if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k' || !document.querySelector('[data-admin-view="training"]')?.classList.contains('is-active')) return; event.preventDefault(); if (state.tab === 'members') byId('member-routine-search')?.focus(); else if (state.tab === 'exercises') byId('exercise-library-search')?.focus(); else if (state.tab === 'editor') byId('workout-exercise-search')?.focus(); else byId('template-search')?.focus(); });
  document.addEventListener('admin-section:show', event => {
    if (event.detail?.section !== 'training') return;
    if (openingMember) return;
    returnToMember = false;
    if (!state.loaded) {
      load().catch(error => notify(error.message, 'error'));
      return;
    }
    // La navegación principal siempre abre la portada de Rutinas. Los editores
    // y la biblioteca son subrutas, no estados que deban quedar pegados.
    showTab('templates');
    refreshLibrary();
  });
  document.addEventListener('training:open-member', async event => {
    if (openingMember) return;
    openingMember = true;
    const button = byId('detalle-rutina');
    if (button) button.disabled = true;
    try {
      // Check assignment before opening: a failed request must never look like an empty plan.
      const plans = await window.api.obtenerRutinasSocios();
      await load();
      state.memberPlans = plans;
      document.dispatchEvent(new CustomEvent('admin:navigate', { detail: { section: 'training' } }));
      openMemberRoutine(event.detail.ci);
      returnToMember = true;
      byId('workout-editor-back').querySelector('span').textContent = 'Volver al socio';
    } catch (_) { notify('No se pudo cargar la rutina. Volvé a intentar.', 'error'); }
    finally { openingMember = false; if (button) button.disabled = false; }
  });
})();
