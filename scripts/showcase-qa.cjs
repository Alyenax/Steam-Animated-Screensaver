'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { serve, exportSite } = require('./showcase-preview.cjs');
async function main() {
  const exported = await exportSite();
  const server = await serve({ recordUrl: false });
  let browser;
  const errors = [],
    checks = [];
  try {
    browser = await require('playwright').chromium.launch({ channel: 'chrome', headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(server.url);
    await page.waitForFunction(() => document.querySelector('video').readyState >= 1);
    const metadata = await page
      .locator('video')
      .evaluate((v) => ({ duration: v.duration, width: v.videoWidth, height: v.videoHeight }));
    assert(metadata.duration > 88 && metadata.duration < 90);
    assert.equal(metadata.width, 1920);
    assert.equal(metadata.height, 1080);
    await page.locator('[data-time="79"]').click();
    await page.waitForFunction(() => document.querySelector('video').currentTime > 79.2);
    assert.equal(await page.locator('video').evaluate((v) => v.error), null);
    await page.locator('video').evaluate((v) => v.pause());
    checks.push(
      'Final MP4 loads, plays with browser controls and seeks to actual Mac Steam playback'
    );
    await page.screenshot({
      path: path.resolve(__dirname, '../dist/showcase-demo-review.png'),
      fullPage: true
    });
    await page.goto(server.url + 'readme.html');
    await page.evaluate(() =>
      document.querySelectorAll('img').forEach((img) => (img.loading = 'eager'))
    );
    await page.waitForFunction(() =>
      [...document.images].every((img) => img.complete && img.naturalWidth > 0)
    );
    assert.equal(await page.locator('article img').count(), 6);
    assert.equal(
      await page.locator('article img').first().getAttribute('src'),
      'screenshots/public/screensaver-demo.gif'
    );
    const gifResponse = await fetch(server.url + 'screenshots/public/screensaver-demo.gif');
    assert.equal(gifResponse.headers.get('content-type'), 'image/gif');
    assert.equal(
      Buffer.from(await gifResponse.arrayBuffer())
        .subarray(0, 6)
        .toString(),
      'GIF89a'
    );
    assert(
      (await page.locator('article').innerText()).includes(
        'Big Picture → Settings → Customization → Screensavers'
      )
    );
    assert((await page.locator('article').innerText()).includes('5 minutes'));
    checks.push(
      'Actual README opens with the animated GIF, renders all six images and includes complete Steam activation and five-minute instructions'
    );
    await page.screenshot({
      path: path.resolve(__dirname, '../dist/readme-review.png'),
      fullPage: true
    });
    await page.goto(server.url + 'changelog.html');
    assert.equal(await page.locator('article ol > li').count(), 4);
    assert((await page.locator('article').innerText()).includes('Quit Steam completely'));
    checks.push(
      'Actual changelog renders its four activation steps, including Steam selection, quit/apply and restart'
    );
    await page.goto(server.url + 'steamos.html');
    await page.waitForFunction(() => document.querySelector('video').readyState >= 2);
    const steamOSDuration = await page.locator('video').evaluate((v) => v.duration);
    assert(steamOSDuration > 78 && steamOSDuration < 80);
    assert((await page.locator('main').innerText()).includes('not a native SteamOS'));
    checks.push(
      'SteamOS overview loads its 79-second video and clearly discloses macOS app capture'
    );
    for (const width of [1440, 800, 390]) {
      await page.setViewportSize({ width, height: 950 });
      for (const route of [
        '',
        'readme.html',
        'changelog.html',
        'reddit-en.html',
        'reddit-fr.html',
        'steamos.html',
        'reddit-steamos-en.html',
        'reddit-steamos-fr.html'
      ]) {
        await page.goto(server.url + route);
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
          false,
          `${route} at ${width}`
        );
      }
    }
    checks.push(
      'Both demos, README, changelog and all four Reddit drafts have no horizontal overflow at 1440, 800 and 390px'
    );
    for (const file of [
      'index.html',
      'readme.html',
      'changelog.html',
      'showcase.css',
      'showcase.js',
      'Steam-Animated-Screensaver-demo.mp4',
      'Steam-Animated-Screensaver-SteamOS-overview.mp4',
      'steamos.html'
    ])
      await fs.access(path.join(exported, file));
    assert(
      (await fs.readFile(path.join(exported, 'index.html'), 'utf8')).includes(
        'src="Steam-Animated-Screensaver-demo.mp4"'
      )
    );
    assert.equal((await fetch(server.url + 'core/index.cjs')).status, 404);
    assert.equal((await fetch(server.url + 'steamgriddb.key')).status, 404);
    assert.deepEqual(errors, []);
    checks.push(
      'Static export contains video and rendered documents; local preview does not serve app code or keys'
    );
    const report = {
      version: require('../package.json').version,
      result: 'passed',
      video: metadata,
      checks,
      pageErrors: errors,
      publicHostingEnabled: false
    };
    await fs.writeFile(
      path.resolve(__dirname, '../dist/SHOWCASE_VALIDATION.json'),
      JSON.stringify(report, null, 2) + '\n'
    );
    console.log(JSON.stringify(report));
  } finally {
    await browser?.close();
    await server.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
