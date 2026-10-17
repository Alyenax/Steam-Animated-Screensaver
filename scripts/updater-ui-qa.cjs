'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { createUpdater } = require('../core/app-updates.cjs');
const { TARGETS, assetName, API, REPO } = require('../core/update-format.cjs');
const { createCore } = require('../core/index.cjs');
const { createServer } = require('./dev-server.cjs');
(async () => {
  const root = await fs.mkdtemp('/private/tmp/sas-update-ui-');
  const output = path.resolve('dist/updater-1.2.0');
  await fs.mkdir(output, { recursive: true });
  let instance, browser, updater;
  const checks = [],
    errors = [],
    calls = [];
  try {
    const keys = crypto.generateKeyPairSync('ed25519'),
      body = Buffer.alloc(524288, 67),
      version = '1.2.1';
    const digest = crypto.createHash('sha256').update(body).digest('hex');
    const payload = Buffer.from(
      JSON.stringify({
        schema: 1,
        product: 'steam-animated-screensaver',
        version,
        tag: 'v' + version,
        minimumUpdater: 1,
        assets: Object.keys(TARGETS).map((target) => ({
          target,
          name: assetName(version, target),
          size: body.length,
          sha256: digest,
          unpackedBytes: body.length
        }))
      })
    );
    const manifest = Buffer.from(
      JSON.stringify({
        schema: 1,
        keyId: 'release-1',
        payload: payload.toString('base64'),
        signature: crypto.sign(null, payload, keys.privateKey).toString('base64')
      })
    );
    const release = {
      tag_name: 'v' + version,
      draft: false,
      prerelease: false,
      body: 'Optional update\n<script>window.injected=true</script>',
      assets: Object.keys(TARGETS).map((target) => ({
        name: assetName(version, target),
        size: body.length,
        state: 'uploaded',
        digest: 'sha256:' + digest,
        browser_download_url: `https://github.com/${REPO}/releases/download/v${version}/${assetName(version, target)}`
      }))
    };
    release.assets.push({
      name: 'update.json',
      size: manifest.length,
      state: 'uploaded',
      browser_download_url: `https://github.com/${REPO}/releases/download/v${version}/update.json`
    });
    let installs = 0;
    updater = createUpdater({
      dataDir: root,
      version: '1.2.0',
      target: 'linux-x64',
      enabled: false,
      publicKey: keys.publicKey,
      installer: {
        available: true,
        install: async (_candidate, { set }) => {
          installs++;
          set({ phase: 'installing' });
        }
      },
      fetchImpl: async (url, options) => {
        if (url === API) return new Response(JSON.stringify(release));
        if (url.endsWith('/update.json')) return new Response(manifest);
        let offset = 0;
        return new Response(
          new ReadableStream({
            async pull(c) {
              await new Promise((r) => setTimeout(r, 100));
              if (options.signal.aborted) {
                c.error(new Error('cancelled'));
                return;
              }
              if (offset === body.length) {
                c.close();
                return;
              }
              c.enqueue(body.subarray(offset, offset + 32768));
              offset += 32768;
            }
          })
        );
      }
    });
    await updater.init();
    const core = createCore({
      dataDir: root,
      steamRoots: [],
      updater,
      isGameRunning: async () => false
    });
    instance = await createServer({
      dataDir: root,
      core: {
        invoke: async (action, payload) => {
          if (action.startsWith('appUpdate')) {
            calls.push(action);
            if (action === 'appUpdateCheck') return updater.check();
            if (action === 'appUpdateDownload') return updater.download();
            if (action === 'appUpdateCancel') return updater.cancel();
            if (action === 'appUpdatePreferences') return updater.preferences(payload);
            if (action === 'appUpdateInstall') return updater.install(payload.confirm);
            if (action === 'appUpdateRelease') return { opened: true };
            throw Error('Unknown updater action');
          }
          return core.invoke(action, payload);
        },
        close: async () => {
          await core.close();
          await updater.close();
        }
      }
    });
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    page.setDefaultTimeout(15000);
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(instance.url);
    await page.locator('[data-route="settings"]').first().click();
    await page.locator('#app-updates').waitFor();
    assert.match(await page.locator('#app-updates').innerText(), /Installed version: 1.2.0/);
    await page.locator('[data-update-auto]').uncheck();
    assert.equal(updater.status().autoCheck, false);
    await page.locator('[data-action="app-update-check"]').click();
    await page.locator('[data-action="app-update-download"]').waitFor();
    assert.match(await page.locator('#app-updates').innerText(), /Available version: 1.2.1/);
    checks.push(
      'Real updater check, signed manifest and independent daily-check preference are connected to Settings'
    );
    await page.locator('.update-notes summary').click();
    assert.equal(await page.evaluate(() => window.injected), undefined);
    assert.match(await page.locator('.update-notes pre').innerText(), /<script>/);
    checks.push('Release notes are rendered as escaped text without HTML execution');
    await page.locator('[data-action="app-update-download"]').click();
    await page.locator('.update-progress').waitFor();
    await page.waitForFunction(() => document.querySelector('.update-progress')?.value > 0);
    await page
      .locator('#app-updates')
      .screenshot({ path: path.join(output, 'download-progress.png') });
    await page.locator('[data-action="app-update-cancel"]').click();
    await page.locator('[data-action="app-update-download"]').waitFor();
    assert.equal(updater.status().phase, 'available');
    checks.push(
      'Live measured download percentage and byte count are visible; cancellation removes partial download and allows retry'
    );
    await page.locator('[data-action="app-update-download"]').click();
    await page.locator('[data-action="app-update-install"]').waitFor();
    page.once('dialog', (dialog) => dialog.dismiss());
    await page.locator('[data-action="app-update-install"]').click();
    assert.equal(installs, 0);
    await page.locator('[data-update-auto]').check();
    for (const language of ['en', 'fr']) {
      await core.invoke('settings', { language });
      await page.reload();
      await page.locator('[data-route="settings"]').first().click();
      for (const width of [1280, 800, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
          false,
          `${language}/${width}`
        );
        assert(await page.locator('[data-action="app-update-install"]').isVisible());
      }
    }
    checks.push(
      'Cancelled confirmation performs no installation; English/French controls and ready state remain usable at 1280, 800 and 390 px'
    );
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page
      .locator('#app-updates')
      .screenshot({ path: path.join(output, 'ready-to-install-fr.png') });
    await page.locator('[data-route="home"]').first().click();
    await page.locator('.update-notice').waitFor();
    await page.locator('[data-action="open-app-updates"]').click();
    assert(await page.locator('#app-updates').isVisible());
    checks.push(
      'An available update is discoverable from the main app and leads directly to the update panel'
    );
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('[data-action="app-update-install"]').click();
    await page.waitForFunction(() =>
      document.querySelector('.update-phase')?.textContent.includes('Fermeture')
    );
    assert.equal(installs, 1);
    assert.deepEqual(errors, []);
    checks.push(
      'Confirmed installation reaches the separate installer exactly once; UI fixture does not replace any real application'
    );
    const report = {
      version: require('../package.json').version,
      result: 'passed',
      fixture:
        'Signed synthetic release and real streaming updater; installation adapter is simulated',
      checks,
      pageErrors: errors,
      actions: calls
    };
    await fs.writeFile('dist/UPDATER_UI_VALIDATION.json', JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser?.close();
    await instance?.close();
    await updater?.close();
    await fs.rm(root, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
