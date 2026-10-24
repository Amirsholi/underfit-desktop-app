const fs = require('node:fs');
const path = require('node:path');
const { execFile, spawn } = require('node:child_process');

function findDockerExecutable() {
  if (process.platform !== 'win32') return 'docker';
  const candidates = [
    path.join(process.env.LOCALAPPDATA || '', 'Programs/DockerDesktop/resources/bin/docker.exe'),
    path.join(process.env.ProgramFiles || '', 'Docker/Docker/resources/bin/docker.exe'),
    ...(process.env.PATH || '').split(path.delimiter).filter(Boolean).map(folder => path.join(folder, 'docker.exe')),
  ];
  const found = candidates.find(file => fs.existsSync(file));
  if (!found) throw new Error('No se encontró Docker. Falta preparar la PC principal del gimnasio.');
  return found;
}
function probeDocker(executable) {
  return new Promise(resolve => execFile(executable, ['info', '--format', '{{.ServerVersion}}'],
    { windowsHide: true, timeout: 4000, maxBuffer: 65536 }, error => resolve(!error)));
}
function launchDockerDesktop() {
  const executable = [
    path.join(process.env.LOCALAPPDATA || '', 'Programs/DockerDesktop/Docker Desktop.exe'),
    path.join(process.env.ProgramFiles || '', 'Docker/Docker/Docker Desktop.exe'),
  ].find(file => fs.existsSync(file));
  if (!executable) throw new Error('Abrí Docker y volvé a iniciar Under-Fit.');
  return new Promise((resolve, reject) => {
    const child = spawn(executable, [], { windowsHide: true, detached: true, stdio: 'ignore' });
    child.once('error', reject);
    child.once('spawn', () => { child.unref(); resolve(); });
  });
}
async function ensureDockerReady({ autoStart = false, executable = findDockerExecutable(),
  probe = probeDocker, launch = launchDockerDesktop,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), attempts = 30, intervalMs = 2000 } = {}) {
  if (await probe(executable)) return executable;
  if (!autoStart) throw new Error('Docker todavía no está disponible. Abrilo y volvé a iniciar Under-Fit.');
  await launch();
  for (let attempt = 0; attempt < attempts; attempt++) {
    await sleep(intervalMs);
    if (await probe(executable)) return executable;
  }
  throw new Error('Docker no terminó de iniciar. Revisá su estado y volvé a abrir Under-Fit; los datos se conservan.');
}
module.exports = { findDockerExecutable, ensureDockerReady };
