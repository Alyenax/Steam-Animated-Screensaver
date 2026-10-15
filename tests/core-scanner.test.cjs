'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { parseVdf, scanSteam, classify, isSteamGameRunning } = require('../core/scanner.cjs');
const manifest = (id, name, flags = 4) =>
  `"AppState" { "appid" "${id}" "name" "${name}" "StateFlags" "${flags}" }`;
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cinema-scan-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'steamapps'));
  return root;
}
test('VDF preserves escaped paths, comments, braces in strings; rejects broken nesting', () => {
  const v = parseVdf('// c\n"libraryfolders" { "0" {"path" "C:\\\\Steam"} "x" "a { b }"}');
  assert.equal(v.libraryfolders['0'].path, 'C:\\Steam');
  assert.equal(v.libraryfolders.x, 'a { b }');
  assert.throws(() => parseVdf('"x" {"a" "b"'));
  assert.throws(() => parseVdf('"x" "broken'));
});
test('Steam absent and empty library are successful offline states', async (t) => {
  assert.equal((await scanSteam(['/definitely-absent-cinema'])).detected, false);
  const root = await fixture(t);
  const s = await scanSteam([root]);
  assert.equal(s.detected, true);
  assert.deepEqual(s.games, []);
});
test('multilibrary scanning deduplicates manifests; skips corrupt and unfinished installations', async (t) => {
  const root = await fixture(t);
  const second = await fixture(t);
  await fs.writeFile(
    path.join(root, 'steamapps/libraryfolders.vdf'),
    `"libraryfolders" {"0" {"path" "${root}"} "1" {"path" "${second}"}}`
  );
  await fs.writeFile(path.join(root, 'steamapps/appmanifest_10.acf'), manifest(10, 'Game A'));
  await fs.writeFile(path.join(second, 'steamapps/appmanifest_10.acf'), manifest(10, 'Game A'));
  await fs.writeFile(path.join(second, 'steamapps/appmanifest_20.acf'), manifest(20, 'Game B'));
  await fs.writeFile(
    path.join(second, 'steamapps/appmanifest_30.acf'),
    manifest(30, 'Downloading', 2)
  );
  await fs.writeFile(path.join(second, 'steamapps/appmanifest_40.acf'), '"broken" {');
  const s = await scanSteam([root]);
  assert.deepEqual(
    s.games.map((g) => g.steamAppId),
    [10, 20]
  );
  assert.equal(s.warnings.length, 1);
});
test('utilities and demos are distinguished and excluded by default', async (t) => {
  const root = await fixture(t);
  for (const [i, name] of [
    [1, 'Proton Experimental'],
    [2, 'A Demo'],
    [3, 'Real Game']
  ])
    await fs.writeFile(path.join(root, `steamapps/appmanifest_${i}.acf`), manifest(i, name));
  const s = await scanSteam([root]);
  assert.equal(s.games.find((g) => g.steamAppId === 1).classification, 'utility');
  assert.equal(s.games.find((g) => g.steamAppId === 2).included, false);
  assert.equal(classify('Half-Life 2'), 'game');
});
test('scanner handles more than 100 titles and rescan uninstallation', async (t) => {
  const root = await fixture(t);
  await Promise.all(
    Array.from({ length: 127 }, (_, n) =>
      fs.writeFile(
        path.join(root, `steamapps/appmanifest_${n + 1}.acf`),
        manifest(n + 1, `Game ${n + 1}`)
      )
    )
  );
  assert.equal((await scanSteam([root])).games.length, 127);
  await fs.rm(path.join(root, 'steamapps/appmanifest_1.acf'));
  assert.equal((await scanSteam([root])).games.length, 126);
});
test('game-running detection requires an actual readable SteamAppId environment', async (t) => {
  const root = await fixture(t);
  await fs.mkdir(path.join(root, '100'));
  await fs.writeFile(path.join(root, '100/environ'), 'USER=deck\0SteamAppId=0\0');
  assert.equal(await isSteamGameRunning(root), false);
  await fs.writeFile(path.join(root, '100/environ'), 'USER=deck\0SteamAppId=620\0');
  assert.equal(await isSteamGameRunning(root), true);
});
test('game-running detection ignores the Manager and its decoder/browser children, and non-Steam shortcut IDs', async (t) => {
  const root = await fixture(t);
  await fs.mkdir(path.join(root, String(process.pid)));
  await fs.writeFile(path.join(root, String(process.pid), 'environ'), 'SteamAppId=620\0');
  assert.equal(await isSteamGameRunning(root), false);
  await fs.mkdir(path.join(root, '100'));
  await fs.writeFile(path.join(root, '100/environ'), 'SteamAppId=620\0');
  await fs.writeFile(path.join(root, '100/status'), `Name:\tffmpeg\nPPid:\t${process.pid}\n`);
  assert.equal(await isSteamGameRunning(root), false);
  await fs.writeFile(path.join(root, '100/status'), 'Name:\tshortcut\nPPid:\t1\n');
  await fs.writeFile(path.join(root, '100/environ'), 'SteamGameId=12001593341032529920\0');
  assert.equal(await isSteamGameRunning(root), false);
});
