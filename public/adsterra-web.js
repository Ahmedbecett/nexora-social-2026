/* Owner-supplied Adsterra Native Banner. The external script has page privileges,
   including on sign-in and private chat as explicitly requested. Website only. */
(() => {
  'use strict';

  const host = 'nexora-social-2026.vercel.app';
  const zone = '5641403c5558334d50a26de1c90fe61d';
  const source = `https://bauval.org/21/${zone}`;
  const containerId = `container-${zone}`;
  const scriptId = 'nx-adsterra-native-script';
  let lastContainer = null;

  /* إيقاع المالك: انطباع واحد كل 30 دقيقة ثم يختفي بعد 15 ثانية.
     النافذة مشتركة مع AdSense (نفس المفتاح) فلا يتكدس إعلانان في نافذة واحدة. */
  const GATE_KEY = 'nx_web_ad_last';
  const WINDOW_MS = 30 * 60 * 1000;
  const HIDE_MS = 15000;
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
    } catch { return false; }
    return true;
  }

  function attach() {
    const container = document.getElementById(containerId);
    if (!container || container === lastContainer || !container.parentNode) return;
    if (!gateOpen()) return;               // نافذة الثلاثين دقيقة مغلقة
    markShown();                           // حجز النافذة لإظهار واحد فقط
    // The SPA replaces its auth view on sign-in. Request the new real view only
    // when its container changes, never on chat updates or every DOM mutation.
    document.getElementById(scriptId)?.remove();
    const script = document.createElement('script');
    script.id = scriptId;
    script.async = true;
    script.setAttribute('data-cfasync', 'false');
    script.src = source;
    script.referrerPolicy = 'strict-origin-when-cross-origin';
    lastContainer = container;
    container.parentNode.insertBefore(script, container);
    /* الإعلان يختفي بعد 15 ثانية، وتُعاد هيئة "لم يظهر بعد" للسماح بالظهور القادم */
    if (typeof setTimeout === 'function') {
      setTimeout(() => {
        document.getElementById(scriptId)?.remove();
        if (container.parentNode) container.textContent = '';
        lastContainer = null;
      }, HIDE_MS);
    }
  }

  function start() {
    if (!allowed() || window.__nxAdsterraNativeInit) return;
    window.__nxAdsterraNativeInit = true;
    const root = document.getElementById('root');
    if (root && typeof MutationObserver !== 'undefined') {
      new MutationObserver(attach).observe(root, { childList: true, subtree: true });
    }
    attach();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
