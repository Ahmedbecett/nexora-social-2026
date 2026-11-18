/* ==========================================================================
   NEXORA AI — كاشف التحديثات (السبب الجذري لشكوى «ما زالت الصفحة القديمة»)
   --------------------------------------------------------------------------
   المشكلة: بعد كل نشر، من زار الموقع سابقًا قد يبقى على نسخة قديمة من صفحة
   الدخول (index.html) أو من حزمة JS محفوظة في متصفحه — يرى واجهة قديمة ويظن
   أن التحديث لم يصل، بينما الخادم يقدّم أحدث نسخة.

   الحل هنا:
     • كل بناء يحمل BUILD_ID (commit النشر) ويُكتب في /version.json عند البناء.
     • التطبيق يفحص /version.json عند التحميل وعند العودة إلى التبويب وكل خمس
       دقائق؛ إذا اختلف المعرّف يظهر شريط «تحديث جديد متاح» بزر يعيد التحميل
       مع ?v=BUILD_ID — رابط جديد يتجاوز أي نسخة محفوظة في الكاش.
   ========================================================================== */

import { APP_VERSION } from './version.js';

/** معرّف البناء الحالي المدمج في هذه الحزمة (commit النشر أو طابع زمني). */
export const BUILD_ID = import.meta.env.VITE_BUILD_ID || 'dev';

/** رقم إصدار التطبيق المدمج في هذه الحزمة (نفس مصدر src/version.js). */
export const BUILD_VERSION = APP_VERSION;

/** الفاصل الافتراضي بين فحصين متتاليين. */
export const UPDATE_CHECK_INTERVAL = 5 * 60 * 1000;

/** هل نعمل داخل تطبيق أندرويد (الحزمة مدمجة، فلا معنى لفحص التحديث)؟ */
export function isNativeShell() {
  if (typeof window === 'undefined') return false;
  try {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  } catch {
    return false;
  }
}

/**
 * يقرأ أحدث معرّف بناء منشور من /version.json دون أي كاش.
 * يعيد null عند أي فشل (شبكة، JSON تالف، أو ملف غير موجود) — لا يعطّل التطبيق.
 */
export async function fetchLatestBuild(fetchImpl) {
  const doFetch = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!doFetch) return null;
  try {
    const res = await doFetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res || !res.ok) return null;
    const data = await res.json();
    if (!data || typeof data.buildId !== 'string' || !data.buildId) return null;
    return data;
  } catch {
    return null;
  }
}

/** هل النسخة المنشورة أحدث من النسخة التي تعمل الآن؟ */
export function isStale(latest, current = BUILD_ID) {
  if (!latest || typeof latest.buildId !== 'string' || !latest.buildId) return false;
  if (!current || current === 'dev') return false;
  return latest.buildId !== current;
}

/**
 * يعيد تحميل الصفحة من رابط جديد (?v=BUILD_ID) — يتجاوز أي HTML قديم محفوظ
 * في المتصفح أو في متصفح تطبيق التواصل الاجتماعي.
 */
export function reloadWithLatest(buildId = '', locationImpl) {
  const loc = locationImpl || (typeof window !== 'undefined' ? window.location : null);
  if (!loc) return;
  let url;
  try {
    url = new URL(loc.href);
  } catch {
    url = new URL('/?v=' + encodeURIComponent(buildId || '1'), 'https://nexora-social-2026.vercel.app');
  }
  url.searchParams.set('v', buildId || Date.now().toString(36));
  loc.replace(url.toString());
}

/**
 * يراقب التحديثات: فحص فوري + عند عودة التبويب/النافذة + كل مدة محددة.
 * يعيد دالة لإيقاف المراقبة. onUpdate يُنادى مرة واحدة فقط.
 */
export function watchForUpdates(onUpdate, options = {}) {
  const {
    interval = UPDATE_CHECK_INTERVAL,
    current = BUILD_ID,
    fetchImpl,
    win = typeof window !== 'undefined' ? window : null,
    doc = typeof document !== 'undefined' ? document : null,
  } = options;

  if (!win || typeof onUpdate !== 'function' || isNativeShell()) return () => {};

  let stopped = false;
  let notified = false;
  let checking = false;
  let timer = null;

  const check = async () => {
    if (stopped || notified || checking) return;
    checking = true;
    const latest = await fetchLatestBuild(fetchImpl);
    checking = false;
    if (stopped || notified) return;
    if (isStale(latest, current)) {
      notified = true;
      onUpdate(latest);
      stop();
    }
  };

  const onFocus = () => { check(); };
  const onVisible = () => { if (!doc || doc.visibilityState === 'visible') check(); };

  function stop() {
    stopped = true;
    if (timer) clearInterval(timer);
    timer = null;
    win.removeEventListener('focus', onFocus);
    win.removeEventListener('online', onFocus);
    if (doc) doc.removeEventListener('visibilitychange', onVisible);
  }

  win.addEventListener('focus', onFocus);
  win.addEventListener('online', onFocus);
  if (doc) doc.addEventListener('visibilitychange', onVisible);
  timer = setInterval(check, interval);
  if (timer && typeof timer.unref === 'function') timer.unref();
  check();

  return stop;
}

export default { BUILD_ID, BUILD_VERSION, fetchLatestBuild, isStale, reloadWithLatest, watchForUpdates };
