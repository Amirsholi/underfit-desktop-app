const test = require('node:test');
const assert = require('node:assert/strict');
const { createUnderFitApiClient } = require('../clients/underFitApiClient');

test('desktop resolves tablet media against the connected gym server', async () => {
  const client = createUnderFitApiClient({
    baseUrl: 'http://127.0.0.1:5187', deviceKey: 'test',
    fetchImpl: async () => ({ ok: true, headers: { get: () => 'application/json' }, json: async () => [
      { id: 1, gifUrl: '/media/exercises/tablet.mp4' },
      { id: 2, gifUrl: 'https://example.org/exercise.gif' },
      { id: 3, gifUrl: null },
    ] }),
  });
  const items = await client.listExercises();
  assert.equal(items[0].gifUrl, 'http://127.0.0.1:5187/media/exercises/tablet.mp4');
  assert.equal(items[1].gifUrl, 'https://example.org/exercise.gif');
  assert.equal(items[2].gifUrl, null);
});

test('editing in desktop does not store its localhost media address for tablets', async () => {
  let payload;
  const client = createUnderFitApiClient({
    baseUrl: 'http://127.0.0.1:5187', deviceKey: 'test',
    fetchImpl: async (_url, options) => {
      payload = JSON.parse(options.body);
      return { ok: true, headers: { get: () => 'application/json' }, json: async () => payload };
    },
  });
  await client.updateExercise(1, { name: 'Sentadilla', gifUrl: 'http://127.0.0.1:5187/media/exercises/tablet.mp4' });
  assert.equal(payload.gifUrl, '/media/exercises/tablet.mp4');
  await client.updateExercise(1, { name: 'Sentadilla', gifUrl: 'https://example.org/video.mp4' });
  assert.equal(payload.gifUrl, 'https://example.org/video.mp4');
});
