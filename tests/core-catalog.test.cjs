'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createCore } = require('../core/index.cjs');
const { atomicWrite, readJSON, safeFilename } = require('../core/store.cjs');
const asset = {
  id: 71,
  url: 'https://cdn2.steamgriddb.com/hero/abc.webp',
  thumb: null,
  width: 1920,
  height: 620,
  score: 1,
  kind: 'hero',
  animated: true,
  author: { name: 'Artist' }
};
async function setup(t, { prepareHook, validateHook, gameRunning = async () => false } = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cinema-core-'));
  const steam = path.join(dir, 'steam');
  await fs.mkdir(path.join(steam, 'steamapps'), { recursive: true });
  const dataDir = path.join(dir, 'data');
  let prepares = 0;
  const media = {
    async validate(m) {
      if (validateHook) return validateHook(m);
      return !!m && !!(await fs.stat(path.join(dataDir, 'media', m.file)).catch(() => null));
    },
    async prepare(a, opts) {
      prepares++;
      if (prepareHook) await prepareHook(a, opts);
      await fs.mkdir(path.join(dataDir, 'media'), { recursive: true });
      const file = `asset-${a.id}.webm`,
        thumbnail = `asset-${a.id}.jpg`,
        sourceFile = `source-${a.id}.webp`;
      for (const f of [file, thumbnail, sourceFile])
        await fs.writeFile(path.join(dataDir, 'media', f), 'prepared');
      return {
        file,
        thumbnail,
        sourceFile,
        width: 1920,
        height: 620,
        duration: 4,
        format: 'webm',
        animated: true,
        author: a.author,
        sourceUrl: a.url
      };
    }
  };
  const sgdb = {
    async game(id) {
      return {
        sgdbId: id,
        steamAppId: id === 99 ? 620 : id === 100 ? 10 : null,
        name: `Game ${id}`
      };
    },
    async bySteam(id) {
      return { sgdbId: id === 620 ? 99 : 100, steamAppId: id, name: `Game ${id}` };
    },
    async search() {
      return [{ sgdbId: 99, steamAppId: 620, name: 'Portal' }];
    },
    async artworks(id) {
      return [{ ...asset, id: 71 + id }];
    },
    async validateKey() {
      return { valid: true };
    }
  };
  const cores = [];
  const create = () => {
    const core = createCore({
      dataDir,
      steamRoots: [steam],
      sgdb,
      media,
      isGameRunning: gameRunning
    });
    cores.push(core);
    return core;
  };
  const core = create();
  t.after(async () => {
    for (const c of cores) await c.close().catch(() => {});
    await fs.rm(dir, { recursive: true, force: true });
  });
  return {
    core,
    create,
    dir,
    dataDir,
    steam,
    media,
    sgdb,
    get prepares() {
      return prepares;
    }
  };
}
async function done(core) {
  for (let i = 0; i < 200; i++) {
    const s = await core.invoke('state');
    if (s.job.status !== 'running') return s;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error('Queue did not finish');
}
test('manual add merges installed game, preserves preferences and media through rescan/uninstall', async (t) => {
  const x = await setup(t);
  await x.core.invoke('add', { sgdbId: 99 });
  await x.core.invoke('updateGame', { id: 'steam:620', included: false });
  await fs.writeFile(
    path.join(x.steam, 'steamapps/appmanifest_620.acf'),
    '"AppState" {"appid" "620" "name" "Portal 2" "StateFlags" "4"}'
  );
  let s = await x.core.invoke('scan');
  assert.equal(s.games.length, 1);
  assert.deepEqual(s.games[0].sources, ['manual', 'installed']);
  assert.equal(s.games[0].included, false);
  await fs.rm(path.join(x.steam, 'steamapps/appmanifest_620.acf'));
  s = await x.core.invoke('scan');
  assert.equal(s.games.length, 1);
  assert.equal(s.games[0].installed, false);
  assert.deepEqual(s.games[0].sources, ['manual']);
  assert.equal((await x.core.invoke('search', { query: 'Portal' }))[0].present, true);
});
test('preparation is incremental, manual choice protected, credits retained, key private and permissions restricted', async (t) => {
  const x = await setup(t);
  await x.core.invoke('setKey', { key: 'personal-key-0123456789' });
  await x.core.invoke('add', { sgdbId: 99 });
  const choices = await x.core.invoke('artworks', { id: 'steam:620' });
  await x.core.invoke('updateGame', { id: 'steam:620', selectedAsset: choices[0] });
  await x.core.invoke('prepare');
  let s = await done(x.core);
  assert.equal(s.games[0].status, 'ready');
  assert.equal(s.games[0].manualSelection, true);
  assert.equal(s.games[0].media.author.name, 'Artist');
  assert.equal(x.prepares, 1);
  await x.core.invoke('prepare');
  s = await done(x.core);
  assert.equal(x.prepares, 1);
  assert.equal(s.job.processed, 1);
  assert.ok(!JSON.stringify(s).includes('personal-key'));
  assert.ok(
    !(await fs.readFile(path.join(x.dataDir, 'catalog.json'), 'utf8')).includes('personal-key')
  );
  assert.equal((await fs.stat(path.join(x.dataDir, 'steamgriddb.key'))).mode & 0o777, 0o600);
  await fs.writeFile(path.join(x.dataDir, 'media', 'unused.webm'), 'unused');
  await x.core.invoke('clearUnused');
  assert.ok(await fs.stat(path.join(x.dataDir, 'media', s.games[0].media.sourceFile)));
  assert.equal(await fs.stat(path.join(x.dataDir, 'media', 'unused.webm')).catch(() => null), null);
});
test('pause persists current work, closing and resuming recovers remaining queue', async (t) => {
  let started;
  const began = new Promise((r) => (started = r));
  let block = true;
  const x = await setup(t, {
    prepareHook: async (a, { signal }) => {
      started();
      if (block)
        await new Promise((resolve, reject) =>
          signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
        );
    }
  });
  await x.core.invoke('add', { sgdbId: 99 });
  await x.core.invoke('add', { sgdbId: 100 });
  await x.core.invoke('prepare');
  await began;
  let s = await x.core.invoke('pause');
  assert.equal(s.job.status, 'paused');
  assert.equal(s.job.processed, 0);
  assert.equal(s.job.pending, 2);
  await x.core.close();
  block = false;
  const c = x.create();
  s = await c.invoke('state');
  assert.equal(s.job.status, 'paused');
  await c.invoke('resume');
  s = await done(c);
  assert.equal(s.job.processed, 2);
  assert.ok(s.games.every((g) => g.status === 'ready'));
});
test('cancel stops queue, retries only failures and keeps completed files', async (t) => {
  let fail = true;
  const x = await setup(t, {
    prepareHook: async () => {
      if (fail) throw new Error('Bad media');
    }
  });
  await x.core.invoke('add', { sgdbId: 99 });
  await x.core.invoke('prepare');
  let s = await done(x.core);
  assert.equal(s.job.errors.length, 1);
  assert.equal(s.games[0].status, 'error');
  fail = false;
  await x.core.invoke('retry');
  s = await done(x.core);
  assert.equal(s.games[0].status, 'ready');
  s = await x.core.invoke('cancel');
  assert.equal(s.job.status, 'cancelled');
  assert.equal(s.job.pending, 0);
  assert.ok(await x.media.validate(s.games[0].media));
});
test('game running pauses before download; explicit resume can later continue', async (t) => {
  let playing = true;
  const x = await setup(t, { gameRunning: async () => playing });
  await x.core.invoke('add', { sgdbId: 99 });
  await x.core.invoke('prepare');
  let s = await done(x.core);
  assert.equal(s.job.status, 'paused');
  assert.equal(s.job.pauseReason, 'game');
  assert.equal(x.prepares, 0);
  playing = false;
  await x.core.invoke('resume');
  s = await done(x.core);
  assert.equal(s.games[0].status, 'ready');
});
test('invalid artwork injection and malformed settings are rejected; repair marks missing cache', async (t) => {
  const x = await setup(t);
  await x.core.invoke('add', { sgdbId: 99 });
  await assert.rejects(
    x.core.invoke('updateGame', {
      id: 'steam:620',
      selectedAsset: { id: 1, url: 'file:///etc/passwd' }
    }),
    /gallery/
  );
  await assert.rejects(x.core.invoke('settings', { maxStorageGB: 0 }), /Storage limit/);
  await assert.rejects(x.core.invoke('settings', { language: 'invalid' }), /English/);
  await x.core.invoke('prepare');
  let s = await done(x.core);
  await fs.rm(path.join(x.dataDir, 'media', s.games[0].media.file));
  s = await x.core.invoke('repair');
  assert.equal(s.games[0].media, null);
  assert.equal(s.games[0].status, 'new');
});
test('catalog lock prevents concurrent managers and corrupt JSON is preserved for recovery', async (t) => {
  const x = await setup(t);
  await x.core.invoke('state');
  const other = x.create();
  await assert.rejects(other.invoke('state'), /Another Screensaver Manager/);
  const file = path.join(x.dir, 'corrupt.json');
  await fs.writeFile(file, '{broken');
  assert.equal(await readJSON(file, null), null);
  assert.ok((await fs.readdir(x.dir)).some((f) => f.startsWith('corrupt.json.corrupt-')));
  await atomicWrite(path.join(x.dir, 'atomic.json'), '{}');
  assert.equal(await fs.readFile(path.join(x.dir, 'atomic.json'), 'utf8'), '{}');
  assert.equal(safeFilename('../bad'), false);
  assert.equal(safeFilename('good-123.webm'), true);
});
test('storage exhaustion fails before download and keeps queue resumable for retry', async (t) => {
  const x = await setup(t);
  await x.core.invoke('settings', { maxStorageGB: 0.1 });
  await fs.mkdir(path.join(x.dataDir, 'media'));
  const file = await fs.open(path.join(x.dataDir, 'media', 'occupied.bin'), 'w');
  await file.truncate(108 * 1024 * 1024);
  await file.close();
  await x.core.invoke('add', { sgdbId: 99 });
  await x.core.invoke('prepare');
  let s = await done(x.core);
  assert.equal(x.prepares, 0);
  assert.match(s.games[0].error, /Storage limit/);
  await x.core.invoke('clearUnused');
  await x.core.invoke('retry');
  s = await done(x.core);
  assert.equal(s.games[0].status, 'ready');
});
test('changing active artwork or removing current game requires pausing; aborted output never commits ready', async (t) => {
  let started;
  const began = new Promise((r) => (started = r));
  const x = await setup(t, {
    prepareHook: async (a, { signal }) => {
      started();
      await new Promise((resolve, reject) =>
        signal.addEventListener('abort', () => reject(new Error('abort')), { once: true })
      );
    }
  });
  await x.core.invoke('add', { sgdbId: 99 });
  await x.core.invoke('prepare');
  await began;
  await assert.rejects(x.core.invoke('remove', { id: 'steam:620' }), /Pause preparation/);
  await assert.rejects(
    x.core.invoke('updateGame', { id: 'steam:620', selectedAsset: asset }),
    /Pause preparation/
  );
  let s = await x.core.invoke('cancel');
  assert.equal(s.games[0].status, 'new');
  assert.equal(s.games[0].media, null);
  assert.equal(s.job.processed, 0);
});
test('damaged on-disk catalog is preserved and recovery is visible', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cinema-broken-'));
  await fs.writeFile(path.join(dir, 'catalog.json'), '{broken');
  const core = createCore({ dataDir: dir, media: {}, sgdb: {}, isGameRunning: async () => false });
  t.after(async () => {
    await core.close();
    await fs.rm(dir, { recursive: true, force: true });
  });
  const s = await core.invoke('state');
  assert.match(s.warnings[0], /damaged catalog was preserved/);
  const backup = (await fs.readdir(dir)).find((n) => n.startsWith('catalog.json.corrupt-'));
  assert.equal(await fs.readFile(path.join(dir, backup), 'utf8'), '{broken');
});
test('clearUnused refuses a symlink media directory', async (t) => {
  const x = await setup(t);
  await x.core.invoke('state');
  const outside = path.join(x.dir, 'outside');
  await fs.mkdir(outside);
  await fs.writeFile(path.join(outside, 'keep.webm'), 'keep');
  await fs.symlink(outside, path.join(x.dataDir, 'media'));
  await assert.rejects(x.core.invoke('clearUnused'), /Unsafe media directory/);
  assert.equal(await fs.readFile(path.join(outside, 'keep.webm'), 'utf8'), 'keep');
});
test('sgdb-only manual record later installed merges on authoritative preparation lookup and preserves prepared manual asset', async (t) => {
  const x = await setup(t);
  x.sgdb.game = async (id) => ({ sgdbId: id, steamAppId: null, name: 'Portal' });
  await x.core.invoke('add', { sgdbId: 99 });
  const choices = await x.core.invoke('artworks', { id: 'sgdb:99' });
  await x.core.invoke('updateGame', { id: 'sgdb:99', selectedAsset: choices[0] });
  await x.core.invoke('prepare');
  let s = await done(x.core);
  assert.equal(x.prepares, 1);
  const before = s.games[0].media.file;
  await fs.writeFile(
    path.join(x.steam, 'steamapps/appmanifest_620.acf'),
    '"AppState" {"appid" "620" "name" "Portal 2" "StateFlags" "4"}'
  );
  s = await x.core.invoke('scan');
  assert.equal(s.games.length, 2);
  await x.core.invoke('prepare');
  s = await done(x.core);
  assert.equal(s.games.length, 1);
  assert.equal(s.games[0].steamAppId, 620);
  assert.equal(s.games[0].manualSelection, true);
  assert.equal(s.games[0].media.file, before);
  assert.equal(x.prepares, 1);
  assert.ok(s.games[0].sources.includes('manual'));
});
test('automatic preparation falls back deterministically after corrupt first candidate', async (t) => {
  const attempted = [];
  const x = await setup(t, {
    prepareHook: async (a, { onProgress }) => {
      attempted.push(a.id);
      onProgress({ stage: 'downloading', bytes: 100, total: 100 });
      if (a.id === 1) throw new Error('Corrupt source');
    }
  });
  x.sgdb.artworks = async () => [1, 2, 3, 4].map((id) => ({ ...asset, id }));
  await x.core.invoke('add', { sgdbId: 99 });
  await x.core.invoke('prepare');
  const s = await done(x.core);
  assert.deepEqual(attempted, [1, 2]);
  assert.equal(s.games[0].selectedAsset.id, 2);
  assert.equal(s.games[0].manualSelection, false);
  assert.equal(s.games[0].status, 'ready');
  assert.equal(s.job.errors.length, 0);
  assert.equal(s.job.rejected.length, 1);
  assert.equal(s.job.bytes, 200);
});
test('automatic preparation tries at most three ranked candidates and records failures', async (t) => {
  const attempted = [];
  const x = await setup(t, {
    prepareHook: async (a) => {
      attempted.push(a.id);
      throw new Error('Decode failed');
    }
  });
  x.sgdb.artworks = async () => [1, 2, 3, 4, 5].map((id) => ({ ...asset, id }));
  await x.core.invoke('add', { sgdbId: 99 });
  await x.core.invoke('prepare');
  const s = await done(x.core);
  assert.deepEqual(attempted, [1, 2, 3]);
  assert.equal(s.games[0].status, 'error');
  assert.equal(s.games[0].media, null);
  assert.match(s.games[0].error, /All 3 ranked/);
  assert.equal(s.job.rejected.length, 3);
  assert.equal(s.job.errors.length, 1);
});
test('manual selection failure never silently substitutes another candidate', async (t) => {
  const attempted = [];
  const x = await setup(t, {
    prepareHook: async (a) => {
      attempted.push(a.id);
      throw new Error('Chosen source unavailable');
    }
  });
  x.sgdb.artworks = async () => [1, 2, 3].map((id) => ({ ...asset, id }));
  await x.core.invoke('add', { sgdbId: 99 });
  await x.core.invoke('artworks', { id: 'steam:620' });
  await x.core.invoke('updateGame', { id: 'steam:620', selectedAsset: { id: 2, kind: 'hero' } });
  await x.core.invoke('prepare');
  const s = await done(x.core);
  assert.deepEqual(attempted, [2]);
  assert.equal(s.games[0].manualSelection, true);
  assert.equal(s.games[0].selectedAsset.id, 2);
  assert.equal(s.games[0].status, 'error');
  assert.match(s.games[0].error, /Your selected artwork/);
});
test('covers enrich existing media incrementally; optional interpolation preserves original, settings and cache across restart', async (t) => {
  const x = await setup(t);
  await x.core.invoke('add', { sgdbId: 99 });
  await x.core.invoke('prepare');
  let state = await done(x.core);
  const original = state.games[0].media;
  x.sgdb.covers = async () => [{ ...asset, id: 800, animated: false }];
  const prepare = x.media.prepare;
  x.media.prepare = async (...args) => ({
    ...(await prepare(...args)),
    animated: args[0].animated,
    format: args[0].animated ? 'webm' : 'png'
  });
  let smoothCalls = 0;
  x.media.smooth = async (media) => {
    smoothCalls++;
    const file = 'interpolated.webm';
    await fs.writeFile(path.join(x.dataDir, 'media', file), 'smoothed');
    return { ...media, file, smoothing: 'interpolate-30-v1' };
  };
  await x.core.invoke('settings', { smoothMotion: true, coverPosition: 'top-right' });
  await x.core.invoke('prepare');
  state = await done(x.core);
  assert.deepEqual(state.games[0].media, original);
  assert.equal(state.games[0].cover.animated, false);
  assert.equal(state.games[0].smoothed.file, 'interpolated.webm');
  assert.equal(x.prepares, 2, 'only new cover downloaded, existing animation reused');
  await x.core.invoke('prepare');
  state = await done(x.core);
  assert.equal(x.prepares, 2);
  assert.equal(smoothCalls, 1);
  await x.core.invoke('clearUnused');
  for (const m of [state.games[0].media, state.games[0].cover, state.games[0].smoothed])
    assert(await fs.stat(path.join(x.dataDir, 'media', m.file)));
  await x.core.close();
  const reopened = x.create();
  state = await reopened.invoke('state');
  assert.equal(state.settings.coverPosition, 'top-right');
  assert.equal(state.settings.smoothMotion, true);
  assert.equal(state.games[0].cover.animated, false);
  assert.equal(state.games[0].smoothed.file, 'interpolated.webm');
  await assert.rejects(reopened.invoke('settings', { coverPosition: 'anywhere' }), /position/);
});
test('optional preparation failure remains visible and preserves a ready original', async (t) => {
  const x = await setup(t);
  x.sgdb.covers = async () => {
    throw new Error('Cover service unavailable');
  };
  x.media.smooth = async () => {
    throw new Error('Interpolation unsupported');
  };
  await x.core.invoke('add', { sgdbId: 99 });
  await x.core.invoke('settings', { smoothMotion: true });
  await x.core.invoke('prepare');
  const state = await done(x.core);
  assert.equal(state.job.status, 'completed');
  assert.equal(state.games[0].status, 'ready');
  assert.match(state.games[0].coverError, /unavailable/);
  assert.match(state.games[0].smoothingError, /unsupported/);
  assert.equal(state.games[0].smoothed, null);
});
test('pausing during cover enrichment retains the completed animation and resumes without downloading it again', async (t) => {
  const x = await setup(t);
  let began;
  const started = new Promise((resolve) => {
    began = resolve;
  });
  let block = true;
  x.sgdb.covers = async (_, { signal }) => {
    began();
    if (block)
      await new Promise((resolve, reject) =>
        signal.addEventListener('abort', () => reject(new Error('paused')), { once: true })
      );
    return [];
  };
  await x.core.invoke('add', { sgdbId: 99 });
  await x.core.invoke('prepare');
  await started;
  let state = await x.core.invoke('pause');
  assert.equal(state.job.status, 'paused');
  assert.equal(state.job.pending, 1);
  assert.equal(state.games[0].status, 'ready');
  assert.equal(x.prepares, 1);
  block = false;
  await x.core.invoke('resume');
  state = await done(x.core);
  assert.equal(state.job.status, 'completed');
  assert.equal(x.prepares, 1);
});
test('unused cleanup removes only owned abandoned interpolation folders', async (t) => {
  const x = await setup(t),
    mediaDir = path.join(x.dataDir, 'media');
  await x.core.invoke('state');
  const owned = path.join(mediaDir, '11111111-1111-4111-8111-111111111111.frames');
  const foreign = path.join(mediaDir, '22222222-2222-4222-8222-222222222222.frames');
  await fs.mkdir(owned, { recursive: true });
  await fs.mkdir(foreign);
  await fs.writeFile(path.join(owned, '.cinema-smoothing-work'), 'steamos-animated-screensaver-v1');
  await fs.writeFile(path.join(owned, 'frame-0.png'), 'unfinished');
  await fs.writeFile(path.join(foreign, 'keep'), 'unrelated');
  await x.core.invoke('clearUnused');
  assert.equal(await fs.stat(owned).catch(() => null), null);
  assert.equal(await fs.readFile(path.join(foreign, 'keep'), 'utf8'), 'unrelated');
});
test('a corrupt smoothing cache is cleared when regeneration fails, preserving original playback', async (t) => {
  const x = await setup(t);
  await x.core.invoke('add', { sgdbId: 99 });
  x.media.smooth = async (media) => {
    await fs.writeFile(path.join(x.dataDir, 'media', 'smoothed.webm'), 'derived');
    return { ...media, file: 'smoothed.webm' };
  };
  await x.core.invoke('settings', { smoothMotion: true });
  await x.core.invoke('prepare');
  let state = await done(x.core);
  assert.equal(state.games[0].smoothed.file, 'smoothed.webm');
  await fs.rm(path.join(x.dataDir, 'media', 'smoothed.webm'));
  x.media.smooth = async () => {
    throw new Error('Processing failed');
  };
  await x.core.invoke('prepare');
  state = await done(x.core);
  assert.equal(state.games[0].smoothed, null);
  assert.equal(state.games[0].status, 'ready');
  assert.match(state.games[0].smoothingError, /Processing failed/);
});
test('manual fixed artwork is validated, applied independently and retained across restart and preparation', async (t) => {
  const x = await setup(t);
  x.sgdb.covers = async () => [
    { ...asset, id: 800, animated: false, kind: 'grid' },
    { ...asset, id: 801, animated: false, kind: 'grid' }
  ];
  const prepare = x.media.prepare;
  x.media.prepare = async (...args) => ({
    ...(await prepare(...args)),
    animated: args[0].animated
  });
  await x.core.invoke('add', { sgdbId: 99 });
  await x.core.invoke('prepare');
  let state = await done(x.core);
  const original = state.games[0].media;
  const choices = await x.core.invoke('covers', { id: 'steam:620' });
  state = await x.core.invoke('setCover', { id: 'steam:620', selectedCover: choices[1] });
  assert.equal(state.games[0].selectedCover.id, 801);
  assert.equal(state.games[0].coverManualSelection, true);
  assert.deepEqual(state.games[0].media, original);
  const successfulPrepare = x.media.prepare;
  x.media.prepare = async () => {
    throw new Error('Selected cover download failed');
  };
  await assert.rejects(
    x.core.invoke('setCover', { id: 'steam:620', selectedCover: choices[0] }),
    /download failed/
  );
  assert.equal((await x.core.invoke('state')).games[0].selectedCover.id, 801);
  x.media.prepare = successfulPrepare;
  await assert.rejects(
    x.core.invoke('setCover', { id: 'steam:620', selectedCover: { id: 999 } }),
    /Choose a still/
  );
  assert.equal((await x.core.invoke('state')).games[0].selectedCover.id, 801);
  await x.core.close();
  const reopened = x.create();
  await reopened.invoke('prepare');
  state = await done(reopened);
  assert.equal(state.games[0].selectedCover.id, 801);
  assert.equal(state.games[0].cover.file, 'asset-801.webm');
  state = await reopened.invoke('setCover', { id: 'steam:620', selectedCover: null });
  assert.equal(state.games[0].coverManualSelection, false);
  assert.equal(state.games[0].cover.file, 'asset-800.webm');
});
test('the video-size limit is validated, persisted and passed in bytes without a 160 MB ceiling', async (t) => {
  const x = await setup(t);
  await x.core.invoke('add', { sgdbId: 99 });
  const budgets = [];
  x.media.smooth = async (media, { maxBytes }) => {
    budgets.push(maxBytes);
    return media;
  };
  await x.core.invoke('settings', { smoothMotion: true, maxSmoothingMB: 512 });
  await x.core.invoke('prepare');
  await done(x.core);
  assert.equal(budgets[0], 512 * 1024 * 1024);
  await x.core.invoke('settings', { maxSmoothingMB: 0 });
  assert.equal((await x.core.invoke('state')).settings.maxSmoothingMB, 0);
  await assert.rejects(x.core.invoke('settings', { maxSmoothingMB: -1 }), /size limit/);
  await assert.rejects(x.core.invoke('settings', { maxSmoothingMB: '512' }), /size limit/);
  await x.core.close();
  assert.equal((await x.create().invoke('state')).settings.maxSmoothingMB, 0);
});
test('late search and installed-game previews resolve missing metadata lazily, with static grid fallback', async (t) => {
  const x = await setup(t),
    requested = [];
  x.sgdb.enrichThumbnails = async (games) => {
    requested.push(games[0].sgdbId);
    return games;
  };
  x.sgdb.covers = async () => [{ ...asset, thumb: 'https://cdn2.steamgriddb.com/thumb/still.jpg' }];
  x.media.preview = async ({ url }) => {
    assert.equal(url, 'https://cdn2.steamgriddb.com/thumb/still.jpg');
    return { file: 'resolved.jpg' };
  };
  assert.equal((await x.core.invoke('previewImage', { sgdbId: 99 })).file, 'resolved.jpg');
  assert.equal((await x.core.invoke('previewImage', { steamAppId: 620 })).file, 'resolved.jpg');
  assert.deepEqual(requested, [99, 99]);
});

test('live interpolation progress is readable during work, journaled, persisted, and invalidated by fps/profile changes', async (t) => {
  const x = await setup(t);
  await x.core.invoke('add', { sgdbId: 99 });
  await x.core.invoke('prepare');
  await done(x.core);
  let release,
    started,
    calls = 0;
  const ready = new Promise((r) => {
    started = r;
  });
  x.media.smooth = async (media, opts) => {
    calls++;
    if (calls === 1) {
      opts.onProgress({
        stage: 'smoothing',
        progress: 0.4,
        frames: 12,
        totalFrames: 30,
        targetFps: 30,
        codec: 'vp8'
      });
      started();
      await new Promise((r) => {
        release = r;
      });
    }
    const file = `smooth-${calls}.webm`;
    await fs.writeFile(path.join(x.dataDir, 'media', file), 'smoothed');
    return { ...media, file, smoothing: 'interpolate-30-v2' };
  };
  await x.core.invoke('settings', { smoothMotion: true });
  await x.core.invoke('prepare');
  await ready;
  let state = await x.core.invoke('state');
  assert.equal(state.job.stage, 'smoothing');
  assert.equal(state.job.progress, 0.4);
  assert.equal(state.job.detail.frames, 12);
  assert(state.job.history.some((e) => e.stage === 'smoothing' && e.progress === 0.4));
  release();
  await done(x.core);
  await x.core.invoke('prepare');
  await done(x.core);
  assert.equal(calls, 1);
  await x.core.invoke('settings', { smoothingFps: 24 });
  await x.core.invoke('prepare');
  state = await done(x.core);
  assert.equal(calls, 2);
  assert.equal(state.games[0].smoothed.smoothingConfig.fps, 24);
  await x.core.invoke('settings', { smoothingMode: 'blend' });
  await x.core.invoke('prepare');
  state = await done(x.core);
  assert.equal(calls, 3);
  await assert.rejects(x.core.invoke('settings', { smoothingFps: 25 }), /24 or 30/);
  assert(state.job.history.some((e) => e.stage === 'game-ready'));
  const persisted = JSON.parse(await fs.readFile(path.join(x.dataDir, 'catalog.json'), 'utf8'));
  assert.equal(persisted.job.history.at(-1).stage, 'completed');
});

test('complete media purge preserves games, artwork choices, settings and separate keys; removes exports and all cache variants', async (t) => {
  const x = await setup(t);
  await x.core.invoke('setKey', { key: 'fixture-sgdb-personal-key' });
  await x.core.invoke('setSteamAccount', {
    profile: '76561198000000000',
    key: '0123456789abcdef'.repeat(2)
  });
  await x.core.invoke('settings', {
    smoothingFps: 24,
    smoothingMode: 'blend',
    coverPosition: 'top-right'
  });
  await x.core.invoke('add', { sgdbId: 99 });
  const choices = await x.core.invoke('artworks', { id: 'steam:620' });
  await x.core.invoke('updateGame', { id: 'steam:620', selectedAsset: choices[0] });
  await x.core.invoke('prepare');
  const prepared = await done(x.core);
  const original = prepared.games[0];
  // Seed optional variants and manual cover choice exactly as a persisted user catalog would.
  const selectedCover = { ...asset, id: 9001, animated: false };
  await x.core.close();
  const file = path.join(x.dataDir, 'catalog.json'),
    saved = JSON.parse(await fs.readFile(file, 'utf8'));
  saved.games[0].cover = { ...original.media, file: 'fixed.png', animated: false };
  saved.games[0].smoothed = {
    ...original.media,
    file: 'smooth.webm',
    smoothing: 'interpolate-24-v2'
  };
  saved.games[0].selectedCover = selectedCover;
  saved.games[0].coverManualSelection = true;
  await fs.writeFile(file, JSON.stringify(saved));
  for (const f of ['fixed.png', 'smooth.webm', 'preview-cache.jpg', 'incomplete.partial'])
    await fs.writeFile(path.join(x.dataDir, 'media', f), 'cached');
  for (const dir of ['sources', 'processed', 'thumbnails']) {
    await fs.mkdir(path.join(x.dataDir, dir));
    await fs.writeFile(path.join(x.dataDir, dir, 'cached-image.png'), 'old cached file');
  }
  const frames = path.join(x.dataDir, 'media', '00000000-0000-0000-0000-000000000000.frames');
  await fs.mkdir(frames);
  await fs.writeFile(
    path.join(frames, '.cinema-smoothing-work'),
    'steamos-animated-screensaver-v1'
  );
  await fs.writeFile(path.join(frames, 'frame-0.png'), 'temporary frame');
  const core = x.create();
  await core.invoke('scan');
  await core.invoke('install');
  const parent = path.join(x.steam, 'config/uioverrides/screensavers'),
    installed = path.join(parent, 'steamos-animated-screensaver');
  await fs.cp(installed, path.join(parent, 'SteamOS Animated Screensaver'), { recursive: true });
  await fs.mkdir(path.join(parent, 'other-screensaver'));
  await fs.writeFile(path.join(parent, 'other-screensaver', 'keep'), 'unrelated');
  await fs.writeFile(path.join(x.dataDir, 'unrelated.txt'), 'keep');
  const keys = await Promise.all(
    ['steamgriddb.key', 'steam-api.key'].map((f) => fs.readFile(path.join(x.dataDir, f), 'utf8'))
  );
  await assert.rejects(core.invoke('purgeMedia'), /Confirm/);
  assert(await fs.stat(installed));
  let state = await core.invoke('purgeMedia', { confirm: true });
  for (const dir of ['media', 'sources', 'processed', 'thumbnails'])
    assert.deepEqual(await fs.readdir(path.join(x.dataDir, dir)), []);
  assert.equal(state.storage.used, 0);
  assert.equal(state.steam.installed, false);
  assert.equal(state.games.length, 1);
  assert.equal(state.games[0].included, original.included);
  assert.deepEqual(state.games[0].selectedAsset, original.selectedAsset);
  assert.deepEqual(state.games[0].selectedCover, selectedCover);
  assert.equal(state.games[0].coverManualSelection, true);
  assert.equal(state.games[0].status, 'new');
  for (const field of ['media', 'cover', 'smoothed']) assert.equal(state.games[0][field], null);
  assert.equal(state.settings.smoothingFps, 24);
  assert.equal(state.settings.coverPosition, 'top-right');
  assert.equal(state.job.status, 'idle');
  assert.equal(state.job.pending, 0);
  assert.equal(state.previewsPaused, true);
  assert(state.lastMediaPurge.files >= 10);
  for (const folder of ['steamos-animated-screensaver', 'SteamOS Animated Screensaver'])
    await assert.rejects(fs.stat(path.join(parent, folder)), { code: 'ENOENT' });
  assert.equal(
    await fs.readFile(path.join(parent, 'other-screensaver', 'keep'), 'utf8'),
    'unrelated'
  );
  assert.equal(await fs.readFile(path.join(x.dataDir, 'unrelated.txt'), 'utf8'), 'keep');
  assert.deepEqual(
    await Promise.all(
      ['steamgriddb.key', 'steam-api.key'].map((f) => fs.readFile(path.join(x.dataDir, f), 'utf8'))
    ),
    keys
  );
  await assert.rejects(core.invoke('previewImage', { url: asset.url }), /paused/);
  await core.close();
  const reopened = x.create();
  state = await reopened.invoke('state');
  assert.equal(state.previewsPaused, true);
  state = await reopened.invoke('purgeMedia', { confirm: true });
  assert.equal(state.lastMediaPurge.files, 0);
  await reopened.invoke('prepare');
  state = await done(reopened);
  assert.equal(state.games[0].status, 'ready');
  assert.equal(state.previewsPaused, false);
  assert.equal(state.games[0].selectedAsset.id, original.selectedAsset.id);
  await reopened.invoke('install');
  assert.equal((await reopened.invoke('state')).steam.installed, true);
});

test('purge interrupts preparation and active previews before deleting their partial files', async (t) => {
  let started, previewStarted;
  const preparing = new Promise((r) => {
      started = r;
    }),
    previewing = new Promise((r) => {
      previewStarted = r;
    });
  const x = await setup(t, {
    prepareHook: async (_, { signal }) => {
      started();
      await new Promise((resolve, reject) =>
        signal.addEventListener(
          'abort',
          () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
          { once: true }
        )
      );
    }
  });
  x.media.preview = async (_, { signal }) => {
    previewStarted();
    await new Promise((resolve, reject) =>
      signal.addEventListener(
        'abort',
        () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
        { once: true }
      )
    );
  };
  await x.core.invoke('add', { sgdbId: 99 });
  await x.core.invoke('prepare');
  await preparing;
  const preview = x.core.invoke('previewImage', { url: asset.url }).catch((e) => e);
  await previewing;
  const state = await x.core.invoke('purgeMedia', { confirm: true });
  assert.equal((await preview).name, 'AbortError');
  assert.equal(state.job.pending, 0);
  assert.equal(state.job.status, 'idle');
  assert.equal(state.games[0].media, null);
  assert.equal(state.games[0].status, 'new');
});

test('purge rejects linked caches, unowned work folders and foreign Steam destinations before deleting local files', async (t) => {
  const x = await setup(t);
  await x.core.invoke('add', { sgdbId: 99 });
  await x.core.invoke('prepare');
  const before = await done(x.core);
  const keep = path.join(x.dataDir, 'media', before.games[0].media.file),
    original = await fs.readFile(keep);
  const outside = path.join(x.dir, 'outside');
  await fs.mkdir(outside);
  await fs.writeFile(path.join(outside, 'keep'), 'untouched');
  await fs.symlink(outside, path.join(x.dataDir, 'media', 'linked'));
  await assert.rejects(x.core.invoke('purgeMedia', { confirm: true }), /unknown folder or link/);
  assert.deepEqual(await fs.readFile(keep), original);
  assert.equal(await fs.readFile(path.join(outside, 'keep'), 'utf8'), 'untouched');
  await fs.unlink(path.join(x.dataDir, 'media', 'linked'));
  const unowned = path.join(x.dataDir, 'media', '00000000-0000-0000-0000-000000000001.frames');
  await fs.mkdir(unowned);
  await assert.rejects(x.core.invoke('purgeMedia', { confirm: true }), /unknown folder or link/);
  await fs.rmdir(unowned);
  await fs.symlink(outside, path.join(x.dataDir, 'sources'));
  await assert.rejects(x.core.invoke('purgeMedia', { confirm: true }), /Unsafe media directory/);
  await fs.unlink(path.join(x.dataDir, 'sources'));
  const target = path.join(x.steam, 'config/uioverrides/screensavers/steamos-animated-screensaver');
  await fs.mkdir(target, { recursive: true });
  await fs.writeFile(path.join(target, 'mine'), 'foreign');
  await assert.rejects(x.core.invoke('purgeMedia', { confirm: true }), /not owned/);
  assert.deepEqual(await fs.readFile(keep), original);
  assert.equal((await x.core.invoke('state')).games[0].status, 'ready');
  assert.equal(await fs.readFile(path.join(target, 'mine'), 'utf8'), 'foreign');
});

test('a failed unlink leaves a recoverable unprepared catalog and allows a complete purge retry', async (t) => {
  const x = await setup(t);
  await x.core.invoke('add', { sgdbId: 99 });
  await x.core.invoke('prepare');
  await done(x.core);
  const unlink = fs.unlink;
  let fail = true;
  t.mock.method(fs, 'unlink', async (file) => {
    if (fail && String(file).includes('asset-')) {
      fail = false;
      throw new Error('Fixture file is busy');
    }
    return unlink(file);
  });
  await assert.rejects(x.core.invoke('purgeMedia', { confirm: true }), /busy/);
  const saved = JSON.parse(await fs.readFile(path.join(x.dataDir, 'catalog.json'), 'utf8'));
  assert.equal(saved.games[0].status, 'new');
  assert.equal(saved.games[0].media, null);
  assert.equal(saved.previewsPaused, true);
  const state = await x.core.invoke('purgeMedia', { confirm: true });
  assert.equal(state.storage.used, 0);
});
