function createSettingsRepository(db) {
  function all(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  function run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve(this);
      });
    });
  }

  async function findAll() {
    const rows = await all(`SELECT key, value FROM app_config ORDER BY key ASC`);
    return Object.fromEntries(rows.map(row => [row.key, row.value]));
  }

  async function upsertMany(entries) {
    for (const [key, value] of Object.entries(entries)) {
      await run(
        `INSERT INTO app_config (key, value)
         VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [key, String(value)]
      );
    }
  }

  return {
    findAll,
    upsertMany,
  };
}

module.exports = { createSettingsRepository };
