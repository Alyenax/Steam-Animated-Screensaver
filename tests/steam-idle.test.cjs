'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { patchTimeouts, readTimeouts, writeTimeouts } = require('../core/steam-idle.cjs');
const { parseVdf } = require('../core/scanner.cjs');
const { createCore } = require('../core/index.cjs');
const source =
  '// keep this comment\r\n"InstallConfigStore"\r\n{\r\n"Software" { "Valve" { "Steam" {\r\n"Private" "do not alter \\\"credential\\\" or \\\\ path"\r\n"System" { "IdleScreensaverACSeconds" "3600" "Other" "{" }\r\n} } }\r\n"Customization" { "Screensaver" { "CurrentScreensaver" "uioverride-steam-animated-screensaver" } }\r\n}\r\n';
const desired = { acSeconds: 60, batterySeconds: 300 };
const getSystem = (text) => parseVdf(text).installconfigstore.software.valve.steam.system;
async function fixture(t, text = source) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sas-idle-'));
  await fs.mkdir(path.join(root, 'config'));
  await fs.mkdir(path.join(root, 'steamapps'));
  const filename = path.join(root, 'config', 'config.vdf');
  await fs.writeFile(filename, text);
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return { root, filename };
}
test('patch preserves private fields, comments, CRLF, selection and quoted braces', () => {
  const result = patchTimeouts(source, desired);
  const system = getSystem(result);
  assert.equal(system.idlescreensaveracseconds, '60');
  assert.equal(system.idlescreensaverbatteryseconds, '300');
  assert.equal(system.other, '{');
  const withoutTargets = (text) =>
    text
      .replace(/\r\n"IdleScreensaverBatterySeconds"\s+"\d+"\r\n/g, '')
      .replace(/"IdleScreensaverACSeconds"\s+"\d+"/g, '');
  assert.equal(withoutTargets(result), withoutTargets(source));
  assert.equal(patchTimeouts(result, desired), result);
});
test('creates missing config branches without changing other keys, case insensitive', () => {
  for (const text of [
    '"INSTALLCONFIGSTORE" { "Keep" "yes" }',
    '"InstallConfigStore" { "Software" { "Valve" { "Steam" {} } } }'
  ]) {
    const result = patchTimeouts(text, desired);
    assert.equal(getSystem(result).idlescreensaveracseconds, '60');
    assert.equal(getSystem(result).idlescreensaverbatteryseconds, '300');
    if (text.includes('Keep')) assert.equal(parseVdf(result).installconfigstore.keep, 'yes');
  }
});
test('refuses malformed, duplicate, scalar, oversized and invalid settings', () => {
  for (const text of [
    '"InstallConfigStore" {',
    '"Other" {}',
    '"InstallConfigStore" { "Software" "bad" }',
    '"InstallConfigStore" {} "installconfigstore" {}',
    '"InstallConfigStore" { "Software" {} "SOFTWARE" {} }',
    'x'.repeat(8 * 1024 * 1024 + 1)
  ])
    assert.throws(() => patchTimeouts(text, desired));
  const duplicate = source.replace('"Other" "{"', '"idlescreensaveracseconds" "900"');
  assert.throws(() => patchTimeouts(duplicate, desired), /Ambiguous/);
  for (const value of [-1, 1.5, NaN, Infinity, '60', 86401, undefined])
    assert.throws(() => patchTimeouts(source, { ...desired, acSeconds: value }));
});
for (const platform of ['darwin', 'win32', 'linux']) {
  test(`${platform}: actual file apply, backup, readback, defaults and idempotence`, async (t) => {
    const { root, filename } = await fixture(t);
    const options = { platform, isRunning: async () => false };
    let read = await readTimeouts(root, options);
    assert.equal(read.acSeconds, 3600);
    assert.equal(read.batterySeconds, 0);
    assert.equal(read.batteryDefault, true);
    const result = await writeTimeouts(root, desired, options);
    assert.equal(result.changed, true);
    assert.equal(result.backedUp, true);
    assert.equal(result.acSeconds, 60);
    assert.equal(result.batterySeconds, 300);
    const files = await fs.readdir(path.dirname(filename));
    assert.equal(files.filter((s) => s.endsWith('.bak')).length, 1);
    const backup = path.join(
      path.dirname(filename),
      files.find((s) => s.endsWith('.bak'))
    );
    assert.equal(await fs.readFile(backup, 'utf8'), source);
    assert.equal((await fs.stat(backup)).mode & 0o777, 0o600);
    assert.equal((await fs.stat(filename)).mode & 0o777, 0o600);
    assert.equal((await writeTimeouts(root, desired, options)).changed, false);
    assert.equal((await fs.readdir(path.dirname(filename))).length, 2);
    await writeTimeouts(root, { acSeconds: 0, batterySeconds: 0 }, options);
    read = await readTimeouts(root, options);
    assert.equal(read.acSeconds, 0);
    assert.equal(read.batterySeconds, 0);
  });
}
test('Steam running or failed process check causes no write or backup', async (t) => {
  const { root, filename } = await fixture(t);
  for (const check of [
    async () => true,
    async () => {
      throw new Error('probe failed');
    },
    async () => null
  ]) {
    await assert.rejects(
      writeTimeouts(root, desired, { isRunning: check }),
      /Quit Steam|Cannot check/
    );
    assert.equal(await fs.readFile(filename, 'utf8'), source);
    assert.deepEqual(await fs.readdir(path.dirname(filename)), ['config.vdf']);
  }
});
test('Steam starts or config changes during apply: preserve original/current and clean temporary file', async (t) => {
  for (const reason of ['started', 'changed']) {
    const { root, filename } = await fixture(t);
    let calls = 0;
    await assert.rejects(
      writeTimeouts(root, desired, {
        isRunning: async () => {
          if (++calls === 2) {
            if (reason === 'started') return true;
            await fs.writeFile(filename, source + '// concurrent Steam change');
          }
          return false;
        }
      }),
      reason === 'started' ? /Quit Steam/ : /settings changed/
    );
    assert.equal(
      await fs.readFile(filename, 'utf8'),
      source + (reason === 'changed' ? '// concurrent Steam change' : '')
    );
    const files = await fs.readdir(path.dirname(filename));
    assert.equal(files.filter((s) => s.endsWith('.tmp')).length, 0);
    assert.equal(
      await fs.readFile(
        path.join(
          path.dirname(filename),
          files.find((s) => s.endsWith('.bak'))
        ),
        'utf8'
      ),
      source
    );
  }
});
test('refuses linked config folders/files and hard links, preserving their target', async (t) => {
  const { root, filename } = await fixture(t);
  const other = path.join(root, 'outside');
  await fs.writeFile(other, source);
  await fs.rm(filename);
  await fs.symlink(other, filename);
  await assert.rejects(writeTimeouts(root, desired, { isRunning: async () => false }), /Unsafe/);
  await fs.rm(filename);
  await fs.link(other, filename);
  await assert.rejects(readTimeouts(root), /Unsafe/);
  await fs.rm(filename);
  await fs.rm(path.dirname(filename), { recursive: true });
  await fs.mkdir(path.join(root, 'other-config'));
  await fs.symlink(path.join(root, 'other-config'), path.dirname(filename));
  await assert.rejects(readTimeouts(root), /Unsafe/);
  assert.equal(await fs.readFile(other, 'utf8'), source);
});
test('read uses Steam defaults when System absent; invalid UTF8 and platform refused', async (t) => {
  const { root, filename } = await fixture(t, '"InstallConfigStore" {}');
  const state = await readTimeouts(root, { isRunning: async () => false });
  assert.equal(state.acSeconds, 300);
  assert.equal(state.batterySeconds, 0);
  assert.equal(state.acDefault, true);
  assert.equal((await readTimeouts(root, { platform: 'other' })).available, false);
  await assert.rejects(writeTimeouts(root, desired, { platform: 'other' }), /unavailable/);
  await fs.writeFile(filename, Buffer.from([255, 254, 253]));
  await assert.rejects(writeTimeouts(root, desired, { isRunning: async () => false }), /UTF-8/);
});
test('core resolves detected Steam root, ignores supplied paths and only exposes timeout metadata', async (t) => {
  const { root, filename } = await fixture(t);
  const dataDir = path.join(root, 'manager');
  let running = true;
  const core = createCore({ dataDir, steamRoots: [root], isSteamRunning: async () => running });
  t.after(() => core.close());
  let state = await core.invoke('steamIdleState');
  assert.equal(state.steam.idle.running, true);
  assert(!JSON.stringify(state.steam.idle).includes('credential'));
  await assert.rejects(core.invoke('setSteamIdle', desired), /Quit Steam/);
  running = false;
  state = await core.invoke('setSteamIdle', {
    ...desired,
    steamRoot: '/ignored',
    filename: '/ignored'
  });
  assert.equal(state.steam.idle.acSeconds, 60);
  assert.equal(getSystem(await fs.readFile(filename, 'utf8')).idlescreensaveracseconds, '60');
});
