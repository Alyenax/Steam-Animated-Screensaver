'use strict';
const fs = require('node:fs/promises'),
  path = require('node:path');
const root = path.resolve(__dirname, '..'),
  dataDir = path.join(root, 'dist/public-launch-v2/live-data');
(async () => {
  const { createMedia } = require('../core/media.cjs');
  const bin = path.join(root, 'dist/.binary-cache/macos-arm64');
  const media = createMedia({
    dataDir,
    ffmpegPath: path.join(bin, 'ffmpeg'),
    ffprobePath: path.join(bin, 'ffprobe')
  });
  const core = require('../core/index.cjs').createCore({
    dataDir,
    media,
    isGameRunning: async () => false
  });
  try {
    await core.invoke('settings', {
      smoothMotion: true,
      smoothingFps: 30,
      smoothingMode: 'blend',
      maxSmoothingMB: 0
    });
    await core.invoke('prepare');
    let previous = '',
      end = Date.now() + 20 * 60 * 1000;
    while (Date.now() < end) {
      const s = await core.invoke('state');
      const line = `${s.job.processed}/${s.job.total} ${s.games.find((g) => g.id === s.job.current)?.name || ''} ${s.job.stage} ${Number.isFinite(s.job.progress) ? Math.round(s.job.progress * 100) + '%' : ''}`;
      if (line !== previous) {
        console.log(line);
        previous = line;
      }
      if (s.job.status === 'completed') {
        await fs.writeFile(
          path.join(root, 'dist/public-launch-v2/SMOOTHING_VALIDATION.json'),
          JSON.stringify(
            {
              result: s.job.errors.length ? 'partial' : 'passed',
              settings: { fps: 30, mode: 'blend', maxSmoothingMB: 0 },
              errors: s.job.errors,
              games: s.games
                .filter((g) => g.included)
                .map((g) => ({
                  name: g.name,
                  original: g.media.file,
                  processed: g.smoothed?.file,
                  smoothing: g.smoothed?.smoothing,
                  smoothingConfig: g.smoothed?.smoothingConfig,
                  error: g.smoothingError
                }))
            },
            null,
            2
          ) + '\n'
        );
        return;
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    throw Error('Smoothing demonstration preparation timed out');
  } finally {
    await core.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
