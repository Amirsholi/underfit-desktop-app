const test = require('node:test');
const assert = require('node:assert/strict');
const { createUnderFitApiClient } = require('../clients/underFitApiClient');

test('entry date filters survive runtimes without URLSearchParams.size', async () => {
  const original = global.URLSearchParams;
  class LegacyParams extends original { get size() { return undefined; } }
  global.URLSearchParams = LegacyParams;
  const urls = [];
  try {
    const api = createUnderFitApiClient({ baseUrl: 'http://localhost:5192', deviceKey: 'test',
      fetchImpl: async url => { urls.push(url); return { ok: true, status: 200, json: async () => [] }; } });
    await api.listEntries({ from: '2026-10-05', to: '2026-10-05' });
    await api.listEntries({ from: '2026-10-01' });
    await api.listEntries();
    assert.deepEqual(urls, [
      'http://localhost:5192/api/v1/entries?from=2026-10-05&to=2026-10-05',
      'http://localhost:5192/api/v1/entries?from=2026-10-01',
      'http://localhost:5192/api/v1/entries',
    ]);
  } finally { global.URLSearchParams = original; }
});
