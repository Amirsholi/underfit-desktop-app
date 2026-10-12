const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { promisify } = require('node:util');
const run = promisify(require('node:child_process').execFile);
const { createExerciseVideoProcessor, VIDEO_FILTER } = require('../services/exerciseVideoProcessor');
const ffmpeg = process.env.UNDERFIT_FFMPEG_PATH || 'ffmpeg';
const ffprobe = process.env.UNDERFIT_FFPROBE_PATH || 'ffprobe';

test('local and API use the same square crop contract', async () => {
  const api = await fs.readFile(path.join(__dirname, '../backend/UnderFit.Api/Media/ExerciseVideoProcessor.cs'), 'utf8');
  assert(api.includes(`VideoFilter = "${VIDEO_FILTER}"`));
});

test('processes phone/tablet video to a centered 720 square without altering the original', async t => {
  try { await run(ffmpeg, ['-version']); await run(ffprobe, ['-version']); }
  catch { t.skip('FFmpeg/FFprobe required for media integration test'); return; }
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'underfit-video-test-'));
  const processVideo = createExerciseVideoProcessor({ storagePath: path.join(root, 'processed'), ffmpegPath: ffmpeg });
  try {
    for (const orientation of ['portrait', 'landscape']) {
      const source = path.join(root, `${orientation}.mp4`);
      const filter = orientation === 'portrait'
        ? 'color=green:s=180x320:d=0.3,drawbox=x=0:y=0:w=iw:h=60:color=red:t=fill,drawbox=x=0:y=260:w=iw:h=60:color=blue:t=fill'
        : 'color=green:s=320x180:d=0.3,drawbox=x=0:y=0:w=60:h=ih:color=red:t=fill,drawbox=x=260:y=0:w=60:h=ih:color=blue:t=fill';
      await run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', filter, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', source]);
      const original = await fs.readFile(source);
      const result = await processVideo(source);
      assert.notEqual(result.mediaUrl, source);
      assert.equal(result.mediaUrl, result.previewUrl);
      assert.deepEqual(await fs.readFile(source), original);
      const probe = JSON.parse((await run(ffprobe, ['-v', 'error', '-show_streams', '-of', 'json', result.mediaUrl])).stdout);
      assert.equal(probe.streams.length, 1);
      const video = probe.streams[0];
      assert.deepEqual([video.width, video.height, video.sample_aspect_ratio, video.codec_name], [720, 720, '1:1', 'h264']);
      // All corners are green: the red/blue excess was cropped, not letterboxed or squeezed.
      const { stdout: rgb } = await run(ffmpeg, ['-v', 'error', '-i', result.mediaUrl, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], { encoding: 'buffer', maxBuffer: 2 * 1024 * 1024 });
      for (const [x,y] of [[4,4],[715,4],[4,715],[715,715]]) {
        const offset=(y*720+x)*3;
        assert(rgb[offset]<15 && rgb[offset+1]>110 && rgb[offset+2]<15, `${orientation}: crop corner ${x},${y}`);
      }
    }
    const long = path.join(root, 'long.mp4');
    await run(ffmpeg, ['-v', 'error', '-f', 'lavfi', '-i', 'color=green:s=160x90:d=16', '-f', 'lavfi', '-i', 'sine=duration=16', '-c:v', 'libx264', '-c:a', 'aac', '-shortest', long]);
    const result = await processVideo(long);
    const probe = JSON.parse((await run(ffprobe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', result.mediaUrl])).stdout);
    assert(Number(probe.format.duration)<=15.05);
    assert(probe.streams.every(s=>s.codec_type==='video'));
    const invalid = path.join(root, 'broken.mp4');
    await fs.writeFile(invalid, 'not a video');
    const before = await fs.readdir(path.join(root, 'processed'));
    await assert.rejects(processVideo(invalid), /No se pudo procesar/);
    assert.deepEqual(await fs.readdir(path.join(root, 'processed')), before);
    await assert.rejects(processVideo(path.join(root, 'file.txt')), /video válido/);
  } finally {
    // The target is the unique temporary directory created by this test only.
    await fs.rm(root, { recursive: true, force: true });
  }
});
