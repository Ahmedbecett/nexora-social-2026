/* ==========================================================================
   NEXORA AI — سياسة تسجيل الدخول (منطق نقي بلا اعتماديات)
   ملف مستقل حتى يمكن اختباره في Node بدون WebView ولا Capacitor.

   الخلفية: رفضت Amazon Appstore النسخة 43 لأن زر «Continue with Google» لا يستجيب
   على Fire OS. السبب الحقيقي: الإضافة الأصلية لا تُحمَّل/لا تُهيَّأ على الأجهزة التي
   لا تتوفّر فيها Google Play Services (أو التي بُنيت بدون google-services.json)،
   فيبقى وعد JavaScript معلّقًا إلى الأبد وشاشة التحميل لا تنتهي.

   القاعدة هنا: لا نبدأ محاولة Google إلا إذا كان الجهاز قادرًا فعليًا،
   ونضع حدًّا زمنيًا لكل محاولة، ونحوّل أي فشل إلى مسار واضح نحو البريد الإلكتروني.
   ========================================================================== */

/** أسباب عدم توفّر Google Sign-In (تُستخدم كنصوص تشخيص، لا تُعرض خامًا للمستخدم). */
export const GOOGLE_REASONS = {
  ok: 'ok',
  fireOs: 'fire_os_no_play_services',
  noPlayServices: 'no_play_services',
  firebaseNotConfigured: 'firebase_not_configured',
  webClientNotConfigured: 'web_client_not_configured',
  unsupportedPlatform: 'unsupported_platform',
  diagnosticsFailed: 'diagnostics_failed',
  timeout: 'google_timeout',
  emailOnly: 'email_only',
  unavailable: 'unavailable',
};

/** أكواد أخطاء Google التي تعني «هذا الجهاز/النسخة لا تستطيع الدخول عبر Google» فورًا. */
const GOOGLE_FALLBACK_CODES = new Set([
  'google_not_configured',
  'google_failed',
  'google_timeout',
  'google_plugin_missing',
  'play_services_missing',
  'fire_os_no_play_services',
  'no_play_services',
  'firebase_not_configured',
  'web_client_not_configured',
  'app_not_authorized',
  'provider_disabled',
  'unsupported_platform',
  'diagnostics_failed',
  'email_only',
  'unavailable',
]);

/** أكواد تعني أن المستخدم ألغى بنفسه: لا رسالة خطأ ولا شاشة بديل. */
const CANCEL_CODES = new Set(['cancelled']);

/** هل نُظهر للمستخدم شاشة «Google غير متاح على هذا الجهاز — استخدم البريد»؟ */
export function googleFailureNeedsEmailFallback(code) {
  if (!code) return false;
  if (CANCEL_CODES.has(code)) return false;
  if (GOOGLE_FALLBACK_CODES.has(code)) return true;
  // أي فشل غير معروف في مسار Google لا يجب أن يترك الزر بلا استجابة
  return code === 'auth_provider_error' || code === 'server_error';
}

/** هل الخطأ يستحق رسالة (لا صامتًا)؟ */
export function googleFailureIsSilent(code) {
  return CANCEL_CODES.has(code);
}

/**
 * يقرّر ما إذا كان زر Google يجب أن يُحاوَل على هذا الجهاز.
 * `env` هو ناتج الإضافة الأصلية NexoraAuth.getAuthEnvironment (أو null إن فشل الفحص).
 * القاعدة: الشك ⟹ نصفه «غير متاح» حتى لا نُعلّق الواجهة، مع إتاحة إعادة المحاولة يدويًا.
 */
export function decideGoogleAvailability(env) {
  if (!env || typeof env !== 'object') {
    return { attempt: false, available: false, reason: GOOGLE_REASONS.diagnosticsFailed };
  }
  if (env.platform && env.platform !== 'android') {
    return { attempt: false, available: false, reason: GOOGLE_REASONS.unsupportedPlatform };
  }
  // playServices === null يعني أن الفحص نفسه فشل؛ والفشل ليس دليلًا على التوفّر
  if (env.googleSignInAvailable === true && env.playServices === true) {
    return { attempt: true, available: true, reason: GOOGLE_REASONS.ok };
  }
  let reason = typeof env.reason === 'string' && env.reason ? env.reason : GOOGLE_REASONS.unavailable;
  if (env.playServices === null) reason = GOOGLE_REASONS.diagnosticsFailed;
  else if (env.playServices === false) reason = env.fireOs ? GOOGLE_REASONS.fireOs : GOOGLE_REASONS.noPlayServices;
  else if (env.firebaseConfigured === false) reason = GOOGLE_REASONS.firebaseNotConfigured;
  else if (env.webClientConfigured === false) reason = GOOGLE_REASONS.webClientNotConfigured;
  else if (env.googleSignInAvailable === true) {
    // الإضافة تؤكد التوفّر رغم أن الفحص المسبق لم يُنفَّذ (مكتبة Play Services تُحمَّل عند الطلب)
    return { attempt: true, available: true, reason: GOOGLE_REASONS.ok };
  }
  return { attempt: false, available: false, reason };
}

/** هل الدخول بالبريد متاح؟ (يعتمد على خادم NEXORA فقط — لا Google ولا Play Services) */
export function emailSignInAvailable(env) {
  if (!env || typeof env !== 'object') return true; // الافتراضي: متاح دائمًا
  return env.emailSignInAvailable !== false;
}

/**
 * يغلّف وعدًا بحدّ زمني صارم. عند التجاوز يُرفض الوعد بالكود المطلوب
 * (ولا يهمّ إن نجح الأصل لاحقًا: النتيجة تُهمَل).
 */
export function withTimeout(promise, ms, code = GOOGLE_REASONS.timeout) {
  if (!(ms > 0)) return promise;
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(code);
      err.code = code;
      err.isTimeout = true;
      reject(err);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** بريد مُطبَّع للإرسال إلى الخادم. */
export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function isValidEmail(value) {
  const v = normalizeEmail(value);
  return v.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

/** كلمة المرور المقبولة في الخادم: 6 أحرف على الأقل (auth/register). */
export function isValidNewPassword(value) {
  return String(value || '').length >= 6;
}
