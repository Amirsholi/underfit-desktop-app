const crypto = require('crypto');
const { spawnSync } = require('child_process');
const sqlite3 = require('sqlite3').verbose();
const { inspectLegacyDatabase } = require('./inspectLegacyDatabase');

function all(db, sql) {
  return new Promise((resolve, reject) =>
    db.all(sql, [], (error, rows) => error ? reject(error) : resolve(rows))
  );
}

// v2.1/main predates classes and pending deliveries. Missing optional tables
// mean that feature did not exist, not that the source needs to be migrated.
async function readOptionalTable(db, table, orderBy = 'id') {
  const names = await all(db, "SELECT name FROM sqlite_master WHERE type='table'");
  if (!names.some(row => row.name === table)) return [];
  return all(db, `SELECT * FROM "${table}" ORDER BY "${orderBy}"`);
}

function sqlText(value) {
  if (value === null || value === undefined || String(value).trim() === '') return 'NULL';
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlRequiredText(value, fallback = '') {
  const text = String(value ?? '').trim() || fallback;
  return `'${String(text).replaceAll("'", "''")}'`;
}

function sqlBoolean(value) {
  return value === true || value === 1 || value === '1' || value === 'true' ? 'TRUE' : 'FALSE';
}

function normalizeDate(value, fallback = '1970-01-01') {
  const text = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : fallback;
}

function normalizeTimestamp(value, fallbackDate = '1970-01-01') {
  const parsed = new Date(value || `${fallbackDate}T12:00:00Z`);
  return Number.isNaN(parsed.getTime())
    ? `${fallbackDate}T12:00:00.000Z`
    : parsed.toISOString();
}

function deterministicUuid(namespace, key) {
  const hex = crypto.createHash('sha256').update(`${namespace}:${key}`).digest('hex').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
}

function membershipPlan(value) {
  const normalized = String(value || '').toLowerCase();
  if (normalized.includes('trimes')) return 'Quarterly';
  if (normalized.includes('semes')) return 'Semiannual';
  return 'Monthly';
}

function buildMembersSql(rows) {
  return rows.map(row => {
    const id = deterministicUuid('underfit-member', row.ci);
    const expiration = normalizeDate(row.fecha_vencimiento);
    const created = normalizeTimestamp(row.fecha_creacion, expiration);
    const updated = normalizeTimestamp(row.ultima_actualizacion, expiration);
    return `
INSERT INTO members (
  "Id","IdentityNumber","Name","Phone","Email","MembershipExpiresOn","CreatedAtUtc",
  "CurrentMembershipPlan","Address","BirthDate","Details","EmergencyContactName",
  "EmergencyContactPhone","EmergencyRelationship","Goal","ImageUseAuthorized",
  "MedicalCondition","PaymentPreference","RegistrationPaymentMethod","UpdatedAtUtc"
) VALUES (
  '${id}',${sqlRequiredText(row.ci)},${sqlRequiredText(row.nombre)},${sqlText(row.numero)},
  ${sqlText(row.email)},'${expiration}',${sqlText(created)},'${membershipPlan(row.tipo_membresia)}',
  ${sqlText(row.direccion)},${row.fecha_nacimiento ? `'${normalizeDate(row.fecha_nacimiento)}'` : 'NULL'},
  ${sqlText(row.detalle)},${sqlText(row.contacto_emergencia)},${sqlText(row.telefono_emergencia)},
  ${sqlText(row.relacion_emergencia)},${sqlText(row.objetivo)},${sqlBoolean(row.autorizacion_imagen)},
  ${sqlText(row.condicion_medica)},${sqlText(row.preferencia_pago)},${sqlText(row.forma_pago_alta)},
  ${sqlText(updated)}
)
ON CONFLICT ("IdentityNumber") DO UPDATE SET
  "Name"=EXCLUDED."Name","Phone"=EXCLUDED."Phone","Email"=EXCLUDED."Email",
  "MembershipExpiresOn"=EXCLUDED."MembershipExpiresOn",
  "CurrentMembershipPlan"=EXCLUDED."CurrentMembershipPlan","Address"=EXCLUDED."Address",
  "BirthDate"=EXCLUDED."BirthDate","Details"=EXCLUDED."Details",
  "EmergencyContactName"=EXCLUDED."EmergencyContactName",
  "EmergencyContactPhone"=EXCLUDED."EmergencyContactPhone",
  "EmergencyRelationship"=EXCLUDED."EmergencyRelationship","Goal"=EXCLUDED."Goal",
  "ImageUseAuthorized"=EXCLUDED."ImageUseAuthorized",
  "MedicalCondition"=EXCLUDED."MedicalCondition",
  "PaymentPreference"=EXCLUDED."PaymentPreference",
  "RegistrationPaymentMethod"=EXCLUDED."RegistrationPaymentMethod",
  "UpdatedAtUtc"=EXCLUDED."UpdatedAtUtc";
INSERT INTO legacy_import_map ("SourceTable","SourceId","TargetKey")
VALUES ('usuarios',${sqlRequiredText(row.ci)},(SELECT "Id"::text FROM members WHERE "IdentityNumber"=${sqlRequiredText(row.ci)}))
ON CONFLICT ("SourceTable","SourceId") DO UPDATE SET "TargetKey"=EXCLUDED."TargetKey";`;
  }).join('\n');
}

function buildProductsSql(rows) {
  return rows.map(row => `
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM products WHERE "Id"=${Number(row.id)})
     AND NOT EXISTS (
       SELECT 1 FROM legacy_import_map
       WHERE "SourceTable"='productos' AND "SourceId"=${sqlRequiredText(row.id)}
     )
  THEN
    RAISE EXCEPTION 'El producto destino % ya existe y no pertenece a esta importacion', ${Number(row.id)};
  END IF;
END $$;
INSERT INTO products ("Id","Name","Price","IsActive")
VALUES (${Number(row.id)},${sqlRequiredText(row.nombre)},${Number(row.precio || 0)},${sqlBoolean(row.activo === undefined ? true : row.activo)})
ON CONFLICT ("Id") DO UPDATE SET
  "Name"=EXCLUDED."Name","Price"=EXCLUDED."Price","IsActive"=EXCLUDED."IsActive";
INSERT INTO legacy_import_map ("SourceTable","SourceId","TargetKey")
VALUES ('productos',${sqlRequiredText(row.id)},${sqlRequiredText(row.id)})
ON CONFLICT ("SourceTable","SourceId") DO UPDATE SET "TargetKey"=EXCLUDED."TargetKey";`).join('\n');
}

function buildImportSql({ members, products }) {
  return `BEGIN;
CREATE TABLE IF NOT EXISTS legacy_import_map (
  "SourceTable" varchar(80) NOT NULL,
  "SourceId" varchar(120) NOT NULL,
  "TargetKey" varchar(120) NOT NULL,
  "ImportedAtUtc" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("SourceTable","SourceId")
);
${buildMembersSql(members)}
${buildProductsSql(products)}
SELECT setval(pg_get_serial_sequence('products','Id'),
  GREATEST(COALESCE((SELECT MAX("Id") FROM products),1),1), true);
COMMIT;`;
}

function findPostgresContainer() {
  if (process.env.UNDERFIT_POSTGRES_CONTAINER) return process.env.UNDERFIT_POSTGRES_CONTAINER;
  const result = spawnSync(
    'docker', ['ps', '--filter', 'publish=5432', '--format', '{{.Names}}'],
    { encoding: 'utf8', windowsHide: true }
  );
  const names = String(result.stdout || '').trim().split(/\r?\n/).filter(Boolean);
  if (result.status !== 0 || names.length !== 1) {
    throw new Error('No se pudo identificar un unico contenedor PostgreSQL en el puerto 5432');
  }
  return names[0];
}

function executeSql(sql) {
  const container = findPostgresContainer();
  const database = process.env.UNDERFIT_IMPORT_DATABASE || 'underfit';
  if (database !== 'underfit' && !/^underfit_migration_check_\d+$/.test(database)) {
    throw new Error('Base de importación no permitida.');
  }
  const result = spawnSync(
    'docker',
    ['exec', '-i', container, 'psql', '-X', '-U', 'underfit', '-d', database, '-v', 'ON_ERROR_STOP=1'],
    { input: sql, encoding: 'utf8', windowsHide: true, maxBuffer: 1024 * 1024 * 64 }
  );
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'Fallo importando PostgreSQL');
  return result.stdout;
}

async function readMasters(dbPath) {
  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
  try {
    return {
      members: await all(db, 'SELECT * FROM usuarios ORDER BY ci'),
      products: await all(db, 'SELECT * FROM productos ORDER BY id'),
    };
  } finally {
    await new Promise(resolve => db.close(resolve));
  }
}

function cashSessionUuid(id) {
  return deterministicUuid('underfit-cash-session', id);
}

function cashMovementUuid(id) {
  return deterministicUuid('underfit-cash-movement', id);
}

function movementType(value) {
  const type = String(value || '').toLowerCase();
  if (type.includes('venta')) return 'ProductSale';
  if (type.includes('inscrip')) return 'Registration';
  if (type.includes('membres') || type.includes('cuota')) return 'MembershipRenewal';
  if (type.includes('salida') || type.includes('egreso')) return 'CashOutput';
  if (type.includes('ajuste')) return 'ManualAdjustment';
  if (type.includes('anul') || type.includes('cancel')) return 'Cancellation';
  return 'ManualIncome';
}

function buildCashSessionsSql(rows) {
  return rows.map(row => {
    const id = cashSessionUuid(row.id);
    const date = normalizeDate(row.fecha);
    const opened = normalizeTimestamp(row.ts_apertura, date);
    const closed = row.ts_cierre ? sqlText(normalizeTimestamp(row.ts_cierre, date)) : 'NULL';
    const status = String(row.estado).toLowerCase().startsWith('cerr') ? 'Closed' : 'Open';
    return `
INSERT INTO cash_sessions (
 "Id","BusinessDate","Cashier","OpeningCash","OpenedAtUtc","Status","CashDifference",
 "ClosedAtUtc","ClosingCashier","ClosingNote","CountedCash","ExpectedCash",
 "MovementCount","TotalCash","TotalIncome","TotalTransfer","OpeningNote"
) VALUES (
 '${id}','${date}',${sqlRequiredText(row.cajero_apertura,'Sin registrar')},${Number(row.monto_inicial_efectivo||0)},
 ${sqlText(opened)},'${status}',${Number(row.diferencia_efectivo||0)},${closed},
 ${sqlText(row.cajero_cierre)},${sqlText(row.observacion_cierre)},${Number(row.efectivo_contado||0)},
 ${Number(row.efectivo_esperado||0)},${Number(row.cantidad_movimientos||0)},
 ${Number(row.total_efectivo||0)},${Number(row.total_ingresos||0)},
 ${Number(row.total_transferencia||0)},${sqlText(row.observacion_apertura)}
) ON CONFLICT ("Id") DO UPDATE SET
 "Status"=EXCLUDED."Status","ClosedAtUtc"=EXCLUDED."ClosedAtUtc",
 "ClosingCashier"=EXCLUDED."ClosingCashier","ClosingNote"=EXCLUDED."ClosingNote",
 "CountedCash"=EXCLUDED."CountedCash","ExpectedCash"=EXCLUDED."ExpectedCash",
 "CashDifference"=EXCLUDED."CashDifference","MovementCount"=EXCLUDED."MovementCount",
 "TotalCash"=EXCLUDED."TotalCash","TotalIncome"=EXCLUDED."TotalIncome",
 "TotalTransfer"=EXCLUDED."TotalTransfer";
INSERT INTO legacy_import_map ("SourceTable","SourceId","TargetKey")
VALUES ('caja_sesiones',${sqlRequiredText(row.id)},'${id}')
ON CONFLICT ("SourceTable","SourceId") DO UPDATE SET "TargetKey"=EXCLUDED."TargetKey";`;
  }).join('\n');
}

function buildCashMovementsSql(rows) {
  return rows.map(row => {
    const id = cashMovementUuid(row.id);
    const memberId = row.usuario_ci
      ? `(SELECT "Id" FROM members WHERE "IdentityNumber"=${sqlRequiredText(row.usuario_ci)})`
      : 'NULL';
    const correction = row.correccion_de_id
      ? `'${cashMovementUuid(row.correccion_de_id)}'`
      : 'NULL';
    return `
INSERT INTO cash_movements (
 "Id","CashSessionId","MemberId","MemberIdentityNumber","MemberName","Amount",
 "PaymentMethod","Description","OccurredAtUtc","Type","CorrectionOfId",
 "CorrectionReason","Note","IsLegacyUnassigned"
) VALUES (
 '${id}',${row.caja_sesion_id == null ? 'NULL' : `'${cashSessionUuid(row.caja_sesion_id)}'`},${memberId},
 ${sqlRequiredText(row.usuario_ci||'')},${sqlRequiredText(row.usuario_nombre||'')},
 ${Number(row.monto||0)},${sqlRequiredText(row.forma_pago,'efectivo')},
 ${sqlRequiredText(row.descripcion,row.tipo_ingreso||'Movimiento')},
 ${sqlText(normalizeTimestamp(row.ts,normalizeDate(row.fecha)))},
 '${movementType(row.tipo_ingreso)}',${correction},${sqlText(row.motivo_correccion)},
 ${sqlText(row.observacion)},${row.caja_sesion_id == null ? 'TRUE' : 'FALSE'}
) ON CONFLICT ("Id") DO NOTHING;
INSERT INTO legacy_import_map ("SourceTable","SourceId","TargetKey")
VALUES ('caja_movimientos',${sqlRequiredText(row.id)},'${id}')
ON CONFLICT ("SourceTable","SourceId") DO UPDATE SET "TargetKey"=EXCLUDED."TargetKey";`;
  }).join('\n');
}

function buildRenewalsSql(rows) {
  return rows.map(row => {
    const id = deterministicUuid('underfit-renewal', row.id);
    const previous = normalizeDate(row.vencimiento_anterior, normalizeDate(row.fecha_pago));
    const next = normalizeDate(row.vencimiento_nuevo, previous);
    return `
INSERT INTO membership_renewals (
 "Id","MemberId","Plan","PaidOn","PreviousExpiration","NewExpiration","Amount",
 "CashMovementId","CashSessionId","MemberName","Notes","PaidAtUtc","PaymentMethod"
) VALUES (
  '${id}',(SELECT "Id" FROM members WHERE "IdentityNumber"=${sqlRequiredText(row.usuario_ci)}),
  '${membershipPlan(row.tipo_membresia)}',
 '${normalizeDate(row.fecha_pago)}','${previous}','${next}',${Number(row.monto||0)},
 ${row.caja_movimiento_id?`'${cashMovementUuid(row.caja_movimiento_id)}'`:'NULL'},
 ${row.caja_sesion_id?`'${cashSessionUuid(row.caja_sesion_id)}'`:'NULL'},
 ${sqlRequiredText(row.usuario_nombre,String(row.usuario_ci))},${sqlText(row.observacion)},
 ${sqlText(normalizeTimestamp(row.ts,normalizeDate(row.fecha_pago)))},
 ${sqlRequiredText(row.forma_pago,'efectivo')}
) ON CONFLICT ("Id") DO NOTHING;
INSERT INTO legacy_import_map ("SourceTable","SourceId","TargetKey")
VALUES ('pagos_membresia',${sqlRequiredText(row.id)},'${id}')
ON CONFLICT ("SourceTable","SourceId") DO UPDATE SET "TargetKey"=EXCLUDED."TargetKey";`;
  }).join('\n');
}

function buildEntriesSql(rows) {
  return rows.map(row => {
    const id = deterministicUuid('underfit-entry', row.id);
    return `
INSERT INTO entries (
 "Id","MemberId","OccurredAtUtc","Source","DeviceId","AnnulledAtUtc",
 "AnnulmentReason","ClassId","IsAnnulled","LocationId","MemberIdentityNumber",
 "MemberName","Observation"
) VALUES (
 '${id}',(SELECT "Id" FROM members WHERE "IdentityNumber"=${sqlRequiredText(row.ci)}),
 ${sqlText(normalizeTimestamp(row.ts,normalizeDate(row.fecha)))},
 ${sqlRequiredText(row.fuente,'kiosk')},${sqlText(row.dispositivo_id)},
 ${row.anulado_ts?sqlText(normalizeTimestamp(row.anulado_ts,normalizeDate(row.fecha))):'NULL'},
 ${sqlText(row.motivo_anulacion)},NULL,${sqlBoolean(row.anulado)},
 ${Number(row.local_id||1)},${sqlRequiredText(row.ci)},
 COALESCE((SELECT "Name" FROM members WHERE "IdentityNumber"=${sqlRequiredText(row.ci)}),${sqlRequiredText(row.ci)}),
 ${sqlText(row.observacion)}
) ON CONFLICT ("Id") DO NOTHING;
INSERT INTO legacy_import_map ("SourceTable","SourceId","TargetKey")
VALUES ('ingresos',${sqlRequiredText(row.id)},'${id}')
ON CONFLICT ("SourceTable","SourceId") DO UPDATE SET "TargetKey"=EXCLUDED."TargetKey";`;
  }).join('\n');
}

function buildHistoryImportSql(data) {
  return `BEGIN;
CREATE TABLE IF NOT EXISTS legacy_import_map (
  "SourceTable" varchar(80) NOT NULL,
  "SourceId" varchar(120) NOT NULL,
  "TargetKey" varchar(120) NOT NULL,
  "ImportedAtUtc" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("SourceTable","SourceId")
);
${buildCashSessionsSql(data.cashSessions)}
${buildCashMovementsSql(data.cashMovements)}
${buildRenewalsSql(data.renewals)}
${buildEntriesSql(data.entries)}
COMMIT;`;
}

function classStatus(value) {
  const status = String(value || '').toLowerCase();
  if (status.includes('curso')) return 'InProgress';
  if (status.includes('dict') || status.includes('realiz')) return 'Held';
  if (status.includes('cancel')) return 'Cancelled';
  return 'Scheduled';
}

function placeholderPin(id, part) {
  return crypto.createHash('sha256').update(`underfit-reset-pin:${id}:${part}`).digest('hex').toUpperCase();
}

function buildProfessorsSql(rows) {
  return rows.map(row => `
INSERT INTO professors ("Id","Name","PinHash","PinSalt","IsActive","CreatedAtUtc","UpdatedAtUtc")
VALUES (${Number(row.id)},${sqlRequiredText(row.nombre)},'${placeholderPin(row.id,'hash')}',
'${placeholderPin(row.id,'salt').slice(0,32)}',${sqlBoolean(row.activo)},
${sqlText(normalizeTimestamp(row.creado_ts))},${sqlText(normalizeTimestamp(row.actualizado_ts))})
ON CONFLICT ("Id") DO UPDATE SET
"Name"=EXCLUDED."Name","IsActive"=EXCLUDED."IsActive","UpdatedAtUtc"=EXCLUDED."UpdatedAtUtc";
INSERT INTO legacy_import_map ("SourceTable","SourceId","TargetKey")
VALUES ('profesores',${sqlRequiredText(row.id)},${sqlRequiredText(row.id)})
ON CONFLICT ("SourceTable","SourceId") DO UPDATE SET "TargetKey"=EXCLUDED."TargetKey";`).join('\n');
}

function buildProfessorSessionsSql(rows) {
  return rows.map(row => `
INSERT INTO professor_sessions (
 "Id","ProfessorId","ProfessorName","LocationId","DeviceId","StartedAtUtc","FinishedAtUtc","IsActive"
) VALUES (
 ${Number(row.id)},${Number(row.profesor_id)},
 COALESCE((SELECT "Name" FROM professors WHERE "Id"=${Number(row.profesor_id)}),'Profesor'),
 ${Number(row.local_id||2)},${sqlRequiredText(row.dispositivo_id,'tablet')},
 ${sqlText(normalizeTimestamp(row.inicio_ts))},
 ${row.fin_ts?sqlText(normalizeTimestamp(row.fin_ts)):'NULL'},
 ${String(row.estado).toLowerCase()==='activa'?'TRUE':'FALSE'}
) ON CONFLICT ("Id") DO UPDATE SET
 "FinishedAtUtc"=EXCLUDED."FinishedAtUtc","IsActive"=EXCLUDED."IsActive";
INSERT INTO legacy_import_map ("SourceTable","SourceId","TargetKey")
VALUES ('sesiones_profesor',${sqlRequiredText(row.id)},${sqlRequiredText(row.id)})
ON CONFLICT ("SourceTable","SourceId") DO UPDATE SET "TargetKey"=EXCLUDED."TargetKey";`).join('\n');
}

function buildSchedulesSql(rows) {
  return rows.map(row => `
INSERT INTO class_schedules (
 "Id","Name","LocationId","ProfessorId","ProfessorName","Weekdays","Time",
 "DurationMinutes","Capacity","StartsOn","EndsOn","Notes","IsActive","CreatedAtUtc","UpdatedAtUtc"
) VALUES (
 ${Number(row.id)},${sqlRequiredText(row.nombre)},${Number(row.local_id||2)},
 ${Number(row.profesor_id)},${sqlRequiredText(row.profesor_nombre,'Profesor')},
 ${sqlRequiredText(row.dias_semana)},${sqlRequiredText(row.hora,'00:00:00')},
 ${Number(row.duracion_minutos||60)},${Number(row.capacidad||12)},
 '${normalizeDate(row.fecha_inicio)}',${row.fecha_fin?`'${normalizeDate(row.fecha_fin)}'`:'NULL'},
 ${sqlText(row.notas)},${String(row.estado).toLowerCase()==='activa'?'TRUE':'FALSE'},
 ${sqlText(normalizeTimestamp(row.creado_ts,normalizeDate(row.fecha_inicio)))},
 ${sqlText(normalizeTimestamp(row.actualizado_ts,normalizeDate(row.fecha_inicio)))}
) ON CONFLICT ("Id") DO UPDATE SET
 "Name"=EXCLUDED."Name","IsActive"=EXCLUDED."IsActive","UpdatedAtUtc"=EXCLUDED."UpdatedAtUtc";
INSERT INTO legacy_import_map ("SourceTable","SourceId","TargetKey")
VALUES ('programaciones_clase',${sqlRequiredText(row.id)},${sqlRequiredText(row.id)})
ON CONFLICT ("SourceTable","SourceId") DO UPDATE SET "TargetKey"=EXCLUDED."TargetKey";`).join('\n');
}

function buildClassesSql(rows) {
  return rows.map(row => `
INSERT INTO gym_classes (
 "Id","Name","Date","Time","DurationMinutes","Capacity","ProfessorName","ProfessorId",
 "LocationId","Notes","Status","CreatedAtUtc","ActualStartUtc","ActualEndUtc","ScheduleId"
) VALUES (
 ${Number(row.id)},${sqlRequiredText(row.nombre)},'${normalizeDate(row.fecha)}',
 ${sqlRequiredText(row.hora,'00:00:00')},${Number(row.duracion_minutos||60)},
 ${Number(row.capacidad||12)},${sqlRequiredText(row.profesor,'Profesor')},
 ${row.profesor_id?Number(row.profesor_id):'NULL'},${Number(row.local_id||2)},${sqlText(row.notas)},
 '${classStatus(row.estado)}',${sqlText(normalizeTimestamp(row.creado_ts,normalizeDate(row.fecha)))},
 ${row.inicio_real_ts?sqlText(normalizeTimestamp(row.inicio_real_ts,normalizeDate(row.fecha))):'NULL'},
 ${row.fin_real_ts?sqlText(normalizeTimestamp(row.fin_real_ts,normalizeDate(row.fecha))):'NULL'},
 ${row.programacion_id?Number(row.programacion_id):'NULL'}
) ON CONFLICT ("Id") DO UPDATE SET
 "Status"=EXCLUDED."Status","ActualStartUtc"=EXCLUDED."ActualStartUtc",
 "ActualEndUtc"=EXCLUDED."ActualEndUtc","ProfessorId"=EXCLUDED."ProfessorId";
INSERT INTO legacy_import_map ("SourceTable","SourceId","TargetKey")
VALUES ('clases',${sqlRequiredText(row.id)},${sqlRequiredText(row.id)})
ON CONFLICT ("SourceTable","SourceId") DO UPDATE SET "TargetKey"=EXCLUDED."TargetKey";`).join('\n');
}

function buildClassEnrollmentsSql(oneOffRows, recurringRows) {
  const oneOff = oneOffRows.map(row => {
    const id=deterministicUuid('underfit-class-enrollment',row.id);
    const active=String(row.estado||'inscripto').toLowerCase()==='inscripto';
    return `
INSERT INTO class_enrollments (
 "Id","ClassId","ScheduleId","MemberId","MemberIdentityNumber","MemberName",
 "IsActive","CreatedAtUtc","EffectiveFrom","EffectiveUntil","EndedAtUtc"
) VALUES (
 '${id}',${Number(row.clase_id)},NULL,
 (SELECT "Id" FROM members WHERE "IdentityNumber"=${sqlRequiredText(row.usuario_ci)}),
 ${sqlRequiredText(row.usuario_ci)},${sqlRequiredText(row.usuario_nombre)},
 ${active?'TRUE':'FALSE'},${sqlText(normalizeTimestamp(row.creado_ts))},
 (SELECT "Date" FROM gym_classes WHERE "Id"=${Number(row.clase_id)}),
 ${active?'NULL':`(SELECT "Date" FROM gym_classes WHERE "Id"=${Number(row.clase_id)})`},
 ${active?'NULL':sqlText(normalizeTimestamp(row.creado_ts))}
) ON CONFLICT ("Id") DO NOTHING;
INSERT INTO legacy_import_map ("SourceTable","SourceId","TargetKey")
VALUES ('inscripciones_clase',${sqlRequiredText(row.id)},'${id}')
ON CONFLICT ("SourceTable","SourceId") DO UPDATE SET "TargetKey"=EXCLUDED."TargetKey";`;
  }).join('\n');
  const recurring = recurringRows.map(row => {
    const id=deterministicUuid('underfit-schedule-enrollment',row.id);
    const active=String(row.estado||'inscripto').toLowerCase()==='inscripto';
    return `
INSERT INTO class_enrollments (
 "Id","ClassId","ScheduleId","MemberId","MemberIdentityNumber","MemberName",
 "IsActive","CreatedAtUtc","EffectiveFrom","EffectiveUntil","EndedAtUtc"
) VALUES (
 '${id}',NULL,${Number(row.programacion_id)},
 (SELECT "Id" FROM members WHERE "IdentityNumber"=${sqlRequiredText(row.usuario_ci)}),
 ${sqlRequiredText(row.usuario_ci)},${sqlRequiredText(row.usuario_nombre)},
 ${active?'TRUE':'FALSE'},${sqlText(normalizeTimestamp(row.creado_ts))},
 (SELECT "StartsOn" FROM class_schedules WHERE "Id"=${Number(row.programacion_id)}),
 ${active?'NULL':`(SELECT "StartsOn" FROM class_schedules WHERE "Id"=${Number(row.programacion_id)})`},
 ${active?'NULL':sqlText(normalizeTimestamp(row.creado_ts))}
) ON CONFLICT ("Id") DO NOTHING;
INSERT INTO legacy_import_map ("SourceTable","SourceId","TargetKey")
VALUES ('inscripciones_programacion_clase',${sqlRequiredText(row.id)},'${id}')
ON CONFLICT ("SourceTable","SourceId") DO UPDATE SET "TargetKey"=EXCLUDED."TargetKey";`;
  }).join('\n');
  return `${oneOff}\n${recurring}`;
}

function buildClassAttendancesSql(rows) {
  return rows.map(row => {
    const attendanceId=deterministicUuid('underfit-class-attendance',row.id);
    const entryId=row.ingreso_id
      ? deterministicUuid('underfit-entry',row.ingreso_id)
      : deterministicUuid('underfit-class-entry',row.id);
    const syntheticEntry=row.ingreso_id?'':`
INSERT INTO entries (
 "Id","MemberId","OccurredAtUtc","Source","DeviceId","AnnulledAtUtc","AnnulmentReason",
 "ClassId","IsAnnulled","LocationId","MemberIdentityNumber","MemberName","Observation"
) VALUES (
 '${entryId}',(SELECT "Id" FROM members WHERE "IdentityNumber"=${sqlRequiredText(row.usuario_ci)}),
 ${sqlText(normalizeTimestamp(row.ts,normalizeDate(row.fecha)))},'class-import',
 ${sqlText(row.dispositivo_id)},${row.anulado_ts?sqlText(normalizeTimestamp(row.anulado_ts,normalizeDate(row.fecha))):'NULL'},
 ${sqlText(row.motivo_anulacion)},${Number(row.clase_id)},${sqlBoolean(row.anulado)},
 ${Number(row.local_id||2)},${sqlRequiredText(row.usuario_ci)},
 COALESCE((SELECT "Name" FROM members WHERE "IdentityNumber"=${sqlRequiredText(row.usuario_ci)}),${sqlRequiredText(row.usuario_ci)}),
 'Ingreso sintetizado durante importacion de asistencia'
) ON CONFLICT ("Id") DO NOTHING;`;
    return `${syntheticEntry}
INSERT INTO class_attendances (
 "Id","ClassId","ScheduleId","MemberId","MemberIdentityNumber","MemberName","EntryId",
 "LocationId","ProfessorId","ProfessorSessionId","DeviceId","OccurredAtUtc","IsAnnulled"
) VALUES (
 '${attendanceId}',${Number(row.clase_id)},${row.programacion_id?Number(row.programacion_id):'NULL'},
 (SELECT "Id" FROM members WHERE "IdentityNumber"=${sqlRequiredText(row.usuario_ci)}),
 ${sqlRequiredText(row.usuario_ci)},
 COALESCE((SELECT "Name" FROM members WHERE "IdentityNumber"=${sqlRequiredText(row.usuario_ci)}),${sqlRequiredText(row.usuario_ci)}),
 '${entryId}',${Number(row.local_id||2)},${Number(row.profesor_id)},
 ${!Number(row.profesor_sesion_id) ? 'NULL' : Number(row.profesor_sesion_id)},${sqlRequiredText(row.dispositivo_id,'tablet')},
 ${sqlText(normalizeTimestamp(row.ts,normalizeDate(row.fecha)))},${sqlBoolean(row.anulado)}
) ON CONFLICT ("Id") DO NOTHING;
INSERT INTO legacy_import_map ("SourceTable","SourceId","TargetKey")
VALUES ('asistencias_clase',${sqlRequiredText(row.id)},'${attendanceId}')
ON CONFLICT ("SourceTable","SourceId") DO UPDATE SET "TargetKey"=EXCLUDED."TargetKey";`;
  }).join('\n');
}

function buildClassImportSql(data) {
  return `BEGIN;
CREATE TABLE IF NOT EXISTS legacy_import_map (
 "SourceTable" varchar(80) NOT NULL,"SourceId" varchar(120) NOT NULL,
 "TargetKey" varchar(120) NOT NULL,"ImportedAtUtc" timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY ("SourceTable","SourceId")
);
${buildProfessorsSql(data.professors)}
${buildProfessorSessionsSql(data.professorSessions)}
${buildSchedulesSql(data.schedules)}
${buildClassesSql(data.classes)}
${buildClassEnrollmentsSql(data.classEnrollments||[],data.scheduleEnrollments||[])}
${buildClassAttendancesSql(data.classAttendances||[])}
SELECT setval(pg_get_serial_sequence('professors','Id'),GREATEST(COALESCE((SELECT MAX("Id") FROM professors),1),1),true);
SELECT setval(pg_get_serial_sequence('professor_sessions','Id'),GREATEST(COALESCE((SELECT MAX("Id") FROM professor_sessions),1),1),true);
SELECT setval(pg_get_serial_sequence('class_schedules','Id'),GREATEST(COALESCE((SELECT MAX("Id") FROM class_schedules),1),1),true);
SELECT setval(pg_get_serial_sequence('gym_classes','Id'),GREATEST(COALESCE((SELECT MAX("Id") FROM gym_classes),1),1),true);
COMMIT;`;
}

async function readClassMasters(dbPath) {
  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
  try {
    return {
      professors: await readOptionalTable(db,'profesores'),
      professorSessions: await readOptionalTable(db,'sesiones_profesor'),
      schedules: await readOptionalTable(db,'programaciones_clase'),
      classes: await readOptionalTable(db,'clases'),
      classEnrollments: await readOptionalTable(db,'inscripciones_clase'),
      scheduleEnrollments: await readOptionalTable(db,'inscripciones_programacion_clase'),
      classAttendances: await readOptionalTable(db,'asistencias_clase'),
    };
  } finally {
    await new Promise(resolve=>db.close(resolve));
  }
}

async function importLegacyClasses(dbPath,{apply=false}={}) {
  const inspection=await inspectLegacyDatabase(dbPath);
  if(!inspection.canImport)throw new Error('El diagnostico contiene errores bloqueantes');
  const data=await readClassMasters(dbPath);
  const sql=buildClassImportSql(data);
  if(apply)executeSql(sql);
  return {
    applied:apply,professors:data.professors.length,
    professorSessions:data.professorSessions.length,schedules:data.schedules.length,
    classes:data.classes.length,requiresProfessorPinReset:data.professors.length,
    classEnrollments:data.classEnrollments.length+data.scheduleEnrollments.length,
    classAttendances:data.classAttendances.length,
    sqlBytes:Buffer.byteLength(sql),
  };
}

function buildProductSalesSql(rows) {
  return rows.map(row => `
INSERT INTO products ("Id","Name","Price","IsActive")
VALUES (${Number(row.producto_id)},${sqlRequiredText(row.nombre,'Producto historico')},0,FALSE)
ON CONFLICT ("Id") DO NOTHING;
INSERT INTO product_sales (
 "Id","ProductId","ProductName","Quantity","Total","PaymentMethod",
 "ReceivedAmount","Change","Note","OccurredAtUtc"
) VALUES (
 ${Number(row.id)},${Number(row.producto_id)},${sqlRequiredText(row.nombre,'Producto')},
 ${Number(row.cantidad||1)},${Number(row.total||0)},${sqlRequiredText(row.forma_pago,'efectivo')},
 ${Number(row.monto_recibido??row.total??0)},${Number(row.cambio||0)},
 ${sqlText(row.observacion)},${sqlText(normalizeTimestamp(row.ts,normalizeDate(row.fecha)))}
) ON CONFLICT ("Id") DO NOTHING;
INSERT INTO legacy_import_map ("SourceTable","SourceId","TargetKey")
VALUES ('ventas_productos',${sqlRequiredText(row.id)},${sqlRequiredText(row.id)})
ON CONFLICT ("SourceTable","SourceId") DO UPDATE SET "TargetKey"=EXCLUDED."TargetKey";`).join('\n');
}

function buildPendingSalesSql(rows) {
  return rows.map(row => {
    const collected=String(row.estado).toLowerCase()!=='pendiente';
    return `
INSERT INTO products ("Id","Name","Price","IsActive")
VALUES (${Number(row.producto_id)},${sqlRequiredText(row.producto_nombre,'Producto historico')},0,FALSE)
ON CONFLICT ("Id") DO NOTHING;
INSERT INTO pending_product_sales (
 "Id","ProductId","ProductName","MemberIdentityNumber","MemberName","Quantity","Total",
 "Professor","ProfessorId","ProfessorSessionId","LocationId","Note","OccurredAtUtc",
 "Status","CollectedAtUtc","PaymentMethod","CashMovementId"
) VALUES (
 ${Number(row.id)},${Number(row.producto_id)},${sqlRequiredText(row.producto_nombre,'Producto')},
 ${sqlRequiredText(row.usuario_ci)},${sqlRequiredText(row.usuario_nombre,String(row.usuario_ci))},
 ${Number(row.cantidad||1)},${Number(row.total||0)},${sqlRequiredText(row.profesor,'Profesor')},
 ${Number(row.profesor_id||0)},${Number(row.profesor_sesion_id||0)},${Number(row.local_id||2)},
 ${sqlText(row.observacion)},${sqlText(normalizeTimestamp(row.ts,normalizeDate(row.fecha)))},
 '${collected?'Collected':'Pending'}',
 ${row.cobrado_ts?sqlText(normalizeTimestamp(row.cobrado_ts,normalizeDate(row.fecha))):'NULL'},
 ${sqlText(row.forma_pago)},
 ${row.caja_movimiento_id?`'${cashMovementUuid(row.caja_movimiento_id)}'`:'NULL'}
) ON CONFLICT ("Id") DO NOTHING;
INSERT INTO legacy_import_map ("SourceTable","SourceId","TargetKey")
VALUES ('ventas_pendientes',${sqlRequiredText(row.id)},${sqlRequiredText(row.id)})
ON CONFLICT ("SourceTable","SourceId") DO UPDATE SET "TargetKey"=EXCLUDED."TargetKey";`;
  }).join('\n');
}

function configValue(config, key, fallback) {
  const value=config.find(row=>row.key===key)?.value;
  return value===undefined||value===null||String(value).trim()===''?fallback:value;
}

function buildSettingsSql(config) {
  const registration=Number(configValue(config,'precio_inscripcion',0));
  const monthly=Number(configValue(config,'precio_membresia_mensual',0));
  const quarterly=Number(configValue(config,'precio_membresia_trimestral',0));
  const semiannual=Number(configValue(config,'precio_membresia_semestral',0));
  const active=configValue(config,'evento_running_activo','false');
  const name=configValue(config,'evento_running_nombre','UNDER RUNNING');
  const distances=configValue(config,'evento_running_distancias','3KM & 5KM');
  const date=normalizeDate(configValue(config,'evento_running_fecha','2026-05-24'),'2026-05-24');
  return `
INSERT INTO registration_price ("Id","Amount") VALUES (1,${registration})
ON CONFLICT ("Id") DO UPDATE SET "Amount"=EXCLUDED."Amount";
INSERT INTO membership_prices ("Plan","Amount") VALUES
 ('Monthly',${monthly}),('Quarterly',${quarterly}),('Semiannual',${semiannual})
ON CONFLICT ("Plan") DO UPDATE SET "Amount"=EXCLUDED."Amount";
INSERT INTO business_settings (
 "Id","RunningEventActive","RunningEventName","RunningEventDistances","RunningEventDate"
) VALUES (1,${sqlBoolean(active)},${sqlRequiredText(name)},${sqlRequiredText(distances)},'${date}')
ON CONFLICT ("Id") DO UPDATE SET
 "RunningEventActive"=EXCLUDED."RunningEventActive",
 "RunningEventName"=EXCLUDED."RunningEventName",
 "RunningEventDistances"=EXCLUDED."RunningEventDistances",
 "RunningEventDate"=EXCLUDED."RunningEventDate";`;
}

function buildCommercialImportSql(data) {
  return `BEGIN;
CREATE TABLE IF NOT EXISTS legacy_import_map (
 "SourceTable" varchar(80) NOT NULL,"SourceId" varchar(120) NOT NULL,
 "TargetKey" varchar(120) NOT NULL,"ImportedAtUtc" timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY ("SourceTable","SourceId")
);
${buildProductSalesSql(data.productSales)}
${buildPendingSalesSql(data.pendingSales)}
${buildSettingsSql(data.config)}
SELECT setval(pg_get_serial_sequence('products','Id'),GREATEST(COALESCE((SELECT MAX("Id") FROM products),1),1),true);
SELECT setval(pg_get_serial_sequence('product_sales','Id'),GREATEST(COALESCE((SELECT MAX("Id") FROM product_sales),1),1),true);
SELECT setval(pg_get_serial_sequence('pending_product_sales','Id'),GREATEST(COALESCE((SELECT MAX("Id") FROM pending_product_sales),1),1),true);
COMMIT;`;
}

async function readCommercial(dbPath) {
  const db=new sqlite3.Database(dbPath,sqlite3.OPEN_READONLY);
  try {
    return {
      productSales:await all(db,'SELECT * FROM ventas_productos ORDER BY id'),
      pendingSales:await readOptionalTable(db,'ventas_pendientes'),
      config:await all(db,'SELECT key,value FROM app_config ORDER BY key'),
    };
  } finally {await new Promise(resolve=>db.close(resolve));}
}

async function importLegacyCommercial(dbPath,{apply=false}={}) {
  const inspection=await inspectLegacyDatabase(dbPath);
  if(!inspection.canImport)throw new Error('El diagnostico contiene errores bloqueantes');
  const data=await readCommercial(dbPath);
  const sql=buildCommercialImportSql(data);
  if(apply)executeSql(sql);
  return {
    applied:apply,productSales:data.productSales.length,
    pendingSales:data.pendingSales.length,settings:data.config.length,
    sqlBytes:Buffer.byteLength(sql),
  };
}

async function readHistory(dbPath) {
  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
  try {
    return {
      cashSessions: await all(db, 'SELECT * FROM caja_sesiones ORDER BY id'),
      cashMovements: await all(db, 'SELECT * FROM caja_movimientos ORDER BY id'),
      renewals: await all(db, 'SELECT * FROM pagos_membresia ORDER BY id'),
      entries: await all(db, 'SELECT * FROM ingresos ORDER BY id'),
    };
  } finally {
    await new Promise(resolve => db.close(resolve));
  }
}

async function importLegacyHistory(dbPath, { apply = false } = {}) {
  const inspection = await inspectLegacyDatabase(dbPath);
  if (!inspection.canImport) throw new Error('El diagnostico contiene errores bloqueantes');
  const data = await readHistory(dbPath);
  validateHistorySessions(data);
  const sql = buildHistoryImportSql(data);
  if (apply) executeSql(sql);
  return {
    applied: apply,
    cashSessions: data.cashSessions.length,
    cashMovements: data.cashMovements.length,
    legacyUnassigned: data.cashMovements.filter(row => row.caja_sesion_id == null).length,
    renewals: data.renewals.length,
    entries: data.entries.length,
    sqlBytes: Buffer.byteLength(sql),
  };
}

function validateHistorySessions(data) {
  const sessions = new Set(data.cashSessions.map(row => String(row.id)));
  // A genuinely absent session is historical data, not permission to invent
  // one. A non-null reference to a missing session is still a blocking error.
  const unlinked = data.cashMovements.filter(row => row.caja_sesion_id != null && !sessions.has(String(row.caja_sesion_id)));
  if (unlinked.length) {
    throw new Error(`Historial no importable todavía: ${unlinked.length} movimientos sin sesión de caja válida. No se reasignaron ni descartaron.`);
  }
}

async function importLegacyMasters(dbPath, { apply = false } = {}) {
  const inspection = await inspectLegacyDatabase(dbPath);
  if (!inspection.canImport) throw new Error('El diagnostico contiene errores bloqueantes');
  const data = await readMasters(dbPath);
  const sql = buildImportSql(data);
  if (apply) executeSql(sql);
  return {
    applied: apply,
    members: data.members.length,
    products: data.products.length,
    sqlBytes: Buffer.byteLength(sql),
  };
}

module.exports = {
  readMasters,
  readHistory,
  readCommercial,
  executeSql,
  validateHistorySessions,
  importLegacyMasters,
  buildImportSql,
  deterministicUuid,
  importLegacyHistory,
  buildHistoryImportSql,
  importLegacyClasses,
  buildClassImportSql,
  importLegacyCommercial,
  buildCommercialImportSql,
};
