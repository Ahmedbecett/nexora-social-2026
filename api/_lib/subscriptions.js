/* ==========================================================================
   NEXORA AI — الاشتراكات واستقبال الأموال (طبقة كاملة على نفس قاعدة البيانات)
   --------------------------------------------------------------------------
   مبادئ ثابتة في هذا الملف:
   • لا بوابة محاكاة في الإنتاج: مزوّد الاختبار (sandbox) مُعطَّل داخل الإنتاج قطعيًا.
   • لا اختراع لبيانات تاجر ولا مفاتيح ولا مسارات API: كل ما يلزم يُقرأ من متغيرات
     البيئة، وإن كان ناقصًا نقول ما هو الناقص بالاسم ولا نفعّل الدفع.
   • لا تفعيل اشتراك من المتصفح: التفعيل لا يحدث إلا بإشعار موقّع من المزوّد أو
     بتأكيد إداري صريح لتحويل مصرفي تم التحقق منه.
   • المعالجة آمنة عند التكرار: كل إشعار له معرّف فريد، والتفعيل مرة واحدة فقط.
   ========================================================================== */
import crypto from 'node:crypto';
import { q, one } from './db.js';
import { HttpError } from './errors.js';

/* حقن التبعيات من handlers.js (تجنّبًا للاستيراد الدائري) */
let deps = { creditsAdd: async () => null, notify: async () => {} };
export function configureSubscriptions(d) { deps = { ...deps, ...d }; }

/* ------------------------------------------------------------------ */
/* 1) الخطط — أسعار افتراضية قابلة للتعديل، غير معتمدة حتى يعتمدها المالك */
/* ------------------------------------------------------------------ */
export const CURRENCY_DEFAULT = 'DZD';
const FEATURES_BASE = [
  'محادثات ذكية متعددة مع حفظ السياق',
  'Markdown كامل: جداول ومعادلات وأكواد قابلة للنسخ',
  'بحث ويب حقيقي مع المصادر والروابط',
  'رفع الملفات: PDF / DOCX / TXT وتحليلها',
  'تحليل الصور بنموذج رؤية',
  'صوت: إدخال بالكلام وقراءة الردود',
];
export const PLAN_SEED = [
  {
    id: 'free', name_ar: 'المجانية', name_en: 'Free', tier: 0,
    price_month: 0, price_year: 0, included_credits: 30, sort: 1,
    features: FEATURES_BASE.slice(0, 4).concat(['حدود يومية واضحة للمحادثة والبحث والصور والصوت والملفات']),
    limits: { chat: [20, 'day'], search: [5, 'day'], image: [3, 'day'], voice: [3, 'day'], file: [5, 'day'] },
  },
  {
    id: 'plus', name_ar: 'Plus', name_en: 'Plus', tier: 1,
    price_month: 1900, price_year: 19000, included_credits: 1000, sort: 2,
    features: FEATURES_BASE.concat(['حصة شهرية أعلى', 'دعم ذو أولوية على قنوات التواصل']),
    limits: { chat: [1000, 'month'], search: [200, 'month'], image: [60, 'month'], voice: [60, 'month'], file: [200, 'month'] },
  },
  {
    id: 'pro', name_ar: 'Pro', name_en: 'Pro', tier: 2,
    price_month: 4900, price_year: 49000, included_credits: 5000, sort: 3,
    features: FEATURES_BASE.concat(['أعلى حصص الاستخدام', 'ملفات ورسائل صوتية بحصة موسّعة', 'مخصص لمن يستخدم المساعد يوميًا في العمل']),
    limits: { chat: [5000, 'month'], search: [1000, 'month'], image: [300, 'month'], voice: [300, 'month'], file: [1000, 'month'] },
  },
];

/* تكلفة تقديرية لوحدة الذكاء الاصطناعي بالدولار (للوحة الإيرادات فقط — قابلة للتعديل) */
export const AI_COST_ESTIMATE_USD = { chat: 0.0006, search: 0.0, image: 0.0008, voice: 0.004, file: 0.0002 };
export const FEATURES = ['chat', 'search', 'image', 'voice', 'file'];

let ready = false;
export async function subsEnsure() {
  if (ready) return true;
  await q(`create table if not exists subscription_plans (
    id text primary key,
    name_ar text not null, name_en text,
    tier int not null default 0,
    currency text not null default 'DZD',
    price_month numeric(12,2) not null default 0,
    price_year numeric(12,2) not null default 0,
    price_usd_month numeric(12,2), price_eur_month numeric(12,2),
    included_credits int not null default 0,
    features jsonb not null default '[]'::jsonb,
    approved boolean not null default false,
    note text,
    active boolean not null default true,
    sort int not null default 0,
    created_at timestamptz not null default now(), updated_at timestamptz not null default now())`);
  await q(`create table if not exists usage_limits (
    id bigserial primary key,
    plan_id text not null references subscription_plans(id) on delete cascade,
    feature text not null,
    period text not null default 'month',
    limit_count int not null,
    cost_units numeric(8,3) not null default 1,
    updated_at timestamptz not null default now(),
    unique (plan_id, feature))`);
  await q(`create table if not exists user_subscriptions (
    id bigserial primary key,
    user_id bigint not null references users(id) on delete cascade,
    plan_id text not null references subscription_plans(id),
    period text not null default 'month',
    status text not null default 'pending',
    started_at timestamptz, current_period_end timestamptz,
    cancel_at_period_end boolean not null default false,
    auto_renew boolean not null default false,
    provider text, provider_ref text,
    created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
    canceled_at timestamptz)`);
  await q(`create unique index if not exists user_subs_one_live on user_subscriptions(user_id)
           where status in ('active','pending')`);
  await q(`create index if not exists user_subs_user_idx on user_subscriptions(user_id, created_at desc)`);
  await q(`create table if not exists payment_transactions (
    id bigserial primary key,
    user_id bigint not null references users(id) on delete cascade,
    subscription_id bigint references user_subscriptions(id) on delete set null,
    reference text unique not null,
    provider text not null default 'wallet',
    provider_ref text,
    purpose text not null default 'subscription',
    plan_id text, period text,
    amount numeric(12,2) not null default 0,
    currency text not null default 'DZD',
    fees numeric(12,2) not null default 0,
    method text,
    status text not null default 'pending',
    created_at timestamptz not null default now(),
    paid_at timestamptz, failed_at timestamptz, updated_at timestamptz not null default now(),
    meta jsonb not null default '{}'::jsonb)`);
  await q(`create index if not exists pay_tx_user_idx on payment_transactions(user_id, created_at desc)`);
  await q(`create index if not exists pay_tx_status_idx on payment_transactions(status, created_at desc)`);
  await q(`create table if not exists payment_webhook_events (
    id bigserial primary key,
    provider text not null,
    event_id text not null,
    reference text,
    signature_valid boolean not null default false,
    payload jsonb not null default '{}'::jsonb,
    received_at timestamptz not null default now(),
    processed boolean not null default false,
    result text, processed_at timestamptz,
    unique (provider, event_id))`);
  await q(`create index if not exists hook_ref_idx on payment_webhook_events(reference)`);
  await q(`create table if not exists usage_records (
    id bigserial primary key,
    user_id bigint not null references users(id) on delete cascade,
    feature text not null,
    units numeric(8,2) not null default 1,
    bill_mode text not null default 'plan',
    credits_spent int not null default 0,
    cost_estimate numeric(10,4) not null default 0,
    provider text, model text,
    subscription_id bigint references user_subscriptions(id) on delete set null,
    created_at timestamptz not null default now())`);
  await q(`create index if not exists usage_user_feature_idx on usage_records(user_id, feature, created_at desc)`);
  await q(`create table if not exists refund_records (
    id bigserial primary key,
    transaction_id bigint not null references payment_transactions(id) on delete cascade,
    user_id bigint not null references users(id) on delete cascade,
    amount numeric(12,2) not null, currency text not null default 'DZD',
    reason text, status text not null default 'requested',
    provider_ref text,
    requested_at timestamptz not null default now(), processed_at timestamptz, processed_by bigint)`);

  /* البذور: تُزرع مرة واحدة فقط ولا تلمس أي تعديل إداري لاحق */
  const count = await one('select count(*)::int as n from subscription_plans');
  if (!count || count.n === 0) {
    for (const p of PLAN_SEED) {
      await q(`insert into subscription_plans(id, name_ar, name_en, tier, price_month, price_year, included_credits, features, sort, approved, note)
               values($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11) on conflict (id) do nothing`,
        [p.id, p.name_ar, p.name_en, p.tier, p.price_month, p.price_year, p.included_credits, JSON.stringify(p.features), p.sort, false,
         'سعر افتراضي مقترح — غير معتمد حتى يعدّله المالك من لوحة الإدارة']);
      for (const [feature, [limit, period]] of Object.entries(p.limits)) {
        await q(`insert into usage_limits(plan_id, feature, period, limit_count) values($1,$2,$3,$4)
                 on conflict (plan_id, feature) do nothing`, [p.id, feature, period, limit]);
      }
    }
  }
  ready = true;
  return true;
}

const num = (v) => (v === null || v === undefined ? null : Number(v));
export async function plansAll({ includeInactive = false } = {}) {
  await subsEnsure();
  const rows = await q(`select * from subscription_plans ${includeInactive ? '' : 'where active=true'} order by sort, tier`);
  const limits = await q('select plan_id, feature, period, limit_count, cost_units from usage_limits order by plan_id, feature');
  return rows.map((r) => ({
    id: r.id, nameAr: r.name_ar, nameEn: r.name_en, tier: r.tier, currency: r.currency,
    priceMonth: num(r.price_month), priceYear: num(r.price_year),
    priceUsdMonth: num(r.price_usd_month), priceEurMonth: num(r.price_eur_month),
    includedCredits: r.included_credits, features: r.features || [], approved: !!r.approved,
    note: r.note, active: !!r.active,
    limits: limits.filter((l) => l.plan_id === r.id).reduce((acc, l) => {
      acc[l.feature] = { period: l.period, limit: l.limit_count, costUnits: num(l.cost_units) };
      return acc;
    }, {}),
  }));
}
export async function planPublic() {
  const plans = await plansAll();
  return plans.filter((p) => p.id !== 'free');
}
async function planRow(planId) {
  await subsEnsure();
  return one('select * from subscription_plans where id=$1', [planId]);
}
async function limitRow(planId, feature) {
  return one('select period, limit_count from usage_limits where plan_id=$1 and feature=$2', [planId, feature]);
}

/* ------------------------------------------------------------------ */
/* 2) صلاحية الاشتراك والحصص (تحقّق على الخادم قبل كل طلب)             */
/* ------------------------------------------------------------------ */
export async function sweepExpired() {
  try {
    await q(`update user_subscriptions set status='expired', updated_at=now()
             where status='active' and current_period_end is not null and current_period_end < now()`);
  } catch { /* الجدول يُنشأ في first run */ }
}
export async function activeSubscription(userId) {
  await subsEnsure();
  await sweepExpired();
  return one(`select s.*, p.name_ar as plan_name from user_subscriptions s
              join subscription_plans p on p.id = s.plan_id
              where s.user_id=$1 and s.status='active' and (s.current_period_end is null or s.current_period_end > now())
              order by s.id desc limit 1`, [userId]);
}
export async function userPlan(userId) {
  const sub = await activeSubscription(userId);
  return { planId: sub ? sub.plan_id : 'free', sub };
}
function windowStart(period, sub) {
  if (period === 'day') return "date_trunc('day', now())";
  return sub && sub.started_at ? 'x' : "date_trunc('month', now())";   // 'x' غير مستخدم — يُحسب في JS
}
async function usageUsed(userId, feature, period, sub) {
  const params = [userId, feature];
  let since;
  if (period === 'day') since = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
  else if (sub && sub.started_at) since = new Date(sub.started_at);
  else since = new Date(new Date().toISOString().slice(0, 8) + '01T00:00:00Z');
  const row = await one(`select coalesce(sum(units),0)::float as used from usage_records
                         where user_id=$1 and feature=$2 and created_at >= $3`, [...params, since.toISOString()]);
  return Math.round((row?.used || 0) * 100) / 100;
}
/** بوابة الحصص: تُرمي خطأ واضحًا عند تجاوز الخطة — لا يمكن تجاوزها من المتصفح */
export async function usageGate(userId, feature) {
  const { planId, sub } = await userPlan(userId);
  const lim = await limitRow(planId, feature);
  if (!lim || lim.limit_count < 0) return { ok: true, planId, unlimited: true };
  const used = await usageUsed(userId, feature, lim.period, sub);
  if (used < lim.limit_count) {
    return { ok: true, planId, used, limit: lim.limit_count, period: lim.period };
  }
  const labels = { chat: 'الرسائل', search: 'البحث', image: 'تحليل الصور', voice: 'الرسائل الصوتية', file: 'الملفات' };
  const when = lim.period === 'day' ? 'اليوم' : 'هذه الفترة';
  const better = planId === 'free' ? 'Plus أو Pro' : 'Pro';
  throw new HttpError(402, 'plan_limit_reached', 'plan_limit_reached',
    `استهلكت حدّ خطة ${planId} ${when}: ${labels[feature] || feature} ${used}/${lim.limit_count}. رقّي إلى ${better} أو انتظر تجديد الفترة.`);
}
export async function recordUsage(userId, feature, { units = 1, billMode = 'plan', creditsSpent = 0, provider = null, model = null, subscriptionId = null } = {}) {
  try {
    await q(`insert into usage_records(user_id, feature, units, bill_mode, credits_spent, cost_estimate, provider, model, subscription_id)
             values($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [userId, feature, units, billMode, creditsSpent, AI_COST_ESTIMATE_USD[feature] ?? 0, provider, model, subscriptionId]);
  } catch { /* القياس لا يجب أن يُفشل الطلب */ }
}
export async function usageSummary(userId, planIdParam = null) {
  const { planId, sub } = planIdParam ? { planId: planIdParam, sub: null } : await userPlan(userId);
  const limits = await q('select feature, period, limit_count from usage_limits where plan_id=$1 order by feature', [planId]);
  const out = {};
  for (const l of limits) {
    const used = await usageUsed(userId, l.feature, l.period, sub);
    out[l.feature] = { period: l.period, limit: l.limit_count, used, remaining: Math.max(0, l.limit_count - used) };
  }
  return { planId, subscriptionId: sub ? Number(sub.id) : null, features: out };
}

/* ------------------------------------------------------------------ */
/* 3) مزوّدو الدفع — حالة حقيقية من متغيرات البيئة بلا اختراع           */
/* ------------------------------------------------------------------ */
const SANDBOX_ALLOWED = () => process.env.PAYMENTS_SANDBOX === '1' && process.env.VERCEL_ENV !== 'production';

export const PROVIDERS = {
  wallet: {
    id: 'wallet', label: 'محفظتي / تحويل بنكي (تحقّق يدوي)', kind: 'manual', live: true,
    required: [],
    doc: 'المسار الأسرع اليوم في الجزائر: يحوّل العميل عبر محفظتي/BaridiMob إلى رقم المحفظة، ثم يؤكّد المالك وصول المبلغ يدويًا.',
  },
  satim: {
    id: 'satim', label: 'SATIM — بطاقة CIB / الذهبية', kind: 'card', live: true,
    required: ['SATIM_CHECKOUT_URL', 'SATIM_MERCHANT_ID', 'SATIM_TERMINAL_ID', 'SATIM_PASSWORD', 'SATIM_WEBHOOK_SECRET'],
    doc: 'التقديم عبر البنك (cibweb.dz) ويتطلب سجلًا تجاريًا وحسابًا بنكيًا مهنيًا وعقد تاجر — بدون ذلك لا يوجد sandbox ولا مفاتيح.',
  },
  stripe: {
    id: 'stripe', label: 'Stripe (مدفوعات دولية)', kind: 'card', live: true,
    required: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
    doc: 'Stripe لا تفتح حسابات لكيانات مقيمة في الجزائر؛ الطبقة جاهزة ولا تعمل إلا إذا توفّرت أهلية قانونية فعلية للنشاط.',
  },
  sandbox: {
    id: 'sandbox', label: 'اختبار محلي (لا يعمل في الإنتاج)', kind: 'test', live: false,
    required: ['PAYMENTS_SANDBOX_SECRET'],
    doc: 'لتشغيل اختبارات السيناريوهات على الخادم المحلي فقط؛ مُعطَّل قطعيًا عندما VERCEL_ENV=production.',
  },
};
export function providerStatus(providerId) {
  const p = PROVIDERS[providerId];
  if (!p) return null;
  if (providerId === 'sandbox') {
    const missing = p.required.filter((k) => !process.env[k]);
    const allowed = SANDBOX_ALLOWED();
    return { id: p.id, label: p.label, kind: p.kind, live: false, available: allowed && missing.length === 0,
      missing, reason: !allowed ? 'sandbox_disabled_here' : (missing.length ? 'missing_env' : null), doc: p.doc };
  }
  const missing = p.required.filter((k) => !process.env[k]);
  return { id: p.id, label: p.label, kind: p.kind, live: true, available: missing.length === 0,
    missing, reason: missing.length ? 'missing_env' : null, doc: p.doc };
}
export function providersStatus() {
  const walletNumber = process.env.PAYMENT_WALLET_NUMBER || null;
  return Object.keys(PROVIDERS).map((id) => {
    const s = providerStatus(id);
    if (id === 'wallet') return { ...s, available: !!walletNumber, missing: walletNumber ? [] : ['PAYMENT_WALLET_NUMBER'], reason: walletNumber ? null : 'missing_env' };
    return s;
  });
}
export function walletInfo() {
  return {
    number: process.env.PAYMENT_WALLET_NUMBER || null,
    holder: process.env.PAYMENT_WALLET_HOLDER || null,
    app: process.env.PAYMENT_WALLET_APP || 'محفظتي',
    contact: process.env.PAYMENT_CONTACT || null,
  };
}

/* ------------------------------------------------------------------ */
/* 4) إنشاء طلب دفع + إشعارات المزوّد (توقيع + منع التكرار)             */
/* ------------------------------------------------------------------ */
const ref = (planId, period) => `NX-${String(planId).toUpperCase().slice(0, 4)}-${period === 'year' ? 'Y' : 'M'}-` +
  crypto.randomBytes(4).toString('hex').toUpperCase();

export async function startCheckout({ userId, planId, period = 'month', providerId = 'wallet' }) {
  await subsEnsure();
  const plan = await planRow(planId);
  if (!plan || !plan.active) throw new HttpError(400, 'unknown_plan');
  const per = period === 'year' ? 'year' : 'month';
  const amount = Number(per === 'year' ? plan.price_year : plan.price_month);
  if (!(amount > 0)) throw new HttpError(400, 'plan_not_purchasable', 'plan_not_purchasable', 'هذه الخطة مجانية ولا تحتاج دفعًا.');
  const st = providerStatus(providerId);
  if (!st) throw new HttpError(400, 'unknown_provider');
  if (!st.available) {
    const w = walletInfo();
    throw new HttpError(503, 'payment_provider_unavailable', 'payment_provider_unavailable',
      `مزوّد ${providerId} غير مُهيّأ على الخادم (ناقص: ${st.missing.join(', ') || st.reason}).` +
      (w.number ? ` يمكنك الدفع عبر ${w.app} إلى ${w.number} ثم يُفعّله المالك بعد التحقق.` : ''));
  }
  const currency = plan.currency || CURRENCY_DEFAULT;
  const reference = ref(planId, per);
  const tx = await one(`insert into payment_transactions(user_id, reference, provider, purpose, plan_id, period, amount, currency, method, status, meta)
                        values($1,$2,$3,'subscription',$4,$5,$6,$7,$8,'pending',$9::jsonb)
                        returning *`,
    [userId, reference, providerId, planId, per, amount, currency, st.kind, JSON.stringify({ planName: plan.name_ar, checkout: null })]);

  if (providerId === 'satim' || providerId === 'stripe') {
    const co = providerId === 'satim'
      ? await satimCheckout({ tx, plan, origin: process.env.PUBLIC_ORIGIN || null })
      : await stripeCheckout({ tx, plan });
    if (!co.ok) {
      await q(`update payment_transactions set status='failed', failed_at=now(), meta = meta || $2::jsonb, updated_at=now() where id=$1`,
        [tx.id, JSON.stringify({ checkout_error: co.error })]);
      throw new HttpError(502, 'provider_checkout_failed', 'provider_checkout_failed', co.error);
    }
    await q(`update payment_transactions set provider_ref=$2, meta = jsonb_set(meta, '{checkout}', $3::jsonb), updated_at=now() where id=$1`,
      [tx.id, co.providerRef || null, JSON.stringify({ url: co.url })]);
    return { transaction: { ...tx, provider_ref: co.providerRef, status: 'pending' }, redirectUrl: co.url, provider: st };
  }
  return {
    transaction: tx, provider: st,
    wallet: providerId === 'wallet' ? walletInfo() : null,
    sandboxWebhook: providerId === 'sandbox' ? '/api/payments/webhook/sandbox' : null,
    instructions: providerId === 'wallet'
      ? 'حوّل المبلغ إلى رقم المحفظة أعلاه، ثم أرسل رمز الطلب إلى قناة التواصل ليُفعّل الاشتراك بعد التحقق من وصول المبلغ.'
      : null,
  };
}

/* SATIM: لا نعرف مسارًا إلا ما يمنحه العقد — لذلك المسار كامل من متغير البيئة */
async function satimCheckout({ tx, plan }) {
  try {
    const url = process.env.SATIM_CHECKOUT_URL;
    const res = await fetch(url, {
      method: 'POST',
      signal: AbortSignal.timeout(20000),
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'NEXORA-AI/1.0' },
      body: JSON.stringify({
        userName: process.env.SATIM_MERCHANT_ID, password: process.env.SATIM_PASSWORD,
        orderNumber: tx.reference, amount: Math.round(Number(tx.amount) * 100), currency: '012',
        returnUrl: (process.env.PUBLIC_ORIGIN || '') + '/ai?pay=return&ref=' + tx.reference,
        failUrl: (process.env.PUBLIC_ORIGIN || '') + '/ai?pay=fail&ref=' + tx.reference,
        description: 'NEXORA ' + plan.name_ar + ' ' + tx.period,
        terminalId: process.env.SATIM_TERMINAL_ID,
      }),
    });
    const data = await res.json().catch(() => ({}));
    const url2 = data.formUrl || data.redirectUrl || data.url;
    if (!res.ok || !url2) return { ok: false, error: 'satim_http_' + res.status + ':' + String(data.errorCode || data.errorMessage || '').slice(0, 60) };
    return { ok: true, url: url2, providerRef: data.orderId || data.mdOrder || null };
  } catch (e) { return { ok: false, error: 'satim:' + String(e?.message || e).slice(0, 80) }; }
}
/* Stripe: بروتوكول عام موثّق؛ تُستعمل فقط إذا توفّرت أهلية فعلية */
async function stripeCheckout({ tx, plan }) {
  try {
    const origin = process.env.PUBLIC_ORIGIN || 'https://nexora-social-2026.vercel.app';
    const body = new URLSearchParams({
      mode: 'payment',
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': String(process.env.STRIPE_CURRENCY || 'usd'),
      'line_items[0][price_data][unit_amount]': String(Math.round(Number(process.env.STRIPE_UNIT_AMOUNT || 0))),
      'line_items[0][price_data][product_data][name]': 'NEXORA ' + plan.name_ar + ' · ' + tx.period,
      client_reference_id: tx.reference,
      success_url: origin + '/ai?pay=return&ref=' + tx.reference,
      cancel_url: origin + '/ai?pay=cancel&ref=' + tx.reference,
    });
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST', signal: AbortSignal.timeout(20000),
      headers: { Authorization: 'Bearer ' + process.env.STRIPE_SECRET_KEY, 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) return { ok: false, error: 'stripe_http_' + res.status + ':' + String(data?.error?.code || '').slice(0, 40) };
    return { ok: true, url: data.url, providerRef: data.id };
  } catch (e) { return { ok: false, error: 'stripe:' + String(e?.message || e).slice(0, 80) }; }
}

const hmac = (algo, secret, raw) => crypto.createHmac(algo || 'sha256', secret).update(raw, 'utf8').digest('hex');
const safeEq = (a, b) => {
  const A = Buffer.from(String(a || '')); const B = Buffer.from(String(b || ''));
  return A.length === B.length && A.length > 0 && crypto.timingSafeEqual(A, B);
};

/** تحقّق التوقيع + تطبيع الحمولة. لا شيء يُقبل بلا توقيع صحيح. */
export function verifyWebhook(providerId, rawBody, headers = {}) {
  const h = (k) => headers[k] || headers[k.toLowerCase()] || headers[k.toUpperCase()] || '';
  if (providerId === 'satim' || providerId === 'sandbox') {
    /* نفحص أولًا أن بوابة الاختبار ممنوعة هنا حتى يكون الرفض صريحًا لا غامضًا */
    if (providerId === 'sandbox' && !SANDBOX_ALLOWED()) throw new HttpError(403, 'sandbox_disabled', 'sandbox_disabled', 'مزوّد الاختبار مُعطَّل في هذه البيئة — لا بوابة محاكاة في الإنتاج.');
    const secret = providerId === 'satim' ? process.env.SATIM_WEBHOOK_SECRET : process.env.PAYMENTS_SANDBOX_SECRET;
    if (!secret) throw new HttpError(503, 'webhook_not_configured', 'webhook_not_configured', 'مزوّد ' + providerId + ' غير مُهيّأ لاستقبال الإشعارات.');
    const headerName = (providerId === 'satim' ? (process.env.SATIM_SIGNATURE_HEADER || 'x-satim-signature') : 'x-sandbox-signature');
    const got = h(headerName);
    const expect = hmac(providerId === 'satim' ? process.env.SATIM_SIGNATURE_ALGO : 'sha256', secret, rawBody);
    if (!safeEq(got, expect)) throw new HttpError(401, 'invalid_signature');
    return JSON.parse(rawBody || '{}');
  }
  if (providerId === 'stripe') {
    const sec = process.env.STRIPE_WEBHOOK_SECRET;
    if (!sec) throw new HttpError(503, 'webhook_not_configured');
    const sig = h('stripe-signature');
    const parts = Object.fromEntries(String(sig).split(',').map((p) => p.split('=')));
    if (!parts.t || !parts.v1) throw new HttpError(401, 'invalid_signature');
    if (Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) throw new HttpError(401, 'signature_expired');
    const expect = crypto.createHmac('sha256', sec).update(parts.t + '.' + rawBody, 'utf8').digest('hex');
    if (!safeEq(parts.v1, expect)) throw new HttpError(401, 'invalid_signature');
    return JSON.parse(rawBody || '{}');
  }
  throw new HttpError(404, 'unknown_provider');
}

/** تطبيع حمولة المزوّد إلى حقولنا الموحّدة */
export function normalizeEvent(providerId, payload) {
  const p = payload || {};
  const o = p.data && p.data.object ? p.data.object : p;          // Stripe يضع الكائن في data.object
  const statusRaw = String(o.status || o.payment_status || o.result || o.state || '').toLowerCase();
  const map = {
    paid: 'paid', success: 'paid', succeeded: 'paid', confirmed: 'paid', approved: 'paid', captured: 'paid',
    failed: 'failed', failure: 'failed', declined: 'failed', error: 'failed', rejected: 'failed',
    canceled: 'canceled', cancelled: 'canceled', expired: 'canceled',
    refunded: 'refunded', refund: 'refunded',
    disputed: 'disputed', chargeback: 'disputed',
  };
  const status = map[statusRaw] || 'unknown';
  const reference = o.reference || o.orderNumber || o.order_number || o.client_reference_id || o.mdOrder || p.reference || null;
  const amountRaw = o.amount ?? o.total ?? o.amount_total ?? null;
  const amount = amountRaw === null ? null
    : (providerId === 'stripe' && Number.isInteger(Number(amountRaw)) ? Number(amountRaw) / 100 : Number(amountRaw));
  const eventId = String(p.id || p.eventId || p.event_id || o.eventId || o.orderId || (reference ? `${reference}:${statusRaw}` : '') ||
    crypto.createHash('sha256').update(JSON.stringify(p)).digest('hex').slice(0, 32));
  return {
    eventId, reference, status, amount, currency: (o.currency || p.currency || null),
    providerRef: o.orderId || o.mdOrder || o.id || o.payment_intent || null,
    raw: p,
  };
}

/** معالجة الإشعار: تُسجّل أولًا، ثم تُعالج مرة واحدة فقط (منع التكرار) */
export async function applyWebhook(providerId, ev, rawBody) {
  await subsEnsure();
  const ins = await one(`insert into payment_webhook_events(provider, event_id, reference, signature_valid, payload)
                         values($1,$2,$3,true,$4::jsonb)
                         on conflict (provider, event_id) do nothing
                         returning id`,
    [providerId, String(ev.eventId).slice(0, 160), ev.reference ? String(ev.reference).slice(0, 80) : null,
     JSON.stringify({ status: ev.status, amount: ev.amount, currency: ev.currency, providerRef: ev.providerRef, bytes: String(rawBody || '').length })]);
  if (!ins) {
    const dup = await one('select id, result, processed from payment_webhook_events where provider=$1 and event_id=$2',
      [providerId, String(ev.eventId).slice(0, 160)]);
    return { ok: true, duplicate: true, eventRowId: Number(dup?.id || 0), detail: 'إشعار مكرر — لم يُنفَّذ أي تفعيل إضافي.' };
  }
  const finish = (result, processed = true) => q(`update payment_webhook_events set processed=$2, result=$3, processed_at=now() where id=$1`,
    [ins.id, processed, result]).catch(() => {});
  try {
    if (!ev.reference) { await finish('missing_reference', false); return { ok: false, detail: 'إشعار بلا مرجع طلب.' }; }
    const tx = await one('select * from payment_transactions where reference=$1', [ev.reference]);
    if (!tx) { await finish('unknown_reference', false); return { ok: false, detail: 'مرجع غير معروف.' }; }
    if (ev.amount !== null && ev.amount !== undefined && Number(ev.amount) !== Number(tx.amount)) {
      await finish('amount_mismatch', false);
      return { ok: false, detail: 'المبلغ في الإشعار لا يطابق الطلب — لم يُفعَّل شيء.' };
    }
    if (ev.currency && String(ev.currency).toUpperCase() !== String(tx.currency).toUpperCase()) {
      await finish('currency_mismatch', false);
      return { ok: false, detail: 'العملة لا تطابق الطلب.' };
    }
    if (ev.status === 'paid') {
      if (tx.status === 'paid') { await finish('already_paid'); return { ok: true, detail: 'مدفوع مسبقًا — لا تفعيل مزدوج.' }; }
      const res = await activateSubscription({ userId: tx.user_id, planId: tx.plan_id, period: tx.period, txId: tx.id, provider: providerId, providerRef: ev.providerRef });
      await q(`update payment_transactions set status='paid', paid_at=now(), provider_ref=coalesce($2, provider_ref), updated_at=now() where id=$1`,
        [tx.id, ev.providerRef || null]);
      await finish('activated');
      return { ok: true, activated: true, ...res };
    }
    if (ev.status === 'failed' || ev.status === 'canceled') {
      await q(`update payment_transactions set status=$2, failed_at=now(), updated_at=now() where id=$1 and status <> 'paid'`, [tx.id, ev.status]);
      await finish('marked_' + ev.status);
      return { ok: true, detail: 'حُفظت حالة الدفع: ' + ev.status };
    }
    if (ev.status === 'refunded' || ev.status === 'disputed') {
      if (tx.status === 'paid') await revokeSubscription({ userId: tx.user_id, txId: tx.id, reason: ev.status });
      await q(`update payment_transactions set status=$2, updated_at=now() where id=$1`, [tx.id, ev.status]);
      await finish('marked_' + ev.status);
      return { ok: true, detail: 'حُفظت الحالة: ' + ev.status };
    }
    await finish('unhandled_status:' + ev.status, false);
    return { ok: false, detail: 'حالة غير معروفة — لم يُفعَّل شيء (' + ev.status + ')' };
  } catch (e) {
    await finish('error:' + String(e?.message || e).slice(0, 80), false);
    throw e;
  }
}

/* ------------------------------------------------------------------ */
/* 5) التفعيل والإلغاء والاسترداد                                      */
/* ------------------------------------------------------------------ */
export async function activateSubscription({ userId, planId, period = 'month', txId = null, provider = null, providerRef = null }) {
  await subsEnsure();
  const plan = await planRow(planId);
  if (!plan) throw new HttpError(400, 'unknown_plan');
  const per = period === 'year' ? 'year' : 'month';
  const existing = await activeSubscription(userId);
  if (existing && existing.plan_id === planId) {
    const upd = await one(`update user_subscriptions
                           set current_period_end = greatest(coalesce(current_period_end, now()), now()) + interval '1 ${per}',
                               status='active', provider=coalesce($2, provider), provider_ref=coalesce($3, provider_ref), updated_at=now()
                           where id=$1 returning *`, [existing.id, provider, providerRef]);
    const credits = await grantIncluded(userId, plan, txId);
    return { subscription: upd, extended: true, includedCredits: credits };
  }
  if (existing) {
    await q(`update user_subscriptions set status='canceled', canceled_at=now(), updated_at=now(), cancel_at_period_end=false where id=$1`, [existing.id]);
  }
  const created = await one(`insert into user_subscriptions(user_id, plan_id, period, status, started_at, current_period_end, provider, provider_ref, auto_renew)
                             values($1,$2,$3,'active', now(), now() + interval '1 ${per}', $4, $5, false) returning *`,
    [userId, planId, per, provider, providerRef]);
  if (txId) await q('update payment_transactions set subscription_id=$2, updated_at=now() where id=$1', [txId, created.id]);
  const credits = await grantIncluded(userId, plan, txId);
  try { await deps.notify(userId, null, 'credits', null, `تم تفعيل اشتراك ${plan.name_ar} (${per === 'year' ? 'سنوي' : 'شهري'}) — ${credits} نقطة مضافة.`); } catch { /* best-effort */ }
  return { subscription: created, extended: false, includedCredits: credits };
}
async function grantIncluded(userId, plan, txId) {
  const amount = Number(plan.included_credits || 0);
  if (!(amount > 0)) return 0;
  await deps.creditsAdd(userId, amount, 'subscription', txId ? 'tx:' + txId : plan.id, plan.id);
  return amount;
}
export async function revokeSubscription({ userId, txId = null, reason = 'revoked' }) {
  const sub = await activeSubscription(userId);
  if (!sub) return { ok: true, revoked: false };
  await q(`update user_subscriptions set status='canceled', canceled_at=now(), cancel_at_period_end=false, updated_at=now() where id=$1`, [sub.id]);
  /* النقاط الممنوحة مع الاشتراك تُسحب حتى حدود الرصيد المتاح */
  if (txId) {
    const plan = await planRow(sub.plan_id);
    const amount = Number(plan?.included_credits || 0);
    if (amount > 0) {
      const row = await one(`update user_credits set balance = greatest(0, balance - $2), updated_at=now()
                             where user_id=$1 returning balance`, [userId, amount]);
      if (row) await q(`insert into credit_ledger(user_id, delta, reason, ref, balance_after) values($1,$2,$3,$4,$5)`,
        [userId, -amount, 'refund_reversal', 'tx:' + txId, row.balance]).catch(() => {});
    }
  }
  return { ok: true, revoked: true, reason };
}
/** إلغاء التجديد أو استئنافه — على اشتراك المستخدم نفسه فقط */
export async function cancelOrResume(userId, resume = false) {
  const sub = await activeSubscription(userId);
  if (!sub) throw new HttpError(404, 'no_active_subscription');
  if (sub.auto_renew) throw new HttpError(400, 'auto_renew_requires_provider_support', 'auto_renew_requires_provider_support',
    'التجديد التلقائي غير مُفعّل — لا مزوّد يدعمه حاليًا لهذا الحساب.');
  const row = await one('update user_subscriptions set cancel_at_period_end=$2, updated_at=now() where id=$1 returning *',
    [sub.id, resume ? false : true]);
  return { subscription: row, cancelAtPeriodEnd: !!row.cancel_at_period_end };
}
/** تأكيد إداري لتحويل يدوي (محفظتي) — يُستدعى بعد تحقّق المالك من وصول المبلغ */
export async function adminConfirmPayment({ reference, adminId }) {
  await subsEnsure();
  const tx = await one('select * from payment_transactions where reference=$1', [reference]);
  if (!tx) throw new HttpError(404, 'transaction_not_found');
  if (tx.status === 'paid') return { ok: true, already: true, status: 'paid' };
  if (tx.status === 'refunded' || tx.status === 'disputed') throw new HttpError(409, 'transaction_closed');
  const res = await activateSubscription({ userId: tx.user_id, planId: tx.plan_id, period: tx.period, txId: tx.id, provider: tx.provider, providerRef: tx.provider_ref });
  await q(`update payment_transactions set status='paid', paid_at=now(), updated_at=now() where id=$1`, [tx.id]);
  return { ok: true, status: 'paid', ...res, userId: Number(tx.user_id) };
}
export async function refundCreate({ transactionId, amount = null, reason = null, adminId = null, providerRef = null, status = 'refunded' }) {
  await subsEnsure();
  const tx = await one('select * from payment_transactions where id=$1', [transactionId]);
  if (!tx) throw new HttpError(404, 'transaction_not_found');
  if (tx.status !== 'paid' && tx.status !== 'refunded') throw new HttpError(409, 'not_refundable', 'not_refundable', 'لا يمكن استرداد معاملة غير مدفوعة.');
  const amt = amount === null ? Number(tx.amount) : Number(amount);
  if (!(amt > 0) || amt > Number(tx.amount)) throw new HttpError(400, 'invalid_refund_amount');
  const row = await one(`insert into refund_records(transaction_id, user_id, amount, currency, reason, status, provider_ref, processed_at, processed_by)
                         values($1,$2,$3,$4,$5,$6,$7, now(), $8) returning *`,
    [tx.id, tx.user_id, amt, tx.currency, (reason || '').slice(0, 200), status, providerRef, adminId]);
  if (status === 'refunded') {
    await revokeSubscription({ userId: tx.user_id, txId: tx.id, reason: 'refund' });
    await q(`update payment_transactions set status='refunded', updated_at=now() where id=$1`, [tx.id]);
  }
  return row;
}

/* ------------------------------------------------------------------ */
/* 6) العرض للمستخدم والإحصاءات الحقيقية للإدارة                        */
/* ------------------------------------------------------------------ */
export async function userSubscriptionView(userId) {
  await subsEnsure();
  const sub = await activeSubscription(userId);
  const payments = await q(`select id, reference, provider, plan_id, period, amount, currency, status, created_at, paid_at
                            from payment_transactions where user_id=$1 order by id desc limit 20`, [userId]);
  const refunds = await q(`select r.id, r.amount, r.currency, r.status, r.reason, r.requested_at, t.reference
                           from refund_records r join payment_transactions t on t.id=r.transaction_id
                           where r.user_id=$1 order by r.id desc limit 10`, [userId]);
  const usage = await usageSummary(userId);
  return {
    subscription: sub ? {
      id: Number(sub.id), planId: sub.plan_id, planName: sub.plan_name, period: sub.period, status: sub.status,
      startedAt: sub.started_at, currentPeriodEnd: sub.current_period_end,
      cancelAtPeriodEnd: !!sub.cancel_at_period_end, autoRenew: !!sub.auto_renew, provider: sub.provider,
      daysLeft: sub.current_period_end ? Math.max(0, Math.ceil((new Date(sub.current_period_end) - Date.now()) / 864e5)) : null,
    } : null,
    planId: usage.planId,
    usage: usage.features,
    payments: payments.map((p) => ({
      id: Number(p.id), reference: p.reference, provider: p.provider, planId: p.plan_id, period: p.period,
      amount: num(p.amount), currency: p.currency, status: p.status, createdAt: p.created_at, paidAt: p.paid_at,
      receipt: p.status === 'paid' ? { reference: p.reference, amount: num(p.amount), currency: p.currency, paidAt: p.paid_at, planId: p.plan_id, period: p.period } : null,
    })),
    refunds: refunds.map((r) => ({ id: Number(r.id), amount: num(r.amount), currency: r.currency, status: r.status, reason: r.reason, requestedAt: r.requested_at, reference: r.reference })),
    providers: providersStatus(),
    wallet: walletInfo(),
    plans: await plansAll(),
  };
}

export async function revenueOverview() {
  await subsEnsure();
  await sweepExpired();
  const subs = await q(`select status, count(*)::int as n from user_subscriptions group by status`);
  const byPlan = await q(`select plan_id, status, count(*)::int as n from user_subscriptions where status='active' group by plan_id, status`);
  const pays = await q(`select status, currency, count(*)::int as n, coalesce(sum(amount),0)::float as total
                        from payment_transactions group by status, currency`);
  const month = await q(`select currency, coalesce(sum(amount),0)::float as total, count(*)::int as n
                         from payment_transactions where status='paid' and paid_at > now() - interval '30 days' group by currency`);
  const refunds = await q(`select status, currency, count(*)::int as n, coalesce(sum(amount),0)::float as total from refund_records group by status, currency`);
  const usage = await q(`select feature, count(*)::int as n, coalesce(sum(cost_estimate),0)::float as cost
                         from usage_records where created_at > now() - interval '30 days' group by feature`);
  const hooks = await q(`select result, count(*)::int as n from payment_webhook_events where received_at > now() - interval '30 days' group by result`);
  const cost30 = usage.reduce((s, u) => s + Number(u.cost || 0), 0);
  const paid30 = month.reduce((s, m) => s + Number(m.total || 0), 0);
  return {
    subscriptions: subs.reduce((a, r) => ({ ...a, [r.status]: r.n }), {}),
    activeByPlan: byPlan,
    payments: pays.map((p) => ({ status: p.status, currency: p.currency, count: p.n, amount: num(p.total) })),
    last30days: month.map((m) => ({ currency: m.currency, amount: num(m.total), count: m.n })),
    refunds: refunds.map((r) => ({ status: r.status, currency: r.currency, count: r.n, amount: num(r.total) })),
    aiUsage30: usage.map((u) => ({ feature: u.feature, calls: u.n, estimatedCostUsd: Math.round(Number(u.cost) * 10000) / 10000 })),
    webhooks30: hooks.map((h) => ({ result: h.result, count: h.n })),
    estimate: {
      confirmedRevenueDzd: paid30,
      aiCostUsd30: Math.round(cost30 * 10000) / 10000,
      note: 'المبالغ المؤكدة ليست ربحًا صافيًا: نفقات مزوّدي الذكاء الاصطناعي والرسوم البنكية تُخصم. التكاليف هنا تقديرية (0 يعني مزوّدًا مجانيًا وقت الاستهلاك).',
    },
    providers: providersStatus(),
    plans: await plansAll({ includeInactive: true }),
  };
}

/** تعديل الخطط من الإدارة (السعر/الحدود/التفعيل) */
export async function adminUpdatePlan({ planId, patch = {} }) {
  await subsEnsure();
  const plan = await planRow(planId);
  if (!plan) throw new HttpError(404, 'unknown_plan');
  const fields = [];
  const params = [planId];
  const push = (sql, val) => { params.push(val); fields.push(`${sql}=$${params.length}`); };
  if (patch.priceMonth !== undefined) push('price_month', Math.max(0, Number(patch.priceMonth) || 0));
  if (patch.priceYear !== undefined) push('price_year', Math.max(0, Number(patch.priceYear) || 0));
  if (patch.priceUsdMonth !== undefined) push('price_usd_month', Math.max(0, Number(patch.priceUsdMonth) || 0));
  if (patch.priceEurMonth !== undefined) push('price_eur_month', Math.max(0, Number(patch.priceEurMonth) || 0));
  if (patch.includedCredits !== undefined) push('included_credits', Math.max(0, Math.floor(Number(patch.includedCredits) || 0)));
  if (patch.active !== undefined) push('active', !!patch.active);
  if (patch.nameAr !== undefined) push('name_ar', String(patch.nameAr).slice(0, 40));
  if (patch.note !== undefined) push('note', String(patch.note).slice(0, 240));
  if (patch.features !== undefined && Array.isArray(patch.features)) push('features', JSON.stringify(patch.features.slice(0, 12).map((f) => String(f).slice(0, 120))));
  if (patch.approve !== undefined) push('approved', patch.approve === true);   // اعتماد السعر أو سحبه
  if (fields.length) {
    await q(`update subscription_plans set ${fields.join(', ')}, updated_at=now() where id=$1`, params);
  }
  if (patch.limits && typeof patch.limits === 'object') {
    for (const [feature, val] of Object.entries(patch.limits)) {
      if (!FEATURES.includes(feature)) continue;
      const period = val && val.period === 'day' ? 'day' : 'month';
      const limit = Math.floor(Number(val && val.limit));
      if (!Number.isFinite(limit)) continue;
      await q(`insert into usage_limits(plan_id, feature, period, limit_count, updated_at)
               values($1,$2,$3,$4, now())
               on conflict (plan_id, feature) do update set period=$3, limit_count=$4, updated_at=now()`, [planId, feature, period, limit]);
    }
  }
  return (await plansAll({ includeInactive: true })).find((p) => p.id === planId);
}
