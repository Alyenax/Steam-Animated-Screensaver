'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { SOURCES } = require('./build-media-cross.cjs');
const { peMachine } = require('./cross-media.cjs');
function peImports(b) {
  const pe = b.readUInt32LE(60),
    sections = b.readUInt16LE(pe + 6),
    optionalSize = b.readUInt16LE(pe + 20);
  const optional = pe + 24,
    table = optional + optionalSize;
  assert.equal(b.readUInt16LE(optional), 0x20b);
  const offset = (rva) => {
    for (let i = 0; i < sections; i++) {
      const s = table + i * 40,
        va = b.readUInt32LE(s + 12),
        size = Math.max(b.readUInt32LE(s + 8), b.readUInt32LE(s + 16));
      if (rva >= va && rva < va + size) return b.readUInt32LE(s + 20) + rva - va;
    }
    throw Error('Unmapped PE address.');
  };
  const imports = [];
  let d = offset(b.readUInt32LE(optional + 120));
  while (b.readUInt32LE(d + 12)) {
    const name = offset(b.readUInt32LE(d + 12));
    const end = b.indexOf(0, name);
    imports.push(b.toString('ascii', name, end).toLowerCase());
    d += 20;
  }
  return imports.sort();
}
async function check() {
  const root = path.resolve(__dirname, '..'),
    results = [];
  for (const target of ['linux-x64', 'windows-x64']) {
    const base = path.join(root, 'dist/.binary-cache', target + '-source');
    const p = JSON.parse(await fs.readFile(path.join(base, 'PROVENANCE.json'), 'utf8'));
    assert.deepEqual(p.sources, SOURCES);
    assert.equal(p.target, target);
    for (const s of SOURCES)
      assert.equal(
        crypto
          .createHash('sha256')
          .update(await fs.readFile(path.join(base, 'sources', s.name)))
          .digest('hex'),
        s.sha256
      );
    for (const file of [
      'FFmpeg.LICENSE',
      'libvpx.LICENSE',
      'libvpx.PATENTS',
      'dav1d.LICENSE',
      'zlib.LICENSE',
      'Zig.LICENSE',
      'REBUILD.txt',
      target === 'linux-x64' ? 'musl.LICENSE' : 'mingw.LICENSE'
    ])
      assert((await fs.stat(path.join(base, file))).size > 0, file);
    const features = [
      'GIF_DECODER',
      'PNG_DECODER',
      'WEBP_DECODER',
      'LIBDAV1D_DECODER',
      'LIBVPX_VP9_ENCODER',
      'MINTERPOLATE_FILTER',
      'TBLEND_FILTER',
      'WEBM_MUXER'
    ];
    for (const f of features)
      assert(p.configuration.includes('\nCONFIG_' + f + '=yes'), target + ' ' + f);
    for (const f of ['GPL', 'NONFREE', 'VERSION3'])
      assert(p.configuration.includes('!CONFIG_' + f + '=yes'), target + ' ' + f);
    const tools = [];
    for (const n of ['ffmpeg', 'ffprobe']) {
      const file = n + (target === 'windows-x64' ? '.exe' : ''),
        b = await fs.readFile(path.join(base, file));
      assert.equal(crypto.createHash('sha256').update(b).digest('hex'), p.sha256[file]);
      if (target === 'linux-x64') {
        assert.equal(b.subarray(0, 5).toString('hex'), '7f454c4602');
        assert.equal(b.readUInt16LE(18), 62);
        const o = Number(b.readBigUInt64LE(32)),
          size = b.readUInt16LE(54),
          count = b.readUInt16LE(56);
        for (let i = 0; i < count; i++)
          assert.notEqual(b.readUInt32LE(o + i * size), 3, 'No external ELF interpreter');
        tools.push({ file, architecture: 'ELF x86_64', staticallyLinked: true });
      } else {
        assert.equal(peMachine(b), 0x8664);
        const imports = peImports(b);
        for (const dll of imports)
          assert(
            /^(?:kernel32|msvcrt|ucrtbase|advapi32|user32|shell32|ole32|oleaut32|ws2_32|bcrypt|secur32|ntdll|gdi32|psapi|avrt|winmm|shlwapi|version|api-ms-win-[\w-]+)\.dll$/.test(
              dll
            ),
            'Unexpected runtime DLL: ' + dll
          );
        tools.push({ file, architecture: 'PE x64', imports });
      }
    }
    for (const file of ['build-media-cross.cjs', 'build-media-macos.cjs'])
      assert(
        (await fs.readFile(path.join(root, 'scripts', file))).equals(
          await fs.readFile(path.join(base, 'sources', file))
        ),
        'Current rebuild recipe ' + file
      );
    results.push({
      target,
      sourceArchives: SOURCES.length,
      requiredCodecsAndFilters: features,
      tools
    });
  }
  const report = {
    version: require('../package.json').version,
    result: 'passed',
    scope:
      'architecture, dependencies, enabled media features, licenses, complete pinned source archives and current rebuild recipes',
    nativeWindowsLinuxExecution: false,
    results
  };
  await fs.writeFile(
    path.join(root, 'dist/MEDIA_DISTRIBUTION_VALIDATION.json'),
    JSON.stringify(report, null, 2) + '\n'
  );
  console.log(JSON.stringify(report));
}
if (require.main === module)
  check().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
module.exports = { check, peImports };
