'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { isSteamRunning, readTimeouts } = require('../core/steam-idle.cjs');
async function run() {
  const appPath = path.resolve(process.argv[process.argv.indexOf('--app') + 1]);
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sas-idle-native-'));
  const running = await isSteamRunning();
  let app;
  try {
    const steam = path.join(root, 'Steam');
    const file = path.join(steam, 'config', 'config.vdf');
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.mkdir(path.join(steam, 'steamapps'));
    const original =
      '"InstallConfigStore" { "PrivateFixture" "preserved" "Software" { "Valve" { "Steam" { "System" { "IdleScreensaverACSeconds" "600" "IdleScreensaverBatterySeconds" "0" } } } } }';
    await fs.writeFile(file, original);
    const executable = execFileSync(
      'plutil',
      ['-extract', 'CFBundleExecutable', 'raw', path.join(appPath, 'Contents/Info.plist')],
      { encoding: 'utf8' }
    ).trim();
    app = await require('playwright')._electron.launch({
      executablePath: path.join(appPath, 'Contents/MacOS', executable),
      env: { ...process.env, SAS_DATA_DIR: path.join(root, 'data'), STEAM_ROOT: steam },
      timeout: 20000
    });
    const page = await app.firstWindow();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const metadata = await app.evaluate(({ app }) => ({
      packaged: app.isPackaged,
      version: app.getVersion(),
      platform: process.platform
    }));
    assert.equal(metadata.packaged, true);
    assert.equal(metadata.version, require('../package.json').version);
    await page.locator('[data-route="settings"]').click();
    const ac = page.locator('[data-steam-idle="acSeconds"]');
    const battery = page.locator('[data-steam-idle="batterySeconds"]');
    await ac.waitFor();
    assert.equal(await ac.inputValue(), '600');
    await ac.selectOption('60');
    await battery.selectOption('120');
    await page.locator('[data-action="apply-steam-idle"]').click();
    await page.waitForFunction(
      () => !document.querySelector('[data-action="apply-steam-idle"]')?.disabled
    );
    if (running) {
      assert.equal(await fs.readFile(file, 'utf8'), original);
      assert((await page.locator('#steam-idle-settings').innerText()).includes('Steam is running'));
      assert.deepEqual(await fs.readdir(path.dirname(file)), ['config.vdf']);
    } else {
      const saved = await readTimeouts(steam);
      assert.equal(saved.acSeconds, 60);
      assert.equal(saved.batterySeconds, 120);
      const files = await fs.readdir(path.dirname(file));
      assert.equal(
        await fs.readFile(
          path.join(
            path.dirname(file),
            files.find((f) => f.endsWith('.bak'))
          ),
          'utf8'
        ),
        original
      );
      await page.locator('[data-action="language"]').click();
      await page.waitForFunction(() => document.documentElement.lang === 'fr');
      await page.locator('#steam-idle-settings').scrollIntoViewIfNeeded();
      await page.screenshot({
        path: path.resolve(__dirname, '../dist/Steam-idle-settings-macos.png')
      });
    }
    assert.deepEqual(errors, []);
    const report = {
      ...metadata,
      passed: true,
      steamRunning: running,
      mode: running
        ? 'native real Steam process guard, isolated config untouched'
        : 'native closed-Steam apply, backup and readback on isolated config',
      realSteamConfigModified: false,
      pageErrors: errors
    };
    await fs.writeFile(
      path.resolve(__dirname, `../dist/STEAM_IDLE_NATIVE_${running ? 'GUARD' : 'APPLY'}.json`),
      JSON.stringify(report, null, 2) + '\n'
    );
    console.log(JSON.stringify(report));
  } finally {
    await app?.close().catch(() => {});
    await fs.rm(root, { recursive: true, force: true });
  }
}
run().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
