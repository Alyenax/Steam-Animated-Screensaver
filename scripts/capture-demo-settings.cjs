'use strict';
const fs = require('node:fs/promises'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const { spawn, execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..'),
  out = path.join(root, 'dist/public-launch-v2'),
  bundle = path.join(out, 'Steam Animated Screensaver Demo.app'),
  data = path.join(out, 'live-data'),
  recorder = path.join(out, 'capture-window');
(async () => {
  const deadline = Date.now() + 20 * 60 * 1000;
  while (
    !(await fs.access(path.join(out, 'SHOWCASE_VALIDATION.json')).then(
      () => true,
      () => false
    ))
  ) {
    if (Date.now() > deadline) throw Error('Showcase did not finish');
    await new Promise((r) => setTimeout(r, 1000));
  }
  await new Promise((r) => setTimeout(r, 1000));
  let app, record;
  try {
    app = await require('playwright')._electron.launch({
      executablePath: path.join(bundle, 'Contents/MacOS/steam-animated-screensaver'),
      env: { ...process.env, SAS_DATA_DIR: data },
      args: ['--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
      timeout: 30000
    });
    const p = await app.firstWindow();
    p.setDefaultTimeout(15000);
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
    await p.locator('[data-route="settings"]').first().click();
    await p.locator('[data-setting="smoothMotion"]').scrollIntoViewIfNeeded();
    assert(await p.locator('[data-setting="smoothMotion"]').isChecked());
    assert.equal(await p.locator('[data-setting="smoothingFps"]').inputValue(), '30');
    assert.equal(await p.locator('[data-setting="smoothingMode"]').inputValue(), 'blend');
    const line = execFileSync(recorder, ['--list'], { encoding: 'utf8' })
      .split('\n')
      .find(
        (l) =>
          l.includes('io.github.alyenax.sas.capture') && l.includes('Steam Animated Screensaver |')
      );
    assert(line);
    const target = path.join(out, 'processing-enabled.mp4');
    await fs.rm(target, { force: true });
    record = spawn(recorder, [line.split(' | ')[0], target, '0'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    await new Promise((resolve, reject) => {
      record.once('error', reject);
      record.once('exit', (c) => reject(Error('Recorder exit ' + c)));
      record.stdout.on('data', (b) => {
        if (String(b).includes('RECORDING')) resolve();
      });
    });
    await p.waitForTimeout(5500);
    await p.screenshot({ path: path.join(root, 'screenshots/public/processing.png') });
    await new Promise((resolve, reject) => {
      record.once('exit', (c) => (c === 0 ? resolve() : reject(Error('Recorder ' + c))));
      record.kill('SIGINT');
    });
    record = null;
    // Capture the current ten ready games, excluding only the additional startup-scan entries in this disposable catalog.
    await p.evaluate(async () => {
      const s = await window.screensaver.invoke('state');
      for (const g of s.games)
        if (g.status !== 'ready') await window.screensaver.invoke('remove', { id: g.id });
    });
    await p.waitForTimeout(1000);
    await p.locator('[data-route="library"]').first().click();
    await p.waitForTimeout(1000);
    await p.screenshot({ path: path.join(root, 'screenshots/public/library.png'), fullPage: true });
    await fs.writeFile(
      path.join(out, 'PROCESSING_UI_VALIDATION.json'),
      JSON.stringify(
        { result: 'passed', smoothMotion: true, fps: 30, mode: 'blend', nativeCapture: true },
        null,
        2
      ) + '\n'
    );
    console.log('Enabled processing settings and library captured.');
  } finally {
    if (record) record.kill('SIGINT');
    await app?.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
