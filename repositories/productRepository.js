function createProductRepository(db) {
  function create({ nombre, precio, stock }) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO productos (nombre, precio, stock) VALUES (?, ?, ?)`,
        [nombre, precio, stock],
        function (err) {
          if (err) return reject(err);
          resolve({ id: this.lastID, nombre, precio, stock });
        }
      );
    });
  }

  function findAll() {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT id, nombre, precio, stock
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
        `SELECT id, nombre, precio, stock
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

  function update(id, { nombre, precio, stock }) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE productos
         SET nombre = ?, precio = ?, stock = ?
         WHERE id = ?`,
        [nombre, precio, stock, id],
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
