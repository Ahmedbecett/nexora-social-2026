/* ==========================================================================
   NEXORA AI — إعدادات إعلانات Windows (منطق خالص قابل للاختبار)
   --------------------------------------------------------------------------
   قواعد لا تُخالَف:
     • لا معرّفات اختبارية في الإنتاج (Google test publisher ID ممنوع).
     • لا مزوّد غير مُتحقَّق منه يُشغَّل تلقائيًا: أي مزوّد بلا محوّل يعود
       "معطّلًا" لا "احتياطيًا عشوائيًا".
     • حزمة MSIX معطّلة افتراضيًا حتى يثبت توافق المزوّد كتابيًا مع WebView2.
     • لا عدّاد انطباعات/نقرات محلي. البوابة هنا لتنظيم التكرار فقط، والقياس
       الحقيقي لدى مزوّد الإعلان المعتمد.
   ========================================================================== */

export const ADS_CONFIG_URL = '/windows/ads-config.json';
export const CONSENT_KEY = 'nx_ads_consent';
export const FREQUENCY_KEY = 'nx_ads_frequency';

/** المحوّلات المُنفَّذة فعليًا في هذا الإصدار. */
export const IMPLEMENTED_PROVIDERS = ['none', 'adsense'];

/** مزوّدون مذكورون في النقاش لكنهم غير مُدمجين (يجب أن يبقوا معطّلين). */
export const UNVERIFIED_PROVIDERS = ['monetag', 'adsterra', 'mgads'];

/** مزوّدون معروفون بأنهم لا يعملون في حزمة MSIX الحالية. */
export const PROVIDER_STATUS = {
  none: 'disabled',
  adsense: 'web-only',
  monetag: 'unverified',
  adsterra: 'web-only',
  mgads: 'incompatible-package-type',
};

const GOOGLE_TEST_PUBLISHER = /ca-(?:app-)?pub-3940256099942544/i;
const ADSENSE_CLIENT = /^ca-pub-\d{16}$/;
const ADSENSE_SLOT = /^\d{6,}$/;
const SURFACES = ['android', 'web', 'windows-browser', 'windows-pwa', 'windows-msix'];

const clampInt = (value, min, max, fallback) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
};

/** هل السلسلة معرّف اختبار Google يجب ألا يظهر في الإنتاج؟ */
export function hasTestAdId(value) {
  return GOOGLE_TEST_PUBLISHER.test(String(value || ''));
}

/** هل هذا سطح Windows مدعوم في هذا الإصدار؟ */
export function isWindowsSurface(surface) {
  return surface === 'windows-browser' || surface === 'windows-pwa' || surface === 'windows-msix';
}

/**
 * يطبّع إعدادات المزوّد ويتحقق منها. يفشل مغلقًا (enabled=false) عند أي شك.
 * @returns {{ok:boolean, config:object, errors:string[], warnings:string[]}}
 */
export function validateAdsConfig(raw) {
  const errors = [];
  const warnings = [];
  const input = raw && typeof raw === 'object' ? raw : {};

  const provider = String(input.provider || 'none').toLowerCase();
  const knownProvider = provider === 'none' || Object.prototype.hasOwnProperty.call(PROVIDER_STATUS, provider);
  if (!knownProvider) {
    errors.push(`unknown-provider:${provider}`);
  }

  const implemented = IMPLEMENTED_PROVIDERS.includes(provider);
  if (input.enabled === true && knownProvider && !implemented && provider !== 'none') {
    warnings.push('provider-not-implemented');
  }
  const enabled = input.enabled === true && provider !== 'none' && knownProvider && implemented;
  if (input.enabled === true && provider === 'none') {
    warnings.push('enabled-with-no-provider');
  }

  const allowedSurfaces = Array.isArray(input.allowedSurfaces)
    ? input.allowedSurfaces.map((s) => String(s).toLowerCase()).filter((s) => SURFACES.includes(s))
    : ['web'];

  const reserve = input.reserve && typeof input.reserve === 'object' ? input.reserve : {};
  const frequency = input.frequency && typeof input.frequency === 'object' ? input.frequency : {};
  const consent = input.consent && typeof input.consent === 'object' ? input.consent : {};

  const providers = input.providers && typeof input.providers === 'object' ? input.providers : {};
  const adsense = providers.adsense && typeof providers.adsense === 'object' ? providers.adsense : {};
  const client = String(adsense.client || '').trim();
  const slot = String(adsense.slot || '').trim();

  if (provider === 'adsense' && enabled) {
    if (!ADSENSE_CLIENT.test(client)) errors.push('adsense-client-invalid');
    if (!ADSENSE_SLOT.test(slot)) errors.push('adsense-slot-invalid');
    if (hasTestAdId(client) || hasTestAdId(slot)) errors.push('test-ad-id-in-production');
  }
  if (hasTestAdId(client) || hasTestAdId(slot)) {
    errors.push('test-ad-id-in-config');
  }

  const normalized = {
    schemaVersion: clampInt(input.schemaVersion, 1, 99, 1),
    enabled: enabled && errors.length === 0,
    provider: enabled && errors.length === 0 ? provider : 'none',
    placement: String(input.placement || 'ai-home-banner').slice(0, 64),
    format: String(input.format || 'responsive-banner').slice(0, 64),
    allowedSurfaces,
    allowInMsix: input.allowInMsix === true,
    reserve: {
      minHeight: clampInt(reserve.minHeight, 0, 300, 96),
      maxHeight: clampInt(reserve.maxHeight, 0, 400, 140),
    },
    frequency: {
      minIntervalMinutes: clampInt(frequency.minIntervalMinutes, 0, 24 * 60, 30),
      maxPerDay: clampInt(frequency.maxPerDay, 0, 50, 3),
      visibleSeconds: clampInt(frequency.visibleSeconds, 0, 300, 15),
    },
    consent: {
      required: consent.required !== false,
      storageKey: String(consent.storageKey || CONSENT_KEY).slice(0, 64),
      policyUrl: String(consent.policyUrl || '/windows/privacy.html#ads').slice(0, 200),
      providerDisclosure: String(consent.providerDisclosure || '').slice(0, 80),
    },
    providers: {
      adsense: {
        client: ADSENSE_CLIENT.test(client) ? client : '',
        slot: ADSENSE_SLOT.test(slot) ? slot : '',
        allowedSurfaces: Array.isArray(adsense.allowedSurfaces)
          ? adsense.allowedSurfaces.map((s) => String(s).toLowerCase()).filter((s) => SURFACES.includes(s))
          : ['web'],
      },
    },
    reasons: errors,
    notes: [],
  };

  // MSIX: البوابة الصريحة — لا إعلانات ما لم يُفعَّل allowInMsix نصًّا.
  normalized.surfaces = allowedSurfaces.filter((surface) => surface !== 'windows-msix' || normalized.allowInMsix);
  if (allowedSurfaces.includes('windows-msix') && !normalized.allowInMsix) {
    warnings.push('msix-surface-removed-until-verified');
  }

  return { ok: errors.length === 0, config: normalized, errors, warnings };
}

/** هل يسمح السطح بالإعلان؟ */
export function adsAllowedForSurface(config, surface) {
  if (!config || config.enabled !== true) return false;
  if (!config.surfaces || !config.surfaces.includes(surface)) return false;
  if (surface === 'windows-msix' && config.allowInMsix !== true) return false;
  if (!IMPLEMENTED_PROVIDERS.includes(config.provider) || config.provider === 'none') return false;
  // AdSense خدمة مواقع: لا تُعرض داخل تطبيق مثبّت أو حزمة WebView2 حتى مع تفعيل الإعدادات.
  if (config.provider === 'adsense' && (surface === 'windows-pwa' || surface === 'windows-msix')) return false;
  if (config.provider === 'adsense') {
    if (!config.providers || !config.providers.adsense.client || !config.providers.adsense.slot) return false;
    if (!config.providers.adsense.allowedSurfaces.includes(surface)) return false;
  }
  return true;
}

/** الموافقة: 'granted' | 'denied' | null */
export function readConsent(storage) {
  try {
    const v = storage && storage.getItem(CONSENT_KEY);
    return v === 'granted' || v === 'denied' ? v : null;
  } catch {
    return null;
  }
}

export function writeConsent(storage, value) {
  try {
    if (value === 'granted' || value === 'denied') storage.setItem(CONSENT_KEY, value);
  } catch { /* بيئات مقيدة */ }
}

/** هل تحققت شروط الموافقة قبل أي طلب إعلان؟ */
export function consentSatisfied(config, consent) {
  if (!config || !config.consent || config.consent.required !== true) return true;
  return consent === 'granted';
}

function dayKey(now) {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function readFrequency(storage, now = Date.now()) {
  try {
    const raw = JSON.parse(storage.getItem(FREQUENCY_KEY) || '{}');
    if (raw.day !== dayKey(now)) return { day: dayKey(now), count: 0, last: 0 };
    return {
      day: raw.day,
      count: Math.max(0, Math.trunc(Number(raw.count)) || 0),
      // الطوابع الزمنية أكبر من 32-bit؛ لا تستخدم | 0 هنا وإلا فسدت بوابة التكرار.
      last: Math.max(0, Number(raw.last) || 0),
    };
  } catch {
    return { day: dayKey(now), count: 0, last: 0 };
  }
}

export function writeFrequency(storage, state) {
  try { storage.setItem(FREQUENCY_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

/** بوابة تنظيم العرض (ليست قياسًا): 30 دقيقة بين عرضين، و3 يوميًا. */
export function adWindowOpen(config, storage, now = Date.now()) {
  if (!config || !config.frequency) return false;
  const state = readFrequency(storage, now);
  if (state.count >= config.frequency.maxPerDay) return false;
  const gap = config.frequency.minIntervalMinutes * 60 * 1000;
  return !state.last || now - state.last >= gap;
}

/** تُسجَّل عند عرض إعلان حقيقي فقط — بوابة تجربة المستخدم، لا انطباع مزيف. */
export function markAdWindow(config, storage, now = Date.now()) {
  const state = readFrequency(storage, now);
  writeFrequency(storage, { day: dayKey(now), count: state.count + 1, last: now });
}

/** محوّل المزوّد المتاح لهذا السطح، أو null (فشل مغلق). */
export function providerAdapter(config, surface) {
  if (!adsAllowedForSurface(config, surface)) return null;
  if (config.provider === 'adsense') {
    return {
      name: 'adsense',
      client: config.providers.adsense.client,
      slot: config.providers.adsense.slot,
      policy: 'google-adsense',
    };
  }
  return null;
}

/** سبب تعطيل الإعلان — يُستخدم في data-reason للاختبار والدعم. */
export function disabledReason(config, { surface, consent } = {}) {
  if (!config) return 'no-config';
  if (config.enabled !== true) return 'disabled';
  if (!config.surfaces || !config.surfaces.includes(surface)) {
    return surface === 'windows-msix' ? 'msix-not-verified' : 'surface-not-allowed';
  }
  if (surface === 'windows-msix' && config.allowInMsix !== true) return 'msix-not-verified';
  if (!IMPLEMENTED_PROVIDERS.includes(config.provider) || UNVERIFIED_PROVIDERS.includes(config.provider)) {
    return 'provider-not-implemented';
  }
  // لا نطلب موافقة على إعلان لا يمكن عرضه على هذا السطح أصلًا.
  if (!providerAdapter(config, surface)) return 'provider-not-ready';
  if (!consentSatisfied(config, consent)) return 'consent-required';
  return 'eligible';
}

export default {
  ADS_CONFIG_URL,
  CONSENT_KEY,
  FREQUENCY_KEY,
  PROVIDER_STATUS,
  hasTestAdId,
  isWindowsSurface,
  validateAdsConfig,
  adsAllowedForSurface,
  readConsent,
  writeConsent,
  consentSatisfied,
  adWindowOpen,
  markAdWindow,
  providerAdapter,
  disabledReason,
};
