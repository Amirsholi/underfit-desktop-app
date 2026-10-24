const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function findFfmpeg() {
  if (process.env.UNDERFIT_FFMPEG_PATH) return process.env.UNDERFIT_FFMPEG_PATH;
  const output = execFileSync('where.exe', ['ffmpeg.exe'], {
    encoding: 'utf8',
    windowsHide: true,
  });
  return output.split(/\r?\n/).map(value => value.trim()).find(Boolean);
}

const source = findFfmpeg();
if (!source || !fs.existsSync(source)) {
  throw new Error(
    'No se encontró FFmpeg. Instalalo para construir el instalador o definí UNDERFIT_FFMPEG_PATH.'
  );
}

const destinationDirectory = path.join(__dirname, '..', 'release', 'tools');
const destination = path.join(destinationDirectory, 'ffmpeg.exe');
fs.mkdirSync(destinationDirectory, { recursive: true });
fs.copyFileSync(source, destination);
console.log(`FFmpeg preparado para el instalador: ${destination}`);
