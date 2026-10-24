const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const root = path.resolve(process.argv[2] || '');
const parent = path.join(process.env.LOCALAPPDATA, 'UnderFitRehearsal');
assert.equal(path.dirname(root), parent);
assert.match(path.basename(root), /^update-check-\d+$/);
const installed = path.join(root, 'installed');
const eventPath = path.join(root, 'events.jsonl');
function execute(file, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { windowsHide: true, stdio: 'ignore' });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`Proceso de ensayo terminó con código ${code}`)));
  });
}
async function main() {
  assert.ok(!fs.existsSync(installed) || fs.readdirSync(installed).length === 0, 'No se sobrescribe una instalación anterior.');
  assert.ok(!fs.existsSync(eventPath), 'Archivá los eventos anteriores antes de repetir el ensayo.');
  const server = http.createServer((req, res) => {
    const name = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname.slice(1));
    if (!['latest.yml', 'UnderFit-Update-Rehearsal-0.0.2.exe', 'UnderFit-Update-Rehearsal-0.0.2.exe.blockmap'].includes(name)) {
      res.writeHead(404).end(); return;
    }
    const file = path.join(root, 'v2', name);
    if (!fs.existsSync(file)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Length': fs.statSync(file).size, 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(5298, '127.0.0.1', resolve); });
  try {
    await execute(path.join(root, 'v1', 'UnderFit-Update-Rehearsal-0.0.1.exe'), ['/S', `/D=${installed}`]);
    console.log('Versión 0.0.1 instalada en el destino aislado.');
    const app = spawn(path.join(installed, 'UnderFit Update Rehearsal.exe'), [], { windowsHide: true, stdio: 'ignore' });
    let launchError;
    app.once('error', error => { launchError = error; });
    let events = [];
    const deadline = Date.now() + 240000;
    while (Date.now() < deadline) {
      if (launchError) throw launchError;
      if (fs.existsSync(eventPath)) events = fs.readFileSync(eventPath, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
      if (events.some(e => e.event === 'fatal' || (e.event === 'result' && !e.detail.installing)))
        throw new Error(`El ensayo se detuvo; revisar ${eventPath}`);
      if (events.some(e => e.event === 'verified-new-version')) break;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    const starts = events.filter(e => e.event === 'started');
    assert.deepEqual(starts.map(e => e.version), ['0.0.1', '0.0.2']);
    assert.equal(starts[0].detail, starts[1].detail, 'La actualización cambió los datos de usuario.');
    assert.ok(events.some(e => e.event === 'backup'));
    assert.deepEqual(fs.readFileSync(path.join(root, 'profile', 'preserved-data.json')),
      fs.readFileSync(path.join(root, 'before-update.json')));
    const report = { verified: true, scope: 'isolated-nsis-and-real-updater',
      from: '0.0.1', to: '0.0.2', profilePreserved: true, backupBeforeInstall: true,
      productionApiVerified: false, verifiedAtUtc: new Date().toISOString() };
    fs.writeFileSync(path.join(root, 'verification.json'), JSON.stringify(report, null, 2));
    console.log(`PASS: instalación, descarga, respaldo, actualización y reapertura; datos conservados. ${root}`);
    // Only the dedicated test installation is removed; reports/profile remain.
    await new Promise(resolve => setTimeout(resolve, 1500));
    await execute(path.join(installed, 'Uninstall UnderFit Update Rehearsal.exe'), ['/S']);
    console.log('Aplicación de ensayo desinstalada; informe y perfil conservados.');
  } finally { server.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
