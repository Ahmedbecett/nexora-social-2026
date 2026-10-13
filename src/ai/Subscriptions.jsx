import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';

/* صفحة الاشتراك: الخطة الحالية، الاستهلاك، الشراء بالبطاقة أو المحفظة، السجل والإيصالات */
const FEATURE_AR = { chat: 'الرسائل', search: 'البحث', image: 'تحليل الصور', voice: 'الرسائل الصوتية', file: 'الملفات' };
const STATUS_AR = { active: 'نشط', expired: 'منتهٍ', canceled: 'ملغى', pending: 'بانتظار الدفع', past_due: 'متأخر', failed: 'فشل', paid: 'مدفوع', refunded: 'مُسترد', disputed: 'نزاع' };
const money = (n, c) => (n === null || n === undefined ? '—' : (Number(n) === 0 ? 'مجانًا' : Number(n).toLocaleString('ar-DZ') + ' ' + (c === 'DZD' ? 'دج' : c || '')));
const fdate = (v) => (v ? new Date(v).toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' }) : '—');

export default function Subscriptions({ onClose, toast, onBalanceChange }) {
  const [data, setData] = useState(null);
  const [plans, setPlans] = useState(null);
  const [providers, setProviders] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [period, setPeriod] = useState('month');
  const [provider, setProvider] = useState('wallet');
  const [busy, setBusy] = useState('');
  const [checkout, setCheckout] = useState(null);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try {
      const [sub, pl] = await Promise.all([api('me/subscription'), api('subscription/plans')]);
      setData(sub);
      setPlans(pl.plans || []);
      setProviders((pl.providers || []).filter((p) => p.available || p.id !== 'sandbox'));
      setWallet(pl.wallet || null);
      const first = (pl.providers || []).find((p) => p.available && (p.id === 'satim' || p.id === 'stripe'));
      setProvider(first ? first.id : 'wallet');
    } catch (e) { setErr('تعذّر تحميل بيانات الاشتراك. أعد المحاولة.'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const subscribe = async (planId) => {
    setErr(''); setBusy(planId);
    try {
      const r = await api('subscription/checkout', { method: 'POST', body: { plan: planId, period, provider } });
      setCheckout(r);
      if (r.redirectUrl) { window.location.href = r.redirectUrl; return; }
      toast('أُنشئ طلب الدفع — أكمل التحويل ثم يُفعَّل بعد التحقق.');
      await load();
    } catch (e) {
      const d = e?.detail || '';
      setErr((e?.code === 'payment_provider_unavailable' ? 'هذه البطاقة غير متاحة بعد على الخادم. ' : '') +
        (d || (e?.code === 'plan_limit_reached' ? 'وصلت حدّ خطتك.' : '') || 'تعذّر إنشاء طلب الدفع.'));
    } finally { setBusy(''); }
  };
  const cancel = async (resume) => {
    setBusy('cancel'); setErr('');
    try {
      const r = await api('subscription/cancel', { method: 'POST', body: resume ? { resume: true } : {} });
      toast(resume ? 'تم استئناف التجديد.' : 'تم الإلغاء — يبقى الاشتراك فعّالًا حتى نهاية الفترة.');
      setData((d) => ({ ...d, subscription: { ...d.subscription, cancelAtPeriodEnd: r.cancelAtPeriodEnd } }));
    } catch (e) { setErr('تعذّر تنفيذ الطلب.'); } finally { setBusy(''); }
  };
  const copy = async (t) => { try { await navigator.clipboard.writeText(t); toast('نُسخ: ' + t); } catch { /* الحافظة غير متاحة */ } };

  const sub = data?.subscription;
  const usable = (plans || []).filter((p) => p.id !== 'free');
  const paid = (data?.payments || []).filter((p) => p.status === 'paid');
  const pending = (data?.payments || []).filter((p) => p.status === 'pending');

  return (
    <div className="nx-sub">
      {err && <div className="nx-sub-err">{err}</div>}

      <div className="nx-sub-current">
        <div className="row">
          <b>خطتك الحالية: {sub ? sub.planName : 'المجانية'}</b>
          <i className={'badge ' + (sub ? 'on' : 'off')}>{sub ? STATUS_AR[sub.status] || sub.status : 'مجاني'}</i>
        </div>
        {sub ? (
          <>
            <small>بدأت {fdate(sub.startedAt)} · تنتهي {fdate(sub.currentPeriodEnd)} ({sub.daysLeft} يومًا متبقية)</small>
            {sub.cancelAtPeriodEnd
              ? <div className="note warn">أُلغي التجديد — يبقى الاشتراك فعّالًا حتى نهاية الفترة. <button onClick={() => cancel(true)} disabled={busy === 'cancel'}>استئناف</button></div>
              : <div className="note">التجديد التلقائي غير مُفعّل (لا مزوّد يدعمه حاليًا) — <button onClick={() => cancel(false)} disabled={busy === 'cancel'}>إلغاء الاشتراك</button></div>}
          </>
        ) : <small>أنت على الحدود اليومية المجانية. الترقية ترفع الحدود وتضيف نقاطًا شهريًا.</small>}
      </div>

      {data && <div className="nx-sub-usage">
        <b>استهلاكك خلال الفترة الحالية</b>
        {Object.entries(data.usage || {}).map(([f, u]) => {
          const pct = u.limit > 0 ? Math.min(100, Math.round((u.used / u.limit) * 100)) : 0;
          return (
            <div key={f} className="bx">
              <span>{FEATURE_AR[f] || f}<em>{u.used} / {u.limit} {u.period === 'day' ? 'اليوم' : 'هذا الشهر'}</em></span>
              <div className="bar"><i style={{ width: pct + '%' }} className={pct >= 100 ? 'full' : ''} /></div>
            </div>
          );
        })}
      </div>}

      <div className="nx-sub-switch">
        <button className={period === 'month' ? 'on' : ''} onClick={() => setPeriod('month')}>شهري</button>
        <button className={period === 'year' ? 'on' : ''} onClick={() => setPeriod('year')}>سنوي</button>
      </div>

      <div className="nx-sub-plans">
        {usable.map((p) => {
          const price = period === 'year' ? p.priceYear : p.priceMonth;
          const isCurrent = sub && sub.planId === p.id;
          return (
            <div key={p.id} className={'plan' + (isCurrent ? ' current' : '')}>
              <div className="hd"><b>{p.nameAr}</b>{!p.approved && <i className="tag">سعر مقترح</i>}</div>
              <div className="price">{money(price, p.currency)}{p.approved ? '' : ' · غير نهائي'}</div>
              <small>{p.includedCredits.toLocaleString('ar-DZ')} نقطة مضمّنة عند التفعيل</small>
              <ul>{(p.features || []).slice(0, 5).map((f, i) => <li key={i}>{f}</li>)}</ul>
              <div className="lims">
                {Object.entries(p.limits || {}).map(([f, l]) => (
                  <span key={f}>{FEATURE_AR[f] || f}: {l.limit.toLocaleString('ar-DZ')}/{l.period === 'day' ? 'يوم' : 'شهر'}</span>
                ))}
              </div>
              <button className="cta" disabled={busy === p.id || isCurrent} onClick={() => subscribe(p.id)}>
                {isCurrent ? 'خطتك الحالية' : busy === p.id ? '…' : 'اشترك / ترقية'}
              </button>
              <small className="rules">{isCurrent ? '' : sub ? 'التبديل يبدأ فور تأكيد الدفع، وتُلغى الخطة السابقة.' : 'يبدأ الاشتراك فور تأكيد الدفع.'}</small>
            </div>
          );
        })}
      </div>

      <div className="nx-sub-pay">
        <b>وسيلة الدفع</b>
        <div className="props">
          {providers.map((p) => (
            <button key={p.id} className={provider === p.id ? 'on' : ''} disabled={!p.available} onClick={() => p.available && setProvider(p.id)}
              title={p.available ? p.doc : 'غير مُهيّأ: ' + (p.missing || []).join(', ')}>
              {p.label}{!p.available && ' (غير متاح)'}
            </button>
          ))}
        </div>
        {provider === 'wallet' && wallet && (
          <div className="wallet">
            {wallet.number
              ? <p>حوّل المبلغ عبر <b>{wallet.app}</b> إلى الرقم <b dir="ltr">{wallet.number}</b> باسم {wallet.holder || '—'} ثم أرسل رمز الطلب للتفعيل.</p>
              : <p className="warn">رقم المحفظة غير مضبوط على الخادم (PAYMENT_WALLET_NUMBER).</p>}
          </div>
        )}
        {provider !== 'wallet' && (() => {
          const p = providers.find((x) => x.id === provider);
          return p && !p.available ? <p className="warn">غير مُهيّأ بعد — ينقص على الخادم: {(p.missing || []).join(', ')}</p> : null;
        })()}
        <small className="fees">
          ما تدفعه هو المبلغ المعروض أعلاه بعملة الخطة. عند تفعيل بطاقة CIB/الذهبية تُخصم رسوم البنك من حساب NEXORA (لا تُضاف عليك):
          تُقدَّر حاليًا بـ~50 دج ثابتة + 1.2% لكل عملية (أرقام إرشادية غير مؤكدة حتى يُوقّع عقد التاجر مع البنك).
          التحويلات عبر المحفظة لا رسوم إضافية من جهتنا. السقوف: ~100,000 دج للعملية الواحدة و500,000 دج شهريًا (حسب البنك).
        </small>
      </div>

      {checkout && (
        <div className="nx-sub-order">
          <b>طلب الدفع: <code dir="ltr">{checkout.transaction.reference}</code></b>
          <button onClick={() => copy(checkout.transaction.reference)}>نسخ الرمز</button>
          <p>{checkout.instructions || 'تابع التعليمات لدى مزوّد الدفع.'}</p>
          <small>المبلغ: {money(checkout.transaction.amount, checkout.transaction.currency)} · الحالة: {STATUS_AR[checkout.transaction.status] || checkout.transaction.status}</small>
        </div>
      )}

      {(paid.length > 0 || pending.length > 0) && (
        <div className="nx-sub-history">
          <b>سجل المدفوعات</b>
          {data.payments.map((p) => (
            <div key={p.id} className="row">
              <code dir="ltr">{p.reference}</code>
              <span>{p.planId} · {p.period === 'year' ? 'سنوي' : 'شهري'} · {p.provider}</span>
              <b>{money(p.amount, p.currency)}</b>
              <i className={'st ' + p.status}>{STATUS_AR[p.status] || p.status}</i>
              {p.receipt && <button onClick={() => copy('إيصال NEXORA ' + p.receipt.reference + ' · ' + p.receipt.amount + ' ' + p.receipt.currency + ' · ' + fdate(p.receipt.paidAt))}>نسخ الإيصال</button>}
            </div>
          ))}
          {(data.refunds || []).length > 0 && <div className="refunds">{(data.refunds || []).map((r) => <div key={r.id}>استرداد {money(r.amount, r.currency)} · {STATUS_AR[r.status] || r.status} · {r.reason || ''}</div>)}</div>}
        </div>
      )}

      <p className="nx-sub-note">لا يُعرض أي اشتراك مدفوع قبل تأكيد الدفع فعليًا. الأسعار قابلة للتعديل من لوحة الإدارة، وأي تغيير لا يمسّ اشتراكك حتى ينتهي.</p>
      <button className="nx-ai-wide" onClick={onClose}>إغلاق</button>
    </div>
  );
}
