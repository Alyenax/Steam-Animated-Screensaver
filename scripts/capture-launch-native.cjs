'use strict';
// Live packaged-app integration capture. Actual IPC, SteamGridDB, downloads and media processing.
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawn, execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..'),
  out = path.join(root, 'dist/public-launch-v2');
const originalData = path.join(
  require('node:os').homedir(),
  'Library/Application Support/steam-animated-screensaver'
);
const data = path.join(out, 'live-data');
const ids = [1245620, 1091500, 553850, 1174180, 632470, 322330, 359550, 1086940, 550, 1808500];
const appPath = path.join(out, 'Steam Animated Screensaver Demo.app');
const executablePath = path.join(appPath, 'Contents/MacOS/steam-animated-screensaver');
const recorder = path.join(out, 'capture-window');
const events = [],
  errors = [];
let electron, recording;
let clipStart = 0;
async function record(name, windowId) {
  const target = path.join(out, name + '.mp4');
  await fs.rm(target, { force: true });
  recording = spawn(recorder, [String(windowId), target, '0'], {
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stderr = '';
  recording.stderr.on('data', (b) => (stderr += b));
  await new Promise((resolve, reject) => {
    recording.once('error', reject);
    recording.once('exit', (code) => reject(Error('Recorder exited: ' + code + ' ' + stderr)));
    recording.stdout.on('data', (b) => {
      const m = String(b).match(/RECORDING ([0-9.]+)/);
      if (m) {
        clipStart = Number(m[1]);
        resolve();
      }
    });
  });
  events.push({ clip: name, event: 'recording-start', at: 0 });
  console.log('Recording ' + name);
}
async function stop() {
  const p = recording;
  recording = null;
  await new Promise((resolve, reject) => {
    p.once('exit', (code) => (code === 0 ? resolve() : reject(Error('Recorder exit ' + code))));
    p.kill('SIGINT');
  });
}
const mark = (clip, event) => {
  events.push({ clip, event, at: Number((Date.now() / 1000 - clipStart).toFixed(3)) });
  console.log(event);
};
async function main() {
  await fs.mkdir(path.join(data, 'media'), { recursive: true });
  const original = JSON.parse(await fs.readFile(path.join(originalData, 'catalog.json'), 'utf8'));
  const games = ids.map((id) => {
    const g = original.games.find((x) => x.steamAppId === id);
    assert(g?.media?.thumbnail);
    return {
      id: g.id,
      steamAppId: id,
      sgdbId: g.sgdbId,
      name: g.name,
      sources: ['manual'],
      installed: false,
      included: false,
      status: 'new',
      thumb: '/media/' + g.media.thumbnail,
      media: null,
      selectedAsset: null,
      manualSelection: false,
      crop: { mode: 'inherit', x: 50, y: 50 }
    };
  });
  for (const g of games)
    await fs.copyFile(
      path.join(originalData, 'media', g.thumb.split('/').pop()),
      path.join(data, 'media', g.thumb.split('/').pop())
    );
  await fs.writeFile(
    path.join(data, 'catalog.json'),
    JSON.stringify({
      version: 1,
      games,
      settings: {
        language: 'en',
        sceneDuration: 8,
        shuffle: false,
        framing: 'original',
        showCover: true,
        coverPosition: 'beside-title',
        smoothMotion: false,
        pauseOnGame: false,
        maxStorageGB: 10
      }
    })
  );
  await fs.copyFile(path.join(originalData, 'steamgriddb.key'), path.join(data, 'steamgriddb.key'));
  await fs.chmod(path.join(data, 'steamgriddb.key'), 0o600);
  const { _electron } = require('playwright');
  try {
    electron = await _electron.launch({
      executablePath,
      args: ['--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
      env: { ...process.env, SAS_DATA_DIR: data },
      timeout: 30000
    });
    const page = await electron.firstWindow();
    page.setDefaultTimeout(15000);
    page.on('pageerror', (e) => errors.push(e.message));
    await electron.evaluate(({ app, BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows()[0];
      w.webContents.setBackgroundThrottling(false);
      w.setContentSize(1280, 720);
      w.center();
      w.show();
      w.focus();
      app.focus({ steal: true });
    });
    await page.locator('[data-route="library"]').first().waitFor();
    // Startup scan is real; remove only additional entries from this disposable presentation catalog.
    await page.waitForTimeout(1800);
    await page.evaluate(async (ids) => {
      const s = await window.screensaver.invoke('state');
      for (const g of s.games)
        if (!ids.includes(g.steamAppId)) await window.screensaver.invoke('remove', { id: g.id });
    }, ids);
    await page.locator('[data-route="library"]').first().click();
    await page.waitForTimeout(1800);
    const listing = execFileSync(recorder, ['--list'], { encoding: 'utf8' });
    const line = listing
      .split('\n')
      .find(
        (l) =>
          l.includes('io.github.alyenax.sas.capture') && l.includes('Steam Animated Screensaver |')
      );
    assert(line, 'Packaged demo window found');
    const windowId = Number(line.split(' | ')[0]);
    await record('batch-live', windowId);
    await page.waitForTimeout(1600);
    mark('batch-live', 'select-all');
    await page.locator('[data-action="select-shown"]').click();
    await page.waitForFunction(
      () => document.querySelectorAll('[data-include]:checked').length === 10
    );
    await page.waitForTimeout(1800);
    await page.locator('.game-grid').scrollIntoViewIfNeeded();
    await page.waitForTimeout(2000);
    mark('batch-live', 'prepare-all');
    await page.locator('[data-action="prepare-all"]').click();
    let nextLog = 0,
      state;
    const began = Date.now();
    while (Date.now() - began < 15 * 60 * 1000) {
      state = await page.evaluate(() => window.screensaver.invoke('state'));
      if (Date.now() > nextLog) {
        console.log(`Preparation ${state.job.processed}/${state.job.total}: ${state.job.stage}`);
        nextLog = Date.now() + 10000;
      }
      if (state.job.status === 'completed') break;
      if (['cancelled', 'paused'].includes(state.job.status))
        throw Error('Preparation unexpectedly ' + state.job.status);
      await page.waitForTimeout(350);
    }
    assert.equal(state.job.status, 'completed');
    assert.equal(state.job.total, 10);
    assert.equal(state.job.processed, 10);
    assert.deepEqual(state.job.errors, []);
    assert(
      state.games.filter((g) => g.included).every((g) => g.status === 'ready' && g.media && g.cover)
    );
    mark('batch-live', 'ten-ready');
    await page.waitForTimeout(3500);
    await stop();
    await fs.writeFile(
      path.join(out, 'BATCH_VALIDATION.json'),
      JSON.stringify(
        {
          result: 'passed',
          provider:
            'Real SteamGridDB with existing local credential; not printed or embedded in recording',
          total: 10,
          processed: 10,
          errors: state.job.errors,
          durationSeconds: (Date.now() - began) / 1000,
          games: state.games
            .filter((g) => g.included)
            .map((g) => ({
              name: g.name,
              id: g.id,
              automatic: !g.manualSelection,
              media: g.media,
              cover: g.cover
            })),
          browserErrors: errors
        },
        null,
        2
      ) + '\n'
    );
    // Record each original animation for one full real scene. No browser video recorder or invented FPS.
    await page.locator('[data-route="preview"]').first().click();
    await page.waitForTimeout(700);
    await record('showcase-original', windowId);
    await page.locator('[data-action="fullscreen"]').click();
    mark('showcase-original', 'fullscreen-start');
    await page.waitForTimeout(83000);
    await stop();
    await page.locator('[data-action="exit-fullscreen"]').click();
    await record('settings-live', windowId);
    mark('settings-live', 'framing-16x9');
    await page.locator('[data-setting="framing"]').selectOption('16:9');
    await page.waitForTimeout(2200);
    await page.locator('[data-action="fullscreen"]').click();
    mark('settings-live', 'fullscreen-16x9');
    await page.waitForTimeout(7000);
    await page.locator('[data-action="exit-fullscreen"]').click();
    mark('settings-live', 'still-artwork-position');
    await page.locator('[data-setting="coverPosition"]').selectOption('top-right');
    await page.waitForTimeout(2200);
    await page.locator('[data-setting="coverPosition"]').selectOption('beside-title');
    await page.waitForTimeout(1500);
    await page.locator('[data-route="library"]').first().click();
    await page.locator('.game-visual').first().click();
    mark('settings-live', 'change-animation-control');
    await page.waitForTimeout(2200);
    await page.locator('[data-action="load-artworks"]').click();
    await page.locator('[data-select-asset="0"]').waitFor();
    await page.waitForTimeout(2000);
    mark('settings-live', 'live-animation-alternatives');
    await page.locator('[data-action="close-detail"]').click();
    await page.locator('[data-route="settings"]').first().click();
    await page.locator('[data-setting="smoothMotion"]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1300);
    await page.locator('[data-setting="smoothingFps"]').selectOption('24');
    await page.waitForTimeout(1500);
    await page.locator('[data-setting="smoothingFps"]').selectOption('30');
    await page.waitForTimeout(1800);
    mark('settings-live', 'processing-settings');
    await stop();
    assert.deepEqual(errors, []);
    await fs.writeFile(
      path.join(out, 'NATIVE_CAPTURE.json'),
      JSON.stringify(
        {
          version: require('../package.json').version,
          result: 'passed',
          format:
            'Unmodified packaged Manager/Core/Player with actual live provider, native ScreenCaptureKit; test window size 1280x720 and background throttling disabled only in the capture session.',
          events,
          errors,
          steamAcceptance: 'Separate target-client check; not implied by this recording'
        },
        null,
        2
      ) + '\n'
    );
  } finally {
    if (recording) await stop().catch(() => {});
    await electron?.close();
    await fs.rm(path.join(data, 'steamgriddb.key'), { force: true });
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
