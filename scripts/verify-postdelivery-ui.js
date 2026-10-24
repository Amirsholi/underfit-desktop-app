const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(process.env.LOCALAPPDATA, 'UnderFitRehearsal', 'postdelivery-ui');
app.setPath('userData', path.join(root,'profile'));
app.whenReady().then(async () => {
  fs.mkdirSync(root,{recursive:true});
  const source=fs.readFileSync('index.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')
    .replace('<head>','<head><base href="file:///C:/GymApp/">');
  const html=path.join(root,'view.html');fs.writeFileSync(html,source);
  const win=new BrowserWindow({width:1280,height:900,show:false,webPreferences:{nodeIntegration:false,contextIsolation:true}});
  await win.loadFile(html);
  for(const file of ['classDetailModel.js','adminClassDetail.js','adminRecords.js','adminUsers.js'])
    await win.webContents.executeJavaScript(fs.readFileSync(file,'utf8')+'\n;void 0;');
  const result=await win.webContents.executeJavaScript(`(async()=>{
    const check=(value,message)=>{if(!value)throw Error(message);};
    const wait=()=>new Promise(r=>setTimeout(r,80));
    const people=[{ci:'1234',nombre:'Ana Prueba',fecha_vencimiento:'2027-01-01'},{ci:'5678',nombre:'Clara Prueba',fecha_vencimiento:'2020-01-01'}];
    const history=[{id:'c7b53eae-05a5-4d9f-a994-bb2a79ecee26',ci:'1234',nombre:'Ana Prueba',fecha:'2026-08-01',hora:'10:00',localId:1},{id:'244489c3-ad35-47b5-bf3d-6bb379b26b99',ci:'1234',nombre:'Ana Prueba',fecha:'2026-09-01',hora:'11:00',localId:2,claseId:1}];
    const record={id:1,nombre:'Clase de prueba',fecha:'2026-12-01',hora:'17:00',estado:'programada',capacidad:12,inscriptos:1,canRemoveEnrollment:true,canDeleteClass:true,students:[{usuarioCi:'1234',usuarioNombre:'Ana Prueba',presente:false}]};
    let removed=false,deleted=false;
    window.api={obtenerUsuarios:async()=>people,obtenerUltimosIngresos:async()=>[],obtenerIngresos:async(from,to,ci)=>ci?history:[],obtenerDetalleRegistroClase:async()=>record,
      quitarAlumnoClase:async()=>{removed=true;record.students=[];},eliminarClase:async()=>{deleted=true;}};
    const shared={mostrarNotificacion:()=>{},confirmarAccion:async()=>true,ordenarSociosPorVencimiento:x=>x,esMembresiaActiva:d=>d>'2026-10-12',calcularDiasRestantes:()=>1};
    const users=createAdminUsersController({shared});await users.init();
    document.getElementById('filtro-busqueda').value='Ana';document.getElementById('filtro-busqueda').dispatchEvent(new Event('input'));
    check(document.getElementById('users-filtered-count').textContent==='1 de 2 socios','Filtered count incorrect');
    const records=createAdminRecordsController({shared});records.init();
    document.dispatchEvent(new Event('admin-records:show'));await wait();
    document.getElementById('records-mode').value='member';document.getElementById('records-mode').dispatchEvent(new Event('change'));
    document.getElementById('records-member').value='1234';document.getElementById('records-member').dispatchEvent(new Event('change'));await wait();
    check(document.querySelectorAll('#records-entry-body tr').length===2,'Missing member history or class attendance');
    check(document.getElementById('records-entry-body').textContent.includes('2026-08-01'),'History date missing');
    check(document.getElementById('records-date').hidden,'Date filter should not restrict all-time history');
    return {history:true,filteredCount:true};
  })()`);
  fs.writeFileSync(path.join(root,'history.png'),(await win.webContents.capturePage()).toPNG());
  const classResult=await win.webContents.executeJavaScript(`(async()=>{
    document.getElementById('modal-concurrencia').style.display='none';
    const wait=()=>new Promise(r=>setTimeout(r,100));
    let removed=false,deleted=false;
    const detail={id:1,nombre:'Clase de prueba',fecha:'2026-12-01',hora:'17:00',estado:'programada',capacidad:12,inscriptos:1,canRemoveEnrollment:true,canDeleteClass:true,students:[{usuarioCi:'1234',usuarioNombre:'Ana Prueba',presente:false}]};
    window.api.obtenerDetalleRegistroClase=async()=>detail;
    window.api.quitarAlumnoClase=async()=>{removed=true;detail.students=[];};window.api.eliminarClase=async()=>{deleted=true;};
    const controller=createAdminClassDetailController({shared:{mostrarNotificacion:()=>{},confirmarAccion:async()=>true},showScreen:()=>{},onBack:()=>{}});
    await controller.show(detail);
    const remove=document.querySelector('[data-remove-student]');if(!remove)throw Error('Missing removal action');
    remove.click();document.getElementById('class-remove-confirm').click();await wait();
    if(!removed)throw Error('Removal did not reach API');
    document.getElementById('class-delete').click();await wait();if(!deleted)throw Error('Deletion did not reach API');
    return {removeEnrollment:true,deleteClass:true};
  })()`);
  await win.webContents.executeJavaScript(`window.exerciseDeleted=false;window.confirm=()=>true;
    window.api.obtenerEjercicios=async()=>window.exerciseDeleted?[]:[{id:71,name:'Ejercicio prueba',muscleGroup:'Espalda',isActive:true}];
    window.api.obtenerProfesores=async()=>[];window.api.obtenerPreRutinas=async()=>[];window.api.obtenerRutinasSocios=async()=>[];
    window.api.actualizarEjercicio=async(id,data)=>{if(id!==71||data.isActive!==false)throw Error('Invalid removal');window.exerciseDeleted=true;};void 0;`);
  for(const file of ['exerciseGroups.js','adminTraining.js'])
    await win.webContents.executeJavaScript(fs.readFileSync(file,'utf8')+'\n;void 0;');
  await win.webContents.executeJavaScript(`(async()=>{
    const wait=()=>new Promise(r=>setTimeout(r,100));
    document.dispatchEvent(new CustomEvent('admin-section:show',{detail:{section:'training'}}));await wait();
    document.getElementById('training-open-exercises').click();
    document.querySelector('[data-exercise-id="71"]').click();
    if(document.getElementById('exercise-delete').hidden)throw Error('Missing exercise deletion');
    document.getElementById('exercise-delete').click();await wait();
    if(!window.exerciseDeleted||document.querySelector('[data-exercise-id="71"]'))throw Error('Exercise not removed');
  })()`);
  fs.writeFileSync(path.join(root,'verification.json'),JSON.stringify({...result,...classResult,deleteExercise:true,verified:true},null,2));
  // Exercise the actual Electron event replay: the normal keyboard must not
  // be captured again by the numpad filter or duplicated in the focused field.
  const { EventEmitter } = require('node:events');
  const { PassThrough } = require('node:stream');
  const child = new EventEmitter(); child.stdout = new PassThrough(); child.kill = () => child.stdout.end();
  fs.writeFileSync(path.join(root,'usb-keypad.json'),JSON.stringify({device:'test-usb'}));
  const entryKeys=[];
  const reader=require('../services/usbKeypad').createUsbKeypad({app:{isPackaged:false,getPath:()=>root},
    BrowserWindow:{getFocusedWindow:()=>win},dialog:{},getEntryWindow:()=>({webContents:{send:(_channel,key)=>entryKeys.push(key)}}),
    spawnImpl:()=>child,executablePath:path.resolve('release/keypad/UnderFit.Keypad.exe')});
  reader.attach(win);reader.start();
  await win.webContents.executeJavaScript("document.body.innerHTML='<input id=keypad-test>';document.getElementById('keypad-test').focus();void 0;");
  win.webContents.focus();
  child.stdout.write(JSON.stringify({ready:true})+'\n');
  child.stdout.write(JSON.stringify({device:'keyboard',key:'4',digit:'4',down:true})+'\n');
  child.stdout.write(JSON.stringify({device:'test-usb',key:'7',digit:'7',down:true})+'\n');
  await new Promise(resolve=>setTimeout(resolve,100));
  const value=await win.webContents.executeJavaScript("document.getElementById('keypad-test').value");
  require('node:assert/strict').equal(value,'4');
  require('node:assert/strict').deepEqual(entryKeys,['7']);reader.stop();
  console.log('PASS: member history, filtered count, enrollment removal and class deletion in Electron.');
  win.destroy();app.quit();
}).catch(error=>{console.error(error);app.exit(1);});
