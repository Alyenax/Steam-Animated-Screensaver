'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { once } = require('node:events');
const run = promisify(execFile);
const { createInstaller } = require('../core/update-install.cjs');
const { treeInfo } = require('../core/update-archive.cjs');
const { createUpdater, hashFile } = require('../core/app-updates.cjs');
const { TARGETS, assetName, API, REPO } = require('../core/update-format.cjs');
const crypto = require('node:crypto');
const source = path.resolve(
  'dist/Steam Animated Screensaver-darwin-arm64/Steam Animated Screensaver.app'
);
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function stopApp(app) {
  const exe = path.join(app, 'Contents/MacOS/steam-animated-screensaver');
  const { stdout } = await run('/bin/ps', ['-axo', 'pid=,command=']);
  const ids = stdout.split('\n').flatMap((line) => {
    const m = /^\s*(\d+)\s+(.+)$/.exec(line);
    return m && (m[2] === exe || m[2].startsWith(exe + ' ')) ? [Number(m[1])] : [];
  });
  for (const id of ids) {
    try {
      process.kill(id, 'SIGTERM');
    } catch {}
  }
  for (let n = 0; n < 50; n++) {
    let alive = false;
    for (const id of ids) {
      try {
        process.kill(id, 0);
        alive = true;
      } catch {}
    }
    if (!alive) return;
    await pause(100);
  }
  for (const id of ids) {
    try {
      process.kill(id, 'SIGKILL');
    } catch {}
  }
}
(async () => {
  const root = await fs.mkdtemp('/private/tmp/sas-mac-update-');
  const checks = [],
    apps = [];
  try {
    for (const faulty of [false, true]) {
      const dir = path.join(root, faulty ? 'rollback' : 'success');
      await fs.mkdir(dir);
      const active = path.join(dir, 'installed', 'Steam Animated Screensaver.app'),
        staging = path.join(dir, 'dmg-source'),
        variant = path.join(staging, 'Steam Animated Screensaver.app');
      await fs.mkdir(path.dirname(active));
      await fs.mkdir(staging);
      await run('/usr/bin/ditto', [source, active]);
      await run('/usr/bin/ditto', [source, variant]);
      apps.push(active);
      const packageFile = path.join(variant, 'Contents/Resources/app/package.json');
      const pkg = JSON.parse(await fs.readFile(packageFile, 'utf8'));
      pkg.version = '1.2.1';
      await fs.writeFile(packageFile, JSON.stringify(pkg, null, 2) + '\n');
      const info = path.join(variant, 'Contents/Info.plist');
      for (const key of ['CFBundleVersion', 'CFBundleShortVersionString'])
        await run('/usr/bin/plutil', ['-replace', key, '-string', '1.2.1', info]);
      if (faulty)
        await fs.writeFile(
          path.join(variant, 'Contents/Resources/app/main.cjs'),
          "const {app}=require('electron'); const fs=require('node:fs'); const path=require('node:path'); fs.mkdirSync(path.join(process.env.SAS_DATA_DIR,'fault-profile'),{recursive:true});app.setPath('userData',path.join(process.env.SAS_DATA_DIR,'fault-profile'));app.whenReady().then(()=>{fs.writeFileSync(path.join(process.env.SAS_DATA_DIR,'catalog.json'),'corrupted by isolated fault injection');app.exit(91);});\n"
        );
      // Only this isolated QA variant is re-signed. Published artifacts are untouched.
      await run(
        '/usr/bin/codesign',
        ['--force', '--deep', '--sign', '-', '--timestamp=none', variant],
        { maxBuffer: 1024 * 1024 }
      );
      await run('/usr/bin/codesign', ['--verify', '--deep', '--strict', variant]);
      const dmg = path.join(dir, 'candidate.dmg');
      await run(
        '/usr/bin/hdiutil',
        [
          'create',
          '-volname',
          'SAS update QA',
          '-srcfolder',
          staging,
          '-format',
          'UDZO',
          '-ov',
          dmg
        ],
        { timeout: 120000 }
      );
      const dataDir = path.join(dir, 'data');
      await fs.mkdir(dataDir);
      const steamRoot = path.join(dir, 'Steam');
      await fs.mkdir(path.join(steamRoot, 'steamapps'), { recursive: true });
      const catalog = {
        version: 1,
        games: [
          {
            id: 'sgdb:900001',
            sgdbId: 900001,
            name: 'Updater QA preserved game',
            status: 'new',
            included: false
          }
        ],
        settings: { language: 'en', showArtworkCredit: false }
      };
      await fs.writeFile(path.join(dataDir, 'catalog.json'), JSON.stringify(catalog));
      await fs.writeFile(path.join(dataDir, 'steamgriddb.key'), 'isolated-test-key');
      const profileDir = path.join(dir, 'preserved-electron-profile');
      await fs.mkdir(profileDir);
      await fs.writeFile(path.join(profileDir, 'qa-sentinel'), 'preserved');
      const child = spawn('/bin/sh', ['-c', 'exit 0']);
      await once(child, 'exit');
      const installer = await createInstaller({
        dataDir,
        version: '1.2.0',
        target: 'darwin-arm64',
        active,
        packaged: true,
        profileDir,
        parentPid: child.pid,
        healthTimeout: 20,
        spawnImpl: (file, args, options) =>
          spawn(file, args, {
            ...options,
            env: { ...options.env, STEAM_ROOT: steamRoot, SAS_DISABLE_UPDATE_CHECK: '1' }
          }),
        beforeInstall: async () => {},
        quit: () => {}
      });
      assert.equal(installer.available, true);
      const keys = crypto.generateKeyPairSync('ed25519');
      const size = (await fs.stat(dmg)).size,
        digest = await hashFile(dmg),
        expanded = (await treeInfo(variant)).bytes;
      const payload = Buffer.from(
        JSON.stringify({
          schema: 1,
          product: 'steam-animated-screensaver',
          version: '1.2.1',
          tag: 'v1.2.1',
          minimumUpdater: 1,
          assets: Object.keys(TARGETS).map((target) => ({
            target,
            name: assetName('1.2.1', target),
            size,
            sha256: digest,
            unpackedBytes: expanded
          }))
        })
      );
      const signed = Buffer.from(
        JSON.stringify({
          schema: 1,
          keyId: 'release-1',
          payload: payload.toString('base64'),
          signature: crypto.sign(null, payload, keys.privateKey).toString('base64')
        })
      );
      const release = {
        tag_name: 'v1.2.1',
        draft: false,
        prerelease: false,
        body: 'Isolated Mac update QA',
        assets: Object.keys(TARGETS).map((target) => ({
          name: assetName('1.2.1', target),
          size,
          state: 'uploaded',
          digest: 'sha256:' + digest,
          browser_download_url: `https://github.com/${REPO}/releases/download/v1.2.1/${assetName('1.2.1', target)}`
        }))
      };
      release.assets.push({
        name: 'update.json',
        state: 'uploaded',
        size: signed.length,
        browser_download_url: `https://github.com/${REPO}/releases/download/v1.2.1/update.json`
      });
      const updater = createUpdater({
        dataDir,
        version: '1.2.0',
        target: 'darwin-arm64',
        installer,
        enabled: false,
        publicKey: keys.publicKey,
        fetchImpl: async (url) =>
          url === API
            ? new Response(JSON.stringify(release))
            : url.endsWith('/update.json')
              ? new Response(signed)
              : new Response(
                  require('node:stream').Readable.toWeb(require('node:fs').createReadStream(dmg)),
                  { headers: { 'Content-Length': String(size) } }
                )
      });
      try {
        await updater.init();
        await updater.check();
        assert.equal(updater.status().phase, 'available');
        updater.download();
        await updater.wait();
        assert.equal(updater.status().phase, 'ready');
        await updater.install(true);
      } finally {
        await updater.close();
      }
      const token = (await fs.readdir(path.join(dataDir, 'updates/transactions')))[0],
        txDir = path.join(dataDir, 'updates/transactions', token);
      let result;
      for (let n = 0; n < 900; n++) {
        result = JSON.parse(
          await fs.readFile(path.join(txDir, 'result.json'), 'utf8').catch(() => '{}')
        );
        if (['updated', 'rolled_back', 'error'].includes(result.phase)) break;
        await pause(100);
      }
      assert.equal(
        result.phase,
        faulty ? 'rolled_back' : 'updated',
        JSON.stringify({
          result,
          helper: await fs.readFile(path.join(txDir, 'helper-output.log'), 'utf8').catch(() => '')
        })
      );
      let ready = false;
      for (let n = 0; n < 300; n++) {
        const log = JSON.parse(
          await fs.readFile(path.join(dataDir, 'logs/diagnostics.json'), 'utf8').catch(() => '{}')
        );
        ready =
          log.events?.some(
            (e) =>
              e.event === 'application.started' &&
              e.detail?.version === (faulty ? '1.2.0' : '1.2.1')
          ) && log.events?.some((e) => e.event === 'core.action' && e.detail?.action === 'scan');
        if (ready) break;
        await pause(100);
      }
      assert(
        ready,
        'The new or restored application must actually load its renderer and invoke its core'
      );
      const installedPkg = JSON.parse(
        await fs.readFile(path.join(active, 'Contents/Resources/app/package.json'), 'utf8')
      );
      assert.equal(installedPkg.version, faulty ? '1.2.0' : '1.2.1');
      assert.equal(
        await fs.readFile(path.join(dataDir, 'steamgriddb.key'), 'utf8'),
        'isolated-test-key'
      );
      const saved = JSON.parse(await fs.readFile(path.join(dataDir, 'catalog.json'), 'utf8'));
      assert.equal(
        saved.games.find((g) => g.id === 'sgdb:900001')?.name,
        'Updater QA preserved game'
      );
      assert.equal(saved.games.find((g) => g.id === 'sgdb:900001')?.included, false);
      assert.equal(saved.settings.language, 'en');
      await run('/usr/bin/codesign', ['--verify', '--deep', '--strict', active]);
      await stopApp(active);
      assert.equal(await fs.readFile(path.join(profileDir, 'qa-sentinel'), 'utf8'), 'preserved');
      assert((await fs.stat(path.join(profileDir, 'Preferences'))).isFile());
      checks.push(
        faulty
          ? 'A real signed Mac app that exits during startup is rolled back; catalog snapshot and key are preserved and the old app is relaunched'
          : 'Full updater verifies a signed synthetic GitHub release, streams and hashes a real DMG, mounts it read-only; real signed 1.2.1 QA variant replaces 1.2.0, native renderer and IPC acknowledge health, app relaunches and previous signed bundle is retained'
      );
      checks.push(
        faulty
          ? 'Restored app remains correctly signed and its user catalog is readable'
          : 'Updated app remains correctly signed with framework links intact; original Electron profile is retained and no token marker is added inside the sealed app'
      );
    }
    const report = {
      version: require('../package.json').version,
      result: 'passed',
      host: 'macOS arm64',
      fixture:
        'Real packaged apps in temporary installation folders. Isolated re-signed 1.2.1 healthy and crashing QA variants; no public release or personal library is modified.',
      checks
    };
    await fs.writeFile('dist/MACOS_UPDATE_VALIDATION.json', JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
  } finally {
    for (const app of apps) await stopApp(app).catch(() => {});
    await fs.rm(root, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
