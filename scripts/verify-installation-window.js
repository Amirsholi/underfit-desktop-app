const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.join(process.env.LOCALAPPDATA, 'UnderFitRehearsal', 'installation-window-check');
app.setPath('userData', path.join(root, 'profile'));
app.whenReady().then(async () => {
  fs.mkdirSync(path.join(root, 'platform'), { recursive: true });
  fs.writeFileSync(path.join(root, 'platform', 'first-installation.json'), JSON.stringify({ status: 'complete' }));
  const archive = path.resolve('dist/win-unpacked/resources/app.asar');
  await require(path.join(archive, 'services/firstInstallation')).runFirstInstallation({
    userDataPath: root, resourcesPath: path.dirname(archive),
  });
  const win = new BrowserWindow({ width:600,height:340,show:false,
    webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true} });
  await win.loadFile(path.join(archive, 'installation-progress.html'));
  await win.webContents.executeJavaScript("document.getElementById('status').textContent='Verificando socios, vencimientos, caja, pagos e historial…'");
  const fits = await win.webContents.executeJavaScript('document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight');
  assert.ok(fits, 'Progress content must fit the window');
  fs.writeFileSync(path.join(root, 'progress.png'), (await win.webContents.capturePage()).toPNG());
  win.destroy();
  console.log('PASS: packaged migration worker loads in Electron; progress window fits.');
  app.quit();
}).catch(error=>{console.error(error);app.exit(1);});
