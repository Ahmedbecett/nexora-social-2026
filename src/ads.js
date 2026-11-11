/* ==========================================================================
   NEXORA AI — إدارة إعلانات Google AdMob (Android فقط؛ الويب لا يعرض AdMob أبدًا)
   - Banner  : على شاشة الترحيب فقط، يظهر فوق شريط التنقل السفلي.
   - Interstitial (بيني): مرة واحدة كحد أقصى كل 10 دقائق، وبحد 3 مرات يوميًا،
     وعند انتقال طبيعي فقط (محادثة جديدة) — وفقط بينما لا توجد محادثة جارية
     ولا تسجيل/إجابة صوتية ولا نوافذ مفتوحة.
   - Rewarded (مكافأة): اختياري بطلب المستخدم — تُمنح فقط بعد حدث Rewarded
     من AdMob، وتكافئ «يومًا بلا إعلانات بينية».
   - الموافقة GDPR/UMP: تُطلب أولًا عند الإقلاع حيث تفرضها Google.
   - وضع الاختبار: في بيئة التطوير (vite dev)
     تُستعمل معرّفات Google الاختبارية الرسمية تلقائيًا. الإنتاج يستعمل
     معرّفات الإنتاج فقط (لا إعلانات اختبارية في الإصدار النهائي).
   ========================================================================== */
import { Capacitor } from '@capacitor/core';
import { api } from './api.js';

// Release builds must never inherit test ads from a previous localStorage setting.
const DEV_BUILD = import.meta.env.DEV;

/* معرّفات الإنتاج الرسمية من حساب AdMob (عامة بطبيعتها — ليست أسرارًا) */
const PROD_UNITS = {
  appId: 'ca-app-pub-6858364141205978~7081673739',
  banner: 'ca-app-pub-6858364141205978/1001361442',
  interstitial: 'ca-app-pub-6858364141205978/2374152863',
  rewarded: 'ca-app-pub-6858364141205978/5160098300',
};
/* معرّفات Google الاختبارية الرسمية — للتطوير فقط */
const TEST_UNITS = {
  appId: 'ca-app-pub-3940256099942544~3347511713',
  banner: 'ca-app-pub-3940256099942544/6300978111',
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
  rewarded: 'ca-app-pub-3940256099942544/5224354917',
};
const UNITS = DEV_BUILD ? TEST_UNITS : PROD_UNITS;

const INTER_MAX_PER_DAY = 3;
const INTER_MIN_GAP_MS = 10 * 60 * 1000;
const APP_GRACE_MS = 2 * 60 * 1000;
const FREE_UNTIL_KEY = 'nx_ads_inter_free_until';
const INTER_STATE_KEY = 'nx_interstitial_state';

let AdMob = null, mod = null;
let adsReady = false;
let bannerUnit = null, interstitialUnit = null, rewardedUnit = null;
let bannerOn = false, interstitialOn = false, rewardedOn = false;
const bootTime = Date.now();

/* ---------- البانر ---------- */
let bannerCreated = false, bannerVisible = false, bannerWanted = false, bannerBlocked = false;
let bannerHeight = 0;
let chain = Promise.resolve();

function setVar() {
  const h = bannerVisible ? Math.max(0, Math.min(120, Math.round(bannerHeight))) : 0;
  document.documentElement.style.setProperty('--ad-h', `${h}px`);
}
export async function initAds() {
  if (!Capacitor.isNativePlatform() || adsReady) return;
  try {
    let cfg = null;
    try { cfg = await api('app/config'); } catch { cfg = null; }
    const ads = (cfg && cfg.ads) || {};
    adsReady = false;
    bannerOn = ads.enabled !== false;
    interstitialOn = ads.enabled !== false && ads.interstitialEnabled !== false;
    rewardedOn = ads.enabled !== false && ads.rewardedEnabled !== false;
    // الخادم يستطيع تجاوز أي وحدة (أو إطفاءها بنص فارغ) دون بناء APK جديد
    let b = typeof ads.androidBanner === 'string' ? ads.androidBanner.trim() : '';
    let i = typeof ads.androidInterstitial === 'string' ? ads.androidInterstitial.trim() : '';
    let r = typeof ads.androidRewarded === 'string' ? ads.androidRewarded.trim() : '';
    bannerUnit = /^ca-app-pub-\d+\/\d+$/.test(b) ? b : UNITS.banner;
    interstitialUnit = /^ca-app-pub-\d+\/\d+$/.test(i) ? i : UNITS.interstitial;
    rewardedUnit = /^ca-app-pub-\d+\/\d+$/.test(r) ? r : UNITS.rewarded;
    const anyEnabled = [bannerUnit, interstitialUnit, rewardedUnit].some(Boolean);
    if (!anyEnabled) return;
    if (!bannerOn) bannerUnit = null;
    if (!interstitialOn) interstitialUnit = null;
    if (!rewardedOn) rewardedUnit = null;

    mod = await import('@capacitor-community/admob');
    AdMob = mod.AdMob;
    await AdMob.initialize({ initializeForTesting: DEV_BUILD });
    // GDPR / UMP — الموافقة حيث تفرضها Google (لا تظهر في المناطق الأخرى)
    try {
      const ci = await AdMob.requestConsentInfo();
      if (ci?.isConsentFormAvailable && ci?.status === mod.AdmobConsentStatus.REQUIRED) await AdMob.showConsentForm();
    } catch { /* الموافقة غير مهيأة في تلك المنطقة — لا مشكلة */ }
    AdMob.addListener(mod.BannerAdPluginEvents.SizeChanged, (s) => { bannerHeight = s?.height || 0; setVar(); });
    AdMob.addListener(mod.BannerAdPluginEvents.FailedToLoad, () => { bannerHeight = 0; setVar(); });
    adsReady = true;
    watchOverlays();
    applyBanner();
    if (interstitialUnit) prepareInterstitial();
  } catch { adsReady = false; }
}

/** الشاشات تخبرني: هل البانر مسموح الآن؟ (شاشة الترحيب فقط) */
export function setAdSlot(on) { bannerWanted = !!on; applyBanner(); }

function applyBanner() {
  if (!adsReady || !bannerUnit) { setVar(); return; }
  chain = chain.then(async () => {
    const show = bannerWanted && !bannerBlocked;
    try {
      if (show && !bannerCreated) {
        await AdMob.showBanner({
          adId: bannerUnit,
          adSize: mod.BannerAdSize.ADAPTIVE_BANNER,
          position: mod.BannerAdPosition.BOTTOM_CENTER,
          margin: 0,
        });
        bannerCreated = true; bannerVisible = true;
      } else if (show && !bannerVisible) {
        await AdMob.resumeBanner(); bannerVisible = true;
      } else if (!show && bannerVisible) {
        bannerVisible = false; setVar();
        await AdMob.hideBanner();
      }
    } catch { /* الإعلان غير متاح الآن — التطبيق يكمل طبيعيًا */ }
    setVar();
  });
}

// إخفاء البانر الأصلي أثناء الكيبورد/النوافذ (حتى لا يعلوها)
function watchOverlays() {
  const check = () => {
    const a = document.activeElement;
    const typing = !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable);
    const b = typing || !!document.querySelector('.sheet-wrap, .dialog-wrap, .upload-overlay, .nx-ai-voice-overlay');
    if (b !== bannerBlocked) { bannerBlocked = b; applyBanner(); }
  };
  let raf = 0;
  const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; check(); }); };
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('focusin', schedule);
  document.addEventListener('focusout', () => setTimeout(schedule, 50));
}

/* ---------- Interstitial (بيني) — بانضباط صارم لتكرار العرض ---------- */
let interstitialPrepared = false;
let interstitialPreparing = null;
const dayNow = () => new Date().toDateString();
function interState() {
  try {
    const d = JSON.parse(localStorage.getItem(INTER_STATE_KEY) || '{}');
    if (d.day !== dayNow()) return { day: dayNow(), count: 0, last: 0 };
    return { day: d.day, count: d.count | 0, last: d.last | 0 };
  } catch { return { day: dayNow(), count: 0, last: 0 }; }
}
function interSave(s) { try { localStorage.setItem(INTER_STATE_KEY, JSON.stringify(s)); } catch { /* تجاهل */ } }
/** حتى متى المستخدم معفي من الإعلانات البينية (مكافأة Rewarded) */
export function interstitialFreeUntil() { try { return Number(localStorage.getItem(FREE_UNTIL_KEY) || 0); } catch { return 0; } }
/** هل البيني مسموح الآن؟ (بدون عرض) */
export function interstitialEligible() {
  if (!adsReady || !interstitialUnit) return false;
  if (Date.now() - bootTime < APP_GRACE_MS) return false;
  if (Date.now() < interstitialFreeUntil()) return false;
  const st = interState();
  if (st.count >= INTER_MAX_PER_DAY) return false;
  if (Date.now() - st.last < INTER_MIN_GAP_MS) return false;
  return true;
}
async function prepareInterstitial() {
  if (!adsReady || !interstitialUnit || interstitialPrepared || interstitialPreparing) return interstitialPreparing;
  interstitialPreparing = (async () => {
    try { await AdMob.prepareInterstitial({ adId: interstitialUnit }); interstitialPrepared = true; }
    catch { interstitialPrepared = false; }
    interstitialPreparing = null;
  })();
  return interstitialPreparing;
}
/** يعرض البيني عند لحظة انتقال طبيعي فقط. يعيد true إن عُرض. لا يُستدعى أثناء المحادثة. */
export async function maybeShowInterstitial() {
  if (!interstitialEligible()) return false;
  if (!interstitialPrepared) await prepareInterstitial();
  if (!interstitialPrepared) return false;
  const st = interState();
  try {
    await AdMob.showInterstitial();
    interSave({ day: st.day, count: st.count + 1, last: Date.now() });
    interstitialPrepared = false;
    // حضّر التالي بهدوء بعد الإغلاق
    setTimeout(() => { prepareInterstitial(); }, 5000);
    return true;
  } catch { interstitialPrepared = false; prepareInterstitial(); return false; }
}

/* ---------- Rewarded (مكافأة) — اختياري، والمكافأة فقط بعد تأكيد AdMob ---------- */
/** يعرض إعلان مكافأة اختياريًا. القيمة المعادة: 'rewarded' | 'dismissed' | 'failed' | 'unavailable' */
export function showRewardedAd() {
  if (!adsReady || !rewardedUnit) return Promise.resolve('unavailable');
  return new Promise((resolve) => {
    let rewarded = false, settled = false;
    const handles = [];
    const done = async (v) => {
      if (settled) return; settled = true;
      await Promise.allSettled(handles.map((h) => h.remove()));
      resolve(v);
    };
    (async () => {
      try {
        handles.push(await AdMob.addListener(mod.RewardAdPluginEvents.Rewarded, () => {
          rewarded = true;
          try { localStorage.setItem(FREE_UNTIL_KEY, String(Date.now() + 24 * 60 * 60 * 1000)); } catch { /* تجاهل */ }
          done('rewarded');
        }));
        handles.push(await AdMob.addListener(mod.RewardAdPluginEvents.Dismissed, () => done(rewarded ? 'rewarded' : 'dismissed')));
        handles.push(await AdMob.addListener(mod.RewardAdPluginEvents.FailedToShow, () => done('failed')));
        handles.push(await AdMob.addListener(mod.RewardAdPluginEvents.FailedToLoad, () => done('failed')));
        await AdMob.prepareRewardVideoAd({ adId: rewardedUnit });
        await AdMob.showRewardVideoAd();
        // showRewardVideoAd يُرجع "reward item" عند النجاح في بعض الإصدارات؛ نبقى على الحدث Rewarded كمصدر وحيد للمكافأة
      } catch { done('failed'); }
    })();
  });
}
