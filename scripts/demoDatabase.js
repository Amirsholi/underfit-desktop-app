const fs = require('node:fs');
const path = require('node:path');

// Only databases explicitly created for demonstrations may receive seed data.
// Never infer that an existing database is disposable from its rows or location.
function resolveDemoDatabase(value = process.env.UNDERFIT_REVIEW_DB) {
  if (!value || !path.isAbsolute(value)) {
    throw new Error('Definí UNDERFIT_REVIEW_DB con la ruta absoluta de una base de demostración preparada.');
  }
  const databasePath = path.resolve(value);
  const markerPath = `${databasePath}.demo.json`;
  if (!fs.existsSync(markerPath) || fs.lstatSync(markerPath).isSymbolicLink()) {
    throw new Error('Base sin identificación de demostración. Usá scripts/prepare-demo-database.js con una ruta nueva.');
  }
  const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
  if (marker.purpose !== 'underfit-demo' || marker.databasePath !== databasePath ||
      !fs.existsSync(databasePath) || fs.lstatSync(databasePath).isSymbolicLink() ||
      fs.realpathSync(databasePath) !== databasePath) {
    throw new Error('La identificación de la base de demostración no coincide con el archivo.');
  }
  return databasePath;
}

module.exports = { resolveDemoDatabase };
