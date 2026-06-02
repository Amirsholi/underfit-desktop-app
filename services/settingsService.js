function createSettingsService({ settingsRepository }) {
  function normalizePrice(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error('Monto invalido');
    }
    return Math.round(amount);
  }

  function normalizeBoolean(value) {
    return value === true || value === 'true' || value === '1' || value === 1;
  }

  function normalizeText(value, fallback) {
    const text = String(value ?? '').trim();
    return text || fallback;
  }

  function normalizeDate(value, fallback = '') {
    const text = String(value ?? '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : fallback;
  }

  async function getSettings() {
    const settings = await settingsRepository.findAll();
    return {
      precioInscripcion: normalizePrice(settings.precio_inscripcion || 0),
      precioMembresiaMensual: normalizePrice(settings.precio_membresia_mensual || 0),
      precioMembresiaTrimestral: normalizePrice(settings.precio_membresia_trimestral || 0),
      precioMembresiaSemestral: normalizePrice(settings.precio_membresia_semestral || 0),
      eventoRunningActivo: normalizeBoolean(settings.evento_running_activo),
      eventoRunningNombre: normalizeText(settings.evento_running_nombre, 'UNDER RUNNING'),
      eventoRunningDistancias: normalizeText(settings.evento_running_distancias, '3KM & 5KM'),
      eventoRunningFecha: normalizeDate(settings.evento_running_fecha, '2026-05-24'),
    };
  }

  async function saveSettings({
    precioInscripcion,
    precioMembresiaMensual,
    precioMembresiaTrimestral,
    precioMembresiaSemestral,
    eventoRunningActivo,
    eventoRunningNombre,
    eventoRunningDistancias,
    eventoRunningFecha,
  }) {
    const normalized = {
      precio_inscripcion: normalizePrice(precioInscripcion ?? 0),
      precio_membresia_mensual: normalizePrice(precioMembresiaMensual ?? 0),
      precio_membresia_trimestral: normalizePrice(precioMembresiaTrimestral ?? 0),
      precio_membresia_semestral: normalizePrice(precioMembresiaSemestral ?? 0),
      evento_running_activo: normalizeBoolean(eventoRunningActivo),
      evento_running_nombre: normalizeText(eventoRunningNombre, 'UNDER RUNNING'),
      evento_running_distancias: normalizeText(eventoRunningDistancias, '3KM & 5KM'),
      evento_running_fecha: normalizeDate(eventoRunningFecha, '2026-05-24'),
    };
    await settingsRepository.upsertMany(normalized);
    return getSettings();
  }

  async function getMembershipPriceByType(type = 'mensual') {
    const settings = await getSettings();
    const prices = {
      mensual: settings.precioMembresiaMensual,
      trimestral: settings.precioMembresiaTrimestral,
      semestral: settings.precioMembresiaSemestral,
    };
    return prices[type] ?? prices.mensual;
  }

  async function getMembershipMonthlyPrice() {
    return getMembershipPriceByType('mensual');
  }

  async function getRegistrationPrice() {
    const settings = await getSettings();
    return settings.precioInscripcion;
  }

  return {
    getSettings,
    saveSettings,
    getMembershipPriceByType,
    getMembershipMonthlyPrice,
    getRegistrationPrice,
  };
}

module.exports = { createSettingsService };
