'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { createCore, validateSettings, cleanGame } = require('../core/index.cjs');
const { createSGDB } = require('../core/sgdb.cjs');
const { installationInfo, NAME } = require('../core/installer.cjs');
const { settings } = require('../player/player.js');
const logo = (id) => ({
  id,
  kind: 'logo',
  animated: false,
  url: `https://cdn2.steamgriddb.com/logo/${id}.png`,
  width: 480,
  height: 140,
  author: { name: 'Logo artist' }
});
async function fixture(t, available = true) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sas-branding-'));
  const dataDir = path.join(dir, 'data'),
    steam = path.join(dir, 'steam');
  await fs.mkdir(path.join(steam, 'steamapps'), { recursive: true });
  const media = {
    validate: async (m) =>
      !!m && !!(await fs.stat(path.join(dataDir, 'media', m.file)).catch(() => null)),
    prepare: async (a) => {
      await fs.mkdir(path.join(dataDir, 'media'), { recursive: true });
      const file = `${a.kind}-${a.id}.png`,
        thumbnail = `${a.kind}-${a.id}.jpg`;
      for (const f of [file, thumbnail])
        await fs.writeFile(path.join(dataDir, 'media', f), 'test image');
      return {
        file,
        thumbnail,
        animated: a.animated,
        format: a.animated ? 'webm' : 'png',
        sha256: String(a.id),
        sourceUrl: a.url,
        author: a.author,
        width: a.width,
        height: a.height
      };
    }
  };
  const sgdb = {
    game: async (id) => ({ sgdbId: id, name: 'Test game' }),
    validateKey: async () => true,
    artworks: async () => [{ ...logo(11), kind: 'hero', animated: true }],
    logos: async () => (available ? [logo(21), logo(22)] : [])
  };
  const cores = [];
  const open = () => {
    const c = createCore({
      dataDir,
      steamRoots: [steam],
      sgdb,
      media,
      isGameRunning: async () => false
    });
    cores.push(c);
    return c;
  };
  const core = open();
  t.after(async () => {
    for (const c of cores) await c.close();
    await fs.rm(dir, { recursive: true, force: true });
  });
  await core.invoke('setKey', { key: 'temporary-test-key-not-a-real-key' });
  await core.invoke('add', { sgdbId: 1 });
  await core.invoke('scan');
  await core.invoke('prepare');
  let state;
  for (let i = 0; i < 300; i++) {
    state = await core.invoke('state');
    if (state.job.status === 'completed') break;
    await new Promise((r) => setTimeout(r, 5));
  }
  assert.equal(state.job.status, 'completed');
  return { core, open, dataDir, steam };
}
test('default is logo beside cover, old hidden titles migrate, unsafe modes are rejected', () => {
  assert.equal(settings().nameDisplay, 'logo');
  assert.equal(settings().logoPosition, 'beside-title');
  assert.equal(settings({ showLogos: false }).nameDisplay, 'hidden');
  assert.throws(() => validateSettings({ nameDisplay: 'script' }));
  assert.throws(() => validateSettings({ logoPosition: 'outside' }));
  const game = cleanGame({
    id: 'sgdb:1',
    name: 'Test',
    logo: { file: '../secret', thumbnail: 'x.png', animated: false },
    branding: { mode: 'bad', position: 'top-right' }
  });
  assert.equal(game.logo, null);
  assert.equal(game.branding, undefined);
});
test('SteamGridDB logo gallery uses static safe assets and handles unavailable logos', async () => {
  let endpoint;
  const client = createSGDB({
    getKey: () => 'test-key',
    minInterval: 0,
    fetchImpl: async (url) => {
      endpoint = String(url);
      return new Response(
        JSON.stringify({
          success: true,
          data: [
            { ...logo(1), score: 1 },
            { ...logo(2), score: 9 },
            { ...logo(3), url: 'https://evil.example/logo.png' }
          ]
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }
  });
  const rows = await client.logos(5);
  assert(endpoint.includes('/logos/game/5?types=static'));
  assert.deepEqual(
    rows.map((x) => x.id),
    [2, 1]
  );
  assert.equal(rows[0].animated, false);
});
test('logo selection persists, exports offline, detects pending edits and survives unused-media cleanup', async (t) => {
  const x = await fixture(t);
  let s = await x.core.invoke('state');
  assert(s.games[0].logo);
  assert.equal(s.settings.nameDisplay, 'logo');
  await x.core.invoke('logos', { id: 'sgdb:1' });
  await assert.rejects(
    x.core.invoke('setLogo', {
      id: 'sgdb:1',
      selectedLogo: { id: 999, url: 'https://evil.example' }
    }),
    /gallery/
  );
  await x.core.invoke('setLogo', { id: 'sgdb:1', selectedLogo: { id: 22, kind: 'logo' } });
  await x.core.invoke('updateGame', {
    id: 'sgdb:1',
    branding: { mode: 'both', position: 'top-right' }
  });
  s = await x.core.invoke('install');
  assert.equal(s.steam.needsUpdate, false);
  const target = path.join(x.steam, 'config/uioverrides/screensavers', NAME);
  const context = { window: {} };
  vm.runInNewContext(await fs.readFile(path.join(target, 'catalog.js'), 'utf8'), context);
  const exported = context.window.SAS_CATALOG;
  assert.equal(exported.games[0].branding.position, 'top-right');
  assert.equal(exported.settings.nameDisplay, 'logo');
  assert.equal(exported.games[0].logo.file, 'media/logo-22.png');
  await fs.access(path.join(target, exported.games[0].logo.file));
  await x.core.invoke('clearUnused');
  await fs.access(path.join(x.dataDir, 'media/logo-22.png'));
  s = await x.core.invoke('settings', { logoPosition: 'top-left' });
  assert.equal(s.steam.needsUpdate, true);
  s = await x.core.invoke('install');
  assert.equal(s.steam.needsUpdate, false);
  await x.core.close();
  const reopened = x.open();
  s = await reopened.invoke('scan');
  assert.equal(s.games[0].logoManualSelection, true);
  assert.equal(s.games[0].selectedLogo.id, 22);
  assert.equal(s.games[0].branding.mode, 'both');
  assert.equal(s.steam.needsUpdate, false);
  await reopened.invoke('purgeMedia', { confirm: true });
  s = await reopened.invoke('state');
  assert.equal(s.games[0].logo, null);
  assert.equal(s.steam.installed, false);
});
test('missing optional logos preserve a playable animation and a legacy installation requests an update', async (t) => {
  const x = await fixture(t, false);
  let s = await x.core.invoke('state');
  assert.equal(s.games[0].status, 'ready');
  assert(!s.games[0].logo);
  await x.core.invoke('install');
  const marker = path.join(
    x.steam,
    'config/uioverrides/screensavers',
    NAME,
    '.steam-animated-screensaver.json'
  );
  await fs.writeFile(marker, JSON.stringify({ owner: NAME, version: 1 }));
  assert.equal((await installationInfo(x.steam)).signature, null);
  s = await x.core.invoke('scan');
  assert.equal(s.steam.needsUpdate, true);
});
