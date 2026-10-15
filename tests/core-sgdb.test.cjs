'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSGDB, rankAssets, normalizeAsset, cdnUrl } = require('../core/sgdb.cjs');
const reply = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify({ success: status === 200, data }), { status, headers });
test('missing/invalid key and offline requests have useful errors without secrets', async () => {
  await assert.rejects(createSGDB({ getKey: () => '' }).search('Portal'), /personal.*key/);
  const bad = createSGDB({
    getKey: () => 'secret',
    fetchImpl: async () => reply(null, 401),
    minInterval: 0
  });
  await assert.rejects(
    bad.search('Portal'),
    (e) => /rejected/.test(e.message) && !e.message.includes('secret')
  );
  const offline = createSGDB({
    getKey: () => 'secret',
    fetchImpl: async () => {
      throw new Error('secret');
    },
    minInterval: 0
  });
  await assert.rejects(offline.search('Portal'), /connect/);
});
test('numeric and Store URL search map Steam IDs using official endpoint; names retain homonyms', async () => {
  const requests = [];
  const sg = createSGDB({
    getKey: () => 'personal',
    minInterval: 0,
    fetchImpl: async (url, opts) => {
      requests.push(url);
      assert.equal(opts.headers.Authorization, 'Bearer personal');
      return reply(
        url.includes('/search/')
          ? [
              { id: 7, name: 'Same' },
              { id: 8, name: 'Same' }
            ]
          : { id: 9, name: 'Portal' }
      );
    }
  });
  assert.equal((await sg.search('620'))[0].steamAppId, 620);
  assert.equal((await sg.search('https://store.steampowered.com/app/620/Portal_2/'))[0].sgdbId, 9);
  assert.equal((await sg.search('Same')).length, 2);
  assert.equal(requests[0], 'https://www.steamgriddb.com/api/v2/games/steam/620');
  await assert.rejects(sg.search('https://evil.test/app/620'), /Steam Store/);
});
test('404 is no result; 429 respects retry-after and retries in one lane', async () => {
  let calls = 0;
  const sg = createSGDB({
    getKey: () => 'personal',
    minInterval: 0,
    fetchImpl: async () => {
      calls++;
      return calls === 1
        ? reply(null, 429, { 'retry-after': '1' })
        : reply({ id: 9, name: 'Portal' });
    }
  });
  assert.equal((await sg.search('620'))[0].sgdbId, 9);
  assert.equal(calls, 2);
  const missing = createSGDB({
    getKey: () => 'personal',
    minInterval: 0,
    fetchImpl: async () => reply(null, 404)
  });
  assert.deepEqual(await missing.search('620'), []);
});
test('artwork discovery asks for animations and strict content filters; static fallback opt-in', async () => {
  const urls = [];
  const sg = createSGDB({
    getKey: () => 'personal',
    minInterval: 0,
    fetchImpl: async (url) => {
      urls.push(url);
      return reply([
        {
          id: 2,
          url: 'https://cdn2.steamgriddb.com/hero/abc.webp',
          thumb: 'https://cdn2.steamgriddb.com/thumb/abc.webp',
          width: 1920,
          height: 620,
          author: { name: 'Artist' }
        }
      ]);
    }
  });
  const a = await sg.artworks(9);
  assert.equal(a.length, 2);
  assert.ok(a.every((x) => x.animated));
  assert.ok(
    urls.every(
      (u) =>
        u.includes('types=animated') && u.includes('nsfw=false') && u.includes('epilepsy=false')
    )
  );
  urls.length = 0;
  await sg.artworks(9, { staticFallback: true });
  assert.ok(urls.some((u) => u.includes('types=static')));
});
test('ranking is deterministic, favors animated landscape heroes, rejects unsafe CDN URLs', () => {
  const source = {
    id: 1,
    url: 'https://cdn2.steamgriddb.com/hero/a.webp',
    width: 1920,
    height: 620,
    score: 1,
    author: { name: 'A' }
  };
  const hero = normalizeAsset(source, 'hero', true);
  const popularGrid = { ...hero, id: 2, kind: 'grid', width: 600, height: 900, score: 100000 };
  const staticHero = { ...hero, id: 3, animated: false, score: 100000 };
  const ranked = rankAssets([popularGrid, staticHero, hero]);
  assert.deepEqual(
    ranked.map((a) => a.id),
    [1, 2, 3]
  );
  assert.deepEqual(rankAssets([hero, popularGrid, staticHero]), ranked);
  for (const u of [
    'http://cdn2.steamgriddb.com/a',
    'https://cdn2.steamgriddb.com.evil.test/a',
    'https://user@cdn2.steamgriddb.com/a',
    'file:///a'
  ])
    assert.equal(cdnUrl(u), null);
});
test('search thumbnail enrichment is bounded, cached and may use static thumbnails independently of playback', async () => {
  let calls = 0;
  const sg = createSGDB({
    getKey: () => 'personal',
    minInterval: 0,
    fetchImpl: async (url) => {
      calls++;
      return reply(
        url.includes('types=animated')
          ? []
          : [{ thumb: 'https://cdn2.steamgriddb.com/thumb/real.jpg' }]
      );
    }
  });
  const games = Array.from({ length: 12 }, (_, i) => ({
    sgdbId: i + 1,
    name: `Game ${i}`,
    thumb: null
  }));
  const first = await sg.enrichThumbnails(games);
  assert.equal(calls, 16);
  assert.equal(first.filter((g) => g.thumb).length, 8);
  assert.ok(first[0].thumb.endsWith('real.jpg'));
  await sg.enrichThumbnails(games);
  assert.equal(calls, 16);
});
test('platformdata candidate mappings are verified by reverse official endpoint before use', async () => {
  const requested = [];
  const sg = createSGDB({
    getKey: () => 'personal',
    minInterval: 0,
    fetchImpl: async (url) => {
      requested.push(url);
      return reply(
        url.includes('/games/id/')
          ? { id: 99, name: 'Portal', platforms: { steam: { id: '620' } } }
          : { id: 99, name: 'Portal' }
      );
    }
  });
  assert.equal((await sg.game(99)).steamAppId, 620);
  assert.ok(requested[1].endsWith('/games/steam/620'));
  const mismatch = createSGDB({
    getKey: () => 'personal',
    minInterval: 0,
    fetchImpl: async (url) =>
      reply(
        url.includes('/games/id/')
          ? { id: 99, name: 'Portal', platforms: { steam: { id: '620' } } }
          : { id: 100, name: 'Other' }
      )
  });
  assert.equal((await mismatch.game(99)).steamAppId, null);
});
test('lifetime cancellation interrupts a pending API request without exposing authorization', async () => {
  const lifetime = new AbortController();
  let started;
  const began = new Promise((r) => (started = r));
  const sg = createSGDB({
    getKey: () => 'personal',
    signal: lifetime.signal,
    minInterval: 0,
    fetchImpl: async (url, { signal }) => {
      started();
      return new Promise((resolve, reject) =>
        signal.addEventListener('abort', () => reject(new Error('Stopped')), { once: true })
      );
    }
  });
  const request = sg.search('Portal');
  await began;
  lifetime.abort(new Error('Manager closed'));
  await assert.rejects(request, /Stopped/);
});
