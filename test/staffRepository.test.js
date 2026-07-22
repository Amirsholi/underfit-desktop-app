const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sqlite3 = require('sqlite3').verbose();
const { migrarProductos, migrarOperacionesMultiLocal, migrarProfesores } = require('../migrations');
const { createStaffRepository } = require('../repositories/staffRepository');
const { createStaffService } = require('../services/staffService');

function close(db) {
  return new Promise((resolve, reject) => db.close(error => error ? reject(error) : resolve()));
}

test('only one professor session remains active on a tablet', async () => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'under-fit-staff-'));
  const dbPath = path.join(tempDirectory, 'staff.db');
  let db;

  try {
    await migrarProductos(dbPath);
    await migrarOperacionesMultiLocal(dbPath);
    await migrarProfesores(dbPath);
    await migrarProfesores(dbPath);
    db = new sqlite3.Database(dbPath);
    const service = createStaffService({ staffRepository: createStaffRepository(db) });
    const first = await service.createProfessor({ nombre: 'Santiago Lima', pin: '1234' });
    const second = await service.createProfessor({ nombre: 'Valentina Suárez', pin: '5678' });

    const firstSession = await service.startSession({ profesorId: first.id, pin: '1234', dispositivoId: 'tablet-local-2' });
    const secondSession = await service.startSession({ profesorId: second.id, pin: '5678', dispositivoId: 'tablet-local-2' });
    const active = await service.getActiveSession('tablet-local-2');

    assert.notEqual(firstSession.id, secondSession.id);
    assert.equal(active.id, secondSession.id);
    assert.equal(active.profesorNombre, 'Valentina Suárez');
    await assert.rejects(service.resolveIdentity({ profesorSesionId: firstSession.id }), /no esta activa/);
  } finally {
    if (db) await close(db);
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
});
