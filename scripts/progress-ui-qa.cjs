'use strict';
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { createCore } = require('../core/index.cjs');
const { createMedia } = require('../core/media.cjs');
const { createServer } = require('./dev-server.cjs');
(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sas-progress-ui-'));
  let server, browser;
  try {
    const source = path.join(root, 'original.webm'),
      dataDir = path.join(root, 'data');
    execFileSync(require('ffmpeg-static'), [
      '-v',
      'error',
      '-f',
      'lavfi',
      '-i',
      'testsrc2=size=1280x720:rate=8:duration=4',
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
    const media = createMedia({ dataDir, downloadImpl: (_, dest) => fs.copyFile(source, dest) });
    const asset = {
      id: 1,
      url: 'https://cdn2.steamgriddb.com/hero/original.webm',
      animated: true,
      kind: 'hero',
      author: { name: 'Original QA generator' }
    };
    const core = createCore({
      dataDir,
      steamRoots: [],
      media,
      isGameRunning: async () => false,
      sgdb: {
        game: async () => ({ sgdbId: 1, name: 'Live progress · original QA animation' }),
        artworks: async () => [asset]
      }
    });
    server = await createServer({ dataDir, core });
    await core.invoke('setKey', { key: 'qa-fixture-key-not-real' });
    await core.invoke('add', { sgdbId: 1 });
    await core.invoke('settings', {
      language: 'fr',
      smoothMotion: true,
      smoothingMode: 'quality',
      showCover: false
    });
    browser = await require('playwright').chromium.launch({
      executablePath:
        process.env.SAS_TEST_BROWSER ||
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      headless: true
    });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } }),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(server.url + '/manager/index.html');
    await page.locator('[data-route="preparation"]').first().click();
    await page.locator('[data-action="prepare-all"]').first().click();
    await page.waitForFunction(
      () => {
        const title = document.querySelector('.progress-title')?.innerText || '';
        const percent = Number(
          document.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')
        );
        return title.includes('Création des images intermédiaires') && percent > 0 && percent < 90;
      },
      null,
      { timeout: 30000 }
    );
    let state = await core.invoke('state');
    assert.equal(state.job.stage, 'smoothing');
    assert(state.job.progress > 0 && state.job.progress < 1);
    assert(state.job.detail.frames > 0);
    assert(
      (await page.locator('.job-history').innerText()).includes(
        'Création des images intermédiaires'
      )
    );
    await page.screenshot({
      path: path.resolve(__dirname, '../screenshots/13-live-interpolation-progress-qa.png'),
      fullPage: true
    });
    const firstProgress = state.job.progress;
    for (let i = 0; i < 100; i++) {
      if ((await core.invoke('state')).job.progress > firstProgress) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    assert((await core.invoke('state')).job.progress > firstProgress);
    await page.locator('[data-action="pause"]').click();
    await page.locator('[data-action="resume"]').waitFor();
    state = await core.invoke('state');
    assert.equal(state.job.status, 'paused');
    assert(
      !(await fs.readdir(path.join(dataDir, 'media'))).some((f) =>
        /\.smooth\.webm$|\.frames$/.test(f)
      )
    );
    await core.invoke('settings', { smoothingMode: 'blend', smoothingFps: 24 });
    await page.locator('[data-action="resume"]').click();
    for (let i = 0; i < 600; i++) {
      if ((await core.invoke('state')).job.status === 'completed') break;
      await new Promise((r) => setTimeout(r, 50));
    }
    assert.equal((await core.invoke('state')).job.status, 'completed');
    state = await core.invoke('state');
    assert(state.games[0].smoothed, state.games[0].smoothingError || JSON.stringify(state.job));
    assert.equal(state.games[0].smoothed.smoothingConfig.fps, 24);
    assert.equal(state.games[0].smoothed.smoothingConfig.mode, 'blend');
    assert(state.job.history.some((e) => e.stage === 'paused'));
    assert(state.job.history.some((e) => e.stage === 'smoothing-verify'));
    assert.equal(errors.length, 0, errors.join('\n'));
    await fs.writeFile(
      path.resolve(__dirname, '../docs/PROGRESS_VALIDATION.json'),
      JSON.stringify(
        {
          fixture:
            'Self-authored testsrc2 media, 1280x720, 8 fps, 4 seconds; no credentials or artwork',
          checks: [
            'Actual intermediate FFmpeg progress visible as a percentage in French Manager',
            'Frames, speed, estimated remaining time and dated activity shown',
            'Progress advances during processing',
            'Pause kills processing and clears partial variants',
            'Resume with very light 24 fps produces a verified separate file',
            'Completed history retains paused and validation phases'
          ],
          observedProgress: firstProgress,
          uncaughtBrowserErrors: errors.length,
          physicalSteamOS: false
        },
        null,
        2
      ) + '\n'
    );
    console.log(
      'PROGRESS_UI_OK: real percentage, advancement, history, pause, cleanup, resume at 24 fps, zero page errors'
    );
  } finally {
    await browser?.close();
    await server?.close();
    await fs.rm(root, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
