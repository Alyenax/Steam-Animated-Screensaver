'use strict';
// Build the separate LGPL media tools locally with complete corresponding source.
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { SOURCES: MAC_SOURCES } = require('./build-media-macos.cjs');
const SOURCES = [
  ...MAC_SOURCES,
  {
    name: 'zig-0.15.2.tar.xz',
    url: 'https://ziglang.org/download/0.15.2/zig-0.15.2.tar.xz',
    sha256: 'd9b30c7aa983fcff5eed2084d54ae83eaafe7ff3a84d8fb754d854165a6e521c'
  },
  {
    name: 'zlib-1.3.1.tar.gz',
    url: 'https://zlib.net/fossils/zlib-1.3.1.tar.gz',
    sha256: '9a93b2b7dfdac77ceba5a558a580e74667dd6fede4585b91eefb60f03b72df23'
  }
];
const TOOLCHAIN = {
  version: '0.15.2',
  url: 'https://ziglang.org/download/0.15.2/zig-aarch64-macos-0.15.2.tar.xz',
  sha256: '3cc2bab367e185cdfb27501c4b30b1b0653c28d9f73df8dc91488e66ece5fa6b'
};
const NASM = {
  name: 'nasm-2.16.03.tar.xz',
  url: 'https://www.nasm.us/pub/nasm/releasebuilds/2.16.03/nasm-2.16.03.tar.xz',
  sha256: '1412a1c760bbd05db026b6c0d1657affd6631cd0a63cddb6f73cc6d4aa616148'
};
const digest = (b) => crypto.createHash('sha256').update(b).digest('hex');
const quote = (s) => "'" + s.replaceAll("'", "'\\''") + "'";
async function verified(url, file, sha256) {
  let bytes = await fs.readFile(file).catch(() => null);
  if (!bytes) {
    const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
    if (!response.ok) throw Error('Build source download failed: ' + response.status);
    bytes = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(file, bytes);
  }
  if (digest(bytes) !== sha256) throw Error('Source checksum mismatch: ' + path.basename(file));
}
async function buildCross({ target, output, sourceDir, resume = false } = {}) {
  if (process.platform !== 'darwin' || process.arch !== 'arm64')
    throw Error('This recipe currently runs on an Apple Silicon Mac.');
  if (!['linux-x64', 'windows-x64'].includes(target))
    throw Error('Choose linux-x64 or windows-x64.');
  const windows = target === 'windows-x64';
  const root = path.resolve(__dirname, '..');
  sourceDir = path.resolve(sourceDir || path.join(root, 'dist/.media-build/sources'));
  output = path.resolve(output || path.join(root, 'dist/.binary-cache', target + '-source'));
  const cache = path.join(root, 'dist/.cross-tools');
  await fs.mkdir(cache, { recursive: true });
  await verified(TOOLCHAIN.url, path.join(cache, 'zig.tar.xz'), TOOLCHAIN.sha256);
  const zig = path.join(cache, 'zig-aarch64-macos-0.15.2/zig');
  if (
    !(await fs.access(zig).then(
      () => true,
      () => false
    ))
  )
    execFileSync('tar', ['-xf', path.join(cache, 'zig.tar.xz'), '-C', cache]);
  for (const s of SOURCES) await verified(s.url, path.join(sourceDir, s.name), s.sha256);
  await verified(NASM.url, path.join(cache, 'nasm.tar.xz'), NASM.sha256);
  const work = resume
    ? (await fs.readFile(path.join(cache, target + '-work.txt'), 'utf8')).trim()
    : await fs.mkdtemp(path.join(os.tmpdir(), 'sas-cross-media-'));
  if (!path.basename(work).startsWith('sas-cross-media-'))
    throw Error('Unexpected build workspace.');
  await fs.writeFile(path.join(cache, target + '-work.txt'), work);
  const env = { ...process.env, ZIG_GLOBAL_CACHE_DIR: path.join(cache, 'zig-cache') };
  const run = (exe, args, cwd) => execFileSync(exe, args, { cwd, env, stdio: 'inherit' });
  const jobs = String(Math.min(6, os.availableParallelism()));
  const prefix = path.join(work, 'prefix'),
    host = path.join(work, 'host');
  for (const s of SOURCES)
    if (!resume || s.name.startsWith('zlib'))
      run('tar', ['-xf', path.join(sourceDir, s.name), '-C', work], work);
  if (!resume) {
    run('tar', ['-xf', path.join(cache, 'nasm.tar.xz'), '-C', work], work);
    run(
      './configure',
      [`--prefix=${host}`, '--disable-shared', '--enable-static'],
      path.join(work, 'pkgconf-2.5.1')
    );
    run('make', ['-j', jobs, 'install'], path.join(work, 'pkgconf-2.5.1'));
    run('./configure', [`--prefix=${host}`], path.join(work, 'nasm-2.16.03'));
    run('make', ['-j', jobs, 'install'], path.join(work, 'nasm-2.16.03'));
  }
  const wrappers = path.join(work, 'tools');
  await fs.mkdir(wrappers, { recursive: true });
  const triple = windows ? 'x86_64-windows-gnu' : 'x86_64-linux-musl';
  for (const [name, args] of Object.entries({
    cc: `cc -target ${triple}`,
    cxx: `c++ -target ${triple}`,
    ar: 'ar',
    ranlib: 'ranlib'
  })) {
    await fs.writeFile(path.join(wrappers, name), `#!/bin/sh\nexec ${quote(zig)} ${args} "$@"\n`, {
      mode: 0o755
    });
  }
  Object.assign(env, {
    CC: path.join(wrappers, 'cc'),
    CXX: path.join(wrappers, 'cxx'),
    AR: path.join(wrappers, 'ar'),
    RANLIB: path.join(wrappers, 'ranlib'),
    LD: path.join(wrappers, 'cc'),
    STRIP: 'true',
    PKG_CONFIG: path.join(host, 'bin/pkgconf'),
    PKG_CONFIG_LIBDIR: path.join(prefix, 'lib/pkgconfig'),
    PKG_CONFIG_PATH: path.join(prefix, 'lib/pkgconfig')
  });
  const tools = path.join(cache, 'build-venv/bin');
  if (
    !(await fs.access(path.join(tools, 'meson')).then(
      () => true,
      () => false
    ))
  ) {
    run('python3', ['-m', 'venv', path.dirname(tools)], work);
    run(
      path.join(tools, 'python'),
      ['-m', 'pip', 'install', 'meson==1.9.1', 'ninja==1.13.0'],
      work
    );
  }
  env.PATH = `${wrappers}:${host}/bin:${tools}:${env.PATH}`;
  // libvpx needs readelf only for its NASM section-alignment probe on macOS.
  await fs.writeFile(
    path.join(wrappers, 'readelf'),
    `#!/usr/bin/env python3
import struct, sys
if sys.argv[1:-1] != ['-WS']: raise SystemExit('Only ELF64 section inspection is supported')
b=open(sys.argv[-1], 'rb').read()
if b[:6] != bytes([127,69,76,70,2,1]): raise SystemExit('Expected little endian ELF64')
o=struct.unpack_from('<Q',b,40)[0]
n, count, strings=struct.unpack_from('<HHH',b,58)
headers=[struct.unpack_from('<IIQQQQIIQQ',b,o+i*n) for i in range(count)]
h=headers[strings]; names=b[h[4]:h[4]+h[5]]
for i,h in enumerate(headers):
 name=names[h[0]:].split(bytes([0]))[0].decode()
 print('[%d] %s type=%d offset=%x size=%x %d' % (i,name,h[1],h[4],h[5],h[8]))
`,
    { mode: 0o755 }
  );
  const zlib = path.join(work, 'zlib-1.3.1');
  run(
    './configure',
    [`--prefix=${prefix}`, '--static', `--uname=${windows ? 'MINGW64' : 'Linux'}`],
    zlib
  );
  run('make', ['-j', jobs, 'install'], zlib);
  const vpx = path.join(work, 'libvpx-1.16.0');
  run(
    './configure',
    [
      `--prefix=${prefix}`,
      `--target=${windows ? 'x86_64-win64-gcc' : 'x86_64-linux-gcc'}`,
      '--as=nasm',
      '--disable-examples',
      '--disable-tools',
      '--disable-docs',
      '--disable-unit-tests',
      '--disable-shared',
      '--enable-static',
      '--enable-pic',
      '--enable-vp9-highbitdepth'
    ],
    vpx
  );
  run('make', ['-j', jobs], vpx);
  run('make', ['install'], vpx);
  const cross = path.join(work, 'cross.ini');
  await fs.writeFile(
    cross,
    `[binaries]\nc = '${env.CC}'\ncpp = '${env.CXX}'\nar = '${env.AR}'\nstrip = 'true'\npkg-config = '${env.PKG_CONFIG}'\n[host_machine]\nsystem = '${windows ? 'windows' : 'linux'}'\ncpu_family = 'x86_64'\ncpu = 'x86_64'\nendian = 'little'\n[properties]\nneeds_exe_wrapper = true\n`
  );
  const meson = path.join(tools, 'meson'),
    dav1d = path.join(work, 'dav1d-1.5.4');
  run(
    meson,
    [
      'setup',
      'build',
      `--prefix=${prefix}`,
      '--libdir=lib',
      '--default-library=static',
      '--buildtype=release',
      '--cross-file',
      cross,
      '-Denable_tools=false',
      '-Denable_tests=false'
    ],
    dav1d
  );
  run(meson, ['compile', '-C', 'build', '-j', jobs], dav1d);
  run(meson, ['install', '-C', 'build'], dav1d);
  const ffmpeg = path.join(work, 'ffmpeg-8.1.3');
  run(
    './configure',
    [
      `--prefix=${prefix}`,
      '--enable-cross-compile',
      `--target-os=${windows ? 'mingw32' : 'linux'}`,
      '--arch=x86_64',
      `--cc=${env.CC}`,
      `--cxx=${env.CXX}`,
      `--ar=${env.AR}`,
      `--ranlib=${env.RANLIB}`,
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
      // LLD preserves ASLR relocations without FFmpeg's GNU ld-only --pic-executable flag.
      windows ? '--enable-debug=0' : '--disable-debug',
      '--disable-stripping',
      `--extra-cflags=-I${prefix}/include`,
      `--extra-ldflags=-L${prefix}/lib${windows ? '' : ' -static'}`
    ],
    ffmpeg
  );
  run(
    'make',
    ['-j', jobs, 'ffmpeg' + (windows ? '.exe' : ''), 'ffprobe' + (windows ? '.exe' : '')],
    ffmpeg
  );
  await fs.mkdir(path.join(output, 'sources'), { recursive: true });
  const sha256 = {};
  for (const name of ['ffmpeg', 'ffprobe']) {
    const n = name + (windows ? '.exe' : '');
    await fs.copyFile(path.join(ffmpeg, n), path.join(output, n));
    await fs.chmod(path.join(output, n), 0o755);
    sha256[n] = digest(await fs.readFile(path.join(output, n)));
  }
  for (const s of SOURCES)
    await fs.copyFile(path.join(sourceDir, s.name), path.join(output, 'sources', s.name));
  await fs.copyFile(path.join(cache, 'nasm.tar.xz'), path.join(output, 'sources', NASM.name));
  for (const n of ['build-media-cross.cjs', 'build-media-macos.cjs'])
    await fs.copyFile(path.join(__dirname, n), path.join(output, 'sources', n));
  for (const [from, to] of [
    [path.join(ffmpeg, 'COPYING.LGPLv2.1'), 'FFmpeg.LICENSE'],
    [path.join(vpx, 'LICENSE'), 'libvpx.LICENSE'],
    [path.join(vpx, 'PATENTS'), 'libvpx.PATENTS'],
    [path.join(dav1d, 'COPYING'), 'dav1d.LICENSE']
  ])
    await fs.copyFile(from, path.join(output, to));
  await fs.copyFile(path.join(zlib, 'README'), path.join(output, 'zlib.LICENSE'));
  await fs.copyFile(
    path.join(cache, 'zig-aarch64-macos-0.15.2/LICENSE'),
    path.join(output, 'Zig.LICENSE')
  );
  await fs.copyFile(
    path.join(
      cache,
      'zig-aarch64-macos-0.15.2/lib/libc',
      windows ? 'mingw/COPYING' : 'musl/COPYRIGHT'
    ),
    path.join(output, windows ? 'mingw.LICENSE' : 'musl.LICENSE')
  );
  await fs.writeFile(
    path.join(output, 'PROVENANCE.json'),
    JSON.stringify(
      {
        target,
        license: 'LGPL-2.1-or-later; libvpx and dav1d BSD',
        sources: SOURCES,
        toolchain: TOOLCHAIN,
        assembler: NASM,
        sha256,
        configuration: await fs.readFile(path.join(ffmpeg, 'ffbuild/config.mak'), 'utf8')
      },
      null,
      2
    ) + '\n'
  );
  await fs.writeFile(
    path.join(output, 'REBUILD.txt'),
    `Separate LGPL FFmpeg tools with BSD libvpx and dav1d. Complete unmodified source archives and the exact local cross-build recipe are in sources/. GPL and nonfree are disabled.\nRebuild on Apple Silicon with Node.js 22+, Xcode Command Line Tools and Python 3: run node sources/build-media-cross.cjs --target ${target} --sources sources --output rebuilt. The recipe creates an isolated environment for Meson 1.9.1 and Ninja 1.13.0, then downloads and verifies the pinned Zig compiler and NASM source. Zig runtime source is also supplied in sources/. Replace binaries/ffmpeg${windows ? '.exe' : ''} and ffprobe${windows ? '.exe' : ''} in your own app copy. Modification and replacement are permitted under their licenses.\n`
  );
  await fs.rm(work, { recursive: true, force: true });
  console.log('Source-backed cross tools ready: ' + output);
  return output;
}
module.exports = { buildCross, SOURCES, TOOLCHAIN, NASM };
if (require.main === module) {
  const args = process.argv.slice(2),
    option = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
  buildCross({
    target: option('--target'),
    output: option('--output'),
    sourceDir: option('--sources'),
    resume: args.includes('--resume')
  }).catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
}
