'use strict';
// Opt-in live checks. Secrets are read from a local file, never from command arguments.
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
async function run() {
  const project = path.resolve(__dirname, '..'),
    keyFile = path.resolve(
      process.env.CINEMA_LIVE_KEY_FILE || path.join(project, '.qa', 'live-current.key')
    );
  await fs.mkdir(path.join(project, '.qa'), { recursive: true });
  const root = await fs.mkdtemp(path.join(project, '.qa', 'live-previews-'));
  const dataDir = path.join(root, 'data'),
    steamRoot = path.join(root, 'steam');
  let core, instance, browser, page;
  const report = {
    date: new Date().toISOString(),
    provider: 'Live official SteamGridDB with temporary personal key',
    checks: [],
    counts: {},
    physicalSteamOS: false
  };
  const record = (message) => {
    report.checks.push(message);
    console.log('LIVE:', message);
  };
  try {
    await fs.mkdir(path.join(steamRoot, 'steamapps'), { recursive: true });
    core = require('../core/index.cjs').createCore({
      dataDir,
      steamRoots: [steamRoot],
      isGameRunning: async () => false
    });
    await core.invoke('setKey', { key: (await fs.readFile(keyFile, 'utf8')).trim() });
    await core.invoke('validateKey');
    instance = await require('./dev-server.cjs').createServer({ dataDir, core });
    browser = await require('playwright').chromium.launch({
      channel: 'chrome',
      headless: true,
      args: ['--autoplay-policy=no-user-gesture-required']
    });
    page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(30000);
    const errors = [],
      remote = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => {
      if (new URL(request.url()).origin !== instance.url) remote.push(request.url());
    });
    await page.goto(instance.url + '/manager/index.html');
    await page.locator('[data-route="library"]').first().click();
    await page.locator('[data-action="add-game"]').first().click();
    await page.locator('#game-search').fill('Portal 2');
    await page.locator('#search-form').evaluate((form) => form.requestSubmit());
    await page.locator('[data-add-result]').first().waitFor();
    const results = page.locator('.search-results .result');
    for (let i = 0; i < (await results.count()); i++) {
      await results.nth(i).scrollIntoViewIfNeeded();
      await results
        .nth(i)
        .locator('img')
        .evaluate(
          (img) =>
            new Promise((resolve, reject) => {
              if (img.naturalWidth) return resolve();
              const timer = setTimeout(
                () => reject(new Error('Search preview did not decode')),
                20000
              );
              img.addEventListener(
                'load',
                () => {
                  clearTimeout(timer);
                  resolve();
                },
                { once: true }
              );
            })
        );
    }
    report.counts.search = await results.count();
    record(
      'Live manual search thumbnails render as real local images, including source WebM thumbnails'
    );
    await page.locator('[data-add-result="0"]').click();
    await page.locator('[data-action="close-add"]').click();
    await page.locator('.game-visual').first().click();
    await page.locator('[data-action="load-artworks"]').click();
    await page.locator('[data-select-asset]').first().waitFor();
    const alternatives = page.locator('[data-select-asset]');
    for (let i = 0; i < (await alternatives.count()); i++) {
      await alternatives.nth(i).scrollIntoViewIfNeeded();
      await alternatives
        .nth(i)
        .locator('img')
        .evaluate(
          (img) =>
            new Promise((resolve, reject) => {
              if (img.naturalWidth) return resolve();
              const timer = setTimeout(
                () => reject(new Error('Alternative preview did not decode')),
                20000
              );
              img.addEventListener(
                'load',
                () => {
                  clearTimeout(timer);
                  resolve();
                },
                { once: true }
              );
            })
        );
    }
    report.counts.alternatives = await alternatives.count();
    record('Every returned live animation alternative thumbnail decodes in the Manager');
    const game = (await core.invoke('state')).games[0];
    const assets = await core.invoke('artworks', { id: game.id });
    await core.invoke('updateGame', {
      id: game.id,
      selectedAsset: assets.find((a) => a.id === 29084) || assets[0]
    });
    await page.locator('[data-action="load-covers"]').click();
    await page.locator('[data-select-cover]').first().waitFor();
    const covers = page.locator('[data-select-cover]');
    for (let i = 0; i < (await covers.count()); i++) {
      await covers.nth(i).scrollIntoViewIfNeeded();
      await covers
        .nth(i)
        .locator('img')
        .evaluate(
          (img) =>
            new Promise((resolve, reject) => {
              if (img.naturalWidth) return resolve();
              const timer = setTimeout(
                () => reject(new Error('Fixed artwork preview did not decode')),
                20000
              );
              img.addEventListener(
                'load',
                () => {
                  clearTimeout(timer);
                  resolve();
                },
                { once: true }
              );
            })
        );
    }
    report.counts.fixedArtworks = await covers.count();
    await covers.nth(1).click();
    await page.locator('[data-action="automatic-cover"]').waitFor();
    await page.locator('[data-action="close-detail"]').click();
    record(
      'Every returned live static artwork preview decodes and an explicit alternate cover is saved'
    );
    await core.invoke('prepare');
    for (let i = 0; i < 2400; i++) {
      if ((await core.invoke('state')).job.status === 'completed') break;
      await new Promise((r) => setTimeout(r, 50));
    }
    const prepared = (await core.invoke('state')).games[0];
    assert.equal(prepared.status, 'ready', prepared.error);
    assert.equal(prepared.coverManualSelection, true);
    assert.equal(prepared.cover.animated, false);
    assert.equal(prepared.media.animated, true);
    await page.reload();
    await page.locator('[data-route="preview"]').first().click();
    await page.locator('#player-frame').waitFor();
    const frame = page.frames().find((f) => f.url().includes('/player/index.html'));
    await frame.waitForFunction(
      () =>
        document.querySelector('.scene.visible img.artwork')?.naturalWidth > 0 &&
        document.querySelector('.scene.visible .caption-cover')?.naturalWidth > 0
    );
    record('Actual downloaded animation and independently selected fixed artwork display together');
    await core.invoke('install');
    await instance.close();
    instance = null;
    core = null;
    const offline = await browser.newPage();
    const offlineRemote = [];
    offline.on('request', (request) => {
      if (/^https?:/.test(request.url())) offlineRemote.push(request.url());
    });
    await offline.goto(
      pathToFileURL(
        path.join(
          steamRoot,
          'config',
          'uioverrides',
          'screensavers',
          'steamos-animated-screensaver',
          'index.html'
        )
      ).href
    );
    await offline.waitForFunction(
      () =>
        document.querySelector('.scene.visible img.artwork')?.naturalWidth > 0 &&
        document.querySelector('.scene.visible .caption-cover')?.naturalWidth > 0
    );
    assert.deepEqual(offlineRemote, []);
    assert.deepEqual(remote, []);
    assert.deepEqual(errors, []);
    report.game = {
      name: prepared.name,
      sgdbId: prepared.sgdbId,
      animationId: prepared.selectedAsset.id,
      fixedArtworkId: prepared.selectedCover.id,
      animationAuthor: prepared.media.author.name,
      fixedArtworkAuthor: prepared.cover.author.name
    };
    record('Export displays both live assets with Manager closed and zero HTTP requests');
    await fs.writeFile(
      path.join(project, 'docs', 'LIVE_PREVIEWS_VALIDATION.json'),
      JSON.stringify(report, null, 2) + '\n'
    );
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    if (page) {
      console.log(
        JSON.stringify(
          await page
            .locator('.search-results .result')
            .evaluateAll((rows) =>
              rows.map((row) => ({
                name: row.querySelector('.result-name')?.textContent,
                image: row.querySelector('img')?.getAttribute('src'),
                candidates: row.querySelector('img')?.dataset.previewCandidates,
                decoded: row.querySelector('img')?.naturalWidth,
                failed: row.querySelector('.managed-image')?.className
              }))
            ),
          null,
          2
        )
      );
      await page.screenshot({
        path: path.join(project, '.qa', 'live-preview-failure.png'),
        fullPage: true
      });
    }
    throw error;
  } finally {
    if (browser) await browser.close();
    if (instance) await instance.close();
    else if (core) await core.close();
    await fs.rm(root, { recursive: true, force: true });
  }
}
if (require.main === module)
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
module.exports = { run };
