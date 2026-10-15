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
test(
  'real interpolation produces 30 fps VP9 from GIF, WebP and WebM without downloading again',
  { skip: !ffmpeg, timeout: 45000 },
  async (t) => {
    const root = await temporary(t);
    for (const format of ['gif', 'webp', 'webm']) {
      const source = path.join(root, `smooth.${format}`);
      const args = ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=96x54:rate=6:duration=1'];
      if (format === 'webp') args.push('-c:v', 'libwebp_anim', '-lossless', '0', '-loop', '0');
      if (format === 'webm') args.push('-c:v', 'libvpx-vp9', '-pix_fmt', 'yuv420p');
      const r = spawnSync(ffmpeg, [...args, '-y', source]);
      assert.equal(r.status, 0, r.stderr.toString());
      const dataDir = path.join(root, `smooth-${format}`);
      let downloads = 0;
      const media = createMedia({
        dataDir,
        downloadImpl: async (_, dest) => {
          downloads++;
          await fs.copyFile(source, dest);
        }
      });
      const original = await media.prepare({ url, animated: true });
      const smooth = await media.smooth(original);
      assert.equal(downloads, 1);
      assert.equal(smooth.format, 'webm');
      assert.equal(smooth.smoothing, 'interpolate-30-v1');
      assert.equal(await media.validate(smooth), true);
      assert.equal(await media.validate(original), true);
      assert.deepEqual(
        await fs.readFile(path.join(dataDir, 'media', original.sourceFile)),
        await fs.readFile(source)
      );
      assert(Math.abs(smooth.duration - original.duration) < 0.1);
      const probe = JSON.parse(
        spawnSync(require('ffprobe-static').path, [
          '-v',
          'error',
          '-count_frames',
          '-show_entries',
          'stream=nb_read_frames,codec_name,r_frame_rate',
          '-of',
          'json',
          path.join(dataDir, 'media', smooth.file)
        ]).stdout
      );
      assert.equal(probe.streams[0].codec_name, 'vp9');
      assert.equal(probe.streams[0].r_frame_rate, '30/1');
      assert(Number(probe.streams[0].nb_read_frames) >= 29);
      const hashes = spawnSync(ffmpeg, [
        '-v',
        'error',
        '-i',
        path.join(dataDir, 'media', smooth.file),
        '-f',
        'framemd5',
        '-'
      ])
        .stdout.toString()
        .split('\n')
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => line.split(',').at(-1).trim());
      assert(
        new Set(hashes).size > 10,
        `${format} must generate intermediate frames, not only duplicate originals`
      );
      await assert.rejects(media.smooth(original, { maxBytes: 2 }), /storage/);
      await assert.rejects(media.smooth(original, { signal: AbortSignal.abort() }), {
        name: 'AbortError'
      });
      assert(
        (await fs.readdir(path.join(dataDir, 'media'))).every(
          (name) => !name.endsWith('.frames') && !name.endsWith('.partial')
        )
      );
    }
  }
);
test(
  'static cover validation rejects an animation even when provider calls it static',
  { skip: !ffmpeg },
  async (t) => {
    const root = await temporary(t),
      source = path.join(root, 'animated.gif');
    const r = spawnSync(ffmpeg, [
      '-v',
      'error',
      '-f',
      'lavfi',
      '-i',
      'testsrc=size=96x54:rate=6:duration=1',
      '-y',
      source
    ]);
    assert.equal(r.status, 0, r.stderr.toString());
    const media = fixtureMedia({ source, dataDir: path.join(root, 'data') });
    await assert.rejects(
      media.prepare({ url, animated: false }, { requireStatic: true }),
      /still image/
    );
  }
);
test(
  'WebP interpolation composes offset alpha frames with disposal rather than treating delta rectangles as full images',
  { skip: !ffmpeg },
  async (t) => {
    const root = await temporary(t);
    const chunk = (type, data) => {
      const header = Buffer.alloc(8);
      header.write(type);
      header.writeUInt32LE(data.length, 4);
      return Buffer.concat([header, data, ...(data.length % 2 ? [Buffer.alloc(1)] : [])]);
    };
    const vp8x = Buffer.alloc(10);
    vp8x[0] = 0x12;
    vp8x.writeUIntLE(95, 4, 3);
    vp8x.writeUIntLE(53, 7, 3);
    const parts = [chunk('VP8X', vp8x), chunk('ANIM', Buffer.alloc(6))];
    for (const [i, [width, height, x, y, color, flags]] of [
      [96, 54, 0, 0, [255, 0, 0, 255], 2],
      [32, 20, 10, 10, [0, 255, 0, 128], 0],
      [32, 20, 20, 20, [0, 0, 255, 255], 1],
      [32, 20, 0, 0, [0, 255, 255, 200], 0]
    ].entries()) {
      const frame = path.join(root, `delta-${i}.webp`),
        rgba = Buffer.alloc(width * height * 4);
      for (let p = 0; p < rgba.length; p += 4) rgba.set(color, p);
      const r = spawnSync(
        ffmpeg,
        [
          '-v',
          'error',
          '-f',
          'rawvideo',
          '-pixel_format',
          'rgba',
          '-video_size',
          `${width}x${height}`,
          '-i',
          'pipe:0',
          '-frames:v',
          '1',
          '-c:v',
          'libwebp',
          '-lossless',
          i === 1 ? '0' : '1',
          '-y',
          frame
        ],
        { input: rgba }
      );
      assert.equal(r.status, 0, r.stderr.toString());
      const still = await fs.readFile(frame),
        payload = [];
      for (let offset = 12; offset + 8 <= still.length;) {
        const size = still.readUInt32LE(offset + 4);
        if (still.toString('ascii', offset, offset + 4) !== 'VP8X')
          payload.push(still.subarray(offset, offset + 8 + size + (size % 2)));
        offset += 8 + size + (size % 2);
      }
      const header = Buffer.alloc(16);
      header.writeUIntLE(x / 2, 0, 3);
      header.writeUIntLE(y / 2, 3, 3);
      header.writeUIntLE(width - 1, 6, 3);
      header.writeUIntLE(height - 1, 9, 3);
      header.writeUIntLE(250, 12, 3);
      header[15] = flags;
      parts.push(chunk('ANMF', Buffer.concat([header, ...payload])));
    }
    const body = Buffer.concat(parts),
      riff = Buffer.alloc(12);
    riff.write('RIFF');
    riff.writeUInt32LE(body.length + 4, 4);
    riff.write('WEBP', 8);
    const source = path.join(root, 'delta.webp');
    await fs.writeFile(source, Buffer.concat([riff, body]));
    const dataDir = path.join(root, 'data'),
      media = fixtureMedia({ source, dataDir });
    const original = await media.prepare({ url, animated: true });
    const result = await media.smooth(original);
    assert.equal(await media.validate(result), true);
    assert.equal(result.width, 96);
    assert.equal(result.height, 54);
    assert(Math.abs(result.duration - 1) < 0.1);
  }
);
test(
  'previews decode WebM, GIF, WebP, PNG and JPEG into cached still JPEGs, coalesce and repair stale cached images',
  { skip: !ffmpeg },
  async (t) => {
    const root = await temporary(t);
    for (const format of ['webm', 'gif', 'webp', 'png', 'jpg']) {
      const source = path.join(root, `preview.${format}`),
        args = ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=96x54:rate=6:duration=1'];
      if (['png', 'jpg'].includes(format)) args.push('-frames:v', '1');
      if (format === 'webm') args.push('-c:v', 'libvpx-vp9', '-pix_fmt', 'yuv420p');
      if (format === 'webp') args.push('-c:v', 'libwebp_anim', '-loop', '0');
      const r = spawnSync(ffmpeg, [...args, '-y', source]);
      assert.equal(r.status, 0, r.stderr.toString());
      const dataDir = path.join(root, `preview-${format}`);
      let downloads = 0;
      const media = createMedia({
        dataDir,
        downloadImpl: async (_, dest) => {
          downloads++;
          await fs.copyFile(source, dest);
        }
      });
      const [a, b] = await Promise.all([media.preview({ url }), media.preview({ url })]);
      assert.equal(a.file, b.file);
      assert.equal(downloads, 1);
      assert(
        (await fs.readFile(path.join(dataDir, 'media', a.file)))
          .subarray(0, 3)
          .equals(Buffer.from([255, 216, 255]))
      );
      assert.deepEqual(await fs.readdir(path.join(dataDir, 'media')), [a.file]);
      await media.preview({ url });
      assert.equal(downloads, 1);
      await fs.writeFile(path.join(dataDir, 'media', a.file), 'corrupt cache');
      await media.preview({ url }, { force: true });
      assert.equal(downloads, 2);
      await assert.rejects(media.preview({ url: 'https://evil.example/a.png' }), /SteamGridDB/);
      await assert.rejects(media.preview({ file: '../outside.png' }), /Unsafe/);
    }
  }
);
test(
  'processed video validation accepts valid files above the previous 160 MiB ceiling without reading them into memory',
  { skip: !ffmpeg },
  async (t) => {
    const root = await temporary(t),
      source = path.join(root, 'original.webm');
    const r = spawnSync(ffmpeg, [
      '-v',
      'error',
      '-f',
      'lavfi',
      '-i',
      'testsrc=size=96x54:rate=30:duration=1',
      '-c:v',
      'libvpx-vp9',
      '-pix_fmt',
      'yuv420p',
      '-y',
      source
    ]);
    assert.equal(r.status, 0, r.stderr.toString());
    const dataDir = path.join(root, 'data'),
      media = fixtureMedia({ source, dataDir });
    const original = await media.prepare({ url, animated: true });
    const input = await fs.readFile(source),
      segment = input.indexOf(Buffer.from([0x18, 0x53, 0x80, 0x67]));
    assert(segment > 0);
    assert.equal(input[segment + 4], 1);
    const padding = 161 * 1024 * 1024,
      voidHeader = Buffer.alloc(9);
    voidHeader[0] = 0xec;
    voidHeader.writeBigUInt64BE(0x0100000000000000n + BigInt(padding), 1);
    const segmentSize = input.readBigUInt64BE(segment + 4) & 0x00ffffffffffffffn;
    input.writeBigUInt64BE(0x0100000000000000n + segmentSize + BigInt(padding + 9), segment + 4);
    const large = path.join(dataDir, 'media', 'large-processed.webm'),
      handle = await fs.open(large, 'w');
    try {
      await handle.write(input);
      await handle.write(voidHeader);
      await handle.truncate(input.length + voidHeader.length + padding);
    } finally {
      await handle.close();
    }
    const processed = { ...original, file: 'large-processed.webm', smoothing: 'interpolate-30-v1' };
    assert((await fs.stat(large)).size > 160 * 1024 * 1024);
    assert.equal(await media.validate(processed), true);
    assert.equal(await media.validate({ ...processed, smoothing: undefined }), false);
  }
);
