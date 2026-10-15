/* Isolated browser integration test. All catalog data is temporary test data. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium } = require('playwright');
const { createServer } = require('../scripts/dev-server.cjs');
(async () => {
  const dir = await fs.mkdtemp('/tmp/cinema-manager-qa-');
  let server, browser;
  try {
    await fs.mkdir(dir + '/media');
    await fs.writeFile(
      dir + '/media/scene.png',
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64'
      )
    );
    const calls = [],
      errors = [];
    const state = {
      version: 1,
      games: [
        {
          id: 'steam:1',
          steamAppId: 1,
          sgdbId: 1,
          name: 'QA prepared scene',
          sources: ['installed'],
          installed: true,
          included: true,
          status: 'ready',
          media: {
            file: 'scene.png',
            thumbnail: 'scene.png',
            width: 1,
            height: 1,
            format: 'png',
            animated: false,
            author: { name: 'QA fixture' }
          }
        }
      ],
      settings: {
        language: 'en',
        sceneDuration: 24,
        shuffle: true,
        transition: 'crossfade',
        showLogos: true,
        staticFallback: true,
        reducedMotion: false,
        maxStorageGB: 10,
        pauseOnGame: true
      },
      job: {
        status: 'idle',
        total: 0,
        processed: 0,
        current: null,
        stage: '',
        errors: [],
        bytes: 0
      },
      steam: { detected: true, installed: true, roots: ['fixture'] },
      storage: { used: 100 },
      hasKey: true
    };
    const asset = {
      id: 4,
      url: 'https://cdn2.steamgriddb.com/hero/qa.png',
      thumb: '',
      width: 1920,
      height: 620,
      score: 1,
      kind: 'hero',
      animated: true,
      author: { name: 'QA artist' }
    };
    const mock = {
      async invoke(action, payload = {}) {
        calls.push({ action, payload });
        if (action === 'search')
          return [
            { sgdbId: 2, steamAppId: 2, name: 'Distinct edition', thumb: null, present: false }
          ];
        if (action === 'artworks') return [asset];
        if (action === 'add')
          state.games.push({
            id: 'steam:2',
            steamAppId: 2,
            sgdbId: 2,
            name: payload.name,
            sources: ['manual'],
            installed: false,
            included: true,
            status: 'new'
          });
        if (action === 'settings') Object.assign(state.settings, payload);
        if (action === 'updateGame')
          Object.assign(
            state.games.find((g) => g.id === payload.id),
            payload
          );
        if (action === 'prepare')
          state.job = {
            ...state.job,
            status: 'running',
            total: 2,
            processed: 1,
            current: 'steam:2',
            stage: 'downloading',
            bytes: 1048576
          };
        if (action === 'pause') state.job.status = 'paused';
        if (action === 'resume') state.job.status = 'running';
        if (action === 'validateKey') return { valid: true };
        return state;
      },
      async close() {}
    };
    server = await createServer({ dataDir: dir, core: mock });
    browser = await chromium.launch({
      channel: process.env.CINEMA_BROWSER_CHANNEL || 'chrome',
      headless: true
    });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(server.url);
    await page.waitForSelector('h1');
    await page.locator('[data-route="preview"]').click();
    await page.frameLocator('#player-frame').locator('.scene.visible').waitFor();
    await page.locator('#player-frame').evaluate((el) => (el.dataset.identity = 'retained'));
    await page.locator('.preview-option input[data-setting="shuffle"]').uncheck();
    await page.waitForTimeout(200);
    assert.equal(
      await page.locator('#player-frame').getAttribute('data-identity'),
      'retained',
      'settings must preserve iframe'
    );
    await page.locator('[data-action="next"]').click();
    await page.locator('[data-route="library"]').click();
    await page.locator('[data-action="add-game"]').click();
    await page.locator('#game-search').fill('Distinct');
    await page.locator('#search-form button').click();
    await page.locator('[data-add-result="0"]').click();
    await page.waitForTimeout(150);
    await page.locator('[data-action="close-add"]').click();
    await page.locator('[data-detail="steam:2"]').first().click();
    await page.locator('[data-action="load-artworks"]').click();
    await page.locator('[data-select-asset="0"]').click();
    await page.locator('[data-action="prepare-game"]').click();
    await page.locator('[data-action="pause"]').click();
    await page.locator('[data-action="resume"]').click();
    await page.locator('[data-route="settings"]').click();
    await page.locator('[data-action="update-install"]').click();
    await page.waitForTimeout(100);
    assert(
      calls.some((c) => c.action === 'install'),
      'Update/repair must publish with install'
    );
    await page.locator('[data-action="repair"]').click();
    await page.waitForTimeout(100);
    assert(
      calls.some((c) => c.action === 'repair'),
      'Repair library must call repair'
    );
    await page.locator('[data-action="language"]').click();
    await page.waitForFunction(() => document.documentElement.lang === 'fr');
    for (const width of [1280, 800, 390]) {
      await page.setViewportSize({ width, height: 800 });
      for (const route of ['home', 'library', 'preparation', 'preview', 'settings']) {
        await page.locator(`.nav [data-route="${route}"]`).click();
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
          false,
          `overflow at ${route} ${width}`
        );
      }
    }
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        passed: true,
        pageErrors: errors,
        actions: [...new Set(calls.map((c) => c.action))],
        sizes: [1280, 800, 390]
      })
    );
  } finally {
    await browser?.close();
    await server?.close();
    await fs.rm(dir, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
