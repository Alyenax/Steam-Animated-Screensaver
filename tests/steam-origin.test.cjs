'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { existsSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const https = require('node:https');
const { execFileSync, spawnSync } = require('node:child_process');
const { install, NAME } = require('../core/installer.cjs');
let chromium, ffmpeg;
try {
  chromium = require('playwright').chromium;
  ffmpeg = require('ffmpeg-static');
} catch {}
const browserPath =
  process.env.CINEMA_TEST_BROWSER ||
  (chromium && existsSync(chromium.executablePath())
    ? chromium.executablePath()
    : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
test(
  'export loads on a mapped HTTPS steamscreensavers.host origin with same-origin scripts/media',
  {
    skip:
      !chromium ||
      !ffmpeg ||
      !existsSync(browserPath) ||
      spawnSync('openssl', ['version']).status !== 0,
    timeout: 25000
  },
  async (t) => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cinema-steam-origin-'));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    const dataDir = path.join(root, 'data'),
      steamRoot = path.join(root, 'steam');
    await fs.mkdir(path.join(dataDir, 'media'), { recursive: true });
    await fs.mkdir(steamRoot);
    execFileSync(ffmpeg, [
      '-v',
      'error',
      '-f',
      'lavfi',
      '-i',
      'testsrc=size=160x90:rate=8:duration=2',
      '-c:v',
      'libvpx-vp9',
      '-pix_fmt',
      'yuv420p',
      '-y',
      path.join(dataDir, 'media', 'scene.webm')
    ]);
    execFileSync(ffmpeg, [
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
      id: 'steam:620',
      name: 'Original HTTPS test clip',
      included: true,
      status: 'ready',
      media: {
        file: 'scene.webm',
        thumbnail: 'thumb.jpg',
        width: 160,
        height: 90,
        format: 'webm',
        duration: 2,
        animated: true,
        author: { name: 'QA' }
      }
    };
    const installed = await install({
      dataDir,
      steamRoot,
      games: [game],
      settings: { shuffle: false, reducedMotion: true }
    });
    const hostname = `uioverride-${NAME}.steamscreensavers.host`;
    const key = path.join(root, 'key.pem'),
      certificate = path.join(root, 'certificate.pem');
    // Ephemeral loopback-only test certificate. No production TLS settings are changed.
    execFileSync(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-days',
        '1',
        '-subj',
        `/CN=${hostname}`,
        '-keyout',
        key,
        '-out',
        certificate
      ],
      { stdio: 'ignore' }
    );
    const requests = [],
      allowed = new Set([
        'index.html',
        'catalog.js',
        'player.js',
        'player.css',
        'media/scene.webm',
        'media/thumb.jpg'
      ]);
    const server = https.createServer(
      { key: await fs.readFile(key), cert: await fs.readFile(certificate) },
      async (req, res) => {
        try {
          const relative = decodeURIComponent(
            new URL(req.url, 'https://test.invalid').pathname
          ).slice(1);
          requests.push(relative);
          if (!allowed.has(relative)) {
            res.writeHead(404);
            return res.end();
          }
          const type = relative.endsWith('.html')
            ? 'text/html'
            : relative.endsWith('.js')
              ? 'text/javascript'
              : relative.endsWith('.css')
                ? 'text/css'
                : relative.endsWith('.webm')
                  ? 'video/webm'
                  : 'image/jpeg';
          res.setHeader('Content-Type', type);
          res.end(await fs.readFile(path.join(installed.path, relative)));
        } catch {
          res.writeHead(500);
          res.end();
        }
      }
    );
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(
      () =>
        new Promise((resolve) => {
          server.closeAllConnections();
          server.close(resolve);
        })
    );
    const browser = await chromium.launch({
      executablePath: browserPath,
      headless: true,
      args: [
        `--host-resolver-rules=MAP ${hostname} 127.0.0.1`,
        '--no-proxy-server',
        '--autoplay-policy=no-user-gesture-required'
      ]
    });
    t.after(() => browser.close());
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    page.setDefaultTimeout(10000);
    const origin = `https://${hostname}:${server.address().port}`,
      outside = [],
      errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/*', (route) => {
      if (new URL(route.request().url()).origin === origin) return route.continue();
      outside.push(route.request().url());
      return route.abort();
    });
    await page.goto(`${origin}/index.html`);
    await page.waitForFunction(
      () => document.querySelector('.scene.visible video')?.currentTime > 0.1
    );
    assert.equal(await page.locator('#empty').isVisible(), false);
    assert.deepEqual(errors, []);
    assert.deepEqual(outside, []);
    for (const file of ['index.html', 'catalog.js', 'player.js', 'player.css', 'media/scene.webm'])
      assert(requests.includes(file), file);
  }
);
