const test = require('node:test');
const assert = require('node:assert/strict');
const { createApiUserService } = require('../services/apiUserService');
const { createApiMembershipService } = require('../services/apiMembershipService');
const { createApiCashService } = require('../services/apiCashService');
const { createApiSettingsService } = require('../services/apiSettingsService');
const { createApiEntryService } = require('../services/apiEntryService');
const { createApiStaffService } = require('../services/apiStaffService');
const { createApiClassOperationsService } = require('../services/apiClassOperationsService');
const { createUnderFitApiClient, UnderFitApiError } = require('../clients/underFitApiClient');
const { resolveDataSourceMode } = require('../services/dataSourceMode');

test('API user service maps Electron member fields without changing the renderer contract', async () => {
  const calls = [];
  const apiClient = {
    async createMember(payload) {
      calls.push(payload);
      return {
        id: 'member-id',
        identityNumber: payload.identityNumber,
        name: payload.name,
        phone: payload.phone,
        email: payload.email,
        currentMembershipPlan: payload.plan,
        membershipExpiresOn: '2026-10-25',
        createdAtUtc: '2026-07-27T12:00:00+00:00',
        updatedAtUtc: '2026-07-27T12:00:00+00:00',
        daysRemaining: 90,
      };
    },
    async listMembers() {
      return [];
    },
  };
  const service = createApiUserService({ apiClient, clock: () => '2026-07-27' });

  const result = await service.createUser({
    ci: '01234567',
    nombre: 'Socio API',
    numero: '099123456',
    email: 'socio@example.com',
    tipoMembresia: 'trimestral',
  });

  assert.deepEqual(calls, [{
    identityNumber: '01234567',
    name: 'Socio API',
    plan: 90,
    startsOn: '2026-07-27',
    phone: '099123456',
    email: 'socio@example.com',
    details: null,
    emergencyContactName: null,
    emergencyContactPhone: null,
    imageUseAuthorized: false,
    birthDate: null,
    address: null,
    emergencyRelationship: null,
    medicalCondition: null,
    goal: null,
    registrationPaymentMethod: null,
    paymentPreference: null,
  }]);
  assert.equal(result.success, true);
  assert.equal(result.user.ci, '01234567');
  assert.equal(result.user.tipo_membresia, 'trimestral');
  assert.equal(result.user.fecha_vencimiento, '2026-10-25');
});

test('API client preserves normalized problem details from ASP.NET Core', async () => {
  const client = createUnderFitApiClient({
    baseUrl: 'http://localhost:5187/',
    fetchImpl: async () => ({
      ok: false,
      status: 409,
      headers: { get: () => 'application/problem+json' },
      json: async () => ({
        title: 'A member with that identity number already exists.',
        code: 'member.identity_conflict',
      }),
    }),
  });

  await assert.rejects(
    client.createMember({ identityNumber: '123' }),
    error =>
      error instanceof UnderFitApiError &&
      error.status === 409 &&
      error.code === 'member.identity_conflict'
  );
});

test('API user service maps administrative edits and manual remaining days', async () => {
  let updateCall;
  const apiClient = {
    async updateMember(identityNumber, payload) {
      updateCall = { identityNumber, payload };
      return {
        id: 'member-id',
        identityNumber,
        name: payload.name,
        phone: payload.phone,
        email: payload.email,
        currentMembershipPlan: payload.plan,
        membershipExpiresOn: '2026-08-08',
        createdAtUtc: '2026-07-01T12:00:00+00:00',
        updatedAtUtc: '2026-07-27T12:00:00+00:00',
        daysRemaining: payload.daysRemaining,
      };
    },
  };
  const service = createApiUserService({ apiClient });

  const result = await service.saveAdminManualEdit('01234567', {
    nombre: 'Socio Editado',
    tipoMembresia: 'semestral',
    diasRestantes: 12,
    numero: '099999999',
    email: 'editado@example.com',
  });

  assert.equal(updateCall.identityNumber, '01234567');
  assert.equal(updateCall.payload.plan, 180);
  assert.equal(updateCall.payload.daysRemaining, 12);
  assert.equal(result.success, true);
  assert.equal(result.user.tipo_membresia, 'semestral');
});

test('API user service resets mobile access through administration', async () => {
  const calls = [];
  const service = createApiUserService({
    apiClient: {
      configureMemberMobileAccess: async (identityNumber, password) => {
        calls.push({ identityNumber, password });
      },
    },
  });

  const result = await service.resetMobileAccess('12345678', 'NuevaClave2026');

  assert.deepEqual(calls, [{
    identityNumber: '12345678',
    password: 'NuevaClave2026',
  }]);
  assert.deepEqual(result, { success: true });
});

test('data source remains local unless API mode is explicitly enabled', () => {
  assert.deepEqual(resolveDataSourceMode({}), {
    mode: 'local',
    apiBaseUrl: 'http://127.0.0.1:5187',
    deviceKey: 'underfit-development-device-key-change-me',
  });
  assert.deepEqual(resolveDataSourceMode({
    UNDERFIT_DATA_MODE: 'api',
    UNDERFIT_API_BASE_URL: 'http://server:5187',
    UNDERFIT_DEVICE_KEY: 'trusted-gym-device-key',
  }), {
    mode: 'api',
    apiBaseUrl: 'http://server:5187',
    deviceKey: 'trusted-gym-device-key',
  });
});

test('API client authenticates the trusted gym device without a visible login', async () => {
  let request;
  const apiClient = createUnderFitApiClient({
    baseUrl: 'http://127.0.0.1:5187',
    deviceKey: 'trusted-gym-device-key',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => [],
      };
    },
  });

  await apiClient.listMembers();

  assert.equal(request.url, 'http://127.0.0.1:5187/api/v1/members/');
  assert.equal(request.options.headers['x-underfit-device-key'], 'trusted-gym-device-key');
});

test('API client adds an idempotency key to tablet operations', async () => {
  let request;
  const apiClient = createUnderFitApiClient({
    baseUrl: 'http://127.0.0.1:5187',
    deviceKey: 'trusted-gym-device-key',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ registered: true }),
      };
    },
  });

  await apiClient.registerClassAttendance({
    identityNumber: '12345678',
    idempotencyKey: 'same-operation-123',
  });

  assert.equal(request.options.headers['idempotency-key'], 'same-operation-123');
});

test('API membership service preserves the existing renewal result contract', async () => {
  let renewalCall;
  const apiClient = {
    async renewMembership(identityNumber, payload) {
      renewalCall = { identityNumber, payload };
      return {
        member: {
          id: 'member-id',
          identityNumber,
          name: 'Socio Renovado',
          currentMembershipPlan: payload.plan,
          membershipExpiresOn: '2026-10-25',
          createdAtUtc: '2026-01-01T12:00:00+00:00',
          updatedAtUtc: '2026-07-27T12:00:00+00:00',
          daysRemaining: 90,
        },
        renewal: {
          id: 'renewal-id',
          memberId: 'member-id',
          memberIdentityNumber: identityNumber,
          memberName: 'Socio Renovado',
          plan: payload.plan,
          daysAdded: 90,
          paidOn: payload.paidOn,
          paidAtUtc: '2026-07-27T12:00:00+00:00',
          amount: 1500,
          paymentMethod: payload.paymentMethod,
          previousExpiration: '2026-07-27',
          newExpiration: '2026-10-25',
          cashSessionId: 'session-id',
          cashMovementId: 'movement-id',
        },
      };
    },
  };
  const service = createApiMembershipService({
    apiClient,
    clock: () => '2026-07-27',
  });

  const result = await service.renewMembership({
    ci: '01234567',
    tipo: 'trimestral',
    formaPago: 'transferencia',
  });

  assert.deepEqual(renewalCall, {
    identityNumber: '01234567',
    payload: {
      plan: 90,
      paidOn: '2026-07-27',
      paymentMethod: 'transferencia',
    },
  });
  assert.equal(result.success, true);
  assert.equal(result.membershipType, 'trimestral');
  assert.equal(result.movimientoCaja.id, 'movement-id');
  assert.equal(result.pagoMembresia.monto, 1500);
});

test('API cash service preserves the Electron opening contract', async () => {
  let payload;
  const service = createApiCashService({
    apiClient: {
      async openCashSession(value) {
        payload = value;
        return {
          id: 'cash-id',
          businessDate: value.businessDate,
          cashier: value.cashier,
          openingCash: value.openingCash,
          openedAtUtc: '2026-07-27T12:30:00Z',
          status: 'open',
        };
      },
    },
  });

  const opening = await service.openDay({
    fecha: '2026-07-27',
    montoInicialEfectivo: '500',
    cajeroApertura: 'Ana',
  });

  assert.deepEqual(payload, {
    businessDate: '2026-07-27',
    cashier: 'Ana',
    openingCash: 500,
    note: null,
  });
  assert.equal(opening.fecha, '2026-07-27');
  assert.equal(opening.cajero_apertura, 'Ana');
  assert.equal(opening.monto_inicial_efectivo, 500);
  assert.equal(opening.estado, 'abierta');
});

test('API cash service preserves closure totals and cash difference', async () => {
  let payload;
  const closure = {
    id: 'cash-id',
    businessDate: '2026-07-27',
    openingCashier: 'Ana',
    openingCash: 500,
    openedAtUtc: '2026-07-27T12:00:00Z',
    closingCashier: 'Bea',
    closedAtUtc: '2026-07-27T22:00:00Z',
    totalIncome: 1500,
    movementCount: 1,
    totalCash: 0,
    totalTransfer: 1500,
    expectedCash: 500,
    countedCash: 490,
    cashDifference: -10,
    note: 'Faltante',
    status: 'closed',
  };
  const service = createApiCashService({
    apiClient: {
      async closeCurrentCashSession(value) {
        payload = value;
        return closure;
      },
      async getCashClosure() {
        return closure;
      },
      async getCashDailyReport() {
        return { sessions: [await this.getCashSummary()] };
      },
      async getCashSummary() {
        return {
          businessDate: '2026-07-27',
          opening: {
            id: 'cash-id',
            businessDate: '2026-07-27',
            cashier: 'Ana',
            openingCash: 500,
            openedAtUtc: '2026-07-27T12:00:00Z',
            status: 'closed',
          },
          closure,
          movements: [{
            id: 'movement-id',
            cashSessionId: 'cash-id',
            businessDate: '2026-07-27',
            type: 'renovacion',
            paymentMethod: 'transferencia',
            amount: 1500,
            description: 'Renovacion',
            memberIdentityNumber: '123',
            memberName: 'Socio',
            occurredAtUtc: '2026-07-27T13:00:00Z',
          }],
          totalIncome: 1500,
          movementCount: 1,
          totalsByPaymentMethod: [{ key: 'transferencia', total: 1500 }],
          totalsByType: [{ key: 'renovacion', total: 1500 }],
          expectedCash: 500,
          status: 'cerrada',
        };
      },
    },
  });

  const result = await service.closeDay({
    fecha: '2026-07-27',
    efectivoContado: '490',
    observacion: 'Faltante',
    cajeroCierre: 'Bea',
  });

  assert.deepEqual(payload, {
    businessDate: '2026-07-27',
    countedCash: 490,
    note: 'Faltante',
    closingCashier: 'Bea',
  });
  assert.equal(result.efectivo_esperado, 500);
  assert.equal(result.efectivo_contado, 490);
  assert.equal(result.diferencia_efectivo, -10);
  assert.equal(result.estado, 'cerrada');
  assert.deepEqual(await service.getClosureByDate('2026-07-27'), result);
  const summary = await service.getDailySummary('2026-07-27');
  assert.equal(summary.totalIngresos, 1500);
  assert.equal(summary.efectivoEsperado, 500);
  assert.equal(summary.totalPorFormaPago[0].formaPago, 'transferencia');
  assert.equal((await service.listMovementsByDate('2026-07-27'))[0].tipo_ingreso, 'renovacion');
});

test('API settings service stores prices and event settings in PostgreSQL', async () => {
  let apiPrices;
  let apiBusiness = {
    eventoRunningActivo: true,
    eventoRunningNombre: 'UNDER RUNNING',
    eventoRunningDistancias: '3KM & 5KM',
    eventoRunningFecha: '2026-05-24',
  };
  const apiClient = {
    async getMembershipPrices() {
      return apiPrices || { registration: 300, monthly: 900, quarterly: 2400, semiannual: 4200 };
    },
    async updateMembershipPrices(prices) {
      apiPrices = prices;
    },
    async getBusinessSettings() {
      return apiBusiness;
    },
    async updateBusinessSettings(settings) {
      apiBusiness = settings;
    },
  };
  const service = createApiSettingsService({ apiClient });

  const saved = await service.saveSettings({
    precioInscripcion: 300,
    precioMembresiaMensual: 1000,
    precioMembresiaTrimestral: 2700,
    precioMembresiaSemestral: 4800,
    eventoRunningActivo: false,
    eventoRunningNombre: 'Carrera Under Fit',
    eventoRunningDistancias: '5KM',
    eventoRunningFecha: '2026-09-20',
  });

  assert.deepEqual(apiPrices, {
    registration: 300,
    monthly: 1000,
    quarterly: 2700,
    semiannual: 4800,
  });
  assert.equal(apiBusiness.eventoRunningActivo, false);
  assert.equal(apiBusiness.eventoRunningNombre, 'Carrera Under Fit');
  assert.equal(saved.precioMembresiaMensual, 1000);
  assert.equal(saved.precioInscripcion, 300);
});

test('API cash manual operations preserve the legacy request and response contracts', async () => {
  const calls = [];
  const movement = {
    id: 'movement-id',
    cashSessionId: 'cash-id',
    businessDate: '2026-07-27',
    type: 'egreso',
    paymentMethod: 'transferencia',
    amount: -250,
    description: 'Proveedor',
    note: 'Proveedor',
    occurredAtUtc: '2026-07-27T14:00:00Z',
    correctionOfId: null,
    correctionReason: null,
  };
  const service = createApiCashService({
    apiClient: {
      async createManualCashIncome(payload) {
        calls.push(['income', payload]);
        return { ...movement, type: 'ingreso_manual', amount: 300 };
      },
      async createCashOutput(payload) {
        calls.push(['output', payload]);
        return movement;
      },
      async adjustCashTotal(payload) {
        calls.push(['adjust', payload]);
        return { applied: true, previousTotal: 50, newTotal: 100, difference: 50 };
      },
      async correctCashMovement(id, payload) {
        calls.push(['correct', id, payload]);
        return { corrected: true, originalId: id, replacementId: 'replacement-id' };
      },
    },
  });

  const income = await service.registerManualIncome({
    fecha: '2026-07-27',
    monto: 300,
    formaPago: 'efectivo',
    observacion: 'Cambio',
  });
  const output = await service.registerCashOutput({
    fecha: '2026-07-27',
    monto: 250,
    formaPago: 'transferencia',
    observacion: 'Proveedor',
  });
  const adjustment = await service.adjustDailyTotal('2026-07-27', 100, 'Conteo');
  const correction = await service.correctMovement({
    id: 'movement-id',
    monto: 200,
    formaPago: 'efectivo',
    observacion: 'Proveedor corregido',
    motivo: 'Importe incorrecto',
  });

  assert.equal(income.tipo_ingreso, 'ingreso_manual');
  assert.equal(output.monto, -250);
  assert.equal(output.forma_pago, 'transferencia');
  assert.deepEqual(adjustment, {
    applied: true,
    previousTotal: 50,
    newTotal: 100,
    difference: 50,
  });
  assert.deepEqual(correction, {
    corrected: true,
    originalId: 'movement-id',
    replacementId: 'replacement-id',
  });
  assert.deepEqual(calls[3], ['correct', 'movement-id', {
    amount: 200,
    paymentMethod: 'efectivo',
    note: 'Proveedor corregido',
    reason: 'Importe incorrecto',
  }]);
});

test('API cash report keeps the structure consumed by the existing PDF exporter', async () => {
  const service = createApiCashService({
    apiClient: {
      async getCashDailyReport() {
        return {
          businessDate: '2026-07-27',
          sessions: [{
            businessDate: '2026-07-27',
            opening: {
              id: 'cash-id',
              businessDate: '2026-07-27',
              cashier: 'Ana',
              openingCash: 500,
              openedAtUtc: '2026-07-27T12:00:00Z',
              status: 'closed',
              note: null,
            },
            closure: {
              id: 'cash-id',
              businessDate: '2026-07-27',
              openingCashier: 'Ana',
              openingCash: 500,
              openedAtUtc: '2026-07-27T12:00:00Z',
              closingCashier: 'Bea',
              closedAtUtc: '2026-07-27T22:00:00Z',
              totalIncome: 1200,
              movementCount: 2,
              totalCash: 300,
              totalTransfer: 900,
              expectedCash: 800,
              countedCash: 790,
              cashDifference: -10,
              note: 'Faltante',
              status: 'closed',
            },
            movements: [],
            totalIncome: 1200,
            movementCount: 2,
            totalsByPaymentMethod: [
              { key: 'efectivo', total: 300 },
              { key: 'transferencia', total: 900 },
            ],
            totalsByType: [
              { key: 'renovacion', total: 900 },
              { key: 'ingreso_manual', total: 300 },
            ],
            expectedCash: 800,
            status: 'cerrada',
          }],
        };
      },
    },
  });

  const report = await service.getDailyReport('2026-07-27');

  assert.equal(report.totalGeneral, 1200);
  assert.equal(report.totalesPorTipoIngreso.renovaciones, 900);
  assert.equal(report.totalesPorTipoIngreso.ingresosManuales, 300);
  assert.equal(report.totalesPorFormaPago.efectivo, 300);
  assert.equal(report.diferenciaCaja, -10);
  assert.deepEqual(report.ventasPendientes, []);
  assert.equal(report.sesiones[0].cajero_cierre, 'Bea');
});

test('API user service exposes registration movement and legacy deletion result', async () => {
  let deletedIdentity;
  const member = {
    id: 'member-id',
    identityNumber: '123',
    name: 'Socio',
    currentMembershipPlan: 30,
    membershipExpiresOn: '2026-08-26',
    createdAtUtc: '2026-07-27T12:00:00Z',
    updatedAtUtc: '2026-07-27T12:00:00Z',
  };
  const service = createApiUserService({
    apiClient: {
      async createMember() {
        return {
          member,
          cashMovement: {
            id: 'movement-id',
            cashSessionId: 'cash-id',
            businessDate: '2026-07-27',
            type: 'alta',
            paymentMethod: 'efectivo',
            amount: 300,
            description: 'Socio',
            memberIdentityNumber: '123',
            memberName: 'Socio',
            occurredAtUtc: '2026-07-27T12:00:00Z',
          },
        };
      },
      async deleteMember(identity) {
        deletedIdentity = identity;
        return { success: true, changes: 1 };
      },
    },
    clock: () => '2026-07-27',
  });

  const created = await service.createUser({ ci: '123', nombre: 'Socio' });
  const deleted = await service.deleteUser('123');

  assert.equal(created.movimientoCaja.tipo_ingreso, 'alta');
  assert.equal(created.movimientoCaja.monto, 300);
  assert.equal(deletedIdentity, '123');
  assert.deepEqual(deleted, { success: true, changes: 1 });
});

test('API entry service keeps allowed, denied, listing and annulment contracts', async () => {
  const apiClient = {
    async registerEntry(payload) {
      if (payload.identityNumber === 'missing') {
        const error = new Error('not found');
        error.code = 'access.member_not_found';
        throw error;
      }
      return {
        entryId: 'entry-id',
        memberName: 'Socio',
        daysRemaining: 12,
        occurredAtUtc: '2026-07-28T15:30:00Z',
      };
    },
    async listEntries() {
      return [{
        id: 'entry-id',
        date: '2026-07-28',
        time: '12:30:00',
        identityNumber: '123',
        memberName: 'Socio',
        source: 'kiosk',
        observation: null,
        locationId: 1,
        deviceId: 'tablet-1',
        classId: null,
      }];
    },
    async annulEntry(id, reason) {
      return { annulled: reason === 'Duplicado', id };
    },
  };
  const service = createApiEntryService({ apiClient });

  const allowed = await service.validateAndRegisterEntry({
    ci: '123',
    fuente: 'kiosk',
    localId: 1,
    dispositivoId: 'tablet-1',
  });
  const denied = await service.validateAndRegisterEntry({ ci: 'missing' });
  const listed = await service.listEntriesByDateRange({
    desde: '2026-07-28',
    hasta: '2026-07-28',
  });
  const annulled = await service.annulEntry({ id: 'entry-id', motivo: 'Duplicado' });

  assert.equal(allowed.allowed, true);
  assert.equal(allowed.entryRegistered, true);
  assert.equal(allowed.entryId, 'entry-id');
  assert.deepEqual(denied, {
    allowed: false,
    reason: 'not_found',
    user: null,
    daysRemaining: 0,
    entryRegistered: false,
  });
  assert.equal(listed[0].localNombre, 'Recepcion principal');
  assert.equal(listed[0].dispositivoId, 'tablet-1');
  assert.deepEqual(annulled, { annulled: true, id: 'entry-id' });
});

test('API staff and class adapters preserve Electron field names', async () => {
  const apiClient = {
    async listProfessors() { return [{ id:1,name:'Ana',active:true,pinConfigured:true,createdAtUtc:'a',updatedAtUtc:'b' }]; },
    async listClasses() { return [{ id:2,name:'Funcional',date:'2026-07-28',time:'18:00:00',durationMinutes:60,capacity:12,professor:'Ana',professorId:1,locationId:2,locationName:'Salon funcional',status:'programada',enrolled:3,scheduleId:4 }]; },
    async listClassEnrollments() { return [{id:'e',classId:2,scheduleId:4,memberIdentityNumber:'123',memberName:'Socio',status:'inscripto',createdAtUtc:'x'}]; },
    async listClassRecords() { return [{id:2,name:'Funcional',date:'2026-07-28',time:'18:00:00',durationMinutes:60,capacity:12,locationId:2,locationName:'Salon funcional',professor:'Ana',professorId:1,status:'dictada',enrolled:3,present:2}]; },
  };
  const staff = createApiStaffService({ apiClient });
  const classes = createApiClassOperationsService({ apiClient, localOperationsService:{} });
  const professors = await staff.listProfessors();
  const upcoming = await classes.listUpcomingClasses('2026-07-28');
  const enrolled = await classes.listClassEnrollments(2);
  const records = await classes.listClassRecordsByDate('2026-07-28');
  assert.deepEqual(professors[0], {id:1,nombre:'Ana',activo:true,pinConfigurado:true,creadoTs:'a',actualizadoTs:'b'});
  assert.equal(upcoming[0].nombre,'Funcional');
  assert.equal(upcoming[0].programacionId,4);
  assert.equal(enrolled[0].usuarioCi,'123');
  assert.equal(records[0].presentes,2);
});
