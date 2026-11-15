import test from 'node:test';
import assert from 'node:assert/strict';

process.env.VERCEL_STUDIO_TOKEN = 'test-token';
delete process.env.VERCEL_TOKEN;
delete process.env.VERCEL_API_TOKEN;

const { vercelProjectState, deployToVercel, vercelAccount } = await import('../api/_lib/studio/deploy.js');

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

function mountFetch(routes) {
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = String(typeof input === 'string' ? input : input.url);
    const method = (init.method || 'GET').toUpperCase();
    const bare = url.split('?')[0];
    calls.push(`${method} ${url}`);
    const handler = routes[`${method} ${url}`] || routes[`${method} ${bare}`];
    if (!handler) return json({ error: { message: `unexpected ${method} ${url}` } }, 404);
    return handler(init.body ? JSON.parse(init.body) : null);
  };
  return calls;
}

test('an existing Vercel project can be read and followed to its live URL', async () => {
  const calls = mountFetch({
    'GET https://api.vercel.com/v2/user': () => json({ user: { username: 'me' } }),
    'GET https://api.vercel.com/v9/projects?limit=20': () => json({
      projects: [{ id: 'prj_1', name: 'shop', latestDeployments: [{ url: 'shop-abc.vercel.app' }] }],
    }),
    'GET https://api.vercel.com/v9/projects/shop': () => json({ id: 'prj_1', name: 'shop' }),
    'GET https://api.vercel.com/v6/deployments': () => json({
      deployments: [{
        uid: 'dpl_1',
        readyState: 'READY',
        url: 'shop-abc.vercel.app',
        inspectorUrl: 'https://vercel.com/me/shop/dpl_1',
        target: 'production',
        created: 1_700_000_000_000,
      }],
    }),
  });

  const account = await vercelAccount('dev');
  assert.equal(account.connected, true);
  assert.deepEqual(account.projects.map((p) => p.name), ['shop']);

  const state = await vercelProjectState('dev', { name: 'shop' });
  assert.equal(state.projectId, 'prj_1');
  assert.equal(state.state, 'READY');
  assert.equal(state.url, 'https://shop-abc.vercel.app');
  assert.equal(state.hasDeployment, true);
  assert.ok(calls.some((c) => c.includes('/v6/deployments?projectId=prj_1')));

  mountFetch({});
  await assert.rejects(() => vercelProjectState('dev', {}), (e) => e.code === 'vercel_project_required');
});

test('deploying into an existing project keeps its name and domains', async () => {
  let deployed = null;
  const calls = mountFetch({
    'GET https://api.vercel.com/v9/projects/prj_1': () => json({ id: 'prj_1', name: 'shop' }),
    'POST https://api.vercel.com/v13/deployments': (body) => {
      deployed = body;
      return json({ id: 'dpl_9', url: 'shop-xyz.vercel.app', readyState: 'QUEUED' });
    },
  });

  const out = await deployToVercel('dev', {
    files: { 'index.html': '<h1>shop</h1>' },
    projectName: 'studio draft name',
    existingProjectId: 'prj_1',
  });

  assert.equal(deployed.name, 'shop', 'the existing project name is used, not a new slug');
  assert.equal(deployed.files[0].encoding, 'base64');
  assert.equal(Buffer.from(deployed.files[0].data, 'base64').toString('utf8'), '<h1>shop</h1>');
  assert.ok(out.url, 'the deployment url comes back');
  assert.ok(calls.includes('POST https://api.vercel.com/v13/deployments'));

  mountFetch({});
  await assert.rejects(
    () => deployToVercel('dev', { files: { 'a.html': 'x' }, projectName: 'x', existingProjectId: 'prj_missing' }),
    (e) => e.code === 'vercel_project_missing',
  );
});
