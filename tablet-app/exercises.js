window.TabletExercises=(()=>{
  const M=window.TabletModel;
  const exercises=window.TabletLive?window.TabletLive.exercises:[
    ['Sentadilla','Piernas','squat','Mantené el apoyo de todo el pie y un descenso controlado.'],
    ['Peso muerto','Piernas','deadlift','Llevá la cadera hacia atrás sin perder una posición estable de la espalda.'],
    ['Press de pecho','Pecho','press','Controlá el recorrido, sin rebotes.'],
    ['Remo','Espalda','row','Acercá los codos al cuerpo y evitá el impulso.'],
    ['Plancha','Core','plank','Mantené el tronco alineado y seguí respirando.'],
    ['Zancadas','Piernas','lunge','Descendé con control y mantené estable el apoyo delantero.'],
  ].map(([name,muscleGroup,asset,instructions],i)=>({id:i+1,name,muscleGroup,instructions,media:`/exercises/${asset}.gif`,kind:'image'}));
  let query='',group='',ctx;
  const groupLabel=value=>{const clean=String(value).trim().replace(/\s+/g,' ').toLocaleLowerCase('es');return clean?clean[0].toLocaleUpperCase('es')+clean.slice(1):'';};
  const groups=()=>[...new Map(exercises.map(item=>[M.normalize(item.muscleGroup),groupLabel(item.muscleGroup)])).values()].sort((a,b)=>a.localeCompare(b,'es'));
  const mediaHTML=(exercise,controls=false)=>exercise.media?(exercise.kind==='video'?`<video src="${ctx.esc(exercise.media)}" muted playsinline preload="metadata" ${controls?'controls autoplay':''} aria-label="Demostración de ${ctx.esc(exercise.name)}"></video>`:`<img src="${ctx.esc(exercise.media)}" alt="Demostración de ${ctx.esc(exercise.name)}" loading="lazy">`):'<span class="no-exercise-media"><i class="icon dumbbell" aria-hidden="true"></i><span>Sin demostración</span></span>';
  function limitVideos(root){root.querySelectorAll('video').forEach(video=>{video.addEventListener('timeupdate',()=>{if(video.currentTime>=15){video.pause();video.currentTime=0;}});});}
  function render(context){
    ctx=context;const {main,esc}=ctx;
    main.classList.add('exercise-page');
    main.innerHTML=`<header class="exercise-heading"><div><h1>Ejercicios</h1><p>${exercises.length} en la biblioteca</p></div><input id="exercise-search" type="search" aria-label="Buscar ejercicio o grupo muscular" placeholder="Buscar ejercicio" value="${esc(query)}"><button id="exercise-new" class="button primary">＋ Crear ejercicio</button></header><div class="exercise-groups" role="group" aria-label="Grupos musculares"><button data-group="" aria-pressed="${!group}">Todos</button>${groups().map(label=>`<button data-group="${esc(M.normalize(label))}" aria-pressed="${group===M.normalize(label)}">${esc(label)}</button>`).join('')}</div><section class="exercise-list" aria-label="Biblioteca de ejercicios"></section>`;
    document.getElementById('exercise-search').oninput=event=>{query=event.target.value;renderList();};
    main.querySelectorAll('[data-group]').forEach(button=>{button.onclick=()=>{group=button.dataset.group;main.querySelectorAll('[data-group]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));renderList();};});
    document.getElementById('exercise-new').onclick=()=>editor();renderList();
  }
  function renderList(){
    const {main,esc}=ctx,items=exercises.filter(item=>(!group||M.normalize(item.muscleGroup)===group)&&M.normalize(`${item.name} ${item.muscleGroup}`).includes(M.normalize(query)));
    main.querySelector('.exercise-list').innerHTML=items.map(item=>`<button class="exercise-card" data-exercise="${item.id}" aria-label="Editar ejercicio ${esc(item.name)}"><span class="exercise-thumb">${mediaHTML(item)}</span><span class="exercise-caption"><strong>${esc(item.name)}</strong><small>${esc(groupLabel(item.muscleGroup))}</small></span><span class="exercise-card-edit">Editar</span></button>`).join('')||'<div class="empty"><h2>No encontramos ejercicios</h2><p>Probá otro nombre o grupo muscular.</p></div>';
    main.querySelectorAll('[data-exercise]').forEach(button=>{button.onclick=()=>editor(exercises.find(item=>item.id===Number(button.dataset.exercise)));});
  }
  function view(exercise){
    const {openDialog,esc,dialog}=ctx;
    openDialog(exercise.name,`<div class="dialog-content exercise-view"><div class="exercise-preview">${mediaHTML(exercise,true)}</div><div class="exercise-view-copy"><span class="exercise-group-label">${esc(groupLabel(exercise.muscleGroup))}</span><h3>Técnica</h3><p>${esc(exercise.instructions||'Sin indicaciones adicionales.')}</p></div></div><footer class="dialog-footer"><button class="button" data-dismiss>Volver</button><button id="exercise-edit" class="button primary">Editar ejercicio</button></footer>`);
    dialog.dataset.kind='exercise';limitVideos(dialog);document.getElementById('exercise-edit').onclick=()=>editor(exercise);
  }
  function editor(exercise=null){
    const {openDialog,closeDialog,notify,esc,dialog}=ctx;
    let media=exercise?.media||'',kind=exercise?.kind||'image',draftURL=null,committed=false,mediaReady=true,pendingFile=null;
    openDialog(exercise?'Editar ejercicio':'Crear ejercicio',`<form id="exercise-form"><div class="dialog-content exercise-editor"><div class="exercise-fields"><label class="field">Nombre del ejercicio<input name="name" required maxlength="120" autocomplete="off" placeholder="Ej. Press de banca" value="${esc(exercise?.name||'')}"></label><div class="field muscle-field"><label for="muscle-input">Grupo muscular</label><div class="muscle-combobox"><input id="muscle-input" name="muscle" required maxlength="80" autocomplete="off" role="combobox" aria-expanded="false" aria-autocomplete="list" aria-controls="muscle-options" placeholder="Elegí o escribí un grupo" value="${esc(exercise?.muscleGroup||'')}"><button type="button" id="muscle-toggle" aria-label="Mostrar grupos musculares" aria-expanded="false">⌄</button></div><div id="muscle-options" class="muscle-options" role="listbox" aria-label="Grupos musculares" hidden></div></div><label class="field">Técnica <span class="field-optional">Opcional</span><textarea name="instructions" rows="5" maxlength="2000" placeholder="Cómo realizar el movimiento y qué tener en cuenta">${esc(exercise?.instructions||'')}</textarea></label></div><div class="exercise-media"><span class="field">Demostración <span class="field-optional">Opcional</span></span><div id="exercise-preview" class="exercise-preview"></div><div class="exercise-upload-actions"><button type="button" class="button" id="exercise-record">Grabar video</button><button type="button" class="button" id="exercise-file">Elegir archivo</button></div><button type="button" id="exercise-clear-media" class="text-danger" ${media?'':'hidden'}>Quitar demostración</button><input id="exercise-upload" type="file" accept="video/mp4,video/webm,video/quicktime,video/x-m4v,image/gif,.mov,.m4v" hidden><input id="exercise-capture" type="file" accept="video/*" capture="environment" hidden><small>Vista 1:1 · recorte centrado · primeros 15 s</small><p id="exercise-media-status" class="notice" role="status"></p></div><p id="exercise-error" class="form-error" role="alert" hidden></p></div><footer class="dialog-footer"><button class="button" type="button" data-dismiss>Cancelar</button><button id="exercise-save" class="button primary">Guardar ejercicio</button></footer></form>`);
    dialog.dataset.kind='exercise';
    const form=document.getElementById('exercise-form'),preview=document.getElementById('exercise-preview'),error=document.getElementById('exercise-error'),save=document.getElementById('exercise-save');
    function fail(message){error.textContent=message;error.hidden=false;}
    function showPreview(){preview.innerHTML=mediaHTML({name:exercise?.name||'nuevo ejercicio',media,kind},true);limitVideos(preview);document.getElementById('exercise-clear-media').hidden=!media;}
    showPreview();
    const muscle=document.getElementById('muscle-input'),menu=document.getElementById('muscle-options'),toggle=document.getElementById('muscle-toggle');
    function hideGroups(){menu.hidden=true;muscle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-expanded','false');}
    function showGroups(all=false){
      const labels=groups().filter(label=>all||M.normalize(label).includes(M.normalize(muscle.value)));
      menu.innerHTML=labels.map(label=>`<button type="button" role="option" aria-selected="${M.normalize(label)===M.normalize(muscle.value)}">${esc(label)}</button>`).join('');
      menu.hidden=!labels.length;muscle.setAttribute('aria-expanded',String(Boolean(labels.length)));toggle.setAttribute('aria-expanded',String(Boolean(labels.length)));
      menu.querySelectorAll('button').forEach(button=>{button.onclick=()=>{muscle.value=button.textContent;hideGroups();muscle.focus();};});
    }
    muscle.oninput=()=>showGroups();toggle.onclick=()=>menu.hidden?showGroups(true):hideGroups();
    form.addEventListener('click',event=>{if(!event.target.closest('.muscle-field'))hideGroups();});
    form.addEventListener('focusin',event=>{if(!event.target.closest('.muscle-field'))hideGroups();});
    form.addEventListener('keydown',event=>{if(event.key==='Escape'&&!menu.hidden){event.preventDefault();event.stopPropagation();hideGroups();muscle.focus();}else if(event.key==='ArrowDown'&&event.target===muscle){event.preventDefault();showGroups();menu.querySelector('button')?.focus();}});
    menu.onkeydown=event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();const items=[...menu.querySelectorAll('button')],i=items.indexOf(document.activeElement);items[(i+(event.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();}};
    document.getElementById('exercise-file').onclick=()=>document.getElementById('exercise-upload').click();
    document.getElementById('exercise-record').onclick=()=>document.getElementById('exercise-capture').click();
    function loadFile(event){
      const file=event.target.files?.[0];if(!file)return;
      if(!file.size||file.size>80*1024*1024)return fail('El archivo debe pesar menos de 80 MB.');
      if(!/\.(mp4|webm|mov|m4v|gif)$/i.test(file.name)&&!file.type.startsWith('video/'))return fail('Elegí un video MP4, MOV, M4V, WebM o un GIF.');
      pendingFile=file;if(draftURL)URL.revokeObjectURL(draftURL);draftURL=URL.createObjectURL(file);media=draftURL;kind=/\.gif$/i.test(file.name)?'image':'video';mediaReady=false;save.disabled=true;error.hidden=true;showPreview();
      const player=preview.querySelector('video,img');
      const ready=()=>{mediaReady=true;save.disabled=false;document.getElementById('exercise-media-status').textContent=(window.TabletLive?'El video se subirá al guardar.':'Vista previa local. El original no se modifica en esta prueba.');};
      player.addEventListener(kind==='video'?'loadedmetadata':'load',ready,{once:true});
      player.addEventListener('error',()=>{mediaReady=false;save.disabled=false;fail('La tablet no puede reproducir este archivo. Probá con MP4 o quitá la demostración.');},{once:true});
    }
    document.getElementById('exercise-upload').onchange=loadFile;document.getElementById('exercise-capture').onchange=loadFile;
    document.getElementById('exercise-clear-media').onclick=()=>{if(draftURL)URL.revokeObjectURL(draftURL);draftURL=null;pendingFile=null;media='';mediaReady=true;save.disabled=false;error.hidden=true;document.getElementById('exercise-media-status').textContent='';showPreview();};
    form.onsubmit=async event=>{
      event.preventDefault();const data=new FormData(form),name=data.get('name').trim(),muscleGroup=groupLabel(data.get('muscle'));
      if(!name||!muscleGroup)return fail('Completá el nombre y el grupo muscular.');
      if(!mediaReady)return fail('Revisá la demostración antes de guardar.');
      if(exercise?.media?.startsWith('blob:')&&exercise.media!==media)URL.revokeObjectURL(exercise.media);
      const values={name,muscleGroup,instructions:data.get('instructions').trim(),media,kind};
      if(window.TabletLive){save.disabled=true;try{await window.TabletLive.saveExercise(exercise,values,pendingFile);}catch(error){save.disabled=false;return fail(error.message);}}else if(exercise)Object.assign(exercise,values);else exercises.push({...values,id:Date.now()});
      if(window.TabletLive&&draftURL){URL.revokeObjectURL(draftURL);draftURL=null;}
      committed=true;query='';group='';closeDialog();render(ctx);notify(window.TabletLive?'Ejercicio guardado.':'Ejercicio guardado en esta prueba.');
    };
    dialog.addEventListener('close',()=>{if(!committed&&draftURL)URL.revokeObjectURL(draftURL);},{once:true});
  }
  return {render,items:()=>exercises};
})();
