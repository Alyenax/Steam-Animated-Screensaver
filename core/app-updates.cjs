'use strict';
const fs = require('node:fs/promises');
const { createReadStream } = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { atomicWrite } = require('./store.cjs');
const {
  API,
  REPO,
  TARGETS,
  UpdateError,
  compareVersions,
  releaseAsset,
  readManifest
} = require('./update-format.cjs');
const { noLinks, space } = require('./update-archive.cjs');
const DAY = 86400000;
const HOSTS = new Set([
  'api.github.com',
  'github.com',
  'objects.githubusercontent.com',
  'release-assets.githubusercontent.com',
  'github-releases.githubusercontent.com'
]);
async function hashFile(file, progress = () => {}, signal) {
  const h = crypto.createHash('sha256');
  let bytes = 0;
  for await (const chunk of createReadStream(file)) {
    signal?.throwIfAborted();
    h.update(chunk);
    bytes += chunk.length;
    progress(bytes);
  }
  return h.digest('hex');
}
function createUpdater({
  dataDir,
  version,
  target = `${process.platform}-${process.arch}`,
  fetchImpl = fetch,
  publicKey,
  enabled = true,
  installer,
  diagnostics,
  now = Date.now
} = {}) {
  const root = path.join(dataDir, 'updates'),
    stateFile = path.join(root, 'state.json');
  let state = {
    currentVersion: version,
    target,
    phase: 'idle',
    autoCheck: true,
    availableVersion: '',
    releaseNotes: '',
    releaseUrl: '',
    lastChecked: null,
    nextCheck: 0,
    progress: null,
    bytes: 0,
    total: 0,
    error: '',
    errorCode: '',
    result: ''
  };
  const operations = new Set();
  const track =
    (fn) =>
    (...args) => {
      const p = fn(...args);
      operations.add(p);
      p.then(
        () => operations.delete(p),
        () => operations.delete(p)
      );
      return p;
    };
  let storageReady = false;
  let candidate = null,
    timer,
    busy = false,
    task = null,
    controller,
    closed = false,
    writes = Promise.resolve();
  function status() {
    return {
      ...state,
      canCheck: !!TARGETS[target] && storageReady,
      canOpenRelease: true,
      canInstall: !!installer?.available && storageReady,
      installReason: !storageReady ? 'permissions' : installer?.reason || 'development'
    };
  }
  function save() {
    const value = JSON.stringify({ schema: 1, state, candidate }, null, 2) + '\n';
    writes = writes.catch(() => {}).then(() => atomicWrite(stateFile, value));
    writes.catch((e) => {
      diagnostics?.record('error', 'updater.state_write_failed', { code: e.code });
    });
    return writes;
  }
  function set(values, persist = true) {
    const previous = state.phase;
    state = { ...state, ...values };
    if (previous !== state.phase)
      diagnostics?.record('info', 'updater.phase', {
        phase: state.phase,
        version: state.availableVersion
      });
    if (persist) void save();
  }
  async function request(url, { signal, etag, limit = 65536 } = {}) {
    let current = url;
    for (let n = 0; n < 6; n++) {
      const u = new URL(current);
      if (
        u.protocol !== 'https:' ||
        !HOSTS.has(u.hostname) ||
        u.username ||
        u.password ||
        u.port ||
        u.hash
      )
        throw new UpdateError('url', 'Untrusted update URL.');
      const r = await fetchImpl(current, {
        redirect: 'manual',
        signal,
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': `Steam-Animated-Screensaver/${version}`,
          ...(etag ? { 'If-None-Match': etag } : {})
        }
      });
      if ([301, 302, 303, 307, 308].includes(r.status)) {
        const location = r.headers.get('location');
        await r.body?.cancel();
        if (!location) throw new UpdateError('url', 'Missing update redirect.');
        current = new URL(location, current).href;
        continue;
      }
      if (r.status === 304) return { notModified: true };
      if (!r.ok) {
        await r.body?.cancel();
        const rate =
          r.status === 429 || (r.status === 403 && r.headers.get('x-ratelimit-remaining') === '0');
        const e = new UpdateError(
          rate ? 'rate' : 'network',
          rate
            ? 'GitHub request limit reached. Please try again later.'
            : `GitHub update request failed (${r.status}).`
        );
        if (rate) {
          const retry = Number(r.headers.get('retry-after'));
          const reset = Number(r.headers.get('x-ratelimit-reset')) * 1000;
          e.retryAt = Math.max(
            now() + 3600000,
            reset || 0,
            Number.isFinite(retry) ? now() + retry * 1000 : 0
          );
        }
        throw e;
      }
      const length = Number(r.headers.get('content-length'));
      if (length > limit) {
        await r.body?.cancel();
        throw new UpdateError('size', 'The update response exceeds its size limit.');
      }
      return { response: r };
    }
    throw new UpdateError('url', 'Too many update redirects.');
  }
  async function bytes(url, options) {
    const r = await request(url, options);
    if (r.notModified) return r;
    const chunks = [];
    let size = 0;
    for await (const chunk of r.response.body) {
      size += chunk.length;
      if (size > (options?.limit || 65536))
        throw new UpdateError('size', 'Update metadata is too large.');
      chunks.push(Buffer.from(chunk));
    }
    return {
      bytes: Buffer.concat(chunks),
      etag: r.response.headers.get('etag')?.slice(0, 256) || ''
    };
  }
  async function init() {
    try {
      await noLinks(root);
      await fs.mkdir(root, { recursive: true, mode: 0o700 });
      await fs.access(root, require('node:fs').constants.W_OK);
      storageReady = true;
    } catch (e) {
      state.phase = 'unavailable';
      state.error =
        'The update cache is unsafe or not writable. Use the GitHub release for manual installation.';
      state.errorCode = 'storage';
      diagnostics?.record('warn', 'updater.storage_unavailable', { code: e.code || 'path' });
      return status();
    }
    try {
      const s = await fs.lstat(stateFile);
      if (!s.isFile() || s.isSymbolicLink() || s.size > 256000)
        throw new Error('Invalid update state');
      const saved = JSON.parse(await fs.readFile(stateFile, 'utf8'));
      if (saved.schema === 1 && typeof saved.state?.autoCheck === 'boolean') {
        state.autoCheck = saved.state.autoCheck;
        state.lastChecked = Number(saved.state.lastChecked) || null;
        state.nextCheck = Math.min(now() + DAY, Number(saved.state.nextCheck) || 0);
        // Cached descriptors are never trusted as executable content. Revalidate at every launch.
        if (saved.candidate && compareVersions(saved.candidate.version, version) > 0) {
          const m = readManifest(Buffer.from(saved.candidate.manifest, 'base64'), {
            target,
            version: saved.candidate.version,
            publicKey
          });
          const a = m.assets.find((a) => a.target === target);
          const asset = releaseAsset(saved.candidate.release, a.name);
          if (asset.size !== a.size || (asset.digest && asset.digest !== `sha256:${a.sha256}`))
            throw new Error('Invalid cached asset');
          candidate = { ...saved.candidate, descriptor: a, asset };
          state.availableVersion = m.version;
          state.releaseUrl = `https://github.com/${REPO}/releases/tag/v${m.version}`;
          state.releaseNotes = String(saved.candidate.release.body || '').slice(0, 12000);
          state.phase = 'available';
          if (
            candidate.download &&
            path.dirname(candidate.download) === root &&
            path.basename(candidate.download).startsWith('download-')
          ) {
            if (
              (await fs.lstat(candidate.download).catch(() => null))?.isFile() &&
              (await hashFile(candidate.download)) === a.sha256
            )
              state.phase = 'ready';
            else delete candidate.download;
          } else delete candidate.download;
        }
      }
    } catch (e) {
      if (e.code !== 'ENOENT')
        diagnostics?.record('warn', 'updater.cache_ignored', { code: e.code || 'invalid' });
      candidate = null;
      state.phase = 'idle';
      state.availableVersion = '';
    }
    // Keep only the selected verified download. Never recurse into user media or transaction backups.
    for (const name of await fs.readdir(root)) {
      if (!/^download-[a-f0-9-]+(?:\.part)?$/.test(name)) continue;
      const file = path.join(root, name),
        st = await fs.lstat(file);
      if (st.isFile() && file !== candidate?.download) await fs.rm(file);
    }
    await installer?.recover?.(set);
    if (enabled) {
      timer = setInterval(() => {
        if (state.autoCheck && now() >= state.nextCheck) void trackedCheck(false);
      }, 60000);
      timer.unref?.();
      const initial = setTimeout(() => {
        if (!closed && state.autoCheck && now() >= state.nextCheck) void trackedCheck(false);
      }, 20000);
      initial.unref?.();
    }
    return status();
  }
  function fail(e) {
    const cancelled = controller?.signal.aborted;
    set({
      phase: cancelled ? (candidate ? 'available' : 'idle') : 'error',
      progress: null,
      error: cancelled ? '' : String(e.message || 'Update failed.').slice(0, 220),
      errorCode: cancelled ? '' : e.code || 'update',
      nextCheck: e.retryAt || now() + 900000
    });
    if (!cancelled)
      diagnostics?.record('error', 'updater.operation_failed', { code: e.code || 'update' });
  }
  async function check(force = true) {
    if (busy || task || closed || !TARGETS[target] || !storageReady || state.phase === 'ready')
      return status();
    if (!force && now() < state.nextCheck) return status();
    if (force && state.errorCode === 'rate' && now() < state.nextCheck) return status();
    busy = true;
    controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]);
    set({ phase: 'checking', error: '', errorCode: '', progress: null });
    try {
      const response = await bytes(API, {
        signal,
        limit: 512000,
        etag: !force ? candidate?.etag : ''
      });
      if (response.notModified) {
        set({
          phase: candidate ? 'available' : 'up_to_date',
          lastChecked: now(),
          nextCheck: now() + DAY
        });
        return status();
      }
      const release = JSON.parse(response.bytes);
      if (
        release.draft ||
        release.prerelease ||
        typeof release.tag_name !== 'string' ||
        !release.tag_name.startsWith('v')
      )
        throw new UpdateError('version', 'GitHub did not return a stable published release.');
      const remoteVersion = release.tag_name.slice(1);
      if (compareVersions(remoteVersion, version) <= 0) {
        candidate = null;
        set({
          phase: 'up_to_date',
          availableVersion: '',
          releaseNotes: '',
          releaseUrl: '',
          lastChecked: now(),
          nextCheck: now() + DAY
        });
        return status();
      }
      const manifestAsset = releaseAsset(release, 'update.json');
      const manifestBytes = (await bytes(manifestAsset.url, { signal })).bytes;
      const manifest = readManifest(manifestBytes, { publicKey, target, version: remoteVersion });
      const descriptor = manifest.assets.find((a) => a.target === target),
        asset = releaseAsset(release, descriptor.name);
      if (
        asset.size !== descriptor.size ||
        (asset.digest && asset.digest !== `sha256:${descriptor.sha256}`)
      )
        throw new UpdateError('checksum', 'GitHub and the signed update manifest disagree.');
      candidate = {
        version: remoteVersion,
        descriptor,
        asset,
        manifest: manifestBytes.toString('base64'),
        etag: response.etag,
        release: {
          tag_name: release.tag_name,
          body: String(release.body || '').slice(0, 12000),
          assets: release.assets.filter(
            (a) => a.name === descriptor.name || a.name === 'update.json'
          )
        }
      };
      set({
        phase: 'available',
        availableVersion: remoteVersion,
        releaseNotes: candidate.release.body,
        releaseUrl: `https://github.com/${REPO}/releases/tag/v${remoteVersion}`,
        lastChecked: now(),
        nextCheck: now() + DAY,
        result: ''
      });
    } catch (e) {
      fail(e);
    } finally {
      busy = false;
      controller = null;
      await writes;
    }
    return status();
  }
  function download() {
    if (task || busy || closed) return status();
    if (!candidate || !['available', 'error'].includes(state.phase))
      throw new UpdateError('state', 'Check for an available update first.');
    const selected = candidate;
    controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(600000)]);
    set({
      phase: 'downloading',
      bytes: 0,
      total: selected.asset.size,
      progress: 0,
      error: '',
      errorCode: ''
    });
    task = (async () => {
      const file = path.join(root, `download-${crypto.randomUUID()}`),
        partial = file + '.part';
      try {
        await noLinks(root);
        await space(root, selected.descriptor.size);
        const { response } = await request(selected.asset.url, {
          signal,
          limit: selected.asset.size
        });
        let count = 0;
        const h = crypto.createHash('sha256'),
          output = await fs.open(partial, 'wx', 0o600);
        try {
          for await (const block of response.body) {
            signal.throwIfAborted();
            count += block.length;
            if (count > selected.asset.size)
              throw new UpdateError('size', 'The update exceeds its signed size.');
            h.update(block);
            await output.writeFile(block);
            set({ bytes: count, progress: Math.floor((count / selected.asset.size) * 100) }, false);
          }
          await output.sync();
        } finally {
          await output.close();
        }
        set({ phase: 'verifying', progress: null });
        if (count !== selected.asset.size || h.digest('hex') !== selected.descriptor.sha256)
          throw new UpdateError(
            'checksum',
            'The downloaded update is incomplete or its checksum is incorrect.'
          );
        await fs.rename(partial, file);
        selected.download = file;
        set({ phase: 'ready', progress: 100 });
      } catch (e) {
        await fs.rm(partial, { force: true });
        fail(e);
      } finally {
        controller = null;
        task = null;
        await writes;
      }
    })();
    task.catch((e) => diagnostics?.record('error', 'updater.download_failed', { code: e.code }));
    return status();
  }
  async function install(confirm) {
    if (confirm !== true)
      throw new UpdateError('confirmation', 'Confirm restart and installation first.');
    if (busy || task || state.phase !== 'ready' || !candidate?.download)
      throw new UpdateError('state', 'Download and verify the update first.');
    if (!installer?.available)
      throw new UpdateError(
        'installation',
        'This application cannot be replaced here. Use the release download to install it in a writable folder.'
      );
    busy = true;
    controller = new AbortController();
    set({ phase: 'verifying', progress: 0, error: '', errorCode: '' });
    try {
      readManifest(Buffer.from(candidate.manifest, 'base64'), {
        publicKey,
        target,
        version: candidate.version
      });
      const st = await fs.lstat(candidate.download);
      if (
        !st.isFile() ||
        st.isSymbolicLink() ||
        st.size !== candidate.descriptor.size ||
        (await hashFile(
          candidate.download,
          (n) => set({ progress: Math.floor((n / st.size) * 100) }, false),
          controller.signal
        )) !== candidate.descriptor.sha256
      )
        throw new UpdateError('checksum', 'The cached update has changed. Download it again.');
      set({ phase: 'extracting', progress: null });
      await installer.install(candidate, {
        signal: controller.signal,
        progress: (n, total) =>
          set({ progress: Math.min(100, Math.floor((n / total) * 100)) }, false),
        set
      });
    } catch (e) {
      fail(e);
    } finally {
      busy = false;
      controller = null;
      await writes;
    }
    return status();
  }
  async function cancel() {
    if (state.phase === 'installing')
      throw new UpdateError('state', 'Application replacement has already started.');
    controller?.abort(new Error('Update cancelled.'));
    if (task) await task;
    return status();
  }
  async function preferences(payload) {
    if (!storageReady) throw new UpdateError('storage', 'The update cache is unavailable.');
    if (typeof payload.autoCheck !== 'boolean')
      throw new UpdateError('preferences', 'Invalid update preference.');
    set({ autoCheck: payload.autoCheck });
    await writes;
    return status();
  }
  async function close() {
    closed = true;
    clearInterval(timer);
    controller?.abort();
    if (task) await task;
    await Promise.allSettled([...operations]);
    await writes;
  }
  const trackedCheck = track(check),
    trackedInstall = track(install);
  return {
    init,
    status,
    check: trackedCheck,
    download,
    install: trackedInstall,
    cancel,
    preferences,
    close,
    recover: () => installer?.recover?.(set),
    wait: async () => {
      if (task) await task;
      await writes;
    }
  };
}
module.exports = { createUpdater, hashFile };
