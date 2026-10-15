'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const {
  install,
  uninstall,
  isInstalled,
  NAME,
  LEGACY_NAME,
  MARKER
} = require('../core/installer.cjs');
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cinema-install-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const dataDir = path.join(root, 'data'),
    steamRoot = path.join(root, 'steam');
  await fs.mkdir(path.join(dataDir, 'media'), { recursive: true });
  await fs.mkdir(steamRoot);
  await fs.writeFile(path.join(dataDir, 'media', 'animation.gif'), 'test animation');
  await fs.writeFile(path.join(dataDir, 'media', 'preview.jpg'), 'test thumbnail');
  await fs.writeFile(path.join(dataDir, 'media', 'source.gif'), 'retained source');
  const game = {
    id: 'steam:10',
    name: 'Game </script>',
    included: true,
    status: 'ready',
    media: {
      file: 'animation.gif',
      thumbnail: 'preview.jpg',
      sourceFile: 'source.gif',
      width: 640,
      height: 360,
      format: 'gif',
      animated: true,
      author: { name: 'Artist' }
    }
  };
  return {
    dataDir,
    steamRoot,
    games: [game],
    settings: { apiKey: 'secret', showLogos: true },
    root
  };
}
test('offline install copies exactly prepared playback files and uninstall preserves neighbors', async (t) => {
  const f = await fixture(t);
  assert.equal(await isInstalled(f.steamRoot), false);
  const result = await install(f);
  assert.equal(await isInstalled(f.steamRoot), true);
  assert.equal(path.basename(result.path), NAME);
  assert.deepEqual((await fs.readdir(path.join(result.path, 'media'))).sort(), [
    'animation.gif',
    'preview.jpg'
  ]);
  const script = await fs.readFile(path.join(result.path, 'catalog.js'), 'utf8');
  assert(!script.includes('secret'));
  assert(!script.includes('</script>'));
  const context = { window: {} };
  vm.runInNewContext(script, context);
  assert.equal(context.window.CINEMA_CATALOG.games[0].media.file, 'media/animation.gif');
  const neighbor = path.join(path.dirname(result.path), 'Another screensaver');
  await fs.mkdir(neighbor);
  await fs.writeFile(path.join(neighbor, 'mine'), 'keep');
  await uninstall(f);
  assert.equal(await isInstalled(f.steamRoot), false);
  assert.equal(await fs.readFile(path.join(neighbor, 'mine'), 'utf8'), 'keep');
});
test('owned reinstall replaces atomically; invalid input preserves prior installation', async (t) => {
  const f = await fixture(t),
    result = await install(f);
  const before = await fs.readFile(path.join(result.path, 'catalog.js'), 'utf8');
  f.games[0].media.file = '../escape';
  await assert.rejects(install(f), /Unsafe/);
  assert.equal(await fs.readFile(path.join(result.path, 'catalog.js'), 'utf8'), before);
  f.games[0].media.file = 'animation.gif';
  f.games[0].name = 'New title';
  await install(f);
  assert.match(await fs.readFile(path.join(result.path, 'catalog.js'), 'utf8'), /New title/);
  assert((await fs.readdir(path.dirname(result.path))).every((n) => !n.startsWith('.cinema-')));
});
test('never replaces or uninstalls an unowned folder', async (t) => {
  const f = await fixture(t),
    target = path.join(f.steamRoot, 'config', 'uioverrides', 'screensavers', NAME);
  await fs.mkdir(target, { recursive: true });
  await fs.writeFile(path.join(target, 'mine'), 'keep');
  await assert.rejects(install(f), /belongs/);
  await assert.rejects(uninstall(f), /not owned/);
  assert.equal(await fs.readFile(path.join(target, 'mine'), 'utf8'), 'keep');
});
test('rejects symlink paths and source symlinks', async (t) => {
  const f = await fixture(t);
  await fs.symlink(f.dataDir, path.join(f.steamRoot, 'config'));
  await assert.rejects(install(f), /unsafe/);
  await fs.unlink(path.join(f.steamRoot, 'config'));
  await fs.unlink(path.join(f.dataDir, 'media', 'animation.gif'));
  await fs.symlink(
    path.join(f.dataDir, 'media', 'source.gif'),
    path.join(f.dataDir, 'media', 'animation.gif')
  );
  await assert.rejects(install(f), /unsafe/);
});
test('refuses empty or excluded catalogs and allows explicit static fallback', async (t) => {
  const f = await fixture(t);
  f.games[0].media.animated = false;
  await assert.rejects(install(f), /at least one/);
  f.settings.staticFallback = true;
  await install(f);
  assert(await isInstalled(f.steamRoot));
});
test('installed identifier is a DNS label, separate from the product display name', () => {
  assert.match(NAME, /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/);
  const hostname = `uioverride-${NAME}.steamscreensavers.host`;
  assert.equal(new URL(`https://${hostname}/index.html`).hostname, hostname);
  assert.throws(
    () => new URL(`https://uioverride-${LEGACY_NAME}.steamscreensavers.host/index.html`)
  );
});
test('update migrates owned legacy export only after corrected installation commits', async (t) => {
  const f = await fixture(t),
    first = await install(f);
  const legacy = path.join(path.dirname(first.path), LEGACY_NAME);
  await fs.rename(first.path, legacy);
  assert(await isInstalled(f.steamRoot));
  f.games[0].name = 'Updated scene';
  const updated = await install(f);
  assert.equal(path.basename(updated.path), NAME);
  assert.equal(await fs.stat(legacy).catch(() => null), null);
  assert.match(await fs.readFile(path.join(updated.path, 'catalog.js'), 'utf8'), /Updated scene/);
});
test('failed migration preserves old catalog and artwork; legacy uninstall is supported', async (t) => {
  const f = await fixture(t),
    first = await install(f);
  const legacy = path.join(path.dirname(first.path), LEGACY_NAME);
  await fs.rename(first.path, legacy);
  const before = await fs.readFile(path.join(legacy, 'catalog.js'));
  f.games[0].media.file = 'missing.gif';
  await assert.rejects(install(f));
  assert.deepEqual(await fs.readFile(path.join(legacy, 'catalog.js')), before);
  assert.equal(await fs.stat(first.path).catch(() => null), null);
  await uninstall(f);
  assert.equal(await isInstalled(f.steamRoot), false);
});
test('migration and uninstall leave an unowned legacy-named directory intact', async (t) => {
  const f = await fixture(t),
    canonical = await install(f);
  const legacy = path.join(path.dirname(canonical.path), LEGACY_NAME);
  await fs.mkdir(legacy);
  await fs.writeFile(path.join(legacy, 'unrelated'), 'keep');
  await install(f);
  await uninstall(f);
  assert.equal(await fs.readFile(path.join(legacy, 'unrelated'), 'utf8'), 'keep');
});
test('standalone repair script renames only owned legacy files and is repeatable', async (t) => {
  const { execFileSync, spawnSync } = require('node:child_process');
  const f = await fixture(t),
    canonical = await install(f);
  const legacy = path.join(path.dirname(canonical.path), LEGACY_NAME);
  await fs.rename(canonical.path, legacy);
  const before = await fs.readFile(path.join(legacy, 'catalog.js'));
  const script = path.join(__dirname, '..', 'scripts', 'repair-steam-screensaver.sh');
  execFileSync('sh', [script, f.steamRoot]);
  assert.deepEqual(await fs.readFile(path.join(canonical.path, 'catalog.js')), before);
  execFileSync('sh', [script, f.steamRoot]);
  await fs.rm(canonical.path, { recursive: true });
  await fs.mkdir(legacy);
  await fs.writeFile(path.join(legacy, 'keep'), 'unrelated');
  assert.notEqual(spawnSync('sh', [script, f.steamRoot]).status, 0);
  assert.equal(await fs.readFile(path.join(legacy, 'keep'), 'utf8'), 'unrelated');
});
test('export retains cover credits and position, chooses smoothing only when enabled, and omits stale cover files', async (t) => {
  const f = await fixture(t),
    game = f.games[0];
  await fs.writeFile(path.join(f.dataDir, 'media', 'cover.png'), 'static cover');
  await fs.writeFile(path.join(f.dataDir, 'media', 'smooth.webm'), 'interpolated');
  game.media.sha256 = 'original-hash';
  game.cover = { file: 'cover.png', animated: false, author: { name: 'Cover artist' } };
  game.smoothed = { ...game.media, file: 'smooth.webm', format: 'webm' };
  f.settings = { ...f.settings, showCover: true, coverPosition: 'top-left', smoothMotion: true };
  const read = async () => {
    const result = await install(f),
      context = { window: {} };
    vm.runInNewContext(await fs.readFile(path.join(result.path, 'catalog.js'), 'utf8'), context);
    return context.window.CINEMA_CATALOG;
  };
  let catalog = await read();
  assert.equal(catalog.games[0].media.file, 'media/smooth.webm');
  assert.equal(catalog.games[0].cover.file, 'media/cover.png');
  assert.equal(catalog.games[0].cover.author.name, 'Cover artist');
  assert.equal(catalog.settings.coverPosition, 'top-left');
  f.settings.smoothMotion = false;
  catalog = await read();
  assert.equal(catalog.games[0].media.file, 'media/animation.gif');
  await fs.rm(path.join(f.dataDir, 'media', 'cover.png'));
  catalog = await read();
  assert.equal(catalog.games[0].cover, null);
});
