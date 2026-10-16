'use strict';
// Download the artist's licensed recording, pin its bytes and prepare the presentation excerpt.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const source = require('../launch/MUSIC_SOURCE.json');
(async () => {
  const out = path.resolve(__dirname, '../dist/public-launch-v2');
  await fs.mkdir(out, { recursive: true });
  const original = path.join(out, source.sourceFile);
  let bytes = await fs.readFile(original).catch(() => null);
  if (!bytes) {
    const response = await fetch(source.url, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw Error('Music download failed: ' + response.status);
    bytes = Buffer.from(await response.arrayBuffer());
  }
  if (crypto.createHash('sha256').update(bytes).digest('hex') !== source.sha256)
    throw Error('Music source checksum mismatch.');
  await fs.writeFile(original, bytes);
  execFileSync(
    process.env.SAS_CAPTURE_FFMPEG || require('ffmpeg-static'),
    [
      '-v',
      'error',
      '-ss',
      String(source.excerptStartSeconds),
      '-i',
      original,
      '-t',
      String(source.excerptDurationSeconds),
      '-ar',
      '48000',
      '-ac',
      '2',
      '-c:a',
      'pcm_s16le',
      '-map_metadata',
      '-1',
      '-y',
      path.join(out, source.preparedFile)
    ],
    { stdio: 'pipe' }
  );
  await fs.writeFile(path.join(out, 'MUSIC_SOURCE.json'), JSON.stringify(source, null, 2) + '\n');
  console.log(JSON.stringify(source));
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
