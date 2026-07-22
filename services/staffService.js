const crypto = require('node:crypto');

function createStaffService({ staffRepository }) {
  function normalizeId(value, fieldName = 'Profesor') {
    const normalized = Number.parseInt(value, 10);
    if (!Number.isInteger(normalized) || normalized <= 0) throw new Error(`${fieldName} invalido`);
    return normalized;
  }

  function normalizeName(value) {
    const normalized = String(value || '').trim().replace(/\s+/g, ' ');
    if (normalized.length < 2) throw new Error('Ingresa el nombre del profesor');
    if (normalized.length > 80) throw new Error('El nombre del profesor es demasiado largo');
    return normalized;
  }

  function normalizePin(value, { optional = false } = {}) {
    const normalized = String(value || '').trim();
    if (optional && !normalized) return null;
    if (!/^\d{4}$/.test(normalized)) throw new Error('El PIN debe tener exactamente 4 numeros');
    return normalized;
  }

  function hashPin(pin, salt = crypto.randomBytes(16).toString('hex')) {
    return {
      pinSalt: salt,
      pinHash: crypto.scryptSync(pin, salt, 32).toString('hex'),
    };
  }

  function verifyPin(pin, professor) {
    if (!professor?.pinHash || !professor?.pinSalt) return false;
    const expected = Buffer.from(professor.pinHash, 'hex');
    const actual = Buffer.from(hashPin(pin, professor.pinSalt).pinHash, 'hex');
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  }

  function sanitizeProfessor(professor) {
    if (!professor) return null;
    return {
      id: professor.id,
      nombre: professor.nombre,
      activo: Number(professor.activo) === 1,
      pinConfigurado: Boolean(professor.pinConfigurado ?? (professor.pinHash && professor.pinSalt)),
      creadoTs: professor.creadoTs,
      actualizadoTs: professor.actualizadoTs,
    };
  }

  async function listProfessors(includeInactive = false) {
    const rows = await staffRepository.listProfessors({ includeInactive: includeInactive === true });
    return rows.map(sanitizeProfessor);
  }

  async function createProfessor(payload = {}) {
    const pin = normalizePin(payload.pin);
    const credentials = hashPin(pin);
    const now = new Date().toISOString();
    const professor = await staffRepository.createProfessor({
      nombre: normalizeName(payload.nombre),
      ...credentials,
      creadoTs: now,
      actualizadoTs: now,
    });
    return sanitizeProfessor(professor);
  }

  async function updateProfessor(id, payload = {}) {
    const professorId = normalizeId(id);
    const current = await staffRepository.findProfessorById(professorId);
    if (!current) throw new Error('Profesor no encontrado');

    const nextPin = normalizePin(payload.pin, { optional: true });
    const credentials = nextPin ? hashPin(nextPin) : { pinHash: current.pinHash, pinSalt: current.pinSalt };
    const active = payload.activo === undefined ? Number(current.activo) === 1 : payload.activo === true;
    const updated = await staffRepository.updateProfessor({
      id: professorId,
      nombre: payload.nombre === undefined ? current.nombre : normalizeName(payload.nombre),
      ...credentials,
      activo: active,
      actualizadoTs: new Date().toISOString(),
    });
    if (!active) await staffRepository.closeProfessorSessions(professorId, new Date().toISOString());
    return sanitizeProfessor(updated);
  }

  async function startSession(payload = {}) {
    const professorId = normalizeId(payload.profesorId);
    const professor = await staffRepository.findProfessorById(professorId);
    if (!professor || Number(professor.activo) !== 1) throw new Error('Profesor no disponible');
    const pin = normalizePin(payload.pin);
    if (!verifyPin(pin, professor)) throw new Error('PIN incorrecto');

    const localId = normalizeId(payload.localId || 2, 'Local');
    const deviceId = String(payload.dispositivoId || 'tablet-local-2').trim();
    if (!deviceId) throw new Error('Dispositivo invalido');
    return staffRepository.startProfessorSession({
      professorId,
      localId,
      deviceId,
      startedTs: new Date().toISOString(),
    });
  }

  function getActiveSession(deviceId = 'tablet-local-2') {
    return staffRepository.findActiveSessionByDevice(String(deviceId || 'tablet-local-2').trim());
  }

  async function finishSession(id) {
    const result = await staffRepository.finishProfessorSession({
      id: normalizeId(id, 'Sesion'),
      finishedTs: new Date().toISOString(),
    });
    if (!result.changed) throw new Error('La sesion ya estaba cerrada');
    return result;
  }

  async function resolveIdentity(payload = {}) {
    if (payload.profesorSesionId) {
      const session = await staffRepository.findActiveSessionById(normalizeId(payload.profesorSesionId, 'Sesion'));
      if (!session) throw new Error('La sesion del profesor no esta activa');
      return {
        profesorId: session.profesorId,
        profesorSesionId: session.id,
        profesorNombre: session.profesorNombre,
      };
    }

    if (payload.profesorId) {
      const professor = await staffRepository.findProfessorById(normalizeId(payload.profesorId));
      if (!professor || Number(professor.activo) !== 1) throw new Error('Profesor no disponible');
      return { profesorId: professor.id, profesorSesionId: null, profesorNombre: professor.nombre };
    }

    const legacyName = String(payload.profesor || '').trim();
    if (!legacyName) throw new Error('Profesor obligatorio');
    return { profesorId: null, profesorSesionId: null, profesorNombre: legacyName };
  }

  return {
    listProfessors,
    createProfessor,
    updateProfessor,
    startSession,
    getActiveSession,
    finishSession,
    resolveIdentity,
  };
}

module.exports = { createStaffService };
