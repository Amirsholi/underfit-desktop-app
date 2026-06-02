const sqlite3 = require('sqlite3').verbose();
const { getDbPathFromConfigOrDefault } = require('../config');

function createDatabase() {
  const dbPath = getDbPathFromConfigOrDefault();
  return new sqlite3.Database(dbPath);
}

module.exports = { createDatabase };
