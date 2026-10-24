const LOCATION_NAMES = {
  1: 'Recepcion principal',
  2: 'Salon funcional',
};

function localParts(value) {
  const date = new Date(value);
  const pad = number => String(number).padStart(2, '0');
  return {
    fecha: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    hora: `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
    ts: value,
  };
}

function mapEntry(entry) {
  return {
    id: entry.id,
    fecha: entry.date,
    hora: String(entry.time || '').slice(0, 8),
    ci: entry.identityNumber,
    nombre: entry.memberName,
    fuente: entry.source,
    observacion: entry.observation || null,
    localId: entry.locationId,
    localNombre: LOCATION_NAMES[entry.locationId] || null,
    dispositivoId: entry.deviceId || null,
    claseId: entry.classId || null,
    claseNombre: null,
  };
}

function createApiEntryService({ apiClient }) {
  return {
    async validateAndRegisterEntry({
      ci,
      fuente = 'kiosk',
      observacion = null,
      localId = 1,
      dispositivoId = null,
      claseId = null,
    }) {
      try {
        const registered = await apiClient.registerEntry({
          identityNumber: String(ci || '').trim(),
          source: fuente,
          deviceId: dispositivoId,
          occurredAtUtc: null,
          observation: observacion,
          locationId: Number(localId || 1),
          classId: claseId === null || claseId === undefined ? null : Number(claseId),
        });
        const parts = localParts(registered.occurredAtUtc);
        return {
          allowed: true,
          reason: 'active',
          user: { ci: String(ci), nombre: registered.memberName },
          daysRemaining: registered.daysRemaining,
          entryRegistered: true,
          entryId: registered.entryId,
          entry: {
            id: registered.entryId,
            ...parts,
            localId: Number(localId || 1),
            dispositivoId: dispositivoId,
            claseId: claseId,
          },
        };
      } catch (error) {
        if (error?.code === 'access.member_not_found') {
          return {
            allowed: false,
            reason: 'not_found',
            user: null,
            daysRemaining: 0,
            entryRegistered: false,
          };
        }
        if (error?.code === 'access.membership_expired') {
          const member = await apiClient.getMember(String(ci));
          return {
            allowed: false,
            reason: 'expired',
            user: { ci: member.identityNumber, nombre: member.name },
            daysRemaining: 0,
            entryRegistered: false,
          };
        }
        throw error;
      }
    },
    listLatestEntries: () => apiClient.listLatestEntries(),
    async listEntriesByDateRange({ desde, hasta, socioCi }) {
      const entries = await apiClient.listEntries({ from: desde, to: hasta, identityNumber: socioCi });
      return entries.map(mapEntry);
    },
    async annulEntry({ id, motivo }) {
      const result = await apiClient.annulEntry(id, String(motivo || '').trim());
      return { annulled: result.annulled, id: result.id };
    },
  };
}

module.exports = { createApiEntryService, mapEntry };
