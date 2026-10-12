const test = require('node:test');
const assert = require('node:assert/strict');
const { createSettingsService } = require('../services/settingsService');
const { createApiSettingsService } = require('../services/apiSettingsService');
const { buildConfig } = require('../underRunningEvent');

test('event title, subtitle, legend and date persist locally and reach the kiosk', async () => {
  const data = {};
  const service = createSettingsService({ settingsRepository: {
    findAll: async () => data, upsertMany: async values => Object.assign(data, values),
  }});
  assert.equal((await service.getSettings()).eventoRunningLeyenda, 'ya falta menos');
  const event = { eventoRunningActivo: true, eventoRunningNombre: 'Encuentro Under Fit', eventoRunningDistancias: 'Para toda la familia', eventoRunningFecha: '2026-12-12', eventoRunningLeyenda: '¡Te esperamos!' };
  const saved = await service.saveSettings(event);
  assert.equal(saved.eventoRunningLeyenda, event.eventoRunningLeyenda);
  const config = buildConfig(saved);
  assert.equal(config.eventName, event.eventoRunningNombre);
  assert.equal(config.distances, event.eventoRunningDistancias);
  assert.equal(config.legend, event.eventoRunningLeyenda);
  assert.equal(config.targetDate.getDate(), 12);
  delete event.eventoRunningLeyenda;
  assert.equal((await service.saveSettings(event)).eventoRunningLeyenda, '¡Te esperamos!');
});

test('API settings adapter forwards the event legend', async () => {
  let business;
  const service = createApiSettingsService({apiClient:{
    updateMembershipPrices: async () => {}, updateBusinessSettings: async value => { business=value; },
    getBusinessSettings: async () => business, getMembershipPrices: async () => ({}),
  }});
  const saved = await service.saveSettings({ eventoRunningLeyenda: 'Listos para correr', eventoRunningNombre: 'Carrera', eventoRunningDistancias: '5 km', eventoRunningFecha: '2026-12-12' });
  assert.equal(saved.eventoRunningLeyenda, 'Listos para correr');
});
