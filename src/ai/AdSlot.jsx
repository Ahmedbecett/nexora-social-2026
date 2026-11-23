/* ============================================================
   خانات إعلانات AdSense الحقيقية لصفحة NEXORA AI
   - الوحدة الفعلية من حسابك: 1971049956 (in-feed / fluid)
   - لا تظهر أبداً داخل تطبيق أندرويد (سياسة Google تمنع AdSense في WebView)
   - "home" و"chat" عرضان متبادلان (واحد فقط يُرسم في كل لحظة) فلا تتكرر الوحدة في الصفحة
   - إيقاع الظهور: انطباع واحد كل 30 دقيقة على مستوى الموقع كله،
     يظهر ثم يختفي تلقائيًا بعد 15 ثانية (بوابة webAdGate المشتركة مع Adsterra)
   ============================================================ */
import { useEffect, useRef, useState } from 'react';
import { watchAdSlot } from './adSlotVisibility.js';
import { webAdClaim, WEB_AD_HIDE_MS } from './webAdGate.js';

export const AD_CLIENT = 'ca-pub-6858364141205978';

export const AD_SLOTS = {
  /* الشاشة الترحيبية (تحت المقترحات) */
  home: { id: '1971049956', format: 'fluid', layoutKey: '-fb+5w+4e-db+86' },
  /* أعلى المحادثة (فوق الرسائل مباشرة) */
  chat: { id: '1971049956', format: 'fluid', layoutKey: '-fb+5w+4e-db+86' },
};

export function adsAllowed() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  try {
    if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) return false;
    if (/NexoraAI/i.test(navigator.userAgent || '')) return false; // داخل تطبيقنا
    if (document.documentElement.classList.contains('native')) return false;
    // Windows Store MSIX uses official native MG Ads SDK only — exclude website AdSense.
    if (document.documentElement.dataset?.nxNativeHost === 'webview2-mgads') return false;
    if (window.sessionStorage && window.sessionStorage.getItem('nx_surface') === 'msix') return false;
    if (new URLSearchParams(window.location?.search || '').get('nx_surface') === 'msix') return false;
  } catch (e) { /* تجاهل */ }
  return true;
}

export default function AdSlot({ name, className = '' }) {
  const wrap = useRef(null);
  const [adState, setAdState] = useState('pending');
  /* بوابة الثلاثين دقيقة: أول خانة تركب تطالب بالنافذة وتحجزها، والبقية لا تُرسم */
  const [gate, setGate] = useState(false);
  const [visible, setVisible] = useState(true);
  const cfg = AD_SLOTS[name] || null;
  const slot = cfg && String(cfg.id || '').trim();
  const live = Boolean(slot) && adsAllowed();

  useEffect(() => {
    if (!live) return;
    if (!webAdClaim()) return;
    setGate(true);
    /* الإعلان يختفي بعد 15 ثانية ثم لا يعود قبل 30 دقيقة */
    const hide = setTimeout(() => setVisible(false), WEB_AD_HIDE_MS);
    return () => clearTimeout(hide);
  }, [live, slot]);

  useEffect(() => {
    if (!live || !gate || !visible || !wrap.current) return;
    const ins = wrap.current.querySelector('ins.adsbygoogle');
    if (!ins) return;
    // Keep the ad request measurable; collapse only after a confirmed no-fill
    // or a timeout with no status/creative. A late result can reveal it again.
    const stopWatching = watchAdSlot(ins, setAdState);
    // The auth/SEO page has no ad slot. Fetch AdSense only when a real in-app
    // slot mounts (never inside the Android WebView), not on every page load.
    if (!document.querySelector('script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]')) {
      const script = document.createElement('script');
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_CLIENT}`;
      document.head.appendChild(script);
    }
    if (ins.getAttribute('data-adsbygoogle-status') || ins.dataset.adsbygoogleStatus === 'done') return stopWatching;
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* best effort */ }
    return stopWatching;
  }, [live, gate, visible, slot]);

  if (!live || !gate || !visible) return null;

  const fluid = cfg.format === 'fluid';
  return (
    <div className={'nx-ai-ad ' + className} ref={wrap} role="complementary" aria-label="مساحة إعلانية" data-ad-state={adState}>
      <span className="nx-ai-ad-tag">إعلان</span>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={AD_CLIENT}
        data-ad-slot={slot}
        data-ad-format={fluid ? 'fluid' : 'auto'}
        {...(fluid
          ? { 'data-ad-layout-key': cfg.layoutKey }
          : { 'data-full-width-responsive': 'true' })}
      />
    </div>
  );
}
