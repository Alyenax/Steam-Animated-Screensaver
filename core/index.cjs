'use strict';
const fs = require('node:fs/promises');
const constants = require('node:fs').constants;
const path = require('node:path');
const { smoothingMatches, smoothingConfig } = require('./smoothing.cjs');
const { isSteamComponent } = require('./steam-components.cjs');
const selection = require('../manager/selection.js');
const { planPurge, applyPurge } = require('./purge.cjs');
const { createSteamAccount, parseProfile } = require('./steam-account.cjs');
const { scanSteam, isSteamGameRunning } = require('./scanner.cjs');
const steamIdle = require('./steam-idle.cjs');
const { createSGDB, positiveId } = require('./sgdb.cjs');
const { atomicWrite, readJSON, acquireLock, storageBytes, safeFilename } = require('./store.cjs');
const defaults = {
  language: 'en',
  sceneDuration: 24,
  shuffle: true,
  transition: 'crossfade',
  showLogos: true,
  nameDisplay: 'logo',
  logoPosition: 'beside-title',
  showCover: true,
  coverPosition: 'beside-title',
  framing: 'original',
  smoothMotion: false,
  smoothingFps: 30,
  smoothingMode: 'fast',
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
    progress: null,
    history: [],
    detail: {},
    stageStartedAt: null
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
    } else if (k === 'nameDisplay') {
      if (!['title', 'logo', 'both', 'hidden'].includes(v))
        throw new Error('Invalid game name display.');
    } else if (k === 'logoPosition') {
      if (!['beside-title', 'bottom-left', 'bottom-right', 'top-left', 'top-right'].includes(v))
        throw new Error('Invalid logo position.');
    } else if (k === 'language') {
      if (!['en', 'fr'].includes(v)) throw new Error('Choose English or Français.');
    } else if (k === 'transition') {
      if (!['crossfade', 'fade', 'fade-black'].includes(v)) throw new Error('Invalid transition.');
    } else if (k === 'coverPosition') {
      if (!['beside-title', 'bottom-right', 'top-right', 'top-left'].includes(v))
        throw new Error('Invalid artwork position.');
    } else if (k === 'framing') {
      if (!['original', '16:9', '16:10'].includes(v))
        throw new Error('Choose Original, 16:9 or 16:10 framing.');
    } else if (k === 'sceneDuration') {
      if (!Number.isFinite(v) || v < 8 || v > 180)
        throw new Error('Scene duration must be 8–180 seconds.');
    } else if (k === 'smoothingFps') {
      if (![24, 30].includes(v)) throw new Error('Choose 24 or 30 frames per second.');
    } else if (k === 'smoothingMode') {
      if (!['fast', 'quality', 'blend'].includes(v)) throw new Error('Invalid smoothing mode.');
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
function validateCrop(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !['inherit', 'original', '16:9', '16:10'].includes(value.mode) ||
    !Number.isFinite(value.x) ||
    value.x < 0 ||
    value.x > 100 ||
    !Number.isFinite(value.y) ||
    value.y < 0 ||
    value.y > 100
  )
    throw new Error('Invalid crop. Choose a framing mode and positions from 0 to 100.');
  return { mode: value.mode, x: value.x, y: value.y };
}
function validateBranding(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !['inherit', 'title', 'logo', 'both', 'hidden'].includes(value.mode) ||
    !['inherit', 'beside-title', 'bottom-left', 'bottom-right', 'top-left', 'top-right'].includes(
      value.position
    )
  )
    throw new Error('Invalid game branding.');
  return { mode: value.mode, position: value.position };
}
function cleanGame(g) {
  if (
    !g ||
    !/^((steam|sgdb):[1-9]\d*)$/.test(g.id) ||
    typeof g.name !== 'string' ||
    isSteamComponent(g)
  )
    return null;
  const result = {
    id: g.id,
    steamAppId: Number.isSafeInteger(g.steamAppId) && g.steamAppId > 0 ? g.steamAppId : null,
    sgdbId: Number.isSafeInteger(g.sgdbId) && g.sgdbId > 0 ? g.sgdbId : null,
    name: g.name.slice(0, 300),
    sources: [
      ...new Set(
        (g.sources || []).filter((s) => ['installed', 'manual', 'account', 'popular'].includes(s))
      )
    ],
    installed: !!g.installed,
    included: g.included !== false,
    status: ['new', 'ready', 'missing', 'error'].includes(g.status) ? g.status : 'new',
    selectedAsset: g.selectedAsset || null,
    manualSelection: !!g.manualSelection,
    media: g.media || null,
    cover: g.cover || null,
    logo: g.logo || null,
    selectedLogo: g.selectedLogo || null,
    logoManualSelection: !!g.logoManualSelection,
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
  for (const kind of ['cover', 'logo', 'smoothed']) {
    if (result[kind] && (!safeFilename(result[kind].file) || !safeFilename(result[kind].thumbnail)))
      result[kind] = null;
  }
  if (Number.isSafeInteger(g.playtimeMinutes) && g.playtimeMinutes >= 0)
    result.playtimeMinutes = g.playtimeMinutes;
  if (Number.isSafeInteger(g.popularRank) && g.popularRank > 0) result.popularRank = g.popularRank;
  if (g.crop) {
    try {
      result.crop = validateCrop(g.crop);
    } catch {}
  }
  if (g.branding) {
    try {
      result.branding = validateBranding(g.branding);
    } catch {}
  }
  if (result.logo?.animated !== false) result.logo = null;
  if (result.cover?.animated !== false) result.cover = null;
  for (const key of ['coverError', 'logoError', 'smoothingError'])
    if (g[key]) result[key] = String(g[key]).slice(0, 500);
  if (g.error) result.error = String(g.error).slice(0, 500);
  return result;
}
function createCore(options = {}) {
  if (!options.dataDir || !path.isAbsolute(options.dataDir))
    throw new Error('An absolute library data directory is required.');
  const dataDir = path.resolve(options.dataDir);
  let diagnostics = options.diagnostics;
  const catalogFile = path.join(dataDir, 'catalog.json');
  const keyFile = path.join(dataDir, 'steamgriddb.key');
  const steamKeyFile = path.join(dataDir, 'steam-api.key');
  let state = {
    version: 1,
    games: [],
    settings: { ...defaults },
    job: newJob(),
    steam: { detected: false, roots: [], installed: false },
    storage: { used: 0 },
    steamAccount: { profile: '', steamId: null, hasKey: false, lastImport: null, count: 0 },
    hasKey: false,
    previewsPaused: false
  };
  let selectionJob = { status: 'idle' },
    selectionTask = null,
    selectionController = null;
  const popularity =
    options.popularity || require('./steam-popularity.cjs').createPopularity({ dataDir });
  let key = '',
    steamKey = '',
    pending = [],
    runner = null,
    controller = null,
    closed = false,
    autoPaused = false,
    releaseLock,
    monitorBusy = false,
    purging = false;
  let previewAbort = new AbortController();
  const previewTasks = new Set();
  let writes = Promise.resolve(),
    actions = Promise.resolve();
  const assetCache = new Map(),
    coverCache = new Map(),
    logoCache = new Map();
  const lifetime = new AbortController();
  const media = options.media || require('./media.cjs').createMedia({ dataDir });
  const sgdb = options.sgdb || createSGDB({ getKey: () => key, signal: lifetime.signal });
  const steamAccount = options.steamAccount || createSteamAccount({ getKey: () => steamKey });
  const runningCheck = options.isGameRunning || isSteamGameRunning;
  function publicState() {
    const s = clone(state);
    s.selectionJob = clone(selectionJob);
    s.steam.needsUpdate =
      !!s.steam.installed && s.steam.signature !== require('./installer.cjs').signature(state);
    s.diagnostics = {
      available: !!diagnostics,
      file: diagnostics?.file || null,
      error: diagnostics?.failure || null
    };
    s.job.pending = pending.length;
    if (s.job.status === 'running' && s.job.stageStartedAt)
      s.job.stageElapsed = Math.floor((Date.now() - s.job.stageStartedAt) / 1000);
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
    if (steamKey) value = value.split(steamKey).join('[redacted]');
    return value.slice(0, 500);
  }
  function jobProgress(p, force = false) {
    if (!p || typeof p !== 'object') return;
    const stage = String(p.stage || state.job.stage),
      changed = stage !== state.job.stage;
    const progress = Number.isFinite(p.progress) ? Math.max(0, Math.min(1, p.progress)) : null;
    const previousBucket = Math.floor((state.job.progress ?? -1) * 10);
    if (changed) state.job.stageStartedAt = Date.now();
    state.job.stage = stage;
    state.job.progress = progress;
    state.job.detail = { ...p, stage: undefined, progress: undefined };
    if (changed || force || (progress !== null && Math.floor(progress * 10) > previousBucket)) {
      const game = state.games.find((g) => g.id === state.job.current);
      diagnostics?.record(
        p.message || /error/.test(stage) ? 'error' : 'info',
        'preparation.progress',
        { gameId: game?.id, stage, progress, detail: p }
      );
      state.job.history = [
        ...(state.job.history || []),
        {
          at: Date.now(),
          game: game?.name || null,
          stage,
          progress,
          frames: p.frames,
          totalFrames: p.totalFrames,
          targetFps: p.targetFps,
          mode: p.mode,
          codec: p.codec,
          message: p.message
        }
      ].slice(-250);
    }
  }
  async function refreshStorage() {
    state.storage.used = await storageBytes(dataDir);
  }
  const init = (async () => {
    releaseLock = await acquireLock(dataDir);
    try {
      diagnostics ||= require('./diagnostics.cjs').createDiagnostics({
        dataDir,
        secrets: () => [key, steamKey]
      });
      let recovered = false;
      const saved = await readJSON(catalogFile, null, {
        onCorrupt: () => {
          recovered = true;
          diagnostics?.record('warn', 'catalog.recovered', {
            message: 'Malformed catalog preserved as a corrupt backup.'
          });
        }
      });
      if (recovered)
        state.warnings = [
          'The damaged catalog was preserved as catalog.json.corrupt-TIMESTAMP in your data directory. Rescan Steam or restore that backup before preparing.'
        ];
      if (saved && saved.version !== 1)
        throw new Error('This library uses an unsupported catalog version.');
      if (saved) {
        state.previewsPaused = saved.previewsPaused === true;
        if (saved.lastMediaPurge) state.lastMediaPurge = saved.lastMediaPurge;
        state.games = (Array.isArray(saved.games) ? saved.games : [])
          .map(cleanGame)
          .filter(Boolean);
        state.settings = { ...defaults, ...validateSettings(saved.settings || {}, true) };
        if (saved.settings?.nameDisplay === undefined && saved.settings?.showLogos === false)
          state.settings.nameDisplay = 'hidden';
        if (saved.settings?.smoothingMode === undefined && saved.settings?.smoothMotion)
          state.settings.smoothingMode = 'quality';
        if (saved.steamAccount && typeof saved.steamAccount.profile === 'string') {
          state.steamAccount = {
            ...state.steamAccount,
            profile: saved.steamAccount.profile.slice(0, 200),
            steamId: saved.steamAccount.steamId,
            lastImport: saved.steamAccount.lastImport,
            count: saved.steamAccount.count
          };
        }
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
          state.job.stage = 'Interrupted preparation - ready to resume.';
        }
        state.job.current = null;
        if (Array.isArray(saved.games) && saved.games.some(isSteamComponent)) {
          state.job.total = state.job.processed + pending.length;
          if (!pending.length && state.job.status === 'paused') state.job = newJob();
        }
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
      try {
        const handle = await fs.open(steamKeyFile, constants.O_RDONLY | constants.O_NOFOLLOW);
        try {
          if ((await handle.stat()).size > 128) throw new Error('Invalid Steam API key file.');
          steamKey = (await handle.readFile('utf8')).trim();
          if (steamKey && !/^[a-fA-F0-9]{32}$/.test(steamKey))
            throw new Error('Invalid Steam API key file.');
        } finally {
          await handle.close();
        }
        await fs.chmod(steamKeyFile, 0o600);
      } catch (error) {
        if (error.code !== 'ENOENT') throw new Error('The Steam API key could not be read safely.');
      }
      diagnostics?.addSecret(key);
      diagnostics?.addSecret(steamKey);
      state.steamAccount.hasKey = !!steamKey;
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
        for (const key of ['logo', 'selectedLogo', 'logoManualSelection', 'branding'])
          g[key] = g[key] || preferred[key] || duplicates.find((old) => old[key])?.[key];
        g.status = preferred.status;
        g.included = preferred.included;
      }
      if (g.playtimeMinutes === undefined)
        g.playtimeMinutes =
          preferred?.playtimeMinutes ??
          duplicates.find((old) => old.playtimeMinutes !== undefined)?.playtimeMinutes;
      if (g.popularRank === undefined)
        g.popularRank =
          preferred?.popularRank ?? duplicates.find((old) => old.popularRank)?.popularRank;
      g.crop = g.crop || preferred?.crop || duplicates.find((old) => old.crop)?.crop;
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
        jobProgress({ stage: 'cover-check' });
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
                onProgress: (p) => jobProgress({ ...p, stage: 'cover-prepare' }),
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
        diagnostics?.record('warn', 'preparation.cover_failed', { gameId: g.id, error });
      }
    }
    if (
      sgdb.logos &&
      !['title', 'hidden'].includes(
        g.branding?.mode && g.branding.mode !== 'inherit'
          ? g.branding.mode
          : state.settings.nameDisplay
      )
    ) {
      try {
        jobProgress({ stage: 'logo-check' });
        if (!g.logo || g.logo.animated !== false || !(await media.validate(g.logo, { signal }))) {
          g.logo = null;
          state.job.stage = 'Finding game logo';
          await save();
          const candidates =
            g.logoManualSelection && g.selectedLogo
              ? [g.selectedLogo]
              : await sgdb.logos(await resolveGame(g, signal), { signal });
          let lastError;
          for (const asset of candidates.slice(0, 3)) {
            try {
              const logo = await media.prepare(asset, {
                signal,
                requireStatic: true,
                onProgress: (p) => jobProgress({ ...p, stage: 'logo-prepare' }),
                maxBytes: await optionalBudget(12 * 1024 * 1024)
              });
              if (logo.animated !== false || !(await media.validate(logo, { signal })))
                throw new Error('The logo must be a valid still logo.');
              g.logo = logo;
              break;
            } catch (error) {
              if (signal.aborted) throw error;
              lastError = error;
            }
          }
          if (!g.logo && lastError) throw lastError;
        }
        delete g.logoError;
      } catch (error) {
        if (signal.aborted) throw error;
        g.logoError = safeError(error);
        diagnostics?.record('warn', 'preparation.logo_failed', { gameId: g.id, error });
      }
    }
    if (state.settings.smoothMotion && g.media.animated && media.smooth) {
      try {
        if (
          !g.smoothed ||
          !smoothingMatches(g.smoothed, state.settings) ||
          g.smoothed.sha256 !== g.media.sha256 ||
          !(await media.validate(g.smoothed, { signal })) ||
          (state.settings.maxSmoothingMB > 0 &&
            (await fs.stat(path.join(dataDir, 'media', g.smoothed.file))).size >
              state.settings.maxSmoothingMB * 1024 * 1024)
        ) {
          g.smoothed = null;
          jobProgress({ stage: 'smoothing-inspect' });
          await save();
          const smoothingSettings = { ...state.settings };
          const smoothed = await media.smooth(g.media, {
            signal,
            settings: smoothingSettings,
            onProgress: (p) => {
              if (!signal.aborted) jobProgress(p);
            },
            maxBytes: await optionalBudget(
              state.settings.maxSmoothingMB > 0
                ? state.settings.maxSmoothingMB * 1024 * 1024
                : Infinity
            )
          });
          if (!(await media.validate(smoothed, { signal })))
            throw new Error('Smoothed media failed final validation.');
          g.smoothed = { ...smoothed, smoothingConfig: smoothingConfig(smoothingSettings) };
        }
        delete g.smoothingError;
      } catch (error) {
        if (signal.aborted) throw error;
        g.smoothingError = safeError(error);
        diagnostics?.record('error', 'preparation.smoothing_failed', { gameId: g.id, error });
        jobProgress({ stage: 'smoothing-error', message: g.smoothingError }, true);
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
          jobProgress({ stage: 'paused-game' }, true);
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
        jobProgress({ stage: 'checking-local' }, true);
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
            jobProgress({ stage: 'finding-artwork' });
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
                jobProgress({ stage: 'downloading', progress: 0 });
                await save();
                const downloadedBefore = state.job.bytes;
                try {
                  const prepared = await media.prepare(asset, {
                    signal,
                    maxBytes: Math.min(remaining, free - 64 * 1024 * 1024),
                    onProgress: (p) => {
                      if (state.job.current !== id) return;
                      if (typeof p === 'string') jobProgress({ stage: p });
                      else if (p) {
                        jobProgress({
                          ...p,
                          progress: Number.isFinite(p.progress)
                            ? p.progress
                            : p.total > 0
                              ? p.bytes / p.total
                              : null
                        });
                        if (Number.isFinite(p.bytes)) state.job.bytes = downloadedBefore + p.bytes;
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
                  diagnostics?.record('warn', 'preparation.candidate_rejected', {
                    gameId: id,
                    assetId: asset.id,
                    error
                  });
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
          jobProgress({ stage: g.status === 'ready' ? 'game-ready' : 'game-missing', progress: 1 });
          await save();
        } catch (e) {
          if (signal.aborted) {
            await save();
            break;
          }
          g.status = 'error';
          g.error = safeError(e);
          diagnostics?.record('error', 'preparation.game_failed', { gameId: g.id, error: e });
          state.job.errors.push({ id, message: g.error });
          jobProgress({ stage: 'game-error', message: g.error }, true);
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
        jobProgress({ stage: 'completed', progress: 1 }, true);
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
    jobProgress({ stage: status }, true);
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
        jobProgress({ stage: 'paused-game' }, true);
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
  function selectionWritable() {
    if (runner || pending.length)
      throw new Error('Finish or cancel preparation before changing a group of games.');
  }
  function selectionScope(p) {
    const scope = selection.scope(p);
    return state.games.filter((g) => selection.matches(g, scope));
  }
  function applyTop(scope, ids) {
    for (const game of state.games) if (scope.has(game.id)) game.included = ids.has(game.id);
  }
  function startSelection(kind, work) {
    selectionController = new AbortController();
    const signal = selectionController.signal;
    selectionJob = { status: 'running', kind, processed: 0, total: 0, startedAt: Date.now() };
    const progress = (p) => {
      if (!signal.aborted) Object.assign(selectionJob, p);
    };
    selectionTask = Promise.resolve()
      .then(() => work(signal, progress))
      .then((result) => {
        selectionJob = {
          ...selectionJob,
          ...result,
          status: 'completed',
          finishedAt: Date.now(),
          current: null
        };
      })
      .catch((error) => {
        diagnostics?.record(signal.aborted ? 'info' : 'error', 'selection.failed', { kind, error });
        selectionJob = {
          ...selectionJob,
          status: signal.aborted ? 'cancelled' : 'error',
          error: safeError(error),
          finishedAt: Date.now(),
          current: null
        };
      })
      .finally(() => {
        selectionTask = null;
        selectionController = null;
      });
  }
  async function dispatch(action, p = {}) {
    await init;
    if (closed) throw new Error('Screensaver Manager is closed.');
    if (!p || typeof p !== 'object' || Array.isArray(p)) throw new Error('Invalid action payload.');
    if (action === 'state') return publicState();
    if (action === 'steamIdleState' || action === 'setSteamIdle') {
      if (!state.steam.roots.length) {
        const scan = await scanSteam(options.steamRoots);
        state.steam = { ...state.steam, detected: scan.detected, roots: scan.roots };
      }
      const root = state.steam.roots[0];
      if (!root) {
        if (action === 'setSteamIdle')
          throw new Error('Steam was not detected. Open Steam once, then rescan.');
        state.steam.idle = { available: false };
      } else {
        const idleOptions = { platform: options.platform, isRunning: options.isSteamRunning };
        if (action === 'setSteamIdle') {
          state.steam.idle = await steamIdle.writeTimeouts(root, p, idleOptions);
          diagnostics?.record('info', 'steam.idle_saved', {
            acSeconds: state.steam.idle.acSeconds,
            batterySeconds: state.steam.idle.batterySeconds,
            changed: state.steam.idle.changed,
            backedUp: state.steam.idle.backedUp
          });
        } else {
          try {
            state.steam.idle = await steamIdle.readTimeouts(root, idleOptions);
          } catch (error) {
            state.steam.idle = { available: false, error: safeError(error) };
          }
        }
      }
      return publicState();
    }
    if (action === 'diagnosticsEvent') {
      const event = [
        'renderer.error',
        'renderer.rejection',
        'player.media_error',
        'image.preview_error'
      ].includes(p.event)
        ? p.event
        : 'renderer.error';
      diagnostics?.record('error', event, {
        message: String(p.message || '').slice(0, 24000),
        stack: String(p.stack || '').slice(0, 24000),
        source: String(p.source || '').slice(0, 2000),
        line: Number(p.line) || null,
        gameId: String(p.gameId || '').slice(0, 100)
      });
      return { saved: !diagnostics?.failure };
    }
    if (action === 'cancelSelection') {
      selectionController?.abort(new Error('Selection cancelled. Previous choices preserved.'));
      if (selectionTask) await selectionTask;
      return publicState();
    }
    if (
      selectionTask &&
      [
        'scan',
        'importSteamLibrary',
        'add',
        'remove',
        'updateGame',
        'setIncluded',
        'selectLibraryTop',
        'importPopular',
        'prepare',
        'retry',
        'purgeMedia',
        'setCover',
        'setLogo',
        'repair',
        'clearUnused',
        'install',
        'uninstall'
      ].includes(action)
    )
      throw new Error('Wait for the Steam selection or cancel it first.');
    if (action === 'setIncluded') {
      selectionWritable();
      if (typeof p.included !== 'boolean') throw new Error('Invalid inclusion value.');
      const games = selectionScope(p);
      selectionJob = { status: 'idle' };
      for (const game of games) game.included = p.included;
      await save();
      return publicState();
    }
    if (action === 'selectLibraryTop') {
      selectionWritable();
      if (!['steam', 'playtime'].includes(p.criterion))
        throw new Error('Invalid popularity criterion.');
      const games = selectionScope(p).filter(selection.ownedGame);
      if (!games.length) throw new Error('No owned Steam games in this filtered list.');
      const scope = new Set(games.map((g) => g.id));
      if (p.criterion === 'playtime') {
        if (games.some((g) => !Number.isSafeInteger(g.playtimeMinutes)))
          throw new Error(
            'Import your Steam library again to retrieve playtimes for this selection.'
          );
        const chosen = selection.personal(games);
        applyTop(scope, new Set(chosen.map((g) => g.id)));
        selectionJob = {
          status: 'completed',
          kind: 'playtime',
          selected: chosen.length,
          finishedAt: Date.now()
        };
        await save();
      } else {
        startSelection('library', async (signal, onProgress) => {
          const ranks = await popularity.rank(games, { signal, onProgress });
          signal.throwIfAborted();
          const gameIds = new Set(games.map((g) => g.steamAppId));
          if (
            ranks.length !== games.length ||
            ranks.some((r) => !Number.isSafeInteger(r.players) || r.players < 0) ||
            new Set(ranks.map((r) => r.steamAppId)).size !== games.length ||
            ranks.some((r) => !gameIds.has(r.steamAppId))
          )
            throw new Error('Incomplete Steam popularity data. Previous choices preserved.');
          const ordered = [...ranks]
            .sort((a, b) => b.players - a.players || a.steamAppId - b.steamAppId)
            .slice(0, 100);
          applyTop(
            scope,
            new Set(
              games
                .filter((g) => ordered.some((r) => r.steamAppId === g.steamAppId))
                .map((g) => g.id)
            )
          );
          await save();
          return { selected: ordered.length };
        });
      }
      return publicState();
    }
    if (action === 'importPopular') {
      selectionWritable();
      startSelection('steam', async (signal, onProgress) => {
        const result = await popularity.top({ signal, onProgress });
        signal.throwIfAborted();
        if (
          !Array.isArray(result.games) ||
          !result.games.length ||
          result.games.length > 100 ||
          result.games.some(
            (g) =>
              !Number.isSafeInteger(g.steamAppId) || g.steamAppId < 1 || typeof g.name !== 'string'
          ) ||
          new Set(result.games.map((g) => g.steamAppId)).size !== result.games.length
        )
          throw new Error('Invalid Steam ranking. Nothing was imported.');
        const incoming = result.games.filter((g) => !isSteamComponent(g));
        if (!incoming.length) throw new Error('No games available in the Steam ranking.');
        for (const game of state.games) {
          game.sources = game.sources.filter((s) => s !== 'popular');
          delete game.popularRank;
        }
        let added = 0;
        for (const item of incoming) {
          const existing = state.games.find((g) => g.steamAppId === item.steamAppId);
          if (existing) {
            existing.sources = [...new Set([...existing.sources, 'popular'])];
            existing.popularRank = item.rank;
          } else {
            state.games.push(
              cleanGame({
                id: `steam:${item.steamAppId}`,
                steamAppId: item.steamAppId,
                name: item.name,
                popularRank: item.rank,
                sources: ['popular'],
                installed: false,
                included: false
              })
            );
            added++;
          }
        }
        await save();
        return { added, selected: incoming.length, rankedAt: result.rankedAt };
      });
      return publicState();
    }
    if (runner && state.job.status === 'completed') await runner;
    if (action === 'setSteamAccount') {
      const profile = String(p.profile ?? state.steamAccount.profile).trim();
      if (profile) parseProfile(profile);
      if (p.key !== undefined) {
        const next = String(p.key).trim();
        if (next && !/^[a-fA-F0-9]{32}$/.test(next))
          throw new Error('Enter a 32-character Steam Web API key.');
        if (next) await atomicWrite(steamKeyFile, next + '\n');
        else await fs.rm(steamKeyFile, { force: true });
        steamKey = next;
      }
      state.steamAccount.profile = profile;
      state.steamAccount.hasKey = !!steamKey;
      await save();
      return publicState();
    }
    if (action === 'importSteamLibrary') {
      if (runner) throw new Error('Pause preparation before importing your Steam library.');
      const result = await steamAccount.owned(state.steamAccount.profile, {
        signal: lifetime.signal
      });
      const owned = new Set(result.games.map((g) => g.steamAppId));
      for (const game of state.games)
        if (!owned.has(game.steamAppId)) game.sources = game.sources.filter((s) => s !== 'account');
      let added = 0;
      const byAppId = new Map(
        state.games.filter((g) => g.steamAppId).map((g) => [g.steamAppId, g])
      );
      for (const game of result.games.filter((g) => !isSteamComponent(g))) {
        const existing = byAppId.get(game.steamAppId);
        if (existing) {
          existing.sources = [...new Set([...existing.sources, 'account'])];
          if (Number.isSafeInteger(game.playtimeMinutes) && game.playtimeMinutes >= 0)
            existing.playtimeMinutes = game.playtimeMinutes;
        } else {
          state.games.push(
            cleanGame({
              ...game,
              id: `steam:${game.steamAppId}`,
              sources: ['account'],
              installed: false,
              included: false,
              status: 'new'
            })
          );
          added++;
        }
      }
      state.steamAccount = {
        ...state.steamAccount,
        steamId: result.steamId,
        lastImport: new Date().toISOString(),
        count: result.games.filter((g) => !isSteamComponent(g)).length,
        added
      };
      await save();
      return publicState();
    }
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
      if (purging || state.previewsPaused)
        throw new Error(
          'Media previews are paused. Search for artwork or prepare your library to download again.'
        );
      const previewSignal = AbortSignal.any([lifetime.signal, previewAbort.signal]);
      if (!media.preview) throw new Error('Image previews are unavailable.');
      let url = p.url;
      if (p.sgdbId || p.steamAppId) {
        const id = p.sgdbId
          ? positiveId(p.sgdbId)
          : (await sgdb.bySteam(positiveId(p.steamAppId), { signal: previewSignal }))?.sgdbId;
        if (!id) throw new Error('No SteamGridDB preview is available for this game.');
        const rows = sgdb.enrichThumbnails
          ? await sgdb.enrichThumbnails([{ sgdbId: id, thumb: null }], { signal: previewSignal })
          : [];
        url = rows[0]?.thumb;
        if (!url && sgdb.covers) {
          const covers = await sgdb.covers(id, { signal: previewSignal });
          url = covers[0]?.thumb || covers[0]?.url;
        }
        if (!url) throw new Error('No SteamGridDB preview is available for this game.');
      }
      if (previewSignal.aborted)
        throw Object.assign(new Error('Image preview cancelled.'), { name: 'AbortError' });
      return media.preview(
        { file: p.file, url },
        { signal: previewSignal, force: p.force === true }
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
      Object.assign(
        state.steam,
        scan.roots.length
          ? await installer.installationInfo(scan.roots[0])
          : { installed: false, signature: null }
      );
      await save();
      return publicState();
    }
    if (action === 'search') {
      let results = (await sgdb.search(p.query)).filter((g) => !isSteamComponent(g));
      if (sgdb.enrichThumbnails) results = await sgdb.enrichThumbnails(results);
      if (state.previewsPaused) {
        state.previewsPaused = false;
        await save();
      }
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
      if (isSteamComponent(metadata))
        throw new Error('Steam compatibility components are not games and cannot be added.');
      if (!metadata.thumb && sgdb.enrichThumbnails)
        metadata = (await sgdb.enrichThumbnails([metadata]))[0];
      let steamId = metadata.steamAppId;
      if (p.steamAppId) {
        const verified = await sgdb.bySteam(positiveId(p.steamAppId));
        if (verified?.sgdbId !== metadata.sgdbId)
          throw new Error('Steam AppID does not match this SteamGridDB game.');
        steamId = verified.steamAppId;
      }
      if (isSteamComponent({ ...metadata, steamAppId: steamId }))
        throw new Error('Steam compatibility components are not games and cannot be added.');
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
        for (const key of ['logo', 'selectedLogo', 'logoManualSelection', 'branding'])
          g[key] = g[key] || matches.find((m) => m[key])?.[key];
        if (g.playtimeMinutes === undefined)
          g.playtimeMinutes = matches.find((m) => m.playtimeMinutes !== undefined)?.playtimeMinutes;
        if (g.popularRank === undefined)
          g.popularRank = matches.find((m) => m.popularRank)?.popularRank;
        g.crop = g.crop || matches.find((m) => m.crop)?.crop;
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
    if (action === 'artworks') {
      const rows = await getArtworks(find(p.id));
      if (state.previewsPaused) {
        state.previewsPaused = false;
        await save();
      }
      return rows;
    }
    if (action === 'covers') {
      const g = find(p.id),
        rows = await sgdb.covers(await resolveGame(g));
      if (state.previewsPaused) {
        state.previewsPaused = false;
        await save();
      }
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
    if (action === 'logos') {
      const g = find(p.id),
        rows = await sgdb.logos(await resolveGame(g));
      if (state.previewsPaused) {
        state.previewsPaused = false;
        await save();
      }
      logoCache.set(g.id, rows);
      return rows;
    }
    if (action === 'setLogo') {
      const g = find(p.id);
      if (runner || state.job.current === g.id)
        throw new Error('Pause preparation before changing the current game.');
      const rows = logoCache.get(g.id) || (await sgdb.logos(await resolveGame(g)));
      const automatic = p.selectedLogo === null;
      const asset = automatic
        ? rows[0]
        : rows.find(
            (a) =>
              a.id === Number(p.selectedLogo?.id) &&
              (!p.selectedLogo.kind || p.selectedLogo.kind === a.kind)
          );
      if (!asset && !automatic)
        throw new Error('Choose a game logo from this game’s SteamGridDB gallery.');
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
          throw new Error('The game logo must be a valid still image.');
      }
      g.logo = prepared;
      g.selectedLogo = automatic ? null : asset;
      g.logoManualSelection = !automatic;
      delete g.logoError;
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
      const branding = 'branding' in p ? validateBranding(p.branding) : undefined;
      if (branding) g.branding = branding;
      const crop = 'crop' in p ? validateCrop(p.crop) : undefined;
      if (crop) g.crop = crop;
      if ('included' in p) {
        g.included = p.included;
        selectionJob = { status: 'idle' };
      }
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
      if (state.previewsPaused) {
        state.previewsPaused = false;
        await save();
      }
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
      if ('showLogos' in p && !('nameDisplay' in p))
        p = { ...p, nameDisplay: p.showLogos ? 'logo' : 'hidden' };
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
        for (const kind of ['cover', 'logo', 'smoothed'])
          if (g[kind] && !(await media.validate(g[kind]))) g[kind] = null;
      await refreshStorage();
      await save();
      return publicState();
    }
    if (action === 'purgeMedia') {
      if (p.confirm !== true) throw new Error('Confirm the complete media purge first.');
      purging = true;
      previewAbort.abort(new Error('Media purge in progress.'));
      try {
        if (runner || pending.length) await stop('paused');
        autoPaused = false;
        await Promise.allSettled([...previewTasks]);
        await media.waitForPreviews?.();
        const plan = await planPurge(dataDir);
        const scan = await scanSteam(options.steamRoots);
        const roots = new Set();
        for (const root of [...state.steam.roots, ...scan.roots]) {
          try {
            roots.add(await fs.realpath(root));
          } catch (error) {
            if (error.code !== 'ENOENT') throw error;
          }
        }
        const installer = require('./installer.cjs');
        for (const root of roots) await installer.assertCanUninstall(root);
        for (const root of roots) await installer.uninstall({ steamRoot: root });
        state.steam.installed = false;
        pending = [];
        state.job = newJob();
        state.previewsPaused = true;
        for (const game of state.games) {
          game.media = null;
          game.cover = null;
          game.logo = null;
          game.smoothed = null;
          game.status = 'new';
          delete game.error;
          delete game.coverError;
          delete game.logoError;
          delete game.smoothingError;
        }
        assetCache.clear();
        coverCache.clear();
        logoCache.clear();
        // Persist the reset before unlinking files, so interruption never leaves
        // missing files advertised as ready. Any interrupted deletion is retryable.
        await save();
        const removed = await applyPurge(plan);
        state.lastMediaPurge = { ...removed, at: new Date().toISOString() };
        await refreshStorage();
        await save();
        return publicState();
      } catch (error) {
        await refreshStorage().catch(() => {});
        await save().catch(() => {});
        throw error;
      } finally {
        previewAbort = new AbortController();
        purging = false;
      }
    }
    if (action === 'clearUnused') {
      if (runner) throw new Error('Pause preparation before clearing unused media.');
      const used = new Set();
      for (const g of state.games)
        for (const m of [g.media, g.cover, g.logo, g.smoothed].filter(Boolean))
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
            for (const [name, owner] of [
              ['.screensaver-smoothing-work', 'steam-animated-screensaver-v1'],
              ['.cinema-smoothing-work', 'steamos-animated-screensaver-v1']
            ]) {
              const filename = path.join(work, name);
              const marker = await fs.lstat(filename).catch(() => null);
              if (
                marker?.isFile() &&
                !marker.isSymbolicLink() &&
                marker.size === owner.length &&
                (await fs.readFile(filename, 'utf8')) === owner
              ) {
                await fs.rm(work, { recursive: true });
                break;
              }
            }
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
        if (runner) throw new Error('Finish or cancel preparation before installing in Steam.');
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
      Object.assign(state.steam, await installer.installationInfo(root));
      await save();
      return publicState();
    }
    throw new Error('Unknown application action.');
  }
  return {
    invoke(action, payload = {}) {
      if (['setKey', 'setSteamAccount'].includes(action)) diagnostics?.addSecret(payload?.key);
      const logged = (result) =>
        result.catch((error) => {
          diagnostics?.record('error', 'core.action_failed', { action, error });
          throw error;
        });
      if (action === 'state') return logged(dispatch(action, payload));
      if (action !== 'previewImage' && action !== 'diagnosticsEvent')
        diagnostics?.record('info', 'core.action', { action, gameId: payload?.id });
      if (action === 'previewImage') {
        const result = logged(dispatch(action, payload));
        previewTasks.add(result);
        result.then(
          () => previewTasks.delete(result),
          () => previewTasks.delete(result)
        );
        return result;
      }
      const result = logged(actions.then(() => dispatch(action, payload)));
      actions = result.catch(() => {});
      return result;
    },
    async close() {
      if (closed) return;
      clearInterval(monitor);
      await init;
      closed = true;
      lifetime.abort(new Error('Manager closed.'));
      selectionController?.abort(new Error('Manager closed.'));
      if (selectionTask) await selectionTask;
      previewAbort.abort(new Error('Manager closed.'));
      controller?.abort(new Error('Manager closed.'));
      await actions;
      await media.waitForPreviews?.();
      if (runner) await runner;
      if (state.job.status === 'running') state.job.status = 'paused';
      state.job.current = null;
      await save();
      await writes;
      diagnostics?.record('info', 'core.closed');
      if (!options.diagnostics) diagnostics?.close();
      await releaseLock?.();
    }
  };
}
module.exports = { createCore, validateSettings, cleanGame, validateCrop };
