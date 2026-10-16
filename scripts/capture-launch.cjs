'use strict';
// Capture the actual Manager/Player against an isolated copy of explicitly supplied media.
// Never opens credential files or writes to the supplied source catalog/media directory.
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createCore } = require('../core/index.cjs');
const { createServer } = require('./dev-server.cjs');
const root = path.resolve(__dirname, '..');
async function main() {
  const args = process.argv.slice(2);
  const value = (flag) => args[args.indexOf(flag) + 1];
  if (!args.includes('--catalog') || !args.includes('--media-dir'))
    throw new Error(
      'Usage: node scripts/capture-launch.cjs --catalog /path/catalog.json --media-dir /path/media'
    );
  const source = path.resolve(value('--catalog'));
  const sourceMedia = path.resolve(value('--media-dir'));
  const original = await fs.readFile(source);
  const hash = (b) => crypto.createHash('sha256').update(b).digest('hex');
  const saved = JSON.parse(original);
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'sas-launch-'));
  const dataDir = path.join(temp, 'data'),
    steamRoot = path.join(temp, 'steam');
  const out = path.join(root, 'dist/public-launch');
  const images = path.join(root, 'screenshots/public');
  await fs.mkdir(path.join(dataDir, 'media'), { recursive: true });
  await fs.mkdir(path.join(steamRoot, 'steamapps'), { recursive: true });
  await fs.mkdir(out, { recursive: true });
  await fs.mkdir(images, { recursive: true });
  // Allowlisted game/media fields only: no account, paths, history or settings from the user's catalog.
  const games = saved.games
    .filter((g) => g.status === 'ready' && g.media?.file && g.cover?.file)
    .slice(0, 3)
    .map((g) => ({
      id: g.id,
      name: g.name,
      steamAppId: g.steamAppId,
      sgdbId: g.sgdbId,
      sources: ['manual'],
      installed: false,
      included: true,
      status: 'ready',
      media: g.media,
      cover: g.cover,
      selectedAsset: g.selectedAsset,
      selectedCover: g.selectedCover,
      thumb: g.media.thumbnail,
      crop: { mode: 'inherit', x: 50, y: 50 }
    }));
  assert(games.length >= 2, 'Supply at least two prepared games with still artwork');
  for (const g of games) {
    for (const m of [g.media, g.cover])
      for (const k of ['file', 'sourceFile', 'thumbnail']) {
        if (!m[k]) continue;
        assert(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(m[k]));
        await fs.copyFile(path.join(sourceMedia, m[k]), path.join(dataDir, 'media', m[k]));
      }
    g.thumb = '/media/' + g.media.thumbnail;
  }
  const settings = {
    language: 'en',
    sceneDuration: 12,
    shuffle: false,
    showCover: true,
    coverPosition: 'beside-title',
    framing: 'original',
    smoothMotion: false
  };
  await fs.writeFile(
    path.join(dataDir, 'catalog.json'),
    JSON.stringify({ version: 1, games, settings })
  );
  // Local-only credential marker enables the existing controls; no live provider calls in this recording.
  await fs.writeFile(path.join(dataDir, 'steamgriddb.key'), 'isolated-recording-no-network-key');
  const core = createCore({ dataDir, steamRoots: [steamRoot], isGameRunning: async () => false });
  let server, browser;
  const errors = [],
    network = [],
    chapters = [];
  try {
    await core.invoke('state');
    server = await createServer({ dataDir, core });
    // A real window avoids Chrome's headless screencast clipping the lower 86 pixels.
    browser = await require('playwright').chromium.launch({ channel: 'chrome', headless: false });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 810 },
      deviceScaleFactor: 1,
      recordVideo: { dir: path.join(out, 'raw'), size: { width: 1440, height: 810 } }
    });
    await context.route('**/*', async (route) => {
      if (!route.request().url().startsWith(server.url)) {
        network.push(new URL(route.request().url()).hostname);
        return route.abort();
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    const hold = (ms) => page.waitForTimeout(ms);
    const start = Date.now();
    const mark = (title) => {
      chapters.push({ seconds: Number(((Date.now() - start) / 1000).toFixed(2)), title });
      console.log(title);
    };
    const playerCatalog = async () => {
      const s = await core.invoke('state');
      return {
        version: 1,
        settings: s.settings,
        games: s.games.map((g) => ({
          ...g,
          media: {
            ...g.media,
            file: '/media/' + g.media.file,
            thumbnail: '/media/' + g.media.thumbnail
          },
          cover: { ...g.cover, file: '/media/' + g.cover.file }
        }))
      };
    };
    await context.route('**/player/catalog.js', async (route) =>
      route.fulfill({
        contentType: 'application/javascript',
        body: 'window.SAS_CATALOG=' + JSON.stringify(await playerCatalog()) + ';'
      })
    );
    mark('Full-screen player — original size, full image');
    await page.goto(server.url + '/player/index.html');
    await page
      .locator('.scene.visible')
      .waitFor({ timeout: 15000 })
      .catch(() => page.locator('.scene').waitFor());
    await hold(1800);
    await page.screenshot({ path: path.join(images, 'screensaver.png') });
    await hold(7800);
    mark('Full-screen player — 16:9 crop, same animation');
    await core.invoke('settings', { framing: '16:9' });
    await page.evaluate(() =>
      window.SteamAnimatedScreensaverPlayer.setSettings({ framing: '16:9' })
    );
    await hold(1700);
    await page.screenshot({ path: path.join(images, 'screensaver-16x9.png') });
    await hold(6500);
    await core.invoke('settings', { framing: 'original' });
    mark('Library');
    await page.goto(server.url + '/manager/index.html');
    await page.locator('[data-route="library"]').first().click();
    await hold(5100);
    await page.screenshot({ path: path.join(images, 'library.png'), fullPage: true });
    await page.locator('.game-grid').scrollIntoViewIfNeeded();
    await hold(2000);
    mark('Game details — animation selection and crop');
    await page.locator('.game-visual[data-detail="' + games[0].id + '"]').click();
    await hold(1900);
    await page.screenshot({ path: path.join(images, 'game-settings.png') });
    await hold(1700);
    await page.locator('[data-crop-setting="mode"]').selectOption('16:9');
    await hold(1800);
    await page.locator('[data-crop-setting="mode"]').selectOption('16:10');
    await hold(1800);
    await page.locator('[data-crop-setting="mode"]').selectOption('inherit');
    await page.locator('.fixed-artwork').scrollIntoViewIfNeeded();
    await hold(2300);
    await page.locator('[data-action="close-detail"]').click();
    mark('Preview — move the still artwork');
    await page.locator('[data-route="preview"]').first().click();
    await hold(2000);
    await page.locator('[data-setting="coverPosition"]').scrollIntoViewIfNeeded();
    await hold(800);
    await page.locator('[data-setting="coverPosition"]').selectOption('top-right');
    await hold(2100);
    await page.locator('[data-setting="coverPosition"]').selectOption('bottom-right');
    await hold(2100);
    await page.locator('[data-setting="coverPosition"]').selectOption('beside-title');
    await page.locator('[data-setting="framing"]').selectOption('16:9');
    await hold(5100);
    await page.screenshot({ path: path.join(images, 'preview.png'), fullPage: true });
    mark('Settings — optional 24/30 fps processing');
    await page.locator('[data-route="settings"]').first().click();
    await page.locator('[data-setting="smoothMotion"]').scrollIntoViewIfNeeded();
    await hold(2200);
    await page.locator('[data-setting="smoothingFps"]').selectOption('24');
    await hold(1600);
    await page.locator('[data-setting="smoothingMode"]').selectOption('blend');
    await hold(5100);
    await page.screenshot({ path: path.join(images, 'processing.png') });
    await page.locator('[data-setting="smoothingFps"]').selectOption('30');
    await hold(1800);
    mark('Full-screen player — final result');
    await core.invoke('settings', { framing: 'original' });
    await page.goto(server.url + '/player/index.html');
    await hold(900);
    await page.evaluate(() => window.SteamAnimatedScreensaverPlayer.next());
    await hold(5600);
    const duration = (Date.now() - start) / 1000;
    const recording = page.video();
    await page.close();
    const videoPath = await recording.path();
    await fs.copyFile(videoPath, path.join(out, 'capture.webm'));
    await context.close();
    assert.deepEqual(errors, [], 'No browser errors during recording');
    assert.deepEqual(network, [], 'Recording must not request external services');
    assert.equal(hash(await fs.readFile(source)), hash(original), 'Source catalog unchanged');
    await fs.writeFile(
      path.join(out, 'CAPTURE.json'),
      JSON.stringify(
        {
          sourceVersion: require('../package.json').version,
          format:
            'Actual unmodified Manager/Player, isolated three-game catalog, copied existing local media; no live search/import/preparation or Steam activation claimed.',
          sourceCatalogUnchanged: true,
          credentialsRead: false,
          externalRequests: network,
          errors,
          duration,
          chapters,
          artwork: games.map((g) => ({
            game: g.name,
            animation: { artist: g.media.author?.name, url: g.media.sourceUrl },
            cover: { artist: g.cover.author?.name, url: g.cover.sourceUrl }
          }))
        },
        null,
        2
      ) + '\n'
    );
    console.log('Capture complete');
  } finally {
    await browser?.close();
    if (server) await server.close();
    else await core.close();
    await fs.rm(temp, { recursive: true, force: true });
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
