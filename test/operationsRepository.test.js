const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sqlite3 = require('sqlite3').verbose();
const { migrarProductos, migrarOperacionesMultiLocal } = require('../migrations');
const { createOperationsRepository } = require('../repositories/operationsRepository');

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (error) {
      if (error) return reject(error);
      resolve(this);
    });
  });
}

function close(db) {
  return new Promise((resolve, reject) => db.close(error => error ? reject(error) : resolve()));
}

test('stock transfer keeps the total and pending sales consume Local 2 stock', async () => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'under-fit-operations-'));
  const dbPath = path.join(tempDirectory, 'operations.db');
  let db;

  try {
    await migrarProductos(dbPath);
    db = new sqlite3.Database(dbPath);
    await run(db, 'INSERT INTO productos (nombre, precio, stock) VALUES (?, ?, ?)', ['Agua 600 ml', 60, 18]);
    await close(db);
    db = null;

    await migrarOperacionesMultiLocal(dbPath);
    db = new sqlite3.Database(dbPath);
    const repository = createOperationsRepository(db);

    await repository.transferStock({
      productoId: 1,
      cantidad: 6,
      responsable: 'Recepción',
      fecha: '2026-07-20',
      hora: '12:00:00',
      ts: '2026-07-20T15:00:00.000Z',
    });

    let [stock] = await repository.listStockByLocation();
    assert.deepEqual({ local1: stock.local1, local2: stock.local2, total: stock.total }, { local1: 12, local2: 6, total: 18 });

    await repository.createPendingSale({
      productoId: 1,
      productoNombre: 'Agua 600 ml',
      usuarioCi: 49876543,
      usuarioNombre: 'Martina Silva',
      cantidad: 2,
      total: 120,
      profesor: 'Santiago',
      fecha: '2026-07-20',
      hora: '18:05:00',
      ts: '2026-07-20T21:05:00.000Z',
      observacion: null,
    });

    [stock] = await repository.listStockByLocation();
    assert.equal(stock.local2, 4);
    assert.deepEqual(await repository.getPendingSummaryByDate('2026-07-20'), { cantidad: 1, total: 120 });
  } finally {
    if (db) await close(db);
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
});
