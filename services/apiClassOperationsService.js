function mapClass(x){if(!x)return null;return{id:x.id,nombre:x.name,fecha:x.date,hora:String(x.time).slice(0,8),duracionMinutos:x.durationMinutes,capacidad:x.capacity,profesor:x.professor,profesorProgramado:x.professor,profesorId:x.professorId,profesorProgramadoId:x.professorId,localId:x.locationId,localNombre:x.locationName,notas:x.notes,estado:x.status,inscriptos:x.enrolled,programacionId:x.scheduleId||null,esPrueba:x.isTrial===true};}
function mapRecord(x){return{id:x.id,nombre:x.name,fecha:x.date,hora:String(x.time).slice(0,8),duracionMinutos:x.durationMinutes,capacidad:x.capacity,localId:x.locationId,localNombre:x.locationName,profesorProgramado:x.professor,profesorProgramadoId:x.professorId,estado:x.status,inicioRealTs:x.actualStartUtc,finRealTs:x.actualEndUtc,programacionId:x.scheduleId,inscriptos:x.enrolled,presentes:x.present,esPrueba:x.isTrial===true};}
function nowParts(){const d=new Date(),p=n=>String(n).padStart(2,'0');return{date:`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`,time:`${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`};}
function createApiClassOperationsService({apiClient}){
 return {
  listLocations:async()=>[
   {id:1,codigo:'local-1',nombre:'Local 1',tipo:'recepcion',activo:1},
   {id:2,codigo:'local-2',nombre:'Local 2',tipo:'salon',activo:1},
  ],
  transferStock:async()=>{throw new Error('Las transferencias de stock ya no se utilizan');},
  listStock:async()=>(await apiClient.listProducts()).map(p=>({productoId:p.id,nombre:p.nombre,precio:p.precio,activo:p.activo,local1:p.availableLocal1!==false?1:0,local2:p.availableLocal2!==false?1:0,asignadoLocal2:p.availableLocal2!==false?1:0})),
  listPendingSales:()=>apiClient.listPendingSales(),
  getPendingSummaryByDate:fecha=>apiClient.getPendingSalesSummary(fecha),
  createPendingSale:p=>apiClient.createPendingSale({productoId:Number(p.productoId),usuarioCi:String(p.usuarioCi),cantidad:Number(p.cantidad||1),profesorSesionId:Number(p.profesorSesionId),localId:p.localId?Number(p.localId):null,observacion:p.observacion||null,idempotencyKey:p.idempotencyKey||null}),
  collectPendingSale:async p=>{const x=await apiClient.collectPendingSale(Number(p.id),{formaPago:p.formaPago||'efectivo',observacion:p.observacion||null,idempotencyKey:p.idempotencyKey||null});return{saleId:x.saleId,movement:x.movement};},
  listUpcomingClasses:async from=>(await apiClient.listClasses(from)).map(mapClass),
  createClass:async p=>p.diasSemana!==undefined
   ?apiClient.createClassSchedule({name:p.nombre,locationId:Number(p.localId||2),professorId:Number(p.profesorId),professor:p.profesor,weekdays:p.diasSemana,time:p.hora,durationMinutes:Number(p.duracionMinutos||60),capacity:Number(p.capacidad||12),startsOn:p.fechaInicio,endsOn:p.fechaFin||null,notes:p.notas||null})
   :mapClass(await apiClient.createClass({name:p.nombre,date:p.fecha,time:p.hora,durationMinutes:Number(p.duracionMinutos||60),capacity:Number(p.capacidad||12),professor:p.profesor,professorId:p.profesorId?Number(p.profesorId):null,locationId:Number(p.localId||2),notes:p.notas||null})),
  setClassTrial:async p=>{const x=await apiClient.setClassTrial(Number(p.claseId),Boolean(p.esPrueba));return{classId:x.classId,esPrueba:x.isTrial};},
  removeEnrollment:async({classId,userCi})=>apiClient.removeClassMember(classId,String(userCi)),
  deleteClass:id=>apiClient.deleteClass(id),
  listClassEnrollments:async id=>(await apiClient.listClassEnrollments(id)).map(x=>({id:x.id,claseId:x.classId,programacionId:x.scheduleId,usuarioCi:x.memberIdentityNumber,usuarioNombre:x.memberName,estado:x.status,creadoTs:x.createdAtUtc})),
  enrollMember:async({classId,userCi})=>{const x=await apiClient.enrollClassMember(classId,String(userCi));return{id:x.id,classId:x.classId,programacionId:x.scheduleId,userCi:x.memberIdentityNumber,userName:x.memberName};},
  getCurrentClass:async p=>{const now=nowParts();const x=await apiClient.getCurrentClass({locationId:Number(p.localId||1),date:p.fecha||now.date,time:p.hora||now.time});return{localId:x.locationId,fecha:x.date,hora:x.time,clase:mapClass(x.class),requiereSeleccion:x.requiresSelection,candidatas:x.candidates.map(mapClass),proxima:mapClass(x.next)};},
  registerClassAttendance:async p=>{const x=await apiClient.registerClassAttendance({identityNumber:String(p.ci||p.usuarioCi),professorSessionId:Number(p.profesorSesionId),deviceId:p.dispositivoId,locationId:Number(p.localId),classId:p.claseId?Number(p.claseId):null,date:p.fecha||null,time:p.hora||null,idempotencyKey:p.idempotencyKey||null});if(!x.registered)return{registered:false,reason:x.reason,...x.selection};return{registered:true,reason:'attendance_registered',user:{ci:x.memberIdentityNumber,nombre:x.memberName},class:mapClass(x.class),attendance:{id:x.attendanceId,ingresoId:x.entryId,claseId:x.class.id,claseNombre:x.class.name,usuarioCi:x.memberIdentityNumber}};},
  listClassRecordsByDate:async fecha=>(await apiClient.listClassRecords(fecha)).map(mapRecord),
  getClassRecordDetail:async id=>{const x=await apiClient.getClassRecord(id);return{...mapRecord(x.class),canRemoveEnrollment:x.class.status==='programada',canDeleteClass:true,students:x.students.map(s=>({usuarioCi:s.identityNumber,usuarioNombre:s.memberName,presente:s.present,horaIngreso:s.entryTime?String(s.entryTime).slice(0,8):null,dispositivoId:s.deviceId||null,asistenciaId:s.attendanceId||null,puntuacion:s.performanceRating||null,puntuadoPorProfesorId:s.ratedByProfessorId||null,puntuadoTs:s.ratedAtUtc||null}))};},
  setClassHeldStatus:async p=>{const x=await apiClient.setClassHeldStatus(p.claseId,Boolean(p.realizada));return{classId:x.classId,estado:x.status,realizada:x.held};},
  setClassPerformanceRating:async p=>{const x=await apiClient.setClassPerformanceRating(p.asistenciaId,{score:Number(p.puntuacion),professorId:Number(p.profesorId),professorSessionId:p.profesorSesionId?Number(p.profesorSesionId):null,deviceId:p.dispositivoId||null});return{asistenciaId:x.attendanceId,claseId:x.classId,usuarioCi:x.memberIdentityNumber,puntuacion:x.score,profesorId:x.professorId,puntuadoTs:x.ratedAtUtc};},
  correctClassAttendance:async p=>{const x=await apiClient.correctClassAttendance(Number(p.claseId),{identityNumber:String(p.usuarioCi),present:Boolean(p.presente),professorId:Number(p.profesorId),reason:p.motivo});return{claseId:x.classId,usuarioCi:x.memberIdentityNumber,presente:x.present,asistenciaId:x.attendanceId,ingresoId:x.entryId};},
 };
}
module.exports={createApiClassOperationsService};
