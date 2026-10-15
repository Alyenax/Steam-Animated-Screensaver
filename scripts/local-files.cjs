'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.webm': 'video/webm',
  '.svg': 'image/svg+xml'
};
const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://cdn2.steamgriddb.com https://cdn.steamgriddb.com https://www.steamgriddb.com; media-src 'self'; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'";
async function resolveFile(raw, { root, dataDir }) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(raw, 'http://localhost').pathname);
  } catch {
    return null;
  }
  if (pathname === '/') pathname = '/manager/index.html';
  const parts = pathname.split('/').filter(Boolean);
  const kind = parts.shift();
  if (
    !['manager', 'player', 'media'].includes(kind) ||
    !parts.length ||
    parts.some((x) => x === '.' || x === '..' || x.includes('\\') || x.includes('\0'))
  )
    return null;
  if (kind === 'media' && parts.length !== 1) return null;
  const base = kind === 'media' ? path.join(dataDir, 'media') : path.join(root, kind);
  try {
    const [realBase, realFile] = await Promise.all([
      fs.realpath(base),
      fs.realpath(path.join(base, ...parts))
    ]);
    if (!realFile.startsWith(realBase + path.sep)) return null;
    const stat = await fs.stat(realFile);
    if (!stat.isFile()) return null;
    const type = MIME[path.extname(realFile).toLowerCase()];
    if (!type || (kind === 'media' && !/^(image|video)\//.test(type))) return null;
    return { file: realFile, type, size: stat.size };
  } catch {
    return null;
  }
}
module.exports = { resolveFile, CSP };
