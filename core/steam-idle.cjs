'use strict';
const fs = require('node:fs/promises');
const { constants } = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { promisify, isDeepStrictEqual } = require('node:util');
const execFile = promisify(require('node:child_process').execFile);
const { parseVdf } = require('./scanner.cjs');

const supported = (platform) => ['darwin', 'win32', 'linux'].includes(platform);
const keys = ['IdleScreensaverACSeconds', 'IdleScreensaverBatterySeconds'];
const defaults = [300, 0]; // Stable Steam 1791918634's native setting descriptors.
const branches = ['InstallConfigStore', 'Software', 'Valve', 'Steam', 'System'];
const limit = 8 * 1024 * 1024;

// Keep token offsets so that credentials, comments and unrelated settings are never reserialized.
function tree(text) {
  parseVdf(text);
  const tokens = [];
  const expression = /\s+|\/\/[^\r\n]*|"(?:\\[\s\S]|[^"\\])*"|[{}]|[^\s{}"]+/gy;
  let match;
  while ((match = expression.exec(text))) {
    const raw = match[0];
    if (/^\s|^\/\//.test(raw)) continue;
    const value = raw.startsWith('"')
      ? raw
          .slice(1, -1)
          .replace(/\\([\s\S])/g, (_, c) =>
            c === 'n' ? '\n' : ['\\', '"'].includes(c) ? c : '\\' + c
          )
      : raw;
    tokens.push({
      value,
      brace: raw === '{' || raw === '}',
      start: match.index,
      end: expression.lastIndex
    });
  }
  let i = 0;
  function object() {
    const result = { entries: [], close: text.length };
    while (i < tokens.length) {
      if (tokens[i].brace && tokens[i].value === '}') {
        result.close = tokens[i++].start;
        return result;
      }
      const key = tokens[i++],
        value = tokens[i++];
      result.entries.push({
        key: key.value,
        value,
        child: value.brace && value.value === '{' ? object() : null
      });
    }
    return result;
  }
  return object();
}
function entry(node, key) {
  const matches = node.entries.filter((e) => e.key.toLowerCase() === key.toLowerCase());
  if (matches.length > 1) throw new Error('Ambiguous Steam settings. No changes were made.');
  return matches[0];
}
function patchTimeouts(text, values) {
  if (
    !values ||
    !['acSeconds', 'batterySeconds'].every(
      (k) => Number.isSafeInteger(values[k]) && values[k] >= 0 && values[k] <= 86400
    )
  )
    throw new Error('Choose a Steam timeout between 0 and 86400 seconds.');
  const seconds = [values.acSeconds, values.batterySeconds];
  let node = tree(text);
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const edits = [];
  for (let depth = 0; depth < branches.length; depth++) {
    const found = entry(node, branches[depth]);
    if (!found) {
      if (depth === 0)
        throw new Error('Steam InstallConfigStore is missing. Open Steam once first.');
      let block = keys.map((k, n) => `"${k}"\t\t"${seconds[n]}"`).join(eol);
      for (let j = branches.length - 1; j >= depth; j--)
        block = `"${branches[j]}"${eol}{${eol}${block}${eol}}`;
      edits.push({ start: node.close, end: node.close, value: `${eol}${block}${eol}` });
      node = null;
      break;
    }
    if (!found.child) throw new Error('Invalid Steam settings structure. No changes were made.');
    node = found.child;
  }
  if (node) {
    for (let n = 0; n < keys.length; n++) {
      const found = entry(node, keys[n]);
      if (found?.child) throw new Error('Invalid Steam timeout. No changes were made.');
      if (found) {
        if (found.value.value !== String(seconds[n]))
          edits.push({ ...found.value, value: `"${seconds[n]}"` });
      } else
        edits.push({
          start: node.close,
          end: node.close,
          value: `${eol}"${keys[n]}"\t\t"${seconds[n]}"${eol}`
        });
    }
  }
  let result = text;
  for (const edit of edits.sort((a, b) => b.start - a.start))
    result = result.slice(0, edit.start) + edit.value + result.slice(edit.end);
  const expected = parseVdf(text);
  let target = expected;
  for (const branch of branches) target = target[branch.toLowerCase()] ||= Object.create(null);
  keys.forEach((key, n) => (target[key.toLowerCase()] = String(seconds[n])));
  if (!isDeepStrictEqual(parseVdf(result), expected))
    throw new Error('Steam settings verification failed. No changes were made.');
  return result;
}

async function isSteamRunning(platform = process.platform) {
  const windows = platform === 'win32';
  const { stdout } = await execFile(
    windows ? 'tasklist.exe' : 'ps',
    windows ? ['/FI', 'IMAGENAME eq steam.exe', '/FO', 'CSV', '/NH'] : ['-axo', 'comm='],
    { encoding: 'utf8', windowsHide: true, timeout: 5000, maxBuffer: 4 * 1024 * 1024 }
  );
  return windows
    ? /^"steam\.exe",/im.test(stdout)
    : stdout
        .split(/\r?\n/)
        .some((line) =>
          ['steam', 'steam_osx', 'steam.exe'].includes(path.basename(line.trim()).toLowerCase())
        );
}
async function configuration(root) {
  const real = await fs.realpath(root);
  const folder = path.join(real, 'config');
  const dir = await fs.lstat(folder);
  if (!dir.isDirectory() || dir.isSymbolicLink())
    throw new Error('Unsafe Steam configuration folder.');
  const filename = path.join(folder, 'config.vdf');
  const stat = await fs.lstat(filename);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > limit)
    throw new Error('Unsafe or oversized Steam configuration file.');
  const handle = await fs.open(filename, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    const opened = await handle.stat();
    if (opened.ino !== stat.ino || opened.dev !== stat.dev || opened.size > limit)
      throw new Error('Steam settings changed. Refresh and try again.');
    const bytes = await handle.readFile();
    if (bytes.length > limit) throw new Error('Oversized Steam configuration file.');
    const text = bytes.toString('utf8');
    if (!Buffer.from(text, 'utf8').equals(bytes))
      throw new Error('Steam settings are not valid UTF-8.');
    return { filename, folder, text, stat: opened };
  } finally {
    await handle.close();
  }
}
async function readTimeouts(root, options = {}) {
  const platform = options.platform || process.platform;
  if (!supported(platform)) return { available: false, platform };
  const { text } = await configuration(root);
  let node = tree(text);
  for (const branch of branches) {
    const found = node && entry(node, branch);
    if (found && !found.child) throw new Error('Invalid Steam settings structure.');
    node = found?.child;
  }
  const values = keys.map((key, n) => {
    const found = node && entry(node, key);
    if (!found) return { seconds: defaults[n], default: true };
    if (
      found.child ||
      !/^\d+$/.test(found.value.value) ||
      !Number.isSafeInteger(Number(found.value.value))
    )
      throw new Error('Invalid Steam timeout.');
    return { seconds: Number(found.value.value), default: false };
  });
  let running = null;
  try {
    running = await (options.isRunning || (() => isSteamRunning(platform)))();
  } catch {
    /* Fail closed on Apply. */
  }
  return {
    available: true,
    recommendedSeconds: 300,
    platform,
    running,
    acSeconds: values[0].seconds,
    batterySeconds: values[1].seconds,
    acDefault: values[0].default,
    batteryDefault: values[1].default
  };
}
async function writeTimeouts(root, values, options = {}) {
  const platform = options.platform || process.platform;
  if (!supported(platform))
    throw new Error('Steam timeout settings are unavailable on this platform.');
  const running = options.isRunning || (() => isSteamRunning(platform));
  async function requireClosed() {
    let active;
    try {
      active = await running();
    } catch {
      throw new Error('Cannot check whether Steam is closed. No changes were made.');
    }
    if (active !== false) throw new Error('Quit Steam completely, then apply the timeout again.');
  }
  await requireClosed();
  const original = await configuration(root);
  const result = patchTimeouts(original.text, values);
  if (result === original.text) return { ...(await readTimeouts(root, options)), changed: false };
  const id = `${Date.now()}-${randomUUID()}`;
  const backup = path.join(original.folder, `config.vdf.sas-idle-${id}.bak`);
  const temp = path.join(original.folder, `.sas-idle-${id}.tmp`);
  try {
    // These backups contain private Steam account configuration; never expose their contents.
    await fs.writeFile(backup, original.text, { flag: 'wx', mode: 0o600 });
    const handle = await fs.open(temp, 'wx', 0o600);
    try {
      await handle.writeFile(result, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    await requireClosed();
    const current = await configuration(root);
    if (
      current.text !== original.text ||
      current.stat.ino !== original.stat.ino ||
      current.stat.dev !== original.stat.dev
    )
      throw new Error('Steam settings changed. Refresh and try again.');
    await fs.rename(temp, original.filename);
    const verified = await configuration(root);
    if (verified.text !== result) throw new Error('Could not verify the saved Steam timeout.');
    return { ...(await readTimeouts(root, options)), changed: true, backedUp: true };
  } finally {
    await fs.rm(temp, { force: true });
  }
}
module.exports = { patchTimeouts, readTimeouts, writeTimeouts, isSteamRunning };
