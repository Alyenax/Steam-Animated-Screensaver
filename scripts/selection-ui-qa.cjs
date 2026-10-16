'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { createCore } = require('../core/index.cjs');
const { createServer } = require('./dev-server.cjs');
async function run() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sas-selection-ui-'));
  let browser, server;
  const checks = [],
    errors = [];
  const check = (text) => {
    checks.push(text);
    console.log(text);
  };
  try {
    const games = Array.from({ length: 125 }, (_, i) => ({
      id: `steam:${i + 1}`,
      steamAppId: i + 1,
      name: `Selection QA ${String(i + 1).padStart(3, '0')}`,
      sources: ['account'],
      installed: false,
      included: i % 2 === 0,
      playtimeMinutes: i
    }));
    await fs.writeFile(path.join(root, 'catalog.json'), JSON.stringify({ version: 1, games }));
    const core = createCore({
      dataDir: root,
      steamRoots: [],
      popularity: {
        rank: async (games, { signal, onProgress }) => {
          const rows = [];
          for (const g of games) {
            signal.throwIfAborted();
            await new Promise((r) => setTimeout(r, 20));
            rows.push({ steamAppId: g.steamAppId, players: 1000 - g.steamAppId });
            onProgress({ processed: rows.length, total: games.length, current: g.name });
          }
          return rows;
        },
        top: async () => ({
          games: [
            { steamAppId: 1, name: 'Selection QA 001', rank: 1 },
            { steamAppId: 900, name: 'Global selection QA', rank: 2 }
          ],
          rankedAt: new Date().toISOString()
        })
      }
    });
    server = await createServer({ dataDir: root, core });
    browser = await require('playwright').chromium.launch({ channel: 'chrome', headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(server.url + '/manager/index.html');
    await page.locator('[data-route="library"]').first().click();
    await page.locator('.game-card').first().waitFor();
    await page.locator('[data-filter="notInstalledFilter"]').click();
    await page.locator('[data-action="deselect-shown"]').click();
    await page.waitForFunction(
      () => document.querySelectorAll('[data-include]:checked').length === 0
    );
    await page.locator('#library-filter').fill('QA 00');
    await page.waitForFunction(() => document.querySelectorAll('.game-card').length === 9);
    await page.locator('[data-action="select-shown"]').click();
    await page.waitForFunction(
      () => document.querySelectorAll('[data-include]:checked').length === 9
    );
    let state = await core.invoke('state');
    assert.equal(state.games.filter((g) => g.included).length, 9);
    await page.locator('#library-filter').fill('');
    await page.locator('[data-action="select-shown"]').click();
    await page.waitForFunction(
      () => document.querySelectorAll('[data-include]:checked').length === 125
    );
    check('Select/deselect all respects the non-installed filter and search, through actual UI');
    await page.locator('[data-action="select-personal-top"]').click();
    await page.waitForFunction(
      () => document.querySelectorAll('[data-include]:checked').length === 100
    );
    state = await core.invoke('state');
    assert(state.games.every((g) => g.included === g.steamAppId > 25));
    check('Personal top selects exactly the 100 most played owned games');
    await page.locator('[data-action="select-popular-owned"]').click();
    await page.locator('[data-selection-status="running"]').waitFor();
    await page.waitForFunction(
      () => Number(document.querySelector('.selection-progress progress')?.value) > 0
    );
    const progress = await page.locator('.selection-progress').innerText();
    assert(progress.includes('%'));
    assert(await page.locator('[data-action="select-shown"]').isDisabled());
    await page.locator('[data-action="cancel-selection"]').click();
    await page.locator('[data-selection-status="cancelled"]').waitFor();
    assert.deepEqual(
      (await core.invoke('state')).games.map((g) => g.included),
      state.games.map((g) => g.included)
    );
    check(
      'Popularity displays live percent, disables competing actions, and cancels without changing choices'
    );
    await page.locator('[data-action="select-popular-owned"]').click();
    await page.locator('[data-selection-status="completed"]').waitFor();
    state = await core.invoke('state');
    assert(state.games.every((g) => g.included === g.steamAppId <= 100));
    check('Steam popularity selects a different correct set of 100 through the UI');
    await page.locator('[data-action="import-popular"]').click();
    await page.waitForFunction(
      () =>
        document.querySelector('[data-filter="popularFilter"]')?.classList.contains('active') &&
        document.querySelectorAll('.game-card').length === 2
    );
    assert.equal(
      (await core.invoke('state')).games.find((g) => g.steamAppId === 900).included,
      false
    );
    await page.locator('[data-action="select-shown"]').click();
    await page.waitForFunction(
      () => document.querySelectorAll('[data-include]:checked').length === 2
    );
    check(
      'Global Steam discovery deduplicates, starts new games excluded, and supports select all'
    );
    const forbidden =
      /YOUR GAMES\. ANOTHER PERSPECTIVE|Beautifully Alive|INTERMISSION, REIMAGINED|great games deserve|entracte|cinématographique|VOS JEUX\. UN AUTRE REGARD|plus vivante que jamais|Local-first|CINEMA|STEAMOS ANIMATED SCREENSAVER/i;
    for (const language of ['en', 'fr']) {
      if ((await page.locator('html').getAttribute('lang')) !== language) {
        await page.locator('[data-action="language"]').click();
        await page.waitForFunction((l) => document.documentElement.lang === l, language);
      }
      for (const width of [1280, 800, 390]) {
        await page.setViewportSize({ width, height: 900 });
        for (const route of ['home', 'library', 'preparation', 'preview', 'settings']) {
          await page.locator(`[data-route="${route}"]`).first().click();
          assert(
            !forbidden.test(await page.locator('body').innerText()),
            `Promotional copy ${route}/${language}`
          );
          assert.equal(
            await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
            false,
            `Overflow ${route}/${language}/${width}`
          );
        }
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator('[data-route="library"]').first().click();
    if (process.argv.includes('--capture'))
      await page.screenshot({
        path: path.resolve(__dirname, '../screenshots/19-library-selection-fr-qa.png'),
        fullPage: true
      });
    check('All five views use functional copy in EN/FR and fit 1280/800/390 px');
    assert.deepEqual(errors, []);
    await fs.writeFile(
      path.resolve(__dirname, '../docs/SELECTION_VALIDATION.json'),
      JSON.stringify(
        {
          version: require('../package.json').version,
          fixture:
            'Isolated 125-game catalog and deterministic ranking provider; no personal credentials.',
          checks,
          pageErrors: errors
        },
        null,
        2
      ) + '\n'
    );
  } finally {
    await browser?.close();
    await server?.close();
    await fs.rm(root, { recursive: true, force: true });
  }
}
run().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
