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

  return {
    validateAndRegisterEntry,
    listEntriesByDateRange,
  };
}

module.exports = { createEntryService };
