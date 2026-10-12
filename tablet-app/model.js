(function(root) {
  const dateKey = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const asDate = key => new Date(`${key}T12:00:00`);
  const shiftDate = (key, days) => { const date=asDate(key);date.setDate(date.getDate()+days);return dateKey(date); };
  const weekDates = key => { const date=asDate(key);const monday=shiftDate(key,-((date.getDay()+6)%7));return Array.from({length:7},(_,i)=>shiftDate(monday,i)); };
  const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const names=['Abril Costa','Adrián Fagúndez','Agustina Toledo','Alejandro Duarte','Belén Acuña','Camila Pereira','Carolina Díaz','Diego Martínez','Federico Ramos','Florencia Silva','Ignacio Olivera','Joaquín Castro','Lucía Fernández','Martina Suárez','Nicolás Torres','Paula Méndez','Renata Castro','Santiago Cabrera','Sofía Núñez','Valentina Suárez','Victoria Ramos','Bruno Acosta','Ana Moreira','Lucas Pérez'];
  const members=names.map((name,i)=>({id:i+1,name,ci:String(99001001+i)}));
  const professors=['Camila López','Diego Fernández','Santiago Pérez'];
  const locations={1:'Gimnasio',2:'Salón de clases'};
  function createStore(today=dateKey(new Date())) {
    const classes=[];
    const schedule=[['07:00','Funcional mañana',2,2,16,60],['08:15','Movilidad y postura',0,2,12,45],['09:30','Pilates',0,2,16,60],['11:00','Fuerza inicial',1,2,12,60],['16:30','Entrenamiento integral',1,2,20,60],['18:00','Funcional',2,2,20,60],['19:15','Pilates',0,2,16,60],['20:30','Movilidad guiada',1,2,12,45]];
    for(let offset=-7;offset<=14;offset++) {
      const date=shiftDate(today,offset),weekday=asDate(date).getDay();
      if(weekday===0)continue;
      schedule.slice(0,weekday===6?3:8).forEach(([time,name,professor,location,capacity,duration],i)=>{
        const count=Math.min(capacity,8+(i*3)%11);
        classes.push({id:`${date}-${i}`,seriesId:`series-${i}`,date,time,name,professor:professors[professor],location,capacity,duration,trial:i===4,
          roster:members.slice(i%4,i%4+count).map((member,j)=>({memberId:member.id,presence:offset<0?(j%5===0?'absent':'present'):null,rating:0})),cancelled:false});
      });
    }
    const schedules=schedule.map(([time,name,professor,location,capacity,duration],i)=>({id:`series-${i}`,time,name,professor:professors[professor],location,capacity,duration,trial:i===4,startDate:shiftDate(today,-7),endDate:'',weekdays:i<3?[1,2,3,4,5,6]:[1,2,3,4,5],memberIds:classes.find(cls=>cls.seriesId===`series-${i}`).roster.map(row=>row.memberId),rosters:{}}));
    return {classes,schedules,members:members.map(m=>({...m})),products:[{id:1,name:'Agua mineral 600 ml',price:60,stock:24},{id:2,name:'Bebida energética sin azúcar',price:145,stock:12},{id:3,name:'Barrita de cereal',price:70,stock:18}],deliveries:[]};
  }
  // Demo recurrence is materialized only for viewed dates, never sent to the gym.
  function ensureDate(store,date){
    for(const schedule of store.schedules){
      if(date<schedule.startDate||(schedule.endDate&&date>schedule.endDate)||!schedule.weekdays.includes(asDate(date).getDay()))continue;
      if(schedule.effectiveFrom&&new Date(`${date}T${schedule.time}:00`).getTime()<schedule.effectiveFrom)continue;
      if(store.classes.some(cls=>cls.seriesId===schedule.id&&cls.date===date))continue;
      const roster=schedule.rosters[date]||schedule.memberIds.map(memberId=>({memberId,presence:null,rating:0}));
      store.classes.push({id:`${schedule.id}-${date}`,seriesId:schedule.id,date,time:schedule.time,name:schedule.name,professor:schedule.professor,location:2,capacity:schedule.capacity,duration:schedule.duration,trial:schedule.trial,cancelled:false,roster:roster.map(row=>({...row}))});
    }
  }
  function saveSchedule(store,values,seriesId=null,now=new Date()){
    if(!values.name.trim()||!values.weekdays.length)throw new Error('Completá la clase y elegí al menos un día.');
    if(values.endDate&&values.endDate<values.startDate)throw new Error('La fecha de finalización debe ser igual o posterior al comienzo.');
    let schedule=store.schedules.find(item=>item.id===seriesId);
    if(schedule){
      const future=store.classes.filter(cls=>cls.seriesId===seriesId&&new Date(`${cls.date}T${cls.time}:00`)>now);
      const minimum=Math.max(schedule.memberIds.length,...future.map(cls=>cls.roster.length));
      if(values.capacity<minimum)throw new Error(`El cupo no puede ser menor a los ${minimum} alumnos ya inscriptos.`);
      const rosters={...schedule.rosters};
      future.forEach(cls=>{rosters[cls.date]=cls.roster.map(row=>({...row}));});
      const futureIds=new Set(future.map(cls=>cls.id));
      store.classes=store.classes.filter(cls=>!futureIds.has(cls.id));
      Object.assign(schedule,values,{rosters,effectiveFrom:now.getTime()});
    }else{
      schedule={...values,id:`series-${Date.now()}-${store.schedules.length}`,memberIds:[],rosters:{}};
      store.schedules.push(schedule);
    }
    return schedule;
  }
  function nextClassId(classes,now=new Date()){
    return [...classes].filter(cls=>stateOf(cls,now).key==='scheduled').sort((a,b)=>`${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))[0]?.id||null;
  }
  function removeEnrollment(store,cls,memberId,now=new Date()){
    const schedule=store.schedules.find(item=>item.id===cls.seriesId);
    const shouldRemove=item=>item.seriesId===cls.seriesId&&(new Date(`${item.date}T${item.time}:00`)>=now||(item.id===cls.id&&stateOf(item,now).key!=='finished'));
    store.classes.filter(shouldRemove).forEach(item=>{item.roster=item.roster.filter(row=>row.memberId!==memberId);});
    if(schedule){
      schedule.memberIds=schedule.memberIds.filter(id=>id!==memberId);
      for(const [date,roster] of Object.entries(schedule.rosters)){
        if(new Date(`${date}T${schedule.time}:00`)>=now||(date===cls.date&&stateOf(cls,now).key!=='finished'))schedule.rosters[date]=roster.filter(row=>row.memberId!==memberId);
      }
    }
  }
  function stateOf(cls, now=new Date()) {
    if(cls.cancelled)return {key:'cancelled',label:'Cancelada'};
    const start=new Date(`${cls.date}T${cls.time}:00`),end=new Date(start.getTime()+cls.duration*60000);
    if(now<start)return {key:'scheduled',label:'Programada'};
    if(now<end)return {key:'current',label:'En curso'};
    return {key:'finished',label:'Finalizada'};
  }
  const api={dateKey,asDate,shiftDate,weekDates,normalize,createStore,stateOf,nextClassId,ensureDate,saveSchedule,removeEnrollment,professors,locations};
  if(typeof module!=='undefined')module.exports=api;
  else root.TabletModel=api;
})(typeof window==='undefined'?globalThis:window);
