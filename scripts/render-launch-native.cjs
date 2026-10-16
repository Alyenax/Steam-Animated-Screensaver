'use strict';
// Edit native recordings; never interpolate frames or animate screenshots in the editor.
const fs = require('node:fs/promises'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const out = path.resolve(__dirname, '../dist/public-launch-v2');
const ffmpeg = process.env.SAS_CAPTURE_FFMPEG || require('ffmpeg-static');
const ffprobe = process.env.SAS_CAPTURE_FFPROBE || require('ffprobe-static').path;
async function run(exe, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(exe, args, { cwd: out });
    let log = '';
    p.stdout.on('data', (b) => (log += b));
    p.stderr.on('data', (b) => (log = (log + b).slice(-20000)));
    p.on('error', reject);
    p.on('exit', (c) => (c === 0 ? resolve(log) : reject(Error(log))));
  });
}
async function main() {
  const showcase = JSON.parse(await fs.readFile(path.join(out, 'SHOWCASE_VALIDATION.json')));
  assert.equal(showcase.result, 'passed');
  const chapters = [];
  function add(file, start, duration, caption, speed = 1) {
    chapters.push({ file, start, duration, caption, speed });
  }
  for (const s of showcase.segments.slice(0, 5))
    add(
      'showcase-final.mp4',
      s.start + 0.25,
      s.game.includes('Rainbow Six') ? 2 : 4,
      s.framing === 'original' ? 'Original framing · full image' : '16:9 crop'
    );
  add('batch-live.mp4', 0.6, 4.5, 'Select all · prepare 10 games');
  add('batch-live.mp4', 5.493, 81.2, 'Automatic preparation · 10 games · 8× speed', 8);
  add('batch-live.mp4', 86.8, 2.2, '10 games ready');
  add('settings-live.mp4', 0.3, 1.8, 'Choose the framing');
  add('settings-live.mp4', 9.8, 3.2, 'Position the still artwork');
  add('alternatives-loaded.mp4', 0.3, 2.6, 'Find another animation');
  add(
    'processing-enabled.mp4',
    0.3,
    4.5,
    'Optional 24 / 30 fps processing · shown here: 30 fps, light blend'
  );
  for (const s of showcase.segments.slice(5))
    add(
      'showcase-final.mp4',
      s.start + 0.25,
      s.game.includes('Rainbow Six') ? 2 : 4,
      s.framing === 'original' ? 'Original framing · full image' : '16:9 crop'
    );
  add('steam-idle.mp4', 0.3, 8, 'Steam inactivity delay · 5 minutes · apply with Steam closed');
  add('steam-big-picture-macos.mp4', 2, 10, 'Automatic playback in Steam Big Picture · macOS');
  chapters[chapters.length - 1].fullFrame = true;
  const previous = await fs
    .readFile(path.join(out, 'VIDEO_VALIDATION.json'), 'utf8')
    .then(JSON.parse, () => ({ chapters: [] }));
  const font = '/System/Library/Fonts/Supplemental/Arial.ttf';
  let total = 0;
  for (let i = 0; i < chapters.length; i++) {
    const c = chapters[i];
    c.timelineStart = total;
    total += c.duration / c.speed;
    await fs.writeFile(path.join(out, `native-caption-${i}.txt`), c.caption);
    // Native 1280×752 window is letterboxed in a 1920×1080 recording: remove titlebar and right padding.
    const framing = c.fullFrame
      ? 'scale=1920:1080:flags=lanczos'
      : 'crop=1838:1034:0:46,scale=1824:1026:flags=lanczos,pad=1920:1080:48:0:color=0x080d16';
    const filters = `setpts=(PTS-STARTPTS)/${c.speed},fps=60,${framing},setsar=1,drawtext=fontfile='${font}':textfile=native-caption-${i}.txt:fontsize=27:fontcolor=white:x=(w-text_w)/2:y=1041`;
    const old = previous.chapters[i];
    if (!(
      process.argv.includes('--reuse-clips') &&
      old &&
      ['file', 'start', 'duration', 'caption', 'speed', 'fullFrame'].every(
        (key) => old[key] === c[key]
      ) &&
      (await fs.stat(path.join(out, c.file))).mtimeMs <=
        (await fs.stat(path.join(out, `edit-${i}.mp4`)).catch(() => ({ mtimeMs: 0 }))).mtimeMs &&
      (await fs.access(path.join(out, `edit-${i}.mp4`)).then(
        () => true,
        () => false
      ))
    ))
      await run(ffmpeg, [
        '-hide_banner',
        '-v',
        'error',
        '-ss',
        String(c.start),
        '-t',
        String(c.duration),
        '-i',
        c.file,
        '-an',
        '-vf',
        filters,
        '-c:v',
        'libx264',
        '-preset',
        'fast',
        '-crf',
        '19',
        '-pix_fmt',
        'yuv420p',
        '-map_metadata',
        '-1',
        '-y',
        `edit-${i}.mp4`
      ]);
    console.log('Rendered', i + 1, '/', chapters.length);
  }
  await fs.writeFile(
    path.join(out, 'native-concat.txt'),
    chapters.map((_, i) => `file 'edit-${i}.mp4'`).join('\n')
  );
  await run(ffmpeg, [
    '-v',
    'error',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    'native-concat.txt',
    '-c',
    'copy',
    '-movflags',
    '+faststart',
    '-y',
    'Steam-Animated-Screensaver-demo-clean.mp4'
  ]);
  const target = 'Steam-Animated-Screensaver-demo.mp4';
  const temporaryTarget = '.Steam-Animated-Screensaver-remix.mp4';
  await run(ffmpeg, [
    '-v',
    'error',
    '-i',
    'Steam-Animated-Screensaver-demo-clean.mp4',
    '-i',
    'Bright-Scenes-original.wav',
    '-map',
    '0:v:0',
    '-map',
    '1:a:0',
    '-c:v',
    'copy',
    '-af',
    `loudnorm=I=-24:TP=-9:LRA=8,afade=t=in:d=2.5,afade=t=out:st=${total - 5}:d=5`,
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
    '-movflags',
    '+faststart',
    '-y',
    temporaryTarget
  ]);
  await run(ffmpeg, ['-v', 'error', '-i', temporaryTarget, '-f', 'null', '-']);
  const info = JSON.parse(
    await run(ffprobe, [
      '-v',
      'error',
      '-show_streams',
      '-show_format',
      '-of',
      'json',
      temporaryTarget
    ])
  );
  const v = info.streams.find((s) => s.codec_type === 'video'),
    a = info.streams.find((s) => s.codec_type === 'audio');
  assert.equal(v.avg_frame_rate, '60/1');
  assert.equal(v.width, 1920);
  assert.equal(v.height, 1080);
  assert.equal(a.codec_name, 'aac');
  await fs.rename(path.join(out, temporaryTarget), path.join(out, target));
  await fs.writeFile(
    path.join(out, 'VIDEO_VALIDATION.json'),
    JSON.stringify(
      {
        result: 'passed',
        duration: Number(info.format.duration),
        bytes: Number(info.format.size),
        video: { codec: v.codec_name, width: v.width, height: v.height, fps: v.avg_frame_rate },
        audio: {
          codec: a.codec_name,
          sampleRate: a.sample_rate,
          music: 'Bright Scenes - original synthesis, CC0',
          bpm: 104,
          targetLUFS: -24
        },
        allFramesDecoded: true,
        editingInterpolation: false,
        chapters
      },
      null,
      2
    ) + '\n'
  );
  await run(ffmpeg, [
    '-v',
    'error',
    '-ss',
    '6',
    '-i',
    target,
    '-frames:v',
    '1',
    '-y',
    'poster.jpg'
  ]);
  await fs.copyFile(
    path.join(out, 'poster.jpg'),
    path.join(__dirname, '../screenshots/public/video-poster.jpg')
  );
  console.log('Final video verified:', target, info.format.duration);
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
