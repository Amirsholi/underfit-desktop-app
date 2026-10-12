const fs = require('node:fs');
const path = require('node:path');
const { ejecutarMigraciones } = require('../migrations');

async function prepareDemoDatabase(value) {
  if (!value || !path.isAbsolute(value)) throw new Error('Indicá una ruta absoluta NUEVA para la base demo.');
  const databasePath = path.resolve(value);
  if (fs.existsSync(databasePath) || fs.existsSync(`${databasePath}.demo.json`)) {
    throw new Error('El destino ya existe. No se sobrescriben ni se reclasifican bases existentes.');
  }
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  if (fs.realpathSync(path.dirname(databasePath)) !== path.dirname(databasePath)) {
    throw new Error('No se admiten rutas de demostración mediante enlaces.');
  }
  fs.closeSync(fs.openSync(databasePath, 'wx'));
  await ejecutarMigraciones(databasePath);
  fs.writeFileSync(`${databasePath}.demo.json`, JSON.stringify({
    purpose: 'underfit-demo', databasePath, createdAt: new Date().toISOString(),
  }, null, 2) + '\n', { flag: 'wx' });
  return databasePath;
}

if (require.main === module) {
  prepareDemoDatabase(process.argv[2]).then(file => console.log(`Base demo preparada: ${file}`))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { prepareDemoDatabase };
