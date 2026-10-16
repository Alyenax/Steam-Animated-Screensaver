'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { existsSync } = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { install } = require('../core/installer.cjs');
let chromium, ffmpeg;
try {
  chromium = require('playwright').chromium;
  ffmpeg = require('ffmpeg-static');
} catch {}
const browserPath =
  process.env.SAS_TEST_BROWSER ||
  (chromium && existsSync(chromium.executablePath())
    ? chromium.executablePath()
    : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
test(
  'real browser plays offline, skips bad media, bounds decoders, pauses, resizes and destroys',
  { skip: !chromium || !ffmpeg || !existsSync(browserPath), timeout: 90000 },
  async (t) => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'screensaver-player-browser-'));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    for (const [name, args] of [
      [
        'scene.webm',
        [
          '-f',
          'lavfi',
          '-i',
          'testsrc=size=160x90:rate=12:duration=2',
          '-c:v',
          'libvpx-vp9',
          '-pix_fmt',
          'yuv420p'
        ]
      ],
      ['scene.gif', ['-f', 'lavfi', '-i', 'testsrc=size=160x90:rate=8:duration=2']],
      [
        'scene.webp',
        [
          '-f',
          'lavfi',
          '-i',
          'testsrc=size=160x90:rate=8:duration=2',
          '-c:v',
          'libwebp_anim',
          '-loop',
          '0'
        ]
      ],
      ['thumb.jpg', ['-f', 'lavfi', '-i', 'color=navy:size=160x90', '-frames:v', '1']],
      ['cover.jpg', ['-f', 'lavfi', '-i', 'testsrc=size=160x240', '-frames:v', '1']]
    ]) {
      const r = spawnSync(ffmpeg, ['-v', 'error', ...args, '-y', path.join(root, name)]);
      assert.equal(r.status, 0, r.stderr.toString());
    }
    const playerRoot = path.join(__dirname, '..', 'player');
    const server = http.createServer(async (req, res) => {
      try {
        const u = new URL(req.url, 'http://localhost'),
          p = u.pathname;
        if (p === '/preview.html') {
          res.setHeader('content-type', 'text/html');
          res.end(
            '<!doctype html><iframe title="preview" src="/player/index.html" style="position:fixed;inset:0;width:100%;height:100%;border:0"></iframe>'
          );
          return;
        }
        if (p === '/player/catalog.js') {
          res.setHeader('content-type', 'text/javascript');
          res.end('window.SAS_CATALOG={version:1,games:[],settings:{}};');
          return;
        }
        const files = {
          '/player/index.html': ['index.html', 'text/html'],
          '/player/player.js': ['player.js', 'text/javascript'],
          '/player/player.css': ['player.css', 'text/css'],
          '/media/scene.webm': [path.join(root, 'scene.webm'), 'video/webm'],
          '/media/thumb.jpg': [path.join(root, 'thumb.jpg'), 'image/jpeg'],
          '/media/cover.jpg': [path.join(root, 'cover.jpg'), 'image/jpeg'],
          '/media/scene.gif': [path.join(root, 'scene.gif'), 'image/gif'],
          '/media/scene.webp': [path.join(root, 'scene.webp'), 'image/webp']
        };
        const item = files[p];
        if (!item) {
          res.writeHead(404);
          res.end();
          return;
        }
        res.setHeader('content-type', item[1]);
        res.end(
          await fs.readFile(path.isAbsolute(item[0]) ? item[0] : path.join(playerRoot, item[0]))
        );
      } catch {
        res.writeHead(500);
        res.end();
      }
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(
      () =>
        new Promise((resolve) => {
          server.closeAllConnections();
          server.close(resolve);
        })
    );
    const origin = `http://127.0.0.1:${server.address().port}`;
    const browser = await chromium.launch({
      executablePath: browserPath,
      headless: true,
      args: ['--autoplay-policy=no-user-gesture-required']
    });
    t.after(() => browser.close());
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const requests = [];
    page.on('request', (r) => requests.push(r.url()));
    await page.goto(`${origin}/preview.html`);
    const frame = page.frames().find((f) => f.url().includes('/player/index.html'));
    await frame.waitForFunction(() => !!window.SteamAnimatedScreensaverPlayer);
    assert.equal(
      await frame.locator('#empty').isVisible(),
      false,
      'Preview waits silently for its parent catalog'
    );
    const makeGame = (id, media = '/media/scene.webm') => ({
      id,
      name: `Game ${id}`,
      included: true,
      status: 'ready',
      cover: { file: '/media/cover.jpg', animated: false, author: { name: 'Cover creator' } },
      media: {
        file: media,
        thumbnail: '/media/thumb.jpg',
        format: 'webm',
        animated: true,
        author: { name: 'Test artist' }
      }
    });
    page.setDefaultTimeout(8000);
    const send = async (data) =>
      page.evaluate(
        (data) =>
          document
            .querySelector('iframe')
            .contentWindow.postMessage({ type: 'screensaver', ...data }, location.origin),
        data
      );
    await send({
      action: 'catalog',
      catalog: {
        version: 1,
        games: [makeGame('one'), makeGame('two'), makeGame('three')],
        settings: { shuffle: false, sceneDuration: 8, reducedMotion: true }
      }
    });
    await frame.waitForFunction(
      () => document.querySelector('.scene.visible video')?.currentTime > 0.1
    );
    assert.equal(await frame.locator('#empty').isVisible(), false);
    await frame.waitForFunction(
      () => document.querySelector('.scene.visible .caption-cover')?.naturalWidth > 0
    );
    assert.equal(await frame.locator('.scene.visible .eyebrow').count(), 0);
    assert.match(
      await frame.locator('.scene.visible .cover-credit').textContent(),
      /Cover creator/
    );
    await send({ action: 'pause' });
    for (const [width, height] of [
      [1280, 720],
      [1920, 1080],
      [3840, 2160],
      [800, 1280],
      [390, 844]
    ]) {
      await page.setViewportSize({ width, height });
      for (const framing of ['16:9', '16:10', 'original']) {
        await send({ action: 'settings', settings: { framing } });
        await frame.waitForFunction(
          (mode) => document.querySelector('.scene.visible')?.dataset.framing === mode,
          framing
        );
        const actual = await frame.evaluate(() => {
          const scene = document.querySelector('.scene.visible'),
            r = scene.querySelector('.art-frame').getBoundingClientRect();
          return {
            width: r.width,
            height: r.height,
            left: r.left,
            top: r.top,
            fit: getComputedStyle(scene.querySelector('.artwork')).objectFit,
            screenWidth: innerWidth,
            screenHeight: innerHeight
          };
        });
        assert(actual.left >= -0.1 && actual.top >= -0.1);
        assert(
          actual.width <= actual.screenWidth + 0.1 && actual.height <= actual.screenHeight + 0.1
        );
        assert.equal(actual.fit, framing === 'original' ? 'contain' : 'cover');
        if (framing !== 'original')
          assert(
            Math.abs(actual.width / actual.height - (framing === '16:9' ? 16 / 9 : 16 / 10)) < 0.003
          );
      }
      for (const coverPosition of ['beside-title', 'bottom-right', 'top-right', 'top-left']) {
        await send({ action: 'settings', settings: { coverPosition } });
        await frame.waitForFunction(
          (position) => document.querySelector('.scene.visible').dataset.coverPosition === position,
          coverPosition
        );
        const boxes = await frame.evaluate(() => {
          const scene = document.querySelector('.scene.visible');
          const rect = (selector) => {
            const r = scene.querySelector(selector).getBoundingClientRect();
            return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
          };
          return {
            cover: rect('.caption-cover'),
            caption: rect('.caption'),
            title: rect('h1'),
            width: innerWidth,
            height: innerHeight
          };
        });
        const { cover, caption, title } = boxes,
          x = boxes.width * 0.056,
          y = boxes.height * 0.07;
        assert(Math.abs(caption.left - x) < 1);
        assert(Math.abs(boxes.height - caption.bottom - y) < 1);
        if (coverPosition.endsWith('right')) assert(Math.abs(boxes.width - cover.right - x) < 1);
        else assert(Math.abs(cover.left - x) < 1);
        if (coverPosition.startsWith('top')) assert(Math.abs(cover.top - y) < 1);
        else assert(Math.abs(boxes.height - cover.bottom - y) < 1);
        if (coverPosition === 'beside-title') assert(title.left > cover.right);
        if (coverPosition === 'bottom-right') assert(title.right < cover.left);
      }
    }
    await page.setViewportSize({ width: 1280, height: 720 });
    await send({ action: 'settings', settings: { showCover: false, showLogos: true } });
    await frame.waitForFunction(
      () => document.querySelector('.scene.visible .caption-cover').hidden
    );
    assert.equal(await frame.locator('.scene.visible .credit').first().isVisible(), true);
    await send({
      action: 'settings',
      settings: { showCover: true, showLogos: false, coverPosition: 'beside-title' }
    });
    await frame.waitForFunction(
      () =>
        !document.querySelector('.scene.visible .caption-cover').hidden &&
        document.querySelector('.scene.visible h1').hidden
    );
    await send({ action: 'settings', settings: { showLogos: true } });
    await send({ action: 'pause' });
    await frame.waitForFunction(() => document.querySelector('video').paused);
    const paused = await frame.locator('video').evaluate((v) => v.currentTime);
    await page.waitForTimeout(180);
    assert(Math.abs((await frame.locator('video').evaluate((v) => v.currentTime)) - paused) < 0.05);
    await send({ action: 'next' });
    await frame.waitForFunction(
      () => document.querySelector('.scene.visible h1')?.textContent === 'Game two'
    );
    await send({ action: 'previous' });
    await frame.waitForFunction(
      () => document.querySelector('.scene.visible h1')?.textContent === 'Game one'
    );
    await send({ action: 'settings', settings: { reducedMotion: false, transition: 'crossfade' } });
    await send({ action: 'next' });
    await frame.waitForFunction(
      () => document.querySelector('.scene.visible h1')?.textContent === 'Game two'
    );
    assert((await frame.locator('video').count()) <= 2);
    await page.waitForTimeout(1300);
    assert.equal(await frame.locator('video').count(), 1);
    await send({ action: 'settings', settings: { transition: 'fade-black' } });
    await send({ action: 'next' });
    await frame.waitForFunction(
      () => document.querySelector('.scene.visible h1')?.textContent === 'Game three'
    );
    assert((await frame.locator('video').count()) <= 2);
    await page.waitForTimeout(1300);
    assert.equal(await frame.locator('video').count(), 1);
    await send({ action: 'settings', settings: { reducedMotion: true } });
    // Rapid preview navigation must release pending decoders as well as retiring scenes.
    for (let i = 0; i < 12; i++) await send({ action: 'next' });
    assert((await frame.locator('video').count()) <= 2);
    await send({ action: 'play' });
    await frame.waitForFunction(
      () => document.querySelector('.scene.visible video')?.paused === false
    );
    await page.setViewportSize({ width: 800, height: 1280 });
    assert.equal(
      await frame
        .locator('.scene.visible .artwork')
        .evaluate((el) => getComputedStyle(el).objectFit),
      'contain'
    );
    await send({
      action: 'catalog',
      catalog: {
        version: 1,
        games: [makeGame('broken', '/media/missing.webm'), makeGame('working')],
        settings: { shuffle: false, reducedMotion: true, framing: '16:9' }
      }
    });
    await frame.waitForFunction(
      () => document.querySelector('.scene.visible h1')?.textContent === 'Game working'
    );
    await send({
      action: 'catalog',
      catalog: {
        version: 1,
        games: [makeGame('broken', '/media/missing.webm')],
        settings: { shuffle: false }
      }
    });
    await frame.waitForFunction(() => !document.querySelector('#empty').hidden);
    assert.match(await frame.locator('#empty h1').textContent(), /unavailable/);
    const staticGame = makeGame('static', '/media/thumb.jpg');
    staticGame.media.format = 'jpg';
    staticGame.media.animated = false;
    await send({
      action: 'catalog',
      catalog: {
        version: 1,
        games: [staticGame],
        settings: { shuffle: false, staticFallback: true, reducedMotion: false }
      }
    });
    await frame.waitForFunction(
      () => document.querySelector('.scene.visible img.artwork')?.naturalWidth > 0
    );
    await send({ action: 'pause' });
    await frame.waitForFunction(
      () =>
        getComputedStyle(document.querySelector('.scene.visible .artwork')).animationPlayState ===
        'paused'
    );
    const pausedTransform = await frame
      .locator('.scene.visible .artwork')
      .evaluate((el) => getComputedStyle(el).transform);
    await page.waitForTimeout(180);
    assert.equal(
      await frame
        .locator('.scene.visible .artwork')
        .evaluate((el) => getComputedStyle(el).transform),
      pausedTransform
    );
    await send({ action: 'play' });
    await frame.waitForFunction(
      () =>
        getComputedStyle(document.querySelector('.scene.visible .artwork')).animationPlayState ===
        'running'
    );
    // Native GIF/WebP animation must really stop, not merely pause playlist rotation.
    for (const format of ['gif', 'webp']) {
      const game = makeGame(`native-${format}`, `/media/scene.${format}`);
      game.media.format = format;
      await send({
        action: 'catalog',
        catalog: { version: 1, games: [game], settings: { shuffle: false, reducedMotion: true } }
      });
      await frame.waitForFunction(
        () => document.querySelector('.scene.visible img.artwork')?.naturalWidth > 0
      );
      const movingA = await frame.locator('#stage').screenshot();
      await page.waitForTimeout(350);
      const movingB = await frame.locator('#stage').screenshot();
      assert(!movingA.equals(movingB), `${format} must animate before pause`);
      await send({ action: 'pause' });
      await frame.waitForFunction(
        () =>
          document.querySelectorAll('.frozen-artwork').length === 1 &&
          !document.querySelector('img.artwork').hasAttribute('src')
      );
      const stillA = await frame.locator('#stage').screenshot();
      await page.waitForTimeout(420);
      const stillB = await frame.locator('#stage').screenshot();
      assert(stillA.equals(stillB), `${format} pixels must remain identical while paused`);
      assert.equal(await frame.locator('#empty').isVisible(), false);
      await send({ action: 'play' });
      await frame.waitForFunction(
        () =>
          document.querySelectorAll('.frozen-artwork').length === 0 &&
          document.querySelector('img.artwork')?.naturalWidth > 0
      );
      const resumedA = await frame.locator('#stage').screenshot();
      await page.waitForTimeout(350);
      const resumedB = await frame.locator('#stage').screenshot();
      assert(!resumedA.equals(resumedB), `${format} must animate after resume`);
      for (let i = 0; i < 3; i++) {
        await send({ action: 'pause' });
        await frame.waitForFunction(
          () => document.querySelectorAll('.frozen-artwork').length === 1
        );
        await send({ action: 'play' });
        await frame.waitForFunction(
          () => document.querySelectorAll('.frozen-artwork').length === 0
        );
      }
    }
    await send({ action: 'pause' });
    await frame.waitForFunction(() => document.querySelectorAll('.frozen-artwork').length === 1);
    assert(
      requests.every((u) => u.startsWith(origin)),
      JSON.stringify(requests)
    );
    const portrait = {
      ...makeGame('portrait'),
      crop: { mode: '16:9', x: 50, y: 0 },
      media: {
        ...makeGame('portrait').media,
        file: '/media/cover.jpg',
        format: 'jpg',
        width: 160,
        height: 240,
        animated: false
      }
    };
    await send({
      action: 'catalog',
      catalog: {
        version: 1,
        games: [portrait],
        settings: {
          staticFallback: true,
          reducedMotion: true,
          framing: '16:10',
          showCover: false,
          showLogos: false
        }
      }
    });
    await frame.waitForFunction(
      () => document.querySelector('.scene.visible img.artwork')?.naturalWidth === 160
    );
    await frame.waitForFunction(
      () => document.querySelector('.scene.visible')?.dataset.framing === '16:9'
    );
    const topCrop = await frame.locator('.art-frame').screenshot();
    portrait.crop.y = 100;
    await send({
      action: 'catalog',
      catalog: {
        version: 1,
        games: [portrait],
        settings: {
          staticFallback: true,
          reducedMotion: true,
          framing: '16:10',
          showCover: false,
          showLogos: false
        }
      }
    });
    await frame.waitForFunction(
      () => document.querySelector('.scene.visible img.artwork')?.naturalWidth === 160
    );
    await frame.waitForFunction(
      () =>
        getComputedStyle(document.querySelector('.scene.visible .artwork')).objectPosition ===
        '50% 100%'
    );
    const bottomCrop = await frame.locator('.art-frame').screenshot();
    assert(
      !topCrop.equals(bottomCrop),
      'changing focal position must change the actual visible pixels of a static portrait source'
    );
    await frame.evaluate(() => window.SteamAnimatedScreensaverPlayer.destroy());
    assert.equal(await frame.locator('video').count(), 0);
    assert.equal(await frame.locator('.scene').count(), 0);
    assert.equal(await frame.locator('canvas').count(), 0);
    // Exercise the actual installer and direct file:// host, with no HTTP server dependencies.
    const dataDir = path.join(root, 'offline-data'),
      steamRoot = path.join(root, 'steam');
    await fs.mkdir(path.join(dataDir, 'media'), { recursive: true });
    await fs.mkdir(steamRoot);
    for (const file of ['scene.webm', 'thumb.jpg', 'cover.jpg'])
      await fs.copyFile(path.join(root, file), path.join(dataDir, 'media', file));
    const game = makeGame('offline');
    game.cover.file = 'cover.jpg';
    game.media.file = 'scene.webm';
    game.media.thumbnail = 'thumb.jpg';
    game.crop = { mode: '16:10', x: 12, y: 82 };
    const installed = await install({
      dataDir,
      steamRoot,
      games: [game],
      settings: { shuffle: false, reducedMotion: true }
    });
    const offlinePage = await browser.newPage();
    await offlinePage.bringToFront();
    offlinePage.setDefaultTimeout(8000);
    const offlineRequests = [];
    offlinePage.on('request', (r) => offlineRequests.push(r.url()));
    await offlinePage.goto(pathToFileURL(path.join(installed.path, 'index.html')).href);
    await offlinePage.waitForFunction(
      () => document.querySelector('.scene.visible video')?.currentTime > 0.1,
      {},
      { timeout: 8000 }
    );
    assert.equal(await offlinePage.locator('#empty').isVisible(), false);
    await offlinePage.waitForFunction(
      () => document.querySelector('.scene.visible')?.dataset.framing === '16:10'
    );
    assert.equal(
      await offlinePage
        .locator('.scene.visible .artwork')
        .evaluate((el) => getComputedStyle(el).objectPosition),
      '12% 82%'
    );
    await offlinePage.waitForFunction(
      () => document.querySelector('.scene.visible .caption-cover')?.naturalWidth === 160
    );
    assert(
      offlineRequests.every((u) => u.startsWith('file://')),
      JSON.stringify(offlineRequests)
    );
    assert.equal(await offlinePage.locator('video').evaluate((v) => v.error), null);
    await offlinePage.close();
  }
);
