'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
async function run({ appPath, reportPath } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'screensaver-electron-qa-'));
  let browser, app;
  try {
    const { chromium, _electron } = require('playwright');
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const fixture = await require('./qa-fixture.cjs').createFixture({
      root,
      browser,
      animationFps: appPath ? 12 : 24
    });
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
    let executablePath = require('electron');
    if (appPath) {
      appPath = path.resolve(appPath);
      const name = require('node:child_process')
        .execFileSync(
          'plutil',
          ['-extract', 'CFBundleExecutable', 'raw', path.join(appPath, 'Contents/Info.plist')],
          { encoding: 'utf8' }
        )
        .trim();
      executablePath = path.join(appPath, 'Contents/MacOS', name);
      await fs.access(executablePath);
    }
    app = await _electron.launch({
      executablePath,
      args: appPath ? [] : [path.resolve(__dirname, '..')],
      env: { ...process.env, SAS_DATA_DIR: fixture.dataDir, STEAM_ROOT: fixture.steamRoot },
      timeout: 20000
    });
    const page = await app.firstWindow();
    page.setDefaultTimeout(10000);
    const bundle = await app.evaluate(({ app }) => ({
      packaged: app.isPackaged,
      version: app.getVersion(),
      arch: process.arch,
      executable: process.execPath,
      resources: process.resourcesPath
    }));
    if (appPath) {
      assert.equal(bundle.packaged, true);
      assert.equal(bundle.version, require('../package.json').version);
      assert.equal(bundle.arch, 'arm64');
      assert.equal(bundle.executable, executablePath);
    }
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.locator('[data-route="preview"]').first().waitFor();
    assert.equal(await page.title(), 'Steam Animated Screensaver');
    assert.equal(await page.locator('.local-badge').count(), 0);
    const accountCheck = await page.evaluate(async () => {
      await window.screensaver.invoke('setSteamAccount', {
        profile: '76561198000000000',
        key: '0123456789abcdef'.repeat(2)
      });
      const saved = await window.screensaver.invoke('state');
      await window.screensaver.invoke('setSteamAccount', { key: '' });
      const removed = await window.screensaver.invoke('state');
      await window.screensaver.invoke('settings', { smoothingFps: 24, smoothingMode: 'blend' });
      await window.screensaver.invoke('settings', { framing: '16:9' });
      await window.screensaver.invoke('updateGame', {
        id: 'steam:7000901',
        crop: { mode: '16:10', x: 20, y: 80 }
      });
      const configured = await window.screensaver.invoke('state');
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
      const state = await window.screensaver.invoke('state');
      return window.screensaver.invoke('previewImage', {
        file: state.games[0].media.file,
        force: true
      });
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

    await page.locator('.game-visual[data-detail="steam:7000901"]').click();
    const animationButton = page.locator('[data-action="load-artworks"]');
    assert.equal(await animationButton.innerText(), 'Change animation');
    const animationBox = await animationButton.boundingBox(),
      detailBox = await page.locator('#detail-dialog').boundingBox();
    assert(
      animationBox.y >= detailBox.y &&
        animationBox.y + animationBox.height <= detailBox.y + detailBox.height
    );
    await page.locator('[data-action="close-detail"]').click();

    const isolation = await page.evaluate(() => ({
      node: typeof require,
      bridge: typeof window.screensaver?.invoke
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
      await page.evaluate(() => fetch('app://screensaver/core/index.cjs').then((r) => r.status)),
      404
    );
    assert.equal(
      await page.evaluate(() =>
        window.screensaver.invoke('unsafeAction').then(
          () => false,
          () => true
        )
      ),
      true
    );
    assert.equal(
      await page.evaluate(() =>
        window.screensaver.invoke('purgeMedia').then(
          () => false,
          (error) => error.message.includes('Confirm')
        )
      ),
      true
    );
    let preparedVideo = null;
    if (appPath) {
      await page.evaluate(async () => {
        await window.screensaver.invoke('settings', {
          smoothMotion: true,
          smoothingFps: 24,
          smoothingMode: 'fast'
        });
        await window.screensaver.invoke('prepare', { ids: ['steam:7000901'] });
      });
      let preparedState;
      const deadline = Date.now() + 60000;
      do {
        preparedState = await page.evaluate(() => window.screensaver.invoke('state'));
        if (preparedState.job.status === 'completed') break;
        await page.waitForTimeout(50);
      } while (Date.now() < deadline);
      assert.equal(preparedState.job.status, 'completed');
      const processed = await page.evaluate(async () =>
        (await window.screensaver.invoke('state')).games.find((g) => g.id === 'steam:7000901')
      );
      assert.equal(processed.smoothingError, undefined);
      assert.ok(processed.smoothed);
      assert.equal(processed.smoothed.smoothingConfig.fps, 24);
      assert.equal(processed.smoothed.smoothingConfig.mode, 'fast');
      const probe = JSON.parse(
        require('node:child_process').execFileSync(
          path.join(bundle.resources, 'app/binaries/ffprobe'),
          [
            '-v',
            'error',
            '-select_streams',
            'v:0',
            '-show_entries',
            'stream=avg_frame_rate,codec_name',
            '-of',
            'json',
            path.join(fixture.dataDir, 'media', processed.smoothed.file)
          ],
          { encoding: 'utf8' }
        )
      );
      const [numerator, denominator] = probe.streams[0].avg_frame_rate.split('/').map(Number);
      assert.equal(numerator / denominator, 24);
      assert.notEqual(processed.smoothed.file, processed.media.file);
      preparedVideo = {
        measuredFps: numerator / denominator,
        codec: probe.streams[0].codec_name,
        originalPreserved: true
      };
    }
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
    await page.bringToFront();
    await page.screenshot({
      timeout: 30000,
      path: path.resolve(
        __dirname,
        '..',
        'screenshots',
        appPath ? '18-macos-app-preview-qa.png' : '09-electron-preview-qa.png'
      ),
      fullPage: true
    });
    await page.locator('[data-action="toggle-play"]').click();
    await frame.waitForFunction(() => document.querySelector('.scene.visible video')?.paused);
    assert.deepEqual(errors, []);
    await app.evaluate(({ shell }) => {
      global.__sasShowLog = null;
      global.__sasOriginalShow = shell.showItemInFolder;
      shell.showItemInFolder = (file) => {
        global.__sasShowLog = file;
      };
    });
    await page.locator('[data-route="settings"]').first().click();
    await page.locator('[data-action="open-logs"]').click();
    const shownLog = await app.evaluate(() => global.__sasShowLog);
    assert.equal(shownLog, path.join(fixture.dataDir, 'logs', 'diagnostics.json'));
    await app.evaluate(({ shell }) => {
      shell.showItemInFolder = global.__sasOriginalShow;
    });
    await page.evaluate(() => {
      console.error('SAS_QA_CONSOLE_FAILURE');
      setTimeout(() => {
        throw new Error('SAS_QA_RENDERER_FAILURE');
      }, 0);
      setTimeout(() => Promise.reject(new Error('SAS_QA_REJECTION')), 20);
    });
    const logFile = path.join(fixture.dataDir, 'logs', 'diagnostics.json');
    for (let i = 0; i < 100; i++) {
      const report = JSON.parse(await fs.readFile(logFile, 'utf8'));
      if (
        ['renderer.error', 'renderer.rejection', 'renderer.console'].every((event) =>
          report.events.some(
            (e) => e.event === event && JSON.stringify(e.detail).includes('SAS_QA_')
          )
        )
      )
        break;
      await new Promise((r) => setTimeout(r, 30));
    }
    const logged = JSON.parse(await fs.readFile(logFile, 'utf8'));
    for (const event of ['renderer.error', 'renderer.rejection', 'renderer.console'])
      assert(
        logged.events.some(
          (e) => e.event === event && JSON.stringify(e.detail).includes('SAS_QA_')
        ),
        event
      );
    const expectedInjectedErrors = errors.splice(0);
    assert(expectedInjectedErrors.every((e) => /SAS_QA_(RENDERER_FAILURE|REJECTION)/.test(e)));
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].webContents.forcefullyCrashRenderer();
    });
    for (let i = 0; i < 100; i++) {
      if (
        JSON.parse(await fs.readFile(logFile, 'utf8')).events.some(
          (e) => e.event === 'renderer.process_gone'
        )
      )
        break;
      await new Promise((r) => setTimeout(r, 30));
    }
    const rendererCrash = JSON.parse(await fs.readFile(logFile, 'utf8')).events.find(
      (e) => e.event === 'renderer.process_gone'
    );
    assert(
      rendererCrash && ['crashed', 'killed', 'abnormal-exit'].includes(rendererCrash.detail.reason),
      JSON.stringify(rendererCrash)
    );
    await app.close();
    app = null;
    assert.equal(JSON.parse(await fs.readFile(logFile, 'utf8')).cleanExit, true);
    assert.equal(
      await fs.stat(path.join(fixture.dataDir, '.manager.lock')).catch(() => null),
      null
    );
    assert.deepEqual(errors, []);
    const report = {
      bundle,
      rendererCrash,
      preparedVideo,
      result: 'passed',
      isolation,
      preferences,
      checks: [
        ...(appPath
          ? [
              'Distributed macOS .app launched as packaged arm64 executable',
              'Bundled native FFmpeg/FFprobe regenerate actual image preview',
              'Bundled tools prepare and play a new 24 fps Fast derivative'
            ]
          : []),
        'Actual app:// protocol media playback',
        'Native image-preview IPC and JPEG decoding',
        'Change animation is visible immediately at the top of a ready game sheet',
        'Native Steam key save/removal and 24 fps profile settings IPC',
        'Full product name and no Local-first badge',
        'Real Electron preview pause',
        'Native per-game crop overrides general framing without reprocessing media',
        'Sender/action restrictions',
        'Native purge action requires confirmation before any filesystem change',
        'No Node in renderer',
        'Sandbox enabled',
        'Library lock released on close',
        'Settings opens exactly the local diagnostic JSON',
        'Injected JavaScript error, unhandled rejection and console error persist in JSON',
        'Forced renderer crash persists its reason; orderly app close leaves valid JSON'
      ],
      pageErrors: errors
    };
    if (reportPath) await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
  } finally {
    if (app) await app.close().catch(() => {});
    if (browser) await browser.close();
    await fs.rm(root, { recursive: true, force: true });
  }
}
if (require.main === module)
  run({
    appPath: process.argv.includes('--app')
      ? process.argv[process.argv.indexOf('--app') + 1]
      : undefined,
    reportPath: process.argv.includes('--report')
      ? process.argv[process.argv.indexOf('--report') + 1]
      : undefined
  }).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
module.exports = { run };
