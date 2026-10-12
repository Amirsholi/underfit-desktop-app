const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { randomUUID } = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const run = promisify(execFile);

// Normalize pixel aspect first, then center-crop and scale without stretching.
// Keep identical to ExerciseVideoProcessor.cs (desktop-local and API).
const VIDEO_FILTER = "scale=w='trunc(ih*dar/2)*2':h=ih,setsar=1,crop=w='min(iw,ih)':h='min(iw,ih)',scale=720:720,setsar=1,fps=24";
const MAXIMUM_BYTES = 80 * 1024 * 1024;

function createExerciseVideoProcessor({
  storagePath = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), '.local', 'share'), 'UnderFit', 'media', 'exercises'),
  ffmpegPath = process.env.UNDERFIT_FFMPEG_PATH || (process.resourcesPath ? path.join(process.resourcesPath, 'tools', 'ffmpeg.exe') : 'ffmpeg'),
} = {}) {
  return async function processVideo(filePath) {
    if (typeof filePath !== 'string' || !['.gif', '.mp4', '.webm', '.mov', '.m4v'].includes(path.extname(filePath).toLowerCase())) {
      throw new Error('Seleccioná un GIF o video válido.');
    }
    const stats = await fs.stat(filePath);
    if (!stats.isFile() || !stats.size || stats.size > MAXIMUM_BYTES) throw new Error('El video debe pesar menos de 80 MB.');
    await fs.mkdir(storagePath, { recursive: true });
    const output = path.join(storagePath, `${randomUUID()}.mp4`);
    let executable = ffmpegPath;
    // Electron development has resourcesPath but no bundled tools yet.
    if (path.isAbsolute(executable) && !process.env.UNDERFIT_FFMPEG_PATH) {
      try { await fs.access(executable); } catch { executable = 'ffmpeg'; }
    }
    try {
      await run(executable, ['-nostdin', '-hide_banner', '-loglevel', 'error', '-n', '-i', path.resolve(filePath),
        '-map', '0:v:0', '-t', '15', '-an', '-vf', VIDEO_FILTER,
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '26', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', output],
      { windowsHide: true, timeout: 120000, maxBuffer: 1024 * 1024 });
      return { mediaUrl: output, previewUrl: output };
    } catch (error) {
      // Only remove this operation's generated file, never the original recording.
      await fs.rm(output, { force: true });
      if (error.code === 'ENOENT') throw new Error('No se encontró FFmpeg para procesar el video. Revisá la instalación de Under-Fit.');
      throw new Error('No se pudo procesar el video. Probá con otro archivo MP4, MOV o WebM.');
    }
  };
}

module.exports = { createExerciseVideoProcessor, VIDEO_FILTER, MAXIMUM_BYTES };
