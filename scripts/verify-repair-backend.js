const { spawnSync } = require('node:child_process');
const path = require('node:path');
const crypto = require('node:crypto');
const { validateTarget } = require('./import-rehearsal');
const docker = path.join(process.env.LOCALAPPDATA, 'Programs/DockerDesktop/resources/bin/docker.exe');
const container = 'underfit-rehearsal-postgres-1';
function run(args, input) {
  const result = spawnSync(docker, args, { input, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw Error(result.stderr || result.error?.message);
  return result.stdout;
}
const inspected = JSON.parse(run(['inspect', container]))[0];
validateTarget(inspected);
if (!inspected.State.Running || !inspected.NetworkSettings.Ports['5432/tcp'].some(x => x.HostIp === '127.0.0.1' && x.HostPort === '55432')) throw Error('Ensayo no disponible.');
const target = `underfit_repair_check_${Date.now()}`;
const password = crypto.randomBytes(32).toString('hex');
const sql = text => run(['exec', '-i', container, 'psql', '-X', '-U', 'underfit', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], text);
sql(`CREATE ROLE ${target} LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE; CREATE DATABASE ${target} OWNER ${target};`);
try {
  const result = spawnSync('dotnet', ['test', 'backend/UnderFit.IntegrationTests', '--no-restore', '--verbosity', 'normal'], {
    encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, UNDERFIT_TEST_CONNECTION_STRING: `Host=127.0.0.1;Port=55432;Database=${target};Username=${target};Password=${password}` },
  });
  // Reports contain test diagnostics, never the generated credential.
  console.log((result.stdout + result.stderr).replaceAll(password, '[redacted]'));
  console.log('Base aislada de verificación: ' + target);
  process.exitCode = result.status ?? 1;
} finally {
  sql(`ALTER ROLE ${target} NOLOGIN PASSWORD NULL;`);
}
