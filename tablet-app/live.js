(function(root) {
  'use strict';
  if (root.UNDERFIT_TABLET_DEMO) return;
  const store = { classes: [], schedules: [], members: [], products: [], deliveries: [] };
  const exercises = [], templates = [], assignments = [], professors = [];
  const client = root.TabletApi.createClient({ onChange: () => root.dispatchEvent(new Event('tablet-queue-change')) });
  const merge = (target, incoming) => {
    const previous = new Map(target.map(item => [item.id, item]));
    target.splice(0, target.length, ...incoming.map(item => Object.assign(previous.get(item.id) || {}, item)));
  };
  const nameOf = id => professors.find(item => item.id === id)?.name || '';
  const professorId = name => {
    const matches = professors.filter(item => item.name === name);
    if (matches.length !== 1) throw new Error('Elegí un profesor identificado de forma única.');
    return matches[0].id;
  };
  const daysFromApi = days => days.map(day => ({ name: day.name, muscleGroups: day.muscleGroups,
    exercises: day.exercises.map(item => ({ exerciseId: item.exerciseId, sets: item.sets,
      reps: item.repetitions, note: item.notes || '', load: item.load, restSeconds: item.restSeconds })) }));
  const daysToApi = days => days.map((day, index) => ({ position: index + 1, name: day.name || `Día ${index + 1}`,
    muscleGroups: day.muscleGroups || [...new Set(day.exercises.map(item => exercises.find(x => x.id === item.exerciseId)?.muscleGroup).filter(Boolean))].join(', '),
    exercises: day.exercises.map((item, position) => ({ exerciseId: item.exerciseId, position: position + 1,
      sets: Number(item.sets), repetitions: String(item.reps), notes: item.note || null,
      load: item.load || null, restSeconds: item.restSeconds ?? null })) }));
  let currentDate, ready = false, serial = 0, fingerprint = '';
  async function load(date = currentDate, canApply = () => true) {
    currentDate = date || root.TabletModel.dateKey(new Date());
    const requestSerial = ++serial;
    const weekStart = root.TabletModel.weekDates(currentDate)[0];
    const snapshot = await client.request(`/state?from=${weekStart}`);
    if (requestSerial !== serial || !canApply()) return false;
    const nextFingerprint = JSON.stringify([snapshot, client.pending()]);
    let changed = fingerprint !== nextFingerprint;
    fingerprint = nextFingerprint;
    merge(professors, snapshot.professors);
    root.TabletModel.professors.splice(0, root.TabletModel.professors.length, ...professors.map(x => x.name));
    merge(store.members, snapshot.members);
    for (const item of snapshot.classes) for (const row of item.roster)
      if (!store.members.some(member => member.id === row.memberId)) store.members.push({ id: row.memberId, ci: row.memberId, name: row.name });
    merge(store.classes, snapshot.classes);
    for (const operation of client.pending()) {
      const match = operation.path.match(/^\/classes\/(\d+)\/attendance$/);
      const row = match && store.classes.find(x => x.id === match[1])?.roster.find(x => x.memberId === operation.body.identityNumber);
      if (row && operation.state === 'failed' && (row.presence === 'present') === operation.body.present) {
        // A rejected old attempt needs no new write when the authoritative
        // snapshot already contains exactly the requested attendance state.
        client.dismiss(operation.key); changed = true;
        continue;
      }
      if (row && operation.state === 'pending') { row.presence = operation.body.present ? 'present' : null; row.pending = true; }
    }
    merge(store.schedules, snapshot.schedules.map(x => ({ ...x, endDate: x.endDate || '' })));
    merge(store.products, snapshot.products);
    merge(exercises, snapshot.exercises.map(x => ({ ...x, media: x.gifUrl || '', kind: /\.gif(?:\?|$)/i.test(x.gifUrl || '') ? 'image' : 'video' })));
    merge(templates, snapshot.templates.map(x => ({ id: String(x.id), name: x.name, professor: nameOf(x.professorId),
      version: x.version, days: daysFromApi(x.days), updated: 0 })));
    merge(assignments, snapshot.assignments.map(x => ({ id: x.plan.id, memberId: x.identityNumber, name: x.plan.name,
      professor: x.plan.professorName, days: daysFromApi(x.plan.days), updated: Date.parse(x.assignedAtUtc) })));
    ready = true; return changed;
  }
  async function refreshAfterSave() {
    try { await load(); } catch { root.dispatchEvent(new Event('tablet-refresh-failed')); }
  }
  async function mutation(path, body, options) { ++serial; const result = await client.send(path, body, options); await refreshAfterSave(); return result; }
  const routineData = {
    templates, assignments,
    async save(draft) {
      const days = daysToApi(draft.days), responsible = draft.professor.trim();
      if (draft.memberId) {
        const result = await mutation(`/members/${encodeURIComponent(draft.memberId)}/plan`,
          { plan: { name: draft.name, professorId: 0, professorName: responsible, days }, expectedPlanId: draft.id || null }, { method: 'PUT' });
        return { ...draft, id: result.id };
      }
      const template = { name: draft.name, professorId: 0, professorName: responsible, days };
      const result = draft.id
        ? await mutation(`/templates/${draft.id}`, { template, expectedVersion: draft.version }, { method: 'PUT' })
        : await mutation('/templates', template);
      return { ...draft, id: String(result.id), version: result.version };
    },
    assign(template, memberId) { return this.save({ ...root.TabletRoutineModel.copy(template), id: undefined, memberId }); },
    async remove(item) {
      await mutation(item.memberId ? `/members/${encodeURIComponent(item.memberId)}/plan/${item.id}` : `/templates/${item.id}?expectedVersion=${encodeURIComponent(item.version)}`, undefined, { method: 'DELETE' });
    },
  };
  root.TabletLive = {
    store, exercises, routineData, client, load, ready: () => ready, professorId,
    async saveSchedule(values, existing) {
      const schedule = { name: values.name, locationId: 2, professorId: 0,
        professor: values.professor, weekdays: values.weekdays, time: values.time + ':00',
        durationMinutes: values.duration, capacity: values.capacity, startsOn: values.startDate,
        endsOn: values.endDate || null, notes: null };
      return mutation(existing ? `/schedules/${existing.id}` : '/schedules',
        { schedule, isTrial: values.trial, expectedVersion: existing?.version || null }, { method: existing ? 'PUT' : 'POST' });
    },
    enroll(cls, memberId) { return mutation(`/classes/${cls.id}/enrollments`, { identityNumber: memberId }); },
    removeEnrollment(cls, memberId) { return mutation(`/classes/${cls.id}/enrollments/${encodeURIComponent(memberId)}`, undefined, { method: 'DELETE' }); },
    async attendance(cls, row) {
      const outstanding = client.pending().find(x => x.path === `/classes/${cls.id}/attendance` && x.body.identityNumber === row.memberId);
      if (outstanding) throw new Error(outstanding.state === 'failed'
        ? `${outstanding.error} Abrí Estado de conexión para revisar la operación rechazada.`
        : 'Esta asistencia todavía está pendiente de sincronización.');
      const present = row.presence !== 'present';
      if (cls.cancelled || cls.date > root.TabletModel.dateKey(new Date()))
        throw new Error('No se puede pasar lista en una clase cancelada o de un día futuro.');
      ++serial;
      row.presence = present ? 'present' : null; row.pending = true;
      let result;
      try { result = await client.send(`/classes/${cls.id}/attendance`,
        { identityNumber: row.memberId, present, expectedPresent: !present }, { offline: true });
      } catch (error) { row.presence = present ? null : 'present'; row.pending = false; throw error; }
      finally { ++serial; }
      row.pending = result.queued;
      return result;
    },
    rating(cls, row, score) { return mutation(`/classes/${cls.id}/rating`, { identityNumber: row.memberId, score }, { method: 'PUT' }); },
    async deliver(cls, member, product, quantity, professor) {
      return client.send(`/classes/${cls.id}/deliveries`, { identityNumber: member.id, productId: product.id, quantity,
        professorId: 0, professorName: professor }, { offline: true });
    },
    async saveExercise(exercise, values, file) {
      let media = values.media;
      if (file) media = (await client.upload(file)).mediaUrl;
      if (media.startsWith('blob:')) throw new Error('El video todavía no se subió al gimnasio.');
      const payload = { name: values.name, muscleGroup: values.muscleGroup, instructions: values.instructions,
        gifUrl: media || null, isActive: true };
      return mutation(exercise ? `/exercises/${exercise.id}` : '/exercises', payload, { method: exercise ? 'PUT' : 'POST' });
    },
  };
})(window);
