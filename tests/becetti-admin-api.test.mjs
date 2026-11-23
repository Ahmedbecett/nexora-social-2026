import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatch, HttpError } from '../api/_lib/handlers.js';

const context = { headers: {}, body: {}, query: {} };

test('BECETTI write/admin endpoints are marked authenticated in API discovery', async () => {
  const index = await dispatch('GET', '', context);
  const auth = new Map(index.routes.filter((route) => route.path.includes('becetti/')).map((route) => [`${route.method} ${route.path}`, route.auth]));
  assert.equal(auth.get('GET /becetti/catalog'), false);
  assert.equal(auth.get('GET /becetti/admin'), true);
  assert.equal(auth.get('PUT /becetti/catalog'), true);
  assert.equal(auth.get('POST /becetti/image-token'), true);
});

test('BECETTI admin, catalogue writes and image-token endpoints reject missing sessions', async () => {
  for (const [method, path] of [
    ['GET', 'becetti/admin'],
    ['PUT', 'becetti/catalog'],
    ['POST', 'becetti/image-token'],
  ]) {
    await assert.rejects(dispatch(method, path, context), (error) => error instanceof HttpError && error.status === 401, `${method} /${path}`);
  }
});
