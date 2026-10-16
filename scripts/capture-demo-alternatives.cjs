'use strict';
const fs = require('node:fs/promises'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const { spawn, execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..'),
  out = path.join(root, 'dist/public-launch-v2'),
  data = path.join(out, 'live-data'),
  bundle = path.join(out, 'Steam Animated Screensaver Demo.app'),
  recorder = path.join(out, 'capture-window');
(async () => {
  let app, record;
  try {
    await fs.copyFile(
      path.join(
        require('node:os').homedir(),
        'Library/Application Support/steam-animated-screensaver/steamgriddb.key'
      ),
      path.join(data, 'steamgriddb.key')
    );
    app = await require('playwright')._electron.launch({
      executablePath: path.join(bundle, 'Contents/MacOS/steam-animated-screensaver'),
      env: { ...process.env, SAS_DATA_DIR: data },
      args: ['--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows']
    });
    const p = await app.firstWindow();
    await app.evaluate(({ app, BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows()[0];
      w.webContents.setBackgroundThrottling(false);
      w.setContentSize(1280, 720);
      w.center();
      w.show();
      w.focus();
      app.focus({ steal: true });
    });
    await (
      await p.context().newCDPSession(p)
    ).send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await p.locator('[data-route="library"]').first().click();
    await p.locator('.game-visual').first().click();
    await p.locator('[data-action="load-artworks"]').click();
    await p.locator('[data-select-asset="0"]').waitFor();
    // Wait for actual normalized thumbnails to decode, not just the gallery shell.
    await p.waitForFunction(
      () => {
        const imgs = [...document.querySelectorAll('.asset-choice img')].filter((i) => {
          const r = i.getBoundingClientRect();
          return r.top < innerHeight && r.bottom > 100;
        });
        return imgs.length >= 4 && imgs.every((i) => i.complete && i.naturalWidth > 0);
      },
      {},
      { timeout: 180000 }
    );
    const loaded = await p
      .locator('.asset-choice img')
      .evaluateAll((imgs) => imgs.filter((i) => i.complete && i.naturalWidth > 0).length);
    assert(loaded >= 4);
    const line = execFileSync(recorder, ['--list'], { encoding: 'utf8' })
      .split('\n')
      .find(
        (l) =>
          l.includes('io.github.alyenax.sas.capture') && l.includes('Steam Animated Screensaver |')
      );
    assert(line);
    const target = path.join(out, 'alternatives-loaded.mp4');
    await fs.rm(target, { force: true });
    record = spawn(recorder, [line.split(' | ')[0], target, '0'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    await new Promise((res, rej) => {
      record.once('error', rej);
      record.once('exit', (c) => rej(Error('Recorder ' + c)));
      record.stdout.on('data', (b) => {
        if (String(b).includes('RECORDING')) res();
      });
    });
    await p.waitForTimeout(4500);
    await p.screenshot({ path: path.join(out, 'alternatives-loaded.png') });
    await new Promise((res, rej) => {
      record.once('exit', (c) => (c === 0 ? res() : rej(Error('Recorder ' + c))));
      record.kill('SIGINT');
    });
    record = null;
    await fs.writeFile(
      path.join(out, 'ALTERNATIVES_VALIDATION.json'),
      JSON.stringify(
        { result: 'passed', realProvider: true, visibleThumbnailsDecoded: true, loaded },
        null,
        2
      )
    );
    console.log('Decoded gallery captured:', loaded);
  } finally {
    if (record) record.kill('SIGINT');
    await app?.close();
    await fs.rm(path.join(data, 'steamgriddb.key'), { force: true });
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
