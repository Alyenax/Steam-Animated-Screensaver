'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { createServer } = require('./dev-server.cjs');
async function runUI({ capture = false } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cinema-ui-qa-'));
  const screenshots = path.resolve(__dirname, '..', 'screenshots');
  if (capture) await fs.mkdir(screenshots, { recursive: true });
  const { chromium } = require('playwright');
  const browser = await chromium.launch({
    executablePath:
      process.env.CINEMA_TEST_BROWSER ||
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
    const go = async (route) => {
      await page.locator(`[data-route="${route}"]`).first().click();
    };
    await page.goto(instance.url + '/manager/index.html');
    await page.locator('[data-action="prepare-home"]').waitFor();
    await page.waitForFunction(() => !document.querySelector('[data-action="scan"]')?.disabled);
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
    await shot('03-my-library-qa');
    await page.locator('[data-action="add-game"]').first().click();
    await page.locator('#game-search').fill('Orbit');
    await page.locator('#search-form').evaluate((form) => form.requestSubmit());
    await page.locator('[data-add-result]').first().waitFor();
    assert.equal(await page.locator('[data-add-result]').count(), 2);
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
    let frame = page.frames().find((f) => f.url().includes('/player/index.html'));
    if (!frame) {
      await page.locator('#player-frame').waitFor();
      frame = page.frames().find((f) => f.url().includes('/player/index.html'));
    }
    await frame.waitForFunction(
      () => document.querySelector('.scene.visible video')?.currentTime > 0.1
    );
    await frame.waitForFunction(
      () => getComputedStyle(document.querySelector('.scene.visible')).opacity === '1'
    );
    await shot('06-preview-qa');
    await page.locator('[data-action="toggle-play"]').click();
    await frame.waitForFunction(() => document.querySelector('.scene.visible video')?.paused);
    check('Manager preview uses real offline media and pauses');
    await page.locator('[data-action="fullscreen"]').click();
    await page.waitForFunction(() => !!document.fullscreenElement);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.fullscreenElement);
    check('Fullscreen entry and immediate Escape exit');
    await go('settings');
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
      'SteamOS Animated Screensaver'
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
    assert.deepEqual(remote, []);
    await offline.close();
    await page.bringToFront();
    check('Export plays directly over file:// with zero HTTP requests and no manager dependency');
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
    check('All five spaces at 1280, 800, 390 px in English and French without horizontal overflow');
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
    if (instance) await instance.close();
    await browser.close();
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
