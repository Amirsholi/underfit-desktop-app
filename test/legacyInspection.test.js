const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sqlite3 = require('sqlite3').verbose();
const { inspectLegacyDatabase } = require('../scripts/inspectLegacyDatabase');
const {
  buildImportSql,
  buildHistoryImportSql,
  buildClassImportSql,
  buildCommercialImportSql,
  deterministicUuid,
} = require('../scripts/importLegacyMasters');

function exec(db, sql) {
  return new Promise((resolve, reject) =>
    db.exec(sql, error => error ? reject(error) : resolve())
  );
}

test('legacy inspection reports counts and blocks invalid members without writing', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'underfit-inspect-'));
  const dbPath = path.join(root, 'legacy.db');
  const db = new sqlite3.Database(dbPath);
  try {
    await exec(db, `
      CREATE TABLE usuarios (
        ci INTEGER PRIMARY KEY, nombre TEXT, email TEXT, fecha_vencimiento TEXT
      );
      CREATE TABLE pagos_membresia (
        id INTEGER PRIMARY KEY, usuario_ci INTEGER
      );
      INSERT INTO usuarios VALUES (123, '', 'member@example.com', 'not-a-date');
      INSERT INTO pagos_membresia VALUES (7, 999);
    `);
  } finally {
    await new Promise(resolve => db.close(resolve));
  }

  const before = fs.statSync(dbPath).mtimeMs;
  const report = await inspectLegacyDatabase(dbPath);

  assert.equal(report.counts.usuarios, 1);
  assert.equal(report.counts.productos, null);
  assert.equal(report.canImport, false);
  assert.ok(report.issues.some(issue => issue.code === 'member.invalid_required_data'));
  assert.ok(report.issues.some(issue => issue.code === 'renewal.member_missing'));
  assert.equal(fs.statSync(dbPath).mtimeMs, before);
  fs.rmSync(root, { recursive: true, force: true });
});

test('class import includes enrollments, attendance and safe PIN reset credentials', () => {
  const sql = buildClassImportSql({
    professors: [{ id: 1, nombre: 'Profesor', activo: 1, creado_ts: '2026-01-01', actualizado_ts: '2026-01-01' }],
    professorSessions: [{ id: 2, profesor_id: 1, local_id: 2, dispositivo_id: 'tablet', inicio_ts: '2026-01-01', estado: 'cerrada' }],
    schedules: [],
    classes: [{ id: 3, nombre: 'Clase', fecha: '2026-07-28', hora: '18:00', profesor: 'Profesor', profesor_id: 1, local_id: 2, estado: 'dictada' }],
    classEnrollments: [{ id: 4, clase_id: 3, usuario_ci: 123, usuario_nombre: 'Socio', estado: 'inscripto', creado_ts: '2026-07-01' }],
    scheduleEnrollments: [],
    classAttendances: [{ id: 5, clase_id: 3, usuario_ci: 123, local_id: 2, profesor_id: 1, profesor_sesion_id: 2, dispositivo_id: 'tablet', fecha: '2026-07-28', ts: '2026-07-28T18:00:00Z', anulado: 0 }],
  });

  assert.match(sql, /class_enrollments/);
  assert.match(sql, /class_attendances/);
  assert.match(sql, /Ingreso sintetizado durante importacion/);
  assert.doesNotMatch(sql, /deadbeef/);
  assert.match(sql, /'Held'/);
});

test('history import preserves legacy dates, annulments and financial types', () => {
  const sql = buildHistoryImportSql({
    cashSessions: [{
      id: 1, fecha: '2026-07-28', ts_apertura: '2026-07-28T12:00:00Z',
      cajero_apertura: 'Caja', estado: 'cerrada', ts_cierre: '2026-07-28T20:00:00Z',
    }],
    cashMovements: [{
      id: 2, caja_sesion_id: 1, usuario_ci: 123, usuario_nombre: 'Socio',
      monto: -100, forma_pago: 'efectivo', descripcion: 'Compra',
      ts: '2026-07-28T13:00:00Z', fecha: '2026-07-28', tipo_ingreso: 'egreso',
    }],
    renewals: [{
      id: 3, usuario_ci: 123, fecha_pago: '2026-07-28',
      vencimiento_anterior: '2026-07-28', vencimiento_nuevo: '2026-10-26',
      tipo_membresia: 'trimestral', monto: 1000, forma_pago: 'transferencia',
      ts: '2026-07-28T14:00:00Z', caja_sesion_id: 1, caja_movimiento_id: 2,
    }],
    entries: [{
      id: 4, ci: 123, fecha: '2026-07-28', ts: '2026-07-28T15:00:00Z',
      fuente: 'tablet', anulado: 1, anulado_ts: '2026-07-28T16:00:00Z',
      motivo_anulacion: 'Error', local_id: 2,
    }],
  });

  assert.match(sql, /'CashOutput'/);
  assert.match(sql, /'Quarterly'/);
  assert.match(sql, /"IsAnnulled"/);
  assert.match(sql, /2026-10-26/);
  assert.ok(sql.startsWith('BEGIN;'));
  assert.ok(sql.endsWith('COMMIT;'));
});

test('master import SQL uses stable identities and idempotent conflict handling', () => {
  const data = {
    members: [{
      ci: 12345678,
      nombre: "María D'Angelo",
      fecha_vencimiento: '2026-12-31',
      fecha_creacion: '2026-01-01T12:00:00Z',
      ultima_actualizacion: '2026-07-28T12:00:00Z',
      tipo_membresia: 'trimestral',
      autorizacion_imagen: 1,
    }],
    products: [{ id: 9, nombre: "Agua d'oro", precio: 100, activo: 1 }],
  };

  const first = deterministicUuid('underfit-member', 12345678);
  const second = deterministicUuid('underfit-member', 12345678);
  const sql = buildImportSql(data);

  assert.equal(first, second);
  assert.match(sql, /ON CONFLICT \("IdentityNumber"\) DO UPDATE/);
  assert.match(sql, /ON CONFLICT \("SourceTable","SourceId"\) DO UPDATE/);
  assert.match(sql, /María D''Angelo/);
  assert.match(sql, /Agua d''oro/);
  assert.ok(sql.startsWith('BEGIN;'));
  assert.ok(sql.endsWith('COMMIT;'));
});

test('commercial import preserves sales, pending collection state and settings', () => {
  const sql = buildCommercialImportSql({
    productSales: [{
      id: 21, producto_id: 9, nombre: "Agua d'oro", cantidad: 2, total: 200,
      forma_pago: 'efectivo', monto_recibido: 500, cambio: 300,
      observacion: 'Venta mostrador', fecha: '2026-07-28',
      ts: '2026-07-28T15:00:00Z',
    }],
    pendingSales: [{
      id: 22, producto_id: 10, producto_nombre: 'Entrada evento',
      usuario_ci: 12345678, usuario_nombre: 'Socio', cantidad: 1, total: 800,
      profesor: 'Profesor', profesor_id: 4, profesor_sesion_id: 5, local_id: 2,
      estado: 'cobrado', fecha: '2026-07-28', ts: '2026-07-28T16:00:00Z',
      cobrado_ts: '2026-07-28T17:00:00Z', forma_pago: 'transferencia',
      caja_movimiento_id: 30, observacion: 'Cupo',
    }],
    config: [
      { key: 'precio_inscripcion', value: '500' },
      { key: 'precio_membresia_mensual', value: '1200' },
      { key: 'precio_membresia_trimestral', value: '3000' },
      { key: 'precio_membresia_semestral', value: '5500' },
      { key: 'evento_running_activo', value: 'true' },
      { key: 'evento_running_nombre', value: 'UNDER RUNNING' },
      { key: 'evento_running_distancias', value: '3KM & 5KM' },
      { key: 'evento_running_fecha', value: '2026-05-24' },
    ],
  });

  assert.match(sql, /INSERT INTO product_sales/);
  assert.match(sql, /INSERT INTO pending_product_sales/);
  assert.match(sql, /'Collected'/);
  assert.match(sql, /INSERT INTO registration_price/);
  assert.match(sql, /\('Monthly',1200\),\('Quarterly',3000\),\('Semiannual',5500\)/);
  assert.match(sql, /RunningEventActive/);
  assert.match(sql, /Agua d''oro/);
  assert.match(sql, /ON CONFLICT \("Id"\) DO NOTHING/);
  assert.ok(sql.startsWith('BEGIN;'));
  assert.ok(sql.endsWith('COMMIT;'));
});
