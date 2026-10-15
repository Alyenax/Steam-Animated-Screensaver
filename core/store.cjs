'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
async function atomicWrite(file, value, { mode = 0o600 } = {}) {
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temp = `${file}.${crypto.randomUUID()}.tmp`;
  let handle;
  try {
    handle = await fs.open(temp, 'wx', mode);
    await handle.writeFile(value);
    await handle.sync();
    await handle.close();
    handle = null;
    await fs.rename(temp, file);
    await fs.chmod(file, mode);
  } finally {
    await handle?.close().catch(() => {});
    await fs.rm(temp, { force: true }).catch(() => {});
  }
}
async function readJSON(file, fallback, { onCorrupt } = {}) {
  try {
    const s = await fs.stat(file);
    if (s.size > 32 * 1024 * 1024) throw new Error('Catalog size limit exceeded');
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return fallback;
    if (e instanceof SyntaxError) {
      const recoveryFile = `${file}.corrupt-${Date.now()}`;
      await fs.rename(file, recoveryFile);
      onCorrupt?.(recoveryFile);
      return fallback;
    }
    throw e;
  }
}
async function acquireLock(dataDir) {
  await fs.mkdir(dataDir, { recursive: true, mode: 0o700 });
  const file = path.join(dataDir, '.manager.lock');
  const token = crypto.randomUUID();
  for (let n = 0; n < 2; n++) {
    try {
      const h = await fs.open(file, 'wx', 0o600);
      await h.writeFile(JSON.stringify({ pid: process.pid, token }));
      await h.close();
      return async () => {
        const lock = await readJSON(file, null);
        if (lock?.token === token) await fs.rm(file, { force: true });
      };
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      const lock = await readJSON(file, null);
      let active = true;
      if (lock && Number.isInteger(lock.pid)) {
        try {
          process.kill(lock.pid, 0);
        } catch (err) {
          active = err.code !== 'ESRCH';
        }
      }
      if (active)
        throw new Error(
          'Another Screensaver Manager is using this library. Close it before continuing.'
        );
      await fs.rm(file, { force: true });
    }
  }
  throw new Error('Could not acquire library lock');
}
async function storageBytes(dataDir) {
  let total = 0;
  for (const dir of ['media', 'sources', 'processed', 'thumbnails']) {
    const walk = async (p, depth = 0) => {
      if (depth > 6) return;
      for (const e of await fs.readdir(p, { withFileTypes: true }).catch(() => [])) {
        const file = path.join(p, e.name);
        if (e.isDirectory()) await walk(file, depth + 1);
        else if (e.isFile()) total += (await fs.stat(file)).size;
      }
    };
    const folder = path.join(dataDir, dir);
    const stat = await fs.lstat(folder).catch(() => null);
    if (stat?.isDirectory() && !stat.isSymbolicLink()) await walk(folder);
  }
  return total;
}
function safeFilename(file) {
  return (
    typeof file === 'string' &&
    file.length > 0 &&
    file.length < 240 &&
    /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(file) &&
    !file.includes('..')
  );
}
module.exports = { atomicWrite, readJSON, acquireLock, storageBytes, safeFilename };
