const { app, BrowserWindow, screen, ipcMain, globalShortcut, Tray, Menu, dialog } = require('electron');
const path = require('path');
const { getDbPathFromConfigOrDefault } = require('./config');
const { ensureWeeklyBackup, ensureDailyPostgresBackup, createManualPostgresBackup } = require('./backup');
const { resolveDataSourceMode } = require('./services/dataSourceMode');
const { ensurePlatformReady, stopManagedApi } = require('./services/platformRuntime');
const { loadInstallationEnvironment } = require('./services/installationConfig');
const { ejecutarMigraciones } = require('./migrations');

let mainWindow;
let userWindow;
let tabletWindow;
let userDisplayId = null;
let tray;
let shutdownRequested = false;
let automaticBackupTimer;
let usbKeypad;

function logDev(...args) {
  if (!app.isPackaged) {
    console.log(...args);
  }
}

function logError(...args) {
  console.error(...args);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }

  if (userWindow) {
    if (userWindow.isMinimized()) userWindow.restore();
    userWindow.webContents.send('enfocar-input');
  }
});

function createMainWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { x, y, width, height } = getCenteredWindowBounds(primaryDisplay, 1080, 720);

  mainWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: !app.isPackaged,
    },
  });

  mainWindow.setMenu(null);
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
  });
  usbKeypad?.attach(mainWindow);
  mainWindow.on('close', event => {
    if (shutdownRequested) return;
    event.preventDefault();
    mainWindow.hide();
  });
}

function configureBackgroundOperation() {
  const isClient = process.env.UNDERFIT_INSTALLATION_ROLE === 'client';
  if (app.isPackaged && !isClient) {
    app.setLoginItemSettings({
      openAtLogin: true,
      path: process.execPath,
    });
  }
  tray = new Tray(path.join(__dirname, 'logo.jpg'));
  tray.setToolTip(isClient ? 'Under-Fit · conectado al gimnasio' : 'Under-Fit · servidor activo');
  tray.setContextMenu(Menu.buildFromTemplate([
    ...(!isClient ? [{ label: 'Vincular pad USB de ingreso', click: () => usbKeypad?.pair() }] : []),
    {
      label: 'Abrir Under-Fit',
      click: () => {
        if (mainWindow?.isMinimized()) mainWindow.restore();
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    {
      label: isClient ? 'Salir de Under-Fit' : 'Salir y detener el servidor',
      click: () => {
        shutdownRequested = true;
        app.quit();
      },
    },
  ]));
  tray.on('double-click', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}

function scheduleAutomaticPostgresBackups(dbPath) {
  const run = () => {
    try {
      const result = ensureDailyPostgresBackup(dbPath);
      if (result.created) logDev('Backup diario creado en:', result.path);
    } catch (error) {
      logError('No se pudo crear el backup diario:', error);
    }
  };
  automaticBackupTimer = setInterval(run, 6 * 60 * 60 * 1000);
}

function getCenteredWindowBounds(display, preferredWidth, preferredHeight) {
  const area = display.workArea || display.bounds;
  const width = Math.min(preferredWidth, area.width);
  const height = Math.min(preferredHeight, area.height);

  return {
    x: area.x + Math.round((area.width - width) / 2),
    y: area.y + Math.round((area.height - height) / 2),
    width,
    height,
  };
}

function getSortedDisplays() {
  const displays = screen.getAllDisplays();
  return displays.sort((a, b) => (a.bounds.x - b.bounds.x) || (a.bounds.y - b.bounds.y));
}

function getInitialUserDisplay() {
  const displays = getSortedDisplays();
  const primaryDisplay = screen.getPrimaryDisplay();
  return displays.find(display => display.id !== primaryDisplay.id) || primaryDisplay;
}

function moveMainWindowToAdminDisplay(userDisplay) {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const displays = getSortedDisplays();
  const adminDisplay = displays.find(display => display.id !== userDisplay.id) || userDisplay;
  const bounds = getCenteredWindowBounds(adminDisplay, 1080, 720);

  mainWindow.setBounds(bounds);
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
}

function applyUserDisplay(display) {
  if (!userWindow || userWindow.isDestroyed() || !display) return null;

  userDisplayId = display.id;

  userWindow.setKiosk(false);
  userWindow.setFullScreen(false);
  userWindow.setBounds(display.bounds);
  userWindow.setFullScreen(true);
  userWindow.setKiosk(true);
  userWindow.focus();
  userWindow.webContents.send('enfocar-input');
  moveMainWindowToAdminDisplay(display);

  return {
    id: display.id,
    bounds: display.bounds,
  };
}

function moveUserWindowToNextDisplay() {
  const displays = getSortedDisplays();
  if (!userWindow || userWindow.isDestroyed() || displays.length < 2) {
    return {
      moved: false,
      reason: displays.length < 2 ? 'single_display' : 'window_unavailable',
      displayCount: displays.length,
    };
  }

  const currentIndex = Math.max(0, displays.findIndex(display => display.id === userDisplayId));
  const nextDisplay = displays[(currentIndex + 1) % displays.length];
  const displayInfo = applyUserDisplay(nextDisplay);

  return {
    moved: true,
    displayCount: displays.length,
    display: displayInfo,
  };
}

function registerDisplayControls() {
  ipcMain.handle('cambiar-pantalla-puerta', () => moveUserWindowToNextDisplay());
  ipcMain.handle('abrir-pantalla-tablet', () => openTabletWindow());

  globalShortcut.register('CommandOrControl+Alt+P', () => {
    moveUserWindowToNextDisplay();
  });
}

function openTabletWindow() {
  if (tabletWindow && !tabletWindow.isDestroyed()) {
    if (tabletWindow.isMinimized()) tabletWindow.restore();
    tabletWindow.focus();
    return { opened: true, reused: true };
  }

  tabletWindow = new BrowserWindow({
    width: 1100,
    height: 780,
    minWidth: 820,
    minHeight: 640,
    autoHideMenuBar: true,
    backgroundColor: '#07090d',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: !app.isPackaged,
    },
  });
  tabletWindow.setMenu(null);
  tabletWindow.loadFile(path.join(__dirname, 'tablet.html'));
  tabletWindow.on('closed', () => { tabletWindow = null; });
  return { opened: true, reused: false };
}

function createUserWindow() {
  const kioskDisplay = getInitialUserDisplay();
  userDisplayId = kioskDisplay.id;
  const { x, y, width, height } = kioskDisplay.bounds;

  userWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    fullscreen: true,
    kiosk: true,
    autoHideMenuBar: true,
    webPreferences: {
      autoplayPolicy: 'no-user-gesture-required',
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: !app.isPackaged,
    },
  });

  userWindow.setMenu(null);
  usbKeypad?.attach(userWindow);
  userWindow.loadFile(path.join(__dirname, 'user.html'));

  userWindow.on('focus', () => {
    userWindow.webContents.send('enfocar-input');
  });

  moveMainWindowToAdminDisplay(kioskDisplay);
}

app.whenReady().then(async () => {
  try {
    if (app.isPackaged) {
      const { prepareFirstInstallation } = require('./services/firstInstallation');
      const prepared = await prepareFirstInstallation({ userDataPath: app.getPath('userData'),
        resourcesPath: process.resourcesPath, legacyPath: getDbPathFromConfigOrDefault(), dialog });
      if (!prepared) { app.quit(); return; }
    }
    loadInstallationEnvironment({ userDataPath: app.getPath('userData'), isPackaged: app.isPackaged });
  } catch (error) {
    dialog.showErrorBox('Configuración de Under-Fit', error.message);
    app.quit();
    return;
  }
  if (app.isPackaged && !process.env.UNDERFIT_DATA_MODE) {
    process.env.UNDERFIT_DATA_MODE = 'api';
  }
  const dbPath = getDbPathFromConfigOrDefault();
  const dataSource = resolveDataSourceMode(process.env);
  logDev('Fuente de datos en uso:', dataSource.mode);

  if (dataSource.mode === 'api') {
    let setupWindow;
    try {
      const setup = app.isPackaged && require('./services/firstInstallation').readState(app.getPath('userData'));
      if (setup && setup.status !== 'complete') {
        setupWindow = new BrowserWindow({ width: 600, height: 340, resizable: false, closable: false,
          autoHideMenuBar: true, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } });
        await setupWindow.loadFile(path.join(__dirname, 'installation-progress.html'));
        setupWindow.show();
      }
      const onProgress = async text => {
        if (setupWindow && !setupWindow.isDestroyed()) {
          await setupWindow.webContents.executeJavaScript(`document.getElementById('status').textContent = ${JSON.stringify(text)}`);
        }
      };
      const platform = await ensurePlatformReady({
        baseUrl: dataSource.apiBaseUrl,
        isPackaged: app.isPackaged,
        resourcesPath: process.resourcesPath,
        userDataPath: app.getPath('userData'),
        onProgress,
        beforeExpose: async () => {
          if (!app.isPackaged) return;
          await require('./services/firstInstallation').runFirstInstallation({
            userDataPath: app.getPath('userData'), resourcesPath: process.resourcesPath, onProgress });
        },
        beforeStart: async () => {
          if (!app.isPackaged) return false;
          const setup = require('./services/firstInstallation').readState(app.getPath('userData'));
          if (setup && setup.status !== 'complete') return false;
          const { autoUpdater } = require('electron-updater');
          const { runStartupUpdate } = require('./services/startupUpdates');
          const result = await runStartupUpdate({
            updater: autoUpdater,
            backup: () => process.env.UNDERFIT_INSTALLATION_ROLE === 'client'
              ? { created: true, path: 'Cliente remoto: datos conservados en el servidor del gimnasio.' }
              : createManualPostgresBackup(dbPath),
            install: () => require('./services/installDownloadedUpdate').installDownloadedUpdate(
              autoUpdater, require('electron').autoUpdater),
            log: (event, detail) => {
              const fs = require('fs');
              fs.appendFileSync(path.join(app.getPath('userData'), 'updates.log'),
                `${new Date().toISOString()} ${event}: ${detail}\n`);
            },
          });
          return result.installing;
        },
      });
      if (platform.updating) { shutdownRequested = true; return; }
    } catch (error) {
      logError('No se pudo iniciar la plataforma UnderFit:', error);
      dialog.showErrorBox('No se pudo iniciar Under-Fit', error.message);
      app.quit();
      return;
    } finally {
      if (setupWindow && !setupWindow.isDestroyed()) setupWindow.destroy();
    }
  }

  const isClient = process.env.UNDERFIT_INSTALLATION_ROLE === 'client';

  try {
    const backup = isClient ? { created: false } : dataSource.mode === 'api'
      ? ensureDailyPostgresBackup(dbPath)
      : ensureWeeklyBackup(dbPath);
    if (backup.created) {
      logDev('Backup semanal creado en:', backup.path);
    }
  } catch (error) {
    logError('No se pudo crear el backup semanal:', error);
  }

  if (dataSource.mode === 'local') {
    try {
      await ejecutarMigraciones(dbPath);
    } catch (error) {
      logError('Error ejecutando migraciones:', error);
    }
  }
  if (dataSource.mode === 'api' && !isClient) {
    scheduleAutomaticPostgresBackups(dbPath);
  }

  require('./ipcHandlers');
  registerDisplayControls();

  if (!isClient) {
    usbKeypad = require('./services/usbKeypad').createUsbKeypad({ app, BrowserWindow, dialog, getEntryWindow: () => userWindow });
    usbKeypad.start();
  }
  createMainWindow();
  if (!isClient) createUserWindow();
  configureBackgroundOperation();
});

app.on('before-quit', () => { usbKeypad?.stop(); stopManagedApi(); });

app.on('window-all-closed', () => {
  if (shutdownRequested && process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  if (automaticBackupTimer) clearInterval(automaticBackupTimer);
  globalShortcut.unregisterAll();
});
