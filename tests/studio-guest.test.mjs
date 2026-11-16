/**
 * Guest sessions and account claiming.
 *
 * The Studio opens without an account: the API hands out a signed guest
 * credential, every row the guest owns stays private to that credential, and
 * linking a NEXORA account moves the whole workspace to the account in one
 * transaction.
 *
 * The test drives the real routes, the real SQL and the real SQLite storage.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'nxs-guest-'));
process.env.STUDIO_DB_PATH = join(dir, 'studio.sqlite');
process.env.STUDIO_SECRET = 'guest-suite-secret';
delete process.env.DATABASE_URL;
delete process.env.POSTGRES_URL;
delete process.env.STUDIO_DEV_AUTH;

const { registerStudioRoutes } = await import('../api/_lib/studio/routes.js');
const { guestOwner, verifyGuestToken, signGuestToken } = await import('../api/_lib/studio/guest.js');
const { saveUserKey, userKeys } = await import('../api/_lib/studio/ai.js');

/* --------------------------- a tiny real router -------------------------- */
const routes = [];
const route = (method, pattern, fn) => {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
  routes.push({ method, re, keys, fn });
};

const ACCOUNTS = {
  'account-ada': { id: 1, username: 'ada', full_name: 'Ada Lovelace' },
  'account-bob': { id: 2, username: 'bob', full_name: 'Bob Stone' },
};
const authUser = async (req) => {
  const m = String(req?.headers?.authorization || '').match(/^Bearer (.+)$/);
  const user = m ? ACCOUNTS[m[1]] : null;
  if (!user) throw Object.assign(new Error('unauthorized'), { status: 401, code: 'unauthorized' });
  return user;
};
registerStudioRoutes({ route, authUser });

async function call(method, path, { headers = {}, body = {} } = {}) {
  for (const r of routes) {
    if (r.method !== method) continue;
    const match = path.match(r.re);
    if (!match) continue;
    const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(match[i + 1])]));
    return await r.fn({ req: { method, headers, body }, params, body, query: {} });
  }
  throw new Error(`no route for ${method} ${path}`);
}

const guestHeaders = (token) => ({ 'x-studio-mode': 'guest', ...(token ? { 'x-studio-guest': token } : {}) });
const accountHeaders = (token) => ({ authorization: `Bearer ${token}` });

/* ------------------------------- the tests -------------------------------- */

test('a visitor is given a guest session and never needs an account', async () => {
  const session = await call('GET', 'studio/session', { headers: guestHeaders() });
  assert.equal(session.authenticated, true, 'the Studio opens straight away');
  assert.equal(session.guest, true);
  assert.equal(session.user.username, 'guest');
  assert.ok(session.guestToken, 'the visitor keeps a credential');
  assert.ok(verifyGuestToken(session.guestToken), 'the credential is signed and valid');

  const issued = await call('POST', 'studio/guest', { headers: guestHeaders() });
  assert.ok(issued.token && issued.guestId);
  assert.notEqual(issued.token, session.guestToken, 'every guest gets its own workspace');
});

test('two guests never see each other\'s projects', async () => {
  const a = (await call('GET', 'studio/session', { headers: guestHeaders() })).guestToken;
  const b = (await call('GET', 'studio/session', { headers: guestHeaders() })).guestToken;

  const created = await call('POST', 'studio/projects', {
    headers: guestHeaders(a),
    body: { name: 'A private project' },
  });
  assert.ok(created.project.id);

  const listA = await call('GET', 'studio/projects', { headers: guestHeaders(a) });
  const listB = await call('GET', 'studio/projects', { headers: guestHeaders(b) });
  assert.equal(listA.projects.length, 1);
  assert.equal(listA.projects[0].name, 'A private project');
  assert.equal(listB.projects.length, 0, 'the second visitor sees an empty workspace');

  /* and the other guest cannot open the project by id */
  await assert.rejects(
    () => call('GET', `studio/projects/${created.project.id}`, { headers: guestHeaders(b) }),
    (e) => e.code === 'project_not_found',
  );
});

test('the guest workspace survives a reload and keeps its keys', async () => {
  const token = (await call('GET', 'studio/session', { headers: guestHeaders() })).guestToken;
  const created = await call('POST', 'studio/projects', {
    headers: guestHeaders(token),
    body: { name: 'Kept across reloads', files: { 'index.html': '<h1>hi</h1>' } },
  });
  await call('PATCH', `studio/projects/${created.project.id}`, {
    headers: guestHeaders(token),
    body: { files: { 'index.html': '<h1>edited</h1>' }, status: 'ready' },
  });

  const guestId = verifyGuestToken(token).gid;
  await saveUserKey(guestOwner(guestId), 'openai', 'sk-guest-key-123456');

  /* a fresh request with the same credential sees the same workspace */
  const again = await call('GET', 'studio/projects', { headers: guestHeaders(token) });
  assert.equal(again.projects.length, 1);
  const opened = await call('GET', `studio/projects/${created.project.id}`, { headers: guestHeaders(token) });
  assert.equal(opened.project.files['index.html'], '<h1>edited</h1>');
  assert.ok(opened.revisions.length >= 1, 'the edit kept a restore point');

  const keys = await userKeys(guestOwner(guestId));
  assert.equal(keys.openai.key, 'sk-guest-key-123456');
});

test('a forged or expired guest credential is refused', async () => {
  await assert.rejects(
    () => call('GET', 'studio/projects', { headers: guestHeaders('nxg1.forged.body.signature') }),
    (e) => e.status === 401 && e.code === 'guest_expired',
  );

  const expired = signGuestToken('someone', -1000);
  await assert.rejects(
    () => call('GET', 'studio/projects', { headers: guestHeaders(expired) }),
    (e) => e.status === 401 && e.code === 'guest_expired',
  );

  /* an account token is not a guest credential */
  await assert.rejects(
    () => call('GET', 'studio/projects', { headers: guestHeaders('account-ada') }),
    (e) => e.status === 401,
  );
});

test('linking a guest workspace to an account moves every row', async () => {
  const token = (await call('GET', 'studio/session', { headers: guestHeaders() })).guestToken;
  const guestId = verifyGuestToken(token).gid;
  const guestOwnerId = guestOwner(guestId);

  const created = await call('POST', 'studio/projects', {
    headers: guestHeaders(token),
    body: { name: 'Claimed project', files: { 'index.html': '<h1>mine</h1>' } },
  });
  await call('PATCH', `studio/projects/${created.project.id}`, {
    headers: guestHeaders(token),
    body: { files: { 'index.html': '<h1>mine</h1>', 'app.js': 'console.log(1)' } },
  });
  await saveUserKey(guestOwnerId, 'openai', 'sk-claim-key-123456');

  const claim = await call('POST', 'studio/claim', {
    headers: { ...guestHeaders(token), ...accountHeaders('account-ada') },
    body: {},
  });
  assert.equal(claim.claimed, true);
  assert.equal(claim.owner, '1');
  assert.equal(claim.moved.projects, 1);
  assert.equal(claim.moved.keys, 1);
  assert.equal(claim.keptKeys.length, 0);

  /* the account owns the workspace now */
  const forAccount = await call('GET', 'studio/projects', { headers: accountHeaders('account-ada') });
  assert.equal(forAccount.projects.length, 1);
  assert.equal(forAccount.projects[0].name, 'Claimed project');
  const opened = await call('GET', `studio/projects/${created.project.id}`, { headers: accountHeaders('account-ada') });
  assert.deepEqual(Object.keys(opened.project.files).sort(), ['app.js', 'index.html']);
  assert.ok(opened.messages.length >= 0);

  /* the key travelled with the workspace */
  const keys = await userKeys('1');
  assert.equal(keys.openai.key, 'sk-claim-key-123456');

  /* and the guest workspace is empty from now on */
  const forGuest = await call('GET', 'studio/projects', { headers: guestHeaders(token) });
  assert.equal(forGuest.projects.length, 0);

  /* the session reports the link so the browser can stop using the guest */
  const session = await call('GET', 'studio/session', { headers: guestHeaders(token) });
  assert.equal(session.guestClaimed.accountId, '1');
});

test('a second account cannot claim the same guest workspace', async () => {
  const token = (await call('GET', 'studio/session', { headers: guestHeaders() })).guestToken;
  await call('POST', 'studio/projects', { headers: guestHeaders(token), body: { name: 'Only for Ada' } });

  await call('POST', 'studio/claim', {
    headers: { ...guestHeaders(token), ...accountHeaders('account-ada') },
    body: {},
  });

  await assert.rejects(
    () => call('POST', 'studio/claim', {
      headers: { ...guestHeaders(token), ...accountHeaders('account-bob') },
      body: {},
    }),
    (e) => e.status === 409 && e.code === 'guest_already_claimed',
  );

  const forBob = await call('GET', 'studio/projects', { headers: accountHeaders('account-bob') });
  assert.equal(forBob.projects.length, 0, 'Bob got nothing');
});

test('a guest alone cannot claim anything', async () => {
  const token = (await call('GET', 'studio/session', { headers: guestHeaders() })).guestToken;
  await assert.rejects(
    () => call('POST', 'studio/claim', { headers: guestHeaders(token), body: {} }),
    (e) => e.status === 401 && e.code === 'account_required',
  );
});

test('claiming twice with the same account is safe', async () => {
  const token = (await call('GET', 'studio/session', { headers: guestHeaders() })).guestToken;
  await call('POST', 'studio/projects', { headers: guestHeaders(token), body: { name: 'Twice' } });
  const first = await call('POST', 'studio/claim', {
    headers: { ...guestHeaders(token), ...accountHeaders('account-ada') }, body: {},
  });
  assert.equal(first.moved.projects, 1);
  const second = await call('POST', 'studio/claim', {
    headers: { ...guestHeaders(token), ...accountHeaders('account-ada') }, body: {},
  });
  assert.equal(second.claimed, true);
  assert.equal(second.moved.projects, 0, 'nothing moved twice');
  assert.equal(second.alreadyClaimed, true);
  const list = await call('GET', 'studio/projects', { headers: accountHeaders('account-ada') });
  const twice = list.projects.filter((p) => p.name === 'Twice');
  assert.equal(twice.length, 1, 'the project was not duplicated');
});

test('an account key is never overwritten by a guest key', async () => {
  await saveUserKey('2', 'openai', 'sk-bob-key-123456');
  const token = (await call('GET', 'studio/session', { headers: guestHeaders() })).guestToken;
  const guestId = verifyGuestToken(token).gid;
  await saveUserKey(guestOwner(guestId), 'openai', 'sk-guest-key-654321');

  const claim = await call('POST', 'studio/claim', {
    headers: { ...guestHeaders(token), ...accountHeaders('account-bob') }, body: {},
  });
  assert.deepEqual(claim.keptKeys, ['openai'], 'the account kept its own key');
  const keys = await userKeys('2');
  assert.equal(keys.openai.key, 'sk-bob-key-123456');
});

test.after(() => rmSync(dir, { recursive: true, force: true }));
