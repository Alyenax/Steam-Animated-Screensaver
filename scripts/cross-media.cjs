'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { buildCross, SOURCES } = require('./build-media-cross.cjs');
function peMachine(bytes) {
  if (bytes.length < 64 || bytes.toString('ascii', 0, 2) !== 'MZ')
    throw Error('Invalid PE executable.');
  const p = bytes.readUInt32LE(60);
  if (p + 6 > bytes.length || bytes.toString('ascii', p, p + 4) !== 'PE\0\0')
    throw Error('Invalid PE header.');
  return bytes.readUInt16LE(p + 4);
}
async function stageCrossMedia({ target, cache, destination }) {
  let provenance = await fs
    .readFile(path.join(cache, 'PROVENANCE.json'), 'utf8')
    .then(JSON.parse, () => null);
  if (!provenance) {
    await buildCross({ target, output: cache });
    provenance = JSON.parse(await fs.readFile(path.join(cache, 'PROVENANCE.json'), 'utf8'));
  }
  if (
    provenance.target !== target ||
    JSON.stringify(provenance.sources) !== JSON.stringify(SOURCES)
  )
    throw Error('Cross media source provenance mismatch. Rebuild the media cache.');
  for (const name of ['ffmpeg', 'ffprobe']) {
    const n = name + (target === 'windows-x64' ? '.exe' : '');
    const b = await fs.readFile(path.join(cache, n));
    if (crypto.createHash('sha256').update(b).digest('hex') !== provenance.sha256[n])
      throw Error('Cross media executable checksum mismatch.');
    if (target === 'windows-x64') {
      if (peMachine(b) !== 0x8664) throw Error('Expected Windows x64 media tools.');
    } else if (b.subarray(0, 5).toString('hex') !== '7f454c4602' || b.readUInt16LE(18) !== 62)
      throw Error('Expected Linux x86_64 ELF media tools.');
  }
  for (const source of SOURCES) {
    const b = await fs.readFile(path.join(cache, 'sources', source.name));
    if (crypto.createHash('sha256').update(b).digest('hex') !== source.sha256)
      throw Error('Packaged media source checksum mismatch.');
  }
  await fs.cp(cache, destination, { recursive: true });
  return provenance.sha256;
}
module.exports = { stageCrossMedia, peMachine };
