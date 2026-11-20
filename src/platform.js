/* ==========================================================================
   NEXORA AI — كشف المنصّة والسطح (Windows / PWA / MSIX / Android)
   --------------------------------------------------------------------------
   لماذا ملف مستقل؟ لأن قرارات كثيرة تعتمد على «أين يعمل التطبيق الآن»:
     • خدمة العمل (service worker) تُسجَّل على الويب فقط — لا داخل Capacitor.
     • شريط عنوان Windows (Window Controls Overlay) يظهر في PWA المثبّت فقط.
     • الإعلانات تُفعَّل بحسب السطح، ولا تُحمَّل أبدًا داخل MSIX قبل التحقق.
     • قائمة السياق الأصلية تُترك للمتصفح على Windows، وتُمنع في تطبيق أندرويد.

   السطح لا يُخمَّن من User-Agent وحده: حزمة MSIX التي ينتجها PWABuilder تعمل
   داخل WebView2 وتفتح نفس رابط الإنتاج. لذلك نقرأ معاملًا صريحًا
   (?nx_surface=msix) يضعه ملف الحزمة في صفحة البدء، ونحفظه في sessionStorage
   حتى لا يضيع عند التنقل. أي كشف آخر يبقى «أفضل تقدير» ولا يُستخدم لقرار
   أمني أو مالي.
   ========================================================================== */

import { Capacitor } from '@capacitor/core';

const SURFACE_KEY = 'nx_surface';
const WINDOWS = /Windows/i;

function nav(win) {
  return (win && win.navigator) || (typeof navigator !== 'undefined' ? navigator : null);
}

/** هل نعمل داخل غلاف Capacitor (تطبيق أندرويد)؟ */
export function isCapacitorNative(win = typeof window !== 'undefined' ? window : null) {
  if (!win) return false;
  try {
    if (win.Capacitor && win.Capacitor.isNativePlatform && win.Capacitor.isNativePlatform()) return true;
    if (win.location && win.location.protocol === 'capacitor:') return true;
    // fallback: الحزمة الأصلية قد لا تُعرّض window.Capacitor في بعض الإصدارات
    return Boolean(Capacitor && typeof Capacitor.isNativePlatform === 'function' && Capacitor.isNativePlatform());
  } catch {
    return false;
  }
}

/** هل النظام Windows؟ (لا يعني بالضرورة أنه مثبّت كتطبيق) */
export function isWindows(win = typeof window !== 'undefined' ? window : null) {
  const n = nav(win);
  if (!n) return false;
  try {
    if (n.userAgentData && typeof n.userAgentData.platform === 'string') {
      return WINDOWS.test(n.userAgentData.platform);
    }
  } catch { /* ignore */ }
  return WINDOWS.test(n.platform || '') || WINDOWS.test(n.userAgent || '');
}

/** وضع العرض الحالي: browser | standalone | window-controls-overlay | … */
export function displayMode(win = typeof window !== 'undefined' ? window : null) {
  if (!win || typeof win.matchMedia !== 'function') return 'browser';
  const modes = ['window-controls-overlay', 'standalone', 'minimal-ui', 'fullscreen', 'tabbed'];
  for (const mode of modes) {
    try {
      if (win.matchMedia(`(display-mode: ${mode})`).matches) return mode;
    } catch { /* ignore */ }
  }
  return 'browser';
}

/** هل التطبيق مثبّت/يعمل كنافذة مستقلة؟ (PWA أو MSIX) */
export function isStandalone(win = typeof window !== 'undefined' ? window : null) {
  const mode = displayMode(win);
  if (mode !== 'browser') return true;
  try {
    return Boolean(win && win.navigator && win.navigator.standalone);
  } catch {
    return false;
  }
}

/**
 * السطح الفعلي للتشغيل:
 *   android        — تطبيق Capacitor
 *   windows-msix   — حزمة Microsoft Store (تُعلَن صراحةً في رابط البدء)
 *   windows-pwa    — PWA مثبّت على Windows
 *   windows-browser— Windows في المتصفح العادي
 *   web            — أي متصفح آخر
 */
export function runtimeSurface(win = typeof window !== 'undefined' ? window : null) {
  if (!win) return 'web';
  if (isCapacitorNative(win)) return 'android';

  let announced = '';
  try {
    const q = new URLSearchParams(win.location.search).get('nx_surface');
    if (q) {
      announced = String(q).toLowerCase();
      win.sessionStorage.setItem(SURFACE_KEY, announced);
    } else {
      announced = win.sessionStorage.getItem(SURFACE_KEY) || '';
    }
  } catch { /* بيئات مقيدة */ }

  if (announced === 'msix') return 'windows-msix';
  if (!isWindows(win)) return 'web';
  return isStandalone(win) ? 'windows-pwa' : 'windows-browser';
}

/** هل نعمل كتطبيق Windows (PWA مثبّت أو MSIX)؟ */
export function isWindowsApp(win = typeof window !== 'undefined' ? window : null) {
  const surface = runtimeSurface(win);
  return surface === 'windows-pwa' || surface === 'windows-msix';
}

/** هل واجهة Window Controls Overlay متاحة ومفعّلة؟ */
export function supportsWindowControlsOverlay(win = typeof window !== 'undefined' ? window : null) {
  try {
    return Boolean(win && win.navigator && win.navigator.windowControlsOverlay);
  } catch {
    return false;
  }
}

/** هل حزمة Microsoft Store أعلنت نفسها؟ (قرار إعلانات/سياسات فقط) */
export function isMsixSurface(win = typeof window !== 'undefined' ? window : null) {
  return runtimeSurface(win) === 'windows-msix';
}
