const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sqlite3 = require('sqlite3').verbose();
const membershipRules = require('../membershipRules');
const {
  migrarUsuarios,
  migrarIngresos,
  migrarProductos,
  migrarOperacionesMultiLocal,
  migrarProfesores,
  migrarProgramacionesClases,
  migrarAsistenciasClases,
} = require('../migrations');
const { createOperationsRepository } = require('../repositories/operationsRepository');
const { createStaffRepository } = require('../repositories/staffRepository');
const { createUserRepository } = require('../repositories/userRepository');
const { createOperationsService } = require('../services/operationsService');
const { createStaffService } = require('../services/staffService');

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (error) {
      if (error) return reject(error);
      resolve(this);
    });
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => error ? reject(error) : resolve(row || null));
  });
}

function close(db) {
  return new Promise((resolve, reject) => db.close(error => error ? reject(error) : resolve()));
}

test('attendance records the gym entry, actual substitute and prevents duplicates across tablets', async () => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'under-fit-attendance-'));
  const dbPath = path.join(tempDirectory, 'attendance.db');
  let db;

  try {
    await migrarUsuarios(dbPath);
    await migrarIngresos(dbPath);
    await migrarProductos(dbPath);
    await migrarOperacionesMultiLocal(dbPath);
    await migrarProfesores(dbPath);
    await migrarProgramacionesClases(dbPath);
    await migrarAsistenciasClases(dbPath);
    await migrarAsistenciasClases(dbPath);
    db = new sqlite3.Database(dbPath);

    for (const [ci, nombre] of [[49876543, 'Martina Silva'], [43219876, 'Bruno Rodriguez']]) {
      await run(db, `
        INSERT INTO usuarios (
          ci, nombre, fecha_creacion, ultima_actualizacion, fecha_vencimiento
        ) VALUES (?, ?, '2026-01-01', '2026-01-01', '2027-01-01')
      `, [ci, nombre]);
    }

    const staffService = createStaffService({ staffRepository: createStaffRepository(db) });
    const service = createOperationsService({
      operationsRepository: createOperationsRepository(db),
      staffService,
      userRepository: createUserRepository(db),
      productRepository: {},
      cashService: {},
      membershipRules,
      clock: () => new Date(2026, 6, 22, 8, 5, 0),
    });
    const scheduled = await staffService.createProfessor({ nombre: 'Profesor titular', pin: '1234' });
    const substitute = await staffService.createProfessor({ nombre: 'Profesor suplente', pin: '5678' });
    const substituteSession = await staffService.startSession({
      profesorId: substitute.id,
      pin: '5678',
      localId: 1,
      dispositivoId: 'tablet-recepcion-a',
    });
    const secondSession = await staffService.startSession({
      profesorId: scheduled.id,
      pin: '1234',
      localId: 1,
      dispositivoId: 'tablet-recepcion-b',
    });

    await service.createClass({
      nombre: 'Funcional manana',
      profesorId: scheduled.id,
      localId: 1,
      diasSemana: [3],
      fechaInicio: '2026-07-22',
      fechaFin: '2026-07-22',
      hora: '08:00',
      duracionMinutos: 60,
      capacidad: 12,
    });
    const [classOccurrence] = await service.listUpcomingClasses('2026-07-22');
    await service.enrollMember({ classId: classOccurrence.id, userCi: 49876543 });
    await service.enrollMember({ classId: classOccurrence.id, userCi: 43219876 });

    const started = await service.startClass({
      profesorSesionId: substituteSession.id,
      localId: 1,
      dispositivoId: 'tablet-recepcion-a',
    });
    assert.equal(started.started, true);
    assert.equal(started.class.estado, 'en_curso');
    assert.equal(started.professor.nombre, 'Profesor suplente');

    const result = await service.registerClassAttendance({
      ci: 49876543,
      profesorSesionId: substituteSession.id,
      localId: 1,
      dispositivoId: 'tablet-recepcion-a',
    });
    assert.equal(result.registered, true);
    assert.equal(result.professor.nombre, 'Profesor suplente');

    const entry = await get(db, 'SELECT * FROM ingresos WHERE id = ?', [result.attendance.ingresoId]);
    assert.equal(entry.fuente, 'tablet_clase');
    assert.equal(entry.local_id, 1);
    assert.equal(entry.dispositivo_id, 'tablet-recepcion-a');
    assert.equal(entry.clase_id, classOccurrence.id);

    await assert.rejects(
      service.registerClassAttendance({
        ci: 49876543,
        profesorSesionId: secondSession.id,
        localId: 1,
        dispositivoId: 'tablet-recepcion-b',
      }),
      /ya fue registrada/,
    );
    assert.equal((await get(db, 'SELECT COUNT(*) AS total FROM ingresos')).total, 1);

    const [record] = await service.listClassRecordsByDate('2026-07-22');
    assert.equal(record.profesorProgramado, 'Profesor titular');
    assert.equal(record.profesorReal, 'Profesor suplente');
    assert.equal(record.presentes, 1);
    assert.equal(record.inscriptos, 2);

    const detail = await service.getClassRecordDetail(classOccurrence.id);
    assert.deepEqual(detail.students.map(student => [student.usuarioNombre, student.presente]), [
      ['Martina Silva', true],
      ['Bruno Rodriguez', false],
    ]);

    await service.finishClass({
      claseId: classOccurrence.id,
      profesorSesionId: substituteSession.id,
      localId: 1,
      dispositivoId: 'tablet-recepcion-a',
    });
    assert.equal((await service.getClassRecordDetail(classOccurrence.id)).estado, 'dictada');
  } finally {
    if (db) await close(db);
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
});

test('a class is cancelled after its grace period when no professor starts it', async () => {
  const cancelled = [];
  const service = createOperationsService({
    operationsRepository: {
      listUnstartedClassesThrough: async () => [
        { id: 1, fecha: '2026-07-22', hora: '08:00', duracionMinutos: 60, estado: 'programada' },
        { id: 2, fecha: '2026-07-22', hora: '09:15', duracionMinutos: 60, estado: 'programada' },
      ],
      cancelUnstartedClass: async payload => {
        cancelled.push(payload);
        return { classId: payload.classId, changed: true };
      },
      listClassRecordsByDate: async () => [],
    },
    userRepository: {},
    productRepository: {},
    cashService: {},
    clock: () => new Date(2026, 6, 22, 10, 0, 0),
  });

  await service.listClassRecordsByDate('2026-07-22');

  assert.deepEqual(cancelled.map(item => item.classId), [1]);
  assert.equal(cancelled[0].reason, 'sin_registro_profesor');
});
