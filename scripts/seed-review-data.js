const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const sqlite3 = require('sqlite3').verbose();
const { ejecutarMigraciones } = require('../migrations');

const databasePath = require('./demoDatabase').resolveDemoDatabase();

function openDatabase(filePath) { return new sqlite3.Database(filePath); }
function run(db, sql, params = []) {
  return new Promise((resolve, reject) => db.run(sql, params, function (error) {
    if (error) return reject(error);
    resolve(this);
  }));
}
function get(db, sql, params = []) {
  return new Promise((resolve, reject) => db.get(sql, params, (error, row) => {
    if (error) return reject(error);
    resolve(row || null);
  }));
}
function all(db, sql, params = []) {
  return new Promise((resolve, reject) => db.all(sql, params, (error, rows) => {
    if (error) return reject(error);
    resolve(rows || []);
  }));
}
function close(db) { return new Promise((resolve, reject) => db.close(error => error ? reject(error) : resolve())); }
function isoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function addDays(date, amount) { const result = new Date(date); result.setDate(result.getDate() + amount); return result; }
function localTimestamp(date, time) { return `${isoDate(date)}T${time}:00`; }

async function backupDatabase() {
  await fs.mkdir(path.dirname(databasePath), { recursive: true });
  try { await fs.access(databasePath); } catch (_) { return null; }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(path.dirname(databasePath), 'backups', `review-before-seed-${stamp}.db`);
  await fs.mkdir(path.dirname(backupPath), { recursive: true });
  await fs.copyFile(databasePath, backupPath);
  return backupPath;
}

async function upsertProduct(db, name, price, stock = 30) {
  const existing = await get(db, 'SELECT id FROM productos WHERE LOWER(nombre) = LOWER(?) ORDER BY id LIMIT 1', [name]);
  if (existing) {
    await run(db, 'UPDATE productos SET precio = ?, stock = ?, activo = 1 WHERE id = ?', [price, stock, existing.id]);
    return existing.id;
  }
  return (await run(db, 'INSERT INTO productos (nombre, precio, stock, activo) VALUES (?, ?, ?, 1)', [name, price, stock])).lastID;
}

async function upsertProfessor(db, name, pin) {
  const existing = await get(db, 'SELECT id FROM profesores WHERE LOWER(nombre) = LOWER(?)', [name]);
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pin, salt, 32).toString('hex');
  const now = new Date().toISOString();
  if (existing) {
    await run(db, 'UPDATE profesores SET activo = 1, pin_hash = ?, pin_salt = ?, actualizado_ts = ? WHERE id = ?', [hash, salt, now, existing.id]);
    return existing.id;
  }
  return (await run(db, `INSERT INTO profesores (nombre, pin_hash, pin_salt, activo, creado_ts, actualizado_ts) VALUES (?, ?, ?, 1, ?, ?)`, [name, hash, salt, now, now])).lastID;
}

async function seed() {
  const backupPath = await backupDatabase();
  await ejecutarMigraciones(databasePath);
  const db = openDatabase(databasePath);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const todayText = isoDate(today);
  const now = new Date().toISOString();
  const members = [
    [99000001, 'Martina Silva', 18, 'Fuerza y movilidad', 'mensual'],
    [99000002, 'Federico Ramos', 6, 'Mejorar resistencia', 'mensual'],
    [99000003, 'Lucía Cabrera', -2, 'Tonificación general', 'trimestral'],
    [99000004, 'Joaquín Méndez', 74, 'Preparación deportiva', 'trimestral'],
    [99000005, 'Ana Pereira', 29, 'Hábitos saludables', 'mensual'],
    [99000006, 'Diego González', 3, 'Acondicionamiento', 'mensual'],
    [99000007, 'Sofía Núñez', 42, 'Fuerza de tren inferior', 'semestral'],
    [99000008, 'Bruno Acosta', -7, 'Volver a entrenar', 'mensual'],
    [99000009, 'Valentina Suárez', 12, 'Movilidad y postura', 'mensual'],
    [99000010, 'Nicolás Torres', 91, 'Hipertrofia', 'trimestral'],
    [99000011, 'Carolina Díaz', 1, 'Running 5K', 'mensual'],
    [99000012, 'Mateo Rodríguez', -16, 'Salud general', 'mensual'],
    [99000013, 'Emilia Fernández', 24, 'Fuerza general', 'mensual'],
    [99000014, 'Agustín Moreira', 57, 'Mejorar movilidad', 'trimestral'],
    [99000015, 'Florencia Sosa', -1, 'Retomar actividad', 'mensual'],
    [99000016, 'Sebastián Viera', 8, 'Preparación para fútbol', 'mensual'],
    [99000017, 'Julieta Techera', 33, 'Tonificación', 'trimestral'],
    [99000018, 'Rodrigo Cardozo', -9, 'Bajar de peso', 'mensual'],
    [99000019, 'Camila Bentancur', 63, 'Ganancia de fuerza', 'semestral'],
    [99000020, 'Ignacio Olivera', 14, 'Acondicionamiento general', 'mensual'],
    [99000021, 'Paula Méndez', 2, 'Movilidad lumbar', 'mensual'],
    [99000022, 'Gonzalo Perdomo', 104, 'Hipertrofia', 'semestral'],
    [99000023, 'Micaela Santos', -21, 'Volver a entrenar', 'mensual'],
    [99000024, 'Facundo Lima', 45, 'Resistencia', 'trimestral'],
    [99000025, 'Victoria Rivas', 19, 'Fuerza de tren inferior', 'mensual'],
    [99000026, 'Martín Suárez', 76, 'Running 10K', 'trimestral'],
    [99000027, 'Renata Castro', 5, 'Postura y movilidad', 'mensual'],
    [99000028, 'Leandro Núñez', -4, 'Salud cardiovascular', 'mensual'],
    [99000029, 'Isabella Pereira', 38, 'Fuerza funcional', 'trimestral'],
    [99000030, 'Santiago Cabrera', 11, 'Preparación deportiva', 'mensual'],
  ];

  await run(db, 'BEGIN IMMEDIATE TRANSACTION');
  try {
    for (const [ci, name, days, goal, membership] of members) {
      await run(db, `
        INSERT INTO usuarios (
          ci, nombre, numero, email, fecha_creacion, ultima_actualizacion, fecha_vencimiento,
          detalle, contacto_emergencia, telefono_emergencia, forma_pago_alta, autorizacion_imagen,
          fecha_nacimiento, direccion, relacion_emergencia, condicion_medica, objetivo,
          tipo_membresia, preferencia_pago
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'efectivo', 1, ?, ?, ?, ?, ?, ?, 'transferencia')
        ON CONFLICT(ci) DO UPDATE SET nombre = excluded.nombre, numero = excluded.numero,
          email = excluded.email, ultima_actualizacion = excluded.ultima_actualizacion,
          fecha_vencimiento = excluded.fecha_vencimiento, detalle = excluded.detalle,
          contacto_emergencia = excluded.contacto_emergencia,
          telefono_emergencia = excluded.telefono_emergencia, objetivo = excluded.objetivo,
          tipo_membresia = excluded.tipo_membresia
      `, [ci, name, `09${String(ci).slice(-7)}`, `${name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '.')}@demo.underfit.uy`,
        isoDate(addDays(today, -180)), todayText, isoDate(addDays(today, days)), 'Socio cargado para revisión visual',
        'María González', '099 123 456', '1992-05-14', 'Av. Italia 2345', 'Familiar', '', goal, membership]);
    }

    await run(db, `DELETE FROM pagos_membresia
      WHERE usuario_ci = 99000002 AND observacion = 'REVIEW_DEMO_FEDERICO'`);
    for (const [daysAgo, time, paymentMethod] of [
      [4, '10:05', 'transferencia'],
      [34, '18:20', 'efectivo'],
    ]) {
      const paymentDate = addDays(today, -daysAgo);
      const previousExpiration = addDays(paymentDate, 6);
      const newExpiration = addDays(previousExpiration, 30);
      await run(db, `INSERT INTO pagos_membresia (
        usuario_ci, usuario_nombre, fecha_pago, hora_pago, ts, tipo_membresia,
        dias_agregados, monto, forma_pago, vencimiento_anterior, vencimiento_nuevo,
        observacion
      ) VALUES (99000002, 'Federico Ramos', ?, ?, ?, 'mensual', 30, 1600, ?, ?, ?, 'REVIEW_DEMO_FEDERICO')`, [
        isoDate(paymentDate), time, localTimestamp(paymentDate, time), paymentMethod,
        isoDate(previousExpiration), isoDate(newExpiration),
      ]);
    }

    const productIds = {};
    for (const [name, price, stock] of [
      ['Agua mineral 1.5 L', 95, 24], ['Agua mineral 600 ml', 60, 36],
      ['Agua saborizada 500 ml', 85, 18], ['Barrita de cereal chocolate', 70, 20],
      ['Barrita de cereal frutos rojos', 70, 14], ['Bebida isotonica 500 ml', 120, 16],
      ['Proteína individual', 160, 12], ['Entrada Under Running 3K', 550, 40],
      ['Entrada Under Running 5K', 650, 40],
      ['Bebida energética sin azúcar', 145, 22], ['Mix de frutos secos', 130, 17],
      ['Toalla deportiva Under-Fit', 420, 9], ['Shaker Under-Fit 700 ml', 390, 13],
      ['Gel energético cítrico', 110, 28], ['Banda elástica media', 480, 8],
    ]) productIds[name] = await upsertProduct(db, name, price, stock);
    const seededAccentDuplicate = await get(db, `SELECT id FROM productos WHERE nombre = 'Bebida isotónica 500 ml'`);
    if (seededAccentDuplicate && seededAccentDuplicate.id !== productIds['Bebida isotonica 500 ml']) {
      await run(db, 'DELETE FROM stock_local WHERE producto_id = ?', [seededAccentDuplicate.id]);
      await run(db, 'DELETE FROM productos WHERE id = ?', [seededAccentDuplicate.id]);
    }

    const professorIds = {};
    for (const [name, pin] of [['Santiago Pérez', '1204'], ['Camila López', '2580'], ['Diego Fernández', '4412']]) {
      professorIds[name] = await upsertProfessor(db, name, pin);
    }

    const exercises = [
      ['Sentadilla con barra', 'Piernas', 'Pies al ancho de hombros, torso firme y rodillas acompañando la línea de los pies.', 'assets/exercises/squat.svg'],
      ['Press de banca', 'Pecho', 'Escápulas estables, apoyo completo y descenso controlado de la barra.', 'assets/exercises/press.svg'],
      ['Remo con mancuerna', 'Espalda', 'Columna neutra y codo hacia atrás sin rotar el tronco.', 'assets/exercises/row.svg'],
      ['Peso muerto rumano', 'Posterior', 'Cadera hacia atrás, barra próxima al cuerpo y espalda neutra.', 'assets/exercises/deadlift.svg'],
      ['Plancha frontal', 'Core', 'Alinear hombros, cadera y talones manteniendo tensión abdominal.', 'assets/exercises/plank.svg'],
      ['Zancadas alternas', 'Piernas', 'Paso estable y descenso vertical manteniendo el control de la rodilla.', 'assets/exercises/lunge.svg'],
      ['Press militar', 'Hombros', 'Glúteos y abdomen activos; empujar sin arquear la zona lumbar.', 'assets/exercises/press.svg'],
      ['Jalón al pecho', 'Espalda', 'Llevar la barra al pecho con hombros bajos y regreso controlado.', 'assets/exercises/row.svg'],
      ['Puente de glúteos', 'Glúteos', 'Empujar desde talones y completar la extensión sin hiperextender la espalda.', 'assets/exercises/squat.svg'],
      ['Dead bug', 'Core', 'Zona lumbar estable mientras se extienden brazo y pierna opuestos.', 'assets/exercises/plank.svg'],
      ['Elevación lateral', 'Hombros', 'Elevar con control hasta la línea de los hombros sin impulsar el torso.', 'assets/exercises/press.svg'],
      ['Curl de bíceps', 'Brazos', 'Mantener los codos estables y controlar tanto la subida como el descenso.', 'assets/exercises/row.svg'],
      ['Extensión de tríceps', 'Brazos', 'Fijar los hombros y completar la extensión sin separar los codos.', 'assets/exercises/press.svg'],
      ['Prensa de piernas', 'Piernas', 'Apoyar toda la espalda y evitar bloquear las rodillas al extender.', 'assets/exercises/squat.svg'],
      ['Face pull', 'Espalda', 'Llevar la cuerda hacia el rostro con escápulas activas y hombros bajos.', 'assets/exercises/row.svg'],
      ['Bird dog', 'Core', 'Extender brazo y pierna opuestos sin perder estabilidad de la pelvis.', 'assets/exercises/plank.svg'],
      ['Step up al banco', 'Piernas', 'Subir empujando con la pierna apoyada y descender de forma controlada.', 'assets/exercises/lunge.svg'],
      ['Fondos asistidos', 'Pecho', 'Descender con hombros estables y extender sin perder el control.', 'assets/exercises/press.svg'],
    ];
    const exerciseIds = {};
    for (const [name, group, instructions, media] of exercises) {
      await run(db, `
        INSERT INTO ejercicios (nombre, grupo_muscular, instrucciones, gif_url, activo, creado_ts, actualizado_ts)
        VALUES (?, ?, ?, ?, 1, ?, ?)
        ON CONFLICT(nombre) DO UPDATE SET grupo_muscular = excluded.grupo_muscular,
          instrucciones = excluded.instrucciones, gif_url = excluded.gif_url,
          activo = 1, actualizado_ts = excluded.actualizado_ts
      `, [name, group, instructions, media, now, now]);
      exerciseIds[name] = (await get(db, 'SELECT id FROM ejercicios WHERE nombre = ?', [name])).id;
    }

    const routineDays = {
      fuerza: [
        { position: 1, name: 'Tren inferior', muscleGroups: 'Piernas y glúteos', exercises: [
          { exerciseId: exerciseIds['Sentadilla con barra'], position: 1, sets: 4, repetitions: '8', load: null, restSeconds: 90, notes: null },
          { exerciseId: exerciseIds['Peso muerto rumano'], position: 2, sets: 3, repetitions: '10', load: null, restSeconds: 75, notes: null },
          { exerciseId: exerciseIds['Zancadas alternas'], position: 3, sets: 3, repetitions: '10 por pierna', load: null, restSeconds: 60, notes: null },
        ] },
        { position: 2, name: 'Tren superior', muscleGroups: 'Pecho y espalda', exercises: [
          { exerciseId: exerciseIds['Press de banca'], position: 1, sets: 4, repetitions: '8', load: null, restSeconds: 90, notes: null },
          { exerciseId: exerciseIds['Remo con mancuerna'], position: 2, sets: 3, repetitions: '12', load: null, restSeconds: 60, notes: null },
          { exerciseId: exerciseIds['Press militar'], position: 3, sets: 3, repetitions: '10', load: null, restSeconds: 60, notes: null },
        ] },
      ],
      inicial: [{ position: 1, name: 'Circuito inicial', muscleGroups: 'Cuerpo completo', exercises: [
        { exerciseId: exerciseIds['Puente de glúteos'], position: 1, sets: 3, repetitions: '12', load: null, restSeconds: 45, notes: null },
        { exerciseId: exerciseIds['Jalón al pecho'], position: 2, sets: 3, repetitions: '12', load: null, restSeconds: 60, notes: null },
        { exerciseId: exerciseIds['Dead bug'], position: 3, sets: 3, repetitions: '8 por lado', load: null, restSeconds: 45, notes: null },
      ] }],
      funcional: [{ position: 1, name: 'Fuerza funcional', muscleGroups: 'Cuerpo completo', exercises: [
        { exerciseId: exerciseIds['Sentadilla con barra'], position: 1, sets: 3, repetitions: '10', load: null, restSeconds: 60, notes: null },
        { exerciseId: exerciseIds['Press militar'], position: 2, sets: 3, repetitions: '10', load: null, restSeconds: 60, notes: null },
        { exerciseId: exerciseIds['Plancha frontal'], position: 3, sets: 3, repetitions: '35 segundos', load: null, restSeconds: 40, notes: null },
      ] }],
    };

    const routineTemplates = [
      ['Fuerza · 2 días', routineDays.fuerza],
      ['Inicio · cuerpo completo', routineDays.inicial],
      ['Funcional · 3 días', routineDays.funcional],
      ['Hipertrofia · 4 días', [...routineDays.fuerza, ...routineDays.fuerza].map((day, index) => ({ ...day, position: index + 1, name: `${day.name} ${index < 2 ? 'A' : 'B'}` }))],
      ['Acondicionamiento · 3 días', [...routineDays.funcional, ...routineDays.inicial, ...routineDays.funcional].map((day, index) => ({ ...day, position: index + 1, name: `Sesión ${index + 1}` }))],
      ['Tren inferior · 2 días', [routineDays.fuerza[0], { ...routineDays.fuerza[0], position: 2, name: 'Tren inferior B' }]],
      ['Full body express', routineDays.funcional],
      ['Movilidad y retorno', routineDays.inicial],
      ['Fuerza base · 3 días', [...routineDays.fuerza, ...routineDays.inicial].map((day, index) => ({ ...day, position: index + 1 }))],
      ['Core y postura', routineDays.inicial],
      ['Preparación running', [...routineDays.funcional, ...routineDays.fuerza].map((day, index) => ({ ...day, position: index + 1 }))],
      ['Vuelta al entrenamiento', [...routineDays.inicial, ...routineDays.funcional].map((day, index) => ({ ...day, position: index + 1 }))],
    ];
    for (const [name, days] of routineTemplates) {
      await run(db, `INSERT INTO plantillas_rutina (nombre, dias_json, activo, creado_ts, actualizado_ts)
        VALUES (?, ?, 1, ?, ?) ON CONFLICT(nombre) DO UPDATE SET dias_json = excluded.dias_json,
        activo = 1, actualizado_ts = excluded.actualizado_ts`, [name, JSON.stringify(days), now, now]);
    }
    const professorNames = Object.keys(professorIds);
    for (const [index, member] of members.slice(0, 24).entries()) {
      const [ci] = member;
      const [name, days] = routineTemplates[index % routineTemplates.length];
      const professorName = professorNames[index % professorNames.length];
      const professorId = professorIds[professorName];
      await run(db, `INSERT INTO rutinas_socios (usuario_ci, nombre, profesor_id, profesor_nombre, dias_json, asignado_ts, actualizado_ts, activo)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1) ON CONFLICT(usuario_ci) DO UPDATE SET nombre = excluded.nombre,
        profesor_id = excluded.profesor_id, profesor_nombre = excluded.profesor_nombre,
        dias_json = excluded.dias_json, actualizado_ts = excluded.actualizado_ts, activo = 1`,
      [ci, name, professorId, professorName, JSON.stringify(days), now, now]);
    }

    for (const { id } of await all(db, `SELECT id FROM clases WHERE notas = 'REVIEW_DEMO'`)) {
      await run(db, 'DELETE FROM asistencias_clase WHERE clase_id = ?', [id]);
      await run(db, 'DELETE FROM inscripciones_clase WHERE clase_id = ?', [id]);
    }
    await run(db, `DELETE FROM clases WHERE notas = 'REVIEW_DEMO'`);
    const classSpecs = [
      [today, 'Funcional mañana', '07:00', 60, 16, 'Santiago Pérez', 0],
      [today, 'Movilidad', '09:00', 50, 12, 'Camila López', 0],
      [today, 'Core y postura', '12:30', 45, 10, 'Camila López', 0],
      [today, 'Funcional de la tarde', '18:00', 60, 14, 'Santiago Pérez', 1],
      [today, 'Fuerza avanzada', '19:30', 75, 12, 'Diego Fernández', 0],
      [addDays(today, 1), 'Funcional mañana', '07:00', 60, 16, 'Santiago Pérez', 0],
      [addDays(today, 1), 'Fuerza inicial', '19:00', 60, 12, 'Diego Fernández', 0],
      [addDays(today, 1), 'Movilidad guiada', '20:15', 45, 10, 'Camila López', 0],
      [addDays(today, 2), 'Full body express', '08:00', 45, 14, 'Santiago Pérez', 0],
      [addDays(today, 2), 'Tren inferior', '18:30', 60, 12, 'Diego Fernández', 1],
      [addDays(today, 2), 'Core y movilidad', '20:00', 45, 10, 'Camila López', 0],
      [addDays(today, 3), 'Funcional mañana', '07:00', 60, 16, 'Santiago Pérez', 0],
      [addDays(today, 3), 'Movilidad', '18:30', 50, 12, 'Camila López', 1],
      [addDays(today, 3), 'Fuerza general', '20:00', 60, 12, 'Diego Fernández', 0],
      [addDays(today, 5), 'Funcional mañana', '07:00', 60, 16, 'Santiago Pérez', 0],
      [addDays(today, 5), 'Fuerza avanzada', '19:00', 75, 10, 'Diego Fernández', 0],
    ];
    const createdClassIds = [];
    for (const [date, name, time, duration, capacity, professorName, trial] of classSpecs) {
      createdClassIds.push((await run(db, `INSERT INTO clases
        (nombre, fecha, hora, duracion_minutos, capacidad, profesor, profesor_id, local_id, notas, estado, creado_ts, es_prueba)
        VALUES (?, ?, ?, ?, ?, ?, ?, 2, 'REVIEW_DEMO', 'programada', ?, ?)`,
      [name, isoDate(date), time, duration, capacity, professorName, professorIds[professorName], now, trial])).lastID);
    }

    const todayClasses = createdClassIds.slice(0, 5);
    for (const [classIndex, classId] of todayClasses.entries()) {
      const enrollmentCounts = [11, 8, 6, 13, 9];
      for (const [ci, name] of members.slice(classIndex, classIndex + enrollmentCounts[classIndex])) {
        await run(db, `INSERT INTO inscripciones_clase (clase_id, usuario_ci, usuario_nombre, estado, creado_ts)
          VALUES (?, ?, ?, 'inscripto', ?)`, [classId, ci, name, now]);
      }
    }

    await run(db, `DELETE FROM ingresos WHERE observacion = 'REVIEW_DEMO'`);
    const entryTimes = ['06:52', '07:05', '07:18', '07:42', '08:03', '08:16', '08:44', '09:03', '09:18', '09:38', '10:02', '10:14', '11:07', '12:21', '13:46', '15:12', '16:38', '17:22', '17:51', '18:07'];
    for (let index = 0; index < entryTimes.length; index += 1) {
      await run(db, `INSERT INTO ingresos (ci, fecha, hora, ts, fuente, observacion, anulado, local_id)
        VALUES (?, ?, ?, ?, 'kiosk', 'REVIEW_DEMO', 0, 1)`,
      [members[index][0], todayText, entryTimes[index], localTimestamp(today, entryTimes[index])]);
    }
    for (let index = 0; index < 8; index += 1) {
      const time = `09:${String(index * 6 + 2).padStart(2, '0')}`;
      const entry = await run(db, `INSERT INTO ingresos (ci, fecha, hora, ts, fuente, observacion, anulado, local_id, clase_id)
        VALUES (?, ?, ?, ?, 'tablet_clase', 'REVIEW_DEMO', 0, 2, ?)`,
      [members[index][0], todayText, time, localTimestamp(today, time), todayClasses[0]]);
      await run(db, `INSERT INTO asistencias_clase
        (clase_id, usuario_ci, ingreso_id, local_id, profesor_id, profesor_sesion_id, dispositivo_id, fecha, hora, ts, estado, anulado)
        VALUES (?, ?, ?, 2, ?, 0, 'tablet-demo', ?, ?, ?, 'presente', 0)`,
      [todayClasses[0], members[index][0], entry.lastID, professorIds['Camila López'], todayText, time, now]);
    }

    await run(db, `DELETE FROM ventas_pendientes WHERE observacion = 'REVIEW_DEMO'`);
    for (const [productName, ci, quantity, professorName, time] of [
      ['Agua mineral 600 ml', 99000001, 2, 'Santiago Pérez', '18:12'],
      ['Bebida isotonica 500 ml', 99000005, 1, 'Santiago Pérez', '18:18'],
      ['Barrita de cereal chocolate', 99000007, 2, 'Camila López', '19:04'],
      ['Proteína individual', 99000010, 1, 'Diego Fernández', '19:18'],
      ['Gel energético cítrico', 99000016, 3, 'Santiago Pérez', '19:31'],
      ['Mix de frutos secos', 99000020, 1, 'Camila López', '19:46'],
      ['Shaker Under-Fit 700 ml', 99000025, 1, 'Diego Fernández', '20:03'],
      ['Bebida energética sin azúcar', 99000029, 2, 'Santiago Pérez', '20:17'],
    ]) {
      const product = await get(db, 'SELECT id, precio FROM productos WHERE id = ?', [productIds[productName]]);
      const member = members.find(item => item[0] === ci);
      await run(db, `INSERT INTO ventas_pendientes
        (local_id, producto_id, producto_nombre, usuario_ci, usuario_nombre, cantidad, total, profesor, profesor_id, fecha, hora, ts, estado, observacion)
        VALUES (2, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', 'REVIEW_DEMO')`,
      [product.id, productName, ci, member[1], quantity, product.precio * quantity, professorName,
        professorIds[professorName], todayText, time, localTimestamp(today, time)]);
    }

    let session = await get(db, `SELECT id FROM caja_sesiones WHERE fecha = ? ORDER BY id DESC LIMIT 1`, [todayText]);
    if (!session) {
      session = { id: (await run(db, `INSERT INTO caja_sesiones
        (fecha, hora_apertura, ts_apertura, cajero_apertura, monto_inicial_efectivo, observacion_apertura,
         hora_cierre, ts_cierre, cajero_cierre, total_ingresos, cantidad_movimientos, total_efectivo,
         total_transferencia, efectivo_esperado, efectivo_contado, diferencia_efectivo, observacion_cierre, estado)
        VALUES (?, '06:45', ?, 'Laura Méndez', 10000, 'Fondo inicial de demostración', NULL, NULL, NULL,
          0, 0, 0, 0, 0, 0, 0, NULL, 'abierta')`,
      [todayText, localTimestamp(today, '06:45')])).lastID };
    } else {
      await run(db, `UPDATE caja_sesiones SET
        hora_apertura = '06:45', ts_apertura = ?, cajero_apertura = 'Laura Méndez',
        monto_inicial_efectivo = 10000, observacion_apertura = 'Fondo inicial de demostración',
        hora_cierre = NULL, ts_cierre = NULL, cajero_cierre = NULL, efectivo_contado = 0,
        diferencia_efectivo = 0, observacion_cierre = NULL, estado = 'abierta'
        WHERE id = ?`, [localTimestamp(today, '06:45'), session.id]);
    }
    await run(db, `DELETE FROM caja_movimientos WHERE observacion = 'REVIEW_DEMO'`);
    for (const [type, payment, amount, description, memberName, time] of [
      ['venta_producto', 'transferencia', 390, 'Shaker Under-Fit', 'Martina Silva', '20:50'],
      ['membresia', 'efectivo', 1600, 'Renovación mensual', 'Carolina Díaz', '20:45'],
      ['venta_producto', 'efectivo', 180, 'Proteína individual', 'Nicolás Torres', '20:31'],
      ['venta_producto', 'efectivo', 95, 'Agua mineral 1.5 L', 'Martina Silva', '08:21'],
      ['membresia', 'transferencia', 1600, 'Renovación mensual', 'Federico Ramos', '10:05'],
      ['venta_producto', 'efectivo', 120, 'Bebida isotónica', 'Ana Pereira', '17:44'],
      ['ingreso_manual', 'efectivo', 500, 'Entrada eventual', null, '19:16'],
      ['egreso', 'efectivo', -280, 'Compra de limpieza', null, '20:02'],
      ['venta_producto', 'transferencia', 145, 'Bebida energética', 'Sebastián Viera', '11:22'],
      ['membresia', 'efectivo', 1600, 'Renovación mensual', 'Emilia Fernández', '12:08'],
      ['venta_producto', 'efectivo', 130, 'Mix de frutos secos', 'Camila Bentancur', '13:17'],
      ['venta_producto', 'transferencia', 390, 'Shaker Under-Fit', 'Ignacio Olivera', '14:42'],
      ['membresia', 'transferencia', 4400, 'Renovación trimestral', 'Facundo Lima', '15:26'],
      ['venta_producto', 'efectivo', 220, 'Gel energético x2', 'Victoria Rivas', '16:10'],
      ['membresia', 'efectivo', 4400, 'Renovación trimestral', 'Sofía Núñez', '19:34'],
      ['venta_producto', 'efectivo', 70, 'Barrita de cereal chocolate', 'Ana Pereira', '18:42'],
      ['venta_producto', 'transferencia', 85, 'Agua saborizada 500 ml', 'Bruno Acosta', '18:06'],
      ['membresia', 'transferencia', 1600, 'Renovación mensual', 'Agustín Moreira', '17:31'],
      ['venta_producto', 'efectivo', 480, 'Banda elástica media', 'Valentina Suárez', '16:56'],
      ['membresia', 'efectivo', 1600, 'Renovación mensual', 'Diego Martínez', '15:48'],
      ['venta_producto', 'transferencia', 145, 'Bebida energética', 'Camila Fernández', '15:08'],
      ['venta_producto', 'efectivo', 120, 'Bebida isotónica 500 ml', 'Federico Ramos', '14:16'],
      ['membresia', 'transferencia', 8200, 'Renovación semestral', 'Martín Suárez', '13:42'],
      ['venta_producto', 'efectivo', 70, 'Barrita de cereal frutos rojos', 'Bruno Rodríguez', '12:51'],
      ['membresia', 'efectivo', 1600, 'Renovación mensual', 'Camila Bentancur', '11:50'],
      ['venta_producto', 'transferencia', 95, 'Agua mineral 1.5 L', 'Emilia Fernández', '10:44'],
      ['venta_producto', 'efectivo', 130, 'Mix de frutos secos', 'Santiago Cabrera', '09:56'],
      ['membresia', 'transferencia', 4400, 'Renovación trimestral', 'Ignacio Olivera', '09:04'],
      ['venta_producto', 'efectivo', 60, 'Agua mineral 600 ml', 'Victoria Rivas', '08:34'],
      ['ingreso_manual', 'transferencia', 700, 'Pase semanal visitante', null, '18:35'],
      ['egreso', 'transferencia', -450, 'Insumos de recepción', null, '20:38'],
    ]) {
      await run(db, `INSERT INTO caja_movimientos
        (caja_sesion_id, fecha, hora, ts, tipo_ingreso, forma_pago, monto, monto_recibido, cambio,
         descripcion, observacion, usuario_nombre, cantidad, responsable)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'REVIEW_DEMO', ?, 1, 'Laura Méndez')`,
      [session.id, todayText, time, localTimestamp(today, time), type, payment, amount, Math.max(0, amount), description, memberName]);
    }

    await run(db, `INSERT INTO app_config (key, value) VALUES ('review_dataset', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value`, [now]);
    for (const [key, value] of [
      ['precio_inscripcion', '1600'],
      ['precio_membresia_mensual', '1600'],
      ['precio_membresia_trimestral', '4400'],
      ['precio_membresia_semestral', '8200'],
    ]) {
      await run(db, `INSERT INTO app_config (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value`, [key, value]);
    }
    await run(db, 'COMMIT');
  } catch (error) {
    await run(db, 'ROLLBACK');
    throw error;
  } finally {
    await close(db);
  }

    console.log(JSON.stringify({ databasePath, backupPath, members: 30, products: 15, exercises: 18, templates: 12, assignedPlans: 24, classes: 16, entries: 28, pendingCharges: 8, cashMovements: 31 }, null, 2));
}

seed().catch(error => { console.error(error); process.exitCode = 1; });
