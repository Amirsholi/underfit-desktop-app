const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const sqlite3 = require('sqlite3').verbose();
const { ejecutarMigraciones } = require('../migrations');

const root = path.resolve(__dirname, '..');
const databasePath = require('./demoDatabase').resolveDemoDatabase();
const outputDir = path.join(root, 'assets', 'exercises', 'gifs');
const relativeGif = slug => `assets/exercises/gifs/${slug}.gif`;
const edgePath = process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const line = (x1, y1, x2, y2, color = '#f2f3f5', width = 8) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
const circle = (cx, cy, r = 12, color = '#f2f3f5') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/>`;
const rect = (x, y, width, height, color = '#30343b', radius = 0) => `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${color}"/>`;
const svg = body => `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200">
  <rect width="320" height="200" fill="#101216"/>
  ${body}
</svg>`;

function squat(t) {
  const headY = 42 + (t * 23);
  const shoulderY = 65 + (t * 22);
  const hipY = 108 + (t * 18);
  return svg([
    line(38, 170, 282, 170, '#30343b', 2),
    line(112, 86 + (t * 16), 208, 86 + (t * 16), '#ff681f', 6),
    circle(160, headY), line(160, shoulderY, 160, hipY),
    line(160, shoulderY + 8, 120, 92 + (t * 13)), line(160, shoulderY + 8, 200, 92 + (t * 13)),
    line(160, hipY, 125, 132 + (t * 12)), line(125, 132 + (t * 12), 112, 166),
    line(160, hipY, 195, 132 + (t * 12)), line(195, 132 + (t * 12), 208, 166),
  ].join(''));
}

function press(t) {
  const barY = 91 - (t * 39);
  return svg([
    rect(65, 148, 190, 7), rect(88, 155, 7, 24), rect(225, 155, 7, 24),
    line(48, 179, 272, 179, '#30343b', 2),
    circle(102, 126), line(117, 134, 205, 134),
    line(143, 132, 137, barY), line(185, 132, 191, barY),
    line(96, barY, 230, barY, '#ff681f', 6),
    line(203, 134, 234, 164), line(164, 134, 183, 164),
  ].join(''));
}

function row(t) {
  const handY = 132 - (t * 46);
  return svg([
    line(42, 171, 278, 171, '#30343b', 2),
    circle(116, 60), line(129, 70, 185, 111), line(185, 111, 214, 164), line(185, 111, 154, 164),
    line(142, 80, 206, handY), line(206, handY, 226, handY, '#ff681f', 8),
    line(222, handY - 9, 222, handY + 9, '#ff681f', 6), line(230, handY - 9, 230, handY + 9, '#ff681f', 6),
    line(140, 82, 102, 124), rect(75, 124, 52, 8, '#30343b', 3),
  ].join(''));
}

function deadlift(t) {
  const hipX = 174 - (t * 10);
  const hipY = 112 - (t * 25);
  const shoulderX = 128 + (t * 20);
  const shoulderY = 78 - (t * 23);
  const barY = 151 - (t * 48);
  return svg([
    line(38, 171, 282, 171, '#30343b', 2),
    circle(shoulderX - 12, shoulderY - 22), line(shoulderX, shoulderY, hipX, hipY),
    line(hipX, hipY, 145, 166), line(hipX, hipY, 205, 166),
    line(shoulderX, shoulderY + 7, 142, barY), line(shoulderX + 8, shoulderY + 5, 183, barY),
    line(92, barY, 232, barY, '#ff681f', 6),
    circle(88, barY, 10, '#ff681f'), circle(236, barY, 10, '#ff681f'),
  ].join(''));
}

function plank(t) {
  const kneeX = 220 - (t * 48);
  const kneeY = 128 - (t * 18);
  return svg([
    line(40, 168, 280, 168, '#30343b', 2),
    circle(78, 91), line(92, 99, 202, 111),
    line(106, 101, 84, 145), line(84, 145, 62, 165),
    line(202, 111, 258, 158),
    line(202, 111, kneeX, kneeY), line(kneeX, kneeY, 238, 160, '#ff681f'),
  ].join(''));
}

function lunge(t) {
  const headY = 43 + (t * 13);
  const hipY = 102 + (t * 16);
  const frontKneeX = 146 - (t * 28);
  const frontKneeY = 132 + (t * 10);
  const backKneeX = 176 + (t * 34);
  const backKneeY = 132 + (t * 19);
  return svg([
    line(38, 171, 282, 171, '#30343b', 2),
    circle(160, headY), line(160, headY + 16, 160, hipY),
    line(160, headY + 34, 127, 99 + (t * 8)), line(160, headY + 34, 193, 99 + (t * 8)),
    line(160, hipY, frontKneeX, frontKneeY), line(frontKneeX, frontKneeY, 91, 167),
    line(160, hipY, backKneeX, backKneeY), line(backKneeX, backKneeY, 239, 167),
  ].join(''));
}

const movements = { squat, press, row, deadlift, plank, lunge };

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function waitForFile(filePath, timeoutMs = 7000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const stat = await fs.stat(filePath);
      if (stat.size > 1000) return;
    } catch (_) {}
    await wait(100);
  }
  throw new Error(`No se generó ${path.basename(filePath)} dentro del tiempo esperado.`);
}

async function generateGif(slug, render) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `underfit-${slug}-`));
  const outputPath = path.join(outputDir, `${slug}.gif`);
  try {
    for (let index = 0; index < 12; index += 1) {
      const phase = index <= 5 ? index / 5 : (11 - index) / 5;
      const frameName = `frame-${String(index).padStart(2, '0')}`;
      const htmlPath = path.join(tempDir, `${frameName}.html`);
      const pngPath = path.join(tempDir, `${frameName}.png`);
      await fs.writeFile(htmlPath, `<!doctype html><html><head><meta charset="utf-8"><style>html,body{width:100%;height:100%;margin:0;overflow:hidden;background:#101216}svg{display:block;width:100vw;height:100vh}</style></head><body>${render(phase)}</body></html>`, 'utf8');
      const browser = spawnSync(edgePath, [
        '--headless=new', '--disable-gpu', '--disable-extensions', '--hide-scrollbars', '--no-first-run',
        '--disable-background-mode', '--disable-background-networking',
        `--user-data-dir=${path.join(tempDir, `edge-profile-${index}`)}`,
        '--window-size=320,200', '--force-device-scale-factor=1', `--screenshot=${pngPath}`,
        pathToFileURL(htmlPath).href,
      ], { encoding: 'utf8', timeout: 15000 });
      if (browser.status !== 0) throw new Error(browser.stderr || `Edge no pudo renderizar ${frameName}.html`);
      await waitForFile(pngPath);
    }
    const inputPattern = path.join(tempDir, 'frame-%02d.png');
    const result = spawnSync('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y', '-framerate', '6', '-i', inputPattern,
      '-filter_complex', '[0:v]split[a][b];[a]palettegen=max_colors=64[p];[b][p]paletteuse=dither=bayer',
      '-loop', '0', outputPath,
    ], { encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.stderr || `ffmpeg no pudo generar ${slug}.gif`);
    const stat = await fs.stat(outputPath);
    if (stat.size < 1000) throw new Error(`${slug}.gif quedó incompleto.`);
    return { slug, outputPath, bytes: stat.size };
  } finally {
    try {
      await fs.rm(tempDir, { recursive: true, force: true, maxRetries: 30, retryDelay: 200 });
    } catch (error) {
      console.warn(`No se pudo limpiar ${tempDir}: ${error.message}`);
    }
  }
}

const run = (db, sql, params = []) => new Promise((resolve, reject) => db.run(sql, params, function (error) {
  if (error) return reject(error);
  resolve(this);
}));
const get = (db, sql, params = []) => new Promise((resolve, reject) => db.get(sql, params, (error, row) => error ? reject(error) : resolve(row || null)));
const all = (db, sql, params = []) => new Promise((resolve, reject) => db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows || [])));
const close = db => new Promise((resolve, reject) => db.close(error => error ? reject(error) : resolve()));

const exercises = [
  ['Sentadilla con barra', 'Piernas', 'Pies firmes, rodillas acompañando la línea de los pies y torso estable.', 'squat'],
  ['Press de banca', 'Pecho', 'Escápulas estables y descenso controlado de la barra.', 'press'],
  ['Remo con mancuerna', 'Espalda', 'Columna neutra y codo hacia atrás sin rotar el tronco.', 'row'],
  ['Peso muerto rumano', 'Posterior', 'Cadera hacia atrás y barra próxima al cuerpo.', 'deadlift'],
  ['Plancha frontal', 'Core', 'Mantener hombros, cadera y talones alineados.', 'plank'],
  ['Zancadas alternas', 'Piernas', 'Descenso vertical y apoyo estable del pie delantero.', 'lunge'],
  ['Press militar', 'Hombros', 'Empujar sin arquear la zona lumbar.', 'press'],
  ['Jalón al pecho', 'Espalda', 'Hombros bajos y regreso controlado.', 'row'],
  ['Puente de glúteos', 'Glúteos', 'Extender la cadera empujando desde los talones.', 'squat'],
  ['Dead bug', 'Core', 'Mantener la zona lumbar estable durante el movimiento.', 'plank'],
  ['Elevación lateral', 'Hombros', 'Elevar con control sin impulsar el torso.', 'press'],
  ['Curl de bíceps', 'Brazos', 'Mantener los codos estables durante todo el recorrido.', 'row'],
  ['Extensión de tríceps', 'Brazos', 'Completar la extensión sin separar los codos.', 'press'],
  ['Prensa de piernas', 'Piernas', 'Evitar bloquear las rodillas al extender.', 'squat'],
  ['Face pull', 'Espalda', 'Llevar la cuerda al rostro con escápulas activas.', 'row'],
  ['Bird dog', 'Core', 'Extender brazo y pierna opuestos sin rotar la pelvis.', 'plank'],
  ['Step up al banco', 'Piernas', 'Subir empujando con la pierna apoyada.', 'lunge'],
  ['Fondos asistidos', 'Pecho', 'Descender con hombros estables y recorrido controlado.', 'press'],
];

const item = (exerciseId, position, sets, repetitions, restSeconds = 60) => ({
  exerciseId, position, sets, repetitions, load: null, restSeconds, notes: null,
});

async function seedDatabase() {
  await fs.mkdir(path.dirname(databasePath), { recursive: true });
  const backupDir = path.join(path.dirname(databasePath), 'backups');
  await fs.mkdir(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `training-before-seed-${stamp}.db`);
  try { await fs.copyFile(databasePath, backupPath); } catch (error) { if (error.code !== 'ENOENT') throw error; }

  await ejecutarMigraciones(databasePath);
  const db = new sqlite3.Database(databasePath);
  const now = new Date().toISOString();
  const ids = {};
  try {
    await run(db, 'BEGIN IMMEDIATE TRANSACTION');
    for (const [name, group, instructions, gifSlug] of exercises) {
      await run(db, `
        INSERT INTO ejercicios (nombre, grupo_muscular, instrucciones, gif_url, activo, creado_ts, actualizado_ts)
        VALUES (?, ?, ?, ?, 1, ?, ?)
        ON CONFLICT(nombre) DO UPDATE SET grupo_muscular = excluded.grupo_muscular,
          instrucciones = excluded.instrucciones, gif_url = excluded.gif_url,
          activo = 1, actualizado_ts = excluded.actualizado_ts
      `, [name, group, instructions, relativeGif(gifSlug), now, now]);
      ids[name] = (await get(db, 'SELECT id FROM ejercicios WHERE nombre = ?', [name])).id;
    }

    const routines = [
      ['Base de fuerza · 2 días', [
        { position: 1, name: 'Piernas y posterior', muscleGroups: 'Piernas y glúteos', exercises: [
          item(ids['Sentadilla con barra'], 1, 4, '8', 90), item(ids['Peso muerto rumano'], 2, 3, '10', 75), item(ids['Zancadas alternas'], 3, 3, '10 por pierna', 60),
        ] },
        { position: 2, name: 'Tren superior', muscleGroups: 'Pecho y espalda', exercises: [
          item(ids['Press de banca'], 1, 4, '8', 90), item(ids['Remo con mancuerna'], 2, 3, '12', 60), item(ids['Press militar'], 3, 3, '10', 60),
        ] },
      ]],
      ['Funcional completo · 2 días', [
        { position: 1, name: 'Fuerza funcional', muscleGroups: 'Cuerpo completo', exercises: [
          item(ids['Sentadilla con barra'], 1, 3, '12'), item(ids['Jalón al pecho'], 2, 3, '12'), item(ids['Plancha frontal'], 3, 3, '35 segundos', 40),
        ] },
        { position: 2, name: 'Control y estabilidad', muscleGroups: 'Core y piernas', exercises: [
          item(ids['Step up al banco'], 1, 3, '10 por pierna'), item(ids['Press militar'], 2, 3, '10'), item(ids['Dead bug'], 3, 3, '8 por lado', 45),
        ] },
      ]],
      ['Retorno y movilidad · 2 días', [
        { position: 1, name: 'Activación', muscleGroups: 'Glúteos y core', exercises: [
          item(ids['Puente de glúteos'], 1, 3, '12', 45), item(ids['Bird dog'], 2, 3, '8 por lado', 40), item(ids['Step up al banco'], 3, 3, '10 por pierna', 50),
        ] },
        { position: 2, name: 'Postura', muscleGroups: 'Espalda y hombros', exercises: [
          item(ids['Jalón al pecho'], 1, 3, '12'), item(ids['Face pull'], 2, 3, '15', 45), item(ids['Elevación lateral'], 3, 3, '12', 45),
        ] },
      ]],
    ];

    await run(db, 'UPDATE plantillas_rutina SET activo = 0, actualizado_ts = ?', [now]);
    for (const [name, days] of routines) {
      await run(db, `
        INSERT INTO plantillas_rutina (nombre, dias_json, activo, creado_ts, actualizado_ts)
        VALUES (?, ?, 1, ?, ?)
        ON CONFLICT(nombre) DO UPDATE SET dias_json = excluded.dias_json,
          activo = 1, actualizado_ts = excluded.actualizado_ts
      `, [name, JSON.stringify(days), now, now]);
    }

    const professors = await all(db, 'SELECT id, nombre FROM profesores WHERE activo = 1 ORDER BY id LIMIT 3');
    const assignments = [
      [99000001, routines[0]],
      [99000002, routines[1]],
      [99000027, routines[2]],
    ];
    for (let index = 0; index < assignments.length; index += 1) {
      const [identityNumber, [name, days]] = assignments[index];
      const member = await get(db, 'SELECT ci FROM usuarios WHERE ci = ?', [identityNumber]);
      const professor = professors[index % professors.length];
      if (!member || !professor) continue;
      await run(db, `
        INSERT INTO rutinas_socios (usuario_ci, nombre, profesor_id, profesor_nombre, dias_json, asignado_ts, actualizado_ts, activo)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        ON CONFLICT(usuario_ci) DO UPDATE SET nombre = excluded.nombre,
          profesor_id = excluded.profesor_id, profesor_nombre = excluded.profesor_nombre,
          dias_json = excluded.dias_json, actualizado_ts = excluded.actualizado_ts, activo = 1
      `, [identityNumber, name, professor.id, professor.nombre, JSON.stringify(days), now, now]);
    }

    await run(db, 'COMMIT');
    return { backupPath, routines: routines.map(([name, days]) => ({ name, groups: days.length, exercises: days.reduce((sum, day) => sum + day.exercises.length, 0) })) };
  } catch (error) {
    try { await run(db, 'ROLLBACK'); } catch (_) {}
    throw error;
  } finally {
    await close(db);
  }
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  const gifs = [];
  for (const [slug, render] of Object.entries(movements)) gifs.push(await generateGif(slug, render));
  const database = await seedDatabase();
  console.log(JSON.stringify({ databasePath, outputDir, gifs, ...database }, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
