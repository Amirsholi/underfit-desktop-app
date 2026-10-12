function mapProfessor(p) {
  return { id:p.id,nombre:p.name,activo:p.active,pinConfigurado:p.pinConfigured,creadoTs:p.createdAtUtc,actualizadoTs:p.updatedAtUtc };
}
function mapSession(s) {
  if(!s)return null;
  return { id:s.id,profesorId:s.professorId,profesorNombre:s.professorName,localId:s.locationId,dispositivoId:s.deviceId,inicioTs:s.startedAtUtc,estado:s.status };
}
function createApiStaffService({apiClient}) {
 return {
  listProfessors:async all=>(await apiClient.listProfessors(all)).map(mapProfessor),
  createProfessor:async p=>mapProfessor(await apiClient.createProfessor({name:p.nombre})),
  updateProfessor:async(id,p)=>mapProfessor(await apiClient.updateProfessor(id,{name:p.nombre,pin:p.pin||null,active:p.activo})),
  startSession:async p=>mapSession(await apiClient.startProfessorSession({professorId:Number(p.profesorId),pin:p.pin,locationId:Number(p.localId||2),deviceId:p.dispositivoId||'tablet-local-2'})),
  getActiveSession:async d=>mapSession(await apiClient.getCurrentProfessorSession(d||'tablet-local-2')),
  finishSession:async id=>{const r=await apiClient.finishProfessorSession(id);return{changed:r.changed,id:r.id};},
  resolveIdentity:async p=>{
   if(p.profesorSesionId){const s=mapSession(await apiClient.getCurrentProfessorSession(p.dispositivoId||'tablet-local-2'));if(!s||Number(s.id)!==Number(p.profesorSesionId))throw new Error('La sesion del profesor no esta activa');return{profesorId:s.profesorId,profesorSesionId:s.id,profesorNombre:s.profesorNombre,localId:s.localId,dispositivoId:s.dispositivoId};}
   const rows=(await apiClient.listProfessors(false));const x=rows.find(v=>Number(v.id)===Number(p.profesorId));if(!x)throw new Error('Profesor no disponible');return{profesorId:x.id,profesorSesionId:null,profesorNombre:x.name};
  },
 };
}
module.exports={createApiStaffService};
