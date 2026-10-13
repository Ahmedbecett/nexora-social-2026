// Firebase Authentication helpers (REST + ID-token verification).
// Firebase is the identity provider for email/password, Google and phone sign-in;
// the API then issues its own session JWT.
import { createRemoteJWKSet, jwtVerify } from 'jose';

export const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyDIibumDNK3Gps3EsiGjdl0hZC2u7pwQYU';
export const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'nexora-social-2026';

const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));

export class FirebaseError extends Error {
  constructor(code) { super(code); this.code = code; }
}

async function call(method, body) {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${method}?key=${FIREBASE_API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = String(data?.error?.message || 'UNKNOWN');
    throw new FirebaseError(msg.split(/[ :]/)[0]);
  }
  return data;
}

export const fbSignUp = (email, password) => call('signUp', { email, password, returnSecureToken: true });
export const fbSignIn = (email, password) => call('signInWithPassword', { email, password, returnSecureToken: true });
export const fbUpdate = (idToken, fields) => call('update', { idToken, ...fields, returnSecureToken: true });
export const fbDelete = (idToken) => call('delete', { idToken });
export const fbSendVerify = (idToken) => call('sendOobCode', { requestType: 'VERIFY_EMAIL', idToken });
export const fbSendReset = (email) => call('sendOobCode', { requestType: 'PASSWORD_RESET', email });
export const fbLookup = (idToken) => call('lookup', { idToken });

/** Exchange a Google ID token (from native Google Sign-In) for a Firebase session. */
export const fbSignInWithGoogle = (googleIdToken) => call('signInWithIdp', {
  postBody: `id_token=${encodeURIComponent(googleIdToken)}&providerId=google.com`,
  requestUri: 'http://localhost', returnSecureToken: true, returnIdpCredential: true,
});

/** Verify a Firebase ID token issued to this project. Returns its claims. */
export async function verifyFirebaseIdToken(idToken) {
  try {
    const { payload } = await jwtVerify(idToken, JWKS, {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
      algorithms: ['RS256'],
    });
    if (!payload.sub) throw new Error('no sub');
    return payload;
  } catch {
    throw new FirebaseError('INVALID_ID_TOKEN');
  }
}
