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
