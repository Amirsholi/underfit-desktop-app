function createApiSettingsService({ apiClient }) {
  async function getSettings() {
    const [business, prices] = await Promise.all([
      apiClient.getBusinessSettings(),
      apiClient.getMembershipPrices(),
    ]);
    return {
      ...business,
      precioInscripcion: Number(prices.registration),
      precioMembresiaMensual: Number(prices.monthly),
      precioMembresiaTrimestral: Number(prices.quarterly),
      precioMembresiaSemestral: Number(prices.semiannual),
    };
  }

  async function saveSettings(settings) {
    await Promise.all([
      apiClient.updateMembershipPrices({
        registration: Number(settings.precioInscripcion),
        monthly: Number(settings.precioMembresiaMensual),
        quarterly: Number(settings.precioMembresiaTrimestral),
        semiannual: Number(settings.precioMembresiaSemestral),
      }),
      apiClient.updateBusinessSettings({
        eventoRunningActivo: settings.eventoRunningActivo === true,
        eventoRunningNombre: settings.eventoRunningNombre,
        eventoRunningDistancias: settings.eventoRunningDistancias,
        eventoRunningFecha: settings.eventoRunningFecha,
        eventoRunningLeyenda: settings.eventoRunningLeyenda,
      }),
    ]);
    return getSettings();
  }

  return {
    createTabletPairingCode: deviceId => apiClient.createTabletPairingCode(deviceId),
    getSettings,
    saveSettings,
    getMembershipPriceByType: async type => {
      const settings = await getSettings();
      return {
        mensual: settings.precioMembresiaMensual,
        trimestral: settings.precioMembresiaTrimestral,
        semestral: settings.precioMembresiaSemestral,
      }[type] ?? settings.precioMembresiaMensual;
    },
    getMembershipMonthlyPrice: async () => (await getSettings()).precioMembresiaMensual,
    getRegistrationPrice: async () => (await getSettings()).precioInscripcion,
  };
}

module.exports = { createApiSettingsService };
