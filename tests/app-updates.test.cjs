'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const { createUpdater, hashFile } = require('../core/app-updates.cjs');
const {
  TARGETS,
  API,
  REPO,
  compareVersions,
  assetName,
  readManifest
} = require('../core/update-format.cjs');
const { extractArchive, validateApp, noLinks, entryPath } = require('../core/update-archive.cjs');
const { helperCommand, readTransaction, acknowledgeUpdate } = require('../core/update-install.cjs');
const pair = crypto.generateKeyPairSync('ed25519');
function signed(payload, key = pair.privateKey) {
  const bytes = Buffer.from(JSON.stringify(payload));
  return Buffer.from(
    JSON.stringify({
      schema: 1,
      keyId: 'release-1',
      payload: bytes.toString('base64'),
      signature: crypto.sign(null, bytes, key).toString('base64')
    })
  );
}
function fixture({ body = Buffer.alloc(180000, 123), version = '1.2.1' } = {}) {
  const digest = crypto.createHash('sha256').update(body).digest('hex');
  const manifest = {
    schema: 1,
    product: 'steam-animated-screensaver',
    version,
    tag: `v${version}`,
    minimumUpdater: 1,
    assets: Object.keys(TARGETS).map((target) => ({
      target,
      name: assetName(version, target),
      size: body.length,
      sha256: digest,
      unpackedBytes: body.length * 2
    }))
  };
  const bytes = signed(manifest),
    release = {
      tag_name: `v${version}`,
      draft: false,
      prerelease: false,
      body: '<script>bad()</script> Release notes',
      assets: [
        ...manifest.assets.map((a) => ({
          name: a.name,
          state: 'uploaded',
          size: a.size,
          digest: `sha256:${digest}`,
          browser_download_url: `https://github.com/${REPO}/releases/download/v${version}/${a.name}`
        })),
        {
          name: 'update.json',
          state: 'uploaded',
          size: bytes.length,
          browser_download_url: `https://github.com/${REPO}/releases/download/v${version}/update.json`
        }
      ]
    };
  const calls = [];
  async function fetchImpl(url) {
    calls.push(url);
    return new Response(
      url === API ? JSON.stringify(release) : url.endsWith('/update.json') ? bytes : body,
      { headers: { ETag: '"test"' } }
    );
  }
  return { body, manifest, bytes, release, fetchImpl, calls };
}
async function directory(t) {
  const root = await fs.mkdtemp('/private/tmp/sas-update-unit-');
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}
async function updater(t, f = fixture(), options = {}) {
  const dataDir = options.dataDir || (await directory(t));
  const u = createUpdater({
    dataDir,
    version: '1.2.0',
    target: 'linux-x64',
    publicKey: pair.publicKey,
    fetchImpl: f.fetchImpl,
    enabled: false,
    ...options
  });
  t.after(() => u.close());
  await u.init();
  return { u, dataDir, f };
}
test('stable semantic versions compare numerically and reject ambiguous prereleases', () => {
  assert.equal(compareVersions('1.10.0', '1.9.99'), 1);
  assert.equal(compareVersions('1.2.0', '1.2.0'), 0);
  assert.equal(compareVersions('1.2.0', '2.0.0'), -1);
  for (const v of ['01.2.0', 'v1.2.0', '1.2.0-beta.1', '1.2', 'NaN', '', null])
    assert.throws(() => compareVersions(v, '1.2.0'));
});
test('Ed25519 manifest verifies exact payload, key, version and all four platform descriptors', () => {
  const f = fixture();
  assert.equal(
    readManifest(f.bytes, { publicKey: pair.publicKey, target: 'linux-x64', version: '1.2.1' })
      .assets.length,
    4
  );
  const envelope = JSON.parse(f.bytes);
  envelope.payload = Buffer.from('{}').toString('base64');
  assert.throws(
    () => readManifest(Buffer.from(JSON.stringify(envelope)), { publicKey: pair.publicKey }),
    /signature/
  );
  assert.throws(
    () => readManifest(f.bytes, { publicKey: crypto.generateKeyPairSync('ed25519').publicKey }),
    /signature/
  );
  assert.throws(
    () => readManifest(f.bytes, { publicKey: pair.publicKey, version: '2.0.0' }),
    /manifest/
  );
  for (const change of [
    (m) => m.assets.push(m.assets[0]),
    (m) => (m.assets[0].size = 0),
    (m) => (m.assets[0].unpackedBytes = 9e12),
    (m) => (m.assets[0].name = '../evil.zip'),
    (m) => (m.minimumUpdater = 2)
  ]) {
    const m = structuredClone(f.manifest);
    change(m);
    assert.throws(() => readManifest(signed(m), { publicKey: pair.publicKey }));
  }
});
test('GitHub check, real streamed bytes, SHA256, confirmation and persistent ready state', async (t) => {
  const { u, dataDir, f } = await updater(t);
  assert.equal(u.status().autoCheck, true);
  assert.equal(u.status().currentVersion, '1.2.0');
  await u.check();
  assert.equal(u.status().phase, 'available');
  assert.equal(u.status().availableVersion, '1.2.1');
  assert.equal(u.download().phase, 'downloading');
  await u.wait();
  assert.equal(u.status().phase, 'ready');
  assert.equal(u.status().bytes, f.body.length);
  assert.equal(u.status().progress, 100);
  await assert.rejects(u.install(false), /Confirm/);
  await assert.rejects(u.install(true), /cannot be replaced/);
  await u.preferences({ autoCheck: false });
  await u.close();
  const next = await updater(t, f, { dataDir });
  assert.equal(next.u.status().phase, 'ready');
  assert.equal(next.u.status().autoCheck, false);
  assert.equal(f.calls.filter((url) => url === API).length, 1);
});
test('same or older latest release never triggers a download; drafts and prereleases are refused', async (t) => {
  for (const version of ['1.2.0', '1.1.99']) {
    const f = fixture({ version }),
      { u } = await updater(t, f);
    await u.check();
    assert.equal(u.status().phase, 'up_to_date');
    assert.equal(f.calls.length, 1);
  }
  for (const field of ['draft', 'prerelease']) {
    const f = fixture();
    f.release[field] = true;
    const { u } = await updater(t, f);
    await u.check();
    assert.equal(u.status().phase, 'error');
    assert.equal(u.status().errorCode, 'version');
  }
});
test('wrong asset, duplicate download, wrong digest and unsafe URL are refused before execution', async (t) => {
  for (const change of [
    (r) => (r.assets[0].browser_download_url = 'https://evil.example/x'),
    (r) => r.assets.push(r.assets[0]),
    (r) => (r.assets[0].digest = 'sha256:' + '0'.repeat(64)),
    (r) => r.assets[0].size++
  ]) {
    const f = fixture();
    change(f.release);
    const { u } = await updater(t, f);
    await u.check();
    assert.equal(u.status().phase, 'error');
  }
});
test('untrusted redirects, bounded metadata and GitHub rate limits leave the existing app untouched', async (t) => {
  const redirect = await updater(t, fixture(), {
    fetchImpl: async () =>
      new Response(null, { status: 302, headers: { Location: 'https://evil.example/x' } })
  });
  await redirect.u.check();
  assert.equal(redirect.u.status().errorCode, 'url');
  const huge = await updater(t, fixture(), {
    fetchImpl: async () => new Response('x'.repeat(512001))
  });
  await huge.u.check();
  assert.equal(huge.u.status().errorCode, 'size');
  let calls = 0;
  const limited = await updater(t, fixture(), {
    fetchImpl: async () => {
      calls++;
      return new Response('', { status: 429, headers: { 'Retry-After': '3600' } });
    }
  });
  await limited.u.check();
  await limited.u.check();
  assert.equal(limited.u.status().errorCode, 'rate');
  assert.equal(calls, 1);
});
test('incomplete or altered downloads are deleted and can be retried', async (t) => {
  const f = fixture();
  let corrupt = true;
  const { u, dataDir } = await updater(t, f, {
    fetchImpl: async (url) =>
      url === API || url.endsWith('/update.json')
        ? f.fetchImpl(url)
        : new Response(corrupt ? f.body.subarray(1) : f.body)
  });
  await u.check();
  u.download();
  await u.wait();
  assert.equal(u.status().errorCode, 'checksum');
  assert.equal(
    (await fs.readdir(path.join(dataDir, 'updates'))).filter((n) => n.startsWith('download-'))
      .length,
    0
  );
  corrupt = false;
  u.download();
  await u.wait();
  assert.equal(u.status().phase, 'ready');
});
test('cancellation aborts streaming and removes partial data without discarding the available release', async (t) => {
  const f = fixture();
  let started;
  const waiting = new Promise((r) => (started = r));
  const { u, dataDir } = await updater(t, f, {
    fetchImpl: async (url, options) => {
      if (url === API || url.endsWith('/update.json')) return f.fetchImpl(url);
      return new Response(
        new ReadableStream({
          start(c) {
            c.enqueue(f.body.subarray(0, 100));
            started();
            options.signal.addEventListener('abort', () => c.error(new Error('aborted')));
          }
        })
      );
    }
  });
  await u.check();
  u.download();
  await waiting;
  await u.cancel();
  assert.equal(u.status().phase, 'available');
  assert(!(await fs.readdir(path.join(dataDir, 'updates'))).some((n) => n.endsWith('.part')));
});
test('cached update paths and locally modified payloads cannot become installable', async (t) => {
  const { u, dataDir, f } = await updater(t);
  await u.check();
  u.download();
  await u.wait();
  await u.close();
  const stateFile = path.join(dataDir, 'updates/state.json'),
    saved = JSON.parse(await fs.readFile(stateFile));
  await fs.writeFile(saved.candidate.download, 'modified');
  const next = await updater(t, f, { dataDir });
  assert.equal(next.u.status().phase, 'available');
  await next.u.close();
  saved.candidate.download = '/etc/passwd';
  await fs.writeFile(stateFile, JSON.stringify(saved));
  const third = await updater(t, f, { dataDir });
  assert.equal(third.u.status().phase, 'available');
});
test('archive path rules reject traversal, Windows aliases, absolute and alternate stream names', () => {
  for (const name of [
    '/root/a',
    'root/../evil',
    'root/a\\b',
    'root/a:stream',
    'root/CON.txt',
    'root/a.',
    'wrong/a',
    'root//a'
  ])
    assert.throws(() => entryPath(name, 'root'));
  assert.equal(entryPath('root/safe/file.js', 'root'), 'root/safe/file.js');
});
async function tarFile(file, entries) {
  const pack = require('tar-stream').pack();
  for (const e of entries)
    pack.entry(
      { name: e.name, type: e.type || 'file', mode: e.mode || 0o644, linkname: e.linkname },
      e.type === 'symlink' ? undefined : e.body || 'test'
    );
  pack.finalize();
  await require('node:stream/promises').pipeline(
    pack,
    require('node:zlib').createGzip(),
    require('node:fs').createWriteStream(file)
  );
}
test('real tar extraction preserves executable bits and rejects oversized data, duplicate paths, links and traversal', async (t) => {
  const root = await directory(t),
    file = path.join(root, 'app.tar.gz'),
    base = TARGETS['linux-x64'].root;
  await tarFile(file, [{ name: base + '/app', body: 'hello', mode: 0o755 }]);
  const extracted = await extractArchive(file, path.join(root, 'good'), {
    target: 'linux-x64',
    unpackedBytes: 5
  });
  assert.equal(await fs.readFile(path.join(extracted, 'app'), 'utf8'), 'hello');
  assert((await fs.stat(path.join(extracted, 'app'))).mode & 0o111);
  let n = 0;
  for (const entries of [
    [{ name: base + '/../evil' }],
    [{ name: base + '/a' }, { name: base + '/A' }],
    [{ name: base + '/a', type: 'symlink', linkname: '../../evil' }],
    [{ name: base + '/large', body: 'too large' }]
  ]) {
    await tarFile(file, entries);
    const dest = path.join(root, 'bad' + n++);
    await assert.rejects(extractArchive(file, dest, { target: 'linux-x64', unpackedBytes: 4 }));
    assert.equal(await fs.stat(dest).catch(() => null), null);
  }
});
test('symlink data roots, forged transaction paths and health acknowledgements are rejected', async (t) => {
  const root = await directory(t),
    link = path.join(root, 'link');
  await fs.symlink(root, link);
  await assert.rejects(noLinks(path.join(link, 'updates')), /symbolic/);
  await assert.rejects(readTransaction(path.join(root, 'bad.json'), root), /path/);
  await assert.rejects(
    acknowledgeUpdate(root, '1.2.0', {
      SAS_UPDATE_TOKEN: 'a'.repeat(32),
      SAS_UPDATE_HEALTH: path.join(root, 'health')
    }),
    /path/
  );
  assert.equal(await acknowledgeUpdate(root, '1.2.0', {}), false);
  const command = helperCommand(
    {
      parentPid: 2,
      active: '/a b',
      staged: '/c',
      backup: '/d',
      executable: 'app',
      dataDir: '/data',
      token: 'a'.repeat(32),
      healthTimeout: 60
    },
    '/tx',
    'win32'
  );
  assert(command.args.includes('-File'));
  assert(!command.args.includes('-Command'));
});
function makeZip(entries) {
  const local = [],
    central = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name),
      body = Buffer.from(e.body || 'hello'),
      crc = require('node:zlib').crc32(body);
    const l = Buffer.alloc(30);
    l.writeUInt32LE(0x04034b50);
    l.writeUInt16LE(20, 4);
    l.writeUInt16LE(e.encrypted ? 1 : 0, 6);
    l.writeUInt32LE(crc, 14);
    l.writeUInt32LE(body.length, 18);
    l.writeUInt32LE(body.length, 22);
    l.writeUInt16LE(name.length, 26);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50);
    c.writeUInt16LE((3 << 8) | 20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(e.encrypted ? 1 : 0, 8);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(body.length, 20);
    c.writeUInt32LE(body.length, 24);
    c.writeUInt16LE(name.length, 28);
    c.writeUInt32LE(((e.mode || 0o100644) << 16) >>> 0, 38);
    c.writeUInt32LE(offset, 42);
    local.push(l, name, body);
    central.push(c, name);
    offset += l.length + name.length + body.length;
  }
  const directory = Buffer.concat(central),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}
test('real ZIP extractor rejects traversal, duplicates, symlinks, encryption and expanded-size violations', async (t) => {
  const root = await directory(t),
    file = path.join(root, 'app.zip'),
    base = TARGETS['win32-x64'].root;
  await fs.writeFile(file, makeZip([{ name: base + '/file.js' }]));
  const good = await extractArchive(file, path.join(root, 'good'), {
    target: 'win32-x64',
    unpackedBytes: 5
  });
  assert.equal(await fs.readFile(path.join(good, 'file.js'), 'utf8'), 'hello');
  let n = 0;
  for (const entries of [
    [{ name: base + '/../evil' }],
    [{ name: base + '/a' }, { name: base + '/A' }],
    [{ name: base + '/link', mode: 0o120777 }],
    [{ name: base + '/encrypted', encrypted: true }],
    [{ name: base + '/large', body: 'larger than declared' }]
  ]) {
    await fs.writeFile(file, makeZip(entries));
    const destination = path.join(root, 'bad' + n++);
    await assert.rejects(
      extractArchive(file, destination, { target: 'win32-x64', unpackedBytes: 10 })
    );
    assert.equal(await fs.stat(destination).catch(() => null), null);
  }
});
test('insufficient disk space is refused before an installation stage is created', async (t) => {
  const root = await directory(t);
  t.mock.method(fs, 'statfs', async () => ({ bavail: 1, bsize: 4096 }));
  await assert.rejects(require('../core/update-archive.cjs').space(root, 100000000), /disk space/);
});
test('portable installation boundaries reject extra user files and shared Desktop-like roots', async (t) => {
  const root = await directory(t),
    active = path.join(root, 'app'),
    dataDir = path.join(root, 'data');
  await fs.mkdir(path.join(active, 'resources/app'), { recursive: true });
  await fs.mkdir(dataDir);
  await fs.writeFile(
    path.join(active, 'resources/app/package.json'),
    JSON.stringify({
      name: 'steam-animated-screensaver',
      productName: 'Steam Animated Screensaver',
      version: '1.2.0'
    })
  );
  await fs.writeFile(path.join(active, 'steam-animated-screensaver'), 'fixture');
  await fs.writeFile(
    path.join(active, '.sas-update-root.json'),
    JSON.stringify({
      schema: 1,
      product: 'steam-animated-screensaver',
      version: '1.2.0',
      entries: ['resources', 'steam-animated-screensaver']
    })
  );
  const options = { dataDir, version: '1.2.0', target: 'linux-x64', active, packaged: true };
  const { createInstaller } = require('../core/update-install.cjs');
  assert.equal((await createInstaller(options)).available, true);
  assert.equal((await createInstaller({ ...options, protectedDirs: [active] })).available, false);
  await fs.writeFile(path.join(active, 'personal-notes.txt'), 'must be preserved');
  const refused = await createInstaller(options);
  assert.equal(refused.available, false);
  assert.equal(refused.reason, 'contents');
  assert.equal(
    await fs.readFile(path.join(active, 'personal-notes.txt'), 'utf8'),
    'must be preserved'
  );
});
test('an unsafe update-cache folder disables only updates and keeps the manual release route', async (t) => {
  const root = await directory(t),
    other = path.join(root, 'other');
  await fs.mkdir(other);
  await fs.symlink(other, path.join(root, 'updates'));
  const u = createUpdater({ dataDir: root, version: '1.2.0', target: 'linux-x64', enabled: false });
  t.after(() => u.close());
  const state = await u.init();
  assert.equal(state.phase, 'unavailable');
  assert.equal(state.canCheck, false);
  assert.equal(state.canOpenRelease, true);
  assert.equal((await u.check()).phase, 'unavailable');
  assert.deepEqual(await fs.readdir(other), []);
});
test('closing aborts an in-flight GitHub check and completes the durable state write', async (t) => {
  const root = await directory(t);
  let started;
  const ready = new Promise((r) => (started = r));
  const u = createUpdater({
    dataDir: root,
    version: '1.2.0',
    target: 'linux-x64',
    enabled: false,
    fetchImpl: async (_url, { signal }) =>
      new Promise((_r, reject) => {
        started();
        signal.addEventListener('abort', () => reject(new Error('aborted')));
      })
  });
  await u.init();
  const checking = u.check();
  await ready;
  await u.close();
  await checking;
  const state = JSON.parse(await fs.readFile(path.join(root, 'updates/state.json'), 'utf8'));
  assert.equal(state.schema, 1);
  assert.equal(u.status().phase, 'idle');
});
