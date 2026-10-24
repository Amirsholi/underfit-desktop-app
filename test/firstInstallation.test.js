const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sqlite3 = require('sqlite3');
const { snapshot, completeFirstInstallation, transactionBody } = require('../services/firstInstallation');
const exec = (db, sql) => new Promise((resolve, reject) => db.exec(sql, e => e ? reject(e) : resolve()));
const close = db => new Promise(resolve => db.close(resolve));
function temp(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'underfit-first-install-'));
  t.after(() => {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    fs.rmSync(root, { recursive: true, force: true });
  });
  return root;
}
function pending(root) {
  fs.mkdirSync(path.join(root, 'platform'));
  fs.writeFileSync(path.join(root, 'platform', 'first-installation.json'), JSON.stringify({status:'pending',source:null}));
}
test('snapshot includes committed WAL data without modifying the source', async t => {
  const root = temp(t), source = path.join(root, 'source.db'), backup = path.join(root, 'backup.db');
  const db = new sqlite3.Database(source);
  await exec(db, 'PRAGMA journal_mode=WAL; CREATE TABLE sample(value); INSERT INTO sample VALUES(42);');
  const before = fs.readFileSync(source), wal = fs.readFileSync(`${source}-wal`);
  await snapshot(source, backup);
  assert.deepEqual(fs.readFileSync(source), before);
  assert.deepEqual(fs.readFileSync(`${source}-wal`), wal);
  const copy = new sqlite3.Database(backup, sqlite3.OPEN_READONLY);
  const row = await new Promise((resolve, reject) => copy.get('SELECT value FROM sample', (e,r)=>e?reject(e):resolve(r)));
  assert.equal(row.value,42);
  await close(copy); await close(db);
});
test('existing data blocks first import and leaves setup pending', async t => {
  const root=temp(t); pending(root); let writes=0;
  await assert.rejects(completeFirstInstallation({userDataPath:root,query:sql=>{
    if(sql.startsWith('SELECT fingerprint'))return '';
    if(sql.startsWith('SELECT ('))return '1';
    if(sql.startsWith('BEGIN'))writes++;
    return '';
  }}),/ya contiene datos/);
  assert.equal(writes,0);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root,'platform','first-installation.json'))).status,'pending');
});
test('interrupted receipt resumes without replay, completed setup does no work', async t => {
  const root=temp(t); pending(root); let writes=0;
  const query=sql=>{
    if(sql.startsWith('SELECT fingerprint'))return 'empty-installation';
    if(sql.startsWith('BEGIN'))writes++;
    return '';
  };
  await completeFirstInstallation({userDataPath:root,query});
  await completeFirstInstallation({userDataPath:root,query:()=>{throw Error('must not query');}});
  assert.equal(writes,0);
});
test('receipt for another source fails closed', async t => {
  const root=temp(t);pending(root);
  await assert.rejects(completeFirstInstallation({userDataPath:root,
    query:sql=>sql.startsWith('SELECT fingerprint')?'different-source':''}),/otra base/);
});
test('only the outer transaction delimiters are removed',()=>{
  assert.equal(transactionBody("BEGIN;\nSELECT 'COMMIT;';\nCOMMIT;"),"\nSELECT 'COMMIT;';\n");
  assert.throws(()=>transactionBody('SELECT 1;'),/inesperado/);
});
