'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const https = require('node:https');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { pipeline } = require('node:stream/promises');
const { Transform } = require('node:stream');
const { createWriteStream, existsSync } = require('node:fs');
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
              'User-Agent': 'SteamOS-Animated-Screensaver/0.1',
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
function run(binary, args, { signal, input, timeoutMs = LIMITS.processMs } = {}) {
  return new Promise((resolve, reject) => {
    aborted(signal);
    const child = spawn(binary, args, {
      shell: false,
      windowsHide: true,
      stdio: [input ? 'pipe' : 'ignore', 'pipe', 'pipe']
    });
    let output = '',
      errors = '',
      settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      error ? reject(error) : resolve(output);
    };
    const abort = () => {
      child.kill('SIGKILL');
      finish(Object.assign(new Error('Preparation cancelled.'), { name: 'AbortError' }));
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(new Error('Media processing timed out.'));
    }, timeoutMs);
    signal?.addEventListener('abort', abort, { once: true });
    child.stdout.on('data', (chunk) => {
      output += chunk;
      if (output.length > 2e6) {
        child.kill('SIGKILL');
        finish(new Error('Media probe exceeded output limit.'));
      }
    });
    child.stderr.on('data', (chunk) => {
      errors = (errors + chunk).slice(-3000);
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
    child.on('close', (code) =>
      finish(
        code === 0
          ? null
          : new Error(
              `Media decoding failed (${code}). ${errors.replace(/https?:\/\/\S+/g, '[URL]').slice(-700)}`
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
  const frames = [];
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
    if (type === 'ANMF') {
      if (size < 24 || frames.length >= LIMITS.frames)
        throw new Error('Invalid or excessively long animated WebP.');
      const fw = buffer.readUIntLE(start + 6, 3) + 1,
        fh = buffer.readUIntLE(start + 9, 3) + 1;
      const x = buffer.readUIntLE(start, 3) * 2,
        y = buffer.readUIntLE(start + 3, 3) * 2;
      if (!width || !height || x + fw > width || y + fh > height)
        throw new Error('WebP frame lies outside its canvas.');
      duration += Math.max(10, buffer.readUIntLE(start + 12, 3)) / 1000;
      const payload = buffer.subarray(start + 16, end);
      const header = Buffer.alloc(12);
      header.write('RIFF');
      header.writeUInt32LE(payload.length + 4, 4);
      header.write('WEBP', 8);
      frames.push(Buffer.concat([header, payload]));
    }
    offset = end + (size % 2);
  }
  return { width, height, duration, frames };
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
  const bundled = path.join(__dirname, '..', 'binaries', name);
  if (existsSync(bundled)) return bundled;
  try {
    const value = require(name === 'ffmpeg' ? 'ffmpeg-static' : 'ffprobe-static');
    return typeof value === 'string' ? value : value.path;
  } catch {
    return name;
  }
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
  async function safeFile(name) {
    if (!basename(name)) throw new Error('Unsafe media filename.');
    const target = path.join(directory, name),
      stat = await fs.lstat(target);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0 || stat.size > LIMITS.bytes)
      throw new Error('Invalid local media file.');
    return target;
  }
  async function inspect(file, { signal } = {}) {
    aborted(signal);
    const head = await fs.readFile(file, { signal }),
      inputFormat = demuxer(head);
    let result;
    if (head.toString('ascii', 0, 4) === 'RIFF' && head.toString('ascii', 8, 12) === 'WEBP') {
      const webp = webpFrames(head);
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
            { signal }
          )
        );
      } catch (e) {
        throw new Error(`Media validation failed: ${e.message}`);
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
          { signal }
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
        { signal }
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
  return {
    async prepare(asset, { signal, onProgress, maxBytes = LIMITS.bytes } = {}) {
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
    async validate(media, { signal } = {}) {
      try {
        aborted(signal);
        await ensureDirectory(false);
        const file = await safeFile(media.file);
        const thumb = await safeFile(media.thumbnail);
        if (media.sourceFile) {
          const source = await safeFile(media.sourceFile);
          if (
            media.sha256 &&
            crypto
              .createHash('sha256')
              .update(await fs.readFile(source, { signal }))
              .digest('hex') !== media.sha256
          )
            return false;
        }
        await inspect(thumb, { signal });
        const info = await inspect(file, { signal });
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
