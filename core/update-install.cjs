'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { atomicWrite } = require('./store.cjs');
const { TARGETS, UpdateError } = require('./update-format.cjs');
const {
  noLinks,
  space,
  extractArchive,
  prepareMac,
  validateApp,
  inside
} = require('./update-archive.cjs');
async function ownedRoot(active, target, version) {
  const entries = (await fs.readdir(active)).sort();
  if (target === 'darwin-arm64') {
    if (!active.endsWith('.app'))
      throw new UpdateError('contents', 'The update target must be an application bundle.');
    return entries;
  }
  const marker = path.join(active, '.sas-update-root.json'),
    st = await fs.lstat(marker);
  if (!st.isFile() || st.isSymbolicLink() || st.size > 65536)
    throw new UpdateError('contents', 'The application folder has no valid update boundary.');
  const m = JSON.parse(await fs.readFile(marker, 'utf8'));
  if (
    m.schema !== 1 ||
    m.product !== 'steam-animated-screensaver' ||
    (version && m.version !== version) ||
    !Array.isArray(m.entries) ||
    JSON.stringify([...m.entries, '.sas-update-root.json'].sort()) !== JSON.stringify(entries)
  )
    throw new UpdateError(
      'contents',
      'The application folder contains extra files. Install the download manually in a dedicated folder.'
    );
  return entries;
}
async function readTransaction(file, dataDir) {
  file = path.resolve(file);
  const root = path.join(dataDir, 'updates', 'transactions');
  if (!inside(root, file) || path.basename(file) !== 'transaction.json')
    throw new UpdateError('transaction', 'Invalid update transaction path.');
  await noLinks(file);
  const s = await fs.lstat(file);
  if (!s.isFile() || s.size > 65536)
    throw new UpdateError('transaction', 'Invalid transaction metadata.');
  const tx = JSON.parse(await fs.readFile(file, 'utf8'));
  if (
    tx.schema !== 1 ||
    !/^[a-f0-9]{32}$/.test(tx.token) ||
    path.basename(path.dirname(file)) !== tx.token ||
    tx.dataDir !== dataDir ||
    !TARGETS[tx.target] ||
    !path.isAbsolute(tx.active) ||
    tx.backup !==
      path.join(path.dirname(tx.active), `.${path.basename(tx.active)}.previous-${tx.token}`) ||
    tx.staged !==
      path.join(path.dirname(tx.active), `.sas-update-${tx.token}`, TARGETS[tx.target].root) ||
    tx.executable !== TARGETS[tx.target].executable ||
    !Number.isInteger(tx.parentPid) ||
    tx.parentPid < 1 ||
    !Number.isInteger(tx.healthTimeout) ||
    tx.healthTimeout < 15 ||
    tx.healthTimeout > 120
  )
    throw new UpdateError('transaction', 'The update transaction does not match its paths.');
  return tx;
}
async function acknowledgeUpdate(dataDir, version, environment = process.env) {
  const token = environment.SAS_UPDATE_TOKEN,
    health = environment.SAS_UPDATE_HEALTH;
  if (!token || !health) return false;
  const file = path.join(path.dirname(health), 'transaction.json');
  const tx = await readTransaction(file, dataDir);
  if (tx.token !== token || health !== path.join(path.dirname(file), 'health'))
    throw new UpdateError('transaction', 'The update health acknowledgement is invalid.');
  if (tx.toVersion !== version) return false; // A rollback relaunch must not acknowledge the failed new version.
  await atomicWrite(health, token);
  return true;
}
function helperCommand(tx, directory, platform = process.platform) {
  return platform === 'win32'
    ? {
        file: path.join(
          process.env.SystemRoot || 'C:\\Windows',
          'System32/WindowsPowerShell/v1.0/powershell.exe'
        ),
        args: [
          '-NoLogo',
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy',
          'Bypass',
          '-File',
          path.join(directory, 'helper.ps1'),
          '-Transaction',
          directory
        ]
      }
    : {
        file: '/bin/sh',
        args: [
          path.join(directory, 'helper.sh'),
          directory,
          String(tx.parentPid),
          tx.active,
          tx.staged,
          tx.backup,
          tx.executable,
          tx.dataDir,
          tx.token,
          String(tx.healthTimeout)
        ]
      };
}
async function createInstaller({
  dataDir,
  version,
  target = `${process.platform}-${process.arch}`,
  active,
  packaged = false,
  beforeInstall,
  afterCloseFailure,
  quit,
  spawnImpl = spawn,
  healthTimeout = 60,
  parentPid = process.pid,
  protectedDirs = [],
  profileDir
} = {}) {
  let available = false,
    reason = 'development';
  if (packaged && TARGETS[target]) {
    try {
      active = path.resolve(active);
      if (
        protectedDirs.some((p) =>
          target === 'win32-x64'
            ? path.resolve(p).toLowerCase() === active.toLowerCase()
            : path.resolve(p) === active
        )
      )
        throw new UpdateError(
          'contents',
          'A shared user folder cannot be replaced as an application.'
        );
      await noLinks(active);
      await noLinks(dataDir);
      if (dataDir === active || inside(active, dataDir))
        throw new Error('User data must be outside the application');
      await fs.access(path.dirname(active), require('node:fs').constants.W_OK);
      await validateApp(active, target, version);
      await ownedRoot(active, target, version);
      available = true;
      reason = '';
    } catch (e) {
      reason = e.code === 'contents' || e.code === 'ENOENT' ? 'contents' : 'permissions';
    }
  }
  const transactions = path.join(dataDir, 'updates', 'transactions');
  async function recover(set) {
    try {
      await noLinks(transactions);
      const names = (await fs.readdir(transactions)).filter((n) => /^[a-f0-9]{32}$/.test(n));
      const records = [];
      for (const n of names.slice(-100)) {
        try {
          const directory = path.join(transactions, n),
            tx = await readTransaction(path.join(directory, 'transaction.json'), dataDir);
          if (tx.active !== active) continue;
          const st = await fs.lstat(path.join(directory, 'result.json')).catch(() => null);
          const result =
            st?.isFile() && !st.isSymbolicLink() && st.size < 4096
              ? JSON.parse(await fs.readFile(path.join(directory, 'result.json'), 'utf8'))
              : {};
          records.push({ tx, result, directory });
        } catch {}
      }
      const last = records.sort((a, b) => a.tx.at - b.tx.at).at(-1);
      if (!last) return;
      const { tx, result, directory } = last;
      if (result.phase === 'rolled_back' || result.phase === 'error') {
        set({
          result: result.phase,
          phase: 'error',
          errorCode: 'installation',
          error: String(result.error || 'Update installation was interrupted.').slice(0, 220)
        });
      } else if (
        !['updated', 'rolled_back', 'error'].includes(result.phase) &&
        tx.fromVersion === version &&
        tx.toVersion !== version
      ) {
        const helperPid = Number(
          await fs.readFile(path.join(directory, 'helper.pid'), 'utf8').catch(() => '')
        );
        let alive = false;
        if (Number.isSafeInteger(helperPid) && helperPid > 0) {
          try {
            process.kill(helperPid, 0);
            alive = true;
          } catch {}
        }
        if (!alive)
          set({
            result: 'interrupted',
            phase: 'error',
            errorCode: 'installation',
            error:
              'The previous update was interrupted. The installed app was preserved; you can retry the update.'
          });
      } else if (
        tx.toVersion === version &&
        (result.phase === 'updated' ||
          (await fs.readFile(path.join(directory, 'health'), 'utf8').catch(() => '')) === tx.token)
      ) {
        set({
          result: 'updated',
          phase: 'up_to_date',
          availableVersion: '',
          error: '',
          errorCode: ''
        });
        // Keep the latest previous app. Older completed transactions are bounded recovery storage.
        for (const previous of records) {
          if (previous === last || !['updated', 'rolled_back'].includes(previous.result.phase))
            continue;
          const pid = Number(
            await fs.readFile(path.join(previous.directory, 'helper.pid'), 'utf8').catch(() => '')
          );
          let alive = false;
          if (Number.isSafeInteger(pid) && pid > 0) {
            try {
              process.kill(pid, 0);
              alive = true;
            } catch {}
          }
          if (alive) continue;
          for (const [folder, expected] of [
            [previous.tx.backup, previous.tx.fromVersion],
            [
              path.join(path.dirname(active), `.sas-failed-${previous.tx.token}`),
              previous.tx.toVersion
            ]
          ]) {
            try {
              await noLinks(folder);
              await validateApp(folder, target, expected);
              await fs.rm(folder, { recursive: true });
            } catch {}
          }
          const oldStage = path.dirname(previous.tx.staged);
          try {
            await noLinks(oldStage);
            await fs.rmdir(oldStage);
          } catch {}
          await fs.rm(previous.directory, { recursive: true, force: true });
        }
      }
    } catch (e) {
      if (e.code !== 'ENOENT')
        set({
          phase: 'error',
          errorCode: 'transaction',
          error: 'The previous update transaction could not be read.'
        });
    }
  }
  async function install(candidate, { signal, progress, set }) {
    if (!available)
      throw new UpdateError('installation', 'Install the application in a writable folder first.');
    const token = crypto.randomBytes(16).toString('hex'),
      directory = path.join(transactions, token),
      parent = path.dirname(active),
      stageParent = path.join(parent, `.sas-update-${token}`);
    await noLinks(parent);
    await noLinks(transactions);
    await space(parent, candidate.descriptor.unpackedBytes * 2);
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    let handedOff = false,
      didClose = false;
    try {
      const options = {
        target,
        unpackedBytes: candidate.descriptor.unpackedBytes,
        signal,
        progress
      };
      const staged =
        target === 'darwin-arm64'
          ? await prepareMac(candidate.download, stageParent, options)
          : await extractArchive(candidate.download, stageParent, options);
      await validateApp(staged, target, candidate.version);
      await ownedRoot(staged, target, candidate.version);
      signal.throwIfAborted();
      await atomicWrite(path.join(stageParent, '.sas-update-token'), token);
      const rootEntries = await ownedRoot(active, target, version);
      const tx = {
        schema: 1,
        token,
        at: Date.now(),
        target,
        fromVersion: version,
        toVersion: candidate.version,
        parentPid,
        active,
        staged,
        backup: path.join(parent, `.${path.basename(active)}.previous-${token}`),
        dataDir,
        executable: TARGETS[target].executable,
        healthTimeout,
        rootEntries
      };
      await atomicWrite(path.join(directory, 'transaction.json'), JSON.stringify(tx, null, 2));
      await atomicWrite(path.join(directory, 'token'), token);
      await atomicWrite(path.join(directory, 'root-inventory'), rootEntries.join('\n') + '\n');
      const extension = target === 'win32-x64' ? 'ps1' : 'sh';
      await fs.copyFile(
        path.join(__dirname, `update-helper.${extension}`),
        path.join(directory, `helper.${extension}`)
      );
      await fs.chmod(path.join(directory, `helper.${extension}`), 0o700);
      // Close active media jobs and commit the catalog before taking the rollback snapshot.
      set({ phase: 'installing', progress: null });
      didClose = true;
      await beforeInstall();
      const catalog = path.join(dataDir, 'catalog.json'),
        st = await fs.lstat(catalog).catch(() => null);
      if (st) {
        if (!st.isFile() || st.isSymbolicLink() || st.size > 32 * 1024 * 1024)
          throw new UpdateError('catalog', 'Cannot snapshot the library catalog.');
        await atomicWrite(path.join(directory, 'catalog-backup.json'), await fs.readFile(catalog));
      }
      const command = helperCommand(tx, directory, target === 'win32-x64' ? 'win32' : 'posix');
      const log = await fs.open(path.join(directory, 'helper-output.log'), 'a', 0o600);
      try {
        const child = spawnImpl(command.file, command.args, {
          detached: true,
          cwd: directory,
          stdio: ['ignore', log.fd, log.fd],
          windowsHide: true,
          env: { ...process.env, ...(profileDir ? { SAS_UPDATE_PROFILE: profileDir } : {}) }
        });
        await new Promise((resolve, reject) => {
          child.once('spawn', resolve);
          child.once('error', reject);
        });
        await atomicWrite(path.join(directory, 'helper.pid'), String(child.pid));
        child.unref();
        handedOff = true;
      } finally {
        await log.close();
      }
      quit();
    } finally {
      if (!handedOff) {
        await fs.rm(stageParent, { recursive: true, force: true });
        if (didClose) afterCloseFailure?.();
      }
    }
  }
  return { available, reason, install, recover };
}
module.exports = { ownedRoot, createInstaller, readTransaction, acknowledgeUpdate, helperCommand };
