const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');

async function main() {
  const directory = path.join(process.env.LOCALAPPDATA, 'UnderFitRehearsal/tablet-test');
  const configPath = path.join(directory, 'server.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (!config.ConnectionStrings?.UnderFit?.startsWith('Host=127.0.0.1;Port=55432;Database=underfit_tablet_test;'))
    throw new Error('Solo se permite la base aislada de prueba de tablets.');
  const host = process.argv[2];
  if (!Object.values(os.networkInterfaces()).flat().some(x => !x.internal && x.family === 'IPv4' && x.address === host))
    throw new Error('Indicá la IPv4 local de esta PC.');
  try { await fetch('http://127.0.0.1:5190/health/ready', { signal: AbortSignal.timeout(1000) }); throw new Error('El puerto 5190 ya está ocupado.'); }
  catch (error) { if (error.message.includes('ocupado')) throw error; }
  const apiDirectory = path.resolve(__dirname, '../backend/UnderFit.Api/bin/TabletIntegration/net10.0');
  const output = fs.openSync(path.join(directory, 'api.log'), 'a');
  const errors = fs.openSync(path.join(directory, 'api-error.log'), 'a');
  const child = spawn(path.join(process.env.ProgramFiles, 'dotnet/dotnet.exe'), ['UnderFit.Api.dll'], {
    cwd: apiDirectory, detached: true, windowsHide: true, stdio: ['ignore', output, errors],
    env: { ...process.env, TabletDevicesFile: configPath, ASPNETCORE_ENVIRONMENT: 'Production',
      Logging__LogLevel__Microsoft_EntityFrameworkCore: 'Warning',
      'Logging__LogLevel__Microsoft.EntityFrameworkCore.Database.Command': 'Warning',
      ASPNETCORE_URLS: `http://127.0.0.1:5190;http://${host}:5190`,
      Media__StoragePath: path.join(directory, 'media'), Media__FfmpegPath: path.resolve(__dirname, '../release/tools/ffmpeg.exe') },
  });
  child.on('error', error => { console.error(error.message); process.exitCode = 1; });
  fs.writeFileSync(path.join(directory, 'api.pid'), String(child.pid));
  child.unref(); fs.closeSync(output); fs.closeSync(errors);
  console.log(`Servidor de ensayo: http://${host}:5190/tablet/ (PID ${child.pid})`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
