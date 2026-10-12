// Interactive rehearsal with imported gym data. All additions live in a new clone.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const { ensureDockerReady } = require('../services/dockerRuntime');
const { validateTarget } = require('./import-rehearsal');
const { createUnderFitApiClient } = require('../clients/underFitApiClient');
const root = path.resolve(__dirname, '..');
const directory = path.join(process.env.LOCALAPPDATA, 'UnderFitRehearsal/gym-copy');
const source = 'underfit_migration_check_1790773975418';
const base = 'http://127.0.0.1:5192';
const lanAddress = Object.entries(require('node:os').networkInterfaces())
  .filter(([name]) => !/virtual|vethernet|wsl/i.test(name)).flatMap(([, items]) => items)
  .find(item => item.family === 'IPv4' && !item.internal && /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(item.address))?.address;
async function main() {
  const docker = await ensureDockerReady({ autoStart: true });
  const container = 'underfit-rehearsal-postgres-1';
  function run(args, input) {
    const r = spawnSync(docker, args, { input, windowsHide: true, timeout: 120000, maxBuffer: 256 * 1024 * 1024 });
    if (r.error || r.status !== 0) throw new Error(r.error?.message || r.stderr.toString());
    return r.stdout;
  }
  function exec(args, input) { return run(['exec', '-i', container, ...args], input); }
  validateTarget(JSON.parse(run(['inspect', container]))[0]);
  run(['start', container]);
  for (let i = 0; i < 30; i++) {
    const r = spawnSync(docker, ['exec', container, 'pg_isready', '-U', 'underfit'], { windowsHide: true });
    if (r.status === 0) break;
    await new Promise(r => setTimeout(r, 1000));
  }
  const inspected = JSON.parse(run(['inspect', container]))[0];
  assert.ok(inspected.NetworkSettings.Ports['5432/tcp'].some(p => p.HostIp === '127.0.0.1' && p.HostPort === '55432'));
  fs.mkdirSync(directory, { recursive: true });
  const configPath = path.join(directory, 'server.json');
  let config;
  if (!fs.existsSync(configPath)) {
    const target = `underfit_gym_preview_${Date.now()}`;
    const password = crypto.randomBytes(32).toString('hex');
    const dump = exec(['pg_dump', '-U', 'underfit', '-d', source, '--format=custom']);
    fs.writeFileSync(path.join(directory, target + '.dump'), dump, { flag: 'wx' });
    exec(['psql', '-X', '-U', 'underfit', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'],
      `CREATE ROLE ${target} LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE;`);
    exec(['createdb', '-U', 'underfit', '--owner', target, target]);
    exec(['pg_restore', '-U', 'underfit', '--role', target, '-d', target, '--exit-on-error', '--no-owner', '--no-privileges'], dump);
    config = { ConnectionStrings: { UnderFit: `Host=127.0.0.1;Port=55432;Database=${target};Username=${target};Password=${password}` },
      Authentication: { DeviceKey: crypto.randomBytes(48).toString('hex'), JwtKey: crypto.randomBytes(48).toString('hex'),
        TabletDevices: { tablet1: crypto.randomBytes(32).toString('hex'), tablet2: crypto.randomBytes(32).toString('hex') } } };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), { flag: 'wx' });
  } else config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  assert.match(config.ConnectionStrings.UnderFit, /^Host=127\.0\.0\.1;Port=55432;Database=underfit_gym_preview_\d+;/);
  const headers = { 'X-UnderFit-Device-Key': config.Authentication.DeviceKey };
  async function ready() {
    try { return (await fetch(base + '/api/v1/settings/business/', { headers, signal: AbortSignal.timeout(2000) })).ok; }
    catch { return false; }
  }
  if (!await ready()) {
    const net = require('node:net');
    const probe = net.createServer();
    await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(5192, '127.0.0.1', resolve); });
    await new Promise(resolve => probe.close(resolve));
    const currentApi = path.join(directory, 'api-current');
    const apiDir = fs.existsSync(path.join(currentApi, 'UnderFit.Api.exe')) ? currentApi : path.join(root, 'dist/win-unpacked/resources/api');
    const log = fs.openSync(path.join(directory, 'api.log'), 'a');
    const child = spawn(path.join(apiDir, 'UnderFit.Api.exe'), [], { cwd: apiDir, detached: true, windowsHide: true,
      stdio: ['ignore', log, log], env: { ...process.env, TabletDevicesFile: configPath,
        ASPNETCORE_ENVIRONMENT: 'Production', ASPNETCORE_URLS: lanAddress ? `${base};http://${lanAddress}:5192` : base,
        Media__StoragePath: path.join(directory, 'media'), Media__FfmpegPath: path.join(root, 'release/tools/ffmpeg.exe'),
        Logging__LogLevel__Default: 'Warning' } });
    await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
    fs.writeFileSync(path.join(directory, 'api.pid'), String(child.pid));
    child.unref(); fs.closeSync(log);
    for (let i = 0; i < 60 && !await ready(); i++) await new Promise(r => setTimeout(r, 500));
    assert.ok(await ready(), 'El servidor no respondió; revisar api.log en el ensayo.');
  }
  const api = createUnderFitApiClient({ baseUrl: base, deviceKey: config.Authentication.DeviceKey });
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Montevideo' }).format(new Date());
  const members = (await api.listMembers()).sort((a, b) => b.membershipExpiresOn.localeCompare(a.membershipExpiresOn) || a.name.localeCompare(b.name));
  assert.equal(members.length, 1785, 'Cantidad inesperada de socios en la copia.');
  const selected = members.slice(0, 12);
  let professors = await api.listProfessors();
  for (const name of ['ENSAYO - Laura', 'ENSAYO - Diego']) {
    if (!professors.some(p => p.name === name)) await api.createProfessor({ name, pin: '2027' });
  }
  professors = (await api.listProfessors()).filter(p => p.name.startsWith('ENSAYO -'));
  const definitions = [['Sentadilla', 'Piernas'], ['Remo', 'Espalda'], ['Press de pecho', 'Pecho'], ['Plancha', 'Core'], ['Estocadas', 'Piernas'], ['Press de hombros', 'Hombros']];
  let exercises = await api.listExercises();
  for (const [name, muscleGroup] of definitions) if (!exercises.some(e => e.name === `ENSAYO - ${name}`))
    await api.createExercise({ name: `ENSAYO - ${name}`, muscleGroup, instructions: 'Datos de ejemplo para probar la aplicación; no es una prescripción de entrenamiento.', gifUrl: null });
  exercises = (await api.listExercises()).filter(e => e.name.startsWith('ENSAYO -'));
  const plans = await api.listMemberWorkoutPlans();
  for (let i = 0; i < 6; i++) {
    if (plans.some(p => p.identityNumber === selected[i].identityNumber)) continue;
    const days = [0, 1].map(d => ({ position: d + 1, name: `Día ${d + 1}`, muscleGroups: d ? 'Tren superior' : 'Piernas y core',
      exercises: exercises.slice(d * 3, d * 3 + 3).map((e, n) => ({ exerciseId: e.id, position: n + 1, sets: 3, repetitions: '10', load: null, restSeconds: 60, notes: 'Ejemplo de prueba' })) }));
    await api.assignWorkoutPlan(selected[i].identityNumber, { name: `ENSAYO - Rutina ${i % 2 ? 'B' : 'A'}`, professorId: professors[i % 2].id, days });
  }
  let classes = await api.listClasses(today);
  for (const [i, time] of ['17:00:00', '19:00:00', '21:00:00'].entries()) {
    const name = ['ENSAYO - Funcional', 'ENSAYO - Fuerza', 'ENSAYO - Circuito'][i];
    let cls = classes.find(c => c.name === name && c.date === today && c.time === time);
    if (!cls) cls = await api.createClass({ name, date: today, time, durationMinutes: 60, capacity: 16,
      professor: professors[i % 2].name, professorId: professors[i % 2].id, locationId: 2, notes: 'Solo copia de ensayo; no pertenece a la operación real del gimnasio.' });
    const enrolled = await api.listClassEnrollments(cls.id);
    for (const member of selected.slice(i * 3, i * 3 + 6))
      if (!enrolled.some(e => e.memberIdentityNumber === member.identityNumber)) await api.enrollClassMember(cls.id, member.identityNumber);
  }
  classes = (await api.listClasses(today)).filter(c => c.name.startsWith('ENSAYO -') && c.date === today && c.time >= '17:00:00');
  const assignments = await api.listMemberWorkoutPlans();
  for (const cls of classes) assert.equal((await api.listClassEnrollments(cls.id)).length, 6);
  assert.ok(assignments.length >= 6);
  fs.writeFileSync(path.join(directory, 'preview.json'), JSON.stringify({ source, date: today, members: members.length,
    classes: classes.map(c => ({ name: c.name, id: c.id, time: c.time })), routines: assignments.length, localOnly: !lanAddress }, null, 2));
  const log = fs.openSync(path.join(directory, 'desktop.log'), 'a');
  const desktop = spawn(path.join(root, 'node_modules/electron/dist/electron.exe'), [path.join(__dirname, 'gym-copy-desktop.js')],
    { cwd: root, detached: true, windowsHide: true, stdio: ['ignore', log, log] });
  await new Promise((resolve, reject) => { desktop.once('spawn', resolve); desktop.once('error', reject); });
  desktop.unref(); fs.closeSync(log);
  console.log(`Abierto ensayo local: ${members.length} socios, ${classes.length} clases con 6 inscriptos y ${assignments.length} rutinas. ${directory}`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
