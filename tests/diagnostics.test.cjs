'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { createDiagnostics, sanitize } = require('../core/diagnostics.cjs');
const { createCore } = require('../core/index.cjs');
async function temp(t) {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'sas-log-'));
  t.after(() => fsp.rm(root, { recursive: true, force: true }));
  return root;
}
test('structured diagnostics retain nested error stacks, environment and redacted secrets', async (t) => {
  const root = await temp(t),
    secret = 'secret-token-not-hex',
    hex = '1234567890abcdef'.repeat(2),
    logger = createDiagnostics({ dataDir: root, secrets: () => [secret] });
  logger.addSecret('second-known-secret');
  const error = new Error(
    `Download ${secret} ${hex} https://example.com/?key=url-secret&other=ok Bearer authentication-token second-known-secret`
  );
  error.cause = new Error('decoder failed');
  logger.record('error', 'fixture.failure', {
    error,
    apiKey: 'plain-private-key',
    nested: { password: 'private-password' },
    authorization: 'private-auth'
  });
  const circular = {};
  circular.self = circular;
  logger.record('warn', 'circular', circular);
  logger.close();
  const raw = await fsp.readFile(logger.file, 'utf8'),
    report = JSON.parse(raw);
  for (const value of [
    secret,
    hex,
    'url-secret',
    'authentication-token',
    'second-known-secret',
    'plain-private-key',
    'private-password',
    'private-auth'
  ])
    assert(!raw.includes(value), value);
  assert.equal(report.cleanExit, true);
  assert.equal(report.application, 'Steam Animated Screensaver');
  assert.equal(report.system.platform, process.platform);
  const row = report.events.find((e) => e.event === 'fixture.failure');
  assert(row.detail.error.stack);
  assert.equal(row.detail.error.cause.message, 'decoder failed');
  assert(row.at);
  assert.equal((await fsp.stat(logger.file)).mode & 0o777, 0o600);
  assert.equal(sanitize(circular).self, '[circular]');
});
test('each fatal log survives immediate process exit and next startup detects interruption', async (t) => {
  const root = await temp(t),
    modulePath = require.resolve('../core/diagnostics.cjs');
  const code = `const logger=require(${JSON.stringify(modulePath)}).createDiagnostics({dataDir:process.argv[1]});logger.record('fatal','fixture.abrupt_exit',{message:'last durable event'});process.exit(7);`;
  assert.equal(spawnSync(process.execPath, ['-e', code, root]).status, 7);
  const report = JSON.parse(await fsp.readFile(path.join(root, 'logs/diagnostics.json'), 'utf8'));
  assert.equal(report.cleanExit, false);
  assert(report.events.some((e) => e.event === 'fixture.abrupt_exit'));
  const logger = createDiagnostics({ dataDir: root });
  assert.equal(
    JSON.parse(await fsp.readFile(logger.file, 'utf8')).events[0].detail.previousSessionInterrupted,
    true
  );
  logger.close();
  assert(
    JSON.parse(await fsp.readFile(path.join(root, 'logs/diagnostics-1.json'), 'utf8')).events.some(
      (e) => e.event === 'fixture.abrupt_exit'
    )
  );
});
test('rotation bounds disk use and all retained segments remain valid JSON', async (t) => {
  const root = await temp(t),
    logger = createDiagnostics({ dataDir: root, maxBytes: 4096, maxFiles: 5 });
  for (let i = 0; i < 100; i++) logger.record('error', 'failure', { i, message: 'x'.repeat(900) });
  logger.close();
  const names = await fsp.readdir(path.join(root, 'logs'));
  assert.equal(names.length, 5);
  for (const name of names) {
    const raw = await fsp.readFile(path.join(root, 'logs', name), 'utf8');
    assert(Buffer.byteLength(raw) < 4096);
    assert(Array.isArray(JSON.parse(raw).events));
  }
  assert(JSON.parse(await fsp.readFile(logger.file, 'utf8')).events.some((e) => e.detail.i === 99));
});
test('write failure preserves previous valid JSON, is reported and recovers on the next event', async (t) => {
  const root = await temp(t),
    logger = createDiagnostics({ dataDir: root });
  const before = await fsp.readFile(logger.file, 'utf8'),
    rename = fs.renameSync;
  try {
    fs.renameSync = (from, to) => {
      if (to === logger.file)
        throw Object.assign(new Error('Simulated disk full'), { code: 'ENOSPC' });
      return rename(from, to);
    };
    logger.record('error', 'disk.failure');
  } finally {
    fs.renameSync = rename;
  }
  assert.match(logger.failure, /disk full/);
  assert.equal(await fsp.readFile(logger.file, 'utf8'), before);
  logger.record('info', 'recovered');
  assert.equal(logger.failure, null);
  logger.close();
  const after = JSON.parse(await fsp.readFile(logger.file, 'utf8'));
  assert(after.events.some((e) => e.event === 'disk.failure'));
  assert(after.events.some((e) => e.event === 'recovered'));
});
test('diagnostics reject linked folders or files without modifying their target', async (t) => {
  const root = await temp(t),
    outside = path.join(root, 'outside');
  await fsp.mkdir(outside);
  await fsp.symlink(outside, path.join(root, 'logs'));
  assert.throws(() => createDiagnostics({ dataDir: root }), /Unsafe/);
  await fsp.unlink(path.join(root, 'logs'));
  await fsp.mkdir(path.join(root, 'logs'));
  await fsp.writeFile(path.join(outside, 'keep'), 'retained');
  await fsp.symlink(path.join(outside, 'keep'), path.join(root, 'logs/diagnostics.json'));
  assert.throws(() => createDiagnostics({ dataDir: root }), /Unsafe/);
  assert.equal(await fsp.readFile(path.join(outside, 'keep'), 'utf8'), 'retained');
});
test('core records failed actions and browser/player errors; purge preserves logs and secrets stay out', async (t) => {
  const root = await temp(t),
    core = createCore({ dataDir: root, steamRoots: [] });
  t.after(() => core.close());
  let state = await core.invoke('state');
  assert(state.diagnostics.available);
  await core.invoke('setKey', { key: 'fixture-secret-key-value' });
  await assert.rejects(core.invoke('updateGame', { id: 'steam:999' }));
  await core.invoke('diagnosticsEvent', {
    event: 'player.media_error',
    message: 'fixture-secret-key-value',
    gameId: 'steam:999'
  });
  await core.invoke('purgeMedia', { confirm: true });
  await core.close();
  const raw = await fsp.readFile(state.diagnostics.file, 'utf8'),
    report = JSON.parse(raw);
  assert(!raw.includes('fixture-secret-key-value'));
  assert(report.events.some((e) => e.event === 'core.action_failed' && e.detail.error.stack));
  assert(report.events.some((e) => e.event === 'player.media_error'));
  assert.equal(report.cleanExit, true);
});
