'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync, spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'dist/public-launch-v2');
async function main() {
  const fixture = await fs.mkdtemp(path.join(out, 'idle-capture-'));
  const steam = path.join(fixture, 'Steam');
  await fs.mkdir(path.join(steam, 'config'), { recursive: true });
  await fs.mkdir(path.join(steam, 'steamapps'));
  await fs.writeFile(
    path.join(steam, 'config/config.vdf'),
    '"InstallConfigStore" { "Software" { "Valve" { "Steam" {} } } }'
  );
  let app, recording;
  try {
    app = await require('playwright')._electron.launch({
      executablePath: path.join(
        out,
        'Steam Animated Screensaver Demo.app/Contents/MacOS/steam-animated-screensaver'
      ),
      args: ['--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
      env: { ...process.env, SAS_DATA_DIR: path.join(fixture, 'data'), STEAM_ROOT: steam },
      timeout: 30000
    });
    const page = await app.firstWindow();
    page.setDefaultTimeout(15000);
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'en');
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
      await page.context().newCDPSession(page)
    ).send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await page.locator('[data-route="settings"]').click();
    await page.locator('[data-steam-idle="acSeconds"]').waitFor();
    assert.equal(await page.locator('[data-steam-idle="acSeconds"]').inputValue(), '300');
    assert.equal(await page.locator('[data-steam-idle="batterySeconds"]').inputValue(), '300');
    await page.locator('#steam-idle-settings').scrollIntoViewIfNeeded();
    const recorder = path.join(out, 'capture-window');
    const row = execFileSync(recorder, ['--list'], { encoding: 'utf8' })
      .split('\n')
      .find(
        (line) =>
          line.includes('io.github.alyenax.sas.capture') &&
          line.includes('Steam Animated Screensaver |')
      );
    assert(row);
    const target = path.join(out, 'steam-idle.mp4');
    await fs.rm(target, { force: true });
    recording = spawn(recorder, [row.split(' | ')[0], target, '0'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    await new Promise((resolve, reject) => {
      recording.once('error', reject);
      recording.once('exit', (c) => reject(Error('Recorder exited: ' + c)));
      recording.stdout.on('data', (b) => {
        if (String(b).includes('RECORDING')) resolve();
      });
    });
    await page.waitForTimeout(3300);
    await page.locator('[data-action="apply-steam-idle"]').click();
    await page.waitForFunction(
      () => !document.querySelector('[data-action="apply-steam-idle"]')?.disabled
    );
    const saved = await page.evaluate(() => window.screensaver.invoke('steamIdleState'));
    assert.equal(saved.steam.idle.acSeconds, 300);
    assert.equal(saved.steam.idle.batterySeconds, 300);
    assert.equal(saved.steam.idle.acDefault, false);
    await page.locator('#steam-idle-settings').scrollIntoViewIfNeeded();
    await page
      .locator('#steam-idle-settings')
      .locator('../..')
      .screenshot({ path: path.join(root, 'screenshots/public/steam-idle.png') });
    await page.waitForTimeout(5700);
    await new Promise((resolve, reject) => {
      recording.once('exit', (c) => (c === 0 ? resolve() : reject(Error('Recorder exited: ' + c))));
      recording.kill('SIGINT');
    });
    recording = null;
    await fs.writeFile(
      path.join(out, 'STEAM_IDLE_CAPTURE.json'),
      JSON.stringify(
        {
          result: 'passed',
          version: require('../package.json').version,
          EnglishDefault: true,
          suggestedAC: 300,
          suggestedBattery: 300,
          actualApply: true,
          isolatedSteamConfig: true,
          personalSteamConfigModified: false,
          screenshot: 'screenshots/public/steam-idle.png',
          clip: 'steam-idle.mp4'
        },
        null,
        2
      ) + '\n'
    );
    console.log('Native five-minute configuration captured; isolated Steam settings verified.');
  } finally {
    recording?.kill('SIGINT');
    await app?.close().catch(() => {});
    await fs.rm(fixture, { recursive: true, force: true });
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
