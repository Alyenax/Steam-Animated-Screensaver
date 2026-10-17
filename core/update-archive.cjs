'use strict';
const fs = require('node:fs/promises');
const { createReadStream, createWriteStream } = require('node:fs');
const path = require('node:path');
const { pipeline } = require('node:stream/promises');
const { Transform } = require('node:stream');
const { createGunzip } = require('node:zlib');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const run = promisify(execFile);
const { TARGETS, MAX_UNPACKED, UpdateError } = require('./update-format.cjs');
const inside = (base, file) => file.startsWith(base + path.sep);
async function noLinks(file) {
  for (let p = path.resolve(file); ; p = path.dirname(p)) {
    const s = await fs.lstat(p).catch((e) => {
      if (e.code !== 'ENOENT') throw e;
    });
    const systemAlias =
      process.platform === 'darwin' &&
      ['/tmp', '/var', '/etc'].includes(p) &&
      s?.isSymbolicLink() &&
      (await fs.realpath(p)) === '/private' + p;
    if (s?.isSymbolicLink() && !systemAlias)
      throw new UpdateError('path', 'Update paths must not contain symbolic links.');
    if (p === path.dirname(p)) break;
  }
}
async function space(directory, bytes) {
  const s = await fs.statfs(directory);
  if (Number(s.bavail) * Number(s.bsize) < bytes + 64 * 1024 * 1024)
    throw new UpdateError('space', 'Not enough free disk space for this update.');
}
function entryPath(name, root) {
  if (
    typeof name !== 'string' ||
    name.length > 1024 ||
    /[\\\x00-\x1f:]/.test(name) ||
    name.startsWith('/')
  )
    throw new UpdateError('archive', 'Unsafe archive path.');
  const parts = name.replace(/\/$/, '').split('/');
  if (
    parts[0] !== root ||
    parts.some(
      (p) =>
        !p ||
        p === '.' ||
        p === '..' ||
        /[. ]$/.test(p) ||
        /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p)
    )
  )
    throw new UpdateError('archive', 'Unexpected archive path.');
  return parts.join('/');
}
async function extractArchive(
  file,
  destination,
  { target, unpackedBytes, signal, progress = () => {} }
) {
  if (!TARGETS[target] || target === 'darwin-arm64')
    throw new UpdateError('platform', 'Invalid archive target.');
  await noLinks(path.dirname(destination));
  await fs.mkdir(destination, { mode: 0o700 });
  const root = TARGETS[target].root,
    seen = new Set(),
    links = [];
  let total = 0,
    entries = 0,
    written = 0;
  const limit = Math.min(MAX_UNPACKED, unpackedBytes);
  function validate(name, size, type, link) {
    signal?.throwIfAborted();
    const relative = entryPath(name, root),
      folded = relative.toLowerCase();
    if (
      ++entries > 20000 ||
      seen.has(folded) ||
      !Number.isSafeInteger(size) ||
      size < 0 ||
      (total += size) > limit
    )
      throw new UpdateError('archive', 'Duplicate, oversized or invalid archive entries.');
    seen.add(folded);
    if (
      !['file', 'directory', 'symlink'].includes(type) ||
      (target === 'win32-x64' && type === 'symlink')
    )
      throw new UpdateError('archive', 'Unsupported archive entry.');
    const output = path.join(destination, relative);
    if (type === 'symlink') {
      if (
        !link ||
        path.isAbsolute(link) ||
        /[\\\x00-\x1f]/.test(link) ||
        !inside(path.join(destination, root), path.resolve(path.dirname(output), link))
      )
        throw new UpdateError('archive', 'Unsafe archive link.');
      links.push([output, link]);
    }
    return output;
  }
  async function write(source, output, size, mode) {
    await fs.mkdir(path.dirname(output), { recursive: true, mode: 0o755 });
    let count = 0;
    const meter = new Transform({
      transform(chunk, _encoding, callback) {
        count += chunk.length;
        written += chunk.length;
        if (count > size || written > limit)
          return callback(new UpdateError('archive', 'Extracted data exceeds its declared size.'));
        progress(written, unpackedBytes);
        callback(null, chunk);
      }
    });
    await pipeline(
      source,
      meter,
      createWriteStream(output, { flags: 'wx', mode: mode & 0o111 ? 0o755 : 0o644 }),
      { signal }
    );
    if (count !== size) throw new UpdateError('archive', 'Incomplete archive entry.');
  }
  try {
    if (target === 'win32-x64') {
      const zip = await new Promise((resolve, reject) =>
        require('yauzl').open(
          file,
          { lazyEntries: true, strictFileNames: true, validateEntrySizes: true },
          (e, z) => (e ? reject(e) : resolve(z))
        )
      );
      try {
        await new Promise((resolve, reject) => {
          zip.on('error', reject);
          zip.on('end', resolve);
          zip.on('entry', (entry) => {
            (async () => {
              const mode = entry.externalFileAttributes >>> 16,
                kind = mode & 0o170000;
              if (entry.generalPurposeBitFlag & 1 || ![0, 0o100000, 0o040000].includes(kind))
                throw new UpdateError('archive', 'Unsupported ZIP entry.');
              const directory = entry.fileName.endsWith('/');
              const output = validate(
                entry.fileName,
                entry.uncompressedSize,
                directory ? 'directory' : 'file'
              );
              if (directory) await fs.mkdir(output, { recursive: true, mode: 0o755 });
              else {
                const stream = await new Promise((r, j) =>
                  zip.openReadStream(entry, (e, s) => (e ? j(e) : r(s)))
                );
                await write(stream, output, entry.uncompressedSize, mode);
              }
              zip.readEntry();
            })().catch(reject);
          });
          zip.readEntry();
        });
      } finally {
        zip.close();
      }
    } else {
      const extract = require('tar-stream').extract();
      extract.on('entry', (header, stream, next) => {
        (async () => {
          const output = validate(header.name, header.size, header.type, header.linkname);
          if (header.type === 'file') await write(stream, output, header.size, header.mode);
          else {
            if (header.type === 'directory')
              await fs.mkdir(output, { recursive: true, mode: 0o755 });
            for await (const block of stream)
              if (block.length) throw new UpdateError('archive', 'Unexpected entry data.');
          }
          next();
        })().catch((e) => extract.destroy(e));
      });
      await pipeline(createReadStream(file), createGunzip(), extract, { signal });
    }
    for (const [output, link] of links) {
      await fs.mkdir(path.dirname(output), { recursive: true });
      await fs.symlink(link, output);
    }
    for (const [output] of links)
      if (!inside(path.join(destination, root), await fs.realpath(output)))
        throw new UpdateError('archive', 'Archive link leaves the application.');
    if (!entries || written < 1) throw new UpdateError('archive', 'Empty application archive.');
    return path.join(destination, root);
  } catch (e) {
    await fs.rm(destination, { recursive: true, force: true });
    throw e;
  }
}
async function treeInfo(root) {
  const base = await fs.realpath(root);
  let bytes = 0,
    count = 0;
  async function walk(folder) {
    for (const e of await fs.readdir(folder, { withFileTypes: true })) {
      if (++count > 20000) throw new UpdateError('archive', 'Too many application files.');
      const file = path.join(folder, e.name),
        s = await fs.lstat(file);
      if (s.isSymbolicLink()) {
        if (!inside(base, await fs.realpath(file)))
          throw new UpdateError('archive', 'Application link escapes its bundle.');
      } else if (s.isDirectory()) await walk(file);
      else if (s.isFile()) {
        bytes += s.size;
        if (bytes > MAX_UNPACKED) throw new UpdateError('archive', 'Application is too large.');
      } else throw new UpdateError('archive', 'Unsupported application file.');
    }
  }
  await walk(base);
  return { bytes, count };
}
async function validateApp(root, target, version) {
  const config = TARGETS[target];
  if (!config) throw new UpdateError('platform', 'Invalid application platform.');
  const file = path.join(root, config.package),
    st = await fs.lstat(file);
  if (!st.isFile() || st.isSymbolicLink() || st.size > 65536)
    throw new UpdateError('package', 'Invalid application metadata.');
  const p = JSON.parse(await fs.readFile(file, 'utf8'));
  if (
    p.name !== 'steam-animated-screensaver' ||
    p.version !== version ||
    p.productName !== 'Steam Animated Screensaver'
  )
    throw new UpdateError('package', 'The application identity or version is incorrect.');
  const exe = await fs.lstat(path.join(root, config.executable));
  if (!exe.isFile() || exe.isSymbolicLink())
    throw new UpdateError('package', 'The application executable is missing.');
  return p;
}
async function prepareMac(file, destination, options) {
  const mount = destination + '-mount';
  await fs.mkdir(mount, { mode: 0o700 });
  try {
    await run(
      '/usr/bin/hdiutil',
      ['attach', '-readonly', '-nobrowse', '-noautoopen', '-mountpoint', mount, file],
      { timeout: 60000, signal: options.signal }
    );
    const app = path.join(mount, TARGETS['darwin-arm64'].root);
    const info = await treeInfo(app);
    if (info.bytes > options.unpackedBytes)
      throw new UpdateError('archive', 'The app exceeds its signed unpacked size.');
    await fs.mkdir(destination, { mode: 0o700 });
    const output = path.join(destination, TARGETS['darwin-arm64'].root);
    // ditto preserves framework links and bundle metadata without removing quarantine.
    await run('/usr/bin/ditto', [app, output], { timeout: 120000, signal: options.signal });
    await run('/usr/bin/codesign', ['--verify', '--deep', '--strict', output], {
      timeout: 60000,
      signal: options.signal
    });
    options.progress?.(info.bytes, options.unpackedBytes);
    return output;
  } catch (e) {
    await fs.rm(destination, { recursive: true, force: true });
    throw e;
  } finally {
    await run('/usr/bin/hdiutil', ['detach', mount], { timeout: 20000 }).catch(() => {});
    await fs.rmdir(mount).catch(() => {});
  }
}
module.exports = {
  noLinks,
  space,
  entryPath,
  extractArchive,
  prepareMac,
  validateApp,
  treeInfo,
  inside
};
