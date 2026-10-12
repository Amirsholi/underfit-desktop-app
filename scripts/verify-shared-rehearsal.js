const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createUnderFitApiClient } = require('../clients/underFitApiClient');
const { createApiClassOperationsService } = require('../services/apiClassOperationsService');
const config = JSON.parse(fs.readFileSync(path.join(process.env.LOCALAPPDATA, 'UnderFitRehearsal/tablet-test/server.json'), 'utf8'));
assert.match(config.ConnectionStrings.UnderFit, /Host=127\.0\.0\.1;Port=55432;Database=underfit_tablet_test;/);
async function main() {
  const now = new Date(); now.setDate(now.getDate() - (now.getDay() + 6) % 7);
  const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const apiClient = createUnderFitApiClient({ baseUrl: 'http://127.0.0.1:5190', deviceKey: config.Authentication.DeviceKey });
  const desktop = createApiClassOperationsService({ apiClient });
  const response = await fetch(`http://127.0.0.1:5190/api/v1/tablet/state?from=${from}`, {
    headers: { 'X-UnderFit-Tablet-Id': 'tablet2', 'X-UnderFit-Tablet-Key': config.Authentication.TabletDevices.tablet2 },
  });
  assert.equal(response.status, 200);
  const tablet = await response.json();
  const plans = await apiClient.listMemberWorkoutPlans();
  assert.deepEqual(plans, tablet.assignments);
  console.log(`PASS: escritorio y tablet coinciden en las ${plans.length} rutinas asignadas, profesores y ejercicios.`);
  const classes = (await desktop.listUpcomingClasses(from)).filter(x => x.localId === 2);
  assert.deepEqual(classes.map(x => String(x.id)).sort(), tablet.classes.map(x => x.id).sort());
  for (const cls of classes) {
    const match = tablet.classes.find(x => x.id === String(cls.id));
    assert.equal(cls.nombre, match.name); assert.equal(cls.fecha, match.date);
    assert.equal(cls.hora.slice(0, 5), match.time); assert.equal(cls.profesor, match.professor);
    const detail = await desktop.getClassRecordDetail(cls.id);
    assert.deepEqual(detail.students.map(x => [x.usuarioCi, x.presente, x.puntuacion || 0]).sort(),
      match.roster.map(x => [x.memberId, x.presence === 'present', x.rating || 0]).sort());
  }
  console.log(`PASS: escritorio y tablet coinciden en ${classes.length} clases semanales, alumnos, asistencias y puntuaciones.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
