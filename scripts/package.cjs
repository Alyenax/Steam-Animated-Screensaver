'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { createWriteStream } = require('node:fs');
const { createGunzip } = require('node:zlib');
const { execFileSync } = require('node:child_process');

async function download(url, destination, gzip = false) {
  const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`Build dependency download failed: ${response.status}`);
  const source = Readable.fromWeb(response.body);
  await pipeline(
    ...(gzip
      ? [source, createGunzip(), createWriteStream(destination)]
      : [source, createWriteStream(destination)])
  );
}

async function build(platform = 'linux', arch = 'x64') {
  const steamOS = platform === 'steamos';
  if (steamOS) platform = 'linux';
  const macOS = platform === 'darwin' && arch === 'arm64';
  const windows = platform === 'win32' && arch === 'x64';
  if (!(platform === 'linux' && arch === 'x64') && !macOS && !windows)
    throw new Error('Supported targets: SteamOS/Linux x64, Windows x64, macOS Apple Silicon.');
  if (macOS && process.platform !== 'darwin') throw new Error('Package the macOS app on a Mac.');
  const root = path.resolve(__dirname, '..');
  const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  const dist = path.join(root, 'dist');
  await fs.mkdir(dist, { recursive: true });
  const staging = await fs.mkdtemp(path.join(dist, '.stage-'));
  const packagingTemp = await fs.mkdtemp(path.join(dist, '.packager-'));
  try {
    for (const item of [
      'core',
      'manager',
      'player',
      'scripts/local-files.cjs',
      'main.cjs',
      'preload.cjs',
      'LICENSE',
      'NOTICE',
      'licenses',
      'README.md',
      'docs',
      'CHANGELOG.md',
      'CONTRIBUTING.md',
      'SECURITY.md'
    ]) {
      const source = path.join(root, item),
        destination = path.join(staging, item);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.cp(source, destination, { recursive: true });
    }
    await fs.writeFile(
      path.join(staging, 'package.json'),
      JSON.stringify(
        { ...pkg, scripts: undefined, dependencies: {}, devDependencies: undefined },
        null,
        2
      )
    );
    const bin = path.join(staging, 'binaries');
    await fs.mkdir(bin);
    const binaryHashes = {};
    if (macOS) {
      const { buildMedia, SOURCES } = require('./build-media-macos.cjs');
      const cache = path.join(dist, '.binary-cache/macos-arm64');
      try {
        await fs.access(path.join(cache, 'PROVENANCE.json'));
      } catch {
        await buildMedia({ output: cache });
      }
      const provenance = JSON.parse(await fs.readFile(path.join(cache, 'PROVENANCE.json'), 'utf8'));
      if (
        provenance.target !== 'darwin-arm64' ||
        JSON.stringify(provenance.sources) !== JSON.stringify(SOURCES)
      )
        throw new Error('Native media build provenance mismatch. Rebuild macOS media tools.');
      for (const name of ['ffmpeg', 'ffprobe']) {
        const target = path.join(cache, name);
        const digest = crypto
          .createHash('sha256')
          .update(await fs.readFile(target))
          .digest('hex');
        if (digest !== provenance.sha256[name])
          throw new Error(`Native ${name} checksum mismatch.`);
        execFileSync('lipo', [target, '-verify_arch', 'arm64']);
      }
      await fs.cp(cache, bin, { recursive: true });
    } else if (windows) {
      Object.assign(
        binaryHashes,
        await require('./windows-media.cjs').stageWindowsMedia({
          cache: path.join(dist, '.binary-cache/windows-x64-source'),
          destination: bin,
          download
        })
      );
    } else {
      Object.assign(
        binaryHashes,
        await require('./cross-media.cjs').stageCrossMedia({
          target: 'linux-x64',
          cache: path.join(dist, '.binary-cache/linux-x64-source'),
          destination: bin
        })
      );
    }
    const { packager } = require('@electron/packager');
    const outputs = await packager({
      dir: staging,
      tmpdir: packagingTemp,
      out: dist,
      name: macOS || windows ? pkg.productName : 'steam-animated-screensaver',
      executableName: windows ? pkg.productName : 'steam-animated-screensaver',
      platform,
      arch,
      electronVersion: pkg.devDependencies.electron,
      appVersion: pkg.version,
      asar: false,
      prune: false,
      overwrite: true,
      download: { cacheRoot: path.join(os.tmpdir(), 'sas-electron-cache') },
      quiet: false,
      ...(windows
        ? {
            icon: path.join(root, 'manager/icon.ico'),
            win32metadata: {
              CompanyName: 'Alyenax',
              FileDescription: pkg.productName,
              ProductName: pkg.productName,
              InternalName: pkg.name
            }
          }
        : {}),
      ...(macOS
        ? {
            appBundleId: 'io.github.alyenax.steam-animated-screensaver',
            appCategoryType: 'public.app-category.entertainment',
            darwinDarkModeSupport: true,
            extendInfo: { LSMinimumSystemVersion: '13.0' },
            icon: path.join(root, 'manager/icon.icns'),
            osxSign: {
              identity: '-',
              identityValidation: false,
              // Preserve the compiler's valid ad-hoc signatures and recorded media-tool hashes.
              ignore: [(file) => /\/binaries\/(ffmpeg|ffprobe)$/.test(file)],
              preAutoEntitlements: false,
              preEmbedProvisioningProfile: false,
              optionsForFile: () => ({ hardenedRuntime: false, timestamp: 'none' })
            }
          }
        : {})
    });
    const output = outputs[0];
    if (macOS) return await finishMac({ root, dist, output, pkg });
    if (windows) {
      await fs.writeFile(
        path.join(output, 'README.txt'),
        'Steam Animated Screensaver - Windows x64\r\n\r\nExtract the entire ZIP, then run Steam Animated Screensaver.exe. No Node, FFmpeg installation or server is required.\r\nPrepare artwork, preview, then install into Steam from Settings. Restart Steam, open Big Picture > Settings > Customization and select steam-animated-screensaver.\r\nLocal data: %APPDATA%/steam-animated-screensaver. Previous app data and owned exports migrate automatically.\r\nUnsigned application. Windows users are invited to report native playback and installation issues.\r\n'
      );
      const filename = `Steam-Animated-Screensaver-${pkg.version}-windows-x64.zip`;
      execFileSync('ditto', ['-c', '-k', '--keepParent', output, path.join(dist, filename)]);
      return await manifest(dist, [filename], 'WINDOWS_SHA256SUMS');
    }
    for (const item of [
      'install.sh',
      'uninstall.sh',
      'repair-steam-screensaver.sh',
      'remove-screensaver-tagline.sh'
    ]) {
      await fs.copyFile(path.join(root, 'scripts', item), path.join(output, item));
      await fs.chmod(path.join(output, item), 0o755);
    }
    await fs.copyFile(path.join(root, 'manager', 'icon.svg'), path.join(output, 'icon.svg'));
    await fs.writeFile(
      path.join(output, '.screensaver-application'),
      'steam-animated-screensaver-v1\n'
    );
    await fs.writeFile(
      path.join(output, 'README.txt'),
      'Steam Animated Screensaver by Alyenax. See resources/app/docs/INSTALLATION.md for setup and resources/app/docs/VALIDATION.md for test coverage and remaining native checks.\n'
    );
    const filename = `Steam-Animated-Screensaver-${pkg.version}-${steamOS ? 'steamos' : platform}-${arch}.tar.gz`;
    execFileSync('tar', ['-czf', path.join(dist, filename), '-C', dist, path.basename(output)], {
      stdio: 'inherit'
    });
    const counterpart = filename.replace(
      steamOS ? '-steamos-' : '-linux-',
      steamOS ? '-linux-' : '-steamos-'
    );
    await fs.copyFile(path.join(dist, filename), path.join(dist, counterpart));
    const content = await fs.readFile(path.join(dist, filename));
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    await fs.writeFile(
      path.join(dist, steamOS ? 'STEAMOS_SHA256SUMS' : 'LINUX_SHA256SUMS'),
      `${hash}  ${filename}\n`
    );
    await fs.writeFile(
      path.join(dist, steamOS ? 'LINUX_SHA256SUMS' : 'STEAMOS_SHA256SUMS'),
      `${hash}  ${counterpart}\n`
    );
    console.log(
      JSON.stringify(
        { file: path.join(dist, filename), size: content.length, sha256: hash, binaryHashes },
        null,
        2
      )
    );
  } finally {
    await fs.rm(staging, { recursive: true, force: true });
    await fs.rm(packagingTemp, { recursive: true, force: true });
  }
}
async function finishMac({ dist, output, pkg }) {
  const app = path.join(output, `${pkg.productName}.app`);
  execFileSync('codesign', ['--verify', '--deep', '--strict', '--verbose=2', app], {
    stdio: 'inherit'
  });
  const base = `Steam-Animated-Screensaver-${pkg.version}-macos-arm64`;
  const zip = path.join(dist, base + '.zip');
  await fs.rm(zip, { force: true });
  execFileSync('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', app, zip]);
  const stage = await fs.mkdtemp(path.join(dist, '.dmg-'));
  try {
    // Preserve framework symlinks and macOS bundle metadata when staging the disk image.
    execFileSync('ditto', [app, path.join(stage, path.basename(app))]);
    await fs.symlink('/Applications', path.join(stage, 'Applications'));
    await fs.writeFile(
      path.join(stage, 'LISEZ-MOI - README.txt'),
      'Steam Animated Screensaver - macOS Apple Silicon, macOS 13+.\n\n' +
        'FR : Glissez l’application dans Applications, puis ouvrez-la. Ajoutez votre clé SteamGridDB dans Réglages, choisissez un jeu, préparez ses images puis ouvrez Aperçu. Aucun outil à installer et aucun serveur requis. Suivez Préparer et installer, cliquez sur Installer dans Steam, redémarrez Steam, puis sélectionnez steam-animated-screensaver dans Big Picture > Réglages > Personnalisation.\n\n' +
        'EN: Drag the app into Applications and open it. Add your SteamGridDB key in Settings, choose a game, prepare its artwork, then open Preview. No extra tools or server are required. Follow Prepare and install, click Install in Steam, restart Steam, then select steam-animated-screensaver in Big Picture > Settings > Customization.\n\n' +
        'Ad-hoc signed app, not Apple notarized. If macOS blocks a downloaded copy, use System Settings > Privacy & Security > Open Anyway for this app. No global security setting needs changing.\n' +
        'FFmpeg / libvpx notices, complete source archives and rebuild recipe: app Contents/Resources/app/binaries/.\n'
    );
    const dmg = path.join(dist, base + '.dmg');
    execFileSync(
      'hdiutil',
      ['create', '-volname', pkg.productName, '-srcfolder', stage, '-format', 'UDZO', '-ov', dmg],
      { stdio: 'inherit' }
    );
    const assets = [];
    for (const file of [zip, dmg]) {
      const content = await fs.readFile(file);
      assets.push({
        file,
        bytes: content.length,
        sha256: crypto.createHash('sha256').update(content).digest('hex')
      });
    }
    await fs.writeFile(
      path.join(dist, 'MACOS_SHA256SUMS'),
      assets.map((a) => `${a.sha256}  ${path.basename(a.file)}\n`).join('')
    );
    console.log(JSON.stringify({ app, signing: 'ad-hoc; not notarized', assets }, null, 2));
    return { app, assets };
  } finally {
    await fs.rm(stage, { recursive: true, force: true });
  }
}
async function manifest(dist, files, name) {
  const assets = [];
  for (const file of files) {
    const bytes = await fs.readFile(path.join(dist, file));
    assets.push({
      file,
      bytes: bytes.length,
      sha256: crypto.createHash('sha256').update(bytes).digest('hex')
    });
  }
  await fs.writeFile(path.join(dist, name), assets.map((a) => `${a.sha256}  ${a.file}\n`).join(''));
  console.log(JSON.stringify({ assets }, null, 2));
  return { assets };
}
module.exports = { build, finishMac };
if (require.main === module)
  build(process.argv[2], process.argv[3]).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
