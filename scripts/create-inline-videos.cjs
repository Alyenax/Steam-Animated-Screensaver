'use strict';
// Keep the published originals intact and create bounded copies for GitHub's inline player.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const run = promisify(execFile);
const ffmpeg = require('ffmpeg-static');
const ffprobe = require('ffprobe-static').path;
const root = path.resolve(__dirname, '..');
const directory = path.join(root, 'dist/public-launch-v2');
async function probe(file) {
  return JSON.parse(
    (await run(ffprobe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file]))
      .stdout
  );
}
async function encode(name) {
  const original = path.join(directory, name + '.mp4');
  const output = path.join(directory, name + '-inline.mp4');
  const before = crypto
    .createHash('sha256')
    .update(await fs.readFile(original))
    .digest('hex');
  const source = await probe(original);
  const duration = Number(source.format.duration);
  // Reserve space for AAC, MP4 overhead and metadata, with margin below 10,000,000 bytes.
  const bitrate = Math.floor(((9_300_000 * 8) / duration - 96_000) / 1000) + 'k';
  const passlog = path.join(directory, name + '-inline-pass');
  const video = [
    '-vf',
    'scale=1280:720:flags=lanczos',
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-b:v',
    bitrate,
    '-pix_fmt',
    'yuv420p',
    '-passlogfile',
    passlog
  ];
  console.log(name + ': encoding 720p at the original frame rate');
  await run(ffmpeg, [
    '-v',
    'error',
    '-y',
    '-i',
    original,
    '-map',
    '0:v:0',
    ...video,
    '-pass',
    '1',
    '-an',
    '-f',
    'null',
    '/dev/null'
  ]);
  await run(ffmpeg, [
    '-v',
    'error',
    '-y',
    '-i',
    original,
    '-map',
    '0:v:0',
    '-map',
    '0:a:0',
    ...video,
    '-pass',
    '2',
    '-c:a',
    'aac',
    '-b:a',
    '96k',
    '-movflags',
    '+faststart',
    output
  ]);
  const bytes = (await fs.stat(output)).size;
  if (bytes >= 10_000_000) throw Error('Inline video exceeds 10 MB: ' + name);
  await run(ffmpeg, ['-v', 'error', '-xerror', '-i', output, '-f', 'null', '-']);
  const result = await probe(output);
  const v = result.streams.find((s) => s.codec_type === 'video');
  const a = result.streams.find((s) => s.codec_type === 'audio');
  if (
    v.width !== 1280 ||
    v.height !== 720 ||
    v.r_frame_rate !== source.streams.find((s) => s.codec_type === 'video').r_frame_rate ||
    Math.abs(Number(result.format.duration) - duration) > 0.1 ||
    !a
  )
    throw Error('Inline stream validation failed: ' + name);
  const after = crypto
    .createHash('sha256')
    .update(await fs.readFile(original))
    .digest('hex');
  if (after !== before) throw Error('Original changed');
  const entry = {
    file: path.basename(output),
    bytes,
    duration: Number(result.format.duration),
    width: v.width,
    height: v.height,
    fps: v.r_frame_rate,
    audio: a.codec_name,
    allFramesDecoded: true,
    originalUnchanged: true,
    originalSha256: before,
    sha256: crypto
      .createHash('sha256')
      .update(await fs.readFile(output))
      .digest('hex')
  };
  console.log(JSON.stringify(entry));
  return entry;
}
(async () => {
  const videos = await Promise.all(
    ['Steam-Animated-Screensaver-demo', 'Steam-Animated-Screensaver-SteamOS-overview'].map(encode)
  );
  await fs.writeFile(
    path.join(root, 'dist/INLINE_VIDEO_VALIDATION.json'),
    JSON.stringify({ result: 'passed', videos }, null, 2) + '\n'
  );
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
