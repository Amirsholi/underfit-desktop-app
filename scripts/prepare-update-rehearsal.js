// Creates an isolated NSIS update exercise outside the repository.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = path.join(process.env.LOCALAPPDATA, 'UnderFitRehearsal', `update-check-${Date.now()}`);
const app = path.join(root, 'app');
fs.mkdirSync(app, { recursive: true });
function copyDependency(name, from, destination) {
  const req = createRequire(path.join(from, 'package.json'));
  const source = path.dirname(req.resolve(`${name}/package.json`));
  const target = path.join(destination, 'node_modules', name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true, filter: file => !file.slice(source.length).split(path.sep).includes('node_modules') });
  for (const dependency of Object.keys(JSON.parse(fs.readFileSync(path.join(source, 'package.json'))).dependencies || {}))
    copyDependency(dependency, source, target);
}
copyDependency('electron-updater', path.resolve('.'), app);
for (const file of ['startupUpdates.js', 'installDownloadedUpdate.js'])
  fs.copyFileSync(path.join('services', file), path.join(app, file));
fs.writeFileSync(path.join(app, 'rehearsal.json'), JSON.stringify({ root }));
fs.writeFileSync(path.join(app, 'package.json'), JSON.stringify({ name: 'underfit-update-rehearsal',
  productName: 'UnderFit Update Rehearsal', version: '0.0.1', description: 'Isolated updater verification',
  author: 'UnderFit', main: 'main.js', dependencies: { 'electron-updater': '6.8.9' } }, null, 2));
fs.writeFileSync(path.join(app, 'main.js'), `
const { app, autoUpdater: nativeUpdater } = require('electron');
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const { root } = require('./rehearsal.json');
app.setPath('userData', path.join(root, 'profile'));
const record = (event, detail) => fs.appendFileSync(path.join(root, 'events.jsonl'), JSON.stringify({ event, detail, version: app.getVersion(), at: new Date().toISOString() })+'\\n');
app.whenReady().then(async () => {
  const sentinel = path.join(app.getPath('userData'), 'preserved-data.json');
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  if (!fs.existsSync(sentinel)) fs.writeFileSync(sentinel, JSON.stringify({ marker: crypto.randomUUID(), createdBy: app.getVersion() }), { flag: 'wx' });
  record('started', crypto.createHash('sha256').update(fs.readFileSync(sentinel)).digest('hex'));
  if (app.getVersion() === '0.0.2') { record('verified-new-version', 'profile preserved'); app.quit(); return; }
  const { autoUpdater } = require('electron-updater');
  autoUpdater.disableDifferentialDownload = true;
  const result = await require('./startupUpdates').runStartupUpdate({ updater: autoUpdater,
    backup: async () => {
      const destination = path.join(root, 'before-update.json');
      fs.copyFileSync(sentinel, destination); record('backup', destination);
      return { created: true, path: destination };
    },
    install: () => require('./installDownloadedUpdate').installDownloadedUpdate(autoUpdater, nativeUpdater), log: record });
  record('result', result);
  if (!result.installing) app.quit();
}).catch(error => { record('fatal', error.message); app.exit(1); });
`);
const config = { appId: 'com.underfit.update-rehearsal', productName: 'UnderFit Update Rehearsal',
  directories: { app, output: path.join(root, 'v1') },
  electronDist: path.resolve('node_modules/electron/dist'), electronVersion: require('../node_modules/electron/package.json').version,
  npmRebuild: false, asar: true, files: ['**/*'], win: { target: 'nsis' },
  nsis: { oneClick: true, perMachine: false, createDesktopShortcut: false, createStartMenuShortcut: false,
    include: path.resolve('assets/installer.nsh'),
    runAfterFinish: false, artifactName: 'UnderFit-Update-Rehearsal-${version}.exe' },
  publish: [{ provider: 'generic', url: 'http://127.0.0.1:5298/' }] };
fs.writeFileSync(path.join(root, 'builder.json'), JSON.stringify(config, null, 2));
console.log(root);
