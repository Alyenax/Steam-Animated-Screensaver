'use strict';
const crypto = require('node:crypto');
const PUBLIC_KEY = require('./update-key.cjs');
const PRODUCT = 'steam-animated-screensaver';
const REPO = 'Alyenax/Steam-Animated-Screensaver';
const API = `https://api.github.com/repos/${REPO}/releases/latest`;
const MAX_ARCHIVE = 1024 * 1024 * 1024;
const MAX_UNPACKED = 4 * MAX_ARCHIVE;
const TARGETS = {
  'linux-x64': {
    suffix: 'linux-x64.tar.gz',
    root: 'steam-animated-screensaver-linux-x64',
    executable: 'steam-animated-screensaver',
    package: 'resources/app/package.json'
  },
  'steamos-x64': {
    suffix: 'steamos-x64.tar.gz',
    root: 'steam-animated-screensaver-linux-x64',
    executable: 'steam-animated-screensaver',
    package: 'resources/app/package.json'
  },
  'win32-x64': {
    suffix: 'windows-x64.zip',
    root: 'Steam Animated Screensaver-win32-x64',
    executable: 'Steam Animated Screensaver.exe',
    package: 'resources/app/package.json'
  },
  'darwin-arm64': {
    suffix: 'macos-arm64.dmg',
    root: 'Steam Animated Screensaver.app',
    executable: 'Contents/MacOS/steam-animated-screensaver',
    package: 'Contents/Resources/app/package.json'
  }
};
class UpdateError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}
function versionParts(value) {
  if (
    typeof value !== 'string' ||
    value.length > 64 ||
    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)
  )
    throw new UpdateError('version', 'Invalid stable release version.');
  return value.split('.').map(BigInt);
}
function compareVersions(a, b) {
  const x = versionParts(a),
    y = versionParts(b);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i] ? 1 : -1;
  return 0;
}
function assetName(version, target) {
  versionParts(version);
  if (!TARGETS[target])
    throw new UpdateError('platform', 'This platform is not supported by the updater.');
  return `Steam-Animated-Screensaver-${version}-${TARGETS[target].suffix}`;
}
function releaseAsset(release, name) {
  const matches = (release.assets || []).filter((a) => a?.name === name && a.state === 'uploaded');
  if (matches.length !== 1)
    throw new UpdateError('asset', 'The release is missing a unique required download.');
  const a = matches[0],
    u = new URL(a.browser_download_url);
  if (
    u.origin !== 'https://github.com' ||
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    u.pathname !== `/${REPO}/releases/download/${release.tag_name}/${name}` ||
    !Number.isSafeInteger(a.size) ||
    a.size < 1 ||
    a.size > MAX_ARCHIVE
  )
    throw new UpdateError('asset', 'The release download is not valid.');
  return { name, url: u.href, size: a.size, digest: a.digest || '' };
}
function readManifest(bytes, { publicKey = PUBLIC_KEY, target, version } = {}) {
  if (bytes.length > 65536) throw new UpdateError('manifest', 'The update manifest is too large.');
  try {
    const envelope = JSON.parse(bytes.toString('utf8'));
    if (
      envelope.schema !== 1 ||
      envelope.keyId !== 'release-1' ||
      typeof envelope.payload !== 'string' ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(envelope.payload) ||
      typeof envelope.signature !== 'string'
    )
      throw new Error();
    const payload = Buffer.from(envelope.payload, 'base64'),
      sig = Buffer.from(envelope.signature, 'base64');
    if (sig.length !== 64 || !crypto.verify(null, payload, publicKey, sig))
      throw new UpdateError('signature', 'The update signature is invalid.');
    const m = JSON.parse(payload.toString('utf8'));
    versionParts(m.version);
    if (
      m.schema !== 1 ||
      m.product !== PRODUCT ||
      m.tag !== `v${m.version}` ||
      m.minimumUpdater !== 1 ||
      (version && m.version !== version) ||
      !Array.isArray(m.assets) ||
      m.assets.length !== 4
    )
      throw new Error();
    const seen = new Set();
    for (const a of m.assets) {
      if (
        !TARGETS[a.target] ||
        seen.has(a.target) ||
        a.name !== assetName(m.version, a.target) ||
        !/^[a-f0-9]{64}$/.test(a.sha256) ||
        !Number.isSafeInteger(a.size) ||
        a.size < 1 ||
        a.size > MAX_ARCHIVE ||
        !Number.isSafeInteger(a.unpackedBytes) ||
        a.unpackedBytes < 1 ||
        a.unpackedBytes > MAX_UNPACKED
      )
        throw new Error();
      seen.add(a.target);
    }
    if (target && !seen.has(target))
      throw new UpdateError('platform', 'No update is available for this platform.');
    return m;
  } catch (e) {
    if (e instanceof UpdateError) throw e;
    throw new UpdateError('manifest', 'The signed update manifest is invalid.');
  }
}
module.exports = {
  PRODUCT,
  REPO,
  API,
  MAX_ARCHIVE,
  MAX_UNPACKED,
  TARGETS,
  UpdateError,
  compareVersions,
  assetName,
  releaseAsset,
  readManifest
};
