import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { validateAndroidFirebase } from '../scripts/check-android-firebase.mjs';

const appId = 'com.ahmedbecetti.nexora';
const projectId = 'nexora-social-2026';
function config() {
  return { project_info: { project_id: projectId }, client: [{
    client_info: { mobilesdk_app_id: 'test-app', android_client_info: { package_name: appId } },
    api_key: [{ current_key: 'test-key' }],
    oauth_client: [
      { client_type: 3, client_id: 'test.apps.googleusercontent.com' },
      { client_type: 1, android_info: { package_name: appId, certificate_hash: 'TEST_SHA' } },
    ],
  }] };
}

test('requires matching Firebase project, Android package and both OAuth clients', () => {
  assert.doesNotThrow(() => validateAndroidFirebase(config(), appId, projectId));
  assert.throws(() => validateAndroidFirebase(config(), 'wrong.package', projectId), /Android client/);
  assert.throws(() => validateAndroidFirebase(config(), appId, 'wrong-project'), /project/);
  for (const type of [1, 3]) {
    const c = config();
    c.client[0].oauth_client = c.client[0].oauth_client.filter((o) => o.client_type !== type);
    assert.throws(() => validateAndroidFirebase(c, appId, projectId), /Missing/);
  }
});

async function loadAuth({ native = true, signIn, exchange = async () => ({ token: 'session' }), timeout = false } = {}) {
  const calls = [];
  const context = vm.createContext({
    AbortController,
    setTimeout: timeout ? (fn) => setTimeout(fn, 1) : setTimeout,
    clearTimeout,
  });
  const modules = {
    '@capacitor/core': { Capacitor: { isNativePlatform: () => native } },
    './api.js': { api: async (path, options) => { calls.push({ path, options }); return exchange(path, options); } },
    '@capacitor-firebase/authentication': { FirebaseAuthentication: { signInWithGoogle: signIn } },
    'firebase/app': { initializeApp: () => ({}), getApps: () => [] },
    'firebase/auth': {
      getAuth: () => ({ useDeviceLanguage() {} }),
      GoogleAuthProvider: class { setCustomParameters() {} },
      signInWithPopup: async () => ({ user: { getIdToken: async () => 'firebase-token' } }),
      signOut: async () => {},
    },
  };
  async function mock(specifier) {
    const exports = modules[specifier];
    assert.ok(exports, `Unexpected module: ${specifier}`);
    const mod = new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    }, { context });
    await mod.link(() => {});
    await mod.evaluate();
    return mod;
  }
  const mod = new vm.SourceTextModule(readFileSync(new URL('../src/firebase.js', import.meta.url), 'utf8'), {
    context,
    initializeImportMeta(meta) { meta.env = {}; },
    importModuleDynamically: mock,
  });
  await mod.link(mock);
  await mod.evaluate();
  return { auth: mod.namespace, calls };
}

test('native Google ID token goes to auth/google without an existing session token', async () => {
  const { auth, calls } = await loadAuth({ signIn: async () => ({ credential: { idToken: 'google-token' } }) });
  assert.equal((await auth.signInWithGoogle()).token, 'session');
  assert.equal(calls[0].path, 'auth/google');
  assert.equal(calls[0].options.body.idToken, 'google-token');
  assert.equal(calls[0].options.token, null);
});

test('Credential Manager failure falls back to classic sign-in', async () => {
  const attempts = [];
  const { auth } = await loadAuth({ signIn: async (options) => {
    attempts.push(options);
    if (attempts.length === 1) throw new Error('No credentials available');
    return { credential: { idToken: 'google-token' } };
  } });
  await auth.signInWithGoogle();
  assert.equal(attempts.length, 2);
  assert.equal(attempts[1].useCredentialManager, false);
});

test('cancelling does not reopen the account picker', async () => {
  let attempts = 0;
  const { auth, calls } = await loadAuth({ signIn: async () => { attempts++; throw new Error('12501'); } });
  await assert.rejects(auth.signInWithGoogle(), { code: 'cancelled' });
  assert.equal(attempts, 1);
  assert.equal(calls.length, 0);
});

test('missing native token is reported instead of exchanging an empty token', async () => {
  const { auth, calls } = await loadAuth({ signIn: async () => ({}) });
  await assert.rejects(auth.signInWithGoogle(), { code: 'google_failed' });
  assert.equal(calls.length, 0);
});

test('web Firebase token is exchanged via auth/firebase', async () => {
  const { auth, calls } = await loadAuth({ native: false });
  await auth.signInWithGoogle();
  assert.equal(calls[0].path, 'auth/firebase');
  assert.equal(calls[0].options.body.idToken, 'firebase-token');
});

test('stalled session exchange aborts with a retryable network error', async () => {
  const { auth } = await loadAuth({
    timeout: true,
    signIn: async () => ({ credential: { idToken: 'google-token' } }),
    exchange: (_path, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })), { once: true });
    }),
  });
  await assert.rejects(auth.signInWithGoogle(), { code: 'network' });
});
