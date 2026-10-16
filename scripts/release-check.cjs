'use strict';
// Every release must contain one current package per platform; macOS also supplies a ZIP.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
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
    for (const folder of ['core', 'manager', 'player', 'docs'])
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
      'CONTRIBUTING.md',
      'SECURITY.md'
    ])
      if (
        !(await fs.readFile(path.join(root, file))).equals(
          await fs.readFile(path.join(appRoot, file))
        )
      )
        throw new Error(`Stale ${platform}/${file}`);
    for (const forbidden of [
      'catalog.json',
      'steamgriddb.key',
      'steam-api.key',
      '.manager.lock',
      'node_modules',
      '.data',
      '.qa'
    ]) {
      if (await fs.lstat(path.join(appRoot, forbidden)).catch(() => null))
        throw new Error(`Private/unexpected file in ${platform}: ${forbidden}`);
    }
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
    checks: [
      'All four platform downloads exist and match current version',
      'ZIP/tar/DMG integrity checks',
      'Packaged Core/Manager/Player and main/preload byte-match current source',
      'No catalog or credential files at application root',
      'Windows Electron/FFmpeg/FFprobe PE headers are x64'
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
