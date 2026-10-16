'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const https = require('node:https');
const crypto = require('node:crypto');
const { smoothingConfig, smoothingFilter } = require('./smoothing.cjs');
const { spawn } = require('node:child_process');
const { pipeline } = require('node:stream/promises');
const { Transform } = require('node:stream');
const { createReadStream, createWriteStream, existsSync } = require('node:fs');
const LIMITS = {
  bytes: 160 * 1024 * 1024,
  downloadMs: 120000,
  processMs: 180000,
  pixels: 3840 * 2160,
  frames: 18000,
  duration: 600
};
function cdnURL(value) {
  const u = new URL(value);
  if (
    u.protocol !== 'https:' ||
    !['cdn2.steamgriddb.com', 'cdn.steamgriddb.com'].includes(u.hostname) ||
    u.port ||
    u.username ||
    u.password ||
    u.hash
  )
    throw new Error('Only HTTPS SteamGridDB CDN media URLs are allowed.');
  return u;
}
function basename(value) {
  return (
    typeof value === 'string' &&
    /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,180}$/.test(value) &&
    !value.includes('..')
  );
}
function aborted(signal) {
  if (signal?.aborted)
    throw Object.assign(new Error('Preparation cancelled.'), { name: 'AbortError' });
}
async function download(
  url,
  destination,
  {
    signal,
    onProgress,
    requestImpl = https.get,
    maxBytes = LIMITS.bytes,
    timeoutMs = LIMITS.downloadMs
  } = {}
) {
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(
    () => controller.abort(new Error('Media download timed out.')),
    timeoutMs
  );
  let bytes = 0;
  try {
    aborted(signal);
    let current = cdnURL(url);
    for (let hop = 0; hop < 5; hop++) {
      aborted(controller.signal);
      const response = await new Promise((resolve, reject) => {
        const req = requestImpl(
          current,
          {
            signal: controller.signal,
            headers: {
              'User-Agent': 'Steam-Animated-Screensaver/0.1',
              Accept: 'image/*,video/webm'
            }
          },
          resolve
        );
        req.on('error', reject);
      });
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        response.resume();
        if (!response.headers.location) throw new Error('Invalid CDN redirect.');
        current = cdnURL(new URL(response.headers.location, current).href);
        continue;
      }
      if (response.statusCode !== 200) {
        response.resume();
        throw new Error(`Media server returned HTTP ${response.statusCode}.`);
      }
      const total = Number(response.headers['content-length']) || 0;
      if (total > maxBytes) {
        response.destroy();
        throw new Error('Media exceeds the download size limit.');
      }
      const limiter = new Transform({
        transform(chunk, encoding, callback) {
          bytes += chunk.length;
          if (bytes > maxBytes)
            return callback(new Error('Media exceeds the download size limit.'));
          onProgress?.({ stage: 'downloading', bytes, total });
          callback(null, chunk);
        }
      });
      await pipeline(
        response,
        limiter,
        createWriteStream(destination, { flags: 'wx', mode: 0o600 }),
        { signal: controller.signal }
      );
      if (!bytes || (total && total !== bytes)) throw new Error('Media download was incomplete.');
      return { bytes, url: current.href };
    }
    throw new Error('Too many CDN redirects.');
  } catch (error) {
    await fs.rm(destination, { force: true });
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}
function run(
  binary,
  args,
  {
    signal,
    input,
    timeoutMs = LIMITS.processMs,
    binaryOutput = false,
    maxOutput = 2e6,
    onProgress
  } = {}
) {
  return new Promise((resolve, reject) => {
    aborted(signal);
    const child = spawn(binary, args, {
      shell: false,
      windowsHide: true,
      stdio: [input ? 'pipe' : 'ignore', 'pipe', 'pipe']
    });
    let output = binaryOutput ? [] : '',
      outputBytes = 0,
      errors = '',
      settled = false;
    let progressBuffer = '',
      progress = {};
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      error ? reject(error) : resolve(binaryOutput ? Buffer.concat(output) : output);
    };
    const abort = () => {
      child.kill('SIGKILL');
      finish(Object.assign(new Error('Preparation cancelled.'), { name: 'AbortError' }));
    };
    const timer =
      timeoutMs > 0
        ? setTimeout(() => {
            child.kill('SIGKILL');
            finish(new Error('Media processing timed out.'));
          }, timeoutMs)
        : null;
    signal?.addEventListener('abort', abort, { once: true });
    child.stdout.on('data', (chunk) => {
      if (onProgress) {
        progressBuffer += chunk.toString();
        let end;
        while ((end = progressBuffer.indexOf('\n')) !== -1) {
          const line = progressBuffer.slice(0, end).trim();
          progressBuffer = progressBuffer.slice(end + 1);
          const split = line.indexOf('=');
          if (split < 0) continue;
          const key = line.slice(0, split),
            value = line.slice(split + 1);
          progress[key] = value;
          if (key === 'progress') {
            onProgress(progress);
            progress = {};
          }
        }
        if (progressBuffer.length > 65536) progressBuffer = '';
        return;
      }
      if (binaryOutput) output.push(chunk);
      else output += chunk;
      outputBytes += chunk.length;
      if (outputBytes > maxOutput) {
        child.kill('SIGKILL');
        finish(new Error('Media probe exceeded output limit.'));
      }
    });
    child.stderr.on('data', (chunk) => {
      errors = (errors + chunk).slice(-24000);
    });
    child.on('error', (e) =>
      finish(
        new Error(
          e.code === 'ENOENT'
            ? 'FFmpeg/FFprobe is unavailable. Install the packaged media tools or configure their paths.'
            : e.message
        )
      )
    );
    child.on('close', (code, signal) =>
      finish(
        code === 0
          ? null
          : Object.assign(
              new Error(
                `Media decoding failed (${code}). ${errors.replace(/https?:\/\/\S+/g, '[URL]').slice(-700)}`
              ),
              {
                code: 'MEDIA_PROCESS_FAILED',
                exitCode: code,
                signal,
                stderr: errors,
                tool: path.basename(binary)
              }
            )
      )
    );
    if (signal?.aborted) abort();
    if (input) {
      child.stdin.on('error', () => {});
      child.stdin.end(input);
    }
  });
}
function webpFrames(buffer) {
  if (
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WEBP' ||
    buffer.readUInt32LE(4) + 8 !== buffer.length
  )
    throw new Error('Invalid WebP container.');
  let width = 0,
    height = 0,
    duration = 0;
  const frames = [],
    metadata = [];
  let background = [0, 0, 0, 0];
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const type = buffer.toString('ascii', offset, offset + 4),
      size = buffer.readUInt32LE(offset + 4),
      start = offset + 8,
      end = start + size;
    if (end > buffer.length) throw new Error('Truncated WebP chunk.');
    if (type === 'VP8X' && size >= 10) {
      width = buffer.readUIntLE(start + 4, 3) + 1;
      height = buffer.readUIntLE(start + 7, 3) + 1;
    }
    if (type === 'ANIM' && size >= 6)
      background = [buffer[start + 2], buffer[start + 1], buffer[start], buffer[start + 3]];
    if (type === 'ANMF') {
      if (size < 24 || frames.length >= LIMITS.frames)
        throw new Error('Invalid or excessively long animated WebP.');
      const fw = buffer.readUIntLE(start + 6, 3) + 1,
        fh = buffer.readUIntLE(start + 9, 3) + 1;
      const x = buffer.readUIntLE(start, 3) * 2,
        y = buffer.readUIntLE(start + 3, 3) * 2;
      if (!width || !height || x + fw > width || y + fh > height)
        throw new Error('WebP frame lies outside its canvas.');
      const frameDuration = Math.max(10, buffer.readUIntLE(start + 12, 3)) / 1000;
      duration += frameDuration;
      metadata.push({
        x,
        y,
        width: fw,
        height: fh,
        duration: frameDuration,
        blend: !(buffer[start + 15] & 2),
        dispose: !!(buffer[start + 15] & 1)
      });
      let payload = buffer.subarray(start + 16, end);
      if (payload.toString('ascii', 0, 4) === 'ALPH') {
        // ALPH needs an extended still-image header outside its ANMF container.
        const extended = Buffer.alloc(18);
        extended.write('VP8X');
        extended.writeUInt32LE(10, 4);
        extended[8] = 0x10;
        extended.writeUIntLE(fw - 1, 12, 3);
        extended.writeUIntLE(fh - 1, 15, 3);
        payload = Buffer.concat([extended, payload]);
      }
      const header = Buffer.alloc(12);
      header.write('RIFF');
      header.writeUInt32LE(payload.length + 4, 4);
      header.write('WEBP', 8);
      frames.push(Buffer.concat([header, payload]));
    }
    offset = end + (size % 2);
  }
  return { width, height, duration, frames, metadata, background };
}
function demuxer(buffer) {
  if (buffer.length >= 6 && /^GIF8[79]a$/.test(buffer.toString('ascii', 0, 6))) return 'gif';
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  )
    return 'webp_pipe';
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return 'png_pipe';
  if (buffer.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255)
    return 'jpeg_pipe';
  if (buffer.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163]))) return 'matroska';
  throw new Error('Unsupported media signature. Expected GIF, WebP, WebM, PNG or JPEG.');
}
function binaryDefault(name) {
  const bundled = path.join(
    __dirname,
    '..',
    'binaries',
    process.platform === 'win32' ? name + '.exe' : name
  );
  if (existsSync(bundled)) return bundled;
  try {
    const value = require(name === 'ffmpeg' ? 'ffmpeg-static' : 'ffprobe-static');
    return typeof value === 'string' ? value : value.path;
  } catch {
    return name;
  }
}
async function hashFile(file, signal) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of createReadStream(file, { signal })) hash.update(chunk);
  return hash.digest('hex');
}
function createMedia({
  dataDir,
  ffmpegPath = binaryDefault('ffmpeg'),
  ffprobePath = binaryDefault('ffprobe'),
  downloadImpl = download
} = {}) {
  if (!dataDir) throw new Error('dataDir is required.');
  const directory = path.join(dataDir, 'media');
  async function ensureDirectory(create = true) {
    if (create) {
      await fs.mkdir(dataDir, { recursive: true });
      await fs.mkdir(directory).catch((e) => {
        if (e.code !== 'EEXIST') throw e;
      });
    }
    const stat = await fs.lstat(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Media directory is unsafe.');
  }
  async function safeFile(name, maxBytes = LIMITS.bytes) {
    if (!basename(name)) throw new Error('Unsafe media filename.');
    const target = path.join(directory, name),
      stat = await fs.lstat(target);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0 || stat.size > maxBytes)
      throw new Error('Invalid local media file.');
    return target;
  }
  async function inspect(file, { signal, timeoutMs = LIMITS.processMs } = {}) {
    aborted(signal);
    const handle = await fs.open(file, 'r');
    let head;
    try {
      const header = Buffer.alloc(12);
      const { bytesRead } = await handle.read(header, 0, 12, 0);
      head = header.subarray(0, bytesRead);
    } finally {
      await handle.close();
    }
    const inputFormat = demuxer(head);
    let result;
    if (head.toString('ascii', 0, 4) === 'RIFF' && head.toString('ascii', 8, 12) === 'WEBP') {
      const webp = webpFrames(await fs.readFile(file, { signal }));
      if (webp.frames.length) {
        if (webp.width * webp.height > LIMITS.pixels || webp.duration > LIMITS.duration)
          throw new Error('Media exceeds supported resolution or duration.');
        await run(
          ffmpegPath,
          [
            '-v',
            'error',
            '-xerror',
            '-threads',
            '2',
            '-f',
            'image2pipe',
            '-c:v',
            'webp',
            '-i',
            'pipe:0',
            '-an',
            '-f',
            'null',
            '-'
          ],
          { signal, input: Buffer.concat(webp.frames) }
        );
        result = { ...webp, frames: webp.frames.length, format: 'webp', codec: 'webp' };
      }
    }
    if (!result) {
      let probe;
      try {
        probe = JSON.parse(
          await run(
            ffprobePath,
            [
              '-v',
              'error',
              '-protocol_whitelist',
              'file,pipe',
              '-f',
              inputFormat,
              '-select_streams',
              'v:0',
              '-show_entries',
              'stream=codec_name,width,height,nb_read_frames,duration:format=format_name,duration',
              '-of',
              'json',
              file
            ],
            { signal, timeoutMs }
          )
        );
      } catch (e) {
        throw new Error(`Media validation failed: ${e.message}`, { cause: e });
      }
      const stream = probe.streams?.[0];
      if (!stream) throw new Error('No decodable visual stream.');
      const type = probe.format?.format_name || '';
      const format = type.includes('webm')
        ? 'webm'
        : type.includes('gif')
          ? 'gif'
          : type.includes('webp')
            ? 'webp'
            : type.includes('png') || stream.codec_name === 'png'
              ? 'png'
              : type.includes('jpeg') || stream.codec_name === 'mjpeg'
                ? 'jpg'
                : null;
      if (!format)
        throw new Error('Unsupported media container. Use GIF, WebP, WebM, PNG or JPEG.');
      result = {
        width: Number(stream.width),
        height: Number(stream.height),
        duration: Number(stream.duration || probe.format?.duration) || 0,
        frames: 1,
        format,
        codec: stream.codec_name
      };
      if (result.width * result.height > LIMITS.pixels || result.duration > LIMITS.duration)
        throw new Error('Media exceeds supported resolution or duration.');
      const frameProbe = JSON.parse(
        await run(
          ffprobePath,
          [
            '-v',
            'error',
            '-protocol_whitelist',
            'file,pipe',
            '-f',
            inputFormat,
            '-select_streams',
            'v:0',
            '-count_frames',
            '-show_entries',
            'stream=nb_read_frames',
            '-of',
            'json',
            file
          ],
          { signal, timeoutMs }
        )
      );
      result.frames = Number(frameProbe.streams?.[0]?.nb_read_frames) || 1;
      if (result.frames > LIMITS.frames) throw new Error('Media exceeds the frame limit.');
      await run(
        ffmpegPath,
        [
          '-v',
          'error',
          '-xerror',
          '-protocol_whitelist',
          'file,pipe',
          '-threads',
          '2',
          '-f',
          inputFormat,
          '-i',
          file,
          '-an',
          '-f',
          'null',
          '-'
        ],
        { signal, timeoutMs }
      );
    }
    if (
      !result.width ||
      !result.height ||
      result.width * result.height > LIMITS.pixels ||
      result.duration > LIMITS.duration
    )
      throw new Error('Media exceeds supported resolution or duration.');
    return { ...result, demuxer: inputFormat, animated: result.frames > 1 };
  }
  const previewWork = new Map(),
    previewLanes = [Promise.resolve(), Promise.resolve()];
  let nextPreviewLane = 0;
  async function preview(input, { signal, force = false } = {}) {
    const reference = input.file ? `local:${input.file}` : cdnURL(input.url).href;
    const token = crypto.createHash('sha256').update(reference).digest('hex').slice(0, 24);
    const filename = `preview-${token}.jpg`;
    if (previewWork.has(token)) return previewWork.get(token);
    const lane = nextPreviewLane++ % previewLanes.length;
    const operation = previewLanes[lane].then(async () => {
      aborted(signal);
      await ensureDirectory();
      const target = path.join(directory, filename);
      if (!force) {
        const cached = await fs.lstat(target).catch(() => null);
        if (cached?.isFile() && !cached.isSymbolicLink() && cached.size > 0)
          return { file: filename };
      }
      const id = crypto.randomUUID(),
        partial = path.join(directory, `${id}.partial`),
        temp = path.join(directory, `${id}.jpg`);
      try {
        const source = input.file ? await safeFile(input.file, Infinity) : partial;
        if (!input.file) await downloadImpl(input.url, partial, { signal, maxBytes: LIMITS.bytes });
        const handle = await fs.open(source, 'r');
        let signature;
        try {
          const buffer = Buffer.alloc(12);
          const read = await handle.read(buffer, 0, 12, 0);
          signature = buffer.subarray(0, read.bytesRead);
        } finally {
          await handle.close();
        }
        const format = demuxer(signature);
        const probe = JSON.parse(
          await run(
            ffprobePath,
            [
              '-v',
              'error',
              '-protocol_whitelist',
              'file,pipe',
              '-f',
              format,
              '-select_streams',
              'v:0',
              '-show_entries',
              'stream=width,height',
              '-of',
              'json',
              source
            ],
            { signal, timeoutMs: 30000 }
          )
        );
        const size = probe.streams?.[0];
        if (
          format !== 'webp_pipe' &&
          (!size?.width || !size?.height || size.width * size.height > LIMITS.pixels)
        )
          throw new Error('Preview resolution exceeds supported limits.');
        const args = [
          '-v',
          'error',
          '-xerror',
          '-threads',
          '2',
          '-protocol_whitelist',
          'file,pipe'
        ];
        let frameInput;
        if (format === 'webp_pipe') {
          const decoded = webpFrames(await fs.readFile(source, { signal }));
          if (decoded.frames.length) {
            const rect = decoded.metadata[0],
              { compose, clear, png } = require('./webp-compose.cjs');
            if (decoded.width * decoded.height > LIMITS.pixels)
              throw new Error('Preview resolution exceeds supported limits.');
            const rgba = await run(
              ffmpegPath,
              [
                '-v',
                'error',
                '-threads',
                '2',
                '-f',
                'image2pipe',
                '-c:v',
                'webp',
                '-i',
                'pipe:0',
                '-frames:v',
                '1',
                '-pix_fmt',
                'rgba',
                '-f',
                'rawvideo',
                'pipe:1'
              ],
              {
                signal,
                input: decoded.frames[0],
                binaryOutput: true,
                maxOutput: rect.width * rect.height * 4
              }
            );
            const canvas = Buffer.alloc(decoded.width * decoded.height * 4);
            clear(
              canvas,
              decoded.width,
              { x: 0, y: 0, width: decoded.width, height: decoded.height },
              decoded.background
            );
            compose(canvas, decoded.width, rgba, rect);
            frameInput = png(canvas, decoded.width, decoded.height);
            args.push('-f', 'image2pipe', '-c:v', 'png', '-i', 'pipe:0');
          } else args.push('-f', format, '-i', source);
        } else args.push('-f', format, '-i', source);
        args.push(
          '-frames:v',
          '1',
          '-vf',
          'scale=640:480:force_original_aspect_ratio=decrease',
          '-q:v',
          '3',
          '-y',
          temp
        );
        await run(ffmpegPath, args, { signal, input: frameInput, timeoutMs: 30000 });
        const info = await inspect(temp, { signal });
        if (info.animated || info.width > 640 || info.height > 480)
          throw new Error('Invalid preview image.');
        aborted(signal);
        await fs.rename(temp, target);
        return { file: filename };
      } finally {
        await fs.rm(partial, { force: true });
        await fs.rm(temp, { force: true });
      }
    });
    previewWork.set(token, operation);
    previewLanes[lane] = operation.catch(() => {});
    try {
      return await operation;
    } finally {
      previewWork.delete(token);
    }
  }
  return {
    preview,
    async waitForPreviews() {
      await Promise.allSettled(previewLanes);
    },
    async prepare(
      asset,
      { signal, onProgress, maxBytes = LIMITS.bytes, requireStatic = false } = {}
    ) {
      if (!Number.isFinite(maxBytes) || maxBytes < 1024)
        throw new Error('Not enough storage space for media.');
      cdnURL(asset.url);
      await ensureDirectory();
      const token = crypto.randomUUID(),
        partial = path.join(directory, `${token}.partial`);
      let work = [];
      try {
        onProgress?.({ stage: 'downloading', bytes: 0 });
        await downloadImpl(asset.url, partial, {
          signal,
          onProgress,
          maxBytes: Math.min(maxBytes, LIMITS.bytes)
        });
        onProgress?.({ stage: 'validating' });
        const info = await inspect(partial, { signal });
        if (requireStatic && info.format === 'png') {
          const png = await fs.readFile(partial, { signal });
          for (let offset = 8; offset + 12 <= png.length;) {
            const size = png.readUInt32BE(offset);
            if (png.toString('ascii', offset + 4, offset + 8) === 'acTL')
              throw new Error('The cover must be a still image.');
            offset += size + 12;
          }
        }
        if (requireStatic && info.animated) throw new Error('The cover must be a still image.');
        if (asset.animated === true && !info.animated)
          throw new Error('The selected artwork is static, not an animation.');
        const digest = crypto
          .createHash('sha256')
          .update(await fs.readFile(partial))
          .digest('hex');
        const prefix = digest.slice(0, 24),
          sourceFile = `${prefix}.source.${info.format}`,
          source = path.join(directory, sourceFile);
        let file = sourceFile,
          outputInfo = info,
          optimizedTemp = null;
        // Native image animation is retained. Existing VP8/VP9 WebM requires no generation loss.
        if (info.format === 'webm' && !['vp8', 'vp9'].includes(info.codec)) {
          onProgress?.({ stage: 'optimizing' });
          file = `${prefix}.vp9.webm`;
          const temp = path.join(directory, `${token}.webm`);
          work.push(temp);
          await run(
            ffmpegPath,
            [
              '-v',
              'error',
              '-xerror',
              '-protocol_whitelist',
              'file,pipe',
              '-threads',
              '2',
              '-f',
              info.demuxer,
              '-i',
              partial,
              '-an',
              '-c:v',
              'libvpx-vp9',
              '-threads',
              '2',
              '-crf',
              '32',
              '-b:v',
              '0',
              '-pix_fmt',
              'yuv420p',
              '-deadline',
              'good',
              '-cpu-used',
              '4',
              '-fs',
              String(Math.max(1024, maxBytes - (await fs.stat(partial)).size)),
              '-y',
              temp
            ],
            { signal }
          );
          outputInfo = await inspect(temp, { signal });
          if (info.duration && Math.abs(outputInfo.duration - info.duration) > 0.25)
            throw new Error('Optimized media was incomplete or exceeded the storage budget.');
          optimizedTemp = temp;
        }
        const thumbnail = `${prefix}.thumb.jpg`,
          thumbTemp = path.join(directory, `${token}.jpg`);
        work.push(thumbTemp);
        const thumbArgs = ['-v', 'error', '-threads', '2'];
        let input;
        if (info.format === 'webp' && info.animated) {
          const frames = webpFrames(await fs.readFile(partial));
          input = frames.frames[0];
          thumbArgs.push('-f', 'image2pipe', '-c:v', 'webp', '-i', 'pipe:0');
        } else
          thumbArgs.push('-protocol_whitelist', 'file,pipe', '-f', info.demuxer, '-i', partial);
        thumbArgs.push(
          '-frames:v',
          '1',
          '-vf',
          'scale=640:360:force_original_aspect_ratio=decrease',
          '-q:v',
          '3',
          '-y',
          thumbTemp
        );
        await run(ffmpegPath, thumbArgs, { signal, input });
        aborted(signal);
        const committedBytes =
          (await fs.stat(partial)).size +
          (await fs.stat(thumbTemp)).size +
          (file !== sourceFile ? (await fs.stat(optimizedTemp)).size : 0);
        if (committedBytes > maxBytes)
          throw new Error('Prepared media exceeds the remaining storage budget.');
        if (optimizedTemp) await fs.rename(optimizedTemp, path.join(directory, file));
        await fs.rename(thumbTemp, path.join(directory, thumbnail));
        await fs.rename(partial, source);
        onProgress?.({ stage: 'saving' });
        return {
          file,
          sourceFile,
          thumbnail,
          width: outputInfo.width,
          height: outputInfo.height,
          duration: outputInfo.duration,
          format: outputInfo.format,
          animated: outputInfo.animated,
          author: asset.author || { name: 'Unknown' },
          sourceUrl: asset.url,
          sha256: digest,
          pipelineVersion: 1
        };
      } finally {
        await Promise.allSettled([partial, ...work].map((f) => fs.rm(f, { force: true })));
      }
    },
    async smooth(
      media,
      {
        signal,
        maxBytes = Infinity,
        processMs = 0,
        onProgress,
        settings = { smoothingMode: 'quality' }
      } = {}
    ) {
      aborted(signal);
      const config = smoothingConfig(settings),
        started = Date.now();
      const report = (stage, data = {}) =>
        onProgress?.({ stage, elapsed: (Date.now() - started) / 1000, ...data });
      report('smoothing-inspect', { progress: null });
      if (!(maxBytes === Infinity || Number.isFinite(maxBytes)) || maxBytes < 1024)
        throw new Error('Not enough storage space for interpolation.');
      await ensureDirectory(false);
      if (!(await this.validate(media, { signal })))
        throw new Error('Repair the original media before interpolation.');
      const source = await safeFile(media.sourceFile || media.file);
      const info = await inspect(source, { signal });
      if (!info.animated || !info.duration)
        throw new Error('Interpolation requires an animation with a known duration.');
      // Preserve already fluid media rather than reducing its original frame rate.
      if (
        info.frames / info.duration >= config.fps - 0.5 &&
        (info.format !== 'webm' || ['vp8', 'vp9'].includes(info.codec))
      )
        return { ...media, smoothing: 'native-fluid', smoothingConfig: config };
      const token = crypto.randomUUID(),
        temp = path.join(directory, `${token}.smooth.webm`),
        framesDir = path.join(directory, `${token}.frames`),
        deadline = processMs > 0 ? Date.now() + processMs : Infinity;
      try {
        let inputArgs = ['-f', info.demuxer, '-i', source];
        if (info.format === 'webp') {
          const buffer = await fs.readFile(source, { signal }),
            decoded = webpFrames(buffer);
          const { compose, clear, png } = require('./webp-compose.cjs');
          const canvas = Buffer.alloc(decoded.width * decoded.height * 4);
          clear(
            canvas,
            decoded.width,
            { x: 0, y: 0, width: decoded.width, height: decoded.height },
            decoded.background
          );
          await fs.mkdir(framesDir);
          await fs.writeFile(
            path.join(framesDir, '.screensaver-smoothing-work'),
            'steam-animated-screensaver-v1'
          );
          const list = ['ffconcat version 1.0'];
          report('smoothing-decode', {
            progress: 0,
            frames: 0,
            totalFrames: decoded.frames.length
          });
          for (let i = 0; i < decoded.frames.length; i++) {
            aborted(signal);
            if (i && decoded.metadata[i - 1].dispose)
              clear(canvas, decoded.width, decoded.metadata[i - 1], decoded.background);
            const rect = decoded.metadata[i];
            const rgba = await run(
              ffmpegPath,
              [
                '-v',
                'error',
                '-threads',
                '2',
                '-f',
                'image2pipe',
                '-c:v',
                'webp',
                '-i',
                'pipe:0',
                '-frames:v',
                '1',
                '-f',
                'rawvideo',
                '-pix_fmt',
                'rgba',
                'pipe:1'
              ],
              {
                signal,
                input: decoded.frames[i],
                binaryOutput: true,
                maxOutput: rect.width * rect.height * 4,
                timeoutMs: Number.isFinite(deadline) ? Math.max(1, deadline - Date.now()) : 0
              }
            );
            compose(canvas, decoded.width, rgba, rect);
            const image = png(canvas, decoded.width, decoded.height);

            const disk = await fs.statfs(dataDir);
            if (Number(disk.bavail) * Number(disk.bsize) - image.length < 64 * 1024 * 1024)
              throw new Error('Not enough disk space for interpolation frames.');
            const name = `frame-${i}.png`;
            await fs.writeFile(path.join(framesDir, name), image);
            report('smoothing-decode', {
              progress: (i + 1) / decoded.frames.length,
              frames: i + 1,
              totalFrames: decoded.frames.length
            });
            list.push(`file ${name}`, 'option framerate 1000', `duration ${rect.duration}`);
            if (Date.now() >= deadline)
              throw new Error('Interpolation timed out. The original is kept.');
          }
          list.push(`file frame-${decoded.frames.length - 1}.png`, 'option framerate 1000');
          const manifest = path.join(framesDir, 'frames.txt');
          await fs.writeFile(manifest, list.join('\n') + '\n');
          inputArgs = ['-f', 'concat', '-safe', '0', '-i', manifest];
        }
        const disk = await fs.statfs(dataDir);
        const budget = Math.min(
          maxBytes,
          Number(disk.bavail) * Number(disk.bsize) - 64 * 1024 * 1024
        );
        if (budget < 1024) throw new Error('Not enough storage space for interpolation.');
        report('smoothing', {
          progress: 0,
          seconds: 0,
          duration: info.duration,
          targetFps: config.fps,
          mode: config.mode,
          codec: config.codec
        });
        const encodeStarted = Date.now();
        await run(
          ffmpegPath,
          [
            '-v',
            'error',
            '-xerror',
            '-nostats',
            '-progress',
            'pipe:1',
            '-stats_period',
            '0.5',
            '-protocol_whitelist',
            'file,pipe',
            '-threads',
            '2',
            ...inputArgs,
            '-an',
            '-filter_threads',
            '2',
            '-vf',
            smoothingFilter(config),
            '-t',
            String(info.duration),
            '-c:v',
            config.codec === 'vp9' ? 'libvpx-vp9' : 'libvpx',
            '-threads',
            '2',
            '-crf',
            config.codec === 'vp9' ? '28' : '10',
            '-b:v',
            config.codec === 'vp9' ? '0' : '4000000',
            '-deadline',
            config.codec === 'vp9' ? 'good' : 'realtime',
            '-cpu-used',
            config.codec === 'vp9' ? '4' : '8',
            '-fs',
            String(Math.floor(budget)),
            '-y',
            temp
          ],
          {
            signal,
            timeoutMs: Number.isFinite(deadline) ? Math.max(1, deadline - Date.now()) : 0,
            onProgress: (p) => {
              const seconds = Math.max(
                0,
                Math.min(info.duration, Number(p.out_time_us) / 1e6 || 0)
              );
              const frame = Math.max(0, Number(p.frame) || 0);
              const progress = Math.min(
                1,
                Math.max(seconds / info.duration, frame / Math.ceil(info.duration * config.fps))
              );
              const elapsed = (Date.now() - encodeStarted) / 1000;
              report('smoothing', {
                progress,
                seconds,
                duration: info.duration,
                frames: frame,
                totalFrames: Math.ceil(info.duration * config.fps),
                targetFps: config.fps,
                mode: config.mode,
                codec: config.codec,
                speed: Number.parseFloat(p.speed) || null,
                eta:
                  progress > 0 && elapsed > 1
                    ? Math.max(0, (elapsed * (1 - progress)) / progress)
                    : null
              });
            }
          }
        );
        report('smoothing-verify', { progress: null });
        const result = await inspect(temp, { signal, timeoutMs: processMs });
        if (
          !result.animated ||
          Math.abs(result.duration - info.duration) > 0.1 ||
          Math.abs(result.frames / result.duration - config.fps) > 1 ||
          (await fs.stat(temp)).size > budget
        )
          throw new Error(
            'Interpolation was incomplete or exceeded its storage budget. The original is kept.'
          );
        const digest = await hashFile(source, signal);
        const file = `${digest.slice(0, 24)}.smooth${config.fps}-${config.mode}-v2.webm`;
        aborted(signal);
        report('smoothing-save', { progress: null });
        await fs.rename(temp, path.join(directory, file));
        report('smoothing-done', { progress: 1 });
        return {
          ...media,
          file,
          width: result.width,
          height: result.height,
          duration: result.duration,
          format: 'webm',
          animated: true,
          sha256: digest,
          smoothing: `interpolate-${config.fps}-v2`,
          smoothingConfig: config
        };
      } finally {
        await fs.rm(temp, { force: true });
        await fs.rm(framesDir, { recursive: true, force: true });
      }
    },
    async validate(media, { signal } = {}) {
      try {
        aborted(signal);
        await ensureDirectory(false);
        const file = await safeFile(media.file, media.smoothing ? Infinity : LIMITS.bytes);
        const thumb = await safeFile(media.thumbnail);
        if (media.sourceFile) {
          const source = await safeFile(media.sourceFile);
          if (media.sha256 && (await hashFile(source, signal)) !== media.sha256) return false;
        }
        await inspect(thumb, { signal });
        const info = await inspect(file, {
          signal,
          timeoutMs: media.smoothing ? 0 : LIMITS.processMs
        });
        return (
          info.width === media.width &&
          info.height === media.height &&
          info.animated === media.animated
        );
      } catch (error) {
        if (signal?.aborted || error.name === 'AbortError')
          throw Object.assign(new Error('Preparation cancelled.'), { name: 'AbortError' });
        return false;
      }
    }
  };
}
module.exports = { createMedia, cdnURL, download, webpFrames, demuxer, LIMITS };
