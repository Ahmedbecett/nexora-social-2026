import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';

/* لوحة الإيرادات: أرقام حقيقية من قاعدة البيانات فقط — لا بيانات تجريبية */
const FEATURE_AR = { chat: 'الرسائل', search: 'البحث', image: 'التحليل الصور', voice: 'الصوت', file: 'الملفات' };
const STATUS_AR = { active: 'نشط', expired: 'منتهٍ', canceled: 'ملغى', pending: 'بانتظار الدفع', paid: 'مدفوع', failed: 'فشل', refunded: 'مُسترد', disputed: 'نزاع', canceled_pay: 'ملغى' };
const n = (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('ar-DZ'));

export default function AdminRevenue({ onClose, toast }) {
  const [rev, setRev] = useState(null);
  const [pays, setPays] = useState(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [edit, setEdit] = useState(null);      // { id, priceMonth, priceYear, chat, search, image, voice, file }
  const [filter, setFilter] = useState('all');

  const load = useCallback(async (f = filter) => {
    try {
      const [r, p] = await Promise.all([api('admin/revenue'), api('admin/payments?status=' + f)]);
      setRev(r); setPays(p); setErr('');
    } catch (e) { setErr(e?.code === 'forbidden' ? 'هذه اللوحة للمالك فقط.' : 'تعذّر تحميل الأرقام.'); }
  }, [filter]);
  useEffect(() => { load(filter); }, [load, filter]);

  const confirmTx = async (ref) => {
    setBusy(ref);
    try { await api('admin/payments/confirm', { method: 'POST', body: { reference: ref } }); toast('فُعّل الاشتراك بعد التأكيد.'); await load(); }
    catch (e) { toast('تعذّر التأكيد: ' + (e?.code || '')); } finally { setBusy(''); }
  };
  const refund = async (id) => {
    if (!window.confirm('تسجيل استرداد كامل لهذه المعاملة؟ سيُلغى الاشتراك المرتبط.')) return;
    setBusy('r' + id);
    try { await api('admin/refunds', { method: 'POST', body: { transactionId: id, status: 'refunded', reason: 'استرداد من لوحة الإدارة' } }); toast('سُجّل الاسترداد.'); await load(); }
    catch (e) { toast('تعذّر الاسترداد.'); } finally { setBusy(''); }
  };
  const savePlan = async () => {
    if (!edit) return;
    setBusy('plan');
    try {
      await api('admin/plans', { method: 'POST', body: { plan: edit.id, patch: {
        priceMonth: Number(edit.priceMonth), priceYear: Number(edit.priceYear), approve: true,
        limits: { chat: { period: 'month', limit: Number(edit.chat) }, search: { period: 'month', limit: Number(edit.search) },
                  image: { period: 'month', limit: Number(edit.image) }, voice: { period: 'month', limit: Number(edit.voice) },
                  file: { period: 'month', limit: Number(edit.file) } },
      } } });
      toast('حُفظت الخطة واعتُمد سعرها.'); setEdit(null); await load();
    } catch (e) { toast('تعذّر الحفظ.'); } finally { setBusy(''); }
  };

  const S = rev?.subscriptions || {};
  const byStatus = (s) => (rev?.payments || []).filter((p) => p.status === s);
  const sum = (rows) => rows.reduce((a, r) => a + Number(r.amount || 0), 0);

  return (
    <div className="nx-rev">
      {err && <div className="nx-sub-err">{err}</div>}
      {!rev ? <p>جارٍ التحميل…</p> : (<>
        <div className="grid">
          <div className="card"><small>اشتراكات نشطة</small><b>{n(S.active || 0)}</b></div>
          <div className="card"><small>منتهية</small><b>{n(S.expired || 0)}</b></div>
          <div className="card"><small>ملغاة</small><b>{n(S.canceled || 0)}</b></div>
          <div className="card"><small>بانتظار الدفع (معاملات)</small><b>{n(byStatus('pending').reduce((a, r) => a + r.count, 0))}</b></div>
          <div className="card ok"><small>مدفوعات مؤكدة</small><b>{n(byStatus('paid').reduce((a, r) => a + r.count, 0))}</b>
            <em>{byStatus('paid').map((p) => n(p.amount) + ' ' + p.currency).join(' · ') || '—'}</em></div>
          <div className="card"><small>فشلة / ملغاة</small><b>{n(byStatus('failed').reduce((a, r) => a + r.count, 0))} / {n(byStatus('canceled').reduce((a, r) => a + r.count, 0))}</b></div>
          <div className="card"><small>آخر 30 يومًا (مؤكدة)</small><b>{n((rev.last30days || []).reduce((a, x) => a + Number(x.amount || 0), 0))}</b>
            <em>{(rev.last30days || []).map((x) => n(x.amount) + ' ' + x.currency + ' (' + x.count + ')').join(' · ') || 'لا شيء'}</em></div>
          <div className="card"><small>مبالغ مستردة</small><b>{n((rev.refunds || []).reduce((a, x) => a + Number(x.amount || 0), 0))}</b>
            <em>{(rev.refunds || []).map((x) => (STATUS_AR[x.status] || x.status) + ': ' + n(x.amount) + ' ' + x.currency).join(' · ') || 'لا شيء'}</em></div>
        </div>

        <div className="nx-rev-note">{rev.estimate.note}</div>
        <div className="nx-rev-cost">
          <b>تكلفة مزوّدي الذكاء الاصطناعي (تقديرية 30 يومًا): {rev.estimate.aiCostUsd30} دولار</b>
          <div>{(rev.aiUsage30 || []).map((u) => <span key={u.feature}>{FEATURE_AR[u.feature] || u.feature}: {n(u.calls)} استدعاء · {u.estimatedCostUsd}$</span>)}{!(rev.aiUsage30 || []).length && <span>لا استهلاك مسجّل بعد</span>}</div>
        </div>

        <div className="nx-rev-prov">
          <b>بوابات الدفع</b>
          {(rev.providers || []).map((p) => (
            <div key={p.id} className="prow">
              <span>{p.label}</span>
              <i className={p.available ? 'on' : 'off'}>{p.available ? 'مُهيّأ' : (p.reason === 'sandbox_disabled_here' ? 'مُعطَّل في الإنتاج (صحيح)' : 'ينقص: ' + (p.missing || []).join(', '))}</i>
            </div>
          ))}
        </div>

        <div className="nx-rev-plans">
          <b>الخطط والأسعار (التعديل هنا = اعتماد السعر)</b>
          {(rev.plans || []).map((p) => (
            <div key={p.id} className="prow">
              <span>{p.nameAr} {p.approved ? '✓ معتمد' : '· مقترح'}</span>
              <span>{n(p.priceMonth)}/{n(p.priceYear)} {p.currency} · محادثة {p.limits?.chat?.limit}</span>
              <button onClick={() => setEdit({ id: p.id, priceMonth: p.priceMonth, priceYear: p.priceYear,
                chat: p.limits?.chat?.limit || 0, search: p.limits?.search?.limit || 0, image: p.limits?.image?.limit || 0,
                voice: p.limits?.voice?.limit || 0, file: p.limits?.file?.limit || 0 })}>تعديل</button>
            </div>
          ))}
          {edit && (
            <div className="edit">
              <b>تعديل خطة {edit.id}</b>
              <div className="fields">
                <label>شهري<input type="number" value={edit.priceMonth} onChange={(e) => setEdit({ ...edit, priceMonth: e.target.value })} /></label>
                <label>سنوي<input type="number" value={edit.priceYear} onChange={(e) => setEdit({ ...edit, priceYear: e.target.value })} /></label>
                <label>رسائل<input type="number" value={edit.chat} onChange={(e) => setEdit({ ...edit, chat: e.target.value })} /></label>
                <label>بحث<input type="number" value={edit.search} onChange={(e) => setEdit({ ...edit, search: e.target.value })} /></label>
                <label>صور<input type="number" value={edit.image} onChange={(e) => setEdit({ ...edit, image: e.target.value })} /></label>
                <label>صوت<input type="number" value={edit.voice} onChange={(e) => setEdit({ ...edit, voice: e.target.value })} /></label>
                <label>ملفات<input type="number" value={edit.file} onChange={(e) => setEdit({ ...edit, file: e.target.value })} /></label>
              </div>
              <div className="acts"><button disabled={busy === 'plan'} onClick={savePlan}>حفظ واعتماد</button><button onClick={() => setEdit(null)}>إلغاء</button></div>
            </div>
          )}
        </div>

        <div className="nx-rev-tx">
          <div className="head"><b>المعاملات</b>
            <div className="filters">{['all', 'pending', 'paid', 'failed', 'refunded'].map((f) => (
              <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{STATUS_AR[f] || f}</button>))}
            </div>
          </div>
          {(pays?.payments || []).map((p) => (
            <div key={p.id} className="row">
              <code dir="ltr">{p.reference}</code>
              <span>@{p.username} · {p.plan_id} · {p.provider}</span>
              <b>{n(p.amount)} {p.currency}</b>
              <i className={'st ' + p.status}>{STATUS_AR[p.status] || p.status}</i>
              {p.status === 'pending' && <button disabled={busy === p.reference} onClick={() => confirmTx(p.reference)}>تأكيد الاستلام</button>}
              {p.status === 'paid' && <button disabled={busy === 'r' + p.id} onClick={() => refund(p.id)}>استرداد</button>}
            </div>
          ))}
          {!(pays?.payments || []).length && <p className="muted">لا معاملات بهذه الحالة.</p>}
          {(pays?.refunds || []).length > 0 && <div className="refunds">{(pays.refunds || []).map((r) => (
            <div key={r.id}>استرداد #{r.id} · @{r.username} · {n(r.amount)} {r.currency} · {STATUS_AR[r.status] || r.status}</div>))}</div>}
        </div>

        {(rev.webhooks30 || []).length > 0 && <div className="nx-rev-hooks"><b>إشعارات المزوّدين (30 يومًا)</b>
          <div>{rev.webhooks30.map((h) => <span key={h.result}>{h.result}: {h.count}</span>)}</div></div>}
      </>)}
      <button className="nx-ai-wide" onClick={onClose}>إغلاق</button>
    </div>
  );
}
