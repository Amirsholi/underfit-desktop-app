const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const TABLES = [
  'usuarios',
  'pagos_membresia',
  'ingresos',
  'productos',
  'ventas_productos',
  'aperturas_caja',
  'caja_sesiones',
  'caja_movimientos',
  'clases',
  'programaciones_clase',
  'inscripciones_clase',
  'inscripciones_programacion_clase',
  'asistencias_clase',
  'profesores',
  'sesiones_profesor',
  'ventas_pendientes',
  'app_config',
];

function all(db, sql, params = []) {
  return new Promise((resolve, reject) =>
    db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows))
  );
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) =>
    db.get(sql, params, (error, row) => error ? reject(error) : resolve(row))
  );
}

async function tableNames(db) {
  const rows = await all(db, `SELECT name FROM sqlite_master WHERE type = 'table'`);
  return new Set(rows.map(row => row.name));
}

async function inspectLegacyDatabase(dbPath) {
  const absolutePath = path.resolve(dbPath);
  if (!fs.existsSync(absolutePath)) throw new Error(`No existe la base SQLite: ${absolutePath}`);
  const db = new sqlite3.Database(absolutePath, sqlite3.OPEN_READONLY);
  try {
    const existing = await tableNames(db);
    const counts = {};
    for (const table of TABLES) {
      counts[table] = existing.has(table)
        ? Number((await get(db, `SELECT COUNT(*) AS count FROM "${table}"`))?.count || 0)
        : null;
    }

    const issues = [];
    if (existing.has('usuarios')) {
      const duplicateEmails = await all(db, `
        SELECT LOWER(TRIM(email)) AS value, COUNT(*) AS count
        FROM usuarios
        WHERE TRIM(COALESCE(email, '')) <> ''
        GROUP BY LOWER(TRIM(email))
        HAVING COUNT(*) > 1
      `);
      const invalidMembers = await all(db, `
        SELECT ci FROM usuarios
        WHERE TRIM(COALESCE(nombre, '')) = ''
           OR fecha_vencimiento IS NULL
           OR date(fecha_vencimiento) IS NULL
      `);
      duplicateEmails.forEach(row => issues.push({
        severity: 'warning',
        code: 'member.duplicate_email',
        value: row.value,
        count: Number(row.count),
      }));
      invalidMembers.forEach(row => issues.push({
        severity: 'error',
        code: 'member.invalid_required_data',
        identityNumber: String(row.ci),
      }));
    }

    if (existing.has('pagos_membresia') && existing.has('usuarios')) {
      const orphaned = await all(db, `
        SELECT p.id, p.usuario_ci
        FROM pagos_membresia p
        LEFT JOIN usuarios u ON u.ci = p.usuario_ci
        WHERE u.ci IS NULL
      `);
      orphaned.forEach(row => issues.push({
        severity: 'warning',
        code: 'renewal.member_missing',
        legacyId: row.id,
        identityNumber: String(row.usuario_ci),
      }));
    }

    if (existing.has('ventas_pendientes')) {
      const invalidPending = await all(db, `
        SELECT id FROM ventas_pendientes
        WHERE estado = 'pendiente' AND (producto_id IS NULL OR usuario_ci IS NULL)
      `);
      invalidPending.forEach(row => issues.push({
        severity: 'error',
        code: 'pending_sale.invalid_reference',
        legacyId: row.id,
      }));
    }

    if (existing.has('profesores')) {
      const professors = await all(db, `SELECT id, nombre FROM profesores ORDER BY id`);
      professors.forEach(row => issues.push({
        severity: 'warning',
        code: 'professor.pin_reset_required',
        legacyId: row.id,
        name: row.nombre,
      }));
    }

    return {
      source: absolutePath,
      inspectedAtUtc: new Date().toISOString(),
      sqliteBytes: fs.statSync(absolutePath).size,
      counts,
      issues,
      canImport: !issues.some(issue => issue.severity === 'error'),
    };
  } finally {
    await new Promise(resolve => db.close(() => resolve()));
  }
}

module.exports = { inspectLegacyDatabase, TABLES };
