(function(root) {
  'use strict';
  class ApiError extends Error {
    constructor(message, status = 0) { super(message); this.status = status; }
  }
  function operationKey() {
    if (root.crypto.randomUUID) return root.crypto.randomUUID();
    return Array.from(root.crypto.getRandomValues(new Uint8Array(24)), byte => byte.toString(16).padStart(2, '0')).join('');
  }
  function createClient({ fetchImpl = root.fetch?.bind(root), storage = root.localStorage,
    newKey = operationKey, onChange = () => {}, baseUrl = '/api/v1/tablet' } = {}) {
    const credentialKey = 'underfit.tablet.credentials.v1';
    const queueKey = 'underfit.tablet.queue.v1';
    const attemptsKey = 'underfit.tablet.attempts.v1';
    const read = (key, fallback) => { try { return JSON.parse(storage.getItem(key)) || fallback; } catch { return fallback; } };
    let credentials = read(credentialKey, null), queue = read(queueKey, []), flushing = null;
    const attempts = read(attemptsKey, {});
    function persist() { storage.setItem(queueKey, JSON.stringify(queue)); onChange(queue.slice()); }
    async function request(path, { method = 'GET', body, key } = {}) {
      if (!credentials) throw new ApiError('Vinculá esta tablet con el gimnasio.', 401);
      const headers = { 'X-UnderFit-Tablet-Id': credentials.id, 'X-UnderFit-Tablet-Key': credentials.key };
      if (key) headers['Idempotency-Key'] = key;
      const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
      if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
      let response;
      try {
        response = await fetchImpl(baseUrl + path, { method, headers,
          body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
          signal: AbortSignal.timeout(isForm ? 120000 : 10000), redirect: 'error', cache: 'no-store' });
      } catch { throw new ApiError('Sin conexión con el gimnasio.'); }
      const result = response.status === 204 ? null : await response.json().catch(() => null);
      if (!response.ok) throw new ApiError(result?.title || 'No se pudo guardar el cambio.', response.status);
      return result;
    }
    async function pair(id, key) {
      const previous = credentials;
      const next = { id: id.trim(), key: key.trim() };
      if (queue.length && previous && previous.id !== next.id)
        throw new ApiError('Resolvé primero las operaciones pendientes de esta tablet.');
      credentials = next;
      try { await request('/session'); storage.setItem(credentialKey, JSON.stringify(credentials)); }
      catch (error) { credentials = previous; throw error; }
    }
    async function pairWithCode(id, code) {
      id = id.trim(); code = code.trim();
      if (queue.length && credentials && credentials.id !== id)
        throw new ApiError('Resolvé primero las operaciones pendientes de esta tablet.');
      if (!/^\d{6}$/.test(code)) throw new ApiError('Ingresá los 6 números que aparecen en la PC.');
      let response;
      try {
        response = await fetchImpl(baseUrl.replace(/\/tablet$/, '/tablet-pairing/exchange'), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId: id, code }), signal: AbortSignal.timeout(10000),
          redirect: 'error', cache: 'no-store',
        });
      } catch { throw new ApiError('No se pudo vincular. Revisá la conexión; si el código fue utilizado, generá otro desde la PC.'); }
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new ApiError(result?.title || (response.status === 429 ? 'Demasiados intentos. Esperá un minuto y generá un código nuevo.' : 'No se pudo vincular la tablet.'), response.status);
      if (result?.id !== id || typeof result.key !== 'string' || result.key.length < 32)
        throw new ApiError('El servidor no devolvió una vinculación válida.');
      // The exchange itself authenticates the device. Do not add a second
      // network request that could lose an already consumed single-use code.
      storage.setItem(credentialKey, JSON.stringify(result)); credentials = result;
    }
    async function send(path, body, { method = 'POST', offline = false, key = newKey() } = {}) {
      if (!offline) {
        const signature = JSON.stringify([credentials?.id, method, path, body]);
        key = attempts[signature] || key;
        attempts[signature] = key;
        storage.setItem(attemptsKey, JSON.stringify(attempts));
        try {
          const result = await request(path, { method, body, key });
          delete attempts[signature]; storage.setItem(attemptsKey, JSON.stringify(attempts));
          return result;
        } catch (error) {
          if (error.status >= 400 && error.status < 500 && ![408, 429].includes(error.status)) {
            delete attempts[signature]; storage.setItem(attemptsKey, JSON.stringify(attempts));
          }
          throw error;
        }
      }
      // Persist before sending: a timeout or tab close must retain the same key.
      const operation = { path, body, method, key, state: 'pending' };
      queue.push(operation); persist();
      await flush();
      const retained = queue.find(item => item.key === key);
      if (retained?.state === 'failed') throw new ApiError(retained.error, retained.status);
      return { queued: Boolean(retained) };
    }
    function flush() {
      if (flushing) return flushing;
      if (!credentials) return Promise.resolve();
      flushing = (async () => {
        while (true) {
          // Rejected attendance must not block unrelated students. Preserve
          // dependent operations for the same member until the rejection is resolved.
          const failed = queue.filter(item => item.state === 'failed');
          const item = queue.find(item => item.state !== 'failed' && !failed.some(error =>
            !error.path.endsWith('/attendance') || !item.path.endsWith('/attendance') ||
            error.body.identityNumber === item.body.identityNumber));
          if (!item) break;
          try {
            await request(item.path, item);
            queue = queue.filter(row => row.key !== item.key); persist();
          } catch (error) {
            if (error.status >= 400 && error.status < 500 && ![401, 403, 408, 429].includes(error.status)) {
              item.state = 'failed'; item.error = error.message; item.status = error.status; persist();
            }
            if (item.state !== 'failed') break;
          }
        }
      })().finally(() => { flushing = null; });
      return flushing;
    }
    function dismiss(key) {
      const item = queue.find(row => row.key === key);
      if (!item || item.state !== 'failed') throw new ApiError('Solo se puede descartar una operación rechazada por el servidor.');
      queue = queue.filter(row => row.key !== key); persist();
    }
    return { request, send, pair, pairWithCode, flush, dismiss, deviceId: () => credentials?.id || null, pending: () => queue.slice(), paired: () => Boolean(credentials),
      upload: file => { const form = new FormData(); form.append('file', file); return request('/media', { method: 'POST', body: form }); } };
  }
  const api = { createClient, ApiError };
  if (typeof module !== 'undefined') module.exports = api;
  else root.TabletApi = api;
})(typeof window !== 'undefined' ? window : globalThis);
