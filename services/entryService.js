function createEntryService({ userRepository, entryRepository, membershipRules }) {
  function buildAccessResult(usuario) {
    if (!usuario) {
      return {
        allowed: false,
        reason: 'not_found',
        user: null,
        daysRemaining: 0,
        entryRegistered: false,
      };
    }

    const daysRemaining = membershipRules.daysRemaining(usuario.fecha_vencimiento);
    const allowed = membershipRules.isMembershipActive(usuario.fecha_vencimiento);

    return {
      allowed,
      reason: allowed ? 'active' : 'expired',
      user: {
        ci: usuario.ci,
        nombre: usuario.nombre,
      },
      daysRemaining,
      entryRegistered: false,
    };
  }

  function nowLocalParts() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return {
      fecha: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      hora: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
      ts: d.toISOString(),
    };
  }

  async function validateAndRegisterEntry({ ci, fuente = 'kiosk', observacion = null }) {
    const usuario = await userRepository.findByCi(ci);
    const resultado = buildAccessResult(usuario);

    if (!resultado.allowed) {
      return resultado;
    }

    const ingreso = await entryRepository.create({
      ci: usuario.ci,
      fuente,
      observacion,
      ...nowLocalParts(),
    });

    return {
      ...resultado,
      entryRegistered: true,
      entryId: ingreso.id,
      entry: ingreso,
    };
  }

  function listEntriesByDateRange({ desde, hasta }) {
    return entryRepository.findByDateRange({ desde, hasta });
  }

  async function annulEntry({ id, motivo }) {
    const entryId = Number(id);
    const reason = String(motivo || '').trim();
    if (!Number.isInteger(entryId) || entryId <= 0) throw new Error('Ingreso invalido');
    if (!reason) throw new Error('El motivo de la anulacion es obligatorio');

    const entry = await entryRepository.findById(entryId);
    if (!entry || Number(entry.anulado || 0) === 1) throw new Error('Ingreso no encontrado');
    const now = nowLocalParts();
    if (entry.fecha !== now.fecha) throw new Error('Solo se pueden anular ingresos del dia actual');
    const result = await entryRepository.annul({ id: entryId, ts: now.ts, motivo: reason });
    if (!result.changed) throw new Error('El ingreso ya fue anulado');
    return { annulled: true, id: entryId };
  }

  return {
    validateAndRegisterEntry,
    listEntriesByDateRange,
    annulEntry,
  };
}

module.exports = { createEntryService };
