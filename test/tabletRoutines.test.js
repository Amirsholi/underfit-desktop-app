const test=require('node:test');
const assert=require('node:assert/strict');
const M=require('../tablet-app/routines-model');
test('tablet routines copies, assignments, deletion and validations are independent',()=>{
  const store=M.create([{id:1},{id:2},{id:3}]),template=store.templates[0];
  assert.throws(()=>store.assign(template,1),/vacía/);
  const assigned=store.assign(template,3);
  assigned.days[0].exercises[0].note='Controlar descenso';
  assert.equal(template.days[0].exercises[0].note,'');
  const edited=M.copy(assigned);edited.days[0].exercises[0].sets=4;store.save(edited);
  assert.equal(store.assignments.filter(item=>item.memberId===3).length,1);
  const duplicate=store.save({...M.copy(template),id:undefined,name:'Copia'});
  store.remove(template);assert.ok(store.assignments.some(item=>item.memberId===3));assert.ok(store.templates.includes(duplicate));
  assert.throws(()=>store.save({...duplicate,name:'  '}),/nombre/);
  assert.throws(()=>store.save({...duplicate,days:[{exercises:[]}]}),/ejercicio/);
  for(const sets of ['',0,1.5,31]){
    const invalid=M.copy(duplicate);invalid.days[0].exercises[0].sets=sets;
    assert.throws(()=>store.save(invalid),/series y repeticiones/);
  }
  const timed=M.copy(duplicate);timed.days[0].exercises[0].sets=5;timed.days[0].exercises[0].reps='30 s';
  assert.equal(store.save(timed).days[0].exercises[0].reps,'30 s');
  timed.days[0].exercises[0].reps='  ';
  assert.throws(()=>store.save(timed),/series y repeticiones/);
  store.remove(edited);assert.ok(!store.assignments.some(item=>item.memberId===3));
});
