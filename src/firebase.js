/* ==========================================================================
   NEXORA AI — المصادقة (Firebase + خادم NEXORA)

   إصلاح نسخة 4.4 (Amazon Appstore — Fire OS):
   كان زر «Continue with Google» يستدعي إضافة Capacitor الأصلية مباشرة. على Fire OS
   (بلا Google Play Services) أو على حزمة بُنيت بدون google-services.json لا تُهيّأ
   الإضافة، فيبقى الوعد معلّقًا إلى الأبد ويبدو الزر «لا يستجيب». الآن:

   1) فحص بيئة الجهاز عبر إضافة NexoraAuth المحلية (انعكاس فقط — لا تُهيّئ Firebase).
   2) حدّ زمني صارم لكل محاولة Google + محاولة ثانية بالواجهة الكلاسيكية.
   3) أي فشل يُترجم إلى كود مفهوم ⟹ شاشة بديل واضحة للبريد الإلكتروني (لا تعليق أبدًا).
   4) الدخول بالبريد يعمل عبر خادم NEXORA مباشرة — بلا Play Services ولا Firebase SDK.
   ========================================================================== */
import { Capacitor, registerPlugin } from '@capacitor/core';
import { api } from './api.js';
import {
  decideGoogleAvailability,
  googleFailureNeedsEmailFallback,
  googleFailureIsSilent,
  withTimeout,
  GOOGLE_REASONS,
} from './authPolicy.js';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDIibumDNK3Gps3EsiGjdl0hZC2u7pwQYU',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'nexora-social-2026.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'nexora-social-2026',
  messagingSenderId: '549843291889',
};

/* ---------- تشخيص الجهاز (Android فقط؛ على الويب لا شيء) ---------- */
const NexoraAuth = Capacitor.isNativePlatform()
  ? registerPlugin('NexoraAuth')
  : null;

/** مدة الانتظار قبل الحكم على فحص الجهاز بالفشل (لا نُعلّق الواجهة لأجله). */
const ENV_TIMEOUT_MS = 4000;
/** مهلة محاولة Google الواحدة: بعدها نعتبرها غير متاحة ونعرض بديل البريد. */
const GOOGLE_ATTEMPT_TIMEOUT_MS = 90000;
/** إرسال رابط استعادة كلمة المرور — الخادم يتصل بـ Firebase، فلا ننتظر للأبد. */
const RESET_TIMEOUT_MS = 25000;

let envCache = null; // { at, env } — نفس الفحص يكفي طوال الجلسة

/**
 * يقرأ بيئة المصادقة من الطبقة الأصلية مرة واحدة ويتذكّرها.
 * لا يرمي استثناء أبدًا: عند الفشل يعيد null (والسياسة تعتبر null = غير متاح).
 */
export async function getAuthEnvironment({ force = false } = {}) {
  if (!Capacitor.isNativePlatform()) return null;
  if (!force && envCache && Date.now() - envCache.at < 10 * 60 * 1000) return envCache.env;
  let env = null;
  try {
    if (NexoraAuth) env = await withTimeout(NexoraAuth.getAuthEnvironment(), ENV_TIMEOUT_MS, GOOGLE_REASONS.diagnosticsFailed);
  } catch {
    env = null; // إضافة غير مسجّلة / نسخة قديمة من الحزمة
  }
  envCache = { at: Date.now(), env };
  return env;
}

/** قرار جاهز للواجهة: هل نحاول Google؟ ولماذا لا؟ */
export async function googleSignInStatus({ force = false } = {}) {
  // على الويب يعمل Google بنافذة منبثقة عادية (لا Play Services ولا إضافة أصلية)
  if (!Capacitor.isNativePlatform()) {
    return { attempt: true, available: true, reason: GOOGLE_REASONS.ok, env: null };
  }
  const env = await getAuthEnvironment({ force });
  const decision = decideGoogleAvailability(env);
  return { ...decision, env };
}

/* ---------- Firebase JS SDK (للويب وللهاتف عند الحاجة) ---------- */
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
  constructor(code, detail) {
    super(code);
    this.code = code;
    this.detail = detail;
  }
}

/** يحوّل أي خطأ (من Firebase أو من الإضافة الأصلية أو من الشبكة) إلى كود ثابت. */
function mapFirebaseError(e) {
  const c = String(e?.code || e?.message || '');
  const msg = String(e?.message || '');

  // مهلة فرضناها نحن
  if (e?.isTimeout) return new AuthFlowError(e.code || GOOGLE_REASONS.timeout, msg);

  // ---- Fire OS / غياب Google Play Services (سبب رفض Amazon) ----
  if (
    /Google Play services (isn't|is not) available|SERVICE_MISSING|GooglePlayServicesNotAvailable|GooglePlayServicesRepairable|no play services/i.test(
      c + ' ' + msg,
    )
  ) {
    return new AuthFlowError('play_services_missing', msg);
  }
  // الإضافة الأصلية غير مسجّلة/غير قابلة للتحميل (Firebase غير مهيّأ في الحزمة)
  if (/not implemented on android|not available on android|plugin.*not.*(found|loaded)|unimplemented/i.test(c + ' ' + msg)) {
    return new AuthFlowError('google_plugin_missing', msg);
  }

  if (/region enabled|SMS unable to be sent until this region/i.test(msg)) return new AuthFlowError('phone_region_disabled');
  if (/billing/i.test(c + msg)) return new AuthFlowError('phone_billing');
  if (c.includes('invalid-phone-number')) return new AuthFlowError('invalid_phone');
  if (c.includes('invalid-verification-code')) return new AuthFlowError('invalid_code');
  if (c.includes('code-expired')) return new AuthFlowError('code_expired');
  if (c.includes('too-many-requests') || c.includes('quota')) return new AuthFlowError('too_many_attempts');
  if (c.includes('operation-not-allowed')) return new AuthFlowError('provider_disabled');
  if (/not authorized to use Firebase Authentication|SHA-1|SHA-256|app-not-authorized|missing-client-identifier|Invalid PlayIntegrity|app not Recognized/i.test(c + ' ' + msg)) {
    return new AuthFlowError('app_not_authorized', msg);
  }
  if (c.includes('unauthorized-domain') || c.includes('invalid-app-credential')) return new AuthFlowError('domain_not_authorized');
  if (/invalid format|TOO_SHORT|TOO_LONG|INVALID_PHONE/i.test(msg)) return new AuthFlowError('invalid_phone');
  if (/verification code.*invalid|invalid-verification-code|INVALID_CODE/i.test(msg)) return new AuthFlowError('invalid_code');
  if (/expired/i.test(msg)) return new AuthFlowError('code_expired');
  if (/blocked all requests|unusual activity|too many|quota/i.test(msg)) return new AuthFlowError('too_many_attempts');
  if (/network|timeout|unreachable|offline/i.test(msg)) return new AuthFlowError('network');
  if (/cancel|12501|12502/i.test(c + ' ' + msg) && !/no credentials/i.test(msg)) return new AuthFlowError('cancelled');
  if (/no credentials|developer_error|DEVELOPER_ERROR|\b10\b\/?|28444|\[16\]/i.test(msg)) return new AuthFlowError('google_not_configured', msg);

  if (c.includes('network')) return new AuthFlowError('network');
  return new AuthFlowError('auth_provider_error', msg || c);
}

/**
 * تسجيل الدخول بـ Google.
 * النتيجة: {token,user} أو {needsProfile,...}، وترمي AuthFlowError عند الفشل
 * (بكود يمكن للواجهة تحويله إلى بديل البريد فورًا).
 */
export async function signInWithGoogle() {
  if (!Capacitor.isNativePlatform()) {
    // الويب: نافذة Firebase المنبثقة (Google يحجب صفحاته داخل WebView، لذا لا نستعملها هناك)
    try {
      const { auth, m } = await getFbAuth();
      const provider = new m.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const cred = await withTimeout(m.signInWithPopup(auth, provider), GOOGLE_ATTEMPT_TIMEOUT_MS, GOOGLE_REASONS.timeout);
      const idToken = await cred.user.getIdToken();
      m.signOut(auth).catch(() => {});
      return await api('auth/firebase', { method: 'POST', body: { idToken } });
    } catch (e) {
      if (e?.status || e instanceof AuthFlowError) throw e;
      throw mapFirebaseError(e);
    }
  }

  // ---- Android / Fire OS ----
  // 1) فحص الجهاز أولًا: لا نحاول Google على جهاز نعلم مسبقًا أنه لا يستطيع.
  const status = await googleSignInStatus();
  if (!status.attempt) {
    // سبب مفهوم للواجهة؛ 'ok' لا يحدث هنا، و'email_only' تعني: استخدم البريد
    const reason = status.reason === GOOGLE_REASONS.ok ? GOOGLE_REASONS.unavailable : status.reason;
    throw new AuthFlowError(reason);
  }

  let FirebaseAuthentication;
  try {
    ({ FirebaseAuthentication } = await import('@capacitor-firebase/authentication'));
  } catch {
    throw new AuthFlowError('google_plugin_missing');
  }

  const attempt = async (useCredentialManager) => {
    const res = await withTimeout(
      FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true, useCredentialManager }),
      GOOGLE_ATTEMPT_TIMEOUT_MS,
      GOOGLE_REASONS.timeout,
    );
    const idToken = res?.credential?.idToken;
    if (!idToken) throw new AuthFlowError('google_failed');
    return api('auth/google', { method: 'POST', body: { idToken } });
  };

  try {
    let firstError = null;
    try {
      return await attempt(true);
    } catch (e) {
      firstError = e;
      // إلغاء المستخدم أو نجاح المصادقة لا يُعاد
      if (e?.status) throw e;
      const code = e instanceof AuthFlowError ? e.code : mapFirebaseError(e).code;
      if (code === 'cancelled' || googleFailureNeedsEmailFallback(code) === false) throw e;
    }
    // المحاولة الثانية: شاشة Google الكلاسيكية (تعمل على أجهزة لا تدعم Credential Manager)
    try {
      return await attempt(false);
    } catch (e2) {
      if (e2?.status) throw e2;
      const err2 = e2 instanceof AuthFlowError ? e2 : mapFirebaseError(e2);
      // إن فشلت المحاولتان نُبلّغ بالسبب الأوضح (غياب Play Services أهم من الإلغاء)
      const err1 = firstError instanceof AuthFlowError ? firstError : mapFirebaseError(firstError);
      throw googleFailureNeedsEmailFallback(err1.code) ? err1 : err2;
    }
  } catch (e) {
    if (e?.status || e instanceof AuthFlowError) throw e;
    throw mapFirebaseError(e);
  }
}

/* ------------------------------------------------------------------ */
/* البريد الإلكتروني — عبر خادم NEXORA (لا يحتاج Play Services)        */
/* ------------------------------------------------------------------ */

/** تسجيل الدخول بالبريد/اسم المستخدم + كلمة المرور. */
export async function signInWithEmail(identifier, password) {
  return api('auth/login', { method: 'POST', body: { identifier, password }, token: null });
}

/** إنشاء حساب جديد بالبريد. */
export async function signUpWithEmail({ fullName, username, email, password }) {
  return api('auth/register', { method: 'POST', body: { fullName, username, email, password }, token: null });
}

/** إرسال رابط استعادة كلمة المرور. يعيد {sentTo} مع البريد المُقنَّع. */
export async function sendPasswordReset(identifier) {
  try {
    return await withTimeout(
      api('auth/reset', { method: 'POST', body: { identifier }, token: null }),
      RESET_TIMEOUT_MS,
      'network',
    );
  } catch (e) {
    if (e?.status) throw e;
    throw new AuthFlowError(e?.code || 'network');
  }
}

/* ------------------------------------------------------------------ */
/* الهاتف (Firebase SMS / بوابة NEXORA)                                */
/* ------------------------------------------------------------------ */
let verifier = null;
let nativeHandles = [];
function clearNative() {
  nativeHandles.forEach((h) => {
    try {
      h.remove();
    } catch {
      /* */
    }
  });
  nativeHandles = [];
}

/**
 * تحقّق الهاتف على أندرويد عبر Firebase Android SDK.
 * على Fire OS لا يوجد Play Integrity/Play Services، لذا نفشل مبكرًا بكود واضح.
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
      nativeHandles.push(
        await FirebaseAuthentication.addListener('phoneCodeSent', (ev) => {
          verificationId = ev.verificationId;
          if (!settled) {
            settled = true;
            resolve(confirm);
          }
        }),
      );
      nativeHandles.push(
        await FirebaseAuthentication.addListener('phoneVerificationFailed', (ev) => {
          const err = mapFirebaseError({ message: ev?.message || '' });
          if (!settled) {
            settled = true;
            reject(err);
          } else onError?.(err);
        }),
      );
      nativeHandles.push(
        await FirebaseAuthentication.addListener('phoneVerificationCompleted', async () => {
          try {
            autoResult = await exchange();
            if (!settled) {
              settled = true;
              resolve(confirm);
            }
            onAuto?.(autoResult);
          } catch (e) {
            const err = e?.status ? e : mapFirebaseError(e);
            if (!settled) {
              settled = true;
              reject(err);
            } else onError?.(err);
          }
        }),
      );
      await FirebaseAuthentication.signInWithPhoneNumber({ phoneNumber, skipNativeAuth: false, resendCode: !!resend, timeout: 60 });
    })().catch((e) => {
      if (!settled) {
        settled = true;
        reject(mapFirebaseError(e));
      }
    });
  });
}

/** إرسال رمز SMS. يعيد confirm(code). */
export async function sendPhoneCode(phoneNumber, containerId, opts = {}) {
  if (Capacitor.isNativePlatform()) {
    // لا نحاول حتى: بدون Play Services لا يمكن إكمال التحقق، فنعطي سببًا واضحًا للواجهة
    const status = await googleSignInStatus();
    if (status.env && status.env.playServices === false && status.env.firebaseConfigured === false) {
      throw new AuthFlowError('play_services_missing');
    }
    try {
      return await nativePhoneCode(phoneNumber, opts);
    } catch (e) {
      if (e?.status || e instanceof AuthFlowError) throw e;
      throw mapFirebaseError(e);
    }
  }
  try {
    const { auth, m } = await getFbAuth();
    if (verifier) {
      try {
        verifier.clear();
      } catch {
        /* */
      }
      verifier = null;
    }
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
    if (verifier) {
      try {
        verifier.clear();
      } catch {
        /* */
      }
      verifier = null;
    }
    throw mapFirebaseError(e);
  }
}

export { googleFailureNeedsEmailFallback, googleFailureIsSilent };
