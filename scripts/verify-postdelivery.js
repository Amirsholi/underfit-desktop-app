const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const net = require('node:net');
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const { validateTarget } = require('./import-rehearsal');

async function main() {
  const source = 'underfit_migration_check_1790773975418';
  const empty = source === '--empty';
  if (!empty) assert.match(source || '', /^underfit_migration_check_\d+$/, 'Solo admite una migraciÃ³n aislada o --empty.');
  const audit = { version: require('../package.json').version, archiveSha256: null };
  const container = 'underfit-rehearsal-postgres-1';
  const docker = path.join(process.env.LOCALAPPDATA, 'Programs/DockerDesktop/resources/bin/docker.exe');
  function run(args, input) {
    const r = spawnSync(docker, args, { input, windowsHide: true, maxBuffer: 256 * 1024 * 1024 });
    if (r.error || r.status !== 0) throw new Error(r.error?.message || r.stderr.toString());
    return r.stdout;
  }
  function exec(args, input) { return run(['exec', '-i', container, ...args], input); }
  function query(db, sql) { return exec(['psql', '-X', '-U', 'underfit', '-d', db, '-v', 'ON_ERROR_STOP=1', '-tAc', sql]).toString().trim(); }
  const inspected = JSON.parse(run(['inspect', container]))[0];
  validateTarget(inspected);
  assert.ok(inspected.State.Running, 'El contenedor de ensayo debe estar iniciado.');
  assert.ok(inspected.NetworkSettings.Ports['5432/tcp'].some(p => p.HostIp === '127.0.0.1' && p.HostPort === '55432'));
  const target = `underfit_postdelivery_check_${Date.now()}`;
  // A persisted volume may have a different password from its original container env.
  // Give only this fresh clone its own role; never rotate existing credentials.
  const password = crypto.randomBytes(32).toString('hex');
  const directory = path.join(process.env.LOCALAPPDATA, 'UnderFitRehearsal', 'packaged-checks', target);
  fs.mkdirSync(directory, { recursive: true });
  const dump = empty ? null : exec(['pg_dump', '-U', 'underfit', '-d', source, '--format=custom']);
  if (dump) fs.writeFileSync(path.join(directory, 'before-start.dump'), dump, { flag: 'wx' });
  exec(['psql', '-X', '-U', 'underfit', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'],
    `CREATE ROLE ${target} LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE;`);
  exec(['createdb', '-U', 'underfit', '--owner', target, target]);
  if (dump) exec(['pg_restore', '-U', 'underfit', '--role', target, '-d', target, '--exit-on-error', '--no-owner', '--no-privileges'], dump);
  const expectedMembers = empty ? 0 : Number(query(source, 'SELECT count(*) FROM members'));
  const tables = ['members', 'entries', 'membership_renewals', 'cash_sessions', 'cash_movements', 'product_sales', 'products'];
  const fingerprint = db => tables.map(table => query(db, `SELECT md5(COALESCE(string_agg(row_to_json(t)::text, E'\\n' ORDER BY row_to_json(t)::text),'')) FROM ${table} t`));
  const before = empty ? null : fingerprint(source);
  const listener = net.createServer();
  await new Promise((resolve, reject) => { listener.once('error', reject); listener.listen(0, '127.0.0.1', resolve); });
  const port = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  const key = crypto.randomBytes(48).toString('hex');
  const apiDir = path.resolve('backend/UnderFit.Api/bin/Debug/net10.0');
  const log = fs.openSync(path.join(directory, 'api.log'), 'wx');
  const child = spawn(path.join(apiDir, 'UnderFit.Api.exe'), [], {
    cwd: apiDir, windowsHide: true, stdio: ['ignore', log, log],
    env: { ...process.env, ASPNETCORE_ENVIRONMENT: 'Production', ASPNETCORE_URLS: base,
      ConnectionStrings__UnderFit: `Host=127.0.0.1;Port=55432;Database=${target};Username=${target};Password=${password}`,
      Authentication__DeviceKey: key, Authentication__JwtKey: crypto.randomBytes(48).toString('hex'),
      TabletDevicesFile: '', Media__StoragePath: path.join(directory, 'media'),
      Media__FfmpegPath: path.resolve('release/tools/ffmpeg.exe'), Logging__LogLevel__Default: 'Warning' },
  });
  let startupError;
  child.on('error', error => { startupError = error; });
  const report = { verified: false, source, target, packageVersion: audit.version, archiveSha256: audit.archiveSha256, checks: [] };
  try {
    let ready = false;
    for (let i = 0; i < 60; i++) {
      if (startupError) throw startupError;
      if (child.exitCode !== null) throw new Error('El servidor empaquetado terminÃ³ antes de quedar listo; revisar el log externo.');
      try { ready = (await fetch(base + '/health/ready', { signal: AbortSignal.timeout(1000) })).ok; } catch { /* waiting for this child */ }
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    assert.ok(ready, 'El servidor no quedÃ³ disponible.');
    for (const route of ['/api/v1/members/', '/api/v1/products/', '/api/v1/settings/business/']) {
      const response = await fetch(base + route, { headers: { 'X-UnderFit-Device-Key': key }, signal: AbortSignal.timeout(15000) });
      assert.equal(response.status, 200, route);
      if (route === '/api/v1/members/') assert.equal((await response.json()).length, expectedMembers);
      report.checks.push({ route, status: response.status });
    }
    assert.equal((await fetch(base + '/api/v1/members/')).status, 401);
    async function call(route, method='GET', body) {
      const response=await fetch(base+route,{method,headers:{'X-UnderFit-Device-Key':key,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
      if(!response.ok)throw Error(method+' '+route+' '+response.status+' '+await response.text());
      return response.json();
    }
    const member=(await call('/api/v1/members/')).find(m=>m.membershipExpiresOn>='2026-12-01');
    assert.ok(member);
    const professor=await call('/api/v1/staff/','POST',{name:'Verificacion aislada',pin:'4826'});
    const exercise=await call('/api/v1/admin/training/exercises','POST',{name:'Ejercicio verificacion',muscleGroup:'Espalda'});
    const plan=await call('/api/v1/admin/members/'+member.identityNumber+'/workout-plan','PUT',{name:'Rutina verificacion',professorId:professor.id,days:[{position:1,name:'Día 1',muscleGroups:'',exercises:[{exerciseId:exercise.id,position:1,sets:3,repetitions:'10'}]}]});
    assert.equal(plan.days[0].muscleGroups,'Espalda');
    await call('/api/v1/admin/training/exercises/'+exercise.id,'PUT',{...exercise,isActive:false});
    assert.ok(!(await call('/api/v1/admin/training/exercises?includeInactive=false')).some(e=>e.id===exercise.id));
    const retainedPlan=await call('/api/v1/admin/members/'+member.identityNumber+'/workout-plan','PUT',{name:'Rutina conservada',professorId:professor.id,days:[{position:1,name:'Día 1',muscleGroups:'',exercises:[{exerciseId:exercise.id,position:1,sets:4,repetitions:'12'}]}]});
    assert.equal(retainedPlan.days[0].exercises[0].exerciseId,exercise.id);
    const gymClass=await call('/api/v1/classes/','POST',{name:'Clase verificacion',date:'2026-12-01',time:'17:00:00',durationMinutes:60,capacity:12,professor:'Verificacion aislada',professorId:professor.id,locationId:2});
    await call('/api/v1/classes/'+gymClass.id+'/enrollments','POST',{identityNumber:member.identityNumber});
    assert.equal((await call('/api/v1/classes/'+gymClass.id+'/enrollments')).length,1);
    await call('/api/v1/classes/'+gymClass.id+'/enrollments/'+member.identityNumber,'DELETE');
    assert.equal((await call('/api/v1/classes/'+gymClass.id+'/enrollments')).length,0);
    await call('/api/v1/classes/'+gymClass.id,'DELETE');
    assert.ok(!(await call('/api/v1/classes/agenda?from=2026-12-01')).some(c=>c.id===gymClass.id));
    const historyIdentity=query(target,'SELECT "MemberIdentityNumber" FROM entries WHERE NOT "IsAnnulled" GROUP BY "MemberIdentityNumber" ORDER BY count(*) DESC LIMIT 1');
    const history=await call('/api/v1/entries?identityNumber='+historyIdentity);
    assert.ok(history.every(e=>e.identityNumber===historyIdentity));
    const expectedHistory=Number(query(target,`SELECT count(*) FROM entries WHERE "MemberIdentityNumber"='${historyIdentity}' AND NOT "IsAnnulled"`));
    assert.ok(expectedHistory>100,'Exercise complete history beyond the old 100-row limit');
    assert.equal(history.length,expectedHistory);
    report.postDelivery={exerciseRemovedFromCatalog:true,existingRoutinePreserved:true,routineSaved:true,muscleGroupsDerived:true,enrollmentRemoved:true,classDeleted:true,memberHistoryRows:history.length};

    if (empty) {
      report.emptyBusinessTables = {};
      const businessTables = query(target, "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '__EFMigrationsHistory' ORDER BY tablename").split('\n').filter(Boolean);
      for (const table of businessTables) {
        assert.match(table, /^[a-z_]+$/);
        const count = Number(query(target, `SELECT count(*) FROM ${table}`));
        report.emptyBusinessTables[table] = count;
        assert.equal(count, 0, `Datos iniciales inesperados en ${table}`);
      }
    } else {
      assert.deepEqual(fingerprint(source), before, 'CambiÃ³ la migraciÃ³n original.');
      assert.deepEqual(fingerprint(target), before, 'El arranque alterÃ³ los registros importados.');
    }
    report.membersVerified = expectedMembers;
    report.dataUnchanged = true;
    report.verified = true;
    console.log(`PASS: servidor de desarrollo, ${expectedMembers} socios, vistas y autorizaciÃ³n. Datos conservados. Informe: ${directory}`);
  } catch (error) {
    report.error = error.message;
    throw error;
  } finally {
    // Only the exact child created above; never search for or stop other APIs.
    if (child.exitCode === null && child.pid) {
      const ended = new Promise(resolve => child.once('exit', resolve));
      child.kill(); await ended;
    }
    fs.closeSync(log);
    // Keep the clone for inspection, but retire its one-run login credential.
    exec(['psql', '-X', '-U', 'underfit', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'],
      `ALTER ROLE ${target} NOLOGIN PASSWORD NULL;`);
    fs.writeFileSync(path.join(directory, 'verification.json'), JSON.stringify(report, null, 2));
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
