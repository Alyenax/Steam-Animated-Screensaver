'use strict';
// Record the actual standalone Player with the prepared catalog, using the native Mac recorder.
const fs = require('node:fs/promises'),
  path = require('node:path'),
  assert = require('node:assert/strict'),
  vm = require('node:vm');
const { spawn, execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..'),
  out = path.join(root, 'dist/public-launch-v2'),
  data = path.join(out, 'live-data');
const ids = [1245620, 1091500, 553850, 1174180, 632470, 322330, 359550, 1086940, 550, 1808500];
const bundle = path.join(out, 'Steam Animated Screensaver Demo.app'),
  recorder = path.join(out, 'capture-window');
const { smoothingMatches } = require('../core/smoothing.cjs');
async function main() {
  console.log('Waiting for the actual 30 fps preparation to finish...');
  const deadline = Date.now() + 20 * 60 * 1000;
  while (
    !(await fs.access(path.join(out, 'SMOOTHING_VALIDATION.json')).then(
      () => true,
      () => false
    ))
  ) {
    if (Date.now() > deadline) throw Error('Preparation report missing');
    await new Promise((r) => setTimeout(r, 1000));
  }
  const saved = JSON.parse(await fs.readFile(path.join(data, 'catalog.json'), 'utf8'));
  const games = ids.map((id) => {
    const g = saved.games.find((g) => g.steamAppId === id);
    assert(g?.status === 'ready');
    const m =
      saved.settings.smoothMotion && smoothingMatches(g.smoothed, saved.settings)
        ? g.smoothed
        : g.media;
    return {
      ...g,
      media: { ...m, file: '/media/' + m.file, thumbnail: '/media/' + m.thumbnail },
      cover: g.cover ? { ...g.cover, file: '/media/' + g.cover.file } : null
    };
  });
  const catalog = {
    version: 1,
    games,
    settings: { ...saved.settings, framing: 'original', shuffle: false, sceneDuration: 180 }
  };
  const catalogPath = path.join(bundle, 'Contents/Resources/app/player/catalog.js');
  await fs.writeFile(catalogPath, 'window.SAS_CATALOG=' + JSON.stringify(catalog) + ';\n');
  execFileSync('codesign', ['--force', '--sign', '-', '--timestamp=none', bundle], {
    stdio: 'pipe'
  });
  let app, record;
  const errors = [],
    segments = [];
  let start;
  try {
    app = await require('playwright')._electron.launch({
      executablePath: path.join(bundle, 'Contents/MacOS/steam-animated-screensaver'),
      args: ['--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
      env: { ...process.env, SAS_DATA_DIR: data },
      timeout: 30000
    });
    const page = await app.firstWindow();
    page.on('pageerror', (e) => errors.push(e.message));
    await app.evaluate(({ app, BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows()[0];
      w.webContents.setBackgroundThrottling(false);
      w.setContentSize(1280, 720);
      w.center();
      w.show();
      w.focus();
      app.focus({ steal: true });
    });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await page.goto('app://screensaver/player/index.html');
    await page.locator('.scene.visible h1').waitFor();
    assert.equal(await page.evaluate(() => document.visibilityState), 'visible');
    const line = execFileSync(recorder, ['--list'], { encoding: 'utf8' })
      .split('\n')
      .find(
        (l) =>
          l.includes('io.github.alyenax.sas.capture') && l.includes('Steam Animated Screensaver |')
      );
    assert(line);
    const windowId = Number(line.split(' | ')[0]);
    const target = path.join(out, 'showcase-final.mp4');
    await fs.rm(target, { force: true });
    record = spawn(recorder, [String(windowId), target, '0'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    await new Promise((resolve, reject) => {
      record.once('error', reject);
      record.once('exit', (code) => reject(Error('Recorder exit ' + code)));
      record.stdout.on('data', (b) => {
        const m = String(b).match(/RECORDING ([0-9.]+)/);
        if (m) {
          start = Number(m[1]);
          resolve();
        }
      });
    });
    const mark = async (g, framing) => {
      const scene = await page.evaluate(() => {
        const s = [...document.querySelectorAll('.scene.visible')].at(-1);
        const r = s.querySelector('.art-frame').getBoundingClientRect();
        return {
          title: s.querySelector('h1').textContent,
          framing: s.dataset.framing,
          objectFit: getComputedStyle(s.querySelector('.artwork')).objectFit,
          frame: { width: r.width, height: r.height },
          visibility: document.visibilityState
        };
      });
      assert.equal(scene.title, g.name);
      assert.equal(scene.framing, framing);
      assert.equal(scene.visibility, 'visible');
      if (framing === '16:9')
        assert(Math.abs(scene.frame.width / scene.frame.height - 16 / 9) < 0.001);
      const s = {
        game: g.name,
        framing,
        start: Number((Date.now() / 1000 - start).toFixed(3)),
        ...scene
      };
      segments.push(s);
      console.log(g.name + ' ' + framing);
      return s;
    };
    const shot = async (name) => page.screenshot({ path: path.join(out, name + '.png') });
    const first = await mark(games[0], 'original');
    await page.waitForTimeout(4800);
    first.end = Number((Date.now() / 1000 - start).toFixed(3));
    await shot('hero-original');
    await page.evaluate(() =>
      window.SteamAnimatedScreensaverPlayer.setSettings({ framing: '16:9' })
    );
    await page.waitForTimeout(350);
    const crop = await mark(games[0], '16:9');
    await page.waitForTimeout(4800);
    crop.end = Number((Date.now() / 1000 - start).toFixed(3));
    await shot('hero-16x9');
    for (let i = 1; i < games.length; i++) {
      const framing = [4, 7].includes(i) ? 'original' : '16:9';
      await page.evaluate((framing) => {
        window.SteamAnimatedScreensaverPlayer.setSettings({ framing });
        window.SteamAnimatedScreensaverPlayer.next();
      }, framing);
      await page.waitForFunction(
        (name) =>
          [...document.querySelectorAll('.scene.visible')].at(-1)?.querySelector('h1')
            ?.textContent === name,
        games[i].name
      );
      await page.waitForTimeout(1500);
      const segment = await mark(games[i], framing);
      await page.waitForTimeout(4700);
      segment.end = Number((Date.now() / 1000 - start).toFixed(3));
    }
    await new Promise((resolve, reject) => {
      record.once('exit', (code) =>
        code === 0 ? resolve() : reject(Error('Recorder exit ' + code))
      );
      record.kill('SIGINT');
    });
    record = null;
    assert.deepEqual(errors, []);
    await fs.writeFile(
      path.join(out, 'SHOWCASE_VALIDATION.json'),
      JSON.stringify(
        {
          result: 'passed',
          method:
            'Actual unmodified standalone Player in packaged Mac app, real prepared catalog/media, native ScreenCaptureKit window capture. Capture-only focus/visibility emulation prevents background pauses; scene advance uses the Player public next/settings API.',
          settings: catalog.settings,
          segments,
          errors,
          allRequestedGamesShown: segments.length === 11,
          processing:
            'Built-in 30 fps blend option for sources below target; native-fluid originals retained by the application.'
        },
        null,
        2
      ) + '\n'
    );
  } finally {
    if (record) record.kill('SIGINT');
    await app?.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
