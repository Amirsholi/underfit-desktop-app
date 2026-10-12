const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const imports = require('./importLegacyMasters');
const { importLegacyTraining } = require('./importLegacyTraining');
imports.importLegacyTraining = importLegacyTraining;

const CONTAINER = 'underfit-rehearsal-postgres-1';
function validateTarget(container) {
  if (container.Name !== `/${CONTAINER}` ||
      container.Config?.Labels?.['com.docker.compose.project'] !== 'underfit-rehearsal' ||
      container.Config?.Labels?.['com.docker.compose.service'] !== 'postgres' ||
      container.Mounts?.filter(m => m.Destination === '/var/lib/postgresql').length !== 1 ||
      !container.Mounts.some(m => m.Name === 'underfit-rehearsal_rehearsal-postgres' && m.Destination === '/var/lib/postgresql')) {
    throw new Error('Destino rechazado: no es el volumen aislado de ensayo.');
  }
}
function validateCopy(dbPath, manifest) {
  const normalize = value => path.resolve(value).toLowerCase();
  if (normalize(dbPath) !== normalize(manifest.copy) || normalize(dbPath) === normalize(manifest.source) ||
      manifest.status !== 'verified-copy-not-connected' || manifest.foreignKeyViolations !== 0 ||
      JSON.stringify(manifest.integrity) !== '["ok"]') {
    throw new Error('Se requiere una copia verificada, distinta de la base original.');
  }
  const hash = crypto.createHash('sha256').update(fs.readFileSync(dbPath)).digest('hex');
  if (hash !== manifest.sha256) throw new Error('La copia cambió desde su verificación.');
}
async function main() {
  const dbPath = process.argv[2];
  if (!dbPath) throw new Error('Uso: node scripts/import-rehearsal.js <copia.db> [--apply]');
  const manifest = JSON.parse(fs.readFileSync(dbPath.replace(/\.db$/i, '.manifest.json'), 'utf8'));
  validateCopy(dbPath, manifest);
  const apply = process.argv.includes('--apply');
  const stages = ['importLegacyMasters', 'importLegacyHistory', 'importLegacyClasses', 'importLegacyCommercial', 'importLegacyTraining'];
  // Validate every stage before the first write; failures must not leave a new
  // rehearsal looking like a complete import.
  for (const name of stages) await imports[name](dbPath, { apply: false });
  if (apply) {
    const result = spawnSync('docker', ['inspect', CONTAINER], { encoding: 'utf8', windowsHide: true });
    if (result.status !== 0) throw new Error('No se encontró el contenedor aislado.');
    validateTarget(JSON.parse(result.stdout)[0]);
  }
  const previous = process.env.UNDERFIT_POSTGRES_CONTAINER;
  process.env.UNDERFIT_POSTGRES_CONTAINER = CONTAINER;
  try {
    for (const name of stages) {
      const result = await imports[name](dbPath, { apply });
      console.log(JSON.stringify({ stage: name, ...result }));
    }
    validateCopy(dbPath, manifest);
    console.log('Copia sin modificar. Pendiente: copiar medios y migrar stock por local.');
  } finally {
    if (previous === undefined) delete process.env.UNDERFIT_POSTGRES_CONTAINER;
    else process.env.UNDERFIT_POSTGRES_CONTAINER = previous;
  }
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { validateTarget, validateCopy };
