'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { isSteamComponent } = require('./steam-components.cjs');
const { smoothingMatches } = require('./smoothing.cjs');
// Steam maps installed screensaver directories to virtual HTTPS host names.
// Keep this filesystem identifier a valid lower-case DNS label; the UI title is separate.
const NAME = 'steam-animated-screensaver';
const { LEGACY_NAME, LEGACY_SLUG } = require('./branding.cjs');
const LEGACY_NAMES = [LEGACY_SLUG, LEGACY_NAME];
const MARKER = '.steam-animated-screensaver.json';
const OWNER = 'steam-animated-screensaver';
async function directory(steamRoot, create = false) {
  const root = await fs.realpath(steamRoot);
  if (!(await fs.stat(root)).isDirectory()) throw new Error('Steam root is not a directory.');
  let current = root;
  for (const part of ['config', 'uioverrides', 'screensavers']) {
    current = path.join(current, part);
    if (create)
      await fs.mkdir(current).catch((e) => {
        if (e.code !== 'EEXIST') throw e;
      });
    try {
      const s = await fs.lstat(current);
      if (s.isSymbolicLink() || !s.isDirectory())
        throw new Error('Steam screensaver path contains an unsafe link or file.');
    } catch (e) {
      if (e.code === 'ENOENT' && !create) return null;
      throw e;
    }
  }
  return current;
}
async function owned(target) {
  try {
    const s = await fs.lstat(target);
    if (!s.isDirectory() || s.isSymbolicLink()) return false;
    for (const [name, owner] of [
      [MARKER, OWNER],
      ['.steamos-animated-screensaver.json', LEGACY_SLUG]
    ]) {
      const marker = path.join(target, name),
        m = await fs.lstat(marker).catch(() => null);
      if (!m?.isFile() || m.isSymbolicLink() || m.size > 1024) continue;
      try {
        if (JSON.parse(await fs.readFile(marker, 'utf8')).owner === owner) return true;
      } catch {}
    }
    return false;
  } catch {
    return false;
  }
}
function safeName(name) {
  return (
    typeof name === 'string' &&
    /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,180}$/.test(name) &&
    !name.includes('..')
  );
}
async function copyMedia(dataDir, name, destination) {
  if (!safeName(name)) throw new Error('Unsafe media filename in catalog.');
  const parent = await fs.lstat(path.join(dataDir, 'media'));
  if (!parent.isDirectory() || parent.isSymbolicLink())
    throw new Error('Prepared media directory is unsafe.');
  const source = path.join(dataDir, 'media', name),
    s = await fs.lstat(source);
  if (!s.isFile() || s.isSymbolicLink() || !s.size)
    throw new Error('Prepared media is missing or unsafe.');
  await fs.copyFile(source, path.join(destination, name));
}
async function lock(parent, fn) {
  // Hold both identifiers so an older Manager cannot update its export concurrently.
  const acquired = [];
  try {
    for (const name of [NAME, LEGACY_SLUG]) {
      const target = path.join(parent, `.${name}.lock`);
      try {
        await fs.mkdir(target);
      } catch (e) {
        if (e.code === 'EEXIST')
          throw new Error(
            `Another screensaver installation is in progress. Close the other Manager; if none is running, remove the stale .${name}.lock folder.`
          );
        throw e;
      }
      acquired.push(target);
    }
    return await fn();
  } finally {
    for (const target of acquired.reverse()) await fs.rmdir(target).catch(() => {});
  }
}

async function install({ dataDir, steamRoot, games, settings = {} }) {
  const parent = await directory(steamRoot, true);
  return lock(parent, async () => {
    const target = path.join(parent, NAME),
      token = crypto.randomUUID(),
      staging = path.join(parent, `.screensaver-stage-${token}`),
      backup = path.join(parent, `.screensaver-backup-${token}`);
    let moved = false;
    try {
      const exists = await fs.lstat(target).then(
        () => true,
        (err) => {
          if (err.code === 'ENOENT') return false;
          throw err;
        }
      );
      if (exists && !(await owned(target)))
        throw new Error(
          'The screensaver destination belongs to another installation. It was left untouched.'
        );
      const included = games.filter(
        (g) =>
          !isSteamComponent(g) &&
          g.included &&
          g.status === 'ready' &&
          g.media &&
          (g.media.animated || settings.staticFallback)
      );
      if (!included.length)
        throw new Error('Prepare and include at least one artwork before installing.');
      await fs.mkdir(staging);
      await fs.mkdir(path.join(staging, 'media'));
      for (const file of ['index.html', 'player.js', 'player.css'])
        await fs.copyFile(path.join(__dirname, '..', 'player', file), path.join(staging, file));
      const copied = new Set(),
        catalogGames = [];
      for (const original of included) {
        const game = {
          ...original,
          media:
            settings.smoothMotion &&
            original.smoothed &&
            original.smoothed.sha256 === original.media.sha256 &&
            smoothingMatches(original.smoothed, settings)
              ? original.smoothed
              : original.media
        };
        let cover = null;
        if (original.cover?.animated === false) {
          try {
            if (!copied.has(original.cover.file))
              await copyMedia(dataDir, original.cover.file, path.join(staging, 'media'));
            copied.add(original.cover.file);
            cover = {
              file: `media/${original.cover.file}`,
              animated: false,
              author: { name: String(original.cover.author?.name || 'Unknown') }
            };
          } catch (error) {
            if (!['ENOENT'].includes(error.code)) throw error;
          }
        }
        for (const file of [game.media.file, game.media.thumbnail])
          if (!copied.has(file)) {
            await copyMedia(dataDir, file, path.join(staging, 'media'));
            copied.add(file);
          }
        const m = game.media;
        catalogGames.push({
          id: String(game.id),
          name: String(game.name),
          included: true,
          crop: game.crop || null,
          status: 'ready',
          cover,
          media: {
            file: `media/${m.file}`,
            thumbnail: `media/${m.thumbnail}`,
            width: m.width,
            height: m.height,
            duration: m.duration,
            format: m.format,
            animated: m.animated,
            author: { name: String(m.author?.name || 'Unknown') }
          }
        });
      }
      const cleanSettings = {};
      for (const key of [
        'language',
        'sceneDuration',
        'shuffle',
        'transition',
        'showLogos',
        'showCover',
        'coverPosition',
        'framing',
        'staticFallback',
        'reducedMotion'
      ])
        if (settings[key] !== undefined) cleanSettings[key] = settings[key];
      const catalog = JSON.stringify({ version: 1, games: catalogGames, settings: cleanSettings })
        .replace(/</g, '\\u003c')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
      await fs.writeFile(path.join(staging, 'catalog.js'), `window.SAS_CATALOG=${catalog};\n`, {
        mode: 0o600
      });
      await fs.writeFile(
        path.join(staging, MARKER),
        JSON.stringify({ owner: OWNER, version: 1, installedAt: new Date().toISOString() }),
        { mode: 0o600 }
      );
      if (exists) {
        await fs.rename(target, backup);
        moved = true;
      }
      try {
        await fs.rename(staging, target);
      } catch (e) {
        if (moved) await fs.rename(backup, target);
        throw e;
      }
      if (moved) await fs.rm(backup, { recursive: true, force: true });
      // Retire the old, space-containing identifier only after the new installation commits.
      // A failed preparation/staging step therefore preserves the previous playable files.
      for (const legacyName of LEGACY_NAMES) {
        const legacy = path.join(parent, legacyName);
        if (await owned(legacy)) {
          const retired = path.join(parent, `.screensaver-retired-${token}`);
          await fs.rename(legacy, retired);
          await fs.rm(retired, { recursive: true, force: true });
        }
      }
      return { installed: true, path: target, games: catalogGames.length };
    } finally {
      await fs.rm(staging, { recursive: true, force: true });
    }
  });
}
async function assertCanUninstall(steamRoot) {
  const parent = await directory(steamRoot);
  if (!parent) return;
  const target = path.join(parent, NAME);
  const exists = await fs.lstat(target).then(
    () => true,
    (e) => {
      if (e.code === 'ENOENT') return false;
      throw e;
    }
  );
  if (exists && !(await owned(target)))
    throw new Error('The screensaver destination is not owned by this app. It was left untouched.');
}
async function uninstall({ steamRoot }) {
  const parent = await directory(steamRoot);
  if (!parent) return { installed: false };
  return lock(parent, async () => {
    const target = path.join(parent, NAME);
    const exists = await fs.lstat(target).then(
      () => true,
      (e) => {
        if (e.code === 'ENOENT') return false;
        throw e;
      }
    );
    if (exists && !(await owned(target)))
      throw new Error(
        'The screensaver destination is not owned by this app. It was left untouched.'
      );
    for (const folder of [target, ...LEGACY_NAMES.map((name) => path.join(parent, name))]) {
      if (!(await owned(folder))) continue;
      const tomb = path.join(parent, `.screensaver-remove-${crypto.randomUUID()}`);
      await fs.rename(folder, tomb);
      await fs.rm(tomb, { recursive: true, force: true });
    }
    return { installed: false };
  });
}
async function isInstalled(steamRoot) {
  try {
    const parent = await directory(steamRoot);
    return (
      !!parent &&
      (
        await Promise.all([NAME, ...LEGACY_NAMES].map((name) => owned(path.join(parent, name))))
      ).some(Boolean)
    );
  } catch {
    return false;
  }
}
module.exports = {
  install,
  uninstall,
  isInstalled,
  assertCanUninstall,
  NAME,
  LEGACY_NAME,
  LEGACY_NAMES,
  MARKER
};
