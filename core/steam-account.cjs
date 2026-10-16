'use strict';
function parseProfile(value) {
  const text = String(value || '').trim();
  if (/^7656119\d{10}$/.test(text)) return { steamId: text };
  let url;
  try {
    url = new URL(text);
  } catch {
    throw new Error('Enter your SteamID64 or Steam Community profile URL.');
  }
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'steamcommunity.com' ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error('Enter an HTTPS steamcommunity.com profile URL.');
  const match = /^\/(profiles|id)\/([A-Za-z0-9_-]{1,100})\/?$/.exec(url.pathname);
  if (!match || (match[1] === 'profiles' && !/^7656119\d{10}$/.test(match[2])))
    throw new Error('Enter a valid Steam Community profile URL.');
  return match[1] === 'profiles' ? { steamId: match[2] } : { vanity: match[2] };
}
function createSteamAccount({ getKey, fetchImpl = fetch } = {}) {
  async function request(endpoint, params, signal) {
    const key = getKey();
    if (!key) throw new Error('Save your personal Steam Web API key in Settings first.');
    const url = new URL(`https://api.steampowered.com/${endpoint}/v1/`);
    url.search = new URLSearchParams({ ...params, key }).toString();
    try {
      const response = await fetchImpl(url, {
        redirect: 'error',
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(30000)])
          : AbortSignal.timeout(30000)
      });
      if (!response.ok)
        throw new Error(
          response.status === 401 || response.status === 403
            ? 'Steam rejected this API key. Check your personal Steam Web API key.'
            : `Steam returned HTTP ${response.status}. Try again later.`
        );
      if (Number(response.headers?.get('content-length')) > 8 * 1024 * 1024)
        throw new Error('Steam returned an oversized library.');
      const chunks = [];
      let size = 0;
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > 8 * 1024 * 1024) throw new Error('Steam returned an oversized library.');
        chunks.push(Buffer.from(chunk));
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8')).response;
    } catch (error) {
      if (signal?.aborted)
        throw Object.assign(new Error('Steam library import cancelled.'), { name: 'AbortError' });
      const message = String(error.message)
        .split(key)
        .join('[redacted]')
        .replace(/https?:\/\/\S+/g, '[URL]');
      throw new Error(message.slice(0, 300));
    }
  }
  return {
    async owned(profile, { signal } = {}) {
      const parsed = parseProfile(profile);
      const steamId =
        parsed.steamId ||
        (await request('ISteamUser/ResolveVanityURL', { vanityurl: parsed.vanity }, signal))
          ?.steamid;
      if (!/^7656119\d{10}$/.test(steamId || '')) throw new Error('Steam profile was not found.');
      const response = await request(
        'IPlayerService/GetOwnedGames',
        { steamid: steamId, include_appinfo: '1', include_played_free_games: '1' },
        signal
      );
      if (
        !response ||
        !Number.isSafeInteger(response.game_count) ||
        (!Array.isArray(response.games) && response.game_count !== 0)
      )
        throw new Error(
          'Steam did not expose this library. Check your profile’s Game details privacy settings.'
        );
      const games = new Map();
      for (const game of response.games || []) {
        if (
          Number.isSafeInteger(game.appid) &&
          game.appid > 0 &&
          typeof game.name === 'string' &&
          game.name.trim()
        )
          games.set(game.appid, {
            steamAppId: game.appid,
            name: game.name.trim().slice(0, 300),
            ...(Number.isSafeInteger(game.playtime_forever) && game.playtime_forever >= 0
              ? { playtimeMinutes: game.playtime_forever }
              : {})
          });
      }
      if (games.size !== response.game_count)
        throw new Error('Steam returned an incomplete library. Try again later.');
      return { steamId, games: [...games.values()] };
    }
  };
}
module.exports = { parseProfile, createSteamAccount };
