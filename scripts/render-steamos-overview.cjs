'use strict';
const fs = require('node:fs/promises'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const musicSource = require('../launch/MUSIC_SOURCE.json');
const out = path.resolve(__dirname, '../dist/public-launch-v2');
const ffmpeg = process.env.SAS_CAPTURE_FFMPEG || require('ffmpeg-static');
const ffprobe = process.env.SAS_CAPTURE_FFPROBE || require('ffprobe-static').path;
const run = (args) =>
  execFileSync(ffmpeg, ['-v', 'error', ...args], {
    cwd: out,
    stdio: 'pipe',
    maxBuffer: 1024 * 1024
  });
(async () => {
  const general = JSON.parse(await fs.readFile(path.join(out, 'VIDEO_VALIDATION.json')));
  const chapters = general.chapters.filter((c) => c.file !== 'steam-big-picture-macos.mp4');
  assert.equal(chapters.length, 19);
  run([
    '-i',
    'edit-0.mp4',
    '-an',
    '-vf',
    "drawtext=fontfile='/System/Library/Fonts/Supplemental/Arial.ttf':text='App interface captured on macOS':fontsize=24:fontcolor=white:box=1:boxcolor=black@0.65:boxborderw=10:x=70:y=38",
    '-c:v',
    'libx264',
    '-preset',
    'fast',
    '-crf',
    '19',
    '-pix_fmt',
    'yuv420p',
    '-y',
    'steamos-intro.mp4'
  ]);
  const files = chapters.map((_, i) => (i === 0 ? 'steamos-intro.mp4' : `edit-${i}.mp4`));
  await fs.writeFile(
    path.join(out, 'steamos-concat.txt'),
    files.map((f) => `file '${f}'`).join('\n')
  );
  run([
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    'steamos-concat.txt',
    '-c',
    'copy',
    '-y',
    'steamos-clean.mp4'
  ]);
  const total = chapters.reduce((sum, c) => sum + c.duration / c.speed, 0);
  const temp = '.steamos-overview.mp4',
    target = 'Steam-Animated-Screensaver-SteamOS-overview.mp4';
  run([
    '-i',
    'steamos-clean.mp4',
    '-i',
    musicSource.preparedFile,
    '-map',
    '0:v:0',
    '-map',
    '1:a:0',
    '-c:v',
    'copy',
    '-af',
    `loudnorm=I=-23:TP=-3:LRA=10,afade=t=in:d=0.6,afade=t=out:st=${total - 5}:d=5`,
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-ar',
    '48000',
    '-t',
    String(total),
    '-map_metadata',
    '-1',
    '-metadata',
    'comment=' + musicSource.credit + ' ' + musicSource.licenseUrl,
    '-movflags',
    '+faststart',
    '-y',
    temp
  ]);
  run(['-i', temp, '-f', 'null', '-']);
  const info = JSON.parse(
    execFileSync(ffprobe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', temp], {
      cwd: out,
      encoding: 'utf8'
    })
  );
  await fs.rename(path.join(out, temp), path.join(out, target));
  await fs.writeFile(
    path.join(out, 'STEAMOS_VIDEO_VALIDATION.json'),
    JSON.stringify(
      {
        result: 'passed',
        file: target,
        duration: Number(info.format.duration),
        fullDecode: true,
        containsNativeMacSteamSequence: false,
        appCapturePlatform: 'macOS',
        disclosureInVideo: true,
        nativeSteamOSRecording: false,
        music: musicSource.title + ' - ' + musicSource.artist + ' (' + musicSource.license + ')',
        chapters
      },
      null,
      2
    ) + '\n'
  );
  console.log(JSON.stringify({ file: target, duration: info.format.duration, result: 'passed' }));
})().catch((e) => {
  console.error(e.stderr?.toString() || e.message);
  process.exitCode = 1;
});
