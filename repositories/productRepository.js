function createProductRepository(db) {
  function create({ nombre, precio, activo }) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO productos (nombre, precio, stock, activo) VALUES (?, ?, 10000, ?)`,
        [nombre, precio, activo ? 1 : 0],
        function (err) {
          if (err) return reject(err);
          resolve({ id: this.lastID, nombre, precio, activo });
        }
      );
    });
  }

  function findAll() {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT id, nombre, precio, activo
         FROM productos
         ORDER BY LOWER(nombre) ASC, id ASC`,
        [],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });
  }

  function findById(id) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT id, nombre, precio, activo
         FROM productos
         WHERE id = ?`,
        [id],
        (err, row) => {
          if (err) return reject(err);
          resolve(row || null);
        }
      );
    });
  }

  function update(id, { nombre, precio, activo }) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE productos
         SET nombre = ?, precio = ?, activo = ?
         WHERE id = ?`,
        [nombre, precio, activo ? 1 : 0, id],
        function (err) {
          if (err) return reject(err);
          resolve({ success: true, changes: this.changes });
        }
      );
    });
  }

  function remove(id) {
    return new Promise((resolve, reject) => {
      db.run(`DELETE FROM productos WHERE id = ?`, [id], function (err) {
        if (err) return reject(err);
        resolve({ success: true, changes: this.changes });
      });
    });
  }

  return {
    create,
    findAll,
    findById,
    update,
    remove,
  };
}

module.exports = { createProductRepository };
