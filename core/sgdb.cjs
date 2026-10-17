'use strict';
const API = 'https://www.steamgriddb.com/api/v2';
const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason || new Error('Cancelled'));
    const t = setTimeout(done, ms);
    function done() {
      signal?.removeEventListener('abort', abort);
      resolve();
    }
    function abort() {
      clearTimeout(t);
      reject(signal.reason || new Error('Cancelled'));
    }
    signal?.addEventListener('abort', abort, { once: true });
  });
function positiveId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1)
    throw new Error('A positive numeric game ID is required.');
  return id;
}
function cdnUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' &&
      !u.username &&
      !u.password &&
      (u.hostname === 'cdn2.steamgriddb.com' || u.hostname === 'cdn.steamgriddb.com') &&
      !u.port &&
      !u.hash
      ? u.href
      : null;
  } catch {
    return null;
  }
}
function normalizeAsset(raw, kind, animated) {
  const url = cdnUrl(raw.url);
  if (!url || !Number.isSafeInteger(Number(raw.id)) || Number(raw.id) < 1) return null;
  const width = Number(raw.width) || 0,
    height = Number(raw.height) || 0;
  return {
    id: Number(raw.id),
    url,
    thumb: cdnUrl(raw.thumb),
    width,
    height,
    score: Number(raw.score) || 0,
    kind,
    animated,
    author: {
      name: String(raw.author?.name || 'Unknown').slice(0, 200),
      ...(raw.author?.steam64 ? { steam64: String(raw.author.steam64) } : {})
    },
    mime: typeof raw.mime === 'string' ? raw.mime : undefined
  };
}
function rankAssets(assets) {
  return assets
    .map((asset) => {
      const ratio = asset.width && asset.height ? asset.width / asset.height : 0;
      const landscape = ratio >= 1.3;
      const reasons = [
        asset.animated ? 'Genuine animated asset' : 'Optional static fallback',
        asset.kind === 'hero' ? 'Panoramic hero' : 'Grid composition',
        landscape ? 'Landscape composition' : 'Portrait requires framed composition'
      ];
      const aspect = ratio > 0 ? Math.max(0, 20 - Math.abs(Math.log(ratio / (16 / 9))) * 15) : 0;
      const resolution = Math.min(
        20,
        Math.log2(Math.max(1, asset.width * asset.height) / 100000 + 1) * 5
      );
      const votes = Math.min(15, Math.max(0, Math.log2(Math.max(0, asset.score) + 1) * 2));
      const rank =
        (asset.animated ? 1000 : 0) +
        (asset.kind === 'hero' ? 150 : 0) +
        (landscape ? 50 : 0) +
        aspect +
        resolution +
        votes;
      return { ...asset, rank: Math.round(rank * 100) / 100, reasons };
    })
    .sort((a, b) => b.rank - a.rank || a.kind.localeCompare(b.kind) || a.id - b.id);
}
function createSGDB({
  getKey,
  fetchImpl = globalThis.fetch,
  minInterval = 220,
  signal: defaultSignal
} = {}) {
  let last = 0;
  let serial = Promise.resolve();
  const thumbnailCache = new Map();
  async function request(endpoint, { signal, notFoundEmpty = false } = {}) {
    if (defaultSignal) signal = signal ? AbortSignal.any([signal, defaultSignal]) : defaultSignal;
    const key = await getKey();
    if (!key) throw new Error('Add your personal SteamGridDB API key in Settings.');
    const run = async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        const delay = Math.max(0, last + minInterval - Date.now());
        if (delay) await sleep(delay, signal);
        last = Date.now();
        const timeout = AbortSignal.timeout(20000);
        const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
        let response;
        try {
          response = await fetchImpl(API + endpoint, {
            headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
            signal: combined,
            redirect: 'error'
          });
        } catch (e) {
          if (signal?.aborted) throw e;
          throw new Error('Could not connect to SteamGridDB. Check your connection and retry.');
        }
        if (response.status === 401 || response.status === 403)
          throw new Error('SteamGridDB rejected the API key. Check your personal key in Settings.');
        if (response.status === 404 && notFoundEmpty) return null;
        if (response.status === 429) {
          const raw = response.headers.get('retry-after');
          const seconds = /^\d+$/.test(raw || '')
            ? Number(raw)
            : Math.max(1, Math.ceil((Date.parse(raw) - Date.now()) / 1000) || 2 ** attempt);
          await response.body?.cancel().catch(() => {});
          if (attempt === 2 || seconds > 30)
            throw new Error(`SteamGridDB rate limit reached. Retry in ${seconds} seconds.`);
          await sleep(Math.max(1, seconds) * 1000, signal);
          continue;
        }
        if (!response.ok)
          throw new Error(`SteamGridDB returned HTTP ${response.status}. Retry later.`);
        const length = Number(response.headers.get('content-length'));
        if (length > 8 * 1024 * 1024) {
          await response.body?.cancel();
          throw new Error('SteamGridDB response exceeded the size limit.');
        }
        let text = '';
        const reader = response.body?.getReader();
        if (reader) {
          const chunks = [];
          let size = 0;
          try {
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              size += value.byteLength;
              if (size > 8 * 1024 * 1024)
                throw new Error('SteamGridDB response exceeded the size limit.');
              chunks.push(Buffer.from(value));
            }
            text = Buffer.concat(chunks).toString('utf8');
          } finally {
            await reader.cancel().catch(() => {});
          }
        } else text = await response.text();
        let body;
        try {
          body = JSON.parse(text);
        } catch {
          throw new Error('SteamGridDB sent an invalid response.');
        }
        if (!body.success) throw new Error('SteamGridDB could not complete this request.');
        return body.data;
      }
    };
    // A single request lane avoids bursts and makes Retry-After apply globally.
    const result = serial.then(run, run);
    serial = result.catch(() => {});
    return result;
  }
  function gameResult(game, steamAppId = null) {
    if (!game || !Number.isSafeInteger(Number(game.id)) || Number(game.id) < 1 || !game.name)
      throw new Error('SteamGridDB returned invalid game metadata.');
    const platform = game.platforms?.steam;
    const mapped = Array.isArray(platform) ? Number(platform[0]?.id) : Number(platform?.id);
    return {
      sgdbId: Number(game.id),
      steamAppId: steamAppId || (Number.isSafeInteger(mapped) && mapped > 0 ? mapped : null),
      name: String(game.name).slice(0, 300),
      thumb: cdnUrl(game.thumb)
    };
  }
  return {
    request,
    async validateKey() {
      await request('/search/autocomplete/Portal');
      return { valid: true };
    },
    async game(sgdbId, options = {}) {
      const raw = await request(`/games/id/${positiveId(sgdbId)}?platformdata=steam`, options);
      if (!raw) return null;
      const game = gameResult(raw);
      if (game.steamAppId) {
        const verified = await this.bySteam(game.steamAppId, options);
        if (verified?.sgdbId !== game.sgdbId) game.steamAppId = null;
      }
      return game;
    },
    async enrichThumbnails(games, { signal } = {}) {
      const enriched = games.map((g) => ({ ...g }));
      for (const game of enriched.slice(0, 8)) {
        if (game.thumb) continue;
        const cached = thumbnailCache.get(game.sgdbId);
        if (cached && Date.now() - cached.time < 600000) {
          game.thumb = cached.thumb;
          continue;
        }
        let thumb = null;
        try {
          for (const type of ['animated', 'static']) {
            const rows = await request(
              `/heroes/game/${positiveId(game.sgdbId)}?types=${type}&nsfw=false&humor=false&epilepsy=false&limit=50&page=0`,
              { signal, notFoundEmpty: true }
            );
            if (Array.isArray(rows))
              thumb = rows.map((row) => cdnUrl(row.thumb)).find(Boolean) || null;
            if (thumb) break;
          }
        } catch (error) {
          if (signal?.aborted) throw error;
          break;
        }
        game.thumb = thumb;
        thumbnailCache.set(game.sgdbId, { thumb, time: Date.now() });
        if (thumbnailCache.size > 128) thumbnailCache.delete(thumbnailCache.keys().next().value);
      }
      return enriched;
    },
    async bySteam(steamAppId, options = {}) {
      const id = positiveId(steamAppId);
      const g = await request(`/games/steam/${id}`, { ...options, notFoundEmpty: true });
      return g ? gameResult(g, id) : null;
    },
    async search(query, options = {}) {
      query = String(query || '').trim();
      if (!query || query.length > 200)
        throw new Error('Enter a game name, Steam AppID or Steam Store URL.');
      if (/^\d+$/.test(query)) {
        const game = await this.bySteam(query, options);
        return game ? [game] : [];
      }
      if (/^https?:\/\//i.test(query)) {
        let u;
        try {
          u = new URL(query);
        } catch {
          throw new Error('Invalid Steam Store URL.');
        }
        const match = u.pathname.match(/^\/app\/(\d+)(?:\/|$)/);
        if (u.hostname !== 'store.steampowered.com' || !match)
          throw new Error('Use a Steam Store URL containing /app/AppID/.');
        const game = await this.bySteam(match[1], options);
        return game ? [game] : [];
      }
      const games = await request(`/search/autocomplete/${encodeURIComponent(query)}`, options);
      return (Array.isArray(games) ? games : []).slice(0, 30).map((g) => gameResult(g));
    },
    async logos(sgdbId, { signal } = {}) {
      const rows = await request(
        `/logos/game/${positiveId(sgdbId)}?types=static&nsfw=false&humor=false&epilepsy=false&limit=50&page=0`,
        { signal, notFoundEmpty: true }
      );
      return (Array.isArray(rows) ? rows : [])
        .map((raw) => normalizeAsset(raw, 'logo', false))
        .filter((asset) => asset && asset.width > 0 && asset.height > 0)
        .sort(
          (a, b) => b.score - a.score || b.width * b.height - a.width * a.height || a.id - b.id
        );
    },
    async covers(sgdbId, { signal } = {}) {
      const rows = await request(
        `/grids/game/${positiveId(sgdbId)}?types=static&dimensions=600x900,342x482&nsfw=false&humor=false&epilepsy=false&limit=50&page=0`,
        { signal, notFoundEmpty: true }
      );
      return (Array.isArray(rows) ? rows : [])
        .map((raw) => normalizeAsset(raw, 'grid', false))
        .filter((asset) => asset && asset.width > 0 && asset.height > asset.width)
        .sort(
          (a, b) => b.score - a.score || b.width * b.height - a.width * a.height || a.id - b.id
        );
    },
    async artworks(sgdbId, { staticFallback = false, signal } = {}) {
      const id = positiveId(sgdbId);
      const assets = [];
      for (const [kind, endpoint] of [
        ['hero', 'heroes'],
        ['grid', 'grids']
      ]) {
        for (const animated of staticFallback ? [true, false] : [true]) {
          for (let page = 0; page < 2; page++) {
            const rows = await request(
              `/${endpoint}/game/${id}?types=${animated ? 'animated' : 'static'}&nsfw=false&humor=false&epilepsy=false&limit=50&page=${page}`,
              { signal, notFoundEmpty: true }
            );
            if (!Array.isArray(rows)) break;
            for (const row of rows) {
              const asset = normalizeAsset(row, kind, animated);
              if (asset) assets.push(asset);
            }
            if (rows.length < 50) break;
          }
        }
      }
      return rankAssets([...new Map(assets.map((a) => [`${a.kind}:${a.id}`, a])).values()]);
    }
  };
}
module.exports = { createSGDB, rankAssets, normalizeAsset, cdnUrl, positiveId };
