/* ==========================================================================
   NEXORA AI — حدّ أمان للواجهة
   --------------------------------------------------------------------------
   إذا انهار مكوّن React (بيانات تالفة، تحديث جزئي، ملف قديم في الكاش) نعرض
   حالة خطأ محترمة بالعربية والإنجليزية مع إعادة المحاولة وروابط الدعم، بدل
   شاشة بيضاء. لا نرسل أي بيانات حساسة إلى أي خدمة من هنا.
   ========================================================================== */

import { Component } from 'react';
import { APP_VERSION } from './version.js';

const COPY = {
  ar: {
    title: 'تعذّر عرض الواجهة',
    body: 'حدث خطأ غير متوقع في هذه الجلسة. بياناتك ومحادثاتك محفوظة على الخادم؛ أعد تحميل الواجهة للمتابعة.',
    reload: 'إعادة تحميل NEXORA',
    home: 'العودة إلى الصفحة الرئيسية',
    privacy: 'سياسة الخصوصية',
    support: 'الدعم',
    detail: 'تفاصيل تقنية',
  },
  en: {
    title: 'The interface could not be displayed',
    body: 'An unexpected error occurred in this session. Your account and conversations are safe on the server; reload the interface to continue.',
    reload: 'Reload NEXORA',
    home: 'Go to the home page',
    privacy: 'Privacy policy',
    support: 'Support',
    detail: 'Technical details',
  },
};

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // لا نرسل الأثر إلى خادم خارجي. يظهر في وحدة تحكم المطوّر فقط.
    try {
      console.error('NEXORA UI error', error, info?.componentStack);
    } catch { /* ignore */ }
  }

  render() {
    if (!this.state.error) return this.props.children;
    let lang = 'ar';
    try { lang = document.documentElement.lang === 'en' ? 'en' : 'ar'; } catch { /* ignore */ }
    const t = COPY[lang];
    const detail = this.state.error && (this.state.error.message || String(this.state.error));

    return (
      <div
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        style={{
          minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24,
          background: '#120c30', color: '#f5f2ff',
          fontFamily: "'Segoe UI', system-ui, Tahoma, sans-serif", lineHeight: 1.7,
        }}
      >
        <main style={{ width: 'min(560px, 100%)', textAlign: 'center' }}>
          <img src="/icon-192.png" width="72" height="72" alt="" style={{ borderRadius: 18, margin: '0 auto 14px', display: 'block' }} />
          <h1 style={{ fontSize: 24, margin: '0 0 10px' }}>{t.title}</h1>
          <p style={{ color: '#cfc6e6', margin: '0 auto 20px', maxWidth: '46ch' }}>{t.body}</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => { try { window.location.reload(); } catch { /* ignore */ } }}
              style={{
                font: 'inherit', fontWeight: 700, cursor: 'pointer', padding: '11px 18px',
                borderRadius: 11, border: 0, color: '#fff',
                background: 'linear-gradient(110deg,#8b68ff,#d16bc7)',
              }}
            >
              {t.reload}
            </button>
            <a href="/" style={{ padding: '11px 18px', borderRadius: 11, border: '1px solid #ffffff26', color: '#f5f2ff', textDecoration: 'none' }}>
              {t.home}
            </a>
          </div>
          <p style={{ marginTop: 20, fontSize: 12, color: '#9c93b8' }}>
            <a href="/windows/privacy.html" style={{ color: '#cbb6ff' }}>{t.privacy}</a>
            {' · '}
            <a href="/windows/#support" style={{ color: '#cbb6ff' }}>{t.support}</a>
            {' · NEXORA AI '}
            {APP_VERSION}
          </p>
          <details style={{ marginTop: 16, fontSize: 12, color: '#9c93b8', textAlign: 'start' }}>
            <summary style={{ cursor: 'pointer' }}>{t.detail}</summary>
            <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: '8px 0 0' }}>{detail}</pre>
          </details>
        </main>
      </div>
    );
  }
}
