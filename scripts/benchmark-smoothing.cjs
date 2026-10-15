'use strict';
// Self-authored generated media; no credentials or game artwork.
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const { createMedia } = require('../core/media.cjs');
(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sas-benchmark-'));
  const report = {
    environment: `${os.platform()} ${os.arch()}; ${os.cpus()[0].model}`,
    fixture:
      'FFmpeg testsrc2, 1280x720, 8 fps, 3 seconds. Synthetic test, not a Steam Machine performance prediction.',
    results: []
  };
  try {
    const source = path.join(root, 'source.webm');
    execFileSync(require('ffmpeg-static'), [
      '-v',
      'error',
      '-f',
      'lavfi',
      '-i',
      'testsrc2=size=1280x720:rate=8:duration=3',
      '-c:v',
      'libvpx-vp9',
      '-threads',
      '2',
      '-crf',
      '28',
      '-b:v',
      '0',
      source
    ]);
    const media = createMedia({
      dataDir: root,
      downloadImpl: (_, dest) => fs.copyFile(source, dest)
    });
    const original = await media.prepare({
      url: 'https://cdn2.steamgriddb.com/hero/test.webm',
      animated: true
    });
    for (const mode of ['quality', 'fast', 'blend'])
      for (const fps of [30, 24]) {
        const start = performance.now(),
          events = [];
        const out = await media.smooth(original, {
          settings: { smoothingMode: mode, smoothingFps: fps },
          onProgress: (e) => events.push(e)
        });
        const durationMs = Math.round(performance.now() - start);
        assert.equal(await media.validate(out), true);
        const intermediate = events.filter(
          (e) => e.stage === 'smoothing' && e.progress > 0 && e.progress < 1
        );
        const result = {
          mode,
          fps,
          codec: out.smoothingConfig.codec,
          durationMs,
          bytes: (await fs.stat(path.join(root, 'media', out.file))).size,
          intermediateUpdates: intermediate.length,
          phases: [...new Set(events.map((e) => e.stage))]
        };
        report.results.push(result);
        console.log(JSON.stringify(result));
      }
    await fs.writeFile(
      path.resolve(__dirname, '../docs/SMOOTHING_BENCHMARK.json'),
      JSON.stringify(report, null, 2) + '\n'
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
