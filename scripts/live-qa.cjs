'use strict';
// Opt-in live integration. Reads a local key file; never accepts secrets on argv.
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
async function run() {
  const project = path.resolve(__dirname, '..'),
    keyFile = path.resolve(process.env.SAS_LIVE_KEY_FILE || path.join(project, '.qa', 'live.key'));
  const root = await fs.mkdtemp(path.join(project, '.qa', 'live-')),
    dataDir = path.join(root, 'data'),
    steamRoot = path.join(root, 'steam');
  let core, browser;
  const evidence = {
    date: new Date().toISOString(),
    provider: 'Live official SteamGridDB v2 with temporary personal key',
    checks: [],
    games: [],
    screenshots: 'Local only, not committed or distributed',
    physicalSteamOS: false
  };
  const record = (name) => {
    evidence.checks.push(name);
    console.log('LIVE:', name);
  };
  try {
    await fs.mkdir(path.join(steamRoot, 'steamapps'), { recursive: true });
    core = require('../core/index.cjs').createCore({
      dataDir,
      steamRoots: [steamRoot],
      isGameRunning: async () => false
    });
    const key = (await fs.readFile(keyFile, 'utf8')).trim();
    await core.invoke('setKey', { key });
    assert.equal((await core.invoke('validateKey')).valid, true);
    record('Personal API key accepted by live SteamGridDB');
    const named = await core.invoke('search', { query: 'Portal 2' });
    assert(named.length > 0);
    assert(named.some((g) => g.thumb));
    record('Live name search returns selectable matches and real thumbnail metadata');
    const portal = await core.invoke('search', { query: '620' });
    assert.equal(portal[0].steamAppId, 620);
    const cyberpunk = await core.invoke('search', {
      query: 'https://store.steampowered.com/app/1091500/'
    });
    assert.equal(cyberpunk[0].steamAppId, 1091500);
    record('Steam AppID and Store URL resolve to distinct SteamGridDB identities');
    for (const match of [portal[0], cyberpunk[0]])
      await core.invoke('add', { sgdbId: match.sgdbId, steamAppId: match.steamAppId });
    assert.equal((await core.invoke('state')).games.length, 2);
    record('Two non-installed games added manually without Steam account credentials');
    const choices = await core.invoke('artworks', { id: 'steam:620' });
    assert(choices.length > 1);
    assert(choices[0].animated);
    await core.invoke('updateGame', { id: 'steam:620', selectedAsset: choices[0] });
    record('Actual animated Hero alternatives available; explicit artist selection persisted');
    await core.invoke('prepare');
    let state;
    for (let i = 0; i < 2400; i++) {
      state = await core.invoke('state');
      if (state.job.status !== 'running') break;
      if (i % 100 === 0)
        console.log(
          'LIVE preparation:',
          state.job.processed + '/' + state.job.total,
          state.job.stage
        );
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.equal(state.job.status, 'completed', 'Live preparation finishes within four minutes');
    for (const game of state.games) {
      assert.equal(game.status, 'ready', `${game.name}: ${game.error || 'Not ready'}`);
      assert.equal(game.media.animated, true);
      evidence.games.push({
        steamAppId: game.steamAppId,
        sgdbId: game.sgdbId,
        name: game.name,
        assetId: game.selectedAsset.id,
        kind: game.selectedAsset.kind,
        format: game.media.format,
        width: game.media.width,
        height: game.media.height,
        duration: game.media.duration,
        author: game.media.author?.name,
        manualSelection: game.manualSelection
      });
    }
    record(
      'Live artwork download, integrity validation, real animation detection and thumbnails completed for both games'
    );
    const portalMedia = state.games.find((g) => g.steamAppId === 620).media.file;
    await fs.writeFile(
      path.join(steamRoot, 'steamapps', 'appmanifest_620.acf'),
      '"AppState" {"appid" "620" "name" "Portal 2" "StateFlags" "4"}'
    );
    state = await core.invoke('scan');
    assert.equal(state.games.length, 2);
    assert.equal(state.games.find((g) => g.steamAppId === 620).installed, true);
    assert.equal(state.games.find((g) => g.steamAppId === 620).media.file, portalMedia);
    record(
      'Offline rescan merges a simulated subsequent installation and preserves downloaded/manual artwork'
    );
    await core.invoke('settings', { shuffle: false, reducedMotion: true });
    await core.invoke('install');
    const installed = path.join(
      steamRoot,
      'config',
      'uioverrides',
      'screensavers',
      'steam-animated-screensaver'
    );
    await core.close();
    core = null;
    const { chromium } = require('playwright');
    browser = await chromium.launch({
      channel: 'chrome',
      headless: true,
      args: ['--autoplay-policy=no-user-gesture-required']
    });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.setDefaultTimeout(20000);
    const requests = [],
      errors = [];
    page.on('request', (request) => requests.push(request.url()));
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(pathToFileURL(path.join(installed, 'index.html')).href);
    await page.bringToFront();
    await page.waitForFunction(
      () =>
        document.querySelector('.scene.visible .artwork') && document.querySelector('#empty').hidden
    );
    await page.screenshot({ path: path.join(root, 'portal-local-only.png') });
    await page.evaluate(() => window.SteamAnimatedScreensaverPlayer.pause());
    const first = await page.screenshot();
    await page.waitForTimeout(350);
    const second = await page.screenshot();
    assert(first.equals(second), 'Pause freezes the actual native artwork');
    await page.evaluate(() => window.SteamAnimatedScreensaverPlayer.play());
    await page.evaluate(() => window.SteamAnimatedScreensaverPlayer.next());
    await page.waitForFunction(() =>
      document.querySelector('.scene.visible h1')?.textContent.includes('Cyberpunk')
    );
    await page.screenshot({ path: path.join(root, 'cyberpunk-local-only.png') });
    assert(
      requests.every((url) => url.startsWith('file:')),
      requests.filter((url) => !url.startsWith('file:')).join('\n')
    );
    assert.deepEqual(errors, []);
    record(
      'Both real downloaded artworks play from installed files with manager closed, zero network requests, pause and next'
    );
    // Persist only metadata/evidence. Downloaded artworks and personal credentials are removed below.
    evidence.storageUsed = state.storage.used;
    await fs.writeFile(
      path.join(project, 'docs', 'LIVE_VALIDATION.json'),
      JSON.stringify(evidence, null, 2) + '\n'
    );
    console.log(JSON.stringify(evidence, null, 2));
  } finally {
    if (core) await core.close().catch(() => {});
    if (browser) await browser.close();
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(keyFile, { force: true });
    console.log('LIVE: Temporary credentials, downloaded media and live screenshots removed.');
  }
}
module.exports = { run };
if (require.main === module)
  run().catch((error) => {
    console.error('LIVE validation failed:', error.message);
    process.exitCode = 1;
  });
