'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const { EventEmitter } = require('node:events');
const { cdnURL, download, webpFrames, createMedia } = require('../core/media.cjs');
const url = 'https://cdn2.steamgriddb.com/hero/animation.webm';
function requestWith(responses, seen = []) {
  return (u, opts, cb) => {
    seen.push(u.href);
    const req = new EventEmitter();
    process.nextTick(() => {
      const spec = responses.shift(),
        res = Readable.from(spec.body || []);
      res.statusCode = spec.status || 200;
      res.headers = spec.headers || {};
      cb(res);
    });
    return req;
  };
}
async function temporary(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cinema-media-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  return dir;
}
test('CDN allowlist rejects network and credential escapes', () => {
  assert.equal(cdnURL(url).hostname, 'cdn2.steamgriddb.com');
  for (const u of [
    'http://cdn2.steamgriddb.com/x',
    'https://cdn2.steamgriddb.com.evil.test/x',
    'https://localhost/x',
    'https://user:pass@cdn2.steamgriddb.com/x',
    'https://cdn2.steamgriddb.com:444/x',
    'file:///etc/passwd'
  ])
    assert.throws(() => cdnURL(u));
});
test('downloads bytes and bounded redirects without forwarding credentials', async (t) => {
  const dir = await temporary(t),
    seen = [];
  await download(url, path.join(dir, 'ok'), {
    requestImpl: requestWith(
      [
        { status: 302, headers: { location: '/hero/next.webm' } },
        { body: [Buffer.from('verified')], headers: { 'content-length': '8' } }
      ],
      seen
    )
  });
  assert.equal(await fs.readFile(path.join(dir, 'ok'), 'utf8'), 'verified');
  assert.equal(seen.length, 2);
});
test('rejects redirects outside CDN without creating a partial file', async (t) => {
  const dir = await temporary(t),
    target = path.join(dir, 'partial');
  await assert.rejects(
    download(url, target, {
      requestImpl: requestWith([{ status: 302, headers: { location: 'https://127.0.0.1/secret' } }])
    }),
    /CDN/
  );
  await assert.rejects(fs.stat(target), { code: 'ENOENT' });
});
test('download oversize and truncation are rejected and cleaned', async (t) => {
  const dir = await temporary(t);
  for (const spec of [
    { body: [Buffer.alloc(9)] },
    { body: [Buffer.alloc(2)], headers: { 'content-length': '5' } }
  ]) {
    const target = path.join(dir, 'partial');
    await assert.rejects(download(url, target, { maxBytes: 5, requestImpl: requestWith([spec]) }));
    await assert.rejects(fs.stat(target), { code: 'ENOENT' });
  }
});
test('cancellation never leaves an incomplete file', async (t) => {
  const dir = await temporary(t),
    signal = AbortSignal.abort();
  await assert.rejects(download(url, path.join(dir, 'partial'), { signal }), {
    name: 'AbortError'
  });
  assert.deepEqual(await fs.readdir(dir), []);
});
test('rejects corrupt WebP containers', () => {
  assert.throws(() => webpFrames(Buffer.from('RIFFgarbage WEBP')));
});
test('validation refuses traversal, symlinks and missing media before decoding', async (t) => {
  const dir = await temporary(t),
    media = createMedia({ dataDir: dir });
  assert.equal(await media.validate({ file: '../escape', thumbnail: 'x' }), false);
  assert.equal(await media.validate({ file: 'missing.gif', thumbnail: 'x.jpg' }), false);
  await fs.mkdir(path.join(dir, 'media'));
  await fs.symlink('/etc/passwd', path.join(dir, 'media', 'linked.gif'));
  assert.equal(await media.validate({ file: 'linked.gif', thumbnail: 'linked.gif' }), false);
});
const { spawnSync } = require('node:child_process');
let ffmpeg;
try {
  ffmpeg = require('ffmpeg-static');
} catch {}
function fixtureMedia(input) {
  return createMedia({
    dataDir: input.dataDir,
    downloadImpl: async (url, dest, options) => {
      if (options.signal?.aborted)
        throw Object.assign(new Error('cancelled'), { name: 'AbortError' });
      await fs.copyFile(input.source, dest);
    }
  });
}
test(
  'real FFmpeg validates animated GIF, WebP and VP9 WebM, preserves source and thumbnails',
  { skip: !ffmpeg },
  async (t) => {
    const root = await temporary(t);
    for (const format of ['gif', 'webp', 'webm']) {
      const source = path.join(root, `test.${format}`),
        args = ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=160x90:rate=6:duration=1'];
      if (format === 'webp') args.push('-c:v', 'libwebp_anim', '-loop', '0');
      if (format === 'webm') args.push('-c:v', 'libvpx-vp9', '-pix_fmt', 'yuv420p');
      const generated = spawnSync(ffmpeg, [...args, '-y', source]);
      assert.equal(generated.status, 0, generated.stderr.toString());
      const dataDir = path.join(root, `data-${format}`),
        media = fixtureMedia({ source, dataDir }),
        result = await media.prepare({ url, animated: true, author: { name: 'Fixture author' } });
      assert.equal(result.animated, true);
      assert.equal(result.width, 160);
      assert.equal(result.height, 90);
      assert.equal(result.format, format);
      assert(result.duration > 0.8 && result.duration < 1.2);
      assert.equal(await media.validate(result), true);
      assert.deepEqual(
        await fs.readFile(path.join(dataDir, 'media', result.sourceFile)),
        await fs.readFile(source)
      );
      await fs.writeFile(path.join(dataDir, 'media', result.thumbnail), 'broken JPEG');
      assert.equal(await media.validate(result), false);
    }
  }
);
test(
  'real decoding rejects corrupt input, static masquerading as animation and exhausted storage',
  { skip: !ffmpeg },
  async (t) => {
    const root = await temporary(t),
      source = path.join(root, 'input.gif'),
      dataDir = path.join(root, 'data');
    await fs.writeFile(source, 'not an image');
    const media = fixtureMedia({ source, dataDir });
    await assert.rejects(media.prepare({ url, animated: true }), /validation|decod|signature/);
    assert.deepEqual(await fs.readdir(path.join(dataDir, 'media')), []);
    assert.equal(
      spawnSync(ffmpeg, [
        '-v',
        'error',
        '-f',
        'lavfi',
        '-i',
        'color=blue:size=160x90',
        '-frames:v',
        '1',
        '-y',
        source
      ]).status,
      0
    );
    await assert.rejects(media.prepare({ url, animated: true }), /static/);
    await assert.rejects(media.prepare({ url, animated: false }, { maxBytes: 2 }), /storage/);
    assert.deepEqual(await fs.readdir(path.join(dataDir, 'media')), []);
  }
);
test('signature recognition rejects HLS and concat before any decoder can follow files', () => {
  const { demuxer } = require('../core/media.cjs');
  for (const bytes of [
    Buffer.from('#EXTM3U\n#EXTINF:1\nfile:///etc/passwd'),
    Buffer.from('ffconcat version 1.0\nfile /etc/passwd')
  ])
    assert.throws(() => demuxer(bytes), /signature/);
});
test('media directory symlinks cannot redirect preparation writes', async (t) => {
  const root = await temporary(t),
    dataDir = path.join(root, 'data'),
    other = path.join(root, 'other');
  await fs.mkdir(dataDir);
  await fs.mkdir(other);
  await fs.symlink(other, path.join(dataDir, 'media'));
  const media = createMedia({
    dataDir,
    downloadImpl: async () => assert.fail('download must not start')
  });
  await assert.rejects(media.prepare({ url, animated: true }), /unsafe/);
  assert.equal(await media.validate({ file: 'x.gif', thumbnail: 'x.jpg' }), false);
  assert.deepEqual(await fs.readdir(other), []);
});
test('cache validation propagates cancellation to the queue', async () => {
  await assert.rejects(
    createMedia({ dataDir: '/tmp/cinema-no-read' }).validate({}, { signal: AbortSignal.abort() }),
    { name: 'AbortError' }
  );
});
test(
  'incompatible WebM codecs are really transcoded to VP9 while preserving original bytes',
  { skip: !ffmpeg },
  async (t) => {
    const root = await temporary(t),
      source = path.join(root, 'av1.webm'),
      r = spawnSync(ffmpeg, [
        '-v',
        'error',
        '-f',
        'lavfi',
        '-i',
        'testsrc=size=96x54:rate=4:duration=1',
        '-c:v',
        'libaom-av1',
        '-cpu-used',
        '8',
        '-threads',
        '2',
        '-pix_fmt',
        'yuv420p',
        '-y',
        source
      ]);
    assert.equal(r.status, 0, r.stderr.toString());
    const dataDir = path.join(root, 'data'),
      media = fixtureMedia({ source, dataDir }),
      out = await media.prepare({ url, animated: true });
    assert.match(out.file, /\.vp9\.webm$/);
    assert.notEqual(out.file, out.sourceFile);
    assert.equal(await media.validate(out), true);
    assert.deepEqual(
      await fs.readFile(path.join(dataDir, 'media', out.sourceFile)),
      await fs.readFile(source)
    );
  }
);
