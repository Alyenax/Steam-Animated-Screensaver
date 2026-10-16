'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { dataDirectory, SLUG, LEGACY_SLUG } = require('../core/branding.cjs');
const { defaultRoots } = require('../core/scanner.cjs');
const installer = require('../core/installer.cjs');
async function temp(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sas-platforms-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}
test('branding migration preserves catalog, secret file and media bytes; repeated startup is stable', async (t) => {
  const root = await temp(t),
    old = path.join(root, LEGACY_SLUG),
    target = path.join(root, SLUG);
  await fs.mkdir(path.join(old, 'media'), { recursive: true });
  const fixtures = {
    'catalog.json': '{"version":1,"games":[]}',
    'credentials.json': 'fixture-secret-only',
    'media/art.gif': Buffer.from([0, 9, 18, 255])
  };
  for (const [name, bytes] of Object.entries(fixtures))
    await fs.writeFile(path.join(old, name), bytes);
  assert.equal(await dataDirectory(root), target);
  assert.equal(await dataDirectory(root), target);
  for (const [name, bytes] of Object.entries(fixtures))
    assert.deepEqual(await fs.readFile(path.join(target, name)), Buffer.from(bytes));
  assert.equal(await fs.lstat(old).catch(() => null), null);
});
test('migration refuses active manager and symlinked paths, and never merges two data folders', async (t) => {
  const root = await temp(t),
    old = path.join(root, LEGACY_SLUG),
    target = path.join(root, SLUG);
  await fs.mkdir(old);
  await fs.writeFile(path.join(old, '.manager.lock'), JSON.stringify({ pid: process.pid }));
  await assert.rejects(dataDirectory(root), /Close the previous/);
  await fs.rm(old, { recursive: true });
  await fs.symlink(root, old);
  await assert.rejects(dataDirectory(root), /unsafe/);
  await fs.unlink(old);
  await fs.mkdir(old);
  await fs.writeFile(path.join(old, 'retained'), 'old');
  await fs.mkdir(target);
  assert.equal(await dataDirectory(root), target);
  assert.equal(await fs.readFile(path.join(old, 'retained'), 'utf8'), 'old');
});
test('platform Steam roots include registry, environment overrides, Flatpak and the Mac client root', () => {
  assert.deepEqual(defaultRoots('/home/deck', { platform: 'linux', env: {} }), [
    '/home/deck/.steam/root',
    '/home/deck/.steam/steam',
    '/home/deck/.local/share/Steam',
    '/home/deck/.var/app/com.valvesoftware.Steam/.local/share/Steam'
  ]);
  assert.deepEqual(
    defaultRoots('/Users/test', { platform: 'darwin', env: { STEAM_ROOT: '/custom/steam' } }),
    ['/custom/steam', '/Users/test/Library/Application Support/Steam']
  );
  const roots = defaultRoots('C:\\Users\\Test', {
    platform: 'win32',
    registry: 'D:/Steam',
    env: {
      STEAM_ROOT: 'D:\\steam',
      'ProgramFiles(x86)': 'C:\\Program Files (x86)',
      LOCALAPPDATA: 'C:\\Users\\Test\\AppData\\Local'
    }
  });
  assert.equal(roots.filter((p) => p.toLowerCase() === 'd:\\steam').length, 1);
  assert(roots.includes('C:\\Program Files (x86)\\Steam'));
  assert(roots.includes('C:\\Users\\Test\\AppData\\Local\\Steam'));
});
test('current export migrates actual old markers and respects the legacy installer lock', async (t) => {
  const root = await temp(t),
    media = path.join(root, 'data/media'),
    steamRoot = path.join(root, 'Steam');
  await fs.mkdir(media, { recursive: true });
  await fs.mkdir(steamRoot);
  await fs.writeFile(path.join(media, 'a.gif'), 'fixture');
  await fs.writeFile(path.join(media, 't.jpg'), 'fixture');
  const options = {
    dataDir: path.dirname(media),
    steamRoot,
    games: [
      {
        id: 'steam:1',
        name: 'Fixture',
        included: true,
        status: 'ready',
        media: { file: 'a.gif', thumbnail: 't.jpg', animated: true }
      }
    ]
  };
  const parent = path.join(steamRoot, 'config/uioverrides/screensavers'),
    old = path.join(parent, LEGACY_SLUG);
  await fs.mkdir(old, { recursive: true });
  await fs.writeFile(
    path.join(old, `.${LEGACY_SLUG}.json`),
    JSON.stringify({ owner: LEGACY_SLUG })
  );
  assert(await installer.isInstalled(steamRoot));
  await fs.mkdir(path.join(parent, `.${LEGACY_SLUG}.lock`));
  await assert.rejects(installer.install(options), /in progress/);
  assert(await fs.stat(old));
  assert.equal(await fs.stat(path.join(parent, `.${SLUG}.lock`)).catch(() => null), null);
  await fs.rmdir(path.join(parent, `.${LEGACY_SLUG}.lock`));
  const installed = await installer.install(options);
  assert.equal(await fs.stat(old).catch(() => null), null);
  assert.equal(path.basename(installed.path), SLUG);
  await installer.uninstall(options);
  assert(!(await installer.isInstalled(steamRoot)));
});
