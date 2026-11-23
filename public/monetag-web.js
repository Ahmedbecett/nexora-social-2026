/* Owner-supplied OnClick/Popunder tag (zone 310646). Website only; never the Android WebView.
   The tag runs with page privileges, including on sign-in and signed-in pages as requested. */
(() => {
  'use strict';

  const host = 'nexora-social-2026.vercel.app';
  const source = 'https://quge5.com/88/tag.min.js';
  const zone = '310646';

  /* إيقاع المالك: OnClick واحد كحد أقصى كل 30 دقيقة (مفتاح مستقل عن البانرات) */
  const GATE_KEY = 'nx_pop_ad_last';
  const WINDOW_MS = 30 * 60 * 1000;
  function gateOpen() {
    try { return Date.now() - Number(localStorage.getItem(GATE_KEY) || 0) >= WINDOW_MS; } catch { return true; }
  }
  function markShown() {
    try { localStorage.setItem(GATE_KEY, String(Date.now())); } catch { /* بيئات مقيدة */ }
  }

  function allowed() {
    if (location.protocol !== 'https:' || location.hostname !== host) return false;
    if (navigator.globalPrivacyControl === true) return false;
    if (/NexoraAI/i.test(navigator.userAgent || '')) return false;
    if (document.documentElement.classList.contains('native')) return false;
    try {
      if (window.Capacitor?.isNativePlatform?.()) return false;
      // Exclude Windows Store MSIX native WebView2 host (official MG Ads SDK only)
      if (document.documentElement.dataset?.nxNativeHost === 'webview2-mgads') return false;
      if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('nx_surface') === 'msix') return false;
      if (typeof URLSearchParams !== 'undefined' && new URLSearchParams(location.search || '').get('nx_surface') === 'msix') return false;
    } catch { return false; }
    return true;
  }

  function load() {
    if (!allowed() || document.getElementById('nx-monetag-onclick')) return;
    if (!gateOpen()) return;               // نافذة الثلاثين دقيقة مغلقة
    markShown();                           // تحميل واحد فقط داخل النافذة
    const script = document.createElement('script');
    script.id = 'nx-monetag-onclick';
    script.src = source;
    script.dataset.zone = zone;
    script.async = true;
    script.setAttribute('data-cfasync', 'false');
    script.referrerPolicy = 'strict-origin-when-cross-origin';
    document.head.appendChild(script);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load, { once: true });
  } else {
    load();
  }
})();
