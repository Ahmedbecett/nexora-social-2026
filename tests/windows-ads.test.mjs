/**
 * NEXORA AI — Windows advertising gates (including native MG Ads C# SDK V1.2.1).
 *
 * Rules enforced:
 *   • Production MG Ads IDs configured ONLY for windows-msix (native WebView2 host).
 *   • Zero Google test IDs, zero MG demo IDs, zero private keys in config/JS.
 *   • Interstitial stays disabled with empty unitId until official 1024×768 ID arrives.
 *   • No cross-format Unit ID substitution (duplicate unit IDs rejected).
 *   • AdSense / Adsterra / Monetag stay strictly excluded from windows-msix & windows-pwa.
 *   • Nothing in JS fakes impressions or clicks.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  adsAllowedForSurface,
  adWindowOpen,
  consentSatisfied,
  disabledReason,
  hasPrivateKeyMaterial,
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

function validAdSenseConfig(overrides = {}) {
  return {
    schemaVersion: 2,
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

test('الإعدادات المشحونة تضبط MG Ads الإنتاجية لـ windows-msix فقط وبلا أي سر أو معرّف تجريبي', () => {
  assert.equal(shipped.enabled, true);
  assert.equal(shipped.provider, 'mgads');
  assert.equal(shipped.allowInMsix, true);
  assert.deepEqual(shipped.allowedSurfaces, ['windows-msix']);
  assert.equal(shipped.consent.nativeCmp, true);

  const mg = shipped.providers.mgads;
  assert.equal(mg.appId, '6b03f6af1f812ea86a26de4f');
  assert.equal(mg.units.banner.unitId, 'd461565a9efe49f0ac63ae71048fb594');
  assert.equal(mg.units.banner.enabled, true);
  assert.equal(mg.units.rewarded.unitId, '48f66ca841444050a166841f331b6adb');
  assert.equal(mg.units.rewarded.enabled, true);
  assert.equal(mg.units.couplet.unitId, '168ce66592d743bea2c16cdf908165b3');
  assert.equal(mg.units.couplet.enabled, true);
  assert.equal(mg.units.interstitial.unitId, '');
  assert.equal(mg.units.interstitial.enabled, false);

  assert.equal(hasTestAdId(JSON.stringify(shipped)), false);
  assert.equal(hasPrivateKeyMaterial(JSON.stringify(shipped)), false);

  const parsed = validateAdsConfig(shipped);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.config.enabled, true);
  assert.equal(adsAllowedForSurface(parsed.config, 'windows-msix'), true);
  assert.equal(adsAllowedForSurface(parsed.config, 'windows-browser'), false);
  assert.equal(adsAllowedForSurface(parsed.config, 'windows-pwa'), false);
  assert.equal(adsAllowedForSurface(parsed.config, 'web'), false);
  assert.equal(adsAllowedForSurface(parsed.config, 'android'), false);

  const adapter = providerAdapter(parsed.config, 'windows-msix');
  assert.equal(adapter.name, 'mgads');
  assert.equal(adapter.appId, '6b03f6af1f812ea86a26de4f');
  assert.equal(disabledReason(parsed.config, { surface: 'windows-msix', consent: null }), 'eligible');
});

test('معرّفات Google الاختبارية ومعرّفات MG Demo والمفاتيح الخاصة مرفوضة دائمًا في الإنتاج', () => {
  assert.equal(hasTestAdId('ca-pub-3940256099942544'), true);
  assert.equal(hasTestAdId('ca-app-pub-3940256099942544/6300978111'), true);
  assert.equal(hasTestAdId('69316b6861328938223cc124'), true);
  assert.equal(hasTestAdId('cb7d9688a2d9499992febb6b642b3625'), true);
  assert.equal(hasTestAdId('6b03f6af1f812ea86a26de4f'), false);
  assert.equal(hasPrivateKeyMaterial('-----BEGIN PRIVATE KEY-----'), true);
  assert.equal(hasPrivateKeyMaterial('MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg'), true);

  const result = validateAdsConfig(validAdSenseConfig({
    providers: { adsense: { client: 'ca-pub-3940256099942544', slot: '1234567890', allowedSurfaces: ['web'] } },
  }));
  assert.equal(result.ok, false);
  assert.equal(result.config.enabled, false);
  assert.ok(result.errors.includes('test-ad-id-in-production'));

  const demoMg = validateAdsConfig({
    ...shipped,
    providers: {
      mgads: {
        ...shipped.providers.mgads,
        appId: '69316b6861328938223cc124',
      },
    },
  });
  assert.equal(demoMg.ok, false);
  assert.equal(demoMg.config.enabled, false);
  assert.ok(demoMg.errors.includes('mgads-demo-app-id-in-production'));

  const dupInterstitial = validateAdsConfig({
    ...shipped,
    providers: {
      mgads: {
        ...shipped.providers.mgads,
        units: {
          ...shipped.providers.mgads.units,
          interstitial: {
            unitId: shipped.providers.mgads.units.banner.unitId,
            enabled: true,
          },
        },
      },
    },
  });
  assert.equal(dupInterstitial.ok, false);
  assert.ok(dupInterstitial.errors.includes('mgads-duplicate-unit-id:interstitial'));

  const leakedKey = validateAdsConfig({
    ...shipped,
    providers: {
      mgads: {
        ...shipped.providers.mgads,
        secretKey: 'MIGTAgEAMBMGByqGSM49AgEG',
      },
    },
  });
  assert.equal(leakedKey.ok, false);
  assert.ok(leakedKey.errors.includes('private-key-in-config'));
});

test('مزوّد غير منفَّذ أو مجهول لا يمكن تفعيله (فشل مغلق)', () => {
  for (const provider of [...UNVERIFIED_PROVIDERS, 'unknown-net']) {
    assert.equal(IMPLEMENTED_PROVIDERS.includes(provider), false);
    const result = validateAdsConfig(validAdSenseConfig({ provider, providers: {} }));
    assert.equal(result.config.enabled, false, provider);
    assert.equal(result.config.provider, 'none', provider);
    assert.equal(adsAllowedForSurface(result.config, 'web'), false, provider);
    assert.equal(providerAdapter(result.config, 'web'), null, provider);
  }
});

test('AdSense لا يعمل بلا معرّفات صالحة، ولا يعمل في MSIX أو PWA', () => {
  const empty = validateAdsConfig(validAdSenseConfig({ providers: { adsense: { client: '', slot: '', allowedSurfaces: ['web'] } } }));
  assert.equal(empty.ok, false);
  assert.equal(empty.config.enabled, false);

  const ok = validateAdsConfig(validAdSenseConfig());
  assert.equal(ok.ok, true);
  assert.equal(ok.config.enabled, true);
  assert.equal(adsAllowedForSurface(ok.config, 'web'), true);
  assert.equal(adsAllowedForSurface(ok.config, 'windows-browser'), true);
  assert.equal(adsAllowedForSurface(ok.config, 'windows-pwa'), false, 'AdSense لا يعمل في تطبيق مثبّت');
  assert.equal(adsAllowedForSurface(ok.config, 'windows-msix'), false);
  assert.equal(disabledReason(ok.config, { surface: 'windows-msix', consent: 'granted' }), 'msix-not-verified');
  assert.equal(disabledReason(ok.config, { surface: 'android', consent: 'granted' }), 'surface-not-allowed');
});

test('الموافقة شرط صريح للويب، والرفض لا يفعّل شيئًا', () => {
  const config = validateAdsConfig(validAdSenseConfig()).config;
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
});

test('بوابة التكرار 30 دقيقة/3 يوميًا هي تجربة مستخدم وليست قياس انطباعات', () => {
  const config = validateAdsConfig(validAdSenseConfig()).config;
  const storage = memoryStorage();
  const now = Date.parse('2026-11-23T10:00:00Z');
  assert.equal(adWindowOpen(config, storage, now), true);
  markAdWindow(config, storage, now);
  assert.equal(adWindowOpen(config, storage, now + 60_000), false);
  assert.equal(adWindowOpen(config, storage, now + 31 * 60_000), true);

  markAdWindow(config, storage, now + 31 * 60_000);
  markAdWindow(config, storage, now + 62 * 60_000);
  assert.equal(readFrequency(storage, now + 63 * 60_000).count, 3);
  assert.equal(adWindowOpen(config, storage, now + 63 * 60_000), false);
  assert.equal(adWindowOpen(config, storage, now + 25 * 60 * 60_000), true);
});

test('المكوّن WindowsAdSlot لا يرسل انطباعات ولا يرسم مساحة فارغة عند استخدام MG Ads', () => {
  const component = read('src/ads/WindowsAdSlot.jsx');
  assert.match(component, /disabledReason\(/);
  assert.match(component, /providerAdapter\(/);
  assert.match(component, /consentSatisfied\(/);
  assert.match(component, /requestBanner\(/);
  assert.match(component, /if \(!adapter \|\| adapter\.name !== 'adsense'\) return null/);
  assert.match(component, /ADS_CONFIG_URL/);
  assert.doesNotMatch(component, /fetch\([^)]*\/api\//);
  assert.doesNotMatch(component, /impression|clickCount|fakeAd/i);
});
