'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

// KeyValues is a token stream: quoted strings, bare tokens, braces and // comments.
function parseVdf(text) {
  if (typeof text !== 'string' || text.length > 8 * 1024 * 1024)
    throw new Error('Invalid or oversized Steam manifest');
  const tokens = [];
  let i = 0;
  while (i < text.length) {
    if (/\s/.test(text[i])) {
      i++;
      continue;
    }
    if (text.slice(i, i + 2) === '//') {
      while (i < text.length && text[i] !== '\n') i++;
      continue;
    }
    if (text[i] === '{' || text[i] === '}') {
      tokens.push(text[i++]);
      continue;
    }
    if (text[i] === '"') {
      let value = '';
      i++;
      let ended = false;
      while (i < text.length) {
        const c = text[i++];
        if (c === '"') {
          ended = true;
          break;
        }
        if (c === '\\' && i < text.length) {
          const next = text[i++];
          value += next === '\\' || next === '"' ? next : next === 'n' ? '\n' : '\\' + next;
        } else value += c;
      }
      if (!ended) throw new Error('Unterminated Steam manifest string');
      tokens.push({ value });
      continue;
    }
    const start = i;
    while (i < text.length && !/[\s{}]/.test(text[i])) i++;
    tokens.push({ value: text.slice(start, i) });
  }
  let pos = 0;
  function object(nested = false, depth = 0) {
    if (depth > 32) throw new Error('Steam manifest nesting limit');
    const out = Object.create(null);
    while (pos < tokens.length) {
      if (tokens[pos] === '}') {
        if (!nested) throw new Error('Unexpected closing brace');
        pos++;
        return out;
      }
      const key = tokens[pos++];
      if (!key || typeof key !== 'object') throw new Error('Invalid manifest key');
      const val = tokens[pos++];
      if (val === '{') out[key.value.toLowerCase()] = object(true, depth + 1);
      else if (val && typeof val === 'object') out[key.value.toLowerCase()] = val.value;
      else throw new Error('Missing manifest value');
    }
    if (nested) throw new Error('Unclosed manifest object');
    return out;
  }
  return object();
}
function defaultRoots(home = os.homedir()) {
  return [
    ...new Set(
      [
        process.env.STEAM_ROOT,
        path.join(home, '.steam/root'),
        path.join(home, '.steam/steam'),
        path.join(home, '.local/share/Steam'),
        path.join(home, '.var/app/com.valvesoftware.Steam/.local/share/Steam'),
        path.join(home, 'Library/Application Support/Steam')
      ].filter(Boolean)
    )
  ];
}
const utility =
  /\b(proton(?:\s|$)|steamworks|steam linux runtime|steamworks shared|redistributables?|dedicated server|sdk|soundtrack|benchmark|wallpaper engine)\b/i;
function classify(name) {
  return utility.test(name)
    ? 'utility'
    : /\b(demo|playtest|beta test)\b/i.test(name)
      ? 'demo'
      : 'game';
}
async function readSmall(file) {
  const s = await fs.stat(file);
  if (s.size > 8 * 1024 * 1024) throw new Error('Manifest too large');
  return fs.readFile(file, 'utf8');
}
async function scanSteam(roots = defaultRoots()) {
  const detected = [];
  const libraries = new Set();
  const warnings = [];
  const games = new Map();
  for (const root of roots) {
    let real;
    try {
      real = await fs.realpath(root);
      if (!(await fs.stat(path.join(real, 'steamapps'))).isDirectory()) continue;
    } catch {
      continue;
    }
    if (!detected.includes(real)) detected.push(real);
    libraries.add(real);
    try {
      const vdf = parseVdf(await readSmall(path.join(real, 'steamapps/libraryfolders.vdf')));
      for (const [key, value] of Object.entries(vdf.libraryfolders || {})) {
        if (!/^\d+$/.test(key)) continue;
        const folder = typeof value === 'string' ? value : value.path;
        if (typeof folder === 'string' && path.isAbsolute(folder))
          libraries.add(await fs.realpath(folder).catch(() => folder));
      }
    } catch (e) {
      if (e.code !== 'ENOENT') warnings.push('Could not read a Steam library configuration.');
    }
  }
  for (const library of libraries) {
    let names;
    try {
      names = await fs.readdir(path.join(library, 'steamapps'));
    } catch {
      warnings.push('A configured Steam library is unavailable.');
      continue;
    }
    for (const name of names.filter((n) => /^appmanifest_\d+\.acf$/.test(n)).sort()) {
      try {
        const app = parseVdf(await readSmall(path.join(library, 'steamapps', name))).appstate;
        const id = Number(app?.appid),
          gameName = app?.name?.trim();
        if (!Number.isSafeInteger(id) || id <= 0 || name !== `appmanifest_${id}.acf` || !gameName)
          throw new Error('Invalid AppState');
        // FullyInstalled is bit 4. Download-only and uninstalled manifests are not installed games.
        const installed = (Number(app.stateflags) & 4) !== 0;
        if (!installed) continue;
        const classification = classify(gameName);
        if (!games.has(id))
          games.set(id, {
            id: `steam:${id}`,
            steamAppId: id,
            sgdbId: null,
            name: gameName,
            installed: true,
            sources: ['installed'],
            included: classification === 'game',
            classification,
            status: 'new',
            selectedAsset: null,
            manualSelection: false,
            media: null
          });
      } catch {
        warnings.push(`Skipped malformed manifest ${name}.`);
      }
    }
  }
  return {
    games: [...games.values()].sort((a, b) => a.name.localeCompare(b.name, 'en')),
    roots: detected,
    detected: detected.length > 0,
    warnings
  };
}
async function isSteamGameRunning(procRoot = '/proc') {
  let dirs;
  try {
    dirs = await fs.readdir(procRoot);
  } catch {
    return false;
  }
  for (const pid of dirs.filter((n) => /^\d+$/.test(n)).slice(0, 32768)) {
    if (Number(pid) === process.pid) continue;
    try {
      const env = await fs.readFile(path.join(procRoot, pid, 'environ'));
      const match = env.toString().match(/(?:^|\0)(?:SteamAppId|SteamGameId)=([1-9]\d*)(?:\0|$)/);
      if (!match || Number(match[1]) >= 2 ** 31) continue; // Non-Steam shortcut game IDs are not Steam AppIDs.
      let parent = Number(pid),
        ownChild = false;
      for (let hop = 0; hop < 32 && parent > 1; hop++) {
        const status = await fs
          .readFile(path.join(procRoot, String(parent), 'status'), 'utf8')
          .catch(() => null);
        if (!status) break;
        parent = Number(status.match(/^PPid:\s+(\d+)/m)?.[1]) || 0;
        if (parent === process.pid) {
          ownChild = true;
          break;
        }
      }
      if (!ownChild) return true;
    } catch {}
  }
  return false;
}
module.exports = { parseVdf, scanSteam, defaultRoots, classify, isSteamGameRunning };
