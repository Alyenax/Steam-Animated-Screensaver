'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFile, spawn } = require('node:child_process');
const { promisify } = require('node:util');
const { once } = require('node:events');
const run = promisify(execFile);
(async () => {
  const binary = path.resolve('dist/tools/powershell-7.6.7/pwsh'),
    helper = path.resolve('core/update-helper.ps1');
  const root = await fs.mkdtemp('/private/tmp/sas-ps-helper-'),
    checks = [];
  try {
    const parser = path.join(root, 'parse.ps1');
    await fs.writeFile(
      parser,
      "param([string]$Source)\n$tokens=$null;$errors=$null\n$null=[System.Management.Automation.Language.Parser]::ParseFile($Source,[ref]$tokens,[ref]$errors)\nif($errors.Count){$errors | ForEach-Object {$_.Message};exit 1}\nWrite-Output 'Parser passed'\n"
    );
    await run(binary, ['-NoLogo', '-NoProfile', '-File', parser, '-Source', helper]);
    checks.push('Official PowerShell parser accepts the shipped Windows helper');
    for (const faulty of [false, true]) {
      const dir = path.join(root, faulty ? 'rollback' : 'success'),
        dataDir = path.join(dir, 'data'),
        active = path.join(dir, "app's folder $test"),
        stageParent = path.join(dir, 'stage'),
        staged = path.join(stageParent, 'app'),
        backup = path.join(dir, 'previous'),
        txDir = path.join(dir, 'transaction');
      for (const p of [dataDir, active, staged, txDir]) await fs.mkdir(p, { recursive: true });
      const token = 'b'.repeat(32);
      await fs.writeFile(path.join(stageParent, '.sas-update-token'), token);
      await fs.writeFile(
        path.join(active, 'app.exe'),
        '#!/bin/sh\nprintf old > "$SAS_DATA_DIR/launched"\n',
        { mode: 0o755 }
      );
      await fs.writeFile(
        path.join(staged, 'app.exe'),
        faulty
          ? '#!/bin/sh\nprintf changed > "$SAS_DATA_DIR/catalog.json"\nexit 91\n'
          : '#!/bin/sh\nprintf new > "$SAS_DATA_DIR/launched"\nprintf %s "$SAS_UPDATE_TOKEN" > "$SAS_UPDATE_HEALTH"\n',
        { mode: 0o755 }
      );
      await fs.writeFile(path.join(dataDir, 'catalog.json'), 'original');
      await fs.writeFile(path.join(txDir, 'catalog-backup.json'), 'original');
      const child = spawn('/bin/sh', ['-c', 'exit 0']);
      await once(child, 'exit');
      await fs.writeFile(
        path.join(txDir, 'transaction.json'),
        JSON.stringify({
          schema: 1,
          target: 'win32-x64',
          token,
          active,
          staged,
          backup,
          dataDir,
          parentPid: child.pid,
          healthTimeout: 15,
          rootEntries: ['app.exe'],
          executable: 'app.exe'
        })
      );
      await run(
        binary,
        ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', helper, '-Transaction', txDir],
        { timeout: 45000 }
      ).catch(async (e) => {
        if (!faulty) throw e;
      });
      const r = JSON.parse(await fs.readFile(path.join(txDir, 'result.json'), 'utf8'));
      assert.equal(r.phase, faulty ? 'rolled_back' : 'updated', JSON.stringify(r));
      if (faulty)
        assert.equal(await fs.readFile(path.join(dataDir, 'catalog.json'), 'utf8'), 'original');
      checks.push(
        faulty
          ? 'PowerShell executes rollback, restores the catalog and relaunches the previous fixture executable'
          : 'PowerShell performs replacement, starts the new fixture and verifies its health token with spaces and shell metacharacters in paths'
      );
    }
    const report = {
      version: require('../package.json').version,
      result: 'passed',
      host: process.platform,
      scope:
        'PowerShell parser and helper logic executed on macOS. Fixture executables are local shell scripts. This is not native Windows file-locking, policy, ACL or Steam acceptance.',
      checks
    };
    await fs.writeFile(
      'dist/POWERSHELL_HELPER_VALIDATION.json',
      JSON.stringify(report, null, 2) + '\n'
    );
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
