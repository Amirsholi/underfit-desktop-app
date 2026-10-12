// Explicitly isolated integration check; never connects to the production volume.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { validateTarget } = require('./import-rehearsal');
const { completeFirstInstallation } = require(process.argv.includes('--packaged')
  ? path.resolve('dist/win-unpacked/resources/app.asar/services/firstInstallation')
  : '../services/firstInstallation');
async function main() {
  const source = path.resolve(process.argv[2] || '');
  assert.ok(fs.statSync(source).isFile());
  const docker = require('../services/dockerRuntime').findDockerExecutable();
  const container = 'underfit-rehearsal-postgres-1';
  const run = (args, input) => {
    const result = spawnSync(docker, args, { input, encoding: 'utf8', windowsHide: true, maxBuffer: 128*1024*1024 });
    if (result.status !== 0) throw new Error(result.stderr || 'Docker verification failed');
    return result.stdout.trim();
  };
  validateTarget(JSON.parse(run(['inspect', container]))[0]);
  const database = `underfit_first_install_${Date.now()}`;
  const exec = (args, input) => run(['exec','-i',container,...args], input);
  const schema = exec(['pg_dump','-U','underfit','-d','underfit_migration_check_1790773975418','--schema-only','--no-owner','--no-privileges']);
  exec(['createdb','-U','underfit',database]);
  const query = sql => exec(['psql','-X','-U','underfit','-d',database,'-v','ON_ERROR_STOP=1','-qAt'],sql);
  query(schema);
  const root = path.join(process.env.LOCALAPPDATA,'UnderFitRehearsal','first-installation',database);
  fs.mkdirSync(path.join(root,'platform'),{recursive:true});
  fs.writeFileSync(path.join(root,'platform','first-installation.json'),JSON.stringify({status:'pending',source}));
  await assert.rejects(completeFirstInstallation({userDataPath:root,query:sql=>query(sql.startsWith('BEGIN;')
    ? sql.replace('INSERT INTO underfit_initial_import', "DO $$ BEGIN RAISE EXCEPTION 'simulated interruption'; END $$;\nINSERT INTO underfit_initial_import")
    : sql)}),/simulated interruption/);
  assert.equal(query('SELECT count(*) FROM members'),'0','Failed transaction must roll back all members');
  assert.equal(query('SELECT count(*) FROM cash_movements'),'0','Failed transaction must roll back all cash movements');
  await completeFirstInstallation({userDataPath:root,query});
  const state = JSON.parse(fs.readFileSync(path.join(root,'platform','first-installation.json')));
  assert.equal(state.status,'complete');
  // Simulate a crash between committing the import and saving local completion.
  state.status='pending';
  fs.writeFileSync(path.join(root,'platform','first-installation.json'),JSON.stringify(state));
  await completeFirstInstallation({userDataPath:root,query:sql=>{
    assert.ok(!sql.startsWith('BEGIN;'),'Committed data must never be imported twice');
    return query(sql);
  }});
  console.log(JSON.stringify({verified:true,database,counts:state.counts,checks:state.checks,report:root}));
}
if(require.main===module) {
  if (process.versions.electron) {
    const { app } = require('electron');
    app.whenReady().then(main).then(()=>app.quit()).catch(error=>{console.error(error.message);app.exit(1);});
  } else main().catch(error=>{console.error(error.message);process.exitCode=1;});
}
