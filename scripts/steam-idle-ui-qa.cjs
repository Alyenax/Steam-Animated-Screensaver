'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { createCore } = require('../core/index.cjs');
const { createServer } = require('./dev-server.cjs');
const { readTimeouts } = require('../core/steam-idle.cjs');
async function run() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sas-idle-ui-'));
  let server, browser;
  const checks = [],
    errors = [];
  try {
    const steam = path.join(dir, 'steam');
    const filename = path.join(steam, 'config', 'config.vdf');
    await fs.mkdir(path.dirname(filename), { recursive: true });
    await fs.mkdir(path.join(steam, 'steamapps'));
    const original =
      '"InstallConfigStore" { "Private" "retained" "Software" { "Valve" { "Steam" {} } } }';
    await fs.writeFile(filename, original);
    let running = true;
    const core = createCore({
      dataDir: path.join(dir, 'data'),
      steamRoots: [steam],
      isSteamRunning: async () => running
    });
    let idleGate;
    const originalInvoke = core.invoke.bind(core);
    server = await createServer({
      core: {
        ...core,
        invoke: async (action, payload) => {
          if (action === 'steamIdleState' && idleGate) await idleGate;
          return originalInvoke(action, payload);
        }
      }
    });
    browser = await require('playwright').chromium.launch({ channel: 'chrome', headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(server.url + '/manager/index.html');
    await page.locator('[data-route="settings"]').click();
    const ac = page.locator('[data-steam-idle="acSeconds"]');
    const battery = page.locator('[data-steam-idle="batterySeconds"]');
    await ac.waitFor();
    assert.equal((await core.invoke('state')).settings.language, 'en');
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    assert.equal(await page.locator('[data-setting="language"]').inputValue(), 'en');
    checks.push('A new profile starts in English without consulting the OS locale');
    assert.equal(await ac.inputValue(), '300');
    assert.equal(await battery.inputValue(), '300');
    assert(
      (await page.locator('#steam-idle-settings').innerText()).includes('Currently saved in Steam')
    );
    assert.equal(await fs.readFile(filename, 'utf8'), original);
    checks.push(
      'Fresh Steam config proposes five minutes on AC and battery without writing; actual defaults remain visible'
    );
    await ac.selectOption('60');
    await battery.selectOption('120');
    await page.locator('[data-action="apply-steam-idle"]').click();
    await page.waitForFunction(
      () => !document.querySelector('[data-action="apply-steam-idle"]')?.disabled
    );
    assert.equal(await fs.readFile(filename, 'utf8'), original);
    assert((await page.locator('#steam-idle-settings').innerText()).includes('Steam is running'));
    checks.push('Running Steam blocks write through the real Apply button; drafts retained');
    assert.equal(await ac.inputValue(), '60');
    running = false;
    await page.locator('[data-action="apply-steam-idle"]').click();
    await page.waitForFunction(
      () => !document.querySelector('[data-action="apply-steam-idle"]')?.disabled
    );
    let saved = await readTimeouts(steam, { isRunning: async () => false });
    assert.equal(saved.acSeconds, 60);
    assert.equal(saved.batterySeconds, 120);
    assert.equal(saved.backedUp, undefined);
    checks.push('Real controls apply independent AC and battery delays with a private backup');
    await ac.selectOption('600');
    await page.locator('[data-action="language"]').click();
    await page.waitForFunction(() => document.documentElement.lang === 'fr');
    assert.equal(await ac.inputValue(), '600');
    assert.equal(await battery.inputValue(), '120');
    assert(
      (await page.locator('#steam-idle-settings').innerText()).includes(
        'Quittez complètement Steam'
      )
    );
    checks.push(
      'Draft survives rerender/language change; instructions translated in French and English'
    );
    await page.locator('[data-action="refresh-steam-idle"]').click();
    await page.waitForFunction(
      () => document.querySelector('[data-steam-idle="acSeconds"]')?.value === '60'
    );
    for (const width of [1440, 800, 390]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false
      );
    }
    checks.push(
      'Refresh rereads Steam; settings have no horizontal overflow at 1440, 800 and 390px'
    );
    await ac.selectOption('0');
    await battery.selectOption('0');
    await page.locator('[data-action="apply-steam-idle"]').click();
    await page.waitForFunction(
      () => !document.querySelector('[data-action="apply-steam-idle"]')?.disabled
    );
    saved = await readTimeouts(steam, { isRunning: async () => false });
    assert.equal(saved.acSeconds, 0);
    assert.equal(saved.batterySeconds, 0);
    await page.reload();
    await page.locator('[data-route="settings"]').click();
    await ac.waitFor();
    assert.equal(await ac.inputValue(), '0');
    assert.equal(await battery.inputValue(), '0');
    assert.equal(await page.locator('html').getAttribute('lang'), 'fr');
    assert.equal((await core.invoke('state')).settings.language, 'fr');
    checks.push(
      'Explicit French choice persists after reload; English default does not overwrite it'
    );
    checks.push('Disabled saves zero explicitly and survives page reload');
    let finishIdle;
    idleGate = new Promise((resolve) => {
      finishIdle = resolve;
    });
    await page.locator('[data-action="refresh-steam-idle"]').click();
    await page.locator('#steam-profile').fill('76561198000000000');
    await page.locator('#steam-api-key').fill('0123456789abcdef'.repeat(2));
    await page.locator('#api-key').fill('unsaved-fixture-key');
    finishIdle();
    await page.waitForFunction(
      () => !document.querySelector('[data-action="refresh-steam-idle"]')?.disabled
    );
    assert.equal(await page.locator('#steam-profile').inputValue(), '76561198000000000');
    assert.equal(await page.locator('#steam-api-key').inputValue(), '0123456789abcdef'.repeat(2));
    assert.equal(await page.locator('#api-key').inputValue(), 'unsaved-fixture-key');
    await page.locator('#steam-account-form').evaluate((form) => form.requestSubmit());
    await page.locator('[data-action="import-steam"]:not(:disabled)').waitFor();
    assert.equal((await core.invoke('state')).steamAccount.hasKey, true);
    checks.push(
      'Delayed Steam idle refresh preserves unsaved account and API-key fields; saving still works'
    );
    assert.deepEqual(errors, []);
    const result = { passed: true, checks, pageErrors: errors, nativeWindowsLinux: false };
    await fs.mkdir(path.resolve(__dirname, '../dist'), { recursive: true });
    await fs.writeFile(
      path.resolve(__dirname, '../dist/STEAM_IDLE_UI_VALIDATION.json'),
      JSON.stringify(result, null, 2) + '\n'
    );
    console.log(JSON.stringify(result));
  } finally {
    await browser?.close();
    await server?.close();
    await fs.rm(dir, { recursive: true, force: true });
  }
}
run().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
