'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createCore } = require('../core/index.cjs');
const { createPopularity, TTL } = require('../core/steam-popularity.cjs');
async function fixture(t, options = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sas-selection-'));
  const games = Array.from({ length: 125 }, (_, i) => ({
    id: `steam:${i + 1}`,
    steamAppId: i + 1,
    name: `Game ${String(i + 1).padStart(3, '0')}`,
    included: i % 2 === 0,
    installed: i % 2 === 0,
    sources: ['account'],
    playtimeMinutes: i,
    crop: { mode: '16:10', x: 10, y: 80 }
  }));
  games.push({
    id: 'sgdb:999',
    sgdbId: 999,
    name: 'Manual only',
    included: true,
    sources: ['manual']
  });
  await fs.writeFile(path.join(root, 'catalog.json'), JSON.stringify({ version: 1, games }));
  const config = {
    dataDir: root,
    steamRoots: [],
    popularity: {
      rank: async (games, { onProgress }) => {
        onProgress({ processed: games.length, total: games.length });
        return games.map((g) => ({ steamAppId: g.steamAppId, players: 10000 - g.steamAppId }));
      },
      top: async () => ({
        games: [
          { steamAppId: 1, name: 'Game 001', rank: 1 },
          { steamAppId: 900, name: 'Global game', rank: 2 }
        ],
        rankedAt: '2026-10-16T10:00:00Z'
      })
    },
    ...options
  };
  let core = createCore(config);
  t.after(async () => {
    await core.close();
    await fs.rm(root, { recursive: true, force: true });
  });
  return {
    root,
    get core() {
      return core;
    },
    restart: async () => {
      await core.close();
      core = createCore(config);
      return core.invoke('state');
    }
  };
}
async function done(core) {
  const deadline = Date.now() + 3000;
  do {
    const state = await core.invoke('state');
    if (state.selectionJob.status !== 'running') return state;
    await new Promise((r) => setTimeout(r, 5));
  } while (Date.now() < deadline);
  assert.fail('Selection did not finish');
}
test('bulk inclusion follows search and filter atomically, preserving other games and artwork preferences', async (t) => {
  const x = await fixture(t),
    before = await x.core.invoke('state');
  await x.core.invoke('setIncluded', {
    filter: 'notInstalledFilter',
    query: 'Game 0',
    included: true
  });
  let state = await x.core.invoke('state');
  for (const game of state.games) {
    const old = before.games.find((g) => g.id === game.id);
    assert.equal(
      game.included,
      !game.installed && game.name.includes('Game 0') ? true : old.included
    );
    assert.deepEqual(game.crop, old.crop);
  }
  await assert.rejects(x.core.invoke('setIncluded', { included: 'yes' }), /inclusion/);
  await assert.rejects(
    x.core.invoke('setIncluded', { filter: 'invalid', included: true }),
    /filter/
  );
  await x.core.invoke('setIncluded', { filter: 'notInstalledFilter', included: false });
  state = await x.restart();
  assert(state.games.filter((g) => !g.installed).every((g) => !g.included));
});
test('personal and global popularity criteria pick different exact sets of 100 owned games and survive restart', async (t) => {
  const x = await fixture(t);
  await x.core.invoke('selectLibraryTop', { criterion: 'playtime' });
  let state = await x.core.invoke('state');
  assert.equal(state.games.filter((g) => g.steamAppId && g.included).length, 100);
  assert.equal(state.games.find((g) => g.steamAppId === 1).included, false);
  assert.equal(state.games.find((g) => g.steamAppId === 125).included, true);
  assert.equal(state.games.find((g) => g.id === 'sgdb:999').included, true);
  await x.core.invoke('selectLibraryTop', { criterion: 'steam' });
  state = await done(x.core);
  assert.equal(state.selectionJob.status, 'completed');
  assert.equal(state.selectionJob.processed, 125);
  assert(state.games.filter((g) => g.steamAppId).every((g) => g.included === g.steamAppId <= 100));
  state = await x.restart();
  assert.equal(state.games.find((g) => g.steamAppId === 125).playtimeMinutes, 124);
  assert.equal(state.games.find((g) => g.id === 'sgdb:999').included, true);
});
test('unknown playtimes, partial popularity and cancellation preserve all previous inclusion choices', async (t) => {
  let behavior = 'partial';
  const x = await fixture(t, {
    popularity: {
      rank: async (games, { signal, onProgress }) => {
        if (behavior === 'partial') return [{ steamAppId: 1, players: 100 }];
        onProgress({ processed: 1, total: games.length });
        await new Promise((resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason), { once: true });
        });
      }
    }
  });
  const before = (await x.core.invoke('state')).games.map((g) => g.included);
  await x.core.invoke('selectLibraryTop', { criterion: 'steam' });
  assert.equal((await done(x.core)).selectionJob.status, 'error');
  behavior = 'wait';
  await x.core.invoke('selectLibraryTop', { criterion: 'steam' });
  await new Promise((r) => setTimeout(r, 5));
  await assert.rejects(x.core.invoke('setIncluded', { included: true }), /cancel/);
  const cancelled = await x.core.invoke('cancelSelection');
  assert.equal(cancelled.selectionJob.status, 'cancelled');
  assert.deepEqual(
    cancelled.games.map((g) => g.included),
    before
  );
  await assert.rejects(x.core.invoke('selectLibraryTop', { criterion: 'random' }), /criterion/);
});
test('missing personal playtime refuses ranking without changing selection', async (t) => {
  const x = await fixture(t);
  await x.core.close();
  const saved = JSON.parse(await fs.readFile(path.join(x.root, 'catalog.json'), 'utf8'));
  delete saved.games[0].playtimeMinutes;
  await fs.writeFile(path.join(x.root, 'catalog.json'), JSON.stringify(saved));
  const state = await x.restart();
  await assert.rejects(
    x.core.invoke('selectLibraryTop', { criterion: 'playtime' }),
    /playtime|import/i
  );
  assert.deepEqual(
    (await x.core.invoke('state')).games.map((g) => g.included),
    state.games.map((g) => g.included)
  );
});
test('current Steam import deduplicates, keeps selections, excludes new entries and records independent discovery source', async (t) => {
  const x = await fixture(t),
    before = (await x.core.invoke('state')).games[0];
  await x.core.invoke('importPopular');
  let state = await done(x.core);
  assert.equal(state.selectionJob.added, 1);
  assert.equal(state.games.filter((g) => g.steamAppId === 1).length, 1);
  assert.equal(state.games[0].included, before.included);
  assert.deepEqual(state.games[0].crop, before.crop);
  const added = state.games.find((g) => g.steamAppId === 900);
  assert.equal(added.included, false);
  assert.equal(added.installed, false);
  assert.deepEqual(added.sources, ['popular']);
  state = await x.restart();
  assert.equal(state.games.find((g) => g.steamAppId === 900).popularRank, 2);
  await x.core.invoke('setIncluded', { filter: 'popularFilter', included: true });
  assert(
    (await x.core.invoke('state')).games
      .filter((g) => g.sources.includes('popular'))
      .every((g) => g.included)
  );
});
test('public Steam top uses fixed unkeyed endpoints, resolves names, removes software and reuses measured counts', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sas-public-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const seen = [];
  const api = createPopularity({
    dataDir: dir,
    fetchImpl: async (url, opts) => {
      assert.equal(url.hostname, 'api.steampowered.com');
      assert.equal(url.searchParams.has('key'), false);
      assert.equal(opts.redirect, 'error');
      seen.push(url.pathname);
      return new Response(
        JSON.stringify({
          response: url.pathname.includes('GetGamesByConcurrentPlayers')
            ? {
                last_update: 1792144800,
                ranks: [
                  { rank: 1, appid: 1, concurrent_in_game: 90 },
                  { rank: 2, appid: 2, concurrent_in_game: 80 }
                ]
              }
            : {
                store_items: [
                  { appid: 1, success: 1, type: 0, name: 'A game' },
                  { appid: 2, success: 1, type: 6, name: 'A tool' }
                ]
              }
        })
      );
    }
  });
  const top = await api.top();
  assert.equal(top.games.length, 1);
  assert.equal(top.games[0].name, 'A game');
  const rows = await api.rank([{ steamAppId: 1, name: 'A game' }]);
  assert.equal(rows[0].players, 90);
  assert.equal(seen.length, 2);
});
test('popularity requests are bounded to four lanes, cached across restart and refreshed after expiry', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sas-counts-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  let time = 1000000,
    active = 0,
    maximum = 0,
    calls = 0;
  const config = {
    dataDir: dir,
    now: () => time,
    fetchImpl: async (url) => {
      calls++;
      maximum = Math.max(maximum, ++active);
      await new Promise((r) => setTimeout(r, 2));
      active--;
      return new Response(
        JSON.stringify({
          response: { result: 1, player_count: Number(url.searchParams.get('appid')) }
        })
      );
    }
  };
  const games = Array.from({ length: 12 }, (_, i) => ({ steamAppId: i + 1, name: String(i + 1) }));
  const ranks = await createPopularity(config).rank(games);
  assert(maximum <= 4);
  assert.equal(calls, 12);
  assert.equal(ranks[0].steamAppId, 12);
  await createPopularity(config).rank(games);
  assert.equal(calls, 12);
  time += TTL + 1;
  await createPopularity(config).rank(games);
  assert.equal(calls, 24);
});
test('bad public Steam responses never become zero-player rankings', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sas-bad-counts-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  for (const response of [
    new Response('', { status: 429 }),
    new Response(JSON.stringify({ response: { result: 1, player_count: -1 } })),
    new Response('not json')
  ]) {
    const api = createPopularity({ dataDir: dir, fetchImpl: async () => response });
    await assert.rejects(api.rank([{ steamAppId: 1, name: 'Game' }]), /Steam/);
  }
});

test(
  'large owned catalog bulk and top operations remain exact and recoverable',
  { timeout: 30000 },
  async (t) => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sas-large-library-'));
    const games = Array.from({ length: 5000 }, (_, i) => ({
      id: `steam:${9000000 + i}`,
      steamAppId: 9000000 + i,
      name: `Large QA ${i}`,
      sources: ['account'],
      included: false,
      playtimeMinutes: i
    }));
    await fs.writeFile(path.join(root, 'catalog.json'), JSON.stringify({ version: 1, games }));
    let core = createCore({
      dataDir: root,
      steamRoots: [],
      popularity: {
        rank: async (rows) => rows.map((g, i) => ({ steamAppId: g.steamAppId, players: 5000 - i }))
      }
    });
    t.after(async () => {
      await core.close();
      await fs.rm(root, { recursive: true, force: true });
    });
    const started = Date.now();
    await core.invoke('setIncluded', { included: true });
    assert.equal((await core.invoke('state')).games.filter((g) => g.included).length, 5000);
    await core.invoke('selectLibraryTop', { criterion: 'playtime' });
    assert.equal((await core.invoke('state')).games.filter((g) => g.included).length, 100);
    await core.invoke('selectLibraryTop', { criterion: 'steam' });
    let state = await done(core);
    assert.equal(state.selectionJob.status, 'completed');
    assert(state.games.every((g) => g.included === g.steamAppId < 9000100));
    await core.close();
    core = createCore({ dataDir: root, steamRoots: [] });
    state = await core.invoke('state');
    assert.equal(state.games.length, 5000);
    assert.equal(state.games.filter((g) => g.included).length, 100);
    t.diagnostic(
      `5000-game catalog: bulk inclusion, both rankings, persistence and restart in ${Date.now() - started} ms on this host.`
    );
  }
);
