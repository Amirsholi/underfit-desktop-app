const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn, spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const directory = path.join(process.env.LOCALAPPDATA, 'UnderFitRehearsal/tablet-test');
async function main() {
  const config = JSON.parse(fs.readFileSync(path.join(directory, 'server.json'), 'utf8'));
  if (!config.ConnectionStrings?.UnderFit?.startsWith('Host=127.0.0.1;Port=55432;Database=underfit_tablet_test;'))
    throw new Error('La configuración no corresponde al ensayo compartido.');
  async function ready() {
    try { return (await fetch('http://127.0.0.1:5190/api/v1/settings/business/', {
      headers: { 'X-UnderFit-Device-Key': config.Authentication.DeviceKey }, signal: AbortSignal.timeout(2000),
    })).ok; } catch { return false; }
  }
  if (!await ready()) {
    const docker = path.join(process.env.LOCALAPPDATA, 'Programs/DockerDesktop/resources/bin/docker.exe');
    const inspection = spawnSync(docker, ['inspect', '--format', '{{index .Config.Labels "com.docker.compose.project"}}', 'underfit-rehearsal-postgres-1'], { encoding: 'utf8', windowsHide: true, timeout: 10000 });
    if (inspection.status !== 0 || inspection.stdout.trim() !== 'underfit-rehearsal') throw new Error('Abrí Docker Desktop y volvé a intentar.');
    const start = spawnSync(docker, ['start', 'underfit-rehearsal-postgres-1'], { windowsHide: true, timeout: 15000 });
    if (start.status !== 0) throw new Error('No se pudo iniciar la base de ensayo.');
    const address = Object.entries(os.networkInterfaces()).filter(([name]) => !/virtual|vethernet|wsl/i.test(name))
      .flatMap(([, values]) => values).find(item => item.family === 'IPv4' && !item.internal)?.address;
    if (!address) throw new Error('No hay dirección IPv4 de red local.');
    const api = spawnSync(process.execPath, [path.join(__dirname, 'start-tablet-rehearsal.js'), address], { encoding: 'utf8', windowsHide: true, timeout: 10000 });
    if (api.status !== 0) throw new Error(api.stderr || 'No se pudo iniciar el servidor de ensayo.');
    for (let i = 0; i < 20 && !await ready(); i++) await new Promise(resolve => setTimeout(resolve, 500));
    if (!await ready()) throw new Error('El servidor no respondió. Revisá el registro del ensayo.');
  }
  const output = fs.openSync(path.join(directory, 'desktop.log'), 'a');
  const errors = fs.openSync(path.join(directory, 'desktop-error.log'), 'a');
  const desktop = spawn(path.join(root, 'node_modules/electron/dist/electron.exe'), [path.join(__dirname, 'rehearsal-desktop.js')], {
    cwd: root, detached: true, windowsHide: true, stdio: ['ignore', output, errors],
  });
  desktop.on('error', error => { console.error(error.message); process.exitCode = 1; });
  desktop.unref(); fs.closeSync(output); fs.closeSync(errors);
  console.log('Abierto UnderFit · ENSAYO CONECTADO, con la misma base que las tablets.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
