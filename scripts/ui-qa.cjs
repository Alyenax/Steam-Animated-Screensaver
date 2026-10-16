'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { createServer } = require('./dev-server.cjs');
async function runUI({ capture = false } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'screensaver-ui-qa-'));
  const screenshots = path.resolve(__dirname, '..', 'screenshots');
  if (capture) await fs.mkdir(screenshots, { recursive: true });
  const { chromium } = require('playwright');
  const browser = await chromium.launch({
    executablePath:
      process.env.SAS_TEST_BROWSER ||
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required']
  });
  let instance;
  const evidence = {
    fixture:
      'Original self-authored QA media. Mocked SGDB search/artwork responses. No personal key or third-party artwork.',
    checks: [],
    consoleErrors: []
  };
  const check = (name) => {
    evidence.checks.push(name);
    console.log('QA:', name);
  };
  try {
    const fixture = await require('./qa-fixture.cjs').createFixture({ root, browser });
    instance = await createServer({ dataDir: fixture.dataDir, core: fixture.core });
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      deviceScaleFactor: 1
    });
    page.setDefaultTimeout(15000);
    page.on('pageerror', (error) => evidence.consoleErrors.push(error.message));
    const shot = async (name) => {
      if (capture) {
        await page.screenshot({ path: path.join(screenshots, name + '.png'), fullPage: true });
      }
    };
    const settled = () => page.waitForFunction(() => !document.body.hasAttribute('aria-busy'));
    const go = async (route) => {
      await page.locator(`[data-route="${route}"]`).first().click();
    };
    await page.goto(instance.url + '/manager/index.html');
    await page.locator('[data-action="prepare-home"]').waitFor();
    await page.waitForFunction(() => !document.querySelector('[data-action="scan"]')?.disabled);
    assert.equal(await page.title(), 'Steam Animated Screensaver');
    assert(!(await page.locator('body').innerText()).includes('CINEMA'));
    assert.equal(await page.locator('.local-badge').count(), 0);
    await shot('01-home-onboarding');
    check('First-run onboarding and automatic Steam scan, no fake library');
    await go('settings');
    await page.locator('#api-key').fill('qa-fixture-key-not-a-real-personal-key');
    await page.locator('#key-form').evaluate((form) => form.requestSubmit());
    await page.waitForFunction(() =>
      document.querySelector('#api-key')?.placeholder.includes('Replace')
    );
    for (const id of [901, 902, 903]) await fixture.add(id);
    await fixture.core.invoke('prepare', { ids: ['steam:7000901', 'steam:7000902'] });
    for (let i = 0; i < 200; i++) {
      if ((await fixture.core.invoke('state')).job.status === 'completed') break;
      await new Promise((r) => setTimeout(r, 25));
    }
    assert.equal(
      (await fixture.core.invoke('state')).games.filter((g) => g.status === 'ready').length,
      2
    );
    await page.reload();
    await page.locator('[data-action="prepare-home"]').waitFor();
    await shot('02-home-prepared-qa');
    await go('library');
    await page.locator('.game-card').first().waitFor();
    assert.equal(await page.locator('.game-card').count(), 3);
    await page.waitForFunction(() =>
      [...document.querySelectorAll('.game-card .managed-image img')].every(
        (img) => img.naturalWidth > 0
      )
    );
    await shot('03-my-library-qa');
    const cachedGame = (await fixture.core.invoke('state')).games.find(
      (g) => g.id === 'steam:7000901'
    );
    const thumbPath = path.join(fixture.dataDir, 'media', cachedGame.media.thumbnail),
      savedThumb = await fs.readFile(thumbPath);
    await fs.writeFile(thumbPath, 'broken cached thumbnail');
    await page.reload();
    await page.locator('[data-route="library"]').first().click();
    await page.waitForFunction(
      () =>
        document.querySelector(
          '.game-visual[data-detail="steam:7000901"] .managed-image.loaded img'
        )?.naturalWidth > 0
    );
    assert(
      (
        await page.locator('.game-visual[data-detail="steam:7000901"] img').getAttribute('src')
      ).includes('preview-')
    );
    await fs.writeFile(thumbPath, savedThumb);
    check(
      'A corrupted library thumbnail falls back to a freshly decoded frame from the local animation'
    );
    await go('home');
    await page.locator('video.hero-media').evaluate((video) => {
      video.src = '/media/missing.webm';
      video.load();
    });
    await page.waitForFunction(
      () => document.querySelector('.image-hero.loaded img')?.naturalWidth > 0
    );
    check('A failed Home moving preview falls back to a valid local image');
    await go('library');
    await page.locator('.game-visual[data-detail="steam:7000901"]').click();
    await page.locator('video.detail-cover').evaluate((video) => {
      video.src = '/media/missing.webm';
      video.load();
    });
    await page.waitForFunction(
      () => document.querySelector('.image-detail.loaded img')?.naturalWidth > 0
    );
    check('A failed detail moving preview falls back to a valid local image');
    await page.locator('[data-action="load-artworks"]').click();
    await page.waitForFunction(
      () =>
        document.querySelectorAll('[data-select-asset]').length === 2 &&
        [...document.querySelectorAll('[data-select-asset] img')].every(
          (img) => img.naturalWidth > 0
        )
    );
    check(
      'Alternative previews normalize WebM thumbnails and recover from a broken thumbnail using its original artwork'
    );
    if (capture) await shot('11-alternative-previews-qa');
    const originalAnimation = JSON.stringify(
      (await fixture.core.invoke('state')).games.find((g) => g.id === 'steam:7000901').media
    );
    await page.locator('[data-action="load-covers"]').click();
    await page.waitForFunction(
      () =>
        document.querySelectorAll('[data-select-cover]').length === 2 &&
        [...document.querySelectorAll('[data-select-cover] img')].every(
          (img) => img.naturalWidth > 0
        )
    );
    await page.locator('[data-select-cover="1"]').click();
    await page.waitForFunction(
      () =>
        !!document.querySelector('[data-action="automatic-cover"]') &&
        !document.querySelector('[data-action="load-covers"]')?.disabled
    );
    const chosenCover = (await fixture.core.invoke('state')).games.find(
      (g) => g.id === 'steam:7000901'
    );
    assert.equal(chosenCover.coverManualSelection, true);
    assert.equal(chosenCover.selectedCover.id, 9011);
    assert.equal(JSON.stringify(chosenCover.media), originalAnimation);
    if (capture) await shot('12-fixed-artwork-picker-qa');
    check('A different fixed artwork is prepared and saved without altering the animation');
    await page.locator('[data-crop-setting="mode"]').selectOption('16:10');
    await settled();
    await page.locator('[data-crop-setting="x"]').evaluate((el) => {
      el.value = '20';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await settled();
    let cropped = (await fixture.core.invoke('state')).games.find((g) => g.id === 'steam:7000901');
    assert.deepEqual(cropped.crop, { mode: '16:10', x: 20, y: 50 });
    assert.equal(JSON.stringify(cropped.media), originalAnimation);
    assert.equal(await page.locator('[data-crop-setting="y"]').isDisabled(), true);
    const cropBox = await page.locator('.detail-framing').boundingBox();
    assert(Math.abs(cropBox.width / cropBox.height - 1.6) < 0.003);
    await page.locator('[data-action="center-crop"]').click();
    await settled();
    assert.equal(
      (await fixture.core.invoke('state')).games.find((g) => g.id === 'steam:7000901').crop.x,
      50
    );
    await page.locator('[data-crop-setting="x"]').evaluate((el) => {
      el.value = '20';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await settled();
    await page.locator('.detail-framing').scrollIntoViewIfNeeded();
    await shot('16-game-crop-editor-qa');
    await page.locator('[data-crop-setting="mode"]').selectOption('original');
    await settled();
    assert(await page.locator('[data-crop-setting="x"]').isDisabled());
    await page.locator('[data-crop-setting="mode"]').selectOption('inherit');
    await settled();
    check(
      'Per-game crop editor saves focal position without changing prepared media; ineffective axes are disabled'
    );

    await page.locator('[data-action="close-detail"]').click();
    await page.locator('[data-action="add-game"]').first().click();
    await page.locator('#game-search').fill('Orbit');
    await page.locator('#search-form').evaluate((form) => form.requestSubmit());
    await page.locator('[data-add-result]').first().waitFor();
    assert.equal(await page.locator('[data-add-result]').count(), 2);
    await page.waitForFunction(() =>
      [...document.querySelectorAll('.search-results .result img')].every(
        (img) => img.naturalWidth > 0
      )
    );
    check('Manual search previews decode actual WebM thumbnails as local images');
    await shot('04-add-game-qa');
    await page.locator('[data-add-result]').first().click();
    await page.waitForFunction(
      () => document.querySelectorAll('#add-dialog [data-add-result]:disabled').length > 0
    );
    await page.locator('[data-action="close-add"]').click();
    check('Manual search disambiguates two mocked homonyms; explicit Add updates unified catalog');
    fixture.setSlow(true);
    await go('preparation');
    await page.locator('[data-action="prepare-all"]').first().click();
    await page.locator('[data-action="pause"]').waitFor();
    await shot('05-preparation-qa');
    await page.locator('[data-action="pause"]').click();
    await page.locator('[data-action="resume"]').waitFor();
    assert.equal((await fixture.core.invoke('state')).job.status, 'paused');
    check('Live preparation, real progress, pause persisted');
    fixture.setSlow(false);
    await page.locator('[data-action="resume"]').click();
    for (let i = 0; i < 250; i++) {
      if ((await fixture.core.invoke('state')).job.status === 'completed') break;
      await new Promise((r) => setTimeout(r, 25));
    }
    assert.equal((await fixture.core.invoke('state')).job.status, 'completed');
    check('Resume completes media preparation with real FFmpeg');
    await go('preview');
    await page.waitForFunction(() =>
      document.querySelector('#player-frame')?.contentDocument?.querySelector('#stage')
    );
    const frame = page.frames().find((f) => f.url().includes('/player/index.html'));
    await frame.waitForFunction(
      () => document.querySelector('.scene.visible video')?.currentTime > 0.1
    );
    await frame.waitForFunction(() => {
      const scene = document.querySelector('.scene.visible');
      return scene && getComputedStyle(scene).opacity === '1';
    });
    await frame.waitForFunction(
      () => document.querySelector('.scene.visible .caption-cover')?.naturalWidth > 0
    );
    await shot('06-preview-qa');
    const preparesBeforeFraming = fixture.prepares;
    for (const mode of ['16:9', '16:10', 'original']) {
      await page.locator('[data-setting="framing"]').selectOption(mode);
      await settled();
      await frame.waitForFunction(
        (mode) => document.querySelector('.scene.visible')?.dataset.framing === mode,
        mode
      );
    }
    assert.equal(fixture.prepares, preparesBeforeFraming);
    check(
      'General Original/16:9/16:10 framing changes the actual player immediately without preparing media'
    );

    for (const position of ['beside-title', 'bottom-right', 'top-right', 'top-left']) {
      await page.locator('[data-setting="coverPosition"]').selectOption(position);
      await frame.waitForFunction(
        (position) => document.querySelector('.scene.visible')?.dataset.coverPosition === position,
        position
      );
      await frame.waitForFunction(() => {
        const scene = document.querySelector('.scene.visible');
        return scene && getComputedStyle(scene).opacity === '1';
      });
      if (capture)
        await frame
          .locator('#stage')
          .screenshot({ path: path.join(screenshots, `10-cover-${position}-qa.png`) });
      assert.equal((await fixture.core.invoke('state')).settings.coverPosition, position);
    }
    check(
      'Four cover positions selected through Manager, persisted and rendered with genuine local static media'
    );
    await page.locator('[data-action="toggle-play"]').click();
    await frame.waitForFunction(() => document.querySelector('.scene.visible video')?.paused);
    check('Manager preview uses real offline media and pauses');
    await page.locator('[data-action="fullscreen"]').click();
    await page.waitForFunction(() => !!document.fullscreenElement);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.fullscreenElement);
    check('Fullscreen entry and immediate Escape exit');
    await go('settings');
    await page.locator('[data-setting="maxSmoothingMB"]').fill('512');
    await page.locator('[data-setting="maxSmoothingMB"]').dispatchEvent('change');
    for (let i = 0; i < 100; i++) {
      if ((await fixture.core.invoke('state')).settings.maxSmoothingMB === 512) break;
      await new Promise((r) => setTimeout(r, 20));
    }
    assert.equal((await fixture.core.invoke('state')).settings.maxSmoothingMB, 512);
    await settled();
    await page.locator('[data-setting="maxSmoothingMB"]').fill('0');
    await page.locator('[data-setting="maxSmoothingMB"]').dispatchEvent('change');
    for (let i = 0; i < 100; i++) {
      if ((await fixture.core.invoke('state')).settings.maxSmoothingMB === 0) break;
      await new Promise((r) => setTimeout(r, 20));
    }
    assert.equal((await fixture.core.invoke('state')).settings.maxSmoothingMB, 0);
    check('Manual video-size limit saves and accepts zero for no per-video size limit');
    await settled();
    await page.locator('[data-setting="smoothingMode"]').selectOption('quality');
    await page.waitForFunction(
      () => document.querySelector('[data-setting="smoothingMode"]')?.value === 'quality'
    );
    await settled();
    await page.locator('[data-setting="smoothingFps"]').selectOption('24');
    await settled();
    assert.equal((await fixture.core.invoke('state')).settings.smoothingFps, 24);
    await settled();
    await page.locator('[data-setting="smoothingFps"]').selectOption('30');
    await settled();
    await settled();
    await page.locator('[data-setting="smoothMotion"]').check();
    assert.equal((await fixture.core.invoke('state')).settings.smoothMotion, true);
    await settled();
    await page.locator('[data-setting="shuffle"]').uncheck();
    await settled();
    await fixture.core.invoke('prepare', { ids: ['steam:7000901'] });
    for (let i = 0; i < 1200; i++) {
      if ((await fixture.core.invoke('state')).job.status === 'completed') break;
      await new Promise((r) => setTimeout(r, 50));
    }
    const finishedJob = (await fixture.core.invoke('state')).job;
    assert(finishedJob.history.some((e) => e.stage === 'smoothing' && e.progress > 0));
    await go('preparation');
    await page.locator('.job-history li').first().waitFor();
    assert(
      (await page.locator('.job-history').innerText()).includes('Creating intermediate frames')
    );
    await shot('05b-preparation-history');
    await go('settings');
    const smoothedGame = (await fixture.core.invoke('state')).games.find(
      (g) => g.id === 'steam:7000901'
    );
    assert.equal(
      smoothedGame.smoothed?.smoothing,
      'interpolate-30-v2',
      smoothedGame.smoothingError
    );
    check(
      'Optional interpolation from Settings prepares a separate real VP9 file while preserving its original'
    );
    await shot('07-settings');
    await page.locator('[data-setting="sceneDuration"]').fill('12');
    await page.locator('[data-setting="sceneDuration"]').dispatchEvent('change');
    await page.waitForFunction(
      () => document.querySelector('[data-setting="sceneDuration"]')?.value === '12'
    );
    assert.equal((await fixture.core.invoke('state')).settings.sceneDuration, 12);
    await page.locator('[data-action="install"]').click();
    await page.locator('[data-action="uninstall"]').waitFor();
    assert.equal((await fixture.core.invoke('state')).steam.installed, true);
    check('Screensaver install from actual Settings into isolated Steam fixture');
    // Verify updating settings then Update/Repair republishes the installed snapshot.
    await page.locator('[data-setting="sceneDuration"]').fill('14');
    await page.locator('[data-setting="sceneDuration"]').dispatchEvent('change');
    for (let i = 0; i < 100; i++) {
      if ((await fixture.core.invoke('state')).settings.sceneDuration === 14) break;
      await new Promise((r) => setTimeout(r, 20));
    }
    assert.equal(
      (await fixture.core.invoke('state')).settings.sceneDuration,
      14,
      'Settings change reaches persisted backend'
    );
    await page.locator('[data-action="update-install"]').click();
    const installed = path.join(
      fixture.steamRoot,
      'config',
      'uioverrides',
      'screensavers',
      'steam-animated-screensaver'
    );
    for (let i = 0; i < 100; i++) {
      if (
        (await fs.readFile(path.join(installed, 'catalog.js'), 'utf8').catch(() => '')).includes(
          '"sceneDuration":14'
        )
      )
        break;
      await new Promise((r) => setTimeout(r, 20));
    }
    assert.match(
      await fs.readFile(path.join(installed, 'catalog.js'), 'utf8'),
      /"sceneDuration":14/
    );
    check('Update/Repair publishes changed settings and catalog');
    const offline = await browser.newPage();
    offline.setDefaultTimeout(15000);
    const remote = [];
    offline.on('request', (request) => {
      if (/^https?:/.test(request.url())) remote.push(request.url());
    });
    await offline.goto(pathToFileURL(path.join(installed, 'index.html')).href);
    await offline.bringToFront();
    await offline.waitForFunction(
      () => document.querySelector('.scene.visible video')?.currentTime > 0.1
    );
    await offline.waitForFunction(() =>
      document.querySelector('.scene.visible video')?.src.includes('.smooth30-quality-v2.webm')
    );
    await offline.waitForFunction(
      () => document.querySelector('.scene.visible .caption-cover')?.naturalWidth > 0
    );
    assert(
      (await offline.locator('.scene.visible .cover-credit').textContent()).includes(
        'Original validation cover 2'
      )
    );
    check('Chosen fixed artwork and its own creator credit are exported and displayed offline');
    assert.deepEqual(remote, []);
    await offline.close();
    await page.bringToFront();
    check(
      'Export plays actual interpolated VP9 directly over file:// with zero HTTP requests and no manager dependency'
    );
    await page.locator('[data-setting="smoothMotion"]').uncheck();
    await page.locator('[data-action="update-install"]').click();
    for (let i = 0; i < 100; i++) {
      if (
        !(await fs.readFile(path.join(installed, 'catalog.js'), 'utf8')).includes(
          '.smooth30-quality-v2.webm'
        )
      )
        break;
      await new Promise((r) => setTimeout(r, 20));
    }
    assert(
      !(await fs.readFile(path.join(installed, 'catalog.js'), 'utf8')).includes(
        '.smooth30-quality-v2.webm'
      )
    );
    check('Disabling smoothing and updating restores original playback without downloading again');
    for (const width of [1280, 800, 390])
      for (const language of ['en', 'fr']) {
        await fixture.core.invoke('settings', { language });
        await page.reload();
        await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
        await page.locator('[data-action="prepare-home"]').waitFor();
        for (const route of ['home', 'library', 'preparation', 'preview', 'settings']) {
          await go(route);
          assert(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
            `${width}/${language}/${route} horizontal overflow`
          );
        }
        if (capture) {
          await go('library');
          await shot(`08-library-${width}-${language}-qa`);
        }
      }
    await go('settings');
    await page.locator('#steam-profile').fill('76561198000000000');
    await page.locator('#steam-api-key').fill('0123456789abcdef'.repeat(2));
    await page.locator('#steam-account-form').evaluate((form) => form.requestSubmit());
    await page.locator('[data-action="import-steam"]:not(:disabled)').waitFor();
    await page.locator('[data-action="import-steam"]').click();
    await page.locator('[data-filter="ownedFilter"].active').waitFor();
    assert.equal(await page.locator('.game-card').count(), 2);
    await page.locator('[data-filter="notInstalledFilter"]').click();
    assert((await page.locator('.game-grid').innerText()).includes('Uninstalled'));
    assert.equal(
      (await fixture.core.invoke('state')).games.find((g) => g.steamAppId === 7000905).included,
      false
    );
    await go('settings');
    await page.locator('[data-action="forget-steam-key"]').click();
    await settled();
    assert.equal((await fixture.core.invoke('state')).steamAccount.hasKey, false);
    check(
      'Optional owned-library import with local key, deduplication, uninstalled filter, and key removal'
    );
    await go('library');
    await page.locator('[data-filter="all"]').click();
    await page.locator('.game-visual[data-detail="steam:7000901"]').click();
    await page.locator('[data-crop-setting="mode"]').selectOption('16:9');
    await settled();
    assert(await page.locator('[data-crop-setting="x"]').isDisabled());
    const mobileFrame = await page.locator('.detail-framing').boundingBox();
    assert(Math.abs(mobileFrame.width / mobileFrame.height - 16 / 9) < 0.003);
    assert(
      await page.locator('#detail-dialog').evaluate((el) => el.scrollWidth <= el.clientWidth + 1)
    );
    await page.locator('.detail-framing').scrollIntoViewIfNeeded();
    await shot('17-crop-editor-390-fr-qa');
    await page.locator('[data-crop-setting="mode"]').selectOption('inherit');
    await settled();
    await page.locator('[data-action="close-detail"]').click();
    check(
      'French handheld crop editor fits 390 px, preserves a true 16:9 frame and disables axes with no clipping'
    );
    check('All five spaces at 1280, 800, 390 px in English and French without horizontal overflow');
    await fixture.core.invoke('install');
    await go('settings');
    const beforePurge = await fixture.core.invoke('state');
    const oldChoices = beforePurge.games.map((g) => ({
      id: g.id,
      included: g.included,
      selectedAsset: g.selectedAsset,
      selectedCover: g.selectedCover,
      crop: g.crop
    }));
    let confirmation = '';
    page.once('dialog', async (dialog) => {
      confirmation = dialog.message();
      await dialog.dismiss();
    });
    await page.locator('[data-action="purge-media"]').click();
    await settled();
    assert(
      confirmation.includes('TOUTES') &&
        confirmation.includes('clés API') &&
        confirmation.includes('Steam')
    );
    assert.equal(
      (await fixture.core.invoke('state')).games.find((g) => g.id === 'steam:7000901').media.file,
      beforePurge.games.find((g) => g.id === 'steam:7000901').media.file
    );
    assert(await fs.stat(installed));
    check('Cancelling complete purge keeps prepared media and Steam export intact');
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('[data-action="purge-media"]').click();
    await page.locator('.purge-result').waitFor();
    await settled();
    let purged = await fixture.core.invoke('state');
    assert.equal(purged.storage.used, 0);
    assert.equal(purged.steam.installed, false);
    assert.equal(purged.previewsPaused, true);
    assert(purged.games.every((g) => g.status === 'new' && !g.media && !g.cover && !g.smoothed));
    assert.deepEqual(
      purged.games.map((g) => ({
        id: g.id,
        included: g.included,
        selectedAsset: g.selectedAsset,
        selectedCover: g.selectedCover,
        crop: g.crop
      })),
      oldChoices
    );
    assert.deepEqual(purged.settings, beforePurge.settings);
    assert.equal(purged.hasKey, beforePurge.hasKey);
    assert.deepEqual(await fs.readdir(path.join(fixture.dataDir, 'media')), []);
    await assert.rejects(fs.stat(installed), { code: 'ENOENT' });
    if (capture)
      await page
        .locator('.settings-panel')
        .filter({ has: page.locator('[data-action="purge-media"]') })
        .screenshot({ path: path.join(screenshots, '14-storage-after-purge-qa.png') });
    check(
      'Confirmed complete purge resets all variants and uninstalls the Steam copy while preserving user selections and settings'
    );
    let automaticPreviews = 0;
    const observe = (request) => {
      if (
        request.url().endsWith('/api/invoke') &&
        request.postDataJSON()?.action === 'previewImage'
      )
        automaticPreviews++;
    };
    page.on('request', observe);
    await go('library');
    await page.locator('.banner').filter({ hasText: 'Les médias ont été purgés' }).waitFor();
    await page.reload();
    await page.locator('[data-action="prepare-home"]').waitFor();
    await go('library');
    assert.equal(automaticPreviews, 0);
    assert.deepEqual(await fs.readdir(path.join(fixture.dataDir, 'media')), []);
    await shot('15-library-after-purge-qa');
    page.off('request', observe);
    check(
      'Purged previews stay empty across navigation and reload without background re-downloads'
    );
    await page.locator('[data-action="add-game"]').click();
    await page.locator('#game-search').fill('Orbit');
    await page.locator('#search-form').evaluate((form) => form.requestSubmit());
    await page.locator('#add-dialog .managed-image img').first().waitFor();
    await page.waitForFunction(() =>
      [...document.querySelectorAll('#add-dialog .managed-image img')].some(
        (img) => img.naturalWidth > 0
      )
    );
    assert.equal((await fixture.core.invoke('state')).previewsPaused, false);
    await page.locator('[data-action="close-add"]').click();
    await fixture.core.invoke('prepare', { ids: ['steam:7000901'] });
    for (let i = 0; i < 600; i++) {
      if ((await fixture.core.invoke('state')).job.status === 'completed') break;
      await new Promise((r) => setTimeout(r, 25));
    }
    const preparedAgain = (await fixture.core.invoke('state')).games.find(
      (g) => g.id === 'steam:7000901'
    );
    assert.equal(preparedAgain.status, 'ready');
    assert(preparedAgain.media && preparedAgain.cover);
    assert.deepEqual(
      preparedAgain.selectedCover,
      beforePurge.games.find((g) => g.id === 'steam:7000901').selectedCover
    );
    await fixture.core.invoke('install');
    check(
      'Explicit search restores image previews and preparation rebuilds chosen artwork for reinstall after purge'
    );

    assert.equal(evidence.consoleErrors.length, 0, evidence.consoleErrors.join('\n'));
    check('No uncaught browser errors');
    await fixture.core.invoke('uninstall');
    assert.equal((await fixture.core.invoke('state')).steam.installed, false);
    check('Screensaver removal leaves catalog/media intact');
    evidence.preparedFiles = fixture.prepares;
    if (capture)
      await fs.writeFile(
        path.join(screenshots, 'EVIDENCE.json'),
        JSON.stringify(evidence, null, 2) + '\n'
      );
    return evidence;
  } finally {
    await browser.close();
    if (instance) await instance.close();
    await fs.rm(root, { recursive: true, force: true });
  }
}
module.exports = { runUI };
if (require.main === module)
  runUI({ capture: process.argv.includes('--capture') })
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
