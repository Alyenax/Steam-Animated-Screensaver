'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
async function run() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cinema-electron-qa-'));
  let browser, app;
  try {
    const { chromium, _electron } = require('playwright');
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const fixture = await require('./qa-fixture.cjs').createFixture({ root, browser });
    await fixture.add(901);
    await fixture.core.invoke('prepare');
    for (let i = 0; i < 200; i++) {
      if ((await fixture.core.invoke('state')).job.status === 'completed') break;
      await new Promise((r) => setTimeout(r, 20));
    }
    assert.equal((await fixture.core.invoke('state')).games[0].status, 'ready');
    await fixture.core.close();
    await browser.close();
    browser = null;
    app = await _electron.launch({
      executablePath: require('electron'),
      args: [path.resolve(__dirname, '..')],
      env: { ...process.env, CINEMA_DATA_DIR: fixture.dataDir, STEAM_ROOT: fixture.steamRoot },
      timeout: 20000
    });
    const page = await app.firstWindow();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.locator('[data-route="preview"]').first().waitFor();
    assert.equal(await page.title(), 'SteamOS Animated Screensaver');
    assert.equal(await page.locator('.local-badge').count(), 0);
    const accountCheck = await page.evaluate(async () => {
      await window.cinema.invoke('setSteamAccount', {
        profile: '76561198000000000',
        key: '0123456789abcdef'.repeat(2)
      });
      const saved = await window.cinema.invoke('state');
      await window.cinema.invoke('setSteamAccount', { key: '' });
      const removed = await window.cinema.invoke('state');
      await window.cinema.invoke('settings', { smoothingFps: 24, smoothingMode: 'blend' });
      await window.cinema.invoke('settings', { framing: '16:9' });
      await window.cinema.invoke('updateGame', {
        id: 'steam:7000901',
        crop: { mode: '16:10', x: 20, y: 80 }
      });
      const configured = await window.cinema.invoke('state');
      return {
        saved: saved.steamAccount.hasKey,
        removed: removed.steamAccount.hasKey,
        fps: configured.settings.smoothingFps,
        mode: configured.settings.smoothingMode
      };
    });
    assert.deepEqual(accountCheck, { saved: true, removed: false, fps: 24, mode: 'blend' });
    await assert.rejects(fs.stat(path.join(fixture.dataDir, 'steam-api.key')), { code: 'ENOENT' });
    const normalizedImage = await page.evaluate(async () => {
      const state = await window.cinema.invoke('state');
      return window.cinema.invoke('previewImage', { file: state.games[0].media.file });
    });
    const decoded = await page.evaluate(
      (file) =>
        new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image.naturalWidth);
          image.onerror = () => reject(new Error('Native preview image failed'));
          image.src = new URL(`/media/${file}`, location.href).href;
        }),
      normalizedImage.file
    );
    assert(decoded > 0);
    await page.locator('[data-route="library"]').first().click();
    await page.waitForFunction(
      () =>
        document.querySelector('.game-visual[data-detail="steam:7000901"] .managed-image img')
          ?.naturalWidth > 0
    );

    const isolation = await page.evaluate(() => ({
      node: typeof require,
      bridge: typeof window.cinema?.invoke
    }));
    assert.deepEqual(isolation, { node: 'undefined', bridge: 'function' });
    const preferences = await app.evaluate(({ BrowserWindow }) => {
      const p = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
      return {
        sandbox: p.sandbox,
        contextIsolation: p.contextIsolation,
        nodeIntegration: p.nodeIntegration
      };
    });
    assert.deepEqual(preferences, {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    });
    assert.equal(
      await page.evaluate(() => fetch('app://cinema/core/index.cjs').then((r) => r.status)),
      404
    );
    assert.equal(
      await page.evaluate(() =>
        window.cinema.invoke('unsafeAction').then(
          () => false,
          () => true
        )
      ),
      true
    );
    assert.equal(
      await page.evaluate(() =>
        window.cinema.invoke('purgeMedia').then(
          () => false,
          (error) => error.message.includes('Confirm')
        )
      ),
      true
    );
    await page.locator('[data-route="preview"]').first().click();
    await page.locator('#player-frame').waitFor();
    let frame;
    for (let i = 0; i < 100; i++) {
      frame = page.frames().find((f) => f.url().includes('/player/index.html'));
      if (frame) break;
      await page.waitForTimeout(20);
    }
    assert.ok(frame, 'Player frame navigates to app://');
    await frame.waitForFunction(
      () => document.querySelector('.scene.visible video')?.currentTime > 0.1
    );
    await frame.waitForFunction(
      () => document.querySelector('.scene.visible')?.dataset.framing === '16:10'
    );
    assert.equal(
      await frame
        .locator('.scene.visible .artwork')
        .evaluate((el) => getComputedStyle(el).objectPosition),
      '20% 80%'
    );
    await frame.waitForFunction(() => {
      const scene = document.querySelector('.scene.visible');
      return !!scene && getComputedStyle(scene).opacity === '1';
    });
    assert.equal(
      await frame
        .locator('video')
        .first()
        .evaluate((video) => video.error),
      null
    );
    await page.screenshot({
      path: path.resolve(__dirname, '..', 'screenshots', '09-electron-preview-qa.png'),
      fullPage: true
    });
    await page.locator('[data-action="toggle-play"]').click();
    await frame.waitForFunction(() => document.querySelector('.scene.visible video')?.paused);
    await app.close();
    app = null;
    assert.equal(
      await fs.stat(path.join(fixture.dataDir, '.manager.lock')).catch(() => null),
      null
    );
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify(
        {
          result: 'passed',
          isolation,
          preferences,
          checks: [
            'Actual app:// protocol media playback',
            'Native image-preview IPC and JPEG decoding',
            'Native Steam key save/removal and 24 fps profile settings IPC',
            'Full product name and no Local-first badge',
            'Real Electron preview pause',
            'Native per-game crop overrides general framing without reprocessing media',
            'Sender/action restrictions',
            'Native purge action requires confirmation before any filesystem change',
            'No Node in renderer',
            'Sandbox enabled',
            'Library lock released on close'
          ],
          pageErrors: errors
        },
        null,
        2
      )
    );
  } finally {
    if (app) await app.close().catch(() => {});
    if (browser) await browser.close();
    await fs.rm(root, { recursive: true, force: true });
  }
}
if (require.main === module)
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
module.exports = { run };
