const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const sqlite3 = require('sqlite3');
const { importLegacyMasters, importLegacyClasses, importLegacyHistory, importLegacyCommercial, buildImportSql } = require('../scripts/importLegacyMasters');

// Exact GitHub main baseline confirmed with the owner on 2026-09-15.
const baseline = '4122ecb1463feadba8da6356498af7dae6dc623f';
const run = (db, sql) => new Promise((resolve,reject)=>db.exec(sql,error=>error?reject(error):resolve()));
const close = db => new Promise((resolve,reject)=>db.close(error=>error?reject(error):resolve()));

test('v2.1 production main can be inspected and dry-run without adding new tables to its database', async()=>{
  const source = execFileSync('git',['show',`${baseline}:migrations.js`],{cwd:path.resolve(__dirname,'..'),encoding:'utf8'});
  const module = {exports:{}};
  vm.runInNewContext(source,{require:name=>{assert.equal(name,'sqlite3');return sqlite3;},module,exports:module.exports,console});
  const directory = await fs.mkdtemp(path.join(os.tmpdir(),'underfit-main-migration-'));
  const dbPath = path.join(directory,'main.db');
  try{
    await module.exports.ejecutarMigraciones(dbPath);
    const db = new sqlite3.Database(dbPath);
    try{await run(db,`INSERT INTO usuarios(ci,nombre,fecha_creacion,ultima_actualizacion,fecha_vencimiento) VALUES (12345678,'Socio de prueba','2026-01-01','2026-01-01','2026-12-31');
      INSERT INTO productos(id,nombre,precio,stock) VALUES (1,'Agua',95,12);`);}finally{await close(db);}
    const before = await fs.readFile(dbPath);
    const masters = await importLegacyMasters(dbPath);
    const classes = await importLegacyClasses(dbPath);
    const commercial = await importLegacyCommercial(dbPath);
    const history = await importLegacyHistory(dbPath);
    assert.equal(masters.members,1);assert.equal(masters.products,1);
    assert.equal(classes.classes,0);assert.equal(commercial.pendingSales,0);
    for(const report of [masters,classes,commercial,history])assert.equal(report.applied,false);
    assert.deepEqual(await fs.readFile(dbPath),before,'Dry runs must leave source byte-for-byte unchanged');
  }finally{
    const resolved=path.resolve(directory),temporaryRoot=path.resolve(os.tmpdir());
    assert.equal(path.dirname(resolved),temporaryRoot);
    assert.ok(path.basename(resolved).startsWith('underfit-main-migration-'));
    await fs.rm(resolved,{recursive:true,force:true});
  }
});

test('products from main without an activo column are not silently deactivated',()=>{
  const sql = buildImportSql({members:[],products:[{id:1,nombre:'Agua',precio:95,stock:12},{id:2,nombre:'Inactivo',precio:10,activo:0}]});
  assert.match(sql,/VALUES \(1,'Agua',95,TRUE\)/);
  assert.match(sql,/VALUES \(2,'Inactivo',10,FALSE\)/);
});
