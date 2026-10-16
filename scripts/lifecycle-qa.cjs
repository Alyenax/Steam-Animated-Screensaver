'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
async function run() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sas-lifecycle-'));
  let app;
  const checks = [];
  const mark = (text) => {
    checks.push(text);
    console.log(text);
  };
  try {
    const { _electron } = require('playwright');
    const supplied = process.argv.includes('--app')
      ? path.resolve(process.argv[process.argv.indexOf('--app') + 1])
      : null;
    const executablePath = supplied
      ? path.join(
          supplied,
          'Contents/MacOS',
          require('node:child_process')
            .execFileSync(
              'plutil',
              ['-extract', 'CFBundleExecutable', 'raw', path.join(supplied, 'Contents/Info.plist')],
              { encoding: 'utf8' }
            )
            .trim()
        )
      : require('electron');
    const legacy = path.join(root, 'steamos-animated-screensaver'),
      data = path.join(root, 'steam-animated-screensaver');
    await fs.mkdir(legacy);
    await fs.writeFile(
      path.join(legacy, 'catalog.json'),
      JSON.stringify({
        version: 1,
        games: [
          {
            id: 'sgdb:99001',
            sgdbId: 99001,
            name: 'Lifecycle QA game',
            sources: ['manual'],
            included: false
          }
        ]
      })
    );
    const launch = async () => {
      app = await _electron.launch({
        executablePath,
        args: supplied ? [] : [path.resolve(__dirname, '..')],
        env: {
          ...process.env,
          SAS_DATA_DIR: '',
          CINEMA_DATA_DIR: '',
          SAS_APP_DATA_ROOT: root,
          STEAM_ROOT: path.join(root, 'Steam')
        },
        timeout: 20000
      });
      const page = await app.firstWindow();
      await page.locator('[data-route="settings"]').first().waitFor();
      return page;
    };
    for (let i = 0; i < 3; i++) {
      const page = await launch();
      const state = await page.evaluate(() => window.screensaver.invoke('state'));
      assert(state.games.some((g) => g.id === 'sgdb:99001'));
      const profile = await app.evaluate(({ app }) => app.getPath('userData'));
      assert.equal(profile, path.join(root, 'steam-animated-screensaver-electron'));
      if (i === 0) {
        assert.equal(await fs.stat(legacy).catch(() => null), null);
        mark(
          'Actual Electron startup migrates old catalog before creating Chromium profile or library locks'
        );
      }
      const queue = await page.evaluate(async () => {
        const changes = Array.from({ length: 20 }, (_, n) =>
          window.screensaver.invoke('updateGame', { id: 'sgdb:99001', included: n % 2 === 1 })
        );
        await Promise.all(changes);
        return window.screensaver.invoke('state');
      });
      assert.equal(queue.games.find((g) => g.id === 'sgdb:99001').included, true);
      await app.close();
      app = null;
      assert.equal(await fs.stat(path.join(data, '.manager.lock')).catch(() => null), null);
      assert.equal(
        JSON.parse(await fs.readFile(path.join(data, 'logs/diagnostics.json'), 'utf8')).cleanExit,
        true
      );
    }
    mark(
      'Three native app open/change/close cycles preserve queued changes, valid catalog/log JSON and release locks'
    );
    const page = await launch();
    const exit = new Promise((resolve) => app.process().once('exit', resolve));
    await app.evaluate(() => {
      setTimeout(() => {
        throw new Error('SAS_QA_MAIN_FATAL');
      }, 50);
    });
    await Promise.race([
      exit,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Fatal main process did not exit')), 10000)
      )
    ]);
    await app.close().catch(() => {});
    app = null;
    const crashed = JSON.parse(await fs.readFile(path.join(data, 'logs/diagnostics.json'), 'utf8'));
    assert.equal(crashed.cleanExit, false);
    assert(
      crashed.events.some(
        (e) =>
          e.event === 'main.uncaught_exception' && e.detail.error.message === 'SAS_QA_MAIN_FATAL'
      )
    );
    mark(
      'Injected fatal main-process exception exits and leaves durable JSON with stack and unclean-exit status'
    );
    const resumed = await launch();
    assert(
      (await resumed.evaluate(() => window.screensaver.invoke('state'))).games.some(
        (g) => g.id === 'sgdb:99001'
      )
    );
    const recovered = JSON.parse(
      await fs.readFile(path.join(data, 'logs/diagnostics.json'), 'utf8')
    );
    assert(
      recovered.events.some(
        (e) => e.event === 'session.started' && e.detail.previousSessionInterrupted
      )
    );
    await app.close();
    app = null;
    assert.equal(await fs.stat(path.join(data, '.manager.lock')).catch(() => null), null);
    mark(
      'Restart after fatal exit detects interruption, recovers stale library lock and preserves the library'
    );
    const report = {
      version: require('../package.json').version,
      platform: process.platform,
      arch: process.arch,
      packaged: !!supplied,
      checks,
      result: 'passed',
      scope:
        'Short native lifecycle/fault-injection regression; not a long-duration soak or target Steam CEF acceptance.'
    };
    await fs.writeFile(
      path.resolve(__dirname, '../dist/LIFECYCLE_VALIDATION.json'),
      JSON.stringify(report, null, 2) + '\n'
    );
  } finally {
    await app?.close().catch(() => {});
    await fs.rm(root, { recursive: true, force: true });
  }
}
run().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
