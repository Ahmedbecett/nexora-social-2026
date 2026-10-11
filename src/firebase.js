// Client-side Firebase Authentication (Google + phone). Loaded lazily so the
// Firebase SDK only downloads when a user actually picks one of these methods.
import { Capacitor } from '@capacitor/core';
import { api } from './api.js';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDIibumDNK3Gps3EsiGjdl0hZC2u7pwQYU',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'nexora-social-2026.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'nexora-social-2026',
  messagingSenderId: '549843291889',
};

let _auth;
async function getFbAuth() {
  if (_auth) return _auth;
  const [{ initializeApp, getApps }, authMod] = await Promise.all([import('firebase/app'), import('firebase/auth')]);
  const app = getApps()[0] || initializeApp(firebaseConfig);
  _auth = { auth: authMod.getAuth(app), m: authMod };
  _auth.auth.useDeviceLanguage();
  return _auth;
}

export class AuthFlowError extends Error {
  constructor(code, detail) { super(code); this.code = code; this.detail = detail; }
}

function mapFirebaseError(e) {
  const c = String(e?.code || e?.message || '');
  const msg = String(e?.message || '');
  if (/region enabled|SMS unable to be sent until this region/i.test(msg)) return new AuthFlowError('phone_region_disabled');
  if (/billing/i.test(c + msg)) return new AuthFlowError('phone_billing');
  if (c.includes('invalid-phone-number')) return new AuthFlowError('invalid_phone');
  if (c.includes('invalid-verification-code')) return new AuthFlowError('invalid_code');
  if (c.includes('code-expired')) return new AuthFlowError('code_expired');
  if (c.includes('too-many-requests') || c.includes('quota')) return new AuthFlowError('too_many_attempts');
  if (c.includes('operation-not-allowed')) return new AuthFlowError('provider_disabled');
  if (/not authorized to use Firebase Authentication|SHA-1|SHA-256|app-not-authorized|missing-client-identifier|Invalid PlayIntegrity|app not Recognized/i.test(c + ' ' + msg)) return new AuthFlowError('app_not_authorized', msg);
  if (c.includes('unauthorized-domain') || c.includes('invalid-app-credential')) return new AuthFlowError('domain_not_authorized');
  if (/invalid format|TOO_SHORT|TOO_LONG|INVALID_PHONE/i.test(msg)) return new AuthFlowError('invalid_phone');
  if (/verification code.*invalid|invalid-verification-code|INVALID_CODE/i.test(msg)) return new AuthFlowError('invalid_code');
  if (/expired/i.test(msg)) return new AuthFlowError('code_expired');
  if (/blocked all requests|unusual activity|too many|quota/i.test(msg)) return new AuthFlowError('too_many_attempts');
  if (/network|timeout|unreachable/i.test(msg)) return new AuthFlowError('network');
  if (c.includes('popup-closed') || c.includes('cancelled') || /cancel/i.test(msg)) return new AuthFlowError('cancelled');
  if (c.includes('network')) return new AuthFlowError('network');
  // Native Google Sign-In: DEVELOPER_ERROR (10) / no credentials when the SHA fingerprint is not registered
  if (/developer|10:|No credentials available|28444|\[16\]/i.test(msg)) return new AuthFlowError('google_not_configured', msg);
  return new AuthFlowError('auth_provider_error', msg || c);
}

/** Google sign-in → app session ({token,user}) or {needsProfile,...}. */
export async function signInWithGoogle() {
  try {
    if (Capacitor.isNativePlatform()) {
      const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
      let res;
      try {
        res = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true });
      } catch (e) {
        const msg = String(e?.message || e?.code || '');
        if (/cancel/i.test(msg) && !/no credentials/i.test(msg)) throw e;
        // Credential Manager fails on some phones (no saved Google account, outdated Play services):
        // fall back to the classic Google Sign-In screen, which also lets the user add an account.
        res = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true, useCredentialManager: false });
      }
      const idToken = res?.credential?.idToken;
      if (!idToken) throw new AuthFlowError('google_failed');
      return await api('auth/google', { method: 'POST', body: { idToken } });
    }
    const { auth, m } = await getFbAuth();
    const provider = new m.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const cred = await m.signInWithPopup(auth, provider);
    const idToken = await cred.user.getIdToken();
    m.signOut(auth).catch(() => {});
    return await api('auth/firebase', { method: 'POST', body: { idToken } });
  } catch (e) {
    if (e instanceof AuthFlowError || e?.status) throw e;
    throw mapFirebaseError(e);
  }
}

let verifier = null;
let nativeHandles = [];
function clearNative() { nativeHandles.forEach((h) => { try { h.remove(); } catch { /* */ } }); nativeHandles = []; }

/**
 * Native Android phone verification (Firebase Android SDK): uses Play Integrity
 * instead of a web reCAPTCHA and can read the SMS automatically.
 * Resolves with confirm(code). `onAuto(result)` fires if the SMS is detected
 * automatically (or the number is verified instantly).
 */
async function nativePhoneCode(phoneNumber, { onAuto, onError, resend } = {}) {
  const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
  clearNative();
  const exchange = async () => {
    const { token } = await FirebaseAuthentication.getIdToken({ forceRefresh: false });
    FirebaseAuthentication.signOut().catch(() => {});
    return api('auth/firebase', { method: 'POST', body: { idToken: token } });
  };
  return new Promise((resolve, reject) => {
    let settled = false;
    let verificationId = null;
    let autoResult = null;
    const confirm = async (code) => {
      if (autoResult) return autoResult;
      try {
        await FirebaseAuthentication.confirmVerificationCode({ verificationId, verificationCode: code });
        return await exchange();
      } catch (e) {
        if (e?.status || e instanceof AuthFlowError) throw e;
        throw mapFirebaseError(e);
      }
    };
    (async () => {
      nativeHandles.push(await FirebaseAuthentication.addListener('phoneCodeSent', (ev) => {
        verificationId = ev.verificationId;
        if (!settled) { settled = true; resolve(confirm); }
      }));
      nativeHandles.push(await FirebaseAuthentication.addListener('phoneVerificationFailed', (ev) => {
        const err = mapFirebaseError({ message: ev?.message || '' });
        if (!settled) { settled = true; reject(err); } else onError?.(err);
      }));
      nativeHandles.push(await FirebaseAuthentication.addListener('phoneVerificationCompleted', async () => {
        try {
          autoResult = await exchange();
          if (!settled) { settled = true; resolve(confirm); }
          onAuto?.(autoResult);
        } catch (e) {
          const err = e?.status ? e : mapFirebaseError(e);
          if (!settled) { settled = true; reject(err); } else onError?.(err);
        }
      }));
      await FirebaseAuthentication.signInWithPhoneNumber({ phoneNumber, skipNativeAuth: false, resendCode: !!resend, timeout: 60 });
    })().catch((e) => { if (!settled) { settled = true; reject(mapFirebaseError(e)); } });
  });
}

/** Send an SMS code. Returns a confirm(code) function. */
export async function sendPhoneCode(phoneNumber, containerId, opts = {}) {
  if (Capacitor.isNativePlatform()) return nativePhoneCode(phoneNumber, opts);
  try {
    const { auth, m } = await getFbAuth();
    if (verifier) { try { verifier.clear(); } catch { /* */ } verifier = null; }
    verifier = new m.RecaptchaVerifier(auth, containerId, { size: 'invisible' });
    const confirmation = await m.signInWithPhoneNumber(auth, phoneNumber, verifier);
    return async (code) => {
      try {
        const cred = await confirmation.confirm(code);
        const idToken = await cred.user.getIdToken();
        m.signOut(auth).catch(() => {});
        return await api('auth/firebase', { method: 'POST', body: { idToken } });
      } catch (e) {
        if (e?.status) throw e;
        throw mapFirebaseError(e);
      }
    };
  } catch (e) {
    if (verifier) { try { verifier.clear(); } catch { /* */ } verifier = null; }
    throw mapFirebaseError(e);
  }
}
