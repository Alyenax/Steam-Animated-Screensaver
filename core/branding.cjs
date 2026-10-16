'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const NAME = 'Steam Animated Screensaver';
const SLUG = 'steam-animated-screensaver';
// These identifiers are retained only for migrating existing user data/exports.
const LEGACY_SLUG = 'steamos-animated-screensaver';
const LEGACY_NAME = 'SteamOS Animated Screensaver';
async function dataDirectory(appData) {
  const target = path.join(appData, SLUG),
    legacy = path.join(appData, LEGACY_SLUG);
  try {
    const current = await fs.lstat(target);
    if (!current.isDirectory() || current.isSymbolicLink())
      throw new Error('The application data folder is unsafe.');
    return target;
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  let previous;
  try {
    previous = await fs.lstat(legacy);
  } catch (e) {
    if (e.code === 'ENOENT') return target;
    throw e;
  }
  if (!previous.isDirectory() || previous.isSymbolicLink())
    throw new Error('The previous application data folder is unsafe.');
  const marker = path.join(legacy, '.manager.lock');
  try {
    const info = await fs.lstat(marker);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 1024)
      throw new Error('Close the previous Manager before migrating its data.');
    const lock = JSON.parse(await fs.readFile(marker, 'utf8'));
    if (!Number.isSafeInteger(lock.pid) || lock.pid < 1)
      throw new Error('Close the previous Manager before migrating its data.');
    let active = true;
    try {
      process.kill(lock.pid, 0);
    } catch (e) {
      if (e.code === 'ESRCH') active = false;
    }
    if (active)
      throw new Error('Close the previous Manager before opening Steam Animated Screensaver.');
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  await fs.rename(legacy, target);
  return target;
}
module.exports = { NAME, SLUG, LEGACY_NAME, LEGACY_SLUG, dataDirectory };
