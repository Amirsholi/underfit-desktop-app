class UnderFitApiError extends Error {
  constructor(message, { status = null, code = null } = {}) {
    super(message);
    this.name = 'UnderFitApiError';
    this.status = status;
    this.code = code;
  }
}

function newIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.()
    || require('node:crypto').randomUUID();
}

function createUnderFitApiClient({
  baseUrl,
  deviceKey,
  fetchImpl = globalThis.fetch,
  timeoutMs = 5000,
}) {
  const normalizedBaseUrl = String(baseUrl || '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(normalizedBaseUrl)) {
    throw new Error('UNDERFIT_API_BASE_URL debe ser una URL HTTP o HTTPS valida');
  }
  if (typeof fetchImpl !== 'function') {
    throw new Error('El runtime actual no ofrece fetch para conectar con UnderFit API');
  }

  async function request(path, options = {}) {
    const { idempotent, idempotencyKey, ...fetchOptions } = options;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(`${normalizedBaseUrl}${path}`, {
        ...fetchOptions,
        headers: {
          accept: 'application/json',
          'x-underfit-device-key': String(deviceKey || ''),
          ...(idempotent
            ? { 'idempotency-key': idempotencyKey || newIdempotencyKey() }
            : {}),
          ...(options.body && !(options.body instanceof FormData)
            ? { 'content-type': 'application/json' }
            : {}),
          ...options.headers,
        },
        signal: controller.signal,
      });

      const contentType = response.headers?.get?.('content-type') || '';
      const body = contentType.includes('json')
        ? await response.json()
        : null;
      if (!response.ok) {
        throw new UnderFitApiError(
          body?.title || `UnderFit API respondio con HTTP ${response.status}`,
          {
            status: response.status,
            code: body?.code || body?.extensions?.code || null,
          }
        );
      }

      return body;
    } catch (error) {
      if (error instanceof UnderFitApiError) throw error;
      if (error?.name === 'AbortError') {
        throw new UnderFitApiError('UnderFit API no respondio dentro del tiempo esperado', {
          code: 'api.timeout',
        });
      }
      throw new UnderFitApiError(`No se pudo conectar con UnderFit API: ${error?.message || error}`, {
        code: 'api.unavailable',
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    createTabletPairingCode: deviceId => request(`/api/v1/admin/tablets/${encodeURIComponent(deviceId)}/pairing-code`, { method: 'POST' }),
    listMembers: () => request('/api/v1/members/'),
    getMember: identityNumber =>
      request(`/api/v1/members/by-identity/${encodeURIComponent(identityNumber)}`),
    createMember: payload =>
      request('/api/v1/members/', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    updateMember: (identityNumber, payload) =>
      request(`/api/v1/members/by-identity/${encodeURIComponent(identityNumber)}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    deleteMember: identityNumber =>
      request(`/api/v1/members/by-identity/${encodeURIComponent(identityNumber)}`, {
        method: 'DELETE',
      }),
    configureMemberMobileAccess: (identityNumber, password) =>
      request(`/api/v1/members/by-identity/${encodeURIComponent(identityNumber)}/mobile-access`, {
        method: 'PUT',
        body: JSON.stringify({ password }),
      }),
    listMembershipRenewals: identityNumber =>
      request(`/api/v1/members/by-identity/${encodeURIComponent(identityNumber)}/renewals`),
    renewMembership: (identityNumber, payload) =>
      request(`/api/v1/members/by-identity/${encodeURIComponent(identityNumber)}/renewals`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    openCashSession: payload =>
      request('/api/v1/cash-sessions', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    getCurrentCashSession: () => request('/api/v1/cash-sessions/current'),
    closeCurrentCashSession: payload =>
      request('/api/v1/cash-sessions/current/close', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    getCashClosure: businessDate =>
      request(`/api/v1/cash-sessions/by-date/${encodeURIComponent(businessDate)}/closure`),
    getCashSummary: businessDate =>
      request(`/api/v1/cash-sessions/by-date/${encodeURIComponent(businessDate)}/summary`),
    getCashDailyReport: businessDate =>
      request(`/api/v1/cash-sessions/by-date/${encodeURIComponent(businessDate)}/report`),
    createManualCashIncome: payload =>
      request('/api/v1/cash-movements/manual-income', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    createCashOutput: payload =>
      request('/api/v1/cash-movements/outputs', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    adjustCashTotal: payload =>
      request('/api/v1/cash-movements/adjustments', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    correctCashMovement: (movementId, payload) =>
      request(`/api/v1/cash-movements/${encodeURIComponent(movementId)}/corrections`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    registerEntry: payload =>
      request('/api/v1/entries', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    listLatestEntries: () => request('/api/v1/entries/latest'),
    listEntries: ({ from, to, identityNumber } = {}) => {
      const query = new URLSearchParams();
      if (identityNumber) query.set('identityNumber', identityNumber);
      if (from) query.set('from', from);
      if (to) query.set('to', to);
      // Electron 25 embeds Node 18.15, which has no URLSearchParams.size.
      const encoded = query.toString();
      const suffix = encoded ? `?${encoded}` : '';
      return request(`/api/v1/entries${suffix}`);
    },
    annulEntry: (entryId, reason) =>
      request(`/api/v1/entries/${encodeURIComponent(entryId)}/annulment`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    listProfessors: includeInactive =>
      request(`/api/v1/staff/?includeInactive=${includeInactive === true}`),
    createProfessor: payload => request('/api/v1/staff/', { method: 'POST', body: JSON.stringify(payload) }),
    updateProfessor: (id, payload) => request(`/api/v1/staff/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    startProfessorSession: payload => request('/api/v1/staff/sessions', { method: 'POST', body: JSON.stringify(payload) }),
    getCurrentProfessorSession: deviceId =>
      request(`/api/v1/staff/sessions/current?deviceId=${encodeURIComponent(deviceId)}`),
    finishProfessorSession: id =>
      request(`/api/v1/staff/sessions/${id}/finish`, { method: 'POST' }),
    listClasses: from => request(`/api/v1/classes/agenda?from=${encodeURIComponent(from)}`),
    createClass: payload => request('/api/v1/classes/', { method: 'POST', body: JSON.stringify(payload) }),
    createClassSchedule: payload => request('/api/v1/classes/schedules', { method: 'POST', body: JSON.stringify(payload) }),
    listClassEnrollments: id => request(`/api/v1/classes/${id}/enrollments`),
    enrollClassMember: (id, identityNumber) =>
      request(`/api/v1/classes/${id}/enrollments`, { method: 'POST', body: JSON.stringify({ identityNumber }) }),
    removeClassMember: (id, identityNumber) =>
      request(`/api/v1/classes/${id}/enrollments/${encodeURIComponent(identityNumber)}`, { method: 'DELETE' }),
    deleteClass: id => request(`/api/v1/classes/${id}`, { method: 'DELETE' }),
    getCurrentClass: ({ locationId, date, time }) =>
      request(`/api/v1/classes/current?locationId=${locationId}&date=${date}&time=${encodeURIComponent(time)}`),
    registerClassAttendance: payload =>
      request('/api/v1/classes/attendance', {
        method: 'POST',
        body: JSON.stringify(payload),
        idempotent: true,
        idempotencyKey: payload?.idempotencyKey,
      }),
    listClassRecords: date => request(`/api/v1/classes/records?date=${encodeURIComponent(date)}`),
    getClassRecord: id => request(`/api/v1/classes/${id}/record`),
    setClassHeldStatus: (id, held) =>
      request(`/api/v1/classes/${id}/held-status`, { method: 'PUT', body: JSON.stringify({ held }) }),
    setClassTrial: (id, isTrial) =>
      request(`/api/v1/classes/${id}/trial`, { method: 'PUT', body: JSON.stringify({ isTrial }) }),
    setClassPerformanceRating: (attendanceId, payload) =>
      request(`/api/v1/classes/attendances/${encodeURIComponent(attendanceId)}/rating`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    correctClassAttendance: (classId, payload) =>
      request(`/api/v1/classes/${classId}/attendance-correction`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    listProducts: () => request('/api/v1/products/'),
    createProduct: payload =>
      request('/api/v1/products/', { method: 'POST', body: JSON.stringify(payload) }),
    updateProduct: (id, payload) =>
      request(`/api/v1/products/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    deleteProduct: id =>
      request(`/api/v1/products/${id}`, { method: 'DELETE' }),
    sellProduct: (id, payload) =>
      request(`/api/v1/products/${id}/sales`, { method: 'POST', body: JSON.stringify(payload) }),
    listProductSales: date =>
      request(`/api/v1/products/sales/by-date/${encodeURIComponent(date)}`),
    getProductSalesTotal: date =>
      request(`/api/v1/products/sales/by-date/${encodeURIComponent(date)}/total`),
    listPendingSales: () => request('/api/v1/products/pending-sales'),
    getPendingSalesSummary: date =>
      request(`/api/v1/products/pending-sales/summary/${encodeURIComponent(date)}`),
    createPendingSale: payload =>
      request('/api/v1/products/pending-sales', {
        method: 'POST',
        body: JSON.stringify(payload),
        idempotent: true,
        idempotencyKey: payload?.idempotencyKey,
      }),
    collectPendingSale: (id, payload) =>
      request(`/api/v1/products/pending-sales/${id}/collection`, {
        method: 'POST',
        body: JSON.stringify(payload),
        idempotent: true,
        idempotencyKey: payload?.idempotencyKey,
      }),
    getMembershipPrices: () => request('/api/v1/settings/membership-prices'),
    updateMembershipPrices: payload =>
      request('/api/v1/settings/membership-prices', {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    getBusinessSettings: () => request('/api/v1/settings/business/'),
    updateBusinessSettings: payload =>
      request('/api/v1/settings/business/', {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    listExercises: (includeInactive = false) =>
      request(`/api/v1/admin/training/exercises?includeInactive=${includeInactive === true}`),
    createExercise: payload =>
      request('/api/v1/admin/training/exercises', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    updateExercise: (id, payload) =>
      request(`/api/v1/admin/training/exercises/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    assignWorkoutPlan: (identityNumber, payload) =>
      request(`/api/v1/admin/members/${encodeURIComponent(identityNumber)}/workout-plan`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    listWorkoutTemplates: () =>
      request('/api/v1/admin/training/templates'),
    listMemberWorkoutPlans: () =>
      request('/api/v1/admin/training/member-plans'),
    saveWorkoutTemplate: payload =>
      request('/api/v1/admin/training/templates', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    uploadExerciseVideo: async file => {
      const form = new FormData();
      form.append('file', file, file.name || 'exercise.mp4');
      return request('/api/v1/admin/training/media', {
        method: 'POST',
        body: form,
      });
    },
  };
}

module.exports = { UnderFitApiError, createUnderFitApiClient };
