'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
async function manifest(root, relative = '', result = {}) {
  for (const entry of await fs.readdir(path.join(root, relative), { withFileTypes: true })) {
    const name = path.join(relative, entry.name),
      file = path.join(root, name);
    if (entry.isSymbolicLink()) result[name] = { link: await fs.readlink(file) };
    else if (entry.isDirectory()) await manifest(root, name, result);
    else
      result[name] = {
        sha256: crypto
          .createHash('sha256')
          .update(await fs.readFile(file))
          .digest('hex')
      };
  }
  return result;
}
async function run() {
  const pkg = require('../package.json'),
    dist = path.resolve(__dirname, '../dist'),
    base = `Steam-Animated-Screensaver-${pkg.version}-macos-arm64`,
    appName = pkg.productName + '.app';
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sas-archives-')),
    mount = path.join(root, 'mount'),
    extract = path.join(root, 'extract');
  let mounted = false;
  try {
    await fs.mkdir(mount);
    await fs.mkdir(extract);
    execFileSync('ditto', ['-x', '-k', path.join(dist, base + '.zip'), extract]);
    execFileSync(
      'hdiutil',
      ['attach', '-nobrowse', '-readonly', '-mountpoint', mount, path.join(dist, base + '.dmg')],
      { stdio: 'pipe' }
    );
    mounted = true;
    const original = await manifest(
      path.join(dist, 'Steam Animated Screensaver-darwin-arm64', appName)
    );
    const zipApp = path.join(extract, appName),
      dmgApp = path.join(mount, appName);
    assert.deepEqual(await manifest(zipApp), original);
    assert.deepEqual(await manifest(dmgApp), original);
    for (const app of [zipApp, dmgApp])
      execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'pipe' });
    const executable = execFileSync(
      'plutil',
      ['-extract', 'CFBundleExecutable', 'raw', path.join(zipApp, 'Contents/Info.plist')],
      { encoding: 'utf8' }
    ).trim();
    const smoke = execFileSync(path.join(zipApp, 'Contents/MacOS', executable), [], {
      env: {
        ...process.env,
        SAS_DATA_DIR: path.join(root, 'data'),
        SAS_SMOKE_TEST: '1',
        STEAM_ROOT: path.join(root, 'Steam')
      },
      encoding: 'utf8',
      timeout: 30000,
      maxBuffer: 1024 * 1024
    });
    assert(smoke.includes('SAS_SMOKE_OK'));
    assert(smoke.includes('"node":"undefined"'));
    const report = {
      version: pkg.version,
      result: 'passed',
      files: Object.values(original).filter((x) => x.sha256).length,
      symlinks: Object.values(original).filter((x) => x.link).length,
      checks: [
        'Final ZIP and mounted DMG app contents byte-match the tested app',
        'Framework symlinks survive ZIP and DMG extraction',
        'Both extracted app signatures verify strictly',
        'Freshly extracted final ZIP app launches with isolated data, working IPC and no renderer Node access'
      ]
    };
    await fs.writeFile(
      path.join(dist, 'MACOS_ARCHIVE_VALIDATION.json'),
      JSON.stringify(report, null, 2) + '\n'
    );
    console.log(JSON.stringify(report, null, 2));
  } finally {
    if (mounted) execFileSync('hdiutil', ['detach', mount], { stdio: 'pipe' });
    await fs.rm(root, { recursive: true, force: true });
  }
}
run().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
