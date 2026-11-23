/* ==========================================================================
   NEXORA AI — خانة إعلان Windows
   --------------------------------------------------------------------------
   • عند تشغيل MG Ads داخل المضيف الأصلي C# + WebView2 MSIX:
     تنسّق الخانة طلب البانر الأصلي عبر الجسر الآمن (mgAdsBridge.js) ولا ترسم
     أي مساحة فارغة في DOM إطلاقًا (المضيف الأصلي يعرض البانر فقط عند توفر
     مادة إعلانية حقيقية، ويخفيه فورًا عند الفشل أو الإغلاق).
   • خارج المضيف الأصلي: يفشل مغلقًا (fail closed) ولا يرسم شيئًا.
   • القياس الحقيقي لدى المزوّد فقط؛ هذا الملف لا يرسل انطباعات ولا نقرات.
   ========================================================================== */

import { useEffect, useRef, useState } from 'react';
import { isCapacitorNative, runtimeSurface } from '../platform.js';
import { isNativeMgAdsHost, requestBanner } from './mgAdsBridge.js';
import {
  ADS_CONFIG_URL,
  adWindowOpen,
  consentSatisfied,
  disabledReason,
  markAdWindow,
  providerAdapter,
  readConsent,
  validateAdsConfig,
  writeConsent,
} from './windowsAds.js';
import './windowsAds.css';

function storage() {
  try { return window.localStorage; } catch { return null; }
}

function docLang() {
  try { return document.documentElement.lang === 'en' ? 'en' : 'ar'; } catch { return 'ar'; }
}

const COPY = {
  ar: {
    ad: 'إعلان',
    consentTitle: 'إعلان مدعوم',
    consentBody: 'تريد NEXORA عرض إعلان مناسب هنا لدعم الخدمة مجانًا. يمكنك الموافقة أو الرفض — التطبيق يعمل كاملًا في الحالتين.',
    consentPolicy: 'سياسة الإعلانات والخصوصية',
    accept: 'أوافق على عرض الإعلانات',
    decline: 'لا شكرًا',
    provider: 'المزوّد',
  },
  en: {
    ad: 'Ad',
    consentTitle: 'Supported by ads',
    consentBody: 'NEXORA would like to show a relevant ad here to keep the service free. You can accept or decline — the app works fully either way.',
    consentPolicy: 'Advertising & privacy policy',
    accept: 'I agree to see ads',
    decline: 'No thanks',
    provider: 'Provider',
  },
};

export default function WindowsAdSlot({ placement = 'ai-home-banner', className = '' }) {
  const t = COPY[docLang()];
  const surface = runtimeSurface();
  const [state, setState] = useState({ status: 'loading', config: null });
  const [consent, setConsent] = useState(() => readConsent(storage()));
  const [visible, setVisible] = useState(true);
  const claimed = useRef(false);
  const insRef = useRef(null);

  useEffect(() => {
    // لا نلمس أندرويد ولا الموقع العام: الموقع له AdSlot الخاص به، وأندرويد له AdMob.
    if (isCapacitorNative() || !String(surface).startsWith('windows-')) {
      setState({ status: 'not-applicable', config: null });
      return undefined;
    }
    let alive = true;
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    (async () => {
      try {
        const res = await fetch(ADS_CONFIG_URL, { cache: 'no-store', signal: ctrl?.signal });
        if (!res.ok) throw new Error('config-unavailable');
        const raw = await res.json();
        const parsed = validateAdsConfig(raw);
        if (alive) setState({ status: parsed.ok ? 'ready' : 'invalid', config: parsed.config });
      } catch {
        if (alive) setState({ status: 'error', config: null });
      }
    })();
    return () => {
      alive = false;
      try { ctrl?.abort(); } catch { /* ignore */ }
    };
  }, [surface]);

  const config = state.config;
  const reason = disabledReason(config, { surface, consent });
  const adapter = config ? providerAdapter(config, surface) : null;

  // مسار MG Ads الأصلي: ننسّق مع المضيف الأصلي C# + WebView2 دون أي مساحة فارغة في DOM.
  useEffect(() => {
    if (reason !== 'eligible' || !adapter || adapter.name !== 'mgads') return undefined;
    if (!isNativeMgAdsHost()) return undefined;
    if (!adapter.units?.banner?.enabled) return undefined;
    requestBanner({ force: false }).catch(() => { /* fail closed */ });
    return undefined;
  }, [reason, adapter, placement]);

  // بوابة التكرار للويب (AdSense فقط): تُحتسب عند عرض إعلان فعلي.
  useEffect(() => {
    if (reason !== 'eligible' || claimed.current) return undefined;
    if (!adapter || adapter.name !== 'adsense') return undefined;
    if (!adWindowOpen(config, storage())) return undefined;
    claimed.current = true;
    markAdWindow(config, storage());
    const seconds = config.frequency.visibleSeconds;
    if (seconds <= 0) return undefined;
    const timer = window.setTimeout(() => setVisible(false), seconds * 1000);
    return () => window.clearTimeout(timer);
  }, [reason, config, surface, adapter]);

  // طلب AdSense الحقيقي على المتصفح فقط (غير متاح في MSIX).
  useEffect(() => {
    if (reason !== 'eligible' || !visible) return undefined;
    if (!adapter || adapter.name !== 'adsense') return undefined;
    const ins = insRef.current;
    if (!ins) return undefined;

    if (!document.querySelector('script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]')) {
      const script = document.createElement('script');
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adapter.client}`;
      document.head.appendChild(script);
    }
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch { /* مانع إعلانات أو حجب شبكة — لا نعطّل التطبيق */ }
    return undefined;
  }, [reason, visible, config, surface, adapter]);

  // طلب الموافقة اليدوية يُعرض فقط للمزوّدات التي لا تدير CMP أصليًا.
  const consentNeeded = config
    && config.enabled === true
    && config.surfaces.includes(surface)
    && config.consent.required === true
    && config.consent.nativeCmp !== true
    && Boolean(adapter)
    && !consentSatisfied(config, consent);

  if (state.status !== 'ready' && state.status !== 'invalid') return null;

  if (consentNeeded) {
    return (
      <aside className={`nx-win-ad-consent ${className}`.trim()} role="region" aria-label={t.consentTitle}>
        <strong>{t.consentTitle}</strong>
        <p>{t.consentBody}</p>
        <div className="nx-win-ad-consent-actions">
          <button
            type="button"
            className="primary"
            onClick={() => { writeConsent(storage(), 'granted'); setConsent('granted'); }}
          >
            {t.accept}
          </button>
          <button
            type="button"
            onClick={() => { writeConsent(storage(), 'denied'); setConsent('denied'); }}
          >
            {t.decline}
          </button>
          <a href={config.consent.policyUrl} target="_blank" rel="noopener noreferrer">{t.consentPolicy}</a>
        </div>
      </aside>
    );
  }

  if (reason !== 'eligible' || !visible) return null;

  // MG Ads يُعرض أصليًا داخل لوحة المضيف السفلية فقط عند توفر مادة حقيقية — صفر مساحات فارغة في DOM.
  if (!adapter || adapter.name !== 'adsense') return null;

  return (
    <aside
      className={`nx-win-ad ${className}`.trim()}
      role="complementary"
      aria-label={`${t.ad} — ${config.consent.providerDisclosure || adapter.name}`}
      data-ad-provider={adapter.name}
      data-ad-placement={placement}
      data-ad-surface={surface}
      style={{
        minHeight: `${config.reserve.minHeight}px`,
        maxHeight: `${config.reserve.maxHeight}px`,
      }}
    >
      <span className="nx-win-ad-tag">{t.ad}</span>
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: 'block', width: '100%' }}
        data-ad-client={adapter.client}
        data-ad-slot={adapter.slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
