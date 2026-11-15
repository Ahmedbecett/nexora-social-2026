/* Owner-supplied OnClick/Popunder tag (zone 310646). Website only; never the Android WebView.
   The tag runs with page privileges, including on sign-in and signed-in pages as requested. */
(() => {
  'use strict';

  const host = 'nexora-social-2026.vercel.app';
  const source = 'https://quge5.com/88/tag.min.js';
  const zone = '310646';

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

  function load() {
    if (!allowed() || document.getElementById('nx-monetag-onclick')) return;
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
