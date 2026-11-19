/* ==========================================================================
   NEXORA AI — منطق PWA الخالص (قابل للاختبار بلا متصفح)
   --------------------------------------------------------------------------
   التسجيل نفسه في src/pwa.js. هنا فقط القرارات:
     • هل المتصفح يدعم service worker؟
     • هل نسمح بالتسجيل في هذه البيئة؟ (HTTPS أو localhost، وليس Capacitor)
     • هل التحديث جاهز؟ وما رسالة الأخطاء المناسبة؟
   لا تُستورد أي قيمة من Vite هنا حتى تعمل الاختبارات في Node مباشرة.
   ========================================================================== */

/** مسار عام لملف الخدمة — من جذر النطاق ليغطي كل التطبيق. */
export const SERVICE_WORKER_URL = '/sw.js';

/** هل دعم service worker متاح أصلًا؟ */
export function isServiceWorkerSupported(nav) {
  try {
    return Boolean(nav && 'serviceWorker' in nav && typeof nav.serviceWorker.register === 'function');
  } catch {
    return false;
  }
}

/** هل النطاق آمن بما يكفي للتسجيل؟ localhost مسموح استثناءً. */
export function isTrustedPwaOrigin({ isSecureContext = false, hostname = '' } = {}) {
  if (isSecureContext) return true;
  const host = String(hostname || '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

/**
 * قرار التسجيل النهائي.
 * @param {object} options
 * @param {boolean} options.supported     دعم المتصفح
 * @param {boolean} options.nativeShell   داخل Capacitor (يُمنع دائمًا)
 * @param {boolean} options.production    بناء إنتاجي
 * @param {boolean} options.devOverride   nx_sw_dev=1 للتجربة المحلية
 * @param {boolean} options.isSecureContext
 * @param {string}  options.hostname
 * @param {string}  options.protocol      https: أو http:
 * @returns {{allowed: boolean, reason: string}}
 */
export function serviceWorkerDecision({
  supported = false,
  nativeShell = false,
  production = false,
  devOverride = false,
  isSecureContext = false,
  hostname = '',
  protocol = 'https:',
} = {}) {
  if (!supported) return { allowed: false, reason: 'unsupported' };
  if (nativeShell) return { allowed: false, reason: 'native-shell' };
  if (!isTrustedPwaOrigin({ isSecureContext, hostname })) return { allowed: false, reason: 'insecure-origin' };
  if (!production && !devOverride) return { allowed: false, reason: 'development' };
  if (protocol && protocol !== 'https:' && !/^(localhost|127\.0\.0\.1|\[::1\])$/i.test(hostname)) {
    return { allowed: false, reason: 'insecure-origin' };
  }
  return { allowed: true, reason: 'ok' };
}

/** هل هذه الرسالة تعني أن المتصفح وجد نسخة جديدة جاهزة؟ */
export function isUpdateReadyState(state) {
  return state === 'installed';
}

/**
 * رسالة قصيرة لمستخدم Windows عند تعذّر التثبيت (تُعرض في صفحة /windows/).
 * لا نعرض أي تفاصيل تقنية في الواجهة العامة.
 */
export function installHint({ supported = false, installed = false, standalone = false } = {}) {
  if (installed || standalone) return 'already-installed';
  if (!supported) return 'manual-install';
  return 'prompt-available';
}

export default {
  SERVICE_WORKER_URL,
  isServiceWorkerSupported,
  isTrustedPwaOrigin,
  serviceWorkerDecision,
  isUpdateReadyState,
  installHint,
};
