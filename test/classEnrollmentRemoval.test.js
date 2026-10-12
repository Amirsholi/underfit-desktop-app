const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sqlite3 = require('sqlite3').verbose();
const migrations = require('../migrations');
const { createOperationsRepository } = require('../repositories/operationsRepository');
const { createOperationsService } = require('../services/operationsService');

test('removing enrollment preserves historical rosters, absences and ratings, frees future seats and permits re-enrollment', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'underfit-removal-'));
  const file = path.join(directory, 'test.db');
  let db;
  try {
    for (const name of ['migrarUsuarios', 'migrarIngresos', 'migrarProductos', 'migrarOperacionesMultiLocal', 'migrarProfesores', 'migrarProgramacionesClases', 'migrarAsistenciasClases']) await migrations[name](file);
    db = new sqlite3.Database(file);
    const run = (sql, params = []) => new Promise((resolve, reject) => db.run(sql, params, error => error ? reject(error) : resolve()));
    const all = (sql, params = []) => new Promise((resolve, reject) => db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows)));
    for (const ci of [11111111, 22222222]) await run(`INSERT INTO usuarios(ci,nombre,fecha_creacion,ultima_actualizacion,fecha_vencimiento) VALUES (?,?,'2026-01-01','2026-01-01','2027-01-01')`, [ci, `Alumno ${ci}`]);
    for (let i = 1; i <= 5; i++) await run(`INSERT INTO clases(id,nombre,fecha,hora,duracion_minutos,capacidad,profesor,estado,creado_ts,programacion_id)
      VALUES (?, 'Funcional', ?, '08:00:00',60,3,'Profesor',?,'2026-01-01',?)`, [i, `2026-09-0${i}`, i < 4 ? 'dictada' : 'programada', i === 5 ? null : 88]);
    await run(`INSERT INTO asistencias_clase(clase_id,usuario_ci,local_id,profesor_id,profesor_sesion_id,dispositivo_id,fecha,hora,ts,puntuacion)
      VALUES (1,11111111,2,1,1,'demo','2026-09-01','08:05:00','2026-09-01',4)`);
    const repository = createOperationsRepository(db);
    const service = createOperationsService({ operationsRepository: repository, userRepository: { findByCi: async ci => ({ nombre: `Alumno ${ci}` }) }, clock: () => new Date('2026-09-03T12:00:00') });
    await service.enrollMember({ classId: 4, userCi: 11111111 });
    await service.enrollMember({ classId: 4, userCi: 22222222 });
    const roster = async id => (await repository.getClassRecordDetail(id)).students.map(s => ({ ci: s.usuarioCi, presente: s.presente, puntuacion: s.puntuacion, sinInscripcion: !!s.noInscripto }));
    const before = await roster(1), absentBefore = await roster(2);
    const attendanceBefore = await all('SELECT * FROM asistencias_clase');
    await service.removeEnrollment({ classId: 4, userCi: 11111111 });
    assert.deepEqual(await roster(1), before);
    assert.deepEqual(await roster(2), absentBefore);
    assert.deepEqual((await service.listClassEnrollments(4)).map(s => s.usuarioCi), [22222222]);
    assert.equal((await repository.listClassRecordsByDate('2026-09-01'))[0].inscriptos, 2);
    const counts = await repository.listClasses({ fromDate: '2026-09-01' });
    assert.equal(counts.find(c => c.id === 1).inscriptos, 2);
    assert.equal(counts.find(c => c.id === 4).inscriptos, 1);
    await assert.rejects(service.removeEnrollment({ classId: 1, userCi: 22222222 }), /todavía no comenzó/);
    await assert.rejects(service.removeEnrollment({ classId: 4, userCi: 11111111 }), /ya no está inscripto/);
    await service.enrollMember({ classId: 4, userCi: 11111111 });
    assert.equal((await service.listClassEnrollments(4)).length, 2);
    await service.removeEnrollment({ classId: 4, userCi: 22222222 });
    assert.deepEqual(await roster(1), before);
    assert.deepEqual(await roster(2), absentBefore);
    assert.deepEqual(await all('SELECT * FROM asistencias_clase'), attendanceBefore);
    assert.equal((await all('SELECT ci FROM usuarios')).length, 2);
    await service.enrollMember({ classId: 5, userCi: 11111111 });
    await service.removeEnrollment({ classId: 5, userCi: 11111111 });
    assert.equal((await service.listClassEnrollments(5)).length, 0);
    await service.enrollMember({ classId: 5, userCi: 11111111 });
    assert.equal((await service.listClassEnrollments(5)).length, 1);
  } finally {
    if (db) await new Promise((resolve, reject) => db.close(error => error ? reject(error) : resolve()));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
