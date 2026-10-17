'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { helperCommand } = require('../core/update-install.cjs');
const { once } = require('node:events');
async function fixture(t) {
  const root = await fs.mkdtemp('/private/tmp/sas-helper-');
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const token = 'a'.repeat(32),
    txDir = path.join(root, 'tx'),
    dataDir = path.join(root, 'data');
  const active = path.join(root, "app's folder $test"),
    staged = path.join(root, 'stage', 'app'),
    backup = path.join(root, 'previous');
  for (const p of [txDir, dataDir, active, staged]) await fs.mkdir(p, { recursive: true });
  await fs.copyFile(
    path.join(__dirname, '../core/update-helper.sh'),
    path.join(txDir, 'helper.sh')
  );
  await fs.writeFile(path.join(txDir, 'token'), token);
  await fs.writeFile(path.join(root, 'stage/.sas-update-token'), token);
  const old = '#!/bin/sh\nprintf old > "$SAS_DATA_DIR/launched"\n';
  await fs.writeFile(path.join(active, 'app'), old, { mode: 0o755 });
  await fs.writeFile(path.join(txDir, 'root-inventory'), 'app\n');
  await fs.writeFile(path.join(dataDir, 'catalog.json'), 'original catalog');
  await fs.writeFile(path.join(txDir, 'catalog-backup.json'), 'original catalog');
  const child = spawn('/bin/sh', ['-c', 'exit 0']);
  await once(child, 'exit');
  const tx = {
    parentPid: child.pid,
    active,
    staged,
    backup,
    executable: 'app',
    dataDir,
    token,
    healthTimeout: 15
  };
  async function run() {
    const c = helperCommand(tx, txDir, 'posix'),
      p = spawn(c.file, c.args, { stdio: 'pipe' });
    let errors = '';
    p.stderr.on('data', (b) => (errors += b));
    const [code] = await once(p, 'exit');
    return {
      code,
      errors,
      result: JSON.parse(await fs.readFile(path.join(txDir, 'result.json'), 'utf8'))
    };
  }
  return { root, txDir, tx, run };
}
test('real independent helper swaps paths with spaces and shell metacharacters, acknowledges health and keeps a backup', async (t) => {
  const f = await fixture(t);
  await fs.writeFile(
    path.join(f.tx.staged, 'app'),
    '#!/bin/sh\nprintf new > "$SAS_DATA_DIR/launched"\nprintf %s "$SAS_UPDATE_TOKEN" > "$SAS_UPDATE_HEALTH"\n',
    { mode: 0o755 }
  );
  const r = await f.run();
  assert.equal(r.code, 0, r.errors);
  assert.equal(r.result.phase, 'updated');
  assert.equal(await fs.readFile(path.join(f.tx.dataDir, 'launched'), 'utf8'), 'new');
  assert((await fs.stat(path.join(f.tx.backup, 'app'))).isFile());
  assert.equal((await f.run()).result.phase, 'updated');
});
test('failed new executable restores the old application and catalog, then relaunches the old app', async (t) => {
  const f = await fixture(t);
  await fs.writeFile(
    path.join(f.tx.staged, 'app'),
    '#!/bin/sh\nprintf changed > "$SAS_DATA_DIR/catalog.json"\nexit 91\n',
    { mode: 0o755 }
  );
  const r = await f.run();
  assert.equal(r.result.phase, 'rolled_back', r.errors);
  assert.equal(
    await fs.readFile(path.join(f.tx.dataDir, 'catalog.json'), 'utf8'),
    'original catalog'
  );
  for (let n = 0; n < 50; n++) {
    if ((await fs.readFile(path.join(f.tx.dataDir, 'launched'), 'utf8').catch(() => '')) === 'old')
      break;
    await new Promise((r) => setTimeout(r, 20));
  }
  assert.equal(await fs.readFile(path.join(f.tx.dataDir, 'launched'), 'utf8'), 'old');
});
test('an interrupted first rename can restore the active directory from its preserved backup', async (t) => {
  const f = await fixture(t);
  await fs.rename(f.tx.active, f.tx.backup);
  await fs.mkdir(path.join(f.txDir, 'helper.lock'));
  await fs.writeFile(path.join(f.txDir, 'helper.pid'), String(f.tx.parentPid));
  const r = await f.run();
  assert.equal(r.result.phase, 'rolled_back');
  assert((await fs.stat(path.join(f.tx.active, 'app'))).isFile());
});
test('changed or pre-existing replacement paths are refused without overwriting the app', async (t) => {
  const f = await fixture(t);
  await fs.mkdir(f.tx.backup);
  const before = await fs.readFile(path.join(f.tx.active, 'app'));
  const r = await f.run();
  assert.equal(r.result.phase, 'error');
  assert.deepEqual(await fs.readFile(path.join(f.tx.active, 'app')), before);
});
test('files added after staging stop replacement and remain in the active app folder', async (t) => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.tx.active, 'personal-notes.txt'), 'preserve');
  const r = await f.run();
  assert.equal(r.result.phase, 'error');
  assert.equal(await fs.readFile(path.join(f.tx.active, 'personal-notes.txt'), 'utf8'), 'preserve');
});
