'use strict';
const { app, BrowserWindow, ipcMain, protocol, net, session, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { resolveFile, CSP } = require('./scripts/local-files.cjs');

if (process.env.CINEMA_DATA_DIR) {
  const profile = path.join(path.resolve(process.env.CINEMA_DATA_DIR), 'electron-profile');
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
const lock = app.requestSingleInstanceLock();
if (!lock) app.quit();
let core,
  win,
  quitting = false,
  quitReady = false;
const actions = new Set([
  'state',
  'scan',
  'search',
  'add',
  'updateGame',
  'remove',
  'artworks',
  'prepare',
  'pause',
  'resume',
  'cancel',
  'retry',
  'settings',
  'setKey',
  'validateKey',
  'clearUnused',
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
    title: 'SteamOS Animated Screensaver',
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
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const target = new URL(url);
      if (
        target.protocol === 'https:' &&
        !target.username &&
        !target.password &&
        !target.port &&
        ['www.steamgriddb.com', 'cdn.steamgriddb.com', 'cdn2.steamgriddb.com'].includes(
          target.hostname
        )
      )
        shell.openExternal(target.href);
    } catch {}
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (url !== 'app://cinema/manager/index.html') event.preventDefault();
  });
  win.webContents.on('will-attach-webview', (event) => event.preventDefault());
  win.loadURL('app://cinema/manager/index.html');
  if (process.env.CINEMA_SMOKE_TEST) {
    win.webContents.once('did-finish-load', async () => {
      try {
        const result = await win.webContents.executeJavaScript(
          `Promise.all([window.cinema.invoke('state'),Promise.resolve({title:document.title,node:typeof require,bridge:typeof window.cinema.invoke})])`
        );
        console.log(
          'CINEMA_SMOKE_OK',
          JSON.stringify({
            games: result[0].games.length,
            hasKey: result[0].hasKey,
            renderer: result[1]
          })
        );
      } catch {
        console.error('CINEMA_SMOKE_FAILED');
        process.exitCode = 1;
      }
      app.quit();
    });
  }
}

app
  .whenReady()
  .then(async () => {
    const dataDir =
      process.env.CINEMA_DATA_DIR ||
      path.join(app.getPath('appData'), 'steamos-animated-screensaver');
    const { createCore } = require('./core/index.cjs');
    core = await createCore({ dataDir });
    protocol.handle('app', async (request) => {
      if (new URL(request.url).host !== 'cinema') return new Response('Not found', { status: 404 });
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
    ipcMain.handle('cinema:invoke', async (event, action, payload = {}) => {
      if (
        event.senderFrame !== win?.webContents.mainFrame ||
        event.senderFrame.url !== 'app://cinema/manager/index.html' ||
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
  .catch(() => {
    console.error(
      'Could not start SteamOS Animated Screensaver. Check write permissions for the application data directory.'
    );
    app.exit(1);
  });
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
  Promise.resolve(core.close()).finally(() => {
    quitReady = true;
    app.quit();
  });
});
