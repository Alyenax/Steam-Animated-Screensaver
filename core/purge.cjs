'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const CACHE_FOLDERS = ['media', 'sources', 'processed', 'thumbnails'];
const FRAME_OWNER = 'steamos-animated-screensaver-v1';
async function stat(file) {
  try {
    return await fs.lstat(file);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}
// Inspect every cache before deleting any file. Never follow a link or recurse
// into a folder whose purpose/ownership is unknown.
async function planPurge(dataDir) {
  const files = [],
    folders = [];
  let bytes = 0;
  for (const name of CACHE_FOLDERS) {
    const folder = path.join(dataDir, name),
      info = await stat(folder);
    if (!info) continue;
    if (!info.isDirectory() || info.isSymbolicLink())
      throw new Error('Unsafe media directory. No cached media was removed.');
    for (const entry of await fs.readdir(folder, { withFileTypes: true })) {
      const file = path.join(folder, entry.name),
        item = await fs.lstat(file);
      if (item.isFile() && !item.isSymbolicLink()) {
        files.push(file);
        bytes += item.size;
        continue;
      }
      if (
        name === 'media' &&
        item.isDirectory() &&
        !item.isSymbolicLink() &&
        /^[0-9a-f-]{36}\.frames$/.test(entry.name)
      ) {
        const marker = path.join(file, '.cinema-smoothing-work'),
          owned = await stat(marker);
        if (
          owned?.isFile() &&
          !owned.isSymbolicLink() &&
          owned.size === FRAME_OWNER.length &&
          (await fs.readFile(marker, 'utf8')) === FRAME_OWNER
        ) {
          const members = [];
          for (const child of await fs.readdir(file)) {
            const target = path.join(file, child),
              detail = await fs.lstat(target);
            if (!detail.isFile() || detail.isSymbolicLink())
              throw new Error('Unsafe interpolation work folder. No cached media was removed.');
            members.push(target);
            bytes += detail.size;
          }
          files.push(...members);
          folders.push(file);
          continue;
        }
      }
      throw new Error(
        'An unknown folder or link exists in the media cache. No cached media was removed.'
      );
    }
  }
  return { files, folders, bytes };
}
async function applyPurge(plan) {
  // unlink removes only these exact files; it cannot traverse a nested folder.
  for (const file of plan.files) await fs.unlink(file);
  for (const folder of plan.folders) await fs.rmdir(folder);
  return { files: plan.files.length, bytes: plan.bytes };
}
module.exports = { planPurge, applyPurge };
