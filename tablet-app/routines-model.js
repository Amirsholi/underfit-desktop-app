(function(root){
  const copy=value=>JSON.parse(JSON.stringify(value));
  const count=routine=>routine.days.reduce((sum,day)=>sum+day.exercises.length,0);
  function create(members){
    let serial=100;
    const names=['Inicio · cuerpo completo','Base de fuerza','Movilidad y retorno','Tren superior','Fuerza · 3 días','Acondicionamiento','Core y postura','Full body express'];
    const templates=names.map((name,i)=>({id:++serial,name,professor:['Camila López','Diego Fernández','Santiago Pérez'][i%3],updated:Date.now()-i*86400000,days:Array.from({length:i===4?3:i%3+1},(_,day)=>({exercises:Array.from({length:3},(_,j)=>({exerciseId:(day*3+j+i)%6+1,sets:3,reps:'10',note:''}))}))}));
    const assignments=members.filter((_,i)=>i%3!==2).map((member,i)=>({...copy(templates[i%templates.length]),id:++serial,memberId:member.id}));
    function save(draft){
      if(!draft.name.trim())throw new Error('Escribí un nombre para la rutina.');
      if(!draft.professor)throw new Error('Elegí el profesor responsable.');
      if(!draft.days.length||draft.days.some(day=>!day.exercises.length))throw new Error('Agregá al menos un ejercicio en cada día, o quitá los días vacíos.');
      if(draft.days.some(day=>day.exercises.some(item=>!Number.isInteger(Number(item.sets))||item.sets<1||item.sets>30||!String(item.reps).trim())))throw new Error('Revisá las series y repeticiones de los ejercicios.');
      const target=draft.memberId?assignments:templates;
      const item={...copy(draft),name:draft.name.trim(),id:draft.id||++serial,updated:Date.now()};
      const index=target.findIndex(row=>draft.memberId?row.memberId===draft.memberId:row.id===draft.id);
      if(index<0)target.push(item);else target[index]=item;
      return item;
    }
    function assign(template,memberId){
      const current=assignments.find(item=>item.memberId===memberId);
      if(current&&count(current)>0)throw new Error('Solo se puede usar una plantilla cuando la rutina está vacía.');
      return save({...copy(template),id:undefined,memberId});
    }
    function remove(item){const target=item.memberId?assignments:templates,index=target.findIndex(row=>row.id===item.id);if(index>=0)target.splice(index,1);}
    return {templates,assignments,save,assign,remove};
  }
  const api={create,copy,count};if(typeof module!=='undefined')module.exports=api;else root.TabletRoutineModel=api;
})(typeof window!=='undefined'?window:globalThis);
