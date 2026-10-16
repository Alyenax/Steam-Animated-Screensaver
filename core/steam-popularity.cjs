'use strict';
const fs = require('node:fs/promises');
const { constants } = require('node:fs');
const path = require('node:path');
const { atomicWrite } = require('./store.cjs');
const { isSteamComponent } = require('./steam-components.cjs');
const TTL = 30 * 60 * 1000;
function createPopularity({ dataDir, fetchImpl = fetch, now = Date.now } = {}) {
  const cacheFile = path.join(dataDir, 'steam-popularity.json');
  let cache = {},
    initialized = false;
  async function init() {
    if (initialized) return;
    initialized = true;
    let file;
    try {
      file = await fs.open(cacheFile, constants.O_RDONLY | constants.O_NOFOLLOW);
      if ((await file.stat()).size > 8 * 1024 * 1024) return;
      const saved = JSON.parse(await file.readFile('utf8'));
      for (const [id, v] of Object.entries(saved.counts || {}).slice(0, 20000))
        if (
          /^[1-9]\d*$/.test(id) &&
          Number.isSafeInteger(v?.players) &&
          v.players >= 0 &&
          Number.isFinite(v.at) &&
          now() - v.at < TTL &&
          v.at <= now()
        )
          cache[id] = v;
    } catch {
    } finally {
      await file?.close();
    }
  }
  async function request(endpoint, params, signal) {
    signal?.throwIfAborted();
    try {
      const url = new URL(`https://api.steampowered.com/${endpoint}/v1/`);
      url.search = new URLSearchParams(params || '').toString();
      const response = await fetchImpl(url, {
        redirect: 'error',
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
          : AbortSignal.timeout(15000)
      });
      if (!response.ok)
        throw new Error(
          response.status === 429
            ? 'Steam is rate limiting requests. Try again later.'
            : `Steam returned HTTP ${response.status}.`
        );
      if (Number(response.headers?.get('content-length')) > 8 * 1024 * 1024)
        throw new Error('Steam ranking response too large.');
      let bytes = 0;
      const chunks = [];
      for await (const chunk of response.body) {
        bytes += chunk.length;
        if (bytes > 8 * 1024 * 1024) throw new Error('Steam ranking response too large.');
        chunks.push(Buffer.from(chunk));
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8')).response;
    } catch (error) {
      signal?.throwIfAborted();
      if (/^Steam (returned HTTP|is rate limiting|ranking response)/.test(error.message))
        throw error;
      throw new Error(
        'Steam popularity is unavailable. Your selection has not changed. Try again later.'
      );
    }
  }
  const flush = () => atomicWrite(cacheFile, JSON.stringify({ version: 1, counts: cache }));
  return {
    async rank(games, { signal, onProgress } = {}) {
      await init();
      const rows = new Array(games.length),
        abort = new AbortController();
      const combined = signal ? AbortSignal.any([signal, abort.signal]) : abort.signal;
      let next = 0,
        processed = 0,
        firstError;
      try {
        await Promise.all(
          Array.from({ length: Math.min(4, games.length) }, async () => {
            while (next < games.length && !combined.aborted) {
              const index = next++,
                game = games[index];
              try {
                let value = cache[game.steamAppId];
                if (!value || now() - value.at >= TTL || value.at > now()) {
                  const response = await request(
                    'ISteamUserStats/GetNumberOfCurrentPlayers',
                    { appid: String(game.steamAppId) },
                    combined
                  );
                  if (
                    response?.result !== 1 ||
                    !Number.isSafeInteger(response.player_count) ||
                    response.player_count < 0
                  )
                    throw new Error(
                      'Steam did not expose a player count. Your selection has not changed.'
                    );
                  value = { players: response.player_count, at: now() };
                  cache[game.steamAppId] = value;
                }
                rows[index] = { steamAppId: game.steamAppId, players: value.players, at: value.at };
                onProgress?.({ processed: ++processed, total: games.length, current: game.name });
              } catch (error) {
                firstError ||= error;
                abort.abort(error);
              }
            }
          })
        );
        signal?.throwIfAborted();
        if (firstError) throw firstError;
        return rows.sort((a, b) => b.players - a.players || a.steamAppId - b.steamAppId);
      } finally {
        await flush();
      }
    },
    async top({ signal, onProgress } = {}) {
      await init();
      onProgress?.({ processed: 0, total: 2 });
      const response = await request('ISteamChartsService/GetGamesByConcurrentPlayers', {}, signal);
      if (!Array.isArray(response?.ranks) || !response.ranks.length || response.ranks.length > 1000)
        throw new Error('Steam returned an invalid current ranking.');
      const upstreamCount = Math.min(response.ranks.length, 100);
      const ranks = response.ranks
        .slice(0, 100)
        .filter((r) => !isSteamComponent({ steamAppId: r.appid }));
      const ids = new Set();
      for (const r of ranks) {
        if (
          !Number.isSafeInteger(r.appid) ||
          r.appid < 1 ||
          ids.has(r.appid) ||
          !Number.isSafeInteger(r.concurrent_in_game) ||
          r.concurrent_in_game < 0
        )
          throw new Error('Steam returned an invalid current ranking.');
        ids.add(r.appid);
      }
      onProgress?.({ processed: 1, total: 2 });
      const items = await request(
        'IStoreBrowseService/GetItems',
        {
          input_json: JSON.stringify({
            ids: [...ids].map((appid) => ({ appid })),
            context: { language: 'english', country_code: 'US' },
            data_request: { include_basic_info: true }
          })
        },
        signal
      );
      if (!Array.isArray(items?.store_items)) throw new Error('Steam game names are unavailable.');
      const byId = new Map(items.store_items.map((g) => [g.appid || g.id, g]));
      const games = [];
      for (const r of ranks) {
        const item = byId.get(r.appid);
        if (!item)
          throw new Error('Steam returned incomplete game metadata. Nothing was imported.');
        // Store type 0 is a game; type 6 is software (e.g. Wallpaper Engine).
        if (
          item.success !== 1 ||
          item.type !== 0 ||
          isSteamComponent({ steamAppId: r.appid, name: item.name })
        )
          continue;
        if (typeof item.name !== 'string' || !item.name.trim())
          throw new Error('Steam returned an unnamed game.');
        cache[r.appid] = { players: r.concurrent_in_game, at: now() };
        games.push({
          steamAppId: r.appid,
          name: item.name.trim().slice(0, 300),
          players: r.concurrent_in_game,
          rank: r.rank
        });
      }
      if (!games.length) throw new Error('No games were available in the Steam ranking.');
      await flush();
      onProgress?.({ processed: 2, total: 2 });
      return {
        games,
        rankedAt: new Date(
          Number.isFinite(response.last_update) ? response.last_update * 1000 : now()
        ).toISOString(),
        upstreamCount
      };
    }
  };
}
module.exports = { createPopularity, TTL };
