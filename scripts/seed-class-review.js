// Additive, repeatable fixtures for the LOCAL desktop database. No financial writes.
// Usage: node scripts/seed-class-review.js --db <verified gym.db> [--apply]
const fs = require('node:fs');
const path = require('node:path');
const sqlite3 = require('sqlite3').verbose();
const MARK = 'UNDERFIT_CLASS_DEMO_V1';
const names = ['Abril Costa', 'Adrián Fagúndez', 'Agustina Toledo', 'Alejandro Duarte', 'Belén Acuña', 'Benjamín Larrosa', 'Catalina Correa', 'Cristian Benítez', 'Delfina Rivero', 'Emiliano Machado', 'Florencia Aguirre', 'Gabriel Silvera', 'Inés Villar', 'Julián Barreto', 'Lara Suárez', 'Leonardo Pintos', 'Malena Vidal', 'Matías Píriz', 'Natalia Sosa', 'Pablo Gutiérrez', 'Rocío Núñez', 'Santiago Ferreira', 'Valeria Castro', 'Valentín Méndez'];
const groups = [
  ['Funcional mañana', [1,3,5], '08:15', 60, 20, 20],
  ['Fuerza general', [1,3,5], '09:30', 60, 24, 16],
  ['Movilidad y postura', [1,3,5], '10:45', 45, 20, 10],
  ['HIIT', [1,3,5], '12:00', 45, 18, 14],
  ['Circuito funcional', [1,3,5], '16:00', 60, 20, 18],
  ['Stretching', [1,3,5], '20:15', 45, 16, 0],
  ['Pilates', [2,4,6], '09:00', 60, 16, 12],
  ['Entrenamiento integral', [2,4,6], '16:00', 60, 24, 24],
];
const iso = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const shift = (date, days) => { const d = new Date(date); d.setDate(d.getDate()+days); return d; };
const timestamp = (date, time) => new Date(`${date}T${time}:00-03:00`);
function access(db) {
  return {
    all: (sql, params=[]) => new Promise((resolve,reject)=>db.all(sql,params,(e,r)=>e?reject(e):resolve(r))),
    get: (sql, params=[]) => new Promise((resolve,reject)=>db.get(sql,params,(e,r)=>e?reject(e):resolve(r))),
    run: (sql, params=[]) => new Promise((resolve,reject)=>db.run(sql,params,function(e){e?reject(e):resolve({id:this.lastID,changes:this.changes});})),
  };
}
async function main() {
  const file = process.argv[process.argv.indexOf('--db')+1];
  if (!process.argv.includes('--db') || !file || !fs.existsSync(file)) throw new Error('Indicá una base existente con --db.');
  const dbPath = path.resolve(file), apply = process.argv.includes('--apply');
  if (apply) require('./demoDatabase').resolveDemoDatabase(dbPath);
  const db = new sqlite3.Database(dbPath, apply ? sqlite3.OPEN_READWRITE : sqlite3.OPEN_READONLY);
  db.configure('busyTimeout', 10000);
  const {all,get,run} = access(db);
  try {
    const existing = await all('SELECT id FROM programaciones_clase WHERE notas LIKE ?', [MARK+'%']);
    if (existing.length) {
      if (existing.length !== groups.length) throw new Error('El conjunto demo está incompleto; revisar antes de volver a cargar.');
      console.log('Ya está cargado este conjunto. No se duplicó ni modificó ningún registro.');
      return;
    }
    const staff = await all('SELECT id,nombre FROM profesores WHERE activo=1 ORDER BY id');
    const local = await get("SELECT id FROM locales WHERE tipo='clases' AND activo=1 ORDER BY id LIMIT 1");
    if (!staff.length || !local) throw new Error('Se necesita un profesor activo y un salón existente.');
    const collisions = await all('SELECT ci FROM usuarios WHERE ci BETWEEN 99810001 AND 99810024');
    if (collisions.length) throw new Error('El rango de CI demo ya está ocupado; no se sobrescribirá.');
    const now = new Date(), base = new Date(now); base.setHours(12,0,0,0);
    const monday = shift(base, -((base.getDay()+6)%7)), until = shift(monday,20);
    const plan = {database:dbPath,tag:MARK,members:names.length,groups:groups.length,classes:72,from:iso(monday),to:iso(until),staff:staff.map(p=>p.nombre)};
    if (!apply) { console.log(JSON.stringify({dryRun:true,...plan},null,2)); return; }
    const backupDir = path.join(path.dirname(dbPath),'backups'); fs.mkdirSync(backupDir,{recursive:true});
    const backup = path.join(backupDir,`before-class-demo-${Date.now()}.db`);
    await run('VACUUM INTO ?', [backup]);
    const manifest = {...plan,backup,createdAt:now.toISOString(),memberCis:[],scheduleIds:[],classIds:[],attendanceIds:[],entryIds:[],sessionIds:[],rated:0,trialClassIds:[],completedTrialClassIds:[]};
    await run('PRAGMA foreign_keys=ON');
    await run('BEGIN IMMEDIATE');
    try {
      for (const [i,name] of names.entries()) {
        const ci=99810001+i;
        await run(`INSERT INTO usuarios (ci,nombre,email,fecha_creacion,ultima_actualizacion,fecha_vencimiento,detalle,fecha_nacimiento,objetivo,tipo_membresia,autorizacion_imagen) VALUES (?,?,?,?,?,?,?,?,?,'mensual',0)`,
          [ci,name,`alumno.${i+1}@clases-demo.example.test`,iso(shift(monday,-30)),iso(base),iso(shift(until,45)),`${MARK} · Socio ficticio para revisión de clases. Sin cobros ni acceso móvil.`,`${1990+i%15}-05-14`,'Acondicionamiento general']);
        manifest.memberCis.push(ci);
      }
      for (const [g,[label,days,time,duration,capacity,count]] of groups.entries()) {
        const professor=staff[g%staff.length], marker=`${MARK}:${g}`, name=`${label} · Demo`;
        const schedule=await run(`INSERT INTO programaciones_clase (nombre,local_id,profesor_id,profesor_nombre,dias_semana,hora,duracion_minutos,capacidad,fecha_inicio,fecha_fin,notas,estado,creado_ts,actualizado_ts) VALUES (?,?,?,?,?,?,?,?,?,?,?,'activa',?,?)`,
          [name,local.id,professor.id,professor.nombre,days.join(','),time,duration,capacity,iso(monday),iso(until),marker,now.toISOString(),now.toISOString()]);
        manifest.scheduleIds.push(schedule.id);
        const members=Array.from({length:count},(_,j)=>(j+g*3)%names.length);
        for (const i of members) await run(`INSERT INTO inscripciones_programacion_clase (programacion_id,usuario_ci,usuario_nombre,estado,creado_ts) VALUES (?,?,?,'inscripto',?)`,[schedule.id,99810001+i,names[i],timestamp(iso(monday),'00:00').toISOString()]);
        for(let offset=0;offset<21;offset++) {
          const day=shift(monday,offset); if(!days.includes(day.getDay()))continue;
          const date=iso(day),start=timestamp(date,time),end=new Date(start.getTime()+duration*60000);
          const cancelled=offset===0&&g===3;
          const completed=end<now&&!cancelled;
          const state=cancelled?'cancelada':completed?'dictada':start<now?'en_curso':'programada';
          const trial=(day.getDay()===3&&g<3)||(day.getDay()===4&&g===6);
          const row=await run(`INSERT INTO clases (nombre,fecha,hora,duracion_minutos,capacidad,profesor,local_id,notas,estado,creado_ts,profesor_id,programacion_id,es_prueba,inicio_real_ts,fin_real_ts,motivo_cancelacion,cancelada_ts) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [name,date,time,duration,capacity,professor.nombre,local.id,marker,state,now.toISOString(),professor.id,schedule.id,Number(trial),completed?start.toISOString():null,completed?end.toISOString():null,cancelled?'Ejemplo demo de clase cancelada':null,cancelled?start.toISOString():null]);
          manifest.classIds.push(row.id);
          if(trial)manifest.trialClassIds.push(row.id);
          if(trial&&completed)manifest.completedTrialClassIds.push(row.id);
          for (const i of members) await run(`INSERT INTO inscripciones_clase (clase_id,usuario_ci,usuario_nombre,estado,creado_ts) VALUES (?,?,?,'inscripto',?)`,[row.id,99810001+i,names[i],timestamp(iso(monday),'00:00').toISOString()]);
          if(!completed||!members.length)continue;
          const session=await run(`INSERT INTO sesiones_profesor (profesor_id,local_id,dispositivo_id,inicio_ts,fin_ts,estado) VALUES (?,?,?,?,?,'cerrada')`,[professor.id,local.id,MARK,start.toISOString(),end.toISOString()]);
          manifest.sessionIds.push(session.id);
          for(const [position,i] of members.entries()) {
            if((position+g+offset)%5===0)continue; // Absence is the lack of attendance, never a fake check.
            const entryTime=new Date(start.getTime()+(position%9)*60000),timeText=new Intl.DateTimeFormat('es-UY',{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'America/Montevideo'}).format(entryTime);
            const entry=await run(`INSERT INTO ingresos (ci,fecha,hora,ts,fuente,observacion,local_id,dispositivo_id,clase_id) VALUES (?,?,?,?,'tablet_clase',?,?,?,?)`,[99810001+i,date,timeText,entryTime.toISOString(),MARK,local.id,MARK,row.id]);
            manifest.entryIds.push(entry.id);
            const score=trial&&position%3!==0?1+(position%5):null;
            const attendance=await run(`INSERT INTO asistencias_clase (clase_id,programacion_id,usuario_ci,ingreso_id,local_id,profesor_id,profesor_sesion_id,dispositivo_id,fecha,hora,ts,estado,puntuacion,puntuado_por_profesor_id,puntuado_ts) VALUES (?,?,?,?,?,?,?,?,?,?,?,'presente',?,?,?)`,
              [row.id,schedule.id,99810001+i,entry.id,local.id,professor.id,session.id,MARK,date,timeText,entryTime.toISOString(),score,score?professor.id:null,score?end.toISOString():null]);
            manifest.attendanceIds.push(attendance.id); if(score)manifest.rated++;
          }
        }
      }
      const invalid=await get(`SELECT COUNT(*) AS n FROM asistencias_clase a JOIN clases c ON c.id=a.clase_id WHERE c.notas LIKE ? AND (c.estado<>'dictada' OR (a.puntuacion IS NOT NULL AND (c.es_prueba<>1 OR a.puntuacion NOT BETWEEN 1 AND 5)))`,[MARK+'%']);
      if(invalid.n)throw new Error('Estado o evaluación demo incoherente.');
      const over=await get(`SELECT COUNT(*) AS n FROM (SELECT c.id FROM clases c JOIN inscripciones_clase i ON i.clase_id=c.id WHERE c.notas LIKE ? GROUP BY c.id HAVING COUNT(*)>c.capacidad)`,[MARK+'%']);
      if(over.n)throw new Error('Cupo demo excedido.');
      await run('COMMIT');
    } catch(error) { await run('ROLLBACK'); throw error; }
    const report=path.join(backupDir,`${MARK}-manifest.json`);
    fs.writeFileSync(report,JSON.stringify(manifest,null,2));
    console.log(JSON.stringify({...plan,backup,manifest:report,attendances:manifest.attendanceIds.length,evaluations:manifest.rated,trialClasses:manifest.trialClassIds.length,completedTrialClasses:manifest.completedTrialClassIds.length,openClass:manifest.completedTrialClassIds[0]},null,2));
  } finally { await new Promise((resolve,reject)=>db.close(e=>e?reject(e):resolve())); }
}
main().catch(error=>{console.error(error.message);process.exitCode=1});
