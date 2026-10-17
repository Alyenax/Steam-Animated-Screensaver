'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { createServer } = require('./dev-server.cjs');
(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sas-branding-ui-'));
  const checks = [],
    errors = [];
  let browser, instance, fixture;
  const output = path.resolve(`dist/branding-${require('../package.json').version}`);
  await fs.mkdir(output, { recursive: true });
  try {
    browser = await chromium.launch({
      channel: 'chrome',
      headless: true,
      args: ['--autoplay-policy=no-user-gesture-required']
    });
    fixture = await require('./qa-fixture.cjs').createFixture({
      root,
      browser,
      includeLogos: true
    });
    await fixture.core.invoke('setKey', { key: 'qa-fixture-key-not-a-personal-key' });
    await fixture.add(901);
    instance = await createServer({ dataDir: fixture.dataDir, core: fixture.core });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', (e) => errors.push(e.message));
    page.setDefaultTimeout(15000);
    await page.goto(instance.url + '/manager/index.html');
    const settled = () => page.waitForFunction(() => !document.body.hasAttribute('aria-busy'));
    const go = async (route) => {
      await page.locator(`.nav [data-route="${route}"]`).click();
    };
    await go('library');
    await page.locator('.library-prepare-bar [data-action="prepare-all"]').click();
    await page.locator('.steam-next-step.needs-install').waitFor();
    assert.equal((await fixture.core.invoke('state')).games[0].status, 'ready');
    assert(
      await page
        .locator('.workflow-step.current')
        .innerText()
        .then((t) => t.includes('Install in Steam'))
    );
    checks.push('Top library preparation action leads to a prominent Install in Steam next step');
    await page.screenshot({ path: path.join(output, 'prepare-and-install.png'), fullPage: true });
    await go('preview');
    const frame = page.frameLocator('#player-frame');
    await frame.locator('.scene.visible .game-logo:not([hidden])').waitFor();
    assert.equal(await frame.locator('.scene.visible h1').isVisible(), false);
    assert.equal(await frame.locator('.scene.visible .caption-copy .game-logo').count(), 1);
    assert.equal(await frame.locator('.scene.visible .caption-cover').isVisible(), true);
    checks.push(
      'Default native PNG logo alone is displayed beside the cover with no duplicate title'
    );
    await page.screenshot({ path: path.join(output, 'logo-default.png'), fullPage: true });
    assert.equal(await frame.locator('.scene.visible .credit:visible').count(), 0);
    checks.push('Animation, cover and logo credits are all hidden by default');
    const creditKeys = ['showArtworkCredit', 'showCoverCredit', 'showLogoCredit'];
    const creditClasses = ['artwork-credit', 'cover-credit', 'logo-credit'];
    for (let mask = 0; mask < 8; mask++) {
      for (let i = 0; i < 3; i++) {
        await page.locator(`[data-setting="${creditKeys[i]}"]`).setChecked(!!(mask & (1 << i)));
        await settled();
      }
      await frame.locator('.scene.visible .game-logo:not([hidden])').waitFor();
      for (let i = 0; i < 3; i++)
        assert.equal(
          await frame.locator(`.scene.visible .${creditClasses[i]}`).isVisible(),
          !!(mask & (1 << i))
        );
    }
    checks.push('All eight independent credit combinations render correctly in the real preview');
    await page.locator('[data-setting="showCover"]').uncheck();
    await settled();
    assert.equal(await frame.locator('.scene.visible .cover-credit').isVisible(), false);
    await page.locator('[data-setting="nameDisplay"]').selectOption('title');
    await settled();
    assert.equal(await frame.locator('.scene.visible .logo-credit').isVisible(), false);
    await page.locator('[data-setting="nameDisplay"]').selectOption('logo');
    await settled();
    await page.locator('[data-setting="showCover"]').check();
    await settled();
    await page.locator('[data-setting="showCoverCredit"]').uncheck();
    await settled();
    checks.push('Cover and logo credits hide automatically when their associated image is hidden');
    await page.reload();
    await go('preview');
    await frame.locator('.scene.visible .game-logo:not([hidden])').waitFor();
    for (let i = 0; i < 3; i++)
      assert.equal(await page.locator(`[data-setting="${creditKeys[i]}"]`).isChecked(), i !== 1);
    checks.push('Mixed credit choices persist across a full reload');

    await page.locator('[data-setting="nameDisplay"]').selectOption('both');
    await settled();
    await frame.locator('.scene.visible h1').waitFor();
    for (const size of [
      { width: 1440, height: 1000 },
      { width: 800, height: 600 },
      { width: 390, height: 844 }
    ]) {
      await page.setViewportSize(size);
      for (const position of ['top-left', 'top-right', 'bottom-left', 'bottom-right']) {
        await page
          .locator('[data-setting="coverPosition"]')
          .selectOption(position === 'bottom-left' ? 'beside-title' : position);
        await settled();
        await page.locator('[data-setting="logoPosition"]').selectOption(position);
        await settled();
        await frame
          .locator(`.scene.visible[data-logo-position="${position}"] > .game-logo:not([hidden])`)
          .waitFor();
        const boxes = await frame.locator('.scene.visible').evaluate((scene) => {
          const box = (sel) => {
            const r = scene.querySelector(sel).getBoundingClientRect();
            return { x: r.x, y: r.y, w: r.width, h: r.height };
          };
          return {
            logo: box('.game-logo'),
            cover: box('.caption-cover'),
            caption: box('.caption'),
            width: innerWidth,
            height: innerHeight
          };
        });
        const a = boxes.logo,
          b = boxes.cover;
        assert(
          a.x >= 0 && a.y >= 0 && a.x + a.w <= boxes.width + 1 && a.y + a.h <= boxes.height + 1,
          JSON.stringify({ size, position, boxes })
        );
        assert(
          a.x + a.w <= b.x + 1 ||
            b.x + b.w <= a.x + 1 ||
            a.y + a.h <= b.y + 1 ||
            b.y + b.h <= a.y + 1,
          JSON.stringify({ size, position, boxes })
        );
      }
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false
      );
    }
    checks.push(
      'All four corner positions stay on screen and avoid the cover at desktop, handheld and mobile widths'
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    await go('library');
    await page
      .locator('.game-card [data-detail]')
      .first()
      .click()
      .catch(async () => {
        await page.locator('.game-card').first().click();
      });
    await page.locator('[data-action="load-logos"]').click();
    await page.locator('[data-select-logo="1"]').waitFor();
    await page.locator('[data-select-logo="1"]').click();
    await page.locator('[data-select-logo="1"].selected').waitFor();
    await settled();
    assert.equal((await fixture.core.invoke('state')).games[0].selectedLogo.id, 90101);
    await page.locator('[data-branding="mode"]').selectOption('logo');
    await settled();
    await page.locator('[data-branding="position"]').selectOption('beside-title');
    await settled();
    await page.screenshot({ path: path.join(output, 'game-logo-picker.png'), fullPage: true });
    await page.locator('[data-action="close-detail"]').click();
    checks.push(
      'Alternative logos and per-game mode and position choices are available in the game sheet'
    );
    await page.locator('#steam-next-step [data-action="install"]').click();
    await settled();
    await page.locator('.steam-next-step.installed').waitFor();
    assert.equal((await fixture.core.invoke('state')).steam.needsUpdate, false);
    assert((await page.locator('#steam-next-step').innerText()).includes('Customization'));
    await go('preview');
    await page.locator('[data-setting="showCoverCredit"]').check();
    await settled();
    await page.locator('#steam-next-step [data-action="update-install"]').waitFor();
    await page.locator('#steam-next-step [data-action="update-install"]').click();
    await settled();
    assert.equal((await fixture.core.invoke('state')).steam.needsUpdate, false);
    checks.push(
      'Installed state shows manual Steam selection instructions; changed settings reveal Update in Steam'
    );
    const installed = path.join(
      fixture.steamRoot,
      'config/uioverrides/screensavers/steam-animated-screensaver'
    );
    const offline = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    let external = 0;
    offline.on('request', (r) => {
      if (/^https?:/.test(r.url())) external++;
    });
    await offline.goto(pathToFileURL(path.join(installed, 'index.html')).href);
    await offline.locator('.scene.visible .game-logo:not([hidden])').waitFor();
    assert.equal(external, 0);
    assert.equal(await offline.locator('.scene.visible .credit:visible').count(), 3);
    checks.push(
      'Offline Steam export preserves the selected credits without preparing media again'
    );
    await offline.screenshot({ path: path.join(output, 'offline-logo.png') });
    let state = await fixture.core.invoke('state');
    await fs.unlink(path.join(installed, 'media', state.games[0].logo.file));
    await offline.reload();
    await offline.locator('.scene.visible h1:not([hidden])').waitFor();
    assert.equal(await offline.locator('.scene.visible .game-logo').isVisible(), false);
    checks.push(
      'Exported player works offline and falls back to the game title if the logo file fails to load'
    );
    assert.equal(await offline.locator('.scene.visible .logo-credit').isVisible(), false);
    await offline.close();
    for (const key of creditKeys) {
      await page.locator(`[data-setting="${key}"]`).uncheck();
      await settled();
    }
    await page.locator('#steam-next-step [data-action="update-install"]').click();
    await settled();
    const clean = await browser.newPage();
    await clean.goto(pathToFileURL(path.join(installed, 'index.html')).href);
    await clean.locator('.scene.visible .game-logo:not([hidden])').waitFor();
    assert.equal(await clean.locator('.scene.visible .credit:visible').count(), 0);
    await clean.close();
    checks.push(
      'Disabling every credit and updating Steam produces an offline export with no visible credits'
    );

    await go('settings');
    await page.locator('[data-setting="language"]').selectOption('fr');
    await settled();
    assert(
      (await page.locator('.nav [data-route="preparation"]').innerText()).includes(
        'Préparer et installer'
      )
    );
    await page.locator('[data-setting="nameDisplay"]').selectOption('hidden');
    await settled();
    await go('preview');
    await frame.locator('.scene.visible').waitFor();
    // This game's explicit override remains effective despite the global hidden mode.
    await frame.locator('.scene.visible .game-logo:not([hidden])').waitFor();
    checks.push(
      'French labels and explicit per-game overrides remain effective after global changes'
    );
    assert.deepEqual(errors, []);
    checks.push('No uncaught renderer errors');
    const report = {
      version: require('../package.json').version,
      at: new Date().toISOString(),
      checks,
      errors,
      fixture:
        'Original labelled animations, transparent PNG logos and covers, mocked provider; isolated Steam root. No personal data.'
    };
    await fs.writeFile(
      path.join(output, 'BRANDING_UI_VALIDATION.json'),
      JSON.stringify(report, null, 2) + '\n'
    );
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await instance?.close();
    await fixture?.core.close();
    await browser?.close();
    await fs.rm(root, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
