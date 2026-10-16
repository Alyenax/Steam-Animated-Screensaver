'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const VERSION = 'ffmpeg-n8.1.3-18-g46d899d7a0-win64-lgpl-8.1';
const SHA256 = 'dc725e2f9b1c6d829c1d0a2ceffa28bffb3b54468e972f7467a38021ff6032aa';
const URL = `https://github.com/BtbN/FFmpeg-Builds/releases/download/autobuild-2026-10-15-13-03/${VERSION}.zip`;
function peMachine(bytes) {
  if (bytes.length < 64 || bytes.toString('ascii', 0, 2) !== 'MZ')
    throw new Error('Invalid Windows executable.');
  const offset = bytes.readUInt32LE(60);
  if (offset + 6 > bytes.length || bytes.toString('ascii', offset, offset + 4) !== 'PE\0\0')
    throw new Error('Invalid PE header.');
  return bytes.readUInt16LE(offset + 4);
}
async function stageWindowsMedia({ cache, destination, download }) {
  await fs.mkdir(cache, { recursive: true });
  const archive = path.join(cache, 'upstream.zip');
  try {
    await fs.access(archive);
  } catch {
    await download(URL, archive);
  }
  const digest = crypto
    .createHash('sha256')
    .update(await fs.readFile(archive))
    .digest('hex');
  if (digest !== SHA256) throw new Error('Pinned Windows media archive checksum mismatch.');
  const sha256 = {};
  for (const name of ['ffmpeg', 'ffprobe']) {
    const bytes = execFileSync('unzip', ['-p', archive, `${VERSION}/bin/${name}.exe`], {
      maxBuffer: 160 * 1024 * 1024
    });
    if (peMachine(bytes) !== 0x8664)
      throw new Error('The media tools must be Windows x64 executables.');
    await fs.writeFile(path.join(destination, `${name}.exe`), bytes);
    sha256[`${name}.exe`] = crypto.createHash('sha256').update(bytes).digest('hex');
  }
  await fs.writeFile(
    path.join(destination, 'FFmpeg.LICENSE.txt'),
    execFileSync('unzip', ['-p', archive, `${VERSION}/LICENSE.txt`])
  );
  await fs.writeFile(
    path.join(destination, 'PROVENANCE.json'),
    JSON.stringify(
      {
        target: 'win32-x64',
        upstream: URL,
        archiveSHA256: SHA256,
        sha256,
        license: 'LGPL-2.1-or-later, separate upstream executables',
        source: 'https://github.com/FFmpeg/FFmpeg/tree/46d899d7a0',
        buildRecipes: 'https://github.com/BtbN/FFmpeg-Builds/tree/autobuild-2026-10-15-13-03',
        validation:
          'Archive digest and x64 PE headers verified. Native Windows runtime acceptance pending.'
      },
      null,
      2
    ) + '\n'
  );
  return sha256;
}
module.exports = { stageWindowsMedia, peMachine, VERSION, SHA256, URL };
