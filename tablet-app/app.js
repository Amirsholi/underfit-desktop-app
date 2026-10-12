(() => {
  'use strict';
  const LIVE=window.TabletLive;
  let pairing=false;
  let pairingLink=new URLSearchParams(window.location.hash.slice(1)).get('vincular');
  if(pairingLink)history.replaceState(null,'',window.location.pathname+window.location.search+'#clases');
  if(!LIVE && window.UNDERFIT_TABLET_DEMO !== true){
    document.getElementById('main').textContent='No se pudo iniciar la conexión con el gimnasio. Recargá la página.';
    return;
  }
  const M=window.TabletModel, baseDate=M.dateKey(new Date()), store=LIVE?LIVE.store:M.createStore(baseDate);
  const main=document.getElementById('main'), dialog=document.getElementById('dialog'), dialogBody=document.getElementById('dialog-body');
  let selectedDate=baseDate, listScroll=0, toastTimer, lastFocus;
  const money=value=>'$ '+new Intl.NumberFormat('es-UY',{maximumFractionDigits:0}).format(value);
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const dateLabel=key=>new Intl.DateTimeFormat('es-UY',{weekday:'long',day:'numeric',month:'long'}).format(M.asDate(key));
  const currentClass=()=>store.classes.find(cls=>`#clase/${cls.id}`===locationHash());
  const locationHash=()=>window.location.hash||'#clases';
  const classesFor=date=>{if(!LIVE)M.ensureDate(store,date);return store.classes.filter(cls=>cls.date===date).sort((a,b)=>a.time.localeCompare(b.time));};
  function notify(message){clearTimeout(toastTimer);const toast=document.getElementById('toast');toast.textContent=message;toast.hidden=false;toastTimer=setTimeout(()=>{toast.hidden=true;},3500);}
  async function chooseDate(date){
    try{if(LIVE)await LIVE.load(date);selectedDate=date;listScroll=0;renderSchedule();}catch(error){notify(error.message);}
  }
  function showConnectionInfo(){
    const pending=LIVE.client.pending();
    openDialog('Conexión con el gimnasio',`<div class="dialog-content"><p>${pending.length?`${pending.length} operaciones pendientes. Los cambios aún no están confirmados en recepción.`:'No hay operaciones pendientes de sincronización.'}</p>${pending.map(item=>`<p>${esc(item.state==='failed'?item.error:'Esperando conexión con el gimnasio.')}${item.state==='failed'?` <button class="button" data-dismiss-operation="${esc(item.key)}">Descartar operación rechazada</button>`:''}</p>`).join('')}</div><footer class="dialog-footer"><button class="button" data-dismiss>Volver</button><button class="button primary" id="retry-sync">Reintentar conexión</button></footer>`);
    dialog.querySelectorAll('[data-dismiss-operation]').forEach(button=>button.onclick=()=>{LIVE.client.dismiss(button.dataset.dismissOperation);showConnectionInfo();});
    const identity=document.createElement('p');
    identity.textContent=`Dispositivo vinculado: ${LIVE.client.deviceId() || 'Sin vincular'}`;
    dialogBody.querySelector('.dialog-content').prepend(identity);
    const change=document.createElement('button');
    change.type='button';change.className='button';change.textContent='Cambiar tablet';
    change.disabled=pending.length>0;
    change.title=pending.length?'Resolvé las operaciones pendientes antes de cambiar de tablet.':'';
    change.onclick=()=>{
      if(LIVE.client.pending().length){notify('Resolvé las operaciones pendientes antes de cambiar de tablet.');return;}
      closeDialog();startLive(true);
    };
    dialogBody.querySelector('.dialog-footer').prepend(change);
    document.getElementById('retry-sync').onclick=async()=>{try{await LIVE.client.flush();await LIVE.load(selectedDate);closeDialog();render();notify(LIVE.client.pending().length?'Quedan operaciones pendientes.':'Datos actualizados.');}catch(error){notify(error.message);}};
  }
  async function startLive(repair=false){
    if(pairingLink){
      const encoded=pairingLink;pairingLink=null;
      try{const credentials=JSON.parse(atob(encoded));await LIVE.client.pair(credentials.id,credentials.key);}
      catch(error){notify(error.message||'El enlace de vinculación no es válido.');}
    }
    if(repair===true||!LIVE.client.paired()){
      pairing=true;
      main.innerHTML='<form id="pair-tablet" class="dialog-content"><h1>Vincular tablet</h1><p>En la PC abrí Configuración → Vincular tablets y generá un código para este dispositivo.</p><label class="field">Tablet<select name="device"><option value="tablet1">Tablet 1</option><option value="tablet2">Tablet 2</option></select></label><label class="field">Código de vinculación<input name="key" inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" required autocomplete="one-time-code" placeholder="6 números"></label><p id="pair-error" role="alert"></p><button class="button primary">Conectar con el gimnasio</button></form>';
      const form=document.getElementById('pair-tablet');
      form.elements.device.value=LIVE.client.deviceId() || 'tablet1';
      if(LIVE.client.paired()){
        const cancel=document.createElement('button');cancel.type='button';cancel.className='button';cancel.textContent='Cancelar cambio';
        cancel.onclick=()=>startLive();form.appendChild(cancel);
      }
      form.onsubmit=async event=>{event.preventDefault();const data=new FormData(form),controls=[...form.querySelectorAll('button,input,select')];controls.forEach(control=>control.disabled=true);try{await LIVE.client.pairWithCode(data.get('device'),data.get('key'));await startLive();}catch(error){form.querySelector('#pair-error').textContent=error.message;}finally{controls.forEach(control=>control.disabled=false);}};
      return;
    }
    pairing=false;
    try{await LIVE.client.flush();await LIVE.load(selectedDate);render();}
    catch(error){main.innerHTML=`<div class="empty"><h1>No se pudo conectar con el gimnasio</h1><p>${esc(error.message)}</p><button class="button primary" id="retry-connection">Reintentar</button>${error.status===401?'<button class="button" id="repair-connection">Actualizar vinculación</button>':''}</div>`;document.getElementById('retry-connection').onclick=()=>startLive();document.getElementById('repair-connection')?.addEventListener('click',()=>startLive(true));}
  }
  if(LIVE){
    window.addEventListener('tablet-refresh-failed',()=>notify('El cambio se guardó. Falta actualizar la pantalla; revisá la conexión.'));
    let refreshing=false;
    const canRefresh=()=>!pairing&&!document.hidden&&!dialog.open&&
      !document.querySelector('[aria-haspopup="listbox"][aria-expanded="true"]')&&
      !(locationHash()==='#rutinas'&&window.TabletRoutines?.hasDraft?.())&&
      !document.activeElement?.matches('input,textarea,select');
    const refresh=async()=>{
      if(pairing||!LIVE.ready()||document.hidden||refreshing)return;
      refreshing=true;
      try{
        // Pending writes must keep draining even while a different form is open.
        await LIVE.client.flush();
        if(!canRefresh())return;
        const hash=locationHash(),date=selectedDate;
        const stillCurrent=()=>canRefresh()&&hash===locationHash()&&date===selectedDate;
        const changed=await LIVE.load(date,stillCurrent);
        if(!stillCurrent())return;
        if(changed)render();
        const count=LIVE.client.pending().length,info=document.getElementById('preview-info');
        info.textContent=count?`${count} pendiente${count===1?'':'s'}`:'ⓘ';
        info.title=count?'Hay operaciones pendientes de sincronización':'Conectada al gimnasio';
      }catch{const info=document.getElementById('preview-info');info.textContent='Sin conexión';info.title='Los datos visibles pueden estar desactualizados';}
      finally{refreshing=false;}
    };
    setInterval(refresh,10000);
    for(const event of ['focus','hashchange'])window.addEventListener(event,()=>queueMicrotask(refresh));
    document.addEventListener('visibilitychange',refresh);
    window.addEventListener('online',()=>LIVE.ready()?refresh():startLive());
    window.addEventListener('tablet-queue-change',()=>{const count=LIVE.client.pending().length;const info=document.getElementById('preview-info');info.textContent=count?`${count} pendiente${count===1?'':'s'}`:'ⓘ';info.setAttribute('aria-label',count?`${count} operaciones pendientes de sincronización`:'Estado de conexión');});
  }
  function openDialog(title,content){window.TabletControls?.close();lastFocus=document.activeElement;document.getElementById('dialog-subtitle').hidden=true;document.getElementById('dialog-title').textContent=title;dialogBody.innerHTML=content;dialog.dataset.kind=dialogBody.querySelector('#class-form')?'class':dialogBody.querySelector('#student-form')?'student':dialogBody.querySelector('#sale-form')?'sale':'confirmation';if(!dialog.open)dialog.showModal();window.TabletControls?.enhance(dialogBody);}
  function closeDialog(){window.TabletControls?.close();dialog.close();lastFocus?.isConnected&&lastFocus.focus();}
  document.getElementById('dialog-close').addEventListener('click',closeDialog);
  document.querySelector('.skip-link').addEventListener('click',event=>{event.preventDefault();main.focus();});
  dialog.addEventListener('click',event=>{if(event.target.closest('[data-dismiss]'))closeDialog();});
  dialog.addEventListener('close',()=>{if(lastFocus?.isConnected)lastFocus.focus();});
  document.getElementById('preview-info').addEventListener('click',()=>{if(LIVE){showConnectionInfo();return;}openDialog('Prueba en tablet',`<div class="dialog-content"><p>Esta versión sirve para revisar las pantallas de Clases. Todos los nombres, horarios y productos son de ejemplo.</p><p>Los cambios duran hasta recargar esta página. No se envían a recepción ni a la otra tablet.</p><p>El catálogo de ejercicios permite probar altas y videos. Rutinas permite probar plantillas y asignaciones. Sincronización e instalación siguen pendientes.</p></div><footer class="dialog-footer"><button class="button" data-dismiss>Entendido</button></footer>`);});
  function render(){
    if(pairing)return;
    if(LIVE&&!LIVE.ready())return;
    const hash=locationHash(),section=hash.startsWith('#clase')?'clases':hash.slice(1);
    main.classList.toggle('is-detail',hash.startsWith('#clase/'));
    document.querySelectorAll('[data-nav]').forEach(link=>{if(link.dataset.nav===section)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
    if(hash.startsWith('#clase/')){
      const cls=currentClass();
      if(cls)renderDetail(cls);
      else main.innerHTML='<div class="empty"><h1>Clase no disponible</h1><a class="button" href="#clases">Volver a clases</a></div>';
    }else if(section==='clases')renderSchedule();
    else if(section==='rutinas')window.TabletRoutines.render({main,openDialog,closeDialog,notify,esc,dialog,members:store.members});
    else if(section==='ejercicios')window.TabletExercises.render({main,openDialog,closeDialog,notify,esc,dialog});
    else main.innerHTML=`<header class="page-heading"><h1>${section==='rutinas'?'Rutinas':'Ejercicios'}</h1></header><div class="empty"><h2>Próxima etapa de la tablet</h2><p>${section==='rutinas'?'Aquí vas a crear y asignar rutinas a los socios.':'Aquí vas a crear ejercicios y grabar sus demostraciones.'}</p><a class="button" href="#clases">Volver a clases</a></div>`;
  }
  function renderSchedule(){
    const rows=classesFor(selectedDate);
    main.innerHTML=`<header class="page-heading"><div><h1>Clases</h1><p>${esc(dateLabel(selectedDate))}</p></div><div class="heading-actions"><label class="date-choice"><span>${esc(new Intl.DateTimeFormat('es-UY',{day:'numeric',month:'long'}).format(M.asDate(selectedDate)))}</span><span class="date-calendar" aria-hidden="true">▦</span><input id="agenda-date" type="date" aria-label="Elegir fecha" value="${selectedDate}"></label><button class="button primary" id="new-class">＋ Nueva clase</button></div></header>
      <div class="week-strip" aria-label="Clases de la semana">${M.weekDates(selectedDate).map(date=>`<button class="week-day" data-date="${date}" aria-pressed="${date===selectedDate}" aria-label="${esc(dateLabel(date))}"><span>${esc(new Intl.DateTimeFormat('es-UY',{weekday:'short'}).format(M.asDate(date)))}</span><strong>${M.asDate(date).getDate()}</strong><small>${date===baseDate?'Hoy':classesFor(date).length+' clases'}</small></button>`).join('')}</div>
      <section class="class-list" aria-label="Clases del día">${rows.map(cls=>{
        return `<article class="class-card" data-card="${cls.id}"><button class="class-open" data-class="${cls.id}" aria-label="Abrir ${esc(cls.name)}, ${cls.time}"><span class="card-time"><strong>${cls.time}</strong><small>${cls.duration} min</small></span><span class="card-identity"><strong>${esc(cls.name)}</strong><small>${esc(cls.professor)}${cls.trial?' · Prueba':''}</small></span><span class="card-info"><span class="card-status"></span><small>${cls.roster.length} / ${cls.capacity} alumnos</small></span><span class="card-open" aria-hidden="true">›</span></button><button class="class-edit" data-edit="${cls.id}" aria-label="Editar ${esc(cls.name)}, ${cls.time}">Editar</button></article>`;
      }).join('')||'<div class="empty"><h2>No hay clases este día</h2><p>Podés elegir otro día de la semana o crear una clase.</p></div>'}</section>`;
    updateAgendaStates();
    main.querySelectorAll('[data-edit]').forEach(button=>{button.onclick=()=>classForm(store.classes.find(cls=>cls.id===button.dataset.edit));});
    document.getElementById('agenda-date').onchange=event=>{if(event.target.value){chooseDate(event.target.value);}};
    main.querySelectorAll('[data-date]').forEach(button=>{button.onclick=()=>{chooseDate(button.dataset.date);}});
    main.querySelectorAll('[data-class]').forEach(button=>{button.onclick=()=>{listScroll=main.querySelector('.class-list').scrollTop;window.location.hash=`clase/${button.dataset.class}`;}});
    main.querySelector('.class-list').scrollTop=listScroll;
    document.getElementById('new-class').onclick=()=>classForm();
  }
  function updateAgendaStates(){
    if(!main.querySelector('.class-list'))return;
    const rows=classesFor(selectedDate),now=new Date(),nextId=M.nextClassId(rows,now);
    rows.forEach(cls=>{
      const card=main.querySelector(`[data-card="${cls.id}"]`);if(!card)return;
      const state=M.stateOf(cls,now),isNext=cls.id===nextId;
      card.className=`class-card ${state.key}${isNext?' is-next':''}`;
      card.querySelector('.card-status').textContent=isNext?'Próxima clase':state.label;
    });
  }
  setInterval(updateAgendaStates,30000);
  function classForm(cls=null){
    const schedule=store.schedules.find(item=>item.id===cls?.seriesId);
    const source=schedule||cls;
    const startDate=source?.startDate||selectedDate;
    const weekdays=source?.weekdays||[1,3,5],dayNames=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
    const endTime=source?new Date(new Date(`${startDate}T${source.time}:00`).getTime()+source.duration*60000).toTimeString().slice(0,5):'19:00';
    openDialog(cls?'Editar clase':'Nueva clase',`<form id="class-form"><div class="dialog-content">
      <div class="form-grid"><label class="field full">Clase<input name="name" required maxlength="70" value="${esc(source?.name||'')}" placeholder="Ej: Funcional de mañana"></label><label class="field full">Profesor<select name="professor" required><option value="">Seleccionar profesor</option>${M.professors.map(name=>`<option ${name===source?.professor?'selected':''}>${esc(name)}</option>`).join('')}</select></label>
      <fieldset class="weekdays-field"><legend>Días</legend><div class="weekday-picker">${[1,2,3,4,5,6,0].map((day,i)=>`<label><input type="checkbox" name="weekday" value="${day}" aria-label="${dayNames[i]}" ${weekdays.includes(day)?'checked':''}><span aria-hidden="true">${['L','M','X','J','V','S','D'][i]}</span></label>`).join('')}</div></fieldset></div>
      <div class="schedule-timing ${cls?'editing':''}">${cls?'':`<label class="field">Comienza<input name="startDate" type="date" required value="${startDate}"></label>`}<label class="field">Hora de inicio<input name="time" type="time" required value="${source?.time||'18:00'}"></label><label class="field">Hora de fin<input name="endTime" type="time" required value="${endTime}"></label><label class="field">Cupo<input name="capacity" inputmode="numeric" type="number" required min="1" max="100" value="${source?.capacity||12}"></label><label class="field">Finaliza<input name="endDate" type="date" value="${source?.endDate||''}"><small>${cls?'Sin fecha: continúa semanalmente.':'Opcional'}</small></label></div>
      <label class="trial-control"><span><strong>Clase de prueba</strong><small>Evaluación con estrellas para los asistentes.</small></span><input name="trial" type="checkbox" role="switch" ${source?.trial?'checked':''}></label><p id="class-error" class="form-error" hidden role="alert"></p></div><footer class="dialog-footer"><button class="button" type="button" data-dismiss>Cancelar</button><button class="button primary" type="submit">${cls?'Guardar cambios':'Crear clase'}</button></footer></form>`);
    const subtitle=document.getElementById('dialog-subtitle');subtitle.textContent=cls?'Los cambios se aplicarán únicamente a las próximas clases.':'Se repetirá semanalmente en los días seleccionados.';subtitle.hidden=false;
    const form=document.getElementById('class-form');
    form.addEventListener('input',()=>{document.getElementById('class-error').hidden=true;});
    form.onsubmit=async event=>{
      event.preventDefault();
      const data=new FormData(form),name=data.get('name').trim(),minutes=value=>{const [h,m]=value.split(':').map(Number);return h*60+m;};
      const duration=minutes(data.get('endTime'))-minutes(data.get('time'));
      const fail=message=>{const error=document.getElementById('class-error');error.textContent=message;error.hidden=false;error.scrollIntoView({block:'nearest'});};
      if(duration<15||duration>240)return fail('La hora de fin debe ser posterior al inicio. Duración: entre 15 minutos y 4 horas.');
      const values={name,professor:data.get('professor'),location:2,startDate:cls?startDate:data.get('startDate'),endDate:data.get('endDate'),weekdays:data.getAll('weekday').map(Number),time:data.get('time'),duration,capacity:Number(data.get('capacity')),trial:data.get('trial')==='on'};
      if(cls&&values.endDate&&values.endDate<baseDate)return fail('La finalización no puede ser anterior a hoy.');
      if(form.dataset.saving)return;form.dataset.saving='true';
      try{if(LIVE)await LIVE.saveSchedule(values,schedule);else M.saveSchedule(store,values,cls?.seriesId||null);}catch(error){delete form.dataset.saving;return fail(error.message);}
      if(!cls){selectedDate=values.startDate;for(let i=0;i<7&&!values.weekdays.includes(M.asDate(selectedDate).getDay());i++)selectedDate=M.shiftDate(selectedDate,1);}
      closeDialog();if(LIVE){try{await LIVE.load(selectedDate);}catch{render();notify('La clase se guardó. Falta actualizar la pantalla.');return;}}render();notify(cls?'Próximas clases actualizadas.':'Clase semanal creada.');
    };
  }
  function renderDetail(cls){
    main.innerHTML=`<header class="detail-heading"><a class="back-link" href="#clases" aria-label="Volver a clases"><span aria-hidden="true">←</span><span class="back-label">Clases</span></a><div class="detail-title"><h1>${esc(cls.name)}</h1><p>${cls.time} · ${esc(cls.professor)}${cls.trial?' · Prueba':''}</p></div><input id="student-search" type="search" placeholder="Buscar alumno" aria-label="Buscar alumno por nombre o CI"><div class="heading-actions"><button class="button primary" id="add-student">＋ Alumno</button></div></header>
      <section class="roster-list" aria-label="Alumnos inscriptos"></section><span id="attendance-count" class="sr-only" role="status"></span>`;
    document.getElementById('add-student').onclick=()=>studentPicker(cls);
    document.getElementById('student-search').oninput=()=>renderStudents(cls);
    renderStudents(cls);
  }
  function renderStudents(cls){
    const query=M.normalize(document.getElementById('student-search').value),roster=main.querySelector('.roster-list'),scroll=roster.scrollTop;
    document.getElementById('attendance-count').textContent=`${cls.roster.filter(row=>row.presence==='present').length} presentes · ${cls.roster.filter(row=>!row.presence).length} sin marcar`;
    const rows=cls.roster.filter(row=>{const member=store.members.find(m=>m.id===row.memberId);return M.normalize(`${member.name} ${member.ci}`).includes(query);});
    roster.innerHTML=rows.map(row=>{
      const member=store.members.find(m=>m.id===row.memberId),present=row.presence==='present';
      return `<article class="student-row ${present?'is-present':''}"><button class="student-toggle" data-member="${member.id}" aria-pressed="${present}" aria-label="Presente: ${esc(member.name)}"><span class="student-identity"><span class="student-avatar" aria-hidden="true">${esc(member.name.split(' ').map(part=>part[0]).slice(0,2).join(''))}</span><span><strong>${esc(member.name)}</strong><small>CI ${member.ci}</small></span></span><span class="presence-status">${row.pending?'Pendiente':present?'<span class="presence-dot" aria-hidden="true"></span>Presente':'Sin marcar'}</span></button><button class="student-actions" data-actions="${member.id}" aria-label="Opciones de ${esc(member.name)}" aria-haspopup="dialog">›</button>${cls.trial&&present&&!row.pending&&(!LIVE||M.stateOf(cls).key==='finished')?`<div class="rating"><span>Evaluación</span>${[1,2,3,4,5].map(score=>`<button data-rate="${member.id}" data-score="${score}" aria-label="${score} estrellas para ${esc(member.name)}" aria-pressed="${row.rating>=score}">★</button>`).join('')}</div>`:''}</article>`;
    }).join('')||'<div class="empty"><h2>No hay alumnos para mostrar</h2><p>Probá otro nombre o agregá un alumno a esta clase.</p></div>';
    roster.scrollTop=scroll;
    roster.querySelectorAll('.student-toggle').forEach(button=>{button.onclick=async()=>{
      const row=cls.roster.find(r=>r.memberId===(LIVE?String(button.dataset.member):Number(button.dataset.member)));if(LIVE){try{const saving=LIVE.attendance(cls,row);renderStudents(cls);const result=await saving;renderStudents(cls);if(result.queued)notify(result.queued?'Asistencia pendiente de sincronización.':'Asistencia guardada.');}catch(error){renderStudents(cls);notify(error.message);}return;}row.presence=row.presence==='present'?null:'present';
      if(row.presence!=='present')row.rating=0;
      renderStudents(cls);roster.querySelector(`[data-member="${row.memberId}"]`)?.focus({preventScroll:true});
    };});
    roster.querySelectorAll('[data-rate]').forEach(button=>{button.onclick=async()=>{const row=cls.roster.find(r=>r.memberId===(LIVE?String(button.dataset.rate):Number(button.dataset.rate)));if(LIVE){try{await LIVE.rating(cls,row,Number(button.dataset.score));renderStudents(cls);}catch(error){notify(error.message);}return;}row.rating=Number(button.dataset.score);renderStudents(cls);roster.querySelector(`[data-rate="${row.memberId}"][data-score="${row.rating}"]`)?.focus({preventScroll:true});};});
    roster.querySelectorAll('[data-actions]').forEach(button=>{button.onclick=()=>studentActions(cls,store.members.find(member=>member.id===(LIVE?String(button.dataset.actions):Number(button.dataset.actions))));});
  }
  function studentPicker(cls){
    if(cls.roster.length>=cls.capacity){notify('La clase tiene el cupo completo.');return;}
    let chosen=null;
    openDialog('Nuevo alumno',`<form id="student-form"><div class="dialog-content"><p>${esc(cls.name)} · ${cls.roster.length} / ${cls.capacity} inscriptos</p><label class="field">Buscar socio<input id="member-query" type="search" placeholder="Nombre o CI" autocomplete="off"></label><div class="picker-results" id="member-results"><p>Escribí para buscar un socio.</p></div></div><footer class="dialog-footer"><button class="button" type="button" data-dismiss>Cancelar</button><button class="button primary" id="add-member-confirm" disabled>Agregar alumno</button></footer></form>`);
    document.getElementById('member-query').oninput=event=>{const query=M.normalize(event.target.value);chosen=null;document.getElementById('add-member-confirm').disabled=true;const matches=query?store.members.filter(member=>!cls.roster.some(row=>row.memberId===member.id)&&M.normalize(`${member.name} ${member.ci}`).includes(query)):[];
      document.getElementById('member-results').innerHTML=matches.map(member=>`<button class="picker-result" type="button" data-pick="${member.id}" aria-pressed="false"><span><strong>${esc(member.name)}</strong><small>CI ${member.ci}</small></span></button>`).join('')||`<p>${query?'No hay socios disponibles con esa búsqueda.':'Escribí para buscar un socio.'}</p>`;
      dialog.querySelectorAll('[data-pick]').forEach(button=>{button.onclick=()=>{chosen=(LIVE?String(button.dataset.pick):Number(button.dataset.pick));dialog.querySelectorAll('[data-pick]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));document.getElementById('add-member-confirm').disabled=false;};});};
    document.getElementById('student-form').onsubmit=async event=>{event.preventDefault();if(!chosen)return;try{if(LIVE)await LIVE.enroll(cls,chosen);else cls.roster.push({memberId:chosen,presence:null,rating:0});closeDialog();renderStudents(cls);notify('Alumno agregado.');}catch(error){notify(error.message);}};
  }
  function studentActions(cls,member,draft={}){
    const products=LIVE?store.products:store.products.filter(product=>product.stock>0);
    const professor=cls.professor||store.classes.filter(item=>new Date(`${item.date}T${item.time}`)<=new Date()).sort((a,b)=>`${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`))[0]?.professor||M.professors[0];
    openDialog(member.name,`<form id="sale-form"><div class="dialog-content">
      ${products.length?`<label class="field">Producto<select name="product" id="sale-product">${products.map(product=>`<option value="${product.id}" ${Number(draft.product)===product.id?'selected':''}>${esc(product.name)} · ${money(product.price)}</option>`).join('')}</select></label><div class="delivery-amount"><label class="field">Cantidad<span class="quantity-stepper"><button type="button" id="quantity-less" aria-label="Restar una unidad">−</button><input name="quantity" id="sale-quantity" type="number" inputmode="numeric" required min="1" step="1" value="${esc(draft.quantity||1)}"><button type="button" id="quantity-more" aria-label="Sumar una unidad">＋</button></span></label><div class="delivery-total"><span>Total pendiente</span><strong id="sale-total"></strong></div></div><label class="field">Profesor responsable<select name="professor">${M.professors.map(name=>`<option ${name===(draft.professor||professor)?'selected':''}>${esc(name)}</option>`).join('')}</select></label>`:'<p>No hay productos disponibles en el salón.</p>'}
      <p class="notice">Se paga en recepción.</p><p id="sale-error" class="form-error" hidden role="alert"></p><div class="student-danger"><button type="button" class="button danger" id="remove-enrollment">Eliminar usuario</button></div></div>
      <footer class="dialog-footer"><button class="button" type="button" data-dismiss>Volver</button><button class="button primary" ${products.length?'':'disabled'}>Confirmar entrega</button></footer></form>`);
    document.getElementById('dialog-subtitle').textContent=cls.name;document.getElementById('dialog-subtitle').hidden=false;
    const form=document.getElementById('sale-form');
    if(products.length){
      const quantity=document.getElementById('sale-quantity'),productInput=document.getElementById('sale-product');
      const refresh=()=>{
        const product=products.find(item=>item.id===Number(productInput.value)),count=Number(quantity.value);
        if(LIVE)quantity.removeAttribute('max');else quantity.max=product.stock;
        document.getElementById('sale-total').textContent=money(product.price*(Number.isFinite(count)?count:0));
        document.getElementById('quantity-less').disabled=count<=1;document.getElementById('quantity-more').disabled=!LIVE&&count>=product.stock;
      };
      productInput.addEventListener('change',()=>{const product=products.find(item=>item.id===Number(productInput.value));if(!LIVE)quantity.value=Math.min(Number(quantity.value)||1,product.stock);refresh();});
      quantity.oninput=refresh;
      document.getElementById('quantity-less').onclick=()=>{quantity.value=Math.max(1,(Number(quantity.value)||1)-1);refresh();};
      document.getElementById('quantity-more').onclick=()=>{quantity.value=Math.min(LIVE?Number.MAX_SAFE_INTEGER:Number(quantity.max),(Number(quantity.value)||0)+1);refresh();};
      refresh();
    }
    document.getElementById('remove-enrollment').onclick=()=>{
      const preserved=Object.fromEntries(new FormData(form));
      openDialog('Eliminar usuario del grupo',`<div class="dialog-content"><h3>${esc(member.name)}</h3><p>Se quitará de esta clase si todavía no terminó y de todas las próximas clases de <strong>${esc(cls.name)}</strong>.</p><p>Sus asistencias anteriores y las inscripciones en otros grupos se conservan.</p></div><footer class="dialog-footer"><button class="button" id="cancel-remove" type="button">Volver</button><button class="button danger" id="confirm-remove">Eliminar usuario</button></footer>`);
      document.getElementById('cancel-remove').onclick=()=>studentActions(cls,member,preserved);
      document.getElementById('confirm-remove').onclick=async()=>{try{if(LIVE)await LIVE.removeEnrollment(cls,member.id);else M.removeEnrollment(store,cls,member.id);closeDialog();renderStudents(cls);notify('Alumno quitado de las próximas clases de este grupo.');}catch(error){notify(error.message);}};
    };
    form.onsubmit=async event=>{
      event.preventDefault();const data=new FormData(form),quantity=Number(data.get('quantity')),product=store.products.find(item=>item.id===Number(data.get('product')));
      if(!product||!Number.isInteger(quantity)||quantity<1||(!LIVE&&quantity>product.stock)){const error=document.getElementById('sale-error');error.textContent='Revisá la cantidad disponible.';error.hidden=false;return;}
      if(LIVE){if(form.dataset.saving)return;form.dataset.saving='true';try{const result=await LIVE.deliver(cls,member,product,quantity,data.get('professor'));closeDialog();notify(result.queued?'Entrega pendiente de sincronización.':'Entrega enviada a recepción.');}catch(error){const target=document.getElementById('sale-error');target.textContent=error.message;target.hidden=false;}finally{delete form.dataset.saving;}return;}
      product.stock-=quantity;store.deliveries.push({productId:product.id,quantity,memberId:member.id,professor:data.get('professor'),status:'pending',classId:cls.id});
      closeDialog();notify('Entrega simulada. Todavía no se envía a recepción.');
    };
  }
  window.addEventListener('hashchange',()=>{if(dialog.open)closeDialog();const cls=currentClass();if(cls)selectedDate=cls.date;render();main.focus({preventScroll:true});});
  const fullscreenButton=document.getElementById('fullscreen-toggle');
  const updateFullscreen=()=>{const active=Boolean(document.fullscreenElement);fullscreenButton.textContent=active?'Salir de pantalla completa':'Pantalla completa';fullscreenButton.setAttribute('aria-pressed',String(active));};
  fullscreenButton.addEventListener('click',async()=>{
    try{
      if(document.fullscreenElement)await document.exitFullscreen();
      else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen({navigationUI:'hide'});
      else notify('Este navegador no admite pantalla completa. Probá con Chrome en la tablet.');
    }catch{notify('No se pudo activar pantalla completa. Volvé a tocar el botón.');}
  });
  document.addEventListener('fullscreenchange',updateFullscreen);
  updateFullscreen();
  if(LIVE)startLive();else render();
})();
