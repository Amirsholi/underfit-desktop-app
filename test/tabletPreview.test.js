const test=require('node:test');
const assert=require('node:assert/strict');
const {weekDates,shiftDate,createStore,stateOf,nextClassId,ensureDate,saveSchedule,removeEnrollment}=require('../tablet-app/model');
const {createPreviewServer}=require('../scripts/serve-tablet-preview');
test('tablet week uses Monday through Sunday across month boundaries',()=>{
  assert.deepEqual(weekDates('2026-09-01'),['2026-08-31','2026-09-01','2026-09-02','2026-09-03','2026-09-04','2026-09-05','2026-09-06']);
  assert.equal(shiftDate('2026-12-31',1),'2027-01-01');
});
test('demo classes keep separate rosters and never overfill capacity',()=>{
  const store=createStore('2026-09-10');
  assert.ok(store.classes.every(cls=>cls.roster.length<=cls.capacity));
  assert.ok(store.classes.every(cls=>cls.location===2));
  assert.ok(store.classes.some(cls=>cls.location===2&&cls.trial));
  const [one,two]=store.classes;one.roster[0].presence='changed';assert.notEqual(two.roster[0].presence,'changed');
  assert.equal(stateOf({date:'2026-09-10',time:'18:00',duration:60},new Date('2026-09-10T18:30:00')).key,'current');
});
test('preview server serves only allowlisted assets and refuses writes',async t=>{
  const server=createPreviewServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const origin=`http://127.0.0.1:${server.address().port}`;
  for(const url of ['/','/app.js','/styles.css','/model.js','/controls.js','/exercises.js','/exercises/squat.gif'])assert.equal((await fetch(origin+url)).status,200);
  for(const url of ['/config.json','/.env','/main.js','/gym.db','/api/members','/..%2Fconfig.json'])assert.equal((await fetch(origin+url)).status,404);
  assert.equal((await fetch(origin+'/',{method:'POST'})).status,405);
  assert.match((await fetch(origin+'/')).headers.get('content-security-policy'),/connect-src 'none'/);
});
test('removal excludes future occurrences of the same group without changing history or other groups',()=>{
  const store=createStore('2026-09-11'),now=new Date('2026-09-11T06:00:00');
  const cls=store.classes.find(item=>item.date==='2026-09-11'&&item.seriesId==='series-0');
  const historical=store.classes.find(item=>item.date==='2026-09-10'&&item.seriesId==='series-0');
  const other=store.classes.find(item=>item.date==='2026-09-11'&&item.seriesId==='series-4');
  removeEnrollment(store,cls,1,now);
  ensureDate(store,'2026-10-05');
  assert.ok(!cls.roster.some(row=>row.memberId===1));
  assert.ok(historical.roster.some(row=>row.memberId===1));
  assert.ok(other.roster.some(row=>row.memberId===1));
  assert.ok(store.classes.filter(item=>item.seriesId==='series-0'&&item.date>='2026-09-11').every(item=>!item.roster.some(row=>row.memberId===1)));
});
test('upcoming outline selects only the earliest future class, never a running class',()=>{
  const rows=createStore('2026-09-11').classes.filter(cls=>cls.date==='2026-09-11');
  assert.equal(nextClassId(rows,new Date('2026-09-11T09:40:00')),rows.find(cls=>cls.time==='11:00').id);
  assert.equal(nextClassId(rows,new Date('2026-09-11T23:00:00')),null);
  assert.ok(rows.every(cls=>cls.roster.every(row=>row.presence===null)));
});
test('weekly demo schedule respects weekdays, end date and keeps attendance history on edit',()=>{
  const store=createStore('2026-09-11');
  const values={name:'Nueva semanal',professor:'Camila López',location:2,startDate:'2026-09-14',endDate:'2026-09-18',weekdays:[1,3,5],time:'15:00',duration:60,capacity:12,trial:false};
  const schedule=saveSchedule(store,values,null,new Date('2026-09-11T10:00:00'));
  for(let day=14;day<=21;day++)ensureDate(store,`2026-09-${day}`);
  assert.deepEqual(store.classes.filter(cls=>cls.seriesId===schedule.id).map(cls=>cls.date),['2026-09-14','2026-09-16','2026-09-18']);
  const historical=store.classes.find(cls=>cls.seriesId===schedule.id&&cls.date==='2026-09-14');
  historical.roster.push({memberId:1,presence:'present',rating:3});
  const future=store.classes.find(cls=>cls.seriesId===schedule.id&&cls.date==='2026-09-16');
  future.roster.push({memberId:2,presence:null,rating:0});
  saveSchedule(store,{...values,name:'Horario editado',time:'16:00'},schedule.id,new Date('2026-09-15T10:00:00'));
  ensureDate(store,'2026-09-14');ensureDate(store,'2026-09-16');
  assert.equal(store.classes.find(cls=>cls.id===historical.id),historical);
  assert.equal(historical.time,'15:00');assert.equal(historical.roster[0].presence,'present');
  const edited=store.classes.find(cls=>cls.seriesId===schedule.id&&cls.date==='2026-09-16');
  assert.equal(edited.time,'16:00');assert.equal(edited.roster[0].memberId,2);
  assert.throws(()=>saveSchedule(store,{...values,weekdays:[]},null),/día/);
});
