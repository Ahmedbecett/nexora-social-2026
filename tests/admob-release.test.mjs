import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

async function loadAds(dev, native = true) {
  const calls = [];
  const context = vm.createContext({
    localStorage: { getItem: () => '1' }, // persisted old nx_ad_test must not affect Release
    document: { documentElement: { style: { setProperty() {} } }, body: {}, addEventListener() {} },
    MutationObserver: class { observe() {} },
  });
  const plugin = {
    AdMob: {
      initialize: async (options) => calls.push(['initialize', options]),
      requestConsentInfo: async () => ({}),
      addListener() {},
      prepareInterstitial: async (options) => calls.push(['interstitial', options]),
      showBanner: async (options) => calls.push(['banner', options]),
    },
    BannerAdPluginEvents: {},
    BannerAdSize: { ADAPTIVE_BANNER: 'ADAPTIVE_BANNER' },
    BannerAdPosition: { BOTTOM_CENTER: 'BOTTOM_CENTER' },
  };
  const mocks = {
    '@capacitor/core': { Capacitor: { isNativePlatform: () => native } },
    './api.js': { api: async () => ({ ads: {} }) },
    '@capacitor-community/admob': plugin,
  };
  async function mock(name) {
    const exports = mocks[name];
    const mod = new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    }, { context });
    await mod.link(() => {});
    await mod.evaluate();
    return mod;
  }
  const mod = new vm.SourceTextModule(readFileSync(new URL('../src/ads.js', import.meta.url), 'utf8'), {
    context,
    initializeImportMeta(meta) { meta.env = { DEV: dev }; },
    importModuleDynamically: mock,
  });
  await mod.link(mock);
  await mod.evaluate();
  await mod.namespace.initAds();
  mod.namespace.setAdSlot(true);
  await new Promise(setImmediate);
  return calls;
}

test('Release uses real AdMob units even with an old test flag', async () => {
  const calls = await loadAds(false);
  assert.equal(calls.find(([name]) => name === 'initialize')[1].initializeForTesting, false);
  assert.equal(calls.find(([name]) => name === 'banner')[1].adId, 'ca-app-pub-6858364141205978/1001361442');
  assert.equal(calls.find(([name]) => name === 'interstitial')[1].adId, 'ca-app-pub-6858364141205978/2374152863');
  const manifest = readFileSync(new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
  assert.match(manifest, /ca-app-pub-6858364141205978~7081673739/);
});

test('development uses Google test units', async () => {
  const calls = await loadAds(true);
  assert.equal(calls.find(([name]) => name === 'initialize')[1].initializeForTesting, true);
  assert.equal(calls.find(([name]) => name === 'banner')[1].adId, 'ca-app-pub-3940256099942544/6300978111');
});

test('web never initializes native AdMob', async () => {
  assert.equal((await loadAds(false, false)).length, 0);
});
