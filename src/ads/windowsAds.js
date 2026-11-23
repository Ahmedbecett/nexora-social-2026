/* ==========================================================================
   NEXORA AI — إعدادات إعلانات Windows (منطق خالص قابل للاختبار)
   --------------------------------------------------------------------------
   قواعد لا تُخالَف:
     • لا معرّفات اختبارية أو تجريبية في الإنتاج (Google test IDs أو MG demo IDs ممنوعة).
     • لا مفاتيح خاصة (Private Key / SecretKey) في JSON أو JavaScript أو المستودع العام.
     • لا مزوّد غير مُتحقَّق منه يُشغَّل تلقائيًا: أي مزوّد بلا محوّل يعود «معطّلًا».
     • MG Ads C# SDK V1.2.1 يعمل حصريًا داخل المضيف الأصلي Native WebView2 MSIX
       (surface === 'windows-msix' + allowInMsix === true).
     • لا استبدال بين أنواع الإعلانات: Interstitial يبقى معطّلًا حتى يتوفر معرّفه الرسمي.
     • لا عدّاد انطباعات/نقرات محلي؛ القياس الحقيقي لدى مزوّد الإعلان المعتمد فقط.
   ========================================================================== */

export const ADS_CONFIG_URL = '/windows/ads-config.json';
export const CONSENT_KEY = 'nx_ads_consent';
export const FREQUENCY_KEY = 'nx_ads_frequency';

/** المحوّلات المُنفَّذة فعليًا في هذا الإصدار. */
export const IMPLEMENTED_PROVIDERS = ['none', 'adsense', 'mgads'];

/** مزوّدون غير مُتحقَّق منهم في تطبيق Windows (يجب أن يبقوا معطّلين). */
export const UNVERIFIED_PROVIDERS = ['monetag', 'adsterra'];

/** حالة المزوّدين في نسخة Windows. */
export const PROVIDER_STATUS = {
  none: 'disabled',
  adsense: 'web-only',
  mgads: 'native-msix-only',
  monetag: 'unverified',
  adsterra: 'web-only',
};

const GOOGLE_TEST_PUBLISHER = /ca-(?:app-)?pub-3940256099942544/i;
const PRIVATE_KEY_MATERIAL = /MIGTAgEA|BEGIN\s+(?:EC\s+)?PRIVATE\s+KEY/i;
const ADSENSE_CLIENT = /^ca-pub-\d{16}$/;
const ADSENSE_SLOT = /^\d{6,}$/;
const MG_APP_ID = /^[a-f0-9]{24}$/i;
const MG_UNIT_ID = /^[a-f0-9]{32}$/i;
const SURFACES = ['android', 'web', 'windows-browser', 'windows-pwa', 'windows-msix'];

/** معرّفات MG Ads التجريبية الرسمية من مستودع المثال — ممنوعة في الإنتاج. */
export const MG_DEMO_IDS = new Set([
  '69316b6861328938223cc124',
  'b871f83c5e8845f1b43325561bcdd6c7',
  '5076eab6ae1042b6b92f73ea01981475',
  'cb7d9688a2d9499992febb6b642b3625',
  '2cb66a1301404561881a3f26b6ce5ba7',
  'b502f6e6281c43e4b28ea22503471039',
  '2ae60936ba664fbfb7d92ce3a19c2915',
  'f152f6caf7a8440f8510bc31534baf4e',
  '4192966a9db343f48dd2f6308ea9ec30',
  'e9b34829a2ad4a959874f9a180278bfe',
  'c68cd45e8e374ccd98a704887e5b3582',
  'e333abaf22404c4a8d382c1e7ba42076',
  'd65b9c6612bd494fbd6844b490d536dc',
  '0f505442fac84f098e81d6f2ca04abe1',
]);

const clampInt = (value, min, max, fallback) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
};

/** هل السلسلة معرّف اختبار Google أو معرّف MG Demo يجب ألا يظهر في الإنتاج؟ */
export function hasTestAdId(value) {
  const text = String(value || '');
  if (GOOGLE_TEST_PUBLISHER.test(text)) return true;
  const lower = text.toLowerCase();
  for (const demoId of MG_DEMO_IDS) {
    if (lower.includes(demoId)) return true;
  }
  return false;
}

/** هل السلسلة تحتوي مفتاحًا خاصًا (Private Key) يُمنع تضمينه في الإعدادات أو الويب؟ */
export function hasPrivateKeyMaterial(value) {
  return PRIVATE_KEY_MATERIAL.test(String(value || ''));
}

/** هل هذا سطح Windows مدعوم في هذا الإصدار؟ */
export function isWindowsSurface(surface) {
  return surface === 'windows-browser' || surface === 'windows-pwa' || surface === 'windows-msix';
}

function normalizeMgUnit(rawUnit, name, seenIds, errors) {
  const u = rawUnit && typeof rawUnit === 'object' ? rawUnit : {};
  const unitId = String(u.unitId || '').trim();
  const requestedEnabled = u.enabled === true;

  if (!unitId) {
    if (requestedEnabled) errors.push(`mgads-${name}-unit-missing`);
    return { unitId: '', enabled: false, size: String(u.size || ''), type: String(u.type || '') };
  }

  if (!MG_UNIT_ID.test(unitId)) {
    errors.push(`mgads-${name}-unit-invalid`);
    return { unitId: '', enabled: false, size: String(u.size || ''), type: String(u.type || '') };
  }

  if (MG_DEMO_IDS.has(unitId.toLowerCase())) {
    errors.push(`mgads-demo-unit-id-in-production:${name}`);
    return { unitId: '', enabled: false, size: String(u.size || ''), type: String(u.type || '') };
  }

  const lower = unitId.toLowerCase();
  if (seenIds.has(lower)) {
    errors.push(`mgads-duplicate-unit-id:${name}`);
    return { unitId: '', enabled: false, size: String(u.size || ''), type: String(u.type || '') };
  }
  seenIds.add(lower);

  return {
    unitId,
    enabled: requestedEnabled,
    size: String(u.size || ''),
    type: String(u.type || ''),
    ...(u.minViewportWidth != null ? { minViewportWidth: clampInt(u.minViewportWidth, 800, 4096, 1560) } : {}),
    ...(u.minViewportHeight != null ? { minViewportHeight: clampInt(u.minViewportHeight, 500, 2160, 760) } : {}),
  };
}

/**
 * يطبّع إعدادات المزوّد ويتحقق منها. يفشل مغلقًا (enabled=false) عند أي شك.
 * @returns {{ok:boolean, config:object, errors:string[], warnings:string[]}}
 */
export function validateAdsConfig(raw) {
  const errors = [];
  const warnings = [];
  const input = raw && typeof raw === 'object' ? raw : {};

  let serialized = '';
  try { serialized = JSON.stringify(input); } catch { serialized = ''; }
  if (hasPrivateKeyMaterial(serialized)) {
    errors.push('private-key-in-config');
  }

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

  // MG Ads C# SDK V1.2.1 (native MSIX host only)
  const mgRaw = providers.mgads && typeof providers.mgads === 'object' ? providers.mgads : {};
  const mgAppId = String(mgRaw.appId || '').trim();
  const mgUnitsRaw = mgRaw.units && typeof mgRaw.units === 'object' ? mgRaw.units : {};
  const seenMgUnits = new Set();
  const mgUnits = {
    banner: normalizeMgUnit(mgUnitsRaw.banner, 'banner', seenMgUnits, errors),
    rewarded: normalizeMgUnit(mgUnitsRaw.rewarded, 'rewarded', seenMgUnits, errors),
    couplet: normalizeMgUnit(mgUnitsRaw.couplet, 'couplet', seenMgUnits, errors),
    interstitial: normalizeMgUnit(mgUnitsRaw.interstitial, 'interstitial', seenMgUnits, errors),
  };

  if (provider === 'mgads' && enabled) {
    if (!MG_APP_ID.test(mgAppId)) errors.push('mgads-app-id-invalid');
    if (MG_DEMO_IDS.has(mgAppId.toLowerCase())) errors.push('mgads-demo-app-id-in-production');
    const anyUnitEnabled = mgUnits.banner.enabled || mgUnits.rewarded.enabled || mgUnits.couplet.enabled || mgUnits.interstitial.enabled;
    if (!anyUnitEnabled) errors.push('mgads-no-enabled-units');
  } else if (mgAppId && MG_DEMO_IDS.has(mgAppId.toLowerCase())) {
    errors.push('mgads-demo-app-id-in-config');
  }

  const mgAllowedSurfaces = Array.isArray(mgRaw.allowedSurfaces)
    ? mgRaw.allowedSurfaces.map((s) => String(s).toLowerCase()).filter((s) => SURFACES.includes(s))
    : ['windows-msix'];

  const normalized = {
    schemaVersion: clampInt(input.schemaVersion, 1, 99, 2),
    enabled: enabled && errors.length === 0,
    provider: enabled && errors.length === 0 ? provider : 'none',
    placement: String(input.placement || 'ai-home-banner').slice(0, 64),
    format: String(input.format || 'native-banner').slice(0, 64),
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
      nativeCmp: consent.nativeCmp === true,
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
      mgads: {
        sdk: String(mgRaw.sdk || 'MG Ads C# SDK V1.2.1').slice(0, 80),
        appId: MG_APP_ID.test(mgAppId) && !MG_DEMO_IDS.has(mgAppId.toLowerCase()) ? mgAppId : '',
        requiresNativeHost: mgRaw.requiresNativeHost !== false,
        allowedSurfaces: mgAllowedSurfaces,
        units: mgUnits,
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
  if (config.provider === 'adsense') {
    if (surface === 'windows-pwa' || surface === 'windows-msix') return false;
    if (!config.providers || !config.providers.adsense.client || !config.providers.adsense.slot) return false;
    if (!config.providers.adsense.allowedSurfaces.includes(surface)) return false;
  }

  // MG Ads C# SDK V1.2.1 يعمل حصريًا داخل حزمة Windows MSIX الأصلية.
  if (config.provider === 'mgads') {
    if (surface !== 'windows-msix') return false;
    const mg = config.providers && config.providers.mgads;
    if (!mg || !mg.appId) return false;
    if (!mg.allowedSurfaces.includes('windows-msix')) return false;
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
  if (config.provider === 'mgads' && config.consent.nativeCmp === true) return true;
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
  if (config.provider === 'mgads') {
    return {
      name: 'mgads',
      sdk: config.providers.mgads.sdk,
      appId: config.providers.mgads.appId,
      requiresNativeHost: config.providers.mgads.requiresNativeHost,
      units: config.providers.mgads.units,
      policy: 'miracle-games-ads',
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
  if (!providerAdapter(config, surface)) return 'provider-not-ready';
  if (!consentSatisfied(config, consent)) return 'consent-required';
  return 'eligible';
}

export default {
  ADS_CONFIG_URL,
  CONSENT_KEY,
  FREQUENCY_KEY,
  PROVIDER_STATUS,
  MG_DEMO_IDS,
  hasTestAdId,
  hasPrivateKeyMaterial,
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
