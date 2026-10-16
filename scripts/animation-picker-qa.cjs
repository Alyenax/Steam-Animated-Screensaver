'use strict';
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { createServer } = require('./dev-server.cjs');
async function run() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sas-animation-picker-'));
  let browser, server;
  const checks = [],
    errors = [];
  const check = (text) => {
    checks.push(text);
    console.log(text);
  };
  try {
    browser = await require('playwright').chromium.launch({ channel: 'chrome', headless: true });
    const fixture = await require('./qa-fixture.cjs').createFixture({ root, browser });
    await fixture.add(901);
    let fault = null;
    server = await createServer({
      dataDir: fixture.dataDir,
      core: {
        invoke: (action, payload) => {
          if (action === 'artworks' && fault === 'error')
            return Promise.reject(new Error('Fixture provider unavailable'));
          if (action === 'artworks' && fault === 'empty') return Promise.resolve([]);
          return fixture.core.invoke(action, payload);
        },
        close: () => fixture.core.close()
      }
    });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', (e) => errors.push(e.message));
    const open = async () => {
      await page.goto(server.url + '/manager/index.html');
      await page.locator('[data-route="library"]').first().click();
      await page.locator('.game-visual[data-detail="steam:7000901"]').click();
    };
    const visibleAbovePreview = async () => {
      const button = await page.locator('[data-action="load-artworks"]').boundingBox(),
        dialog = await page.locator('#detail-dialog').boundingBox(),
        preview = await page.locator('.detail-framing').boundingBox();
      assert(
        button.y >= dialog.y && button.y + button.height <= dialog.y + dialog.height,
        'Animation control must be visible immediately'
      );
      assert(
        button.y >= 0 && button.y + button.height <= page.viewportSize().height,
        'Animation control must be visible in the initial viewport without scrolling'
      );
      assert(
        button.y + button.height <= preview.y,
        'Control must precede current artwork/crop/cover'
      );
    };
    await open();
    await visibleAbovePreview();
    assert(await page.getByRole('button', { name: 'Find animations', exact: true }).isDisabled());
    assert(
      (await page.locator('#detail-dialog').innerText()).includes('Add a SteamGridDB API key')
    );
    check('Unprepared game exposes Find animations immediately, with a clear key requirement');
    await fixture.core.invoke('setKey', { key: 'qa-fixture-key-not-a-real-personal-key' });
    await fixture.core.invoke('updateGame', {
      id: 'steam:7000901',
      crop: { mode: '16:10', x: 20, y: 50 }
    });
    await fixture.core.invoke('prepare');
    for (let i = 0; i < 600; i++) {
      if ((await fixture.core.invoke('state')).job.status === 'completed') break;
      await new Promise((r) => setTimeout(r, 25));
    }
    await fixture.core.invoke('covers', { id: 'steam:7000901' });
    await fixture.core.invoke('setCover', {
      id: 'steam:7000901',
      selectedCover: { id: 9011, kind: 'grid' }
    });
    const before = (await fixture.core.invoke('state')).games.find((g) => g.id === 'steam:7000901');
    assert.equal(before.status, 'ready');
    for (const [language, width] of [
      ['en', 1440],
      ['fr', 390]
    ]) {
      await fixture.core.invoke('settings', { language });
      await page.setViewportSize({ width, height: 900 });
      await open();
      await visibleAbovePreview();
      assert.equal(
        await page.locator('[data-action="load-artworks"]').innerText(),
        language === 'fr' ? 'Changer l’animation' : 'Change animation'
      );
      assert.equal(
        await page.locator('#detail-dialog').evaluate((el) => el.scrollWidth > el.clientWidth),
        false
      );
      if (process.argv.includes('--capture') && language === 'fr')
        await page.screenshot({
          path: path.resolve(__dirname, '../screenshots/20-change-animation-fr-qa.png'),
          fullPage: false
        });
      await page.locator('[data-action="load-artworks"]').click();
      await page.locator('[data-select-asset="1"]').waitFor();
      await page.waitForFunction(() =>
        [...document.querySelectorAll('[data-select-asset] img')].every(
          (img) => img.naturalWidth > 0
        )
      );
      const choices = await page.locator('[data-select-asset="0"]').boundingBox(),
        dialog = await page.locator('#detail-dialog').boundingBox();
      assert(choices.y >= dialog.y && choices.y < dialog.y + dialog.height);
      assert.equal(
        (await fixture.core.invoke('state')).games.find((g) => g.id === before.id).media.file,
        before.media.file,
        'Browsing must preserve the animation'
      );
    }
    check(
      'Ready games expose Change animation above the preview in EN desktop and FR handheld; the gallery opens visibly with working images'
    );
    fault = 'error';
    await page.locator('[data-action="load-artworks"]').click();
    await page.locator('#animation-choices [role="alert"]').waitFor();
    assert.equal(
      await page.locator('#animation-choices [role="alert"]').innerText(),
      'Fixture provider unavailable'
    );
    assert(!(await page.locator('[data-action="load-artworks"]').isDisabled()));
    fault = 'empty';
    await page.locator('[data-action="load-artworks"]').click();
    await page.waitForFunction(() =>
      document
        .querySelector('#animation-choices')
        ?.textContent.includes('Aucune illustration compatible')
    );
    fault = null;
    await page.locator('[data-action="load-artworks"]').click();
    await page.locator('[data-select-asset="1"]').waitFor();
    check(
      'Provider errors and empty results keep search accessible; retry recovers without changing the current animation'
    );
    await page.locator('[data-select-asset="1"]').click();
    await page.waitForFunction(
      () =>
        document.querySelector('[data-select-asset="1"]')?.getAttribute('aria-pressed') === 'true'
    );
    let chosen = (await fixture.core.invoke('state')).games.find((g) => g.id === before.id);
    assert.equal(chosen.selectedAsset.id, 1000901);
    assert.equal(chosen.manualSelection, true);
    assert.deepEqual(chosen.cover, before.cover);
    assert.deepEqual(chosen.crop, before.crop);
    assert.equal(chosen.included, before.included);
    await page.locator('[data-action="prepare-game"]').click();
    for (let i = 0; i < 600; i++) {
      const state = await fixture.core.invoke('state');
      if (
        state.job.status === 'completed' &&
        state.games.find((g) => g.id === before.id).status === 'ready'
      )
        break;
      await new Promise((r) => setTimeout(r, 25));
    }
    chosen = (await fixture.core.invoke('state')).games.find((g) => g.id === before.id);
    assert.equal(chosen.status, 'ready');
    assert.notEqual(chosen.media.sha256, before.media.sha256);
    assert.deepEqual(chosen.cover, before.cover);
    assert.deepEqual(chosen.crop, before.crop);
    await fixture.core.invoke('install');
    const context = { window: {} };
    vm.runInNewContext(
      await fs.readFile(
        path.join(
          fixture.steamRoot,
          'config/uioverrides/screensavers/steam-animated-screensaver/catalog.js'
        ),
        'utf8'
      ),
      context
    );
    assert.equal(context.window.SAS_CATALOG.games[0].media.file, 'media/' + chosen.media.file);
    assert.equal(context.window.SAS_CATALOG.games[0].cover.file, 'media/' + before.cover.file);
    const saved = JSON.parse(
      await fs.readFile(path.join(fixture.dataDir, 'catalog.json'), 'utf8')
    ).games.find((g) => g.id === before.id);
    assert.equal(saved.selectedAsset.id, 1000901);
    check(
      'Choosing and preparing another animation changes actual media and Steam export, preserves fixed artwork/crop/inclusion, and persists the choice'
    );
    assert.deepEqual(errors, []);
    await fs.writeFile(
      path.resolve(__dirname, '../docs/ANIMATION_PICKER_VALIDATION.json'),
      JSON.stringify(
        {
          version: require('../package.json').version,
          result: 'passed',
          fixture:
            'Isolated real Core/Manager/media/export with original generated animations and injected provider faults; no personal key or downloaded game artwork.',
          checks,
          unexpectedErrors: errors
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
