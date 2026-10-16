'use strict';
// Standalone native media tools; no Homebrew installation or developer binary reuse.
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const SOURCES = [
  {
    name: 'ffmpeg-8.1.3.tar.xz',
    url: 'https://ffmpeg.org/releases/ffmpeg-8.1.3.tar.xz',
    sha256: '7138d28c96d9d3e3af4ee3d8cad72741f8ffb40da90c1112235dea3ecd3178a3'
  },
  {
    name: 'libvpx-1.16.0.tar.gz',
    url: 'https://codeload.github.com/webmproject/libvpx/tar.gz/refs/tags/v1.16.0',
    sha256: '7a479a3c66b9f5d5542a4c6a1b7d3768a983b1e5c14c60a9396edc9b649e015c'
  },
  {
    name: 'dav1d-1.5.4.tar.gz',
    url: 'https://codeload.github.com/videolan/dav1d/tar.gz/refs/tags/1.5.4',
    sha256: 'a1d5b63d2d38ec9bd03acf643caa51fa22edd1e89c5a109c4807717216bbec07'
  },
  {
    name: 'pkgconf-2.5.1.tar.xz',
    url: 'https://distfiles.ariadne.space/pkgconf/pkgconf-2.5.1.tar.xz',
    sha256: 'cd05c9589b9f86ecf044c10a2269822bc9eb001eced2582cfffd658b0a50c243'
  }
];
const hash = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
async function buildMedia({ output, sourceDir } = {}) {
  if (process.platform !== 'darwin' || process.arch !== 'arm64')
    throw new Error('Build these native tools on an Apple Silicon Mac.');
  const root = path.resolve(__dirname, '..');
  output = path.resolve(output || path.join(root, 'dist/.binary-cache/macos-arm64'));
  sourceDir = path.resolve(sourceDir || path.join(root, 'dist/.media-build/sources'));
  await fs.mkdir(sourceDir, { recursive: true });
  for (const source of SOURCES) {
    const file = path.join(sourceDir, source.name);
    try {
      await fs.access(file);
    } catch {
      const response = await fetch(source.url, { signal: AbortSignal.timeout(120000) });
      if (!response.ok) throw new Error(`Source download failed: ${response.status}`);
      await fs.writeFile(file, Buffer.from(await response.arrayBuffer()));
    }
    if (hash(await fs.readFile(file)) !== source.sha256)
      throw new Error(`Source checksum mismatch: ${source.name}`);
  }
  const work = await fs.mkdtemp(path.join(os.tmpdir(), 'sas-macos-media-'));
  const env = { ...process.env, MACOSX_DEPLOYMENT_TARGET: '13.0' };
  const run = (command, args, cwd) => execFileSync(command, args, { cwd, env, stdio: 'inherit' });
  const jobs = String(Math.min(8, os.availableParallelism()));
  const prefix = path.join(work, 'prefix');
  try {
    for (const source of SOURCES)
      run('tar', ['-xf', path.join(sourceDir, source.name), '-C', work]);
    const pkgconf = path.join(work, 'pkgconf-2.5.1');
    run('./configure', [`--prefix=${prefix}`, '--disable-shared', '--enable-static'], pkgconf);
    run('make', ['-j', jobs], pkgconf);
    run('make', ['install'], pkgconf);
    env.PKG_CONFIG = path.join(prefix, 'bin/pkgconf');
    env.PKG_CONFIG_PATH = path.join(prefix, 'lib/pkgconfig');
    const tools = path.join(work, 'build-tools');
    run('python3', ['-m', 'venv', tools], work);
    run(
      path.join(tools, 'bin/python'),
      ['-m', 'pip', 'install', 'meson==1.9.1', 'ninja==1.13.0'],
      work
    );
    env.PATH = `${path.join(tools, 'bin')}:${path.join(prefix, 'bin')}:${env.PATH}`;
    const dav1d = path.join(work, 'dav1d-1.5.4');
    run(
      path.join(tools, 'bin/meson'),
      [
        'setup',
        'build',
        `--prefix=${prefix}`,
        '--libdir=lib',
        '--default-library=static',
        '--buildtype=release',
        '-Denable_tools=false',
        '-Denable_tests=false'
      ],
      dav1d
    );
    run(path.join(tools, 'bin/meson'), ['compile', '-C', 'build', '-j', jobs], dav1d);
    run(path.join(tools, 'bin/meson'), ['install', '-C', 'build'], dav1d);
    const vpx = path.join(work, 'libvpx-1.16.0');
    run(
      './configure',
      [
        `--prefix=${prefix}`,
        '--target=arm64-darwin22-gcc',
        '--disable-examples',
        '--disable-tools',
        '--disable-docs',
        '--disable-unit-tests',
        '--disable-shared',
        '--enable-static',
        '--enable-pic',
        '--enable-vp9-highbitdepth',
        '--extra-cflags=-mmacosx-version-min=13.0'
      ],
      vpx
    );
    run('make', ['-j', jobs], vpx);
    run('make', ['install'], vpx);
    const ffmpeg = path.join(work, 'ffmpeg-8.1.3');
    run(
      './configure',
      [
        `--prefix=${prefix}`,
        '--arch=arm64',
        '--cc=clang',
        `--pkg-config=${env.PKG_CONFIG}`,
        '--pkg-config-flags=--static',
        '--disable-autodetect',
        '--disable-gpl',
        '--disable-nonfree',
        '--disable-version3',
        '--disable-shared',
        '--enable-static',
        '--enable-libvpx',
        '--enable-libdav1d',
        '--enable-zlib',
        '--disable-network',
        '--disable-devices',
        '--disable-ffplay',
        '--disable-doc',
        '--disable-debug',
        `--extra-cflags=-mmacosx-version-min=13.0 -I${prefix}/include`,
        `--extra-ldflags=-mmacosx-version-min=13.0 -L${prefix}/lib`
      ],
      ffmpeg
    );
    run('make', ['-j', jobs, 'ffmpeg', 'ffprobe'], ffmpeg);
    await fs.mkdir(output, { recursive: true });
    const binaries = {};
    for (const name of ['ffmpeg', 'ffprobe']) {
      const target = path.join(output, name);
      await fs.copyFile(path.join(ffmpeg, name), target);
      await fs.chmod(target, 0o755);
      binaries[name] = hash(await fs.readFile(target));
    }
    const sources = path.join(output, 'sources');
    await fs.mkdir(sources, { recursive: true });
    for (const source of SOURCES)
      await fs.copyFile(path.join(sourceDir, source.name), path.join(sources, source.name));
    await fs.copyFile(__filename, path.join(sources, 'build-media-macos.cjs'));
    await fs.copyFile(path.join(ffmpeg, 'COPYING.LGPLv2.1'), path.join(output, 'FFmpeg.LICENSE'));
    await fs.copyFile(path.join(vpx, 'LICENSE'), path.join(output, 'libvpx.LICENSE'));
    await fs.copyFile(path.join(vpx, 'PATENTS'), path.join(output, 'libvpx.PATENTS'));
    await fs.copyFile(path.join(dav1d, 'COPYING'), path.join(output, 'dav1d.LICENSE'));
    await fs.writeFile(
      path.join(output, 'PROVENANCE.json'),
      JSON.stringify(
        {
          target: 'darwin-arm64',
          minimumMacOS: '13.0',
          license: 'LGPL-2.1-or-later; libvpx and dav1d BSD',
          sources: SOURCES,
          sha256: binaries,
          compiler: execFileSync('clang', ['--version'], { encoding: 'utf8' }).split('\n')[0],
          configuration: execFileSync(path.join(output, 'ffmpeg'), ['-buildconf'], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe']
          })
        },
        null,
        2
      ) + '\n'
    );
    await fs.writeFile(
      path.join(output, 'REBUILD.txt'),
      'FFmpeg runs as separate LGPL executables with BSD libvpx and dav1d libraries. Their complete unmodified sources and exact build recipe are in sources/. No GPL or nonfree configuration is enabled.\n' +
        'Rebuild on macOS Apple Silicon with Xcode Command Line Tools, Python 3.9+ and Node.js 22+: node sources/build-media-macos.cjs --sources sources --output rebuilt\n' +
        'Replace binaries/ffmpeg and binaries/ffprobe with rebuilt tools in your own copy of the app, then re-sign that copy: codesign --force --deep --sign - "SteamOS Animated Screensaver.app". Changes to the media executables are permitted under their licenses.\n'
    );
    console.log('Native macOS media tools ready:', output);
    return output;
  } finally {
    await fs.rm(work, { recursive: true, force: true });
  }
}
module.exports = { buildMedia, SOURCES };
if (require.main === module) {
  const args = process.argv.slice(2);
  const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
  buildMedia({ output: option('--output'), sourceDir: option('--sources') }).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
