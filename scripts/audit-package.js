const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const asar = require('@electron/asar');

function auditPackage(directory) {
  const resources = path.join(path.resolve(directory), 'resources');
  const archive = path.join(resources, 'app.asar');
  const entries = asar.listPackage(archive).map(file => file.replace(/\\/g, '/').replace(/^\//, ''));
  const unexpected = entries.filter(file =>
    /\.(?:db|sqlite3?|dump|key|token)(?:-(?:wal|shm|journal))?$/i.test(file) ||
    /(^|\/)(?:\.env(?:\..*)?|config\.json|installation\.json)$/.test(file) ||
    /^(?:scripts|test|docs|tablet-app|\.codex-audit|\.playwright-cli|output|assets\/exercises)\//.test(file) ||
    /^(?:figma-|\.tmp-|audit-inicio|detail-page|detail-modal)/.test(file));
  for (const required of ['main.js', 'index.html', 'user.html', 'preload.js',
    'services/platformRuntime.js', 'services/installationConfig.js',
    'services/startupUpdates.js', 'services/installDownloadedUpdate.js', 'services/dockerRuntime.js',
    'services/firstInstallation.js', 'services/firstInstallationWorker.js',
    'services/legacyMigration/importLegacyMasters.js', 'services/legacyMigration/inspectLegacyDatabase.js',
    'services/legacyMigration/verify-migrated-data.js', 'installation-progress.html', 'styles/installation-progress.css']) {
    if (!entries.includes(required)) throw new Error(`Falta ${required} en la aplicación.`);
  }
  if (unexpected.length) throw new Error(`Contenido no permitido en el instalador: ${unexpected.join(', ')}`);
  const requiredResources = ['api/UnderFit.Api.exe', 'api/wwwroot/socios/index.html',
    'api/wwwroot/tablet/index.html', 'app-update.yml',
    'platform/compose.yaml', 'tools/ffmpeg.exe', 'tools/cloudflared.exe',
    'installation/configure-installation.ps1', 'installation/configure-remote-access.ps1', 'installation/check-gym-pc.ps1'];
  for (const file of requiredResources) {
    if (!fs.existsSync(path.join(resources, file))) throw new Error(`Falta el recurso ${file}.`);
  }
  const apiFiles = fs.readdirSync(path.join(resources, 'api'), { recursive: true });
  if (apiFiles.some(file => /appsettings\.Development\.json|\.(db|sqlite3?|dump|key|token)$/i.test(file))) {
    throw new Error('La API empaquetada contiene configuración de desarrollo o datos locales.');
  }
  const compose = fs.readFileSync(path.join(resources, 'platform/compose.yaml'), 'utf8');
  if (!compose.includes('name: underfit-production') || compose.includes('underfit_dev') ||
      !compose.includes('UNDERFIT_POSTGRES_PASSWORD:?')) {
    throw new Error('La configuración de PostgreSQL no es la de producción.');
  }
  const packageJson = JSON.parse(asar.extractFile(archive, 'package.json').toString());
  if (entries.includes('services/usbKeypad.js')) {
    const keypad = 'keypad/UnderFit.Keypad.exe';
    if (!fs.existsSync(path.join(resources, keypad))) throw new Error(`Falta el recurso ${keypad}.`);
    requiredResources.push(keypad);
  }
  const updateConfig = require('js-yaml').load(fs.readFileSync(path.join(resources, 'app-update.yml'), 'utf8'));
  if (updateConfig.provider !== 'github' || updateConfig.owner !== 'Amirsholi' ||
      updateConfig.repo !== 'underfit-desktop-app' || updateConfig.token || updateConfig.private) {
    throw new Error('La fuente de actualizaciones no corresponde al canal público previsto.');
  }
  if (!packageJson.dependencies?.['electron-updater']) throw new Error('Falta el actualizador en producción.');
  return {
    status: 'package-content-verified-not-approved-for-production',
    version: packageJson.version,
    archiveSha256: crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex'),
    filesInArchive: entries.length,
    runtimeResources: requiredResources,
    pending: ['real-gym-migration', 'tablet-backend-integration', 'domain-and-remote-access',
      'updates-and-rollback', 'target-pc-installation-test'],
  };
}

if (require.main === module) {
  try {
    if (!process.argv[2]) throw new Error('Uso: node scripts/audit-package.js <carpeta win-unpacked>');
    console.log(JSON.stringify(auditPackage(process.argv[2]), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { auditPackage };
