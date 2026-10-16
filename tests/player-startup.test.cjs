'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const { install } = require('../core/installer.cjs');
const chromium = require('playwright').chromium;
const browserPath =
  process.env.SAS_TEST_BROWSER ||
  (existsSync(chromium.executablePath())
    ? chromium.executablePath()
    : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
test(
  'standalone startup never shows an intro while catalog/media are delayed; the first decoded frame appears directly',
  { skip: !existsSync(browserPath), timeout: 30000 },
  async (t) => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sas-player-startup-'));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    const dataDir = path.join(root, 'data'),
      steamRoot = path.join(root, 'Steam');
    await fs.mkdir(path.join(dataDir, 'media'), { recursive: true });
    await fs.mkdir(steamRoot);
    const tool = require('ffmpeg-static');
    execFileSync(tool, [
      '-v',
      'error',
      '-f',
      'lavfi',
      '-i',
      'testsrc=size=160x90:rate=6:duration=1',
      '-y',
      path.join(dataDir, 'media', 'animation.gif')
    ]);
    execFileSync(tool, [
      '-v',
      'error',
      '-f',
      'lavfi',
      '-i',
      'color=navy:size=160x90',
      '-frames:v',
      '1',
      '-y',
      path.join(dataDir, 'media', 'thumb.jpg')
    ]);
    const game = {
      id: 'steam:1',
      name: 'Startup QA game',
      included: true,
      status: 'ready',
      media: {
        file: 'animation.gif',
        thumbnail: 'thumb.jpg',
        animated: true,
        format: 'gif',
        width: 160,
        height: 90,
        author: { name: 'Original QA' }
      }
    };
    let installed, allowCatalog;
    const server = http.createServer(async (req, res) => {
      try {
        const name = new URL(req.url, 'http://localhost').pathname.slice(1);
        if (
          ![
            'index.html',
            'player.css',
            'player.js',
            'catalog.js',
            'media/animation.gif',
            'media/thumb.jpg'
          ].includes(name)
        ) {
          res.writeHead(404);
          res.end();
          return;
        }
        if (name === 'catalog.js')
          await new Promise((resolve) => {
            allowCatalog = resolve;
          });
        if (name === 'media/animation.gif')
          await new Promise((resolve) => setTimeout(resolve, 600));
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader(
          'Content-Type',
          name.endsWith('.js')
            ? 'text/javascript'
            : name.endsWith('.css')
              ? 'text/css'
              : name.endsWith('.gif')
                ? 'image/gif'
                : name.endsWith('.jpg')
                  ? 'image/jpeg'
                  : 'text/html'
        );
        res.end(await fs.readFile(path.join(installed.path, name)));
      } catch {
        res.writeHead(500);
        res.end();
      }
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(
      () =>
        new Promise((resolve) => {
          allowCatalog?.();
          server.closeAllConnections();
          server.close(resolve);
        })
    );
    const browser = await require('playwright').chromium.launch({
      executablePath: browserPath,
      headless: true
    });
    t.after(() => browser.close());
    const page = await browser.newPage();
    await page.addInitScript(() => {
      window.__sawPresentation = false;
      const sample = () => {
        const empty = document.querySelector('#empty');
        if (empty && !empty.hidden && empty.getBoundingClientRect().width > 0)
          window.__sawPresentation = true;
        const first = document.querySelector('.scene.visible');
        if (first && window.__firstOpacity === undefined)
          window.__firstOpacity = Number(getComputedStyle(first).opacity);
        if (window.__firstOpacity === undefined) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    for (const language of ['en', 'fr']) {
      installed = await install({
        dataDir,
        steamRoot,
        games: [game],
        settings: { language, shuffle: false }
      });
      allowCatalog = null;
      await page.goto(`http://127.0.0.1:${server.address().port}/index.html`, {
        waitUntil: 'commit'
      });
      await page.locator('#empty').waitFor({ state: 'attached' });
      assert.equal(await page.locator('#empty').isVisible(), false);
      assert.equal(
        await page.evaluate(() => typeof window.SteamAnimatedScreensaverPlayer),
        'undefined'
      );
      while (!allowCatalog) await new Promise((resolve) => setTimeout(resolve, 5));
      allowCatalog();
      await page.waitForFunction(
        () => !!window.SteamAnimatedScreensaverPlayer && !!document.querySelector('.scene')
      );
      assert.equal(await page.locator('#empty').isVisible(), false);
      assert.equal(await page.locator('.scene.visible').count(), 0);
      await page.waitForFunction(() => window.__firstOpacity !== undefined);
      assert.equal(await page.evaluate(() => window.__sawPresentation), false, language);
      assert.equal(
        await page.evaluate(() => window.__firstOpacity),
        1,
        'First frame must not wait for an introductory fade'
      );
      assert.equal(await page.locator('.scene.visible h1').innerText(), 'Startup QA game');
    }
  }
);
