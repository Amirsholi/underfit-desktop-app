// Explicit rehearsal only; never reads or imports a SQLite database.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const config = JSON.parse(fs.readFileSync(path.join(process.env.LOCALAPPDATA, 'UnderFitRehearsal/tablet-test/server.json'), 'utf8'));
assert.match(config.ConnectionStrings.UnderFit, /Host=127\.0\.0\.1;Port=55432;Database=underfit_tablet_test;/);
const base = 'http://127.0.0.1:5190/api/v1';
const auth = config.Authentication;
async function request(route, body, device, key = crypto.randomUUID(), method = body === undefined ? 'GET' : 'POST') {
  const headers = device ? { 'X-UnderFit-Tablet-Id': device, 'X-UnderFit-Tablet-Key': auth.TabletDevices[device] }
    : { 'X-UnderFit-Device-Key': auth.DeviceKey };
  headers['Content-Type'] = 'application/json'; headers['Idempotency-Key'] = key;
  const response = await fetch(base + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${method} ${route}: ${response.status} ${JSON.stringify(result)}`);
  return { result, replayed: response.headers.get('Idempotency-Replayed') };
}
async function main() {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Montevideo' }).format(new Date());
  let state = (await request('/tablet/state', undefined, 'tablet1')).result;
  let professor = state.professors.find(x => x.name === 'Profesor de prueba');
  if (!professor) professor = (await request('/staff/', { name: 'Profesor de prueba' })).result;
  for (const [ci, name] of [['001001', 'PRUEBA Ana'], ['001002', 'PRUEBA Bruno'], ['001003', 'PRUEBA Carla']]) {
    if (!state.members.some(x => x.ci === ci)) await request('/members/', { identityNumber: ci, name, plan: 30, startsOn: today, imageUseAuthorized: false });
  }
  let product = state.products.find(x => x.name === 'Agua de prueba');
  if (!product) {
    const created = (await request('/products/', { nombre: 'Agua de prueba', precio: 50, activo: true })).result;
    product = { id: created.id };
  }
  let gymClass = state.classes.find(x => x.date === today && x.name === 'Clase tablets');
  if (!gymClass) {
    await request('/tablet/schedules', { schedule: { name: 'Clase tablets', locationId: 2, professorId: professor.id,
      professor: professor.name, weekdays: [0, 1, 2, 3, 4, 5, 6], time: '23:00:00', durationMinutes: 60,
      capacity: 12, startsOn: today, endsOn: null, notes: null }, isTrial: true, expectedVersion: null }, 'tablet1');
    state = (await request('/tablet/state', undefined, 'tablet1')).result;
    gymClass = state.classes.find(x => x.date === today && x.name === 'Clase tablets');
  }
  assert.ok(gymClass, 'Today class missing');
  for (const ci of ['001001', '001002']) if (!gymClass.roster.some(x => x.memberId === ci))
    await request(`/tablet/classes/${gymClass.id}/enrollments`, { identityNumber: ci }, 'tablet1');
  state = (await request('/tablet/state', undefined, 'tablet1')).result;
  const row = state.classes.find(x => x.id === gymClass.id).roster.find(x => x.memberId === '001001');
  if (row.presence !== 'present') {
    const key = crypto.randomUUID();
    const body = { identityNumber: '001001', present: true, expectedPresent: false };
    await request(`/tablet/classes/${gymClass.id}/attendance`, body, 'tablet1', key);
    assert.equal((await request(`/tablet/classes/${gymClass.id}/attendance`, body, 'tablet1', key)).replayed, 'true');
  }
  const other = (await request('/tablet/state', undefined, 'tablet2')).result;
  assert.equal(other.classes.find(x => x.id === gymClass.id).roster.find(x => x.memberId === '001001').presence, 'present');
  const saleKey = `tablet-test-sale-${today}`;
  await request(`/tablet/classes/${gymClass.id}/deliveries`, { identityNumber: '001001', productId: product.id, quantity: 1, professorId: professor.id }, 'tablet1', saleKey);
  const replay = await request(`/tablet/classes/${gymClass.id}/deliveries`, { identityNumber: '001001', productId: product.id, quantity: 1, professorId: professor.id }, 'tablet1', saleKey);
  assert.equal(replay.replayed, 'true');
  const sales = (await request('/products/pending-sales')).result;
  assert.ok(sales.some(x => x.id === replay.result.id && x.usuarioCi === '001001'));
  let exercise = other.exercises.find(x => x.name === 'Sentadilla de prueba');
  if (!exercise) exercise = (await request('/tablet/exercises', { name: 'Sentadilla de prueba', muscleGroup: 'Piernas', instructions: 'Ejercicio para verificar la tablet.', gifUrl: null }, 'tablet1')).result;
  const days = [{ position: 1, name: 'Día 1', muscleGroups: 'Piernas', exercises: [{ exerciseId: exercise.id, position: 1, sets: 3, repetitions: '10', load: null, restSeconds: 60, notes: null }] }];
  if (!other.templates.some(x => x.name === 'Rutina de prueba')) await request('/tablet/templates', { name: 'Rutina de prueba', professorId: professor.id, days }, 'tablet1');
  if (!other.assignments.some(x => x.identityNumber === '001001')) await request('/tablet/members/001001/plan', { plan: { name: 'Rutina de prueba', professorId: professor.id, days }, expectedPlanId: null }, 'tablet1', crypto.randomUUID(), 'PUT');
  const final = (await request('/tablet/state', undefined, 'tablet2')).result;
  assert.ok(final.assignments.some(x => x.identityNumber === '001001'));
  console.log('PASS: two tablet identities, attendance replay, single pending sale, routine persistence. Fictional rehearsal data ready.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
