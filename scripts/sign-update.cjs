'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { TARGETS, PRODUCT, assetName, readManifest } = require('../core/update-format.cjs');
const { treeInfo } = require('../core/update-archive.cjs');
const { hashFile } = require('../core/app-updates.cjs');
async function signUpdate({ directory, keyPath } = {}) {
  const root = path.resolve(__dirname, '..'),
    version = require('../package.json').version;
  directory ||= path.join(root, 'dist', `release-v${version}`);
  keyPath ||=
    process.env.SAS_UPDATE_SIGNING_KEY ||
    path.join(root, '.release-secrets', 'update-signing-key.pem');
  const keyStat = await fs.lstat(keyPath);
  if (
    !keyStat.isFile() ||
    keyStat.isSymbolicLink() ||
    (process.platform !== 'win32' && keyStat.mode & 0o077)
  )
    throw new Error('The local signing key must be a private regular file.');
  const key = crypto.createPrivateKey(await fs.readFile(keyPath)),
    publicKey = crypto.createPublicKey(key).export({ type: 'spki', format: 'pem' });
  if (publicKey !== require('../core/update-key.cjs'))
    throw new Error('The signing key does not match the shipped verification key.');
  const directories = {
    'darwin-arm64': path.join(
      root,
      'dist',
      'Steam Animated Screensaver-darwin-arm64',
      TARGETS['darwin-arm64'].root
    ),
    'win32-x64': path.join(root, 'dist', TARGETS['win32-x64'].root),
    'linux-x64': path.join(root, 'dist', TARGETS['linux-x64'].root),
    'steamos-x64': path.join(root, 'dist', TARGETS['linux-x64'].root)
  };
  const assets = [];
  for (const target of Object.keys(TARGETS)) {
    const name = assetName(version, target),
      file = path.join(directory, name);
    assets.push({
      target,
      name,
      size: (await fs.stat(file)).size,
      sha256: await hashFile(file),
      unpackedBytes: (await treeInfo(directories[target])).bytes
    });
  }
  const payload = Buffer.from(
    JSON.stringify({
      schema: 1,
      product: PRODUCT,
      version,
      tag: `v${version}`,
      minimumUpdater: 1,
      commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
      assets
    })
  );
  const envelope = {
    schema: 1,
    keyId: 'release-1',
    payload: payload.toString('base64'),
    signature: crypto.sign(null, payload, key).toString('base64')
  };
  const bytes = Buffer.from(JSON.stringify(envelope, null, 2) + '\n');
  readManifest(bytes, { version });
  await fs.writeFile(path.join(directory, 'update.json'), bytes);
  return {
    version,
    assets: assets.map((a) => ({ target: a.target, bytes: a.size })),
    signed: true
  };
}
module.exports = { signUpdate };
if (require.main === module)
  signUpdate({ directory: process.argv[2] })
    .then((r) => console.log(JSON.stringify(r, null, 2)))
    .catch((e) => {
      console.error(e.message);
      process.exitCode = 1;
    });
