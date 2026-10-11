// AdMob banner (Android app only).
// The banner unit id comes from GET /api/app/config, so ads can be turned on, changed or
// switched off from the server without shipping a new APK. No unit id => no ads at all.
// The banner sits just above the system navigation bar; the web UI is lifted by --ad-h so
// the bottom nav stays fully visible above the ad.
import { Capacitor } from '@capacitor/core';
import { api } from './api.js';

let AdMob = null, enums = null;
let unit = null;
let ready = false, created = false, visible = false;
let wanted = false, blocked = false;
let height = 0;
let chain = Promise.resolve();

function setVar() {
  const h = visible ? Math.max(0, Math.min(120, Math.round(height))) : 0;
  document.documentElement.style.setProperty('--ad-h', `${h}px`);
}

export async function initAds() {
  if (!Capacitor.isNativePlatform() || ready) return;
  try {
    const cfg = await api('app/config');
    unit = cfg?.ads?.enabled ? (cfg.ads.androidBanner || '').trim() : '';
    if (!/^ca-app-pub-\d+\/\d+$/.test(unit)) return; // not configured -> no ads
    const mod = await import('@capacitor-community/admob');
    AdMob = mod.AdMob; enums = mod;
    await AdMob.initialize({});
    // GDPR / privacy consent where Google requires it (no-op elsewhere)
    try {
      const ci = await AdMob.requestConsentInfo();
      if (ci?.isConsentFormAvailable && ci?.status === mod.AdmobConsentStatus.REQUIRED) await AdMob.showConsentForm();
    } catch { /* consent not configured: fine */ }
    AdMob.addListener(mod.BannerAdPluginEvents.SizeChanged, (s) => { height = s?.height || 0; setVar(); });
    AdMob.addListener(mod.BannerAdPluginEvents.FailedToLoad, () => { height = 0; setVar(); });
    ready = true;
    watchOverlays();
    apply();
  } catch { ready = false; }
}

/** Screens tell us whether a banner is allowed right now. */
export function setAdSlot(on) { wanted = !!on; apply(); }

function apply() {
  if (!ready) return;
  chain = chain.then(async () => {
    const show = wanted && !blocked;
    try {
      if (show && !created) {
        await AdMob.showBanner({
          adId: unit,
          adSize: enums.BannerAdSize.ADAPTIVE_BANNER,
          position: enums.BannerAdPosition.BOTTOM_CENTER,
          margin: 0,
        });
        created = true; visible = true;
      } else if (show && !visible) {
        await AdMob.resumeBanner(); visible = true;
      } else if (!show && visible) {
        visible = false; setVar();
        await AdMob.hideBanner();
      }
    } catch { /* ignore */ }
    setVar();
  });
}

// Hide the native banner while a bottom sheet / dialog is open or the keyboard is up,
// because a native view would otherwise cover them.
function watchOverlays() {
  const check = () => {
    const a = document.activeElement;
    const typing = !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable);
    const b = typing || !!document.querySelector('.sheet-wrap, .dialog-wrap, .upload-overlay');
    if (b !== blocked) { blocked = b; apply(); }
  };
  let raf = 0;
  const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; check(); }); };
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('focusin', schedule);
  document.addEventListener('focusout', () => setTimeout(schedule, 50));
}
