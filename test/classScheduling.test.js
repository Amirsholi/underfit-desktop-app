const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sqlite3 = require('sqlite3').verbose();
const {
  migrarProductos,
  migrarIngresos,
  migrarOperacionesMultiLocal,
  migrarProfesores,
  migrarProgramacionesClases,
  migrarAsistenciasClases,
} = require('../migrations');
const { createOperationsRepository } = require('../repositories/operationsRepository');
const { createStaffRepository } = require('../repositories/staffRepository');
const { createOperationsService } = require('../services/operationsService');
const { createStaffService } = require('../services/staffService');

function close(db) {
  return new Promise((resolve, reject) => db.close(error => error ? reject(error) : resolve()));
}

function formatDate(date) {
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(dateText, days) {
  const date = new Date(`${dateText}T12:00:00`);
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

function nextMonday() {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  const offset = (8 - date.getDay()) % 7;
  date.setDate(date.getDate() + offset);
  return formatDate(date);
}

test('a recurring class enrolls a member in every generated occurrence', async () => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'under-fit-classes-'));
  const dbPath = path.join(tempDirectory, 'classes.db');
  let db;

  try {
    await migrarProductos(dbPath);
    await migrarIngresos(dbPath);
    await migrarOperacionesMultiLocal(dbPath);
    await migrarProfesores(dbPath);
    await migrarProgramacionesClases(dbPath);
    await migrarProgramacionesClases(dbPath);
    await migrarAsistenciasClases(dbPath);
    db = new sqlite3.Database(dbPath);

    const operationsRepository = createOperationsRepository(db);
    const staffService = createStaffService({ staffRepository: createStaffRepository(db) });
    const userRepository = {
      findByCi: async ci => ({ ci, nombre: ci === 49876543 ? 'Martina Silva' : 'Bruno Rodríguez' }),
    };
    const start = nextMonday();
    const service = createOperationsService({
      operationsRepository,
      staffService,
      userRepository,
      productRepository: {},
      cashService: {},
      clock: () => new Date(`${start}T07:00:00`),
    });
    const professor = await staffService.createProfessor({ nombre: 'Santiago Lima', pin: '1234' });
    const end = addDays(start, 13);

    const schedule = await service.createClass({
      nombre: 'Funcional mañana',
      profesorId: professor.id,
      localId: 2,
      diasSemana: [1, 3, 5],
      fechaInicio: start,
      fechaFin: end,
      hora: '08:00',
      duracionMinutos: 60,
      capacidad: 1,
    });

    const classes = await service.listUpcomingClasses(start);
    assert.equal(schedule.diasSemana, '1,3,5');
    assert.deepEqual(classes.map(item => item.fecha), [
      start,
      addDays(start, 2),
      addDays(start, 4),
      addDays(start, 7),
      addDays(start, 9),
      addDays(start, 11),
    ]);
    assert.ok(classes.every(item => item.programacionId === schedule.id));
    assert.ok(classes.every(item => item.localNombre === 'Salon funcional'));

    await service.enrollMember({ classId: classes[0].id, userCi: 49876543 });
    const laterEnrollments = await service.listClassEnrollments(classes[5].id);
    assert.deepEqual(laterEnrollments.map(item => item.usuarioCi), [49876543]);

    await assert.rejects(
      service.enrollMember({ classId: classes[2].id, userCi: 49876543 }),
      /ya está inscripto/,
    );
    await assert.rejects(
      service.enrollMember({ classId: classes[2].id, userCi: 43219876 }),
      /no tiene cupos/,
    );

    const refreshed = await service.listUpcomingClasses(start);
    assert.ok(refreshed.every(item => Number(item.inscriptos) === 1));
  } finally {
    if (db) await close(db);
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
});

test('editing a weekly class replaces only future occurrences and keeps its enrolled group', async () => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'under-fit-class-edit-'));
  const dbPath = path.join(tempDirectory, 'classes.db');
  let db;

  try {
    await migrarProductos(dbPath);
    await migrarIngresos(dbPath);
    await migrarOperacionesMultiLocal(dbPath);
    await migrarProfesores(dbPath);
    await migrarProgramacionesClases(dbPath);
    await migrarAsistenciasClases(dbPath);
    db = new sqlite3.Database(dbPath);

    const operationsRepository = createOperationsRepository(db);
    const staffService = createStaffService({ staffRepository: createStaffRepository(db) });
    const userRepository = { findByCi: async ci => ({ ci, nombre: ci === 49876543 ? 'Martina Silva' : 'Bruno Rodríguez' }) };
    const start = nextMonday();
    const service = createOperationsService({
      operationsRepository,
      staffService,
      userRepository,
      productRepository: {},
      cashService: {},
      clock: () => new Date(`${start}T07:00:00`),
    });
    const firstProfessor = await staffService.createProfessor({ nombre: 'Santiago Lima', pin: '1234' });
    const secondProfessor = await staffService.createProfessor({ nombre: 'Camila López', pin: '5678' });
    const end = addDays(start, 20);
    const schedule = await service.createClass({
      nombre: 'Funcional mañana', profesorId: firstProfessor.id, localId: 2,
      diasSemana: [1, 3, 5], fechaInicio: start, fechaFin: end,
      hora: '08:00', duracionMinutos: 60, capacidad: 2,
    });
    const before = await service.listUpcomingClasses(start);
    await service.enrollMember({ classId: before[0].id, userCi: 49876543 });
    await service.enrollMember({ classId: before[0].id, userCi: 43219876 });
    const changeDate = addDays(start, 7);

    await assert.rejects(service.updateClassSchedule({
      programacionId: schedule.id, desdeFecha: changeDate,
      nombre: 'Funcional renovado', profesorId: secondProfessor.id, localId: 2,
      diasSemana: [2, 4], hora: '09:00', duracionMinutos: 75, capacidad: 1, fechaFin: end,
    }), /ya tiene 2 alumnos/);

    await service.updateClassSchedule({
      programacionId: schedule.id, desdeFecha: changeDate,
      nombre: 'Funcional renovado', profesorId: secondProfessor.id, localId: 2,
      diasSemana: [2, 4], hora: '09:00', duracionMinutos: 75, capacidad: 2, fechaFin: end,
    });

    const after = await service.listUpcomingClasses(start);
    const unchanged = after.filter(item => item.fecha < changeDate);
    const changed = after.filter(item => item.fecha >= changeDate);
    assert.ok(unchanged.length > 0);
    assert.ok(unchanged.every(item => item.nombre === 'Funcional mañana' && item.hora === '08:00'));
    assert.ok(changed.length > 0);
    assert.ok(changed.every(item => item.nombre === 'Funcional renovado'));
    assert.ok(changed.every(item => item.hora === '09:00:00'));
    assert.ok(changed.every(item => [2, 4].includes(new Date(`${item.fecha}T12:00:00`).getDay())));
    assert.ok(changed.every(item => item.profesor === 'Camila López'));
    assert.ok(changed.every(item => Number(item.inscriptos) === 2));
    assert.deepEqual((await service.listClassEnrollments(changed[0].id)).map(item => item.usuarioCi), [43219876, 49876543]);
  } finally {
    if (db) await close(db);
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
});
