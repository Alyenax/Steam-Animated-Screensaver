'use strict';
// Every release must contain one current package per platform; macOS also supplies a ZIP.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const assert = require('node:assert/strict');
async function fileTree(root, relative = '', result = {}) {
  for (const entry of (await fs.readdir(path.join(root, relative), { withFileTypes: true })).sort(
    (a, b) => a.name.localeCompare(b.name)
  )) {
    const name = path.join(relative, entry.name),
      file = path.join(root, name);
    if (entry.isSymbolicLink()) result[name] = { link: await fs.readlink(file) };
    else if (entry.isDirectory()) await fileTree(root, name, result);
    else {
      const hash = crypto.createHash('sha256');
      for await (const chunk of require('node:fs').createReadStream(file)) hash.update(chunk);
      result[name] = {
        sha256: hash.digest('hex'),
        executable: !!((await fs.stat(file)).mode & 0o111)
      };
    }
  }
  return result;
}
const { execFileSync } = require('node:child_process');
async function check() {
  const root = path.resolve(__dirname, '..'),
    dist = path.join(root, 'dist'),
    pkg = require('../package.json');
  if (pkg.name !== 'steam-animated-screensaver' || pkg.productName !== 'Steam Animated Screensaver')
    throw new Error('Product branding mismatch.');
  const prefix = `Steam-Animated-Screensaver-${pkg.version}`;
  const suffixes = [
    'steamos-x64.tar.gz',
    'linux-x64.tar.gz',
    'windows-x64.zip',
    'macos-arm64.dmg',
    'macos-arm64.zip'
  ];
  await require('./media-distribution-qa.cjs').check();
  const assets = [];
  for (const suffix of suffixes) {
    const file = `${prefix}-${suffix}`,
      absolute = path.join(dist, file),
      bytes = await fs.readFile(absolute);
    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    if (!bytes.length) throw new Error(`Empty artifact ${file}`);
    if (suffix.endsWith('zip')) execFileSync('unzip', ['-tq', absolute], { stdio: 'pipe' });
    if (suffix.endsWith('tar.gz'))
      execFileSync('tar', ['-tzf', absolute], { stdio: 'pipe', maxBuffer: 8 * 1024 * 1024 });
    if (suffix.endsWith('dmg')) execFileSync('hdiutil', ['verify', absolute], { stdio: 'pipe' });
    assets.push({ file, bytes: bytes.length, sha256 });
  }
  const appRoots = {
    macos: path.join(
      dist,
      'Steam Animated Screensaver-darwin-arm64/Steam Animated Screensaver.app/Contents/Resources/app'
    ),
    windows: path.join(dist, 'Steam Animated Screensaver-win32-x64/resources/app'),
    linux: path.join(dist, 'steam-animated-screensaver-linux-x64/resources/app')
  };
  for (const [platform, appRoot] of Object.entries(appRoots)) {
    const shipped = JSON.parse(await fs.readFile(path.join(appRoot, 'package.json'), 'utf8'));
    if (shipped.version !== pkg.version || shipped.productName !== pkg.productName)
      throw new Error(`Stale ${platform} package`);
    if (shipped.license !== 'GPL-3.0-only') throw new Error(`Incorrect ${platform} license`);
    for (const folder of ['core', 'manager', 'player', 'docs', 'licenses'])
      for (const file of await fs.readdir(path.join(root, folder))) {
        if (platform !== 'windows' && file === 'icon.ico') continue;
        const source = await fs.readFile(path.join(root, folder, file)),
          packaged = await fs.readFile(path.join(appRoot, folder, file));
        if (!source.equals(packaged)) throw new Error(`Stale ${platform}/${folder}/${file}`);
      }
    for (const file of [
      'main.cjs',
      'preload.cjs',
      'README.md',
      'CHANGELOG.md',
      'LICENSE',
      'NOTICE',
      'CONTRIBUTING.md',
      'SECURITY.md'
    ])
      if (
        !(await fs.readFile(path.join(root, file))).equals(
          await fs.readFile(path.join(appRoot, file))
        )
      )
        throw new Error(`Stale ${platform}/${file}`);
    for (const name of ['yauzl', 'tar-stream']) {
      const dependency = JSON.parse(
        await fs.readFile(path.join(appRoot, 'node_modules', name, 'package.json'), 'utf8')
      );
      if (dependency.version !== pkg.dependencies[name])
        throw new Error(`Stale runtime dependency: ${platform}/${name}`);
    }
    for (const forbidden of [
      '.release-secrets',
      'catalog.json',
      'steamgriddb.key',
      'steam-api.key',
      '.manager.lock',
      '.data',
      '.qa'
    ]) {
      if (await fs.lstat(path.join(appRoot, forbidden)).catch(() => null))
        throw new Error(`Private/unexpected file in ${platform}: ${forbidden}`);
    }
  }
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'sas-package-verify-'));
  const archiveFileCounts = {};
  try {
    for (const [platform, suffix, folder] of [
      ['linux', 'linux-x64.tar.gz', 'steam-animated-screensaver-linux-x64'],
      ['windows', 'windows-x64.zip', 'Steam Animated Screensaver-win32-x64']
    ]) {
      const extract = path.join(temporary, platform);
      await fs.mkdir(extract);
      if (platform === 'linux')
        execFileSync('tar', ['-xzf', path.join(dist, `${prefix}-${suffix}`), '-C', extract]);
      else execFileSync('ditto', ['-x', '-k', path.join(dist, `${prefix}-${suffix}`), extract]);
      const original = await fileTree(path.join(dist, folder)),
        extracted = await fileTree(path.join(extract, folder));
      assert.deepEqual(extracted, original, `Archive contents differ: ${platform}`);
      archiveFileCounts[platform] = Object.keys(original).length;
    }
    const linux = assets.find((a) => a.file.endsWith('linux-x64.tar.gz')),
      steamos = assets.find((a) => a.file.endsWith('steamos-x64.tar.gz'));
    assert.equal(
      steamos.sha256,
      linux.sha256,
      'SteamOS must contain the identical tested Linux application archive'
    );
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
  const pe = require('./windows-media.cjs').peMachine;
  for (const file of [
    'Steam Animated Screensaver.exe',
    'resources/app/binaries/ffmpeg.exe',
    'resources/app/binaries/ffprobe.exe'
  ])
    if (
      pe(await fs.readFile(path.join(dist, 'Steam Animated Screensaver-win32-x64', file))) !==
      0x8664
    )
      throw new Error(`Invalid Windows architecture ${file}`);
  const report = {
    version: pkg.version,
    at: new Date().toISOString(),
    result: 'passed',
    assets,
    archiveFileCounts,
    checks: [
      'All four platform downloads exist and match current version',
      'ZIP/tar/DMG integrity checks',
      'Packaged Core/Manager/Player and main/preload byte-match current source',
      'No catalog or credential files at application root',
      'Windows Electron/FFmpeg/FFprobe PE headers are x64',
      'Extracted Windows/Linux archives byte-match their packaged application trees and executable permissions',
      'SteamOS archive is byte-identical to the Linux archive'
    ],
    limitations: [
      'No native Windows/Linux/SteamOS execution on this Mac',
      'SteamOS and Linux use the same Linux x64 application'
    ]
  };
  await fs.writeFile(
    path.join(dist, 'SHA256SUMS'),
    assets.map((a) => `${a.sha256}  ${a.file}\n`).join('')
  );
  for (const [name, pattern] of [
    ['MACOS', '-macos-'],
    ['WINDOWS', '-windows-'],
    ['LINUX', '-linux-'],
    ['STEAMOS', '-steamos-']
  ]) {
    await fs.writeFile(
      path.join(dist, `${name}_SHA256SUMS`),
      assets
        .filter((a) => a.file.includes(pattern))
        .map((a) => `${a.sha256}  ${a.file}\n`)
        .join('')
    );
  }
  await fs.writeFile(
    path.join(dist, 'PACKAGE_VALIDATION.json'),
    JSON.stringify(report, null, 2) + '\n'
  );
  console.log(JSON.stringify(report, null, 2));
}
if (require.main === module)
  check().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
module.exports = { check };
