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
const EXPECTED_LINUX_BINARIES = {
  ffmpeg: 'e7e7fb30477f717e6f55f9180a70386c62677ef8a4d4d1a5d948f4098aa3eb99',
  ffprobe: '4f231a1960d83e403d08f7971e271707bec278a9ae18e21b8b5b03186668450d'
};

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
  const macOS = platform === 'darwin' && arch === 'arm64';
  if (!(platform === 'linux' && arch === 'x64') && !macOS)
    throw new Error(
      'Supported distribution targets: Linux x64 and macOS Apple Silicon (darwin arm64).'
    );
  if (macOS && process.platform !== 'darwin') throw new Error('Package the macOS app on a Mac.');
  const root = path.resolve(__dirname, '..');
  const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  const dist = path.join(root, 'dist');
  await fs.mkdir(dist, { recursive: true });
  const staging = await fs.mkdtemp(path.join(dist, '.stage-'));
  try {
    for (const item of [
      'core',
      'manager',
      'player',
      'scripts/local-files.cjs',
      'main.cjs',
      'preload.cjs',
      'LICENSE',
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
    } else {
      const cache = path.join(dist, '.binary-cache');
      await fs.mkdir(cache, { recursive: true });
      for (const name of ['ffmpeg', 'ffprobe']) {
        const target = path.join(cache, `${name}-${platform}-${arch}`);
        try {
          await fs.access(target);
        } catch {
          console.log(`Downloading ${name} (${platform}/${arch})…`);
          await download(
            `https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1/${name}-${platform}-${arch}.gz`,
            target,
            true
          );
        }
        await fs.chmod(target, 0o755);
        await fs.copyFile(target, path.join(bin, name));
        await fs.chmod(path.join(bin, name), 0o755);
        binaryHashes[name] = crypto
          .createHash('sha256')
          .update(await fs.readFile(target))
          .digest('hex');
        if (binaryHashes[name] !== EXPECTED_LINUX_BINARIES[name]) {
          throw new Error(`The pinned ${name} executable digest does not match. Build stopped.`);
        }
      }
      for (const extension of ['LICENSE', 'README'])
        await download(
          `https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1/${platform}-${arch}.${extension}`,
          path.join(bin, `FFmpeg.${extension}`)
        );
      await fs.writeFile(
        path.join(bin, 'PROVENANCE.json'),
        JSON.stringify(
          {
            upstream: 'https://github.com/eugeneware/ffmpeg-static/releases/tag/b6.1.1',
            distribution: 'Linux x64 upstream separate GPL executables',
            sha256: binaryHashes
          },
          null,
          2
        )
      );
    }
    const { packager } = require('@electron/packager');
    const outputs = await packager({
      dir: staging,
      out: dist,
      name: macOS ? pkg.productName : 'steamos-animated-screensaver',
      executableName: 'steamos-animated-screensaver',
      platform,
      arch,
      electronVersion: pkg.devDependencies.electron,
      appVersion: pkg.version,
      asar: false,
      prune: false,
      overwrite: true,
      download: { cacheRoot: path.join(os.tmpdir(), 'sas-electron-cache') },
      quiet: false,
      ...(macOS
        ? {
            appBundleId: 'io.github.alyenax.steamos-animated-screensaver',
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
      path.join(output, '.cinema-application'),
      'steamos-animated-screensaver-v1\n'
    );
    await fs.writeFile(
      path.join(output, 'CANDIDATE.txt'),
      'Private installation candidate. Linux runtime and physical SteamOS Gaming Mode acceptance remain pending. See resources/app/docs/VALIDATION.md.\n'
    );
    const filename = `SteamOS-Animated-Screensaver-${pkg.version}-${platform}-${arch}.tar.gz`;
    execFileSync('tar', ['-czf', path.join(dist, filename), '-C', dist, path.basename(output)], {
      stdio: 'inherit'
    });
    const content = await fs.readFile(path.join(dist, filename));
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    await fs.writeFile(path.join(dist, 'SHA256SUMS'), `${hash}  ${filename}\n`);
    console.log(
      JSON.stringify(
        { file: path.join(dist, filename), size: content.length, sha256: hash, binaryHashes },
        null,
        2
      )
    );
  } finally {
    await fs.rm(staging, { recursive: true, force: true });
  }
}
async function finishMac({ dist, output, pkg }) {
  const app = path.join(output, `${pkg.productName}.app`);
  execFileSync('codesign', ['--verify', '--deep', '--strict', '--verbose=2', app], {
    stdio: 'inherit'
  });
  const base = `SteamOS-Animated-Screensaver-${pkg.version}-macos-arm64`;
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
      'SteamOS Animated Screensaver — macOS Apple Silicon, macOS 13+.\n\n' +
        'FR : Glissez l’application dans Applications, puis ouvrez-la. Ajoutez votre clé SteamGridDB dans Réglages, choisissez un jeu, préparez ses images puis ouvrez Aperçu. Aucun outil à installer et aucun serveur requis. Cette app sert à gérer et prévisualiser ; le screensaver automatique SteamOS se valide sur la machine Steam.\n\n' +
        'EN: Drag the app into Applications and open it. Add your SteamGridDB key in Settings, choose a game, prepare its artwork, then open Preview. No extra tools or server are required. This app manages and previews; automatic SteamOS screensaver activation is tested on the Steam device.\n\n' +
        'Private test build with ad-hoc signature, not Apple notarized. If macOS blocks a downloaded copy, use System Settings > Privacy & Security > Open Anyway for this app. No global security setting needs changing.\n' +
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
module.exports = { build, finishMac };
if (require.main === module)
  build(process.argv[2], process.argv[3]).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
