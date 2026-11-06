const test = require('node:test');
const assert = require('node:assert/strict');
const sqlite3 = require('sqlite3');
const {createUserRepository} = require('../repositories/userRepository');
const {createUserService} = require('../services/userService');
const {createApiUserService} = require('../services/apiUserService');

const links = [['ingresos','ci'],['pagos_membresia','usuario_ci'],['caja_movimientos','usuario_ci'],
  ['inscripciones_clase','usuario_ci'],['ventas_pendientes','usuario_ci'],
  ['inscripciones_programacion_clase','usuario_ci'],['asistencias_clase','usuario_ci'],['rutinas_socios','usuario_ci']];
async function fixture(t) {
  const db = new sqlite3.Database(':memory:');
  t.after(() => new Promise(resolve => db.close(resolve)));
  const run = (sql, values=[]) => new Promise((resolve,reject)=>db.run(sql,values,error=>error?reject(error):resolve()));
  const get = sql => new Promise((resolve,reject)=>db.get(sql,[],(error,row)=>error?reject(error):resolve(row)));
  await run('CREATE TABLE usuarios (ci INTEGER PRIMARY KEY, nombre TEXT, numero TEXT, email TEXT, fecha_creacion TEXT, ultima_actualizacion TEXT, fecha_vencimiento TEXT)');
  await run("INSERT INTO usuarios VALUES (12345678, 'Ana', '099000001', 'ana@example.invalid', '2026-01-01', '2026-11-05', '2026-12-05')");
  for(const [table,column] of links) {
    await run(`CREATE TABLE ${table} (id INTEGER PRIMARY KEY, ${column} INTEGER UNIQUE, monto INTEGER DEFAULT 75${table==='caja_movimientos'?', referencia_tabla TEXT, referencia_id INTEGER':''})`);
    await run(`INSERT INTO ${table}(id,${column}) VALUES(1,12345678)`);
  }
  await run("UPDATE caja_movimientos SET referencia_tabla='usuarios', referencia_id=12345678");
  const service = createUserService({db,userRepository:createUserRepository(db),membershipRules:{calculateManualExpirationFromToday:()=> '2026-12-05'}});
  const edit = {ci:'87654321',nombre:'Ana corregida',numero:'099000001',email:'ana@example.invalid',fecha_creacion:'2026-01-01',ultima_actualizacion:'2026-11-05',diasRestantes:30};
  return {run,get,service,edit};
}
test('CI correction preserves every SQLite link, balances and membership dates', async t => {
  const {get,service,edit}=await fixture(t);
  await service.saveAdminManualEdit(12345678,edit);
  assert.equal((await get('SELECT * FROM usuarios')).ci,87654321);
  assert.equal((await get('SELECT * FROM usuarios')).fecha_vencimiento,'2026-12-05');
  for(const [table,column] of links) {
    const row=await get(`SELECT * FROM ${table}`);
    assert.equal(row[column],87654321,table); assert.equal(row.monto,75);
  }
  assert.equal((await get('SELECT * FROM caja_movimientos')).referencia_id,87654321);
});
test('duplicate CI rejects the entire edit without merging members', async t => {
  const {run,get,service,edit}=await fixture(t);
  await run("INSERT INTO usuarios(ci,nombre) VALUES(87654321,'Otro socio')");
  await assert.rejects(service.saveAdminManualEdit(12345678,edit),/Ya existe/);
  assert.equal((await get('SELECT * FROM usuarios WHERE ci=12345678')).nombre,'Ana');
  assert.equal((await get('SELECT * FROM ingresos')).ci,12345678);
});
test('a conflicting historical record rolls back CI and all earlier link changes', async t => {
  const {run,get,service,edit}=await fixture(t);
  await run('INSERT INTO rutinas_socios(id,usuario_ci) VALUES(2,87654321)');
  await assert.rejects(service.saveAdminManualEdit(12345678,edit));
  assert.equal((await get('SELECT * FROM usuarios')).ci,12345678);
  assert.equal((await get('SELECT * FROM ingresos')).ci,12345678);
  assert.equal((await get('SELECT * FROM pagos_membresia')).usuario_ci,12345678);
});
test('invalid CI does not change member or history', async t => {
  const {get,service,edit}=await fixture(t);
  for (const ci of ['', '0', '123456789', 'abc'])
    await assert.rejects(service.saveAdminManualEdit(12345678,{...edit,ci}),/cédula válida/);
  assert.equal((await get('SELECT * FROM usuarios')).ci,12345678);
});
test('API correction addresses old CI and sends new CI in the same update', async () => {
  let received;
  const service=createApiUserService({apiClient:{updateMember:async(ci,payload)=>{
    received={ci,payload}; return {identityNumber:payload.identityNumber,name:payload.name};
  }}});
  const result=await service.saveAdminManualEdit('12345678',{ci:'87654321',nombre:'Ana',diasRestantes:30});
  assert.equal(received.ci,'12345678'); assert.equal(received.payload.identityNumber,'87654321');
  assert.equal(result.user.ci,'87654321');
});
