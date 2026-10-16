'use strict';
// Convert the first real-time playback scenes into a compact README loop.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'dist/public-launch-v2/Steam-Animated-Screensaver-demo.mp4');
const output = path.join(root, 'screenshots/public/screensaver-demo.gif');
const ffmpeg = require('ffmpeg-static');
execFileSync(
  ffmpeg,
  [
    '-v',
    'error',
    '-i',
    source,
    '-t',
    '12',
    '-filter_complex',
    'fps=20,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=192:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle',
    '-an',
    '-loop',
    '0',
    '-y',
    output
  ],
  { stdio: 'pipe' }
);
execFileSync(ffmpeg, ['-v', 'error', '-i', output, '-f', 'null', '-'], { stdio: 'pipe' });
const probe = JSON.parse(
  execFileSync(
    require('ffprobe-static').path,
    ['-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', output],
    { encoding: 'utf8' }
  )
);
const stream = probe.streams[0];
if (stream.width !== 800 || Number(stream.nb_read_frames) !== 240)
  throw Error('Unexpected GIF dimensions or frame count.');
if (fs.statSync(output).size > 10 * 1024 * 1024)
  throw Error('README GIF exceeds the 10 MiB presentation budget.');
const report = {
  result: 'passed',
  file: 'screenshots/public/screensaver-demo.gif',
  width: stream.width,
  height: stream.height,
  frames: Number(stream.nb_read_frames),
  fps: 20,
  durationSeconds: Number(probe.format.duration),
  bytes: fs.statSync(output).size,
  loop: 'infinite',
  allFramesDecoded: true,
  content: 'Elden Ring in original framing and 16:9, followed by Cyberpunk 2077',
  sourceSpeed: 'real time, no interpolation added for the GIF'
};
fs.writeFileSync(
  path.join(root, 'dist/README_GIF_VALIDATION.json'),
  JSON.stringify(report, null, 2) + '\n'
);
console.log(JSON.stringify(report));
