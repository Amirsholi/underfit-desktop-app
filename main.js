const { app, BrowserWindow, screen, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const { getDbPathFromConfigOrDefault } = require('./config');
const { ensureWeeklyBackup } = require('./backup');
const { ejecutarMigraciones } = require('./migrations');

let mainWindow;
let userWindow;
let inactivityTimer;
let userDisplayId = null;

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
    mainWindow.focus();
  }

  if (userWindow) {
    if (userWindow.isMinimized()) userWindow.restore();
    userWindow.focus();
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
  mainWindow.loadFile('index.html');

  function resetInactivity() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
      if (userWindow) {
        userWindow.focus();
        userWindow.webContents.send('enfocar-input');
      }
    }, 5000);
  }

  mainWindow.webContents.on('before-input-event', () => resetInactivity());
  mainWindow.webContents.on('cursor-changed', () => resetInactivity());
  mainWindow.on('focus', () => resetInactivity());

  resetInactivity();
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

  globalShortcut.register('CommandOrControl+Alt+P', () => {
    moveUserWindowToNextDisplay();
  });
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
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: !app.isPackaged,
    },
  });

  userWindow.setMenu(null);
  userWindow.loadFile('user.html');

  userWindow.on('focus', () => {
    userWindow.webContents.send('enfocar-input');
  });

  moveMainWindowToAdminDisplay(kioskDisplay);
}

app.whenReady().then(async () => {
  const dbPath = getDbPathFromConfigOrDefault();
  logDev('DB en uso:', dbPath);

  try {
    const backup = ensureWeeklyBackup(dbPath);
    if (backup.created) {
      logDev('Backup semanal creado en:', backup.path);
    }
  } catch (error) {
    logError('No se pudo crear el backup semanal:', error);
  }

  try {
    await ejecutarMigraciones(dbPath);
  } catch (error) {
    logError('Error ejecutando migraciones:', error);
  }

  require('./ipcHandlers');
  registerDisplayControls();

  createMainWindow();
  createUserWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
