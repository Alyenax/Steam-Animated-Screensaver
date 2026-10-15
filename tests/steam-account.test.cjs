'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { parseProfile, createSteamAccount } = require('../core/steam-account.cjs');
const { createCore } = require('../core/index.cjs');
const steamId = '76561198000000000',
  key = '0123456789abcdef'.repeat(2);

test('Steam profile parsing accepts IDs and exact official profile links only', () => {
  assert.deepEqual(parseProfile(steamId), { steamId });
  assert.deepEqual(parseProfile(`https://steamcommunity.com/profiles/${steamId}/`), { steamId });
  assert.deepEqual(parseProfile('https://steamcommunity.com/id/test-user'), {
    vanity: 'test-user'
  });
  for (const url of [
    'file:///tmp/key',
    'https://steamcommunity.com.evil.test/id/user',
    'https://user:pass@steamcommunity.com/id/user',
    'http://steamcommunity.com/id/user',
    'https://steamcommunity.com/id/user?x=1',
    '620'
  ])
    assert.throws(() => parseProfile(url));
});
test('Steam owned games resolves vanity, includes played free games and keeps credentials out of results', async () => {
  const seen = [];
  const api = createSteamAccount({
    getKey: () => key,
    fetchImpl: async (url, opts) => {
      seen.push(url);
      assert.equal(opts.redirect, 'error');
      return new Response(
        JSON.stringify({
          response: url.pathname.includes('ResolveVanityURL')
            ? { success: 1, steamid: steamId }
            : { game_count: 1, games: [{ appid: 620, name: 'Portail éé' }] }
        })
      );
    }
  });
  const out = await api.owned('https://steamcommunity.com/id/test-user');
  assert.equal(out.steamId, steamId);
  assert.equal(out.games[0].steamAppId, 620);
  assert.equal(out.games[0].name, 'Portail éé');
  assert.equal(seen.length, 2);
  assert.equal(seen[1].hostname, 'api.steampowered.com');
  assert.equal(seen[1].searchParams.get('include_played_free_games'), '1');
  assert.equal(JSON.stringify(out).includes(key), false);
});
test('Steam privacy, bad keys, incomplete responses and key-bearing network failures are explicit', async () => {
  for (const [response, pattern] of [
    [new Response(JSON.stringify({ response: {} })), /privacy/],
    [new Response('', { status: 403 }), /key/],
    [
      new Response(
        JSON.stringify({ response: { game_count: 2, games: [{ appid: 1, name: 'A' }] } })
      ),
      /incomplete/
    ]
  ]) {
    const api = createSteamAccount({ getKey: () => key, fetchImpl: async () => response });
    await assert.rejects(api.owned(steamId), pattern);
  }
  const api = createSteamAccount({
    getKey: () => key,
    fetchImpl: async () => {
      throw new Error(`failed https://api.steampowered.com/?key=${key}`);
    }
  });
  await assert.rejects(
    api.owned(steamId),
    (error) => !error.message.includes(key) && !error.message.includes('https://')
  );
});
test('account import merges installed games, preserves choices, stores key separately and survives offline restart', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sas-account-'));
  const dataDir = path.join(dir, 'data'),
    steamRoot = path.join(dir, 'steam');
  await fs.mkdir(path.join(steamRoot, 'steamapps'), { recursive: true });
  await fs.writeFile(
    path.join(steamRoot, 'steamapps', 'appmanifest_620.acf'),
    '"AppState" { "appid" "620" "name" "Portal 2" "StateFlags" "4" }'
  );
  let fail = false;
  const provider = {
    owned: async () => {
      if (fail) throw new Error('Steam unavailable');
      return {
        steamId,
        games: [
          { steamAppId: 620, name: 'Portal 2' },
          { steamAppId: 10, name: 'Not installed' }
        ]
      };
    }
  };
  const core = createCore({
    dataDir,
    steamRoots: [steamRoot],
    steamAccount: provider,
    isGameRunning: async () => false
  });
  t.after(async () => {
    await core.close();
    await fs.rm(dir, { recursive: true, force: true });
  });
  await core.invoke('scan');
  await core.invoke('updateGame', { id: 'steam:620', included: false });
  await core.invoke('setSteamAccount', { profile: steamId, key });
  let state = await core.invoke('importSteamLibrary');
  assert.equal(state.games.length, 2);
  assert.equal(state.games.find((g) => g.steamAppId === 620).installed, true);
  assert.equal(state.games.find((g) => g.steamAppId === 620).included, false);
  assert.deepEqual(state.games.find((g) => g.steamAppId === 10).sources, ['account']);
  assert.equal(state.games.find((g) => g.steamAppId === 10).included, false);
  state = await core.invoke('importSteamLibrary');
  assert.equal(state.games.length, 2);
  assert.equal(state.steamAccount.added, 0);
  assert.equal(JSON.stringify(state).includes(key), false);
  assert.equal((await fs.stat(path.join(dataDir, 'steam-api.key'))).mode & 0o777, 0o600);
  assert.equal(
    (await fs.readFile(path.join(dataDir, 'catalog.json'), 'utf8')).includes(key),
    false
  );
  fail = true;
  await assert.rejects(core.invoke('importSteamLibrary'), /unavailable/);
  assert.equal((await core.invoke('state')).games.length, 2);
  await core.close();
  const reopened = createCore({ dataDir, steamRoots: [steamRoot], steamAccount: provider });
  try {
    state = await reopened.invoke('state');
    assert.equal(state.games.length, 2);
    assert.equal(state.steamAccount.hasKey, true);
    await reopened.invoke('setSteamAccount', { key: '' });
    await assert.rejects(fs.stat(path.join(dataDir, 'steam-api.key')), { code: 'ENOENT' });
  } finally {
    await reopened.close();
  }
});
