/**
 * NEXORA AI — Windows advertising gates.
 *
 * The rule is simple and must stay testable: shipping config is disabled, no
 * Google test IDs, no unverified provider can switch itself on, MSIX stays off
 * until written verification, and consent is required before any ad request.
 * Nothing here measures impressions — only the provider may do that.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  adsAllowedForSurface,
  adWindowOpen,
  consentSatisfied,
  disabledReason,
  hasTestAdId,
  markAdWindow,
  providerAdapter,
  readConsent,
  readFrequency,
  validateAdsConfig,
  writeConsent,
  UNVERIFIED_PROVIDERS,
  IMPLEMENTED_PROVIDERS,
} from '../src/ads/windowsAds.js';

const read = (p) => readFileSync(p, 'utf8');
const shipped = JSON.parse(read('public/windows/ads-config.json'));

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _map: map,
  };
}

function validConfig(overrides = {}) {
  return {
    schemaVersion: 1,
    enabled: true,
    provider: 'adsense',
    placement: 'ai-home-banner',
    allowedSurfaces: ['web', 'windows-browser', 'windows-pwa'],
    allowInMsix: false,
    reserve: { minHeight: 96, maxHeight: 140 },
    frequency: { minIntervalMinutes: 30, maxPerDay: 3, visibleSeconds: 15 },
    consent: { required: true, policyUrl: '/windows/privacy.html#ads' },
    providers: {
      adsense: {
        client: 'ca-pub-1234567890123456',
        slot: '1234567890',
        allowedSurfaces: ['web', 'windows-browser', 'windows-pwa'],
      },
    },
    ...overrides,
  };
}

test('الإعدادات المشحونة معطّلة ولا تحتوي أي معرّف اختباري أو MSIX', () => {
  assert.equal(shipped.enabled, false);
  assert.equal(shipped.provider, 'none');
  assert.equal(shipped.allowInMsix, false);
  assert.ok(!shipped.allowedSurfaces.includes('windows-msix'));
  assert.ok(!shipped.allowedSurfaces.includes('windows-pwa'), 'الأسطح المثبّتة تبقى خارج الإعلانات حتى التحقق');
  assert.equal(shipped.providers.adsense.client, '');
  assert.equal(shipped.providers.adsense.slot, '');
  assert.ok(!shipped.providers.adsense.allowedSurfaces.includes('windows-msix'));
  assert.ok(!shipped.providers.adsense.allowedSurfaces.includes('windows-pwa'));
  assert.equal(hasTestAdId(JSON.stringify(shipped)), false);
  assert.equal(validateAdsConfig(shipped).config.enabled, false);
});

test('معرّف Google الاختباري مرفوض دائمًا في الإنتاج', () => {
  assert.equal(hasTestAdId('ca-pub-3940256099942544'), true);
  assert.equal(hasTestAdId('ca-app-pub-3940256099942544/6300978111'), true);
  assert.equal(hasTestAdId('ca-pub-1234567890123456'), false);

  const result = validateAdsConfig(validConfig({
    providers: { adsense: { client: 'ca-pub-3940256099942544', slot: '1234567890', allowedSurfaces: ['web'] } },
  }));
  assert.equal(result.ok, false);
  assert.equal(result.config.enabled, false);
  assert.ok(result.errors.includes('test-ad-id-in-production'));
});

test('مزوّد غير منفَّذ أو مجهول لا يمكن تفعيله (فشل مغلق)', () => {
  for (const provider of [...UNVERIFIED_PROVIDERS, 'unknown-net']) {
    assert.equal(IMPLEMENTED_PROVIDERS.includes(provider), false);
    const result = validateAdsConfig(validConfig({ provider, providers: {} }));
    assert.equal(result.config.enabled, false, provider);
    assert.equal(result.config.provider, 'none', provider);
    assert.equal(adsAllowedForSurface(result.config, 'web'), false, provider);
    assert.equal(providerAdapter(result.config, 'web'), null, provider);
  }
});

test('AdSense لا يعمل بلا معرّفات صالحة، ولا يعمل في MSIX أو PWA', () => {
  const empty = validateAdsConfig(validConfig({ providers: { adsense: { client: '', slot: '', allowedSurfaces: ['web'] } } }));
  assert.equal(empty.ok, false);
  assert.equal(empty.config.enabled, false);

  const ok = validateAdsConfig(validConfig());
  assert.equal(ok.ok, true);
  assert.equal(ok.config.enabled, true);
  assert.equal(adsAllowedForSurface(ok.config, 'web'), true);
  assert.equal(adsAllowedForSurface(ok.config, 'windows-browser'), true);
  assert.equal(adsAllowedForSurface(ok.config, 'windows-pwa'), false, 'AdSense لا يعمل في تطبيق مثبّت');
  assert.equal(adsAllowedForSurface(ok.config, 'windows-msix'), false);
  assert.equal(disabledReason(ok.config, { surface: 'windows-msix', consent: 'granted' }), 'msix-not-verified');
  assert.equal(disabledReason(ok.config, { surface: 'android', consent: 'granted' }), 'surface-not-allowed');

  const adapter = providerAdapter(ok.config, 'windows-browser');
  assert.equal(adapter.name, 'adsense');
  assert.equal(adapter.client, 'ca-pub-1234567890123456');
});

test('حتى لو أضيف MSIX إلى الأسطح، يبقى معطّلًا ما لم يُفعَّل allowInMsix', () => {
  const result = validateAdsConfig(validConfig({
    allowedSurfaces: ['web', 'windows-msix'],
    providers: { adsense: { client: 'ca-pub-1234567890123456', slot: '1234567890', allowedSurfaces: ['web', 'windows-msix'] } },
  }));
  assert.equal(result.ok, true);
  assert.equal(result.config.allowInMsix, false);
  assert.ok(!result.config.surfaces.includes('windows-msix'));
  assert.ok(result.warnings.includes('msix-surface-removed-until-verified'));
  assert.equal(adsAllowedForSurface(result.config, 'windows-msix'), false);

  const explicit = validateAdsConfig(validConfig({
    allowInMsix: true,
    allowedSurfaces: ['web', 'windows-msix'],
    providers: { adsense: { client: 'ca-pub-1234567890123456', slot: '1234567890', allowedSurfaces: ['web', 'windows-msix'] } },
  }));
  assert.equal(explicit.config.allowInMsix, true);
  assert.ok(explicit.config.surfaces.includes('windows-msix'));
  // البوابة موجودة، لكن سياسة المزوّد تُبقي AdSense خارج الحزمة المثبّتة.
  assert.equal(adsAllowedForSurface(explicit.config, 'windows-msix'), false);
  assert.equal(providerAdapter(explicit.config, 'windows-msix'), null);
});

test('الموافقة شرط صريح، والرفض لا يفعّل شيئًا', () => {
  const config = validateAdsConfig(validConfig()).config;
  assert.equal(consentSatisfied(config, null), false);
  assert.equal(consentSatisfied(config, 'denied'), false);
  assert.equal(consentSatisfied(config, 'granted'), true);
  assert.equal(disabledReason(config, { surface: 'web', consent: null }), 'consent-required');
  assert.equal(disabledReason(config, { surface: 'web', consent: 'granted' }), 'eligible');

  const storage = memoryStorage();
  assert.equal(readConsent(storage), null);
  writeConsent(storage, 'denied');
  assert.equal(readConsent(storage), 'denied');
  writeConsent(storage, 'bogus');
  assert.equal(readConsent(storage), 'denied');
  writeConsent(storage, 'granted');
  assert.equal(readConsent(storage), 'granted');

  const noConsent = validateAdsConfig(validConfig({ consent: { required: false } })).config;
  assert.equal(consentSatisfied(noConsent, null), true);
});

test('بوابة التكرار 30 دقيقة/3 يوميًا هي تجربة مستخدم وليست قياس انطباعات', () => {
  const config = validateAdsConfig(validConfig()).config;
  const storage = memoryStorage();
  const now = Date.parse('2026-11-19T10:00:00Z');
  assert.equal(adWindowOpen(config, storage, now), true);
  markAdWindow(config, storage, now);
  assert.equal(adWindowOpen(config, storage, now + 60_000), false);
  assert.equal(adWindowOpen(config, storage, now + 31 * 60_000), true);

  markAdWindow(config, storage, now + 31 * 60_000);
  markAdWindow(config, storage, now + 62 * 60_000);
  assert.equal(readFrequency(storage, now + 63 * 60_000).count, 3);
  assert.equal(adWindowOpen(config, storage, now + 63 * 60_000), false, 'الحد اليومي: 3 إعلانات');

  // يوم جديد يصفّر البوابة تلقائيًا
  assert.equal(adWindowOpen(config, storage, now + 25 * 60 * 60_000), true);
});

test('المكوّن لا يرسل انطباعات ولا يعرض إعلانًا قبل الموافقة', () => {
  const component = read('src/ads/WindowsAdSlot.jsx');
  assert.match(component, /disabledReason\(/);
  assert.match(component, /providerAdapter\(/);
  assert.match(component, /consentSatisfied\(/);
  assert.match(component, /writeConsent\(storage\(\), 'granted'\)/);
  assert.match(component, /writeConsent\(storage\(\), 'denied'\)/);
  assert.match(component, /if \(reason !== 'eligible' \|\| !visible\) return null/);
  assert.match(component, /ADS_CONFIG_URL/, 'التهيئة منفصلة عن الكود');
  assert.match(component, /isCapacitorNative\(\) \|\| !String\(surface\)\.startsWith\('windows-'\)/, 'لا طلب إعلاني على أندرويد أو الموقع العام');
  assert.doesNotMatch(component, /fetch\([^)]*\/api\//, 'لا إرسال قياس إلى API');
  assert.doesNotMatch(component, /impression|clickCount|fakeAd/i, 'لا عدّادات محلية');
  assert.match(component, /data-ad-provider/);
  assert.match(component, /role="complementary"/);
  assert.match(read('src/ads/windowsAds.css'), /min-height|minHeight/);
});
