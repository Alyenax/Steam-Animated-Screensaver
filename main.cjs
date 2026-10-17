'use strict';
const {
  app,
  BrowserWindow,
  ipcMain,
  protocol,
  net,
  session,
  shell,
  crashReporter
} = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { resolveFile, CSP } = require('./scripts/local-files.cjs');

// Preserve explicit development-directory overrides from older builds.
const explicitDataDir = process.env.SAS_DATA_DIR || process.env.CINEMA_DATA_DIR;
if (process.env.SAS_APP_DATA_ROOT)
  app.setPath('appData', path.resolve(process.env.SAS_APP_DATA_ROOT));
{
  // Keep Chromium's early single-instance lock from creating the new catalog folder before migration.
  const profile =
    process.env.SAS_UPDATE_PROFILE && /^[a-f0-9]{32}$/.test(process.env.SAS_UPDATE_TOKEN || '')
      ? path.resolve(process.env.SAS_UPDATE_PROFILE)
      : explicitDataDir
        ? path.join(path.resolve(explicitDataDir), 'electron-profile')
        : path.join(app.getPath('appData'), 'steam-animated-screensaver-electron');
  require('node:fs').mkdirSync(profile, { recursive: true });
  app.setPath('userData', profile);
  app.setPath('logs', path.join(profile, 'logs'));
  app.setPath('crashDumps', path.join(profile, 'crashes'));
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
  }
]);
app.enableSandbox();
if (process.platform === 'win32')
  app.setAppUserModelId('io.github.alyenax.steam-animated-screensaver');
const lock = app.requestSingleInstanceLock();
if (!lock) app.quit();
let diagnostics;
const earlyEvents = [];
function report(level, event, detail) {
  if (!diagnostics && level === 'fatal') {
    try {
      diagnostics = require('./core/diagnostics.cjs').createDiagnostics({
        dataDir: path.join(app.getPath('appData'), 'steam-animated-screensaver-diagnostics')
      });
    } catch {}
  }
  if (diagnostics) diagnostics.record(level, event, detail);
  else earlyEvents.push({ level, event, detail });
}
process.on('uncaughtException', (error) => {
  report('fatal', 'main.uncaught_exception', { error });
  app.exit(1);
});
process.on('unhandledRejection', (reason) =>
  report('error', 'main.unhandled_rejection', { error: reason })
);
app.on('child-process-gone', (_event, detail) =>
  report('error', 'electron.child_process_gone', detail)
);
let updater,
  core,
  win,
  quitting = false,
  quitReady = false;
const actions = new Set([
  'state',
  'appUpdateCheck',
  'appUpdateDownload',
  'appUpdateCancel',
  'appUpdatePreferences',
  'appUpdateInstall',
  'appUpdateRelease',
  'steamIdleState',
  'setSteamIdle',
  'diagnosticsEvent',
  'openLogs',
  'scan',
  'search',
  'add',
  'updateGame',
  'setIncluded',
  'selectLibraryTop',
  'importPopular',
  'cancelSelection',
  'remove',
  'artworks',
  'covers',
  'setCover',
  'logos',
  'setLogo',
  'previewImage',
  'prepare',
  'pause',
  'resume',
  'cancel',
  'retry',
  'settings',
  'setKey',
  'setSteamAccount',
  'importSteamLibrary',
  'validateKey',
  'clearUnused',
  'purgeMedia',
  'repair',
  'install',
  'uninstall'
]);

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 680,
    minHeight: 520,
    backgroundColor: '#0b1018',
    title: 'Steam Animated Screensaver',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      spellcheck: false
    }
  });
  win.on('unresponsive', () => report('error', 'window.unresponsive', {}));
  win.on('responsive', () => report('info', 'window.responsive', {}));
  win.webContents.on('render-process-gone', (_event, detail) =>
    report('fatal', 'renderer.process_gone', detail)
  );
  win.webContents.on('did-fail-load', (_event, code, description, url, isMainFrame) =>
    report('error', 'renderer.load_failed', { code, description, url, isMainFrame })
  );
  win.webContents.on('console-message', (details) => {
    if (details.level === 'error' || details.level === 'warning')
      report(details.level === 'error' ? 'error' : 'warn', 'renderer.console', {
        message: details.message,
        source: details.sourceId,
        line: details.lineNumber
      });
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const target = new URL(url);
      if (
        target.protocol === 'https:' &&
        !target.username &&
        !target.password &&
        !target.port &&
        [
          'www.steamgriddb.com',
          'cdn.steamgriddb.com',
          'cdn2.steamgriddb.com',
          'steamcommunity.com',
          'store.steampowered.com'
        ].includes(target.hostname)
      )
        shell.openExternal(target.href);
    } catch {}
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (url !== 'app://screensaver/manager/index.html') event.preventDefault();
  });
  win.webContents.on('will-attach-webview', (event) => event.preventDefault());
  win.loadURL('app://screensaver/manager/index.html');
  if (process.env.SAS_SMOKE_TEST) {
    win.webContents.once('did-finish-load', async () => {
      try {
        const result = await win.webContents.executeJavaScript(
          `Promise.all([window.screensaver.invoke('state'),Promise.resolve({title:document.title,node:typeof require,bridge:typeof window.screensaver.invoke})])`
        );
        console.log(
          'SAS_SMOKE_OK',
          JSON.stringify({
            games: result[0].games.length,
            hasKey: result[0].hasKey,
            renderer: result[1]
          })
        );
      } catch {
        console.error('SAS_SMOKE_FAILED');
        process.exitCode = 1;
      }
      app.quit();
    });
  }
}

app
  .whenReady()
  .then(async () => {
    let dataDir =
      explicitDataDir ||
      (await require('./core/branding.cjs').dataDirectory(app.getPath('appData')));
    diagnostics = require('./core/diagnostics.cjs').createDiagnostics({ dataDir });
    dataDir = await require('node:fs/promises').realpath(dataDir);
    for (const event of earlyEvents.splice(0))
      diagnostics.record(event.level, event.event, event.detail);
    app.setPath('crashDumps', path.join(dataDir, 'logs', 'crashes'));
    crashReporter.start({ uploadToServer: false, compress: true, ignoreSystemCrashHandler: false });
    report('info', 'application.started', {
      packaged: app.isPackaged,
      version: app.getVersion(),
      steamOverride: !!process.env.STEAM_ROOT
    });
    const { createCore } = require('./core/index.cjs');
    const { createInstaller, acknowledgeUpdate } = require('./core/update-install.cjs');
    const installer = await createInstaller({
      dataDir,
      version: app.getVersion(),
      packaged: app.isPackaged,
      profileDir: app.getPath('userData'),
      protectedDirs: [
        'home',
        'desktop',
        'documents',
        'downloads',
        'appData',
        'userData',
        'temp'
      ].map((name) => app.getPath(name)),
      active:
        process.platform === 'darwin'
          ? path.resolve(process.resourcesPath, '../..')
          : path.dirname(process.execPath),
      beforeInstall: async () => {
        await core.close();
      },
      afterCloseFailure: () => {
        app.relaunch();
        app.quit();
      },
      quit: () => app.quit()
    });
    updater = require('./core/app-updates.cjs').createUpdater({
      dataDir,
      version: app.getVersion(),
      installer,
      diagnostics,
      enabled: app.isPackaged && process.env.SAS_DISABLE_UPDATE_CHECK !== '1'
    });
    await updater.init();
    core = await createCore({ dataDir, diagnostics, updater });
    app.once('browser-window-created', (_event, window) => {
      window.webContents.once('did-finish-load', async () => {
        try {
          // A live bridge, initialized library and loaded renderer must all succeed.
          await window.webContents.executeJavaScript(
            "window.screensaver.invoke('state').then(s => { if (!Array.isArray(s.games)) throw Error('Library unavailable'); return true; })"
          );
          if (await acknowledgeUpdate(dataDir, app.getVersion())) {
            report('info', 'updater.healthy_startup', { version: app.getVersion() });
            await updater.recover();
          }
        } catch (error) {
          report('error', 'updater.health_failed', { error });
        }
      });
    });
    protocol.handle('app', async (request) => {
      if (new URL(request.url).host !== 'screensaver')
        return new Response('Not found', { status: 404 });
      const target = await resolveFile(request.url, { root: __dirname, dataDir });
      if (!target) return new Response('Not found', { status: 404 });
      const response = await net.fetch(pathToFileURL(target.file).href, {
        headers: request.headers
      });
      const headers = new Headers(response.headers);
      headers.set('Content-Type', target.type);
      headers.set('Content-Security-Policy', CSP);
      headers.set('X-Content-Type-Options', 'nosniff');
      return new Response(response.body, { status: response.status, headers });
    });
    session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) =>
      callback(permission === 'fullscreen')
    );
    session.defaultSession.setPermissionCheckHandler(
      (_wc, permission) => permission === 'fullscreen'
    );
    ipcMain.handle('screensaver:invoke', async (event, action, payload = {}) => {
      if (
        event.senderFrame !== win?.webContents.mainFrame ||
        event.senderFrame.url !== 'app://screensaver/manager/index.html' ||
        !actions.has(action)
      )
        throw new Error('Action unavailable.');
      if (
        !payload ||
        typeof payload !== 'object' ||
        Array.isArray(payload) ||
        JSON.stringify(payload).length > 65536
      )
        throw new Error('Invalid request.');
      try {
        if (action === 'appUpdateCheck') return await updater.check();
        if (action === 'appUpdateDownload') return updater.download();
        if (action === 'appUpdateCancel') return await updater.cancel();
        if (action === 'appUpdatePreferences') return await updater.preferences(payload);
        if (action === 'appUpdateInstall') return await updater.install(payload.confirm);
        if (action === 'appUpdateRelease') {
          await shell.openExternal(
            'https://github.com/Alyenax/Steam-Animated-Screensaver/releases/latest'
          );
          return { opened: true };
        }
        if (action === 'openLogs') {
          shell.showItemInFolder(diagnostics.file);
          return { opened: true };
        }
        return await core.invoke(action, payload);
      } catch (error) {
        throw new Error(error.message || 'The operation could not be completed.');
      }
    });
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  })
  .catch((error) => {
    if (!diagnostics) {
      try {
        diagnostics = require('./core/diagnostics.cjs').createDiagnostics({
          dataDir: path.join(app.getPath('appData'), 'steam-animated-screensaver-diagnostics')
        });
      } catch {}
    }
    report('fatal', 'application.start_failed', { error });
    console.error(
      'Could not start Steam Animated Screensaver. Check write permissions for the application data directory.'
    );
    app.exit(1);
  });
process.on('SIGTERM', () => app.quit());
app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});
app.on('window-all-closed', () => {
  if (!quitting) app.quit();
});
app.on('before-quit', (event) => {
  if (!core || quitReady) return;
  event.preventDefault();
  if (quitting) return;
  quitting = true;
  if (win && !win.isDestroyed()) win.destroy();
  Promise.resolve(core.close())
    .then(() => updater?.close())
    .finally(() => {
      report('info', 'application.closed', {});
      diagnostics?.close();
      quitReady = true;
      app.quit();
    });
});
