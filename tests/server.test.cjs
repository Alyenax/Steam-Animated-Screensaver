'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createServer } = require('../scripts/dev-server.cjs');
const { resolveFile } = require('../scripts/local-files.cjs');

test('development transport blocks cross-origin and DNS rebinding requests; supports same-origin IPC', async (t) => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'screensaver-server-'));
  await fs.mkdir(path.join(dataDir, 'media'));
  const calls = [];
  const core = {
    invoke: async (action, payload) => {
      calls.push({ action, payload });
      return { games: [], hasKey: false };
    },
    close: async () => {}
  };
  const instance = await createServer({ dataDir, core });
  t.after(async () => {
    await instance.close();
    await fs.rm(dataDir, { recursive: true, force: true });
  });
  const cross = await fetch(instance.url + '/api/invoke', {
    method: 'POST',
    headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' },
    body: '{"action":"scan"}'
  });
  assert.equal(cross.status, 403);
  assert.equal(calls.length, 0);
  const missing = await fetch(instance.url + '/api/invoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"action":"scan"}'
  });
  assert.equal(missing.status, 403);
  const valid = await fetch(instance.url + '/api/invoke', {
    method: 'POST',
    headers: { Origin: instance.url, 'Content-Type': 'application/json' },
    body: '{"action":"scan","payload":{}}'
  });
  assert.equal(valid.status, 200);
  assert.deepEqual(await valid.json(), { result: { games: [], hasKey: false } });
  assert.equal(calls[0].action, 'scan');
  const rebind = await new Promise((resolve, reject) => {
    require('node:http')
      .get(instance.url + '/api/state', { headers: { Host: 'attacker.example' } }, (response) => {
        response.resume();
        resolve(response.statusCode);
      })
      .on('error', reject);
  });
  assert.equal(rebind, 403);
});

test('media range streaming and sandboxed file resolution', async (t) => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'screensaver-ranges-'));
  await fs.mkdir(path.join(dataDir, 'media'));
  await fs.writeFile(path.join(dataDir, 'media', 'fixture.webm'), '0123456789');
  await fs.writeFile(path.join(dataDir, 'secrets.json'), 'secret');
  await fs.symlink(path.join(dataDir, 'secrets.json'), path.join(dataDir, 'media', 'escape.png'));
  const core = { invoke: async () => ({ games: [] }), close: async () => {} };
  const instance = await createServer({ dataDir, core });
  t.after(async () => {
    await instance.close();
    await fs.rm(dataDir, { recursive: true, force: true });
  });
  const partial = await fetch(instance.url + '/media/fixture.webm', {
    headers: { Range: 'bytes=2-5' }
  });
  assert.equal(partial.status, 206);
  assert.equal(await partial.text(), '2345');
  assert.equal(partial.headers.get('content-range'), 'bytes 2-5/10');
  assert.match(partial.headers.get('content-security-policy'), /object-src 'none'/);
  const suffix = await fetch(instance.url + '/media/fixture.webm', {
    headers: { Range: 'bytes=-3' }
  });
  assert.equal(await suffix.text(), '789');
  const invalid = await fetch(instance.url + '/media/fixture.webm', {
    headers: { Range: 'bytes=100-' }
  });
  assert.equal(invalid.status, 416);
  for (const item of [
    '/media/escape.png',
    '/core/index.cjs',
    '/package.json',
    '/media/secrets.json',
    '/media/a%2f..%2f..%2fsecrets.json'
  ])
    assert.equal((await fetch(instance.url + item)).status, 404, item);
  assert.equal(
    await resolveFile('/media/%00.png', { root: path.resolve(__dirname, '..'), dataDir }),
    null
  );
});
