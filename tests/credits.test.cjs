'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { settings } = require('../player/player.js');
const { createCore, validateSettings } = require('../core/index.cjs');
const { install, signature } = require('../core/installer.cjs');
const flags = ['showArtworkCredit', 'showCoverCredit', 'showLogoCredit'];
test('playback credits default to off and only explicit booleans enable them', () => {
  for (const key of flags) {
    assert.equal(settings()[key], false);
    assert.equal(settings({ [key]: true })[key], true);
    assert.equal(settings({ [key]: 'true' })[key], false);
    assert.throws(() => validateSettings({ [key]: 'true' }));
  }
});
test('existing libraries migrate to hidden credits and retain later individual choices across restart', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sas-credit-settings-'));
  const cores = [];
  t.after(async () => {
    for (const c of cores) await c.close();
    await fs.rm(dir, { recursive: true, force: true });
  });
  await fs.writeFile(
    path.join(dir, 'catalog.json'),
    JSON.stringify({ version: 1, games: [], settings: { language: 'en', showLogos: true } })
  );
  const open = () => {
    const c = createCore({ dataDir: dir, steamRoots: [], isGameRunning: async () => false });
    cores.push(c);
    return c;
  };
  let core = open(),
    s = await core.invoke('state');
  for (const key of flags) assert.equal(s.settings[key], false);
  await core.invoke('settings', {
    showArtworkCredit: true,
    showCoverCredit: false,
    showLogoCredit: true
  });
  await core.close();
  core = open();
  s = await core.invoke('state');
  assert.equal(s.settings.showArtworkCredit, true);
  assert.equal(s.settings.showCoverCredit, false);
  assert.equal(s.settings.showLogoCredit, true);
});
test('offline installation includes individual credit choices and preserves artist metadata', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sas-credit-export-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const dataDir = path.join(dir, 'data'),
    steamRoot = path.join(dir, 'steam');
  await fs.mkdir(path.join(dataDir, 'media'), { recursive: true });
  await fs.mkdir(steamRoot);
  await fs.writeFile(path.join(dataDir, 'media/scene.webm'), 'isolated export fixture');
  await fs.writeFile(path.join(dataDir, 'media/thumbnail.jpg'), 'isolated thumbnail');
  const games = [
    {
      id: 'sgdb:1',
      name: 'Test',
      included: true,
      status: 'ready',
      media: {
        file: 'scene.webm',
        thumbnail: 'thumbnail.jpg',
        animated: true,
        author: { name: 'Artist' }
      }
    }
  ];
  const settings = { showArtworkCredit: false, showCoverCredit: false, showLogoCredit: true };
  const old = signature({ games, settings });
  assert.notEqual(old, signature({ games, settings: { ...settings, showLogoCredit: false } }));
  const result = await install({ dataDir, steamRoot, games, settings });
  const context = { window: {} };
  vm.runInNewContext(await fs.readFile(path.join(result.path, 'catalog.js'), 'utf8'), context);
  const catalog = context.window.SAS_CATALOG;
  for (const key of flags) assert.equal(catalog.settings[key], settings[key]);
  assert.equal(catalog.games[0].media.author.name, 'Artist');
});
