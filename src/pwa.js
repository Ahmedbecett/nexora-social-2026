/* ==========================================================================
   NEXORA AI — تسجيل PWA + تحديثات + تثبيت على Windows
   --------------------------------------------------------------------------
   لا يعمل هذا الملف على تطبيق أندرويد (Capacitor) إطلاقًا: الحزمة مدمجة،
   وservice worker داخل WebView سيزاحم الأصول المخزّنة. القرار في pwaCore.js
   وقابل للاختبار بلا متصفح.
   ========================================================================== */

import { SERVICE_WORKER_URL, serviceWorkerDecision, isServiceWorkerSupported } from './pwaCore.js';
import { isCapacitorNative } from './platform.js';

export const SW_UPDATE_EVENT = 'nx-sw-update';
export const INSTALL_AVAILABLE_EVENT = 'nx-install-available';

let waitingWorker = null;
let refreshing = false;
let deferredInstallPrompt = null;

function devOverride(win) {
  try {
    return win.localStorage.getItem('nx_sw_dev') === '1';
  } catch {
    return false;
  }
}

function notifyUpdate(reg) {
  waitingWorker = (reg && reg.waiting) || waitingWorker;
  try {
    window.dispatchEvent(new CustomEvent(SW_UPDATE_EVENT, { detail: { ready: Boolean(waitingWorker) } }));
  } catch { /* بيئات مقيدة */ }
}

/**
 * يسجّل service worker على الويب فقط.
 * @returns {Promise<{registered:boolean, reason:string, registration?:ServiceWorkerRegistration}>}
 */
export async function registerServiceWorker({ win, nav } = {}) {
  if (typeof window === 'undefined') return { registered: false, reason: 'no-window' };
  const w = win || window;
  const n = nav || w.navigator;
  const decision = serviceWorkerDecision({
    supported: isServiceWorkerSupported(n),
    nativeShell: isCapacitorNative(w),
    production: Boolean(import.meta.env && import.meta.env.PROD),
    devOverride: devOverride(w),
    isSecureContext: Boolean(w.isSecureContext),
    hostname: w.location ? w.location.hostname : '',
    protocol: w.location ? w.location.protocol : '',
  });
  if (!decision.allowed) return { registered: false, reason: decision.reason };

  try {
    const registration = await n.serviceWorker.register(SERVICE_WORKER_URL, { scope: '/' });
    // نسخة تنتظر التفعيل من زيارة سابقة
    if (registration.waiting && n.serviceWorker.controller) notifyUpdate(registration);

    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed' && n.serviceWorker.controller) notifyUpdate(registration);
      });
    });

    // إعادة تحميل واحدة فقط بعد استلام النسخة الجديدة
    n.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      if (!waitingWorker) return; // أول تثبيت: لا حاجة لإعادة التحميل
      try { w.location.reload(); } catch { /* ignore */ }
    });

    try { n.serviceWorker.startMessages(); } catch { /* غير مدعوم */ }
    return { registered: true, reason: 'ok', registration };
  } catch (err) {
    return { registered: false, reason: 'register-failed', error: err };
  }
}

/** يعرض شريط التحديث عندما تصبح نسخة جديدة جاهزة. */
export function onServiceWorkerUpdate(handler) {
  if (typeof window === 'undefined' || typeof handler !== 'function') return () => {};
  const listener = (e) => handler(e);
  window.addEventListener(SW_UPDATE_EVENT, listener);
  // قد يكون التحديث جاهزًا قبل تركيب المكوّن
  if (waitingWorker) handler({ detail: { ready: true } });
  return () => window.removeEventListener(SW_UPDATE_EVENT, listener);
}

/** يفعّل النسخة المنتظرة ويترك المتصفح يعيد التحميل مرة واحدة. */
export async function applyServiceWorkerUpdate({ win } = {}) {
  if (typeof navigator === 'undefined') return false;
  const w = win || (typeof window !== 'undefined' ? window : null);
  try {
    const reg = await w.navigator.serviceWorker.getRegistration();
    const worker = (reg && reg.waiting) || waitingWorker;
    if (!worker) return false;
    waitingWorker = worker;
    worker.postMessage({ type: 'NX_SKIP_WAITING' });
    return true;
  } catch {
    return false;
  }
}

/** فحص يدوي من قائمة Windows: يعيد true إن وُجد تحديث. */
export async function checkForServiceWorkerUpdate({ win } = {}) {
  if (typeof navigator === 'undefined') return false;
  const w = win || (typeof window !== 'undefined' ? window : null);
  try {
    const reg = await w.navigator.serviceWorker.getRegistration();
    if (!reg) return false;
    await reg.update();
    if (reg.waiting) {
      waitingWorker = reg.waiting;
      notifyUpdate(reg);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/* ------------------------------- التثبيت -------------------------------- */

/** يلتقط beforeinstallprompt مبكرًا (قبل أن يرسم React). آمن على كل الأجهزة. */
export function initInstallPrompt({ win } = {}) {
  if (typeof window === 'undefined' || isCapacitorNative()) return;
  const w = win || window;
  w.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    try { w.dispatchEvent(new CustomEvent(INSTALL_AVAILABLE_EVENT)); } catch { /* ignore */ }
  });
  w.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    try { w.dispatchEvent(new CustomEvent('nx-installed')); } catch { /* ignore */ }
  });
}

export function canPromptInstall() {
  return Boolean(deferredInstallPrompt);
}

/** يعرض نافذة التثبيت الأصلية. يعيد 'accepted' | 'dismissed' | 'unavailable'. */
export async function promptInstall() {
  if (!deferredInstallPrompt) return 'unavailable';
  try {
    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    const outcome = choice && choice.outcome;
    deferredInstallPrompt = null;
    return outcome === 'accepted' ? 'accepted' : 'dismissed';
  } catch {
    deferredInstallPrompt = null;
    return 'unavailable';
  }
}

export function isPwaInstalled(win = typeof window !== 'undefined' ? window : null) {
  if (!win) return false;
  try {
    if (win.matchMedia('(display-mode: standalone)').matches) return true;
    if (win.matchMedia('(display-mode: window-controls-overlay)').matches) return true;
    return Boolean(win.navigator.standalone);
  } catch {
    return false;
  }
}
