'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'dist/public-launch');
const ffmpeg = process.env.SAS_CAPTURE_FFMPEG || require('ffmpeg-static');
const ffprobe = process.env.SAS_CAPTURE_FFPROBE || require('ffprobe-static').path;
async function run(exe, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(exe, args, { cwd: out, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '',
      stderr = '';
    p.stdout.on('data', (s) => (stdout += s));
    p.stderr.on('data', (s) => {
      stderr = (stderr + s).slice(-12000);
    });
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve(stdout) : reject(new Error(stderr))));
  });
}
async function main() {
  const capture = JSON.parse(await fs.readFile(path.join(out, 'CAPTURE.json'), 'utf8'));
  assert.deepEqual(capture.errors, []);
  assert.deepEqual(capture.externalRequests, []);
  const info = JSON.parse(
    await run(ffprobe, [
      '-v',
      'error',
      '-show_format',
      '-show_streams',
      '-of',
      'json',
      'capture.webm'
    ])
  );
  const duration = Number(info.format.duration);
  const base = [
    '-hide_banner',
    '-v',
    'warning',
    '-i',
    'capture.webm',
    '-an',
    '-map_metadata',
    '-1'
  ];
  const encode = [
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '20',
    '-pix_fmt',
    'yuv420p',
    '-r',
    '30',
    '-movflags',
    '+faststart'
  ];
  // Small reserved caption band: no application controls or artist credits are covered.
  const filter = 'scale=1824:1026:flags=lanczos,pad=1920:1080:48:0:color=0x080d16,setsar=1';
  await run(ffmpeg, [
    ...base,
    '-vf',
    'scale=1920:1080:flags=lanczos,setsar=1',
    ...encode,
    '-y',
    'Steam-Animated-Screensaver-demo-clean.mp4'
  ]);
  const titles = [
    'Original size - full image',
    '16:9 crop - the same animation',
    'Choose which games to include',
    'Change the animation and adjust its framing',
    'Move the still artwork and preview the result',
    'Optional 24 / 30 fps processing - results depend on the source',
    'SteamOS / macOS / Linux / Windows - testers and contributors welcome'
  ];
  const stamp = (s) => {
    const ms = Math.round(s * 1000);
    return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
  };
  const fontCandidates = [
    process.env.SAS_CAPTURE_FONT,
    '/System/Library/Fonts/Supplemental/Arial.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    'C:/Windows/Fonts/arial.ttf'
  ].filter(Boolean);
  let font;
  for (const candidate of fontCandidates) {
    if (
      await fs.access(candidate).then(
        () => true,
        () => false
      )
    ) {
      font = candidate;
      break;
    }
  }
  assert(font, 'Set SAS_CAPTURE_FONT to a local TrueType font path');
  const escapedFont = font.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "'\\''");
  const filters = [filter];
  const srt = [];
  for (let i = 0; i < capture.chapters.length; i++) {
    const start = capture.chapters[i].seconds;
    const end = capture.chapters[i + 1]?.seconds ?? duration;
    const caption = titles[i];
    await fs.writeFile(path.join(out, `caption-${i}.txt`), caption);
    filters.push(
      `drawtext=fontfile='${escapedFont}':textfile=caption-${i}.txt:fontsize=27:fontcolor=white:x=(w-text_w)/2:y=1041:enable='between(t,${start},${end})'`
    );
    srt.push(`${i + 1}\n${stamp(start)} --> ${stamp(end - 0.02)}\n${caption}\n`);
  }
  await fs.writeFile(path.join(out, 'captions.srt'), srt.join('\n'));
  await run(ffmpeg, [
    ...base,
    '-vf',
    filters.join(','),
    ...encode,
    '-y',
    'Steam-Animated-Screensaver-demo.mp4'
  ]);
  const target = 'Steam-Animated-Screensaver-demo.mp4';
  await run(ffmpeg, [
    '-v',
    'error',
    '-ss',
    '2',
    '-i',
    target,
    '-frames:v',
    '1',
    '-y',
    'poster.jpg'
  ]);
  // Decode the whole final file to catch corrupt frames, rather than just checking its header.
  await run(ffmpeg, ['-v', 'error', '-i', target, '-f', 'null', '-']);
  const final = JSON.parse(
    await run(ffprobe, ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', target])
  );
  const v = final.streams.find((s) => s.codec_type === 'video');
  assert.equal(v.codec_name, 'h264');
  assert.equal(v.pix_fmt, 'yuv420p');
  assert.equal(v.width, 1920);
  assert.equal(v.height, 1080);
  assert.equal(v.avg_frame_rate, '30/1');
  assert(!final.streams.some((s) => s.codec_type === 'audio'));
  await fs.writeFile(
    path.join(out, 'VIDEO_VALIDATION.json'),
    JSON.stringify(
      {
        result: 'passed',
        sourceVersion: capture.sourceVersion,
        duration: Number(final.format.duration),
        bytes: Number(final.format.size),
        codec: v.codec_name,
        pixelFormat: v.pix_fmt,
        width: v.width,
        height: v.height,
        fps: 30,
        audio: false,
        fullDecode: 'passed',
        captureErrors: capture.errors,
        externalRequests: capture.externalRequests,
        sourceCatalogUnchanged: capture.sourceCatalogUnchanged,
        limitations:
          'Recording of actual UI/player in a temporary catalog; no SteamOS/Windows native execution claim. No interpolation applied to shown artwork.'
      },
      null,
      2
    ) + '\n'
  );
  console.log(
    JSON.stringify({ result: 'passed', duration: final.format.duration, bytes: final.format.size })
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
