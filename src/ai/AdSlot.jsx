/* ============================================================
   خانات إعلانات AdSense الحقيقية لصفحة NEXORA AI
   - الوحدة الفعلية من حسابك: 1971049956 (in-feed / fluid)
   - لا تظهر أبداً داخل تطبيق أندرويد (سياسة Google تمنع AdSense في WebView)
   - "home" و"chat" عرضان متبادلان (واحد فقط يُرسم في كل لحظة) فلا تتكرر الوحدة في الصفحة
   ============================================================ */
import { useEffect, useRef } from 'react';

export const AD_CLIENT = 'ca-pub-6858364141205978';

export const AD_SLOTS = {
  /* الشاشة الترحيبية (تحت المقترحات) */
  home: { id: '1971049956', format: 'fluid', layoutKey: '-fb+5w+4e-db+86' },
  /* أعلى المحادثة (فوق الرسائل مباشرة) */
  chat: { id: '1971049956', format: 'fluid', layoutKey: '-fb+5w+4e-db+86' },
  /* الشريط الجانبي — أرسل رقم وحدته عند إنشائها */
  sidebar: null,
};

export function adsAllowed() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  try {
    if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) return false;
    if (/NexoraAI/i.test(navigator.userAgent || '')) return false; // داخل تطبيقنا
    if (document.documentElement.classList.contains('native')) return false;
  } catch (e) { /* تجاهل */ }
  return true;
}

export default function AdSlot({ name, className = '' }) {
  const wrap = useRef(null);
  const cfg = AD_SLOTS[name] || null;
  const slot = cfg && String(cfg.id || '').trim();
  const live = Boolean(slot) && adsAllowed();

  useEffect(() => {
    if (!live || !wrap.current) return;
    const ins = wrap.current.querySelector('ins.adsbygoogle');
    if (!ins) return;
    if (ins.getAttribute('data-adsbygoogle-status') || ins.dataset.adsbygoogleStatus === 'done') return;
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* السكربت لم يحمّل بعد */ }
  }, [live, slot]);

  if (!live) return null;

  const fluid = cfg.format === 'fluid';
  return (
    <div className={'nx-ai-ad ' + className} ref={wrap} role="complementary" aria-label="مساحة إعلانية">
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
