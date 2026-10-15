'use strict';
const fs = require('node:fs/promises');
const constants = require('node:fs').constants;
const path = require('node:path');
const { scanSteam, isSteamGameRunning } = require('./scanner.cjs');
const { createSGDB, positiveId } = require('./sgdb.cjs');
const { atomicWrite, readJSON, acquireLock, storageBytes, safeFilename } = require('./store.cjs');
const defaults = {
  language: 'en',
  sceneDuration: 24,
  shuffle: true,
  transition: 'crossfade',
  showLogos: true,
  showCover: true,
  coverPosition: 'beside-title',
  smoothMotion: false,
  maxSmoothingMB: 0,
  staticFallback: false,
  reducedMotion: false,
  maxStorageGB: 10,
  pauseOnGame: true
};
const clone = (v) => JSON.parse(JSON.stringify(v));
function newJob() {
  return {
    status: 'idle',
    total: 0,
    processed: 0,
    current: null,
    stage: '',
    errors: [],
    bytes: 0,
    progress: 0
  };
}
function validateSettings(p, initial = false) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) throw new Error('Invalid settings.');
  const out = {};
  for (const [k, v] of Object.entries(p)) {
    if (!(k in defaults)) {
      if (initial) continue;
      throw new Error('Unknown setting.');
    }
    if (
      [
        'shuffle',
        'showLogos',
        'showCover',
        'smoothMotion',
        'staticFallback',
        'reducedMotion',
        'pauseOnGame'
      ].includes(k)
    ) {
      if (typeof v !== 'boolean') throw new Error(`Invalid ${k}.`);
    } else if (k === 'language') {
      if (!['en', 'fr'].includes(v)) throw new Error('Choose English or Français.');
    } else if (k === 'transition') {
      if (!['crossfade', 'fade', 'fade-black'].includes(v)) throw new Error('Invalid transition.');
    } else if (k === 'coverPosition') {
      if (!['beside-title', 'bottom-right', 'top-right', 'top-left'].includes(v))
        throw new Error('Invalid artwork position.');
    } else if (k === 'sceneDuration') {
      if (!Number.isFinite(v) || v < 8 || v > 180)
        throw new Error('Scene duration must be 8–180 seconds.');
    } else if (k === 'maxSmoothingMB') {
      if (!Number.isFinite(v) || v < 0 || v > 1000000)
        throw new Error('Video size limit must be 0 (no limit) or a value up to 1000000 MB.');
    } else if (k === 'maxStorageGB') {
      if (!Number.isFinite(v) || v < 0.1 || v > 1000)
        throw new Error('Storage limit must be 0.1–1000 GB.');
    }
    out[k] = v;
  }
  return out;
}
function cleanGame(g) {
  if (!g || !/^((steam|sgdb):[1-9]\d*)$/.test(g.id) || typeof g.name !== 'string') return null;
  const result = {
    id: g.id,
    steamAppId: Number.isSafeInteger(g.steamAppId) && g.steamAppId > 0 ? g.steamAppId : null,
    sgdbId: Number.isSafeInteger(g.sgdbId) && g.sgdbId > 0 ? g.sgdbId : null,
    name: g.name.slice(0, 300),
    sources: [...new Set((g.sources || []).filter((s) => ['installed', 'manual'].includes(s)))],
    installed: !!g.installed,
    included: g.included !== false,
    status: ['new', 'ready', 'missing', 'error'].includes(g.status) ? g.status : 'new',
    selectedAsset: g.selectedAsset || null,
    manualSelection: !!g.manualSelection,
    media: g.media || null,
    cover: g.cover || null,
    selectedCover: g.selectedCover || null,
    coverManualSelection: !!g.coverManualSelection,
    thumb: g.thumb || null,
    smoothed: g.smoothed || null,
    classification: g.classification || 'game'
  };
  if (result.media && (!safeFilename(result.media.file) || !safeFilename(result.media.thumbnail))) {
    result.media = null;
    result.status = 'new';
  }
  for (const kind of ['cover', 'smoothed']) {
    if (result[kind] && (!safeFilename(result[kind].file) || !safeFilename(result[kind].thumbnail)))
      result[kind] = null;
  }
  if (result.cover?.animated !== false) result.cover = null;
  for (const key of ['coverError', 'smoothingError'])
    if (g[key]) result[key] = String(g[key]).slice(0, 500);
  if (g.error) result.error = String(g.error).slice(0, 500);
  return result;
}
function createCore(options = {}) {
  if (!options.dataDir || !path.isAbsolute(options.dataDir))
    throw new Error('An absolute library data directory is required.');
  const dataDir = path.resolve(options.dataDir);
  const catalogFile = path.join(dataDir, 'catalog.json');
  const keyFile = path.join(dataDir, 'steamgriddb.key');
  let state = {
    version: 1,
    games: [],
    settings: { ...defaults },
    job: newJob(),
    steam: { detected: false, roots: [], installed: false },
    storage: { used: 0 },
    hasKey: false
  };
  let key = '',
    pending = [],
    runner = null,
    controller = null,
    closed = false,
    autoPaused = false,
    releaseLock,
    monitorBusy = false;
  let writes = Promise.resolve(),
    actions = Promise.resolve();
  const assetCache = new Map(),
    coverCache = new Map();
  const lifetime = new AbortController();
  const media = options.media || require('./media.cjs').createMedia({ dataDir });
  const sgdb = options.sgdb || createSGDB({ getKey: () => key, signal: lifetime.signal });
  const runningCheck = options.isGameRunning || isSteamGameRunning;
  function publicState() {
    const s = clone(state);
    s.job.pending = pending.length;
    return s;
  }
  function save() {
    const snapshot = JSON.stringify({ ...state, _queue: pending }, null, 2);
    const write = writes.then(() => atomicWrite(catalogFile, snapshot));
    writes = write.catch(() => {});
    return write;
  }
  function safeError(error) {
    let value = String(error?.message || error || 'Operation failed.');
    if (key) value = value.split(key).join('[redacted]');
    return value.slice(0, 500);
  }
  async function refreshStorage() {
    state.storage.used = await storageBytes(dataDir);
  }
  const init = (async () => {
    releaseLock = await acquireLock(dataDir);
    try {
      let recovered = false;
      const saved = await readJSON(catalogFile, null, {
        onCorrupt: () => {
          recovered = true;
        }
      });
      if (recovered)
        state.warnings = [
          'The damaged catalog was preserved as catalog.json.corrupt-TIMESTAMP in your data directory. Rescan Steam or restore that backup before preparing.'
        ];
      if (saved && saved.version !== 1)
        throw new Error('This library uses an unsupported catalog version.');
      if (saved) {
        state.games = (Array.isArray(saved.games) ? saved.games : [])
          .map(cleanGame)
          .filter(Boolean);
        state.settings = { ...defaults, ...validateSettings(saved.settings || {}, true) };
        state.job = {
          ...newJob(),
          ...saved.job,
          errors: Array.isArray(saved.job?.errors) ? saved.job.errors : []
        };
        pending = (Array.isArray(saved._queue) ? saved._queue : []).filter((id) =>
          state.games.some((g) => g.id === id)
        );
        if (state.job.status === 'running') {
          state.job.status = 'paused';
          state.job.stage = 'Interrupted preparation — ready to resume.';
        }
        state.job.current = null;
      }
      try {
        const h = await fs.open(keyFile, constants.O_RDONLY | constants.O_NOFOLLOW);
        try {
          if ((await h.stat()).size > 512) throw new Error('Invalid API key file size.');
          key = (await h.readFile('utf8')).trim();
          if (key && !/^[A-Za-z0-9_-]{16,256}$/.test(key)) throw new Error('Invalid API key file.');
        } finally {
          await h.close();
        }
        await fs.chmod(keyFile, 0o600);
      } catch (e) {
        if (e.code !== 'ENOENT') throw new Error('The API key file could not be read safely.');
      }
      state.hasKey = !!key;
      await refreshStorage();
      await save();
    } catch (e) {
      await releaseLock?.();
      throw e;
    }
  })();
  function find(id) {
    const g = state.games.find((g) => g.id === id);
    if (!g) throw new Error('This game is no longer in your library.');
    return g;
  }
  async function resolveGame(g, signal) {
    if (g.sgdbId) return g.sgdbId;
    if (!g.steamAppId) throw new Error('This game has no SteamGridDB match.');
    const matched = await sgdb.bySteam(g.steamAppId, { signal });
    if (!matched) throw new Error('No SteamGridDB match was found for this Steam AppID.');
    g.sgdbId = matched.sgdbId;
    const duplicates = state.games.filter((old) => old !== g && old.sgdbId === g.sgdbId);
    if (duplicates.length) {
      const preferred =
        duplicates.find((old) => old.manualSelection) || duplicates.find((old) => old.media);
      if (preferred) {
        g.selectedAsset = preferred.selectedAsset;
        g.manualSelection = preferred.manualSelection;
        g.media = preferred.media;
        g.cover = preferred.cover || duplicates.find((old) => old.cover)?.cover || null;
        g.smoothed = preferred.smoothed || null;
        g.selectedCover = preferred.selectedCover || null;
        g.coverManualSelection = !!preferred.coverManualSelection;
        g.status = preferred.status;
        g.included = preferred.included;
      }
      g.sources = [...new Set([...g.sources, ...duplicates.flatMap((old) => old.sources)])];
      const removed = new Set(duplicates.map((old) => old.id));
      state.games = state.games.filter((old) => !removed.has(old.id));
      const before = pending.length;
      pending = pending.filter((id) => !removed.has(id));
      state.job.total = Math.max(state.job.processed, state.job.total - (before - pending.length));
      state.warnings = [
        'SteamGridDB verified a shared game identity. Duplicate catalog entries were merged and manual artwork choices were preserved.'
      ];
      await save();
    }
    return g.sgdbId;
  }
  async function getArtworks(g, signal) {
    const id = await resolveGame(g, signal);
    const assets = await sgdb.artworks(id, {
      staticFallback: state.settings.staticFallback,
      signal
    });
    assetCache.set(g.id, assets);
    return assets;
  }
  async function optionalBudget(limit) {
    await refreshStorage();
    const disk = await fs.statfs(dataDir);
    const free = Number(disk.bavail) * Number(disk.bsize);
    const remaining = Math.floor(state.settings.maxStorageGB * 1024 ** 3 - state.storage.used);
    const budget = Math.min(limit, remaining, free - 64 * 1024 * 1024);
    if (budget < 1024 * 1024) throw new Error('Not enough storage space for optional media.');
    return budget;
  }
  async function enrichMedia(g, signal) {
    if (state.settings.showCover && sgdb.covers) {
      try {
        if (
          !g.cover ||
          g.cover.animated !== false ||
          !(await media.validate(g.cover, { signal }))
        ) {
          g.cover = null;
          state.job.stage = 'Finding static cover';
          await save();
          const candidates =
            g.coverManualSelection && g.selectedCover
              ? [g.selectedCover]
              : await sgdb.covers(await resolveGame(g, signal), { signal });
          let lastError;
          for (const asset of candidates.slice(0, 3)) {
            try {
              const cover = await media.prepare(asset, {
                signal,
                requireStatic: true,
                maxBytes: await optionalBudget(12 * 1024 * 1024)
              });
              if (cover.animated !== false || !(await media.validate(cover, { signal })))
                throw new Error('The cover must be a valid still image.');
              g.cover = cover;
              break;
            } catch (error) {
              if (signal.aborted) throw error;
              lastError = error;
            }
          }
          if (!g.cover && lastError) throw lastError;
        }
        delete g.coverError;
      } catch (error) {
        if (signal.aborted) throw error;
        g.coverError = safeError(error);
      }
    }
    if (state.settings.smoothMotion && g.media.animated && media.smooth) {
      try {
        if (
          !g.smoothed ||
          g.smoothed.sha256 !== g.media.sha256 ||
          !(await media.validate(g.smoothed, { signal })) ||
          (state.settings.maxSmoothingMB > 0 &&
            (await fs.stat(path.join(dataDir, 'media', g.smoothed.file))).size >
              state.settings.maxSmoothingMB * 1024 * 1024)
        ) {
          g.smoothed = null;
          state.job.stage = 'smoothing';
          await save();
          const smoothed = await media.smooth(g.media, {
            signal,
            maxBytes: await optionalBudget(
              state.settings.maxSmoothingMB > 0
                ? state.settings.maxSmoothingMB * 1024 * 1024
                : Infinity
            )
          });
          if (!(await media.validate(smoothed, { signal })))
            throw new Error('Smoothed media failed final validation.');
          g.smoothed = smoothed;
        }
        delete g.smoothingError;
      } catch (error) {
        if (signal.aborted) throw error;
        g.smoothingError = safeError(error);
      }
    }
  }
  async function runQueue() {
    try {
      while (pending.length && state.job.status === 'running' && !closed) {
        if (state.settings.pauseOnGame && (await runningCheck())) {
          autoPaused = true;
          state.job.status = 'paused';
          state.job.pauseReason = 'game';
          state.job.stage = 'Paused while a Steam game is running.';
          await save();
          break;
        }
        const id = pending[0];
        const g = state.games.find((g) => g.id === id);
        controller = new AbortController();
        const signal = controller.signal;
        if (!g || !g.included) {
          pending.shift();
          state.job.processed++;
          await save();
          continue;
        }
        state.job.current = id;
        state.job.progress = 0;
        state.job.stage = 'Checking local media';
        await save();
        try {
          if (!g.sgdbId && g.steamAppId && state.games.some((old) => old.sgdbId && !old.steamAppId))
            await resolveGame(g, signal);
          if (!g.included) {
            pending.shift();
            state.job.processed++;
            await save();
            continue;
          }
          if (g.media && (await media.validate(g.media, { signal }))) {
            g.status = 'ready';
            delete g.error;
          } else {
            state.job.stage = 'Finding animated artwork';
            await save();
            let candidates =
              g.manualSelection && g.selectedAsset
                ? [g.selectedAsset]
                : await getArtworks(g, signal);
            if (g.manualSelection && g.selectedAsset) candidates = [g.selectedAsset];
            candidates = candidates.slice(0, g.manualSelection ? 1 : 3);
            if (!candidates.length) {
              g.status = 'missing';
              g.error =
                'No animated artwork found. You can enable optional static fallback in Settings.';
            } else {
              let succeeded = false;
              const rejected = [];
              for (const asset of candidates) {
                if (signal.aborted) throw signal.reason || new Error('Preparation paused.');
                if (!asset.animated && !state.settings.staticFallback)
                  throw new Error('Static fallback is disabled. Choose an animated artwork.');
                await refreshStorage();
                const remaining = Math.floor(
                  state.settings.maxStorageGB * 1024 ** 3 - state.storage.used
                );
                if (remaining < 1024 * 1024)
                  throw new Error(
                    'Storage limit reached. Clear unused media or increase the storage limit.'
                  );
                const disk = await fs.statfs(dataDir).catch(() => null);
                const free = disk ? Number(disk.bavail) * Number(disk.bsize) : Infinity;
                if (free < 128 * 1024 * 1024)
                  throw new Error(
                    'Not enough free disk space. Free at least 128 MB before preparing.'
                  );
                state.job.stage = 'Downloading artwork';
                await save();
                const downloadedBefore = state.job.bytes;
                try {
                  const prepared = await media.prepare(asset, {
                    signal,
                    maxBytes: Math.min(remaining, free - 64 * 1024 * 1024),
                    onProgress: (p) => {
                      if (state.job.current !== id) return;
                      if (typeof p === 'string') state.job.stage = p;
                      else if (p) {
                        state.job.stage = p.stage || state.job.stage;
                        state.job.progress = Number.isFinite(p.progress)
                          ? p.progress
                          : p.total > 0
                            ? Math.min(1, p.bytes / p.total)
                            : state.job.progress;
                        state.job.bytes = Number.isFinite(p.bytes)
                          ? downloadedBefore + p.bytes
                          : state.job.bytes;
                      }
                    }
                  });
                  if (signal.aborted) throw signal.reason || new Error('Preparation paused.');
                  if (
                    !prepared ||
                    !safeFilename(prepared.file) ||
                    !safeFilename(prepared.thumbnail) ||
                    !(await media.validate(prepared, { signal }))
                  )
                    throw new Error('Prepared media failed final validation.');
                  g.media = prepared;
                  g.smoothed = null;
                  delete g.smoothingError;
                  g.selectedAsset = asset;
                  g.status = 'ready';
                  delete g.error;
                  await refreshStorage();
                  succeeded = true;
                  break;
                } catch (error) {
                  if (signal.aborted) throw error;
                  const rejection = {
                    id,
                    assetId: asset.id,
                    kind: asset.kind,
                    message: safeError(error)
                  };
                  rejected.push(rejection);
                  state.job.rejected = [...(state.job.rejected || []), rejection];
                  await save();
                }
              }
              if (!succeeded)
                throw new Error(
                  `${g.manualSelection ? 'Your selected artwork' : `All ${candidates.length} ranked artwork candidates`} failed preparation. ${rejected.at(-1)?.message || 'Choose another artwork and retry.'}`
                );
            }
          }
          if (signal.aborted) throw signal.reason || new Error('Preparation paused.');
          if (g.status === 'ready') {
            await enrichMedia(g, signal);
            await refreshStorage();
          }
          if (signal.aborted) throw signal.reason || new Error('Preparation paused.');
          pending.shift();
          state.job.processed++;
          state.job.progress = 1;
          await save();
        } catch (e) {
          if (signal.aborted) {
            await save();
            break;
          }
          g.status = 'error';
          g.error = safeError(e);
          state.job.errors.push({ id, message: g.error });
          pending.shift();
          state.job.processed++;
          await save();
        } finally {
          controller = null;
        }
      }
      if (!pending.length && state.job.status === 'running') {
        state.job.status = 'completed';
        state.job.current = null;
        state.job.stage = 'Library preparation complete';
        await save();
      }
    } catch (e) {
      state.job.status = 'paused';
      state.job.stage = safeError(e);
      await save().catch(() => {});
    } finally {
      state.job.current = null;
      runner = null;
    }
  }
  function start() {
    if (!runner && pending.length && state.job.status === 'running') runner = runQueue();
  }
  async function stop(status, reason = '') {
    autoPaused = false;
    state.job.status = status;
    state.job.pauseReason = reason;
    controller?.abort(
      new Error(status === 'cancelled' ? 'Preparation cancelled.' : 'Preparation paused.')
    );
    if (runner) await runner;
    state.job.current = null;
    if (status === 'cancelled') {
      pending = [];
      state.job.stage = 'Preparation cancelled';
    } else state.job.stage = 'Preparation paused';
    await save();
  }
  const monitor = setInterval(async () => {
    if (closed || monitorBusy) return;
    monitorBusy = true;
    try {
      await init;
      if (!state.settings.pauseOnGame) return;
      const playing = await runningCheck();
      if (playing && state.job.status === 'running') {
        autoPaused = true;
        state.job.status = 'paused';
        state.job.pauseReason = 'game';
        controller?.abort(new Error('Paused while a Steam game is running.'));
        if (runner) await runner;
        state.job.stage = 'Paused while a Steam game is running.';
        await save();
      } else if (!playing && autoPaused && state.job.status === 'paused') {
        autoPaused = false;
        state.job.status = 'running';
        delete state.job.pauseReason;
        await save();
        start();
      }
    } catch {
    } finally {
      monitorBusy = false;
    }
  }, 5000);
  monitor.unref?.();
  async function dispatch(action, p = {}) {
    await init;
    if (closed) throw new Error('Screensaver Manager is closed.');
    if (!p || typeof p !== 'object' || Array.isArray(p)) throw new Error('Invalid action payload.');
    if (action === 'state') return publicState();
    if (runner && state.job.status === 'completed') await runner;
    if (action === 'setKey') {
      const next = String(p.key || '').trim();
      if (next && !/^[A-Za-z0-9_-]{16,256}$/.test(next))
        throw new Error('Enter a valid SteamGridDB personal API key.');
      if (next) await atomicWrite(keyFile, next + '\n');
      else await fs.rm(keyFile, { force: true });
      key = next;
      state.hasKey = !!key;
      await save();
      return publicState();
    }
    if (action === 'previewImage') {
      if (!media.preview) throw new Error('Image previews are unavailable.');
      let url = p.url;
      if (p.sgdbId || p.steamAppId) {
        const id = p.sgdbId
          ? positiveId(p.sgdbId)
          : (await sgdb.bySteam(positiveId(p.steamAppId), { signal: lifetime.signal }))?.sgdbId;
        if (!id) throw new Error('No SteamGridDB preview is available for this game.');
        const rows = sgdb.enrichThumbnails
          ? await sgdb.enrichThumbnails([{ sgdbId: id, thumb: null }], { signal: lifetime.signal })
          : [];
        url = rows[0]?.thumb;
        if (!url && sgdb.covers) {
          const covers = await sgdb.covers(id, { signal: lifetime.signal });
          url = covers[0]?.thumb || covers[0]?.url;
        }
        if (!url) throw new Error('No SteamGridDB preview is available for this game.');
      }
      return media.preview(
        { file: p.file, url },
        { signal: lifetime.signal, force: p.force === true }
      );
    }
    if (action === 'validateKey') return sgdb.validateKey();
    if (action === 'scan') {
      const scan = await scanSteam(options.steamRoots);
      state.steam.detected = scan.detected;
      state.steam.roots = scan.roots;
      state.steam.warnings = scan.warnings;
      const found = new Set(scan.games.map((g) => g.steamAppId));
      for (const g of state.games) {
        if (g.steamAppId) {
          g.installed = found.has(g.steamAppId);
          if (!g.installed) g.sources = g.sources.filter((s) => s !== 'installed');
        }
      }
      for (const g of scan.games) {
        const old = state.games.find((old) => old.steamAppId === g.steamAppId);
        if (old) {
          old.installed = true;
          old.sources = [...new Set([...old.sources, 'installed'])];
          old.name = g.name;
          old.classification = g.classification;
        } else state.games.push(g);
      }
      const installer = require('./installer.cjs');
      state.steam.installed = scan.roots.length
        ? await installer.isInstalled(scan.roots[0])
        : false;
      await save();
      return publicState();
    }
    if (action === 'search') {
      let results = await sgdb.search(p.query);
      if (sgdb.enrichThumbnails) results = await sgdb.enrichThumbnails(results);
      return results.map((g) => ({
        ...g,
        present: state.games.some(
          (old) => old.sgdbId === g.sgdbId || (g.steamAppId && old.steamAppId === g.steamAppId)
        )
      }));
    }
    if (action === 'add') {
      let metadata = await sgdb.game(positiveId(p.sgdbId));
      if (!metadata) throw new Error('SteamGridDB game not found.');
      if (!metadata.thumb && sgdb.enrichThumbnails)
        metadata = (await sgdb.enrichThumbnails([metadata]))[0];
      let steamId = metadata.steamAppId;
      if (p.steamAppId) {
        const verified = await sgdb.bySteam(positiveId(p.steamAppId));
        if (verified?.sgdbId !== metadata.sgdbId)
          throw new Error('Steam AppID does not match this SteamGridDB game.');
        steamId = verified.steamAppId;
      }
      const matches = state.games.filter(
        (g) => g.sgdbId === metadata.sgdbId || (steamId && g.steamAppId === steamId)
      );
      if (matches.some((g) => g.id === state.job.current))
        throw new Error('Pause preparation before merging the current game.');
      let g = matches.find((g) => g.manualSelection || g.media) || matches[0];
      if (g) {
        g.thumb = g.thumb || metadata.thumb || null;
        g.sgdbId = metadata.sgdbId;
        g.steamAppId = steamId || g.steamAppId;
        g.sources = [...new Set([...matches.flatMap((m) => m.sources), 'manual'])];
        g.installed = matches.some((m) => m.installed);
        g.cover = g.cover || matches.find((m) => m.cover)?.cover || null;
        state.games = state.games.filter((old) => !matches.includes(old) || old === g);
      } else {
        g = {
          id: steamId ? `steam:${steamId}` : `sgdb:${metadata.sgdbId}`,
          steamAppId: steamId,
          sgdbId: metadata.sgdbId,
          name: metadata.name,
          sources: ['manual'],
          installed: false,
          included: true,
          status: 'new',
          selectedAsset: null,
          manualSelection: false,
          media: null,
          classification: 'game',
          thumb: metadata.thumb || null
        };
        state.games.push(g);
      }
      await save();
      return publicState();
    }
    if (action === 'artworks') return getArtworks(find(p.id));
    if (action === 'covers') {
      const g = find(p.id),
        rows = await sgdb.covers(await resolveGame(g));
      coverCache.set(g.id, rows);
      return rows;
    }
    if (action === 'setCover') {
      const g = find(p.id);
      if (runner || state.job.current === g.id)
        throw new Error('Pause preparation before changing the current game.');
      const rows = coverCache.get(g.id) || (await sgdb.covers(await resolveGame(g)));
      const automatic = p.selectedCover === null;
      const asset = automatic
        ? rows[0]
        : rows.find(
            (a) =>
              a.id === Number(p.selectedCover?.id) &&
              (!p.selectedCover.kind || p.selectedCover.kind === a.kind)
          );
      if (!asset && !automatic)
        throw new Error('Choose a still artwork from this game’s SteamGridDB gallery.');
      let prepared = null;
      if (asset) {
        prepared = await media.prepare(asset, {
          requireStatic: true,
          signal: lifetime.signal,
          maxBytes: await optionalBudget(160 * 1024 * 1024)
        });
        if (
          prepared.animated !== false ||
          !(await media.validate(prepared, { signal: lifetime.signal }))
        )
          throw new Error('The fixed artwork must be a valid still image.');
      }
      g.cover = prepared;
      g.selectedCover = automatic ? null : asset;
      g.coverManualSelection = !automatic;
      delete g.coverError;
      await refreshStorage();
      await save();
      return publicState();
    }
    if (action === 'updateGame') {
      const g = find(p.id);
      if (state.job.current === g.id)
        throw new Error('Pause preparation before changing the current game.');
      if ('included' in p && typeof p.included !== 'boolean')
        throw new Error('Invalid inclusion value.');
      let chosen;
      if ('selectedAsset' in p && p.selectedAsset !== null) {
        const selected = p.selectedAsset;
        if (!selected || typeof selected !== 'object')
          throw new Error('Choose an artwork from this game’s SteamGridDB gallery.');
        let assets = assetCache.get(g.id);
        if (!assets) assets = await getArtworks(g);
        chosen = assets.find(
          (a) => a.id === Number(selected.id) && (!selected.kind || a.kind === selected.kind)
        );
        if (!chosen) throw new Error('Choose an artwork from this game’s SteamGridDB gallery.');
      }
      if ('included' in p) g.included = p.included;
      if ('selectedAsset' in p) {
        g.manualSelection = p.selectedAsset !== null;
        g.selectedAsset = chosen || null;
        g.media = null;
        g.smoothed = null;
        delete g.smoothingError;
        g.status = 'new';
        delete g.error;
      }
      await save();
      return publicState();
    }
    if (action === 'remove') {
      if (state.job.current === p.id)
        throw new Error('Pause preparation before removing the current game.');
      find(p.id);
      state.games = state.games.filter((g) => g.id !== p.id);
      const removed = pending.filter((id) => id === p.id).length;
      pending = pending.filter((id) => id !== p.id);
      state.job.total = Math.max(state.job.processed, state.job.total - removed);
      await save();
      return publicState();
    }
    if (action === 'prepare' || action === 'retry') {
      if (state.job.status === 'running') return publicState();
      if (state.job.status === 'paused' && pending.length && action === 'prepare') {
        state.job.status = 'running';
        autoPaused = false;
        await save();
        start();
        return publicState();
      }
      let games = state.games.filter(
        (g) => g.included && (action !== 'retry' || g.status === 'error')
      );
      if (p.ids) {
        if (!Array.isArray(p.ids)) throw new Error('Invalid game selection.');
        games = games.filter((g) => p.ids.includes(g.id));
      }
      pending = games.map((g) => g.id);
      state.job = {
        ...newJob(),
        status: pending.length ? 'running' : 'completed',
        total: pending.length
      };
      await save();
      start();
      return publicState();
    }
    if (action === 'pause') {
      await stop('paused');
      return publicState();
    }
    if (action === 'cancel') {
      await stop('cancelled');
      return publicState();
    }
    if (action === 'resume') {
      if (pending.length) {
        state.job.status = 'running';
        autoPaused = false;
        delete state.job.pauseReason;
        await save();
        start();
      }
      return publicState();
    }
    if (action === 'settings') {
      state.settings = { ...state.settings, ...validateSettings(p) };
      await save();
      return publicState();
    }
    if (action === 'repair') {
      if (runner) throw new Error('Pause preparation before repairing the library.');
      for (const g of state.games) {
        if (g.media && !(await media.validate(g.media))) {
          g.status = 'new';
          g.media = null;
          g.error = 'Cached media was missing or invalid. Prepare this game again.';
        }
      }
      for (const g of state.games)
        for (const kind of ['cover', 'smoothed'])
          if (g[kind] && !(await media.validate(g[kind]))) g[kind] = null;
      await refreshStorage();
      await save();
      return publicState();
    }
    if (action === 'clearUnused') {
      if (runner) throw new Error('Pause preparation before clearing unused media.');
      const used = new Set();
      for (const g of state.games)
        for (const m of [g.media, g.cover, g.smoothed].filter(Boolean))
          for (const key of ['file', 'thumbnail', 'sourceFile'])
            if (safeFilename(m[key])) used.add(m[key]);
      for (const dir of ['media', 'sources', 'processed', 'thumbnails']) {
        const folder = path.join(dataDir, dir);
        const stat = await fs.lstat(folder).catch(() => null);
        if (!stat) continue;
        if (!stat.isDirectory() || stat.isSymbolicLink())
          throw new Error('Unsafe media directory. No files were removed from it.');
        for (const e of await fs.readdir(folder, { withFileTypes: true })) {
          if (dir === 'media' && e.isDirectory() && /^[0-9a-f-]{36}\.frames$/.test(e.name)) {
            const work = path.join(folder, e.name);
            const marker = await fs
              .lstat(path.join(work, '.cinema-smoothing-work'))
              .catch(() => null);
            if (
              marker?.isFile() &&
              !marker.isSymbolicLink() &&
              marker.size === 31 &&
              (await fs.readFile(path.join(work, '.cinema-smoothing-work'), 'utf8')) ===
                'steamos-animated-screensaver-v1'
            )
              await fs.rm(work, { recursive: true });
          }
          if (e.isFile() && !used.has(e.name) && safeFilename(e.name))
            await fs.rm(path.join(folder, e.name));
        }
      }
      await refreshStorage();
      await save();
      return publicState();
    }
    if (action === 'install' || action === 'uninstall') {
      if (!state.steam.roots.length) {
        const scan = await scanSteam(options.steamRoots);
        state.steam = { ...state.steam, detected: scan.detected, roots: scan.roots };
      }
      const root = state.steam.roots[0];
      if (!root) throw new Error('Steam was not detected. Install Steam and rescan your library.');
      const installer = require('./installer.cjs');
      if (action === 'install') {
        const ready = state.games.filter(
          (g) =>
            g.included &&
            g.status === 'ready' &&
            g.media &&
            (g.media.animated || state.settings.staticFallback)
        );
        if (!ready.length) throw new Error('Prepare at least one included game before installing.');
        await installer.install({
          dataDir,
          steamRoot: root,
          games: ready,
          settings: state.settings
        });
      } else await installer.uninstall({ steamRoot: root });
      state.steam.installed = await installer.isInstalled(root);
      await save();
      return publicState();
    }
    throw new Error('Unknown application action.');
  }
  return {
    invoke(action, payload = {}) {
      if (action === 'state' || action === 'previewImage') return dispatch(action, payload);
      const result = actions.then(() => dispatch(action, payload));
      actions = result.catch(() => {});
      return result;
    },
    async close() {
      if (closed) return;
      clearInterval(monitor);
      await init;
      closed = true;
      lifetime.abort(new Error('Manager closed.'));
      controller?.abort(new Error('Manager closed.'));
      await actions;
      await media.waitForPreviews?.();
      if (runner) await runner;
      if (state.job.status === 'running') state.job.status = 'paused';
      state.job.current = null;
      await save();
      await writes;
      await releaseLock?.();
    }
  };
}
module.exports = { createCore, validateSettings, cleanGame };
