const test = require('node:test');
const assert = require('node:assert/strict');
const { createStaffService } = require('../services/staffService');

function createFakeRepository() {
  const professors = [];
  const sessions = [];
  return {
    listProfessors: async ({ includeInactive }) => professors.filter(item => includeInactive || item.activo === 1),
    findProfessorById: async id => professors.find(item => item.id === id) || null,
    createProfessor: async data => {
      const professor = { id: professors.length + 1, activo: 1, ...data };
      professors.push(professor);
      return professor;
    },
    updateProfessor: async data => {
      const professor = professors.find(item => item.id === data.id);
      Object.assign(professor, data, { activo: data.activo ? 1 : 0 });
      return professor;
    },
    closeProfessorSessions: async (professorId, finishedTs) => {
      sessions.filter(item => item.profesorId === professorId && item.estado === 'activa')
        .forEach(item => Object.assign(item, { estado: 'cerrada', finTs: finishedTs }));
      return { changed: 1 };
    },
    startProfessorSession: async data => {
      sessions.filter(item => item.dispositivoId === data.deviceId && item.estado === 'activa')
        .forEach(item => { item.estado = 'cerrada'; });
      const professor = professors.find(item => item.id === data.professorId);
      const session = {
        id: sessions.length + 1,
        profesorId: data.professorId,
        profesorNombre: professor.nombre,
        localId: data.localId,
        dispositivoId: data.deviceId,
        inicioTs: data.startedTs,
        estado: 'activa',
      };
      sessions.push(session);
      return session;
    },
    findActiveSessionById: async id => sessions.find(item => item.id === id && item.estado === 'activa') || null,
    findActiveSessionByDevice: async deviceId => sessions.find(item => item.dispositivoId === deviceId && item.estado === 'activa') || null,
    finishProfessorSession: async ({ id }) => {
      const session = sessions.find(item => item.id === id && item.estado === 'activa');
      if (!session) return { changed: false, id };
      session.estado = 'cerrada';
      return { changed: true, id };
    },
  };
}

test('professor PIN opens a traceable tablet session without exposing credentials', async () => {
  const service = createStaffService({ staffRepository: createFakeRepository() });
  const professor = await service.createProfessor({ nombre: 'Valentina Suárez', pin: '0427' });

  assert.equal(professor.nombre, 'Valentina Suárez');
  assert.equal(professor.pinConfigurado, true);
  assert.equal(Object.hasOwn(professor, 'pinHash'), false);

  await assert.rejects(
    service.startSession({ profesorId: professor.id, pin: '1111', dispositivoId: 'tablet-local-2' }),
    /PIN incorrecto/,
  );

  const session = await service.startSession({
    profesorId: professor.id,
    pin: '0427',
    localId: 2,
    dispositivoId: 'tablet-local-2',
  });
  const identity = await service.resolveIdentity({ profesorSesionId: session.id });

  assert.deepEqual(identity, {
    profesorId: professor.id,
    profesorSesionId: session.id,
    profesorNombre: 'Valentina Suárez',
    localId: 2,
    dispositivoId: 'tablet-local-2',
  });
});

test('deactivating a professor prevents future tablet sessions', async () => {
  const service = createStaffService({ staffRepository: createFakeRepository() });
  const professor = await service.createProfessor({ nombre: 'Santiago Lima', pin: '1234' });

  await service.updateProfessor(professor.id, { activo: false });

  await assert.rejects(
    service.startSession({ profesorId: professor.id, pin: '1234' }),
    /Profesor no disponible/,
  );
});
