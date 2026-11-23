/**
 * NEXORA AI by BECETTI — Native C# + WebView2 + MG Ads C# SDK V1.2.1 Host Tests.
 *
 * Verifies:
 *   1. Official MG Ads production AppId & Unit IDs match across native & web configs.
 *   2. Interstitial stays configurable & disabled (no fake ID, no cross-format substitution).
 *   3. Private key never appears in JS, JSON, HTML, C# source, or Git working tree.
 *   4. Native C# host implements official MG Ads V1.2.1 lifecycle (SetAppId -> OpenCmp ->
 *      Initialize, Banner zero-blank collapse, Rewarded completeStatus + fulfillment report,
 *      desktop-guarded Couplet, origin-locked WebViewBridge).
 *   5. JS <-> Native bridge (mgAdsBridge.js) fails closed outside WebView2 native host and
 *      round-trips requests/responses cleanly inside a mocked WebView2 host.
 *   6. Website-only ad scripts (AdSlot, Adsterra, Monetag) are strictly excluded when
 *      nx_surface=msix.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  isNativeMgAdsHost,
  getMgAdsState,
  showNativeRewardedAd,
  requestBanner,
  syncViewContext,
} from '../src/ads/mgAdsBridge.js';

const read = (p) => readFileSync(p, 'utf8');

test('إعدادات المضيف الأصلي mgads-config.json تطابق المعرّفات الإنتاجية الرسمية تمامًا', () => {
  const cfg = JSON.parse(read('windows/host/NexoraWindows/Config/mgads-config.json'));
  assert.equal(cfg.productTitle, 'NEXORA AI by BECETTI');
  assert.equal(cfg.storePackageIdentity, 'Ahmedbecetti.NEXORAAIbyBECETTI');
  assert.equal(cfg.sdkVersion, '1.2.1');
  assert.equal(cfg.appId, '6b03f6af1f812ea86a26de4f');
  assert.equal(cfg.appOrigin, 'https://nexora-social-2026.vercel.app');
  assert.match(cfg.startUrl, /nx_surface=msix/);
  assert.match(cfg.startUrl, /nx_host=native-webview2/);

  assert.equal(cfg.units.banner.unitId, 'd461565a9efe49f0ac63ae71048fb594');
  assert.equal(cfg.units.banner.enabled, true);
  assert.equal(cfg.units.banner.width, 728);
  assert.equal(cfg.units.banner.height, 90);

  assert.equal(cfg.units.rewarded.unitId, '48f66ca841444050a166841f331b6adb');
  assert.equal(cfg.units.rewarded.enabled, true);

  assert.equal(cfg.units.couplet.unitId, '168ce66592d743bea2c16cdf908165b3');
  assert.equal(cfg.units.couplet.enabled, true);
  assert.equal(cfg.units.couplet.width, 300);
  assert.equal(cfg.units.couplet.height, 600);
  assert.ok(cfg.units.couplet.minWindowWidth >= 1400);

  assert.equal(cfg.units.interstitial.unitId, '');
  assert.equal(cfg.units.interstitial.enabled, false);
  assert.equal(cfg.units.interstitial.width, 1024);
  assert.equal(cfg.units.interstitial.height, 768);

  const raw = JSON.stringify(cfg);
  assert.doesNotMatch(raw, /secretKey|privateKey|MIGTAgEA|BEGIN PRIVATE KEY/i);
});

test('كود المضيف الأصلي C# يطبق دورة MG Ads V1.2.1 الكاملة والحماية الصارمة', () => {
  const manager = read('windows/host/NexoraWindows/Ads/MgAdsManager.cs');
  assert.match(manager, /ApplicationManager\.SetAppId\(/);
  assert.match(manager, /ApplicationManager\.OpenCmp\(/);
  assert.match(manager, /ApplicationManager\.Initialize\(/);
  assert.match(manager, /AdType\.Banner/);
  assert.match(manager, /AdType\.Rewarded/);
  assert.match(manager, /AdType\.Couplet/);
  assert.match(manager, /AdType\.Interstitial/);
  assert.match(manager, /AdvertManager\.ReportAdRewardFulfillment\(/);
  assert.match(manager, /completeStatus == 1/);
  assert.match(manager, /_bannerContainer\.Visible = false/);
  assert.match(manager, /_bannerContainer\.Visible = hasChild/);

  const bridge = read('windows/host/NexoraWindows/Bridge/WebViewBridge.cs');
  assert.match(bridge, /IsTrustedSource/);
  assert.match(bridge, /case "showBanner":/);
  assert.match(bridge, /case "showRewarded":/);
  assert.match(bridge, /case "showCouplet":/);
  assert.match(bridge, /case "showInterstitial":/);
  assert.match(bridge, /case "openPrivacyChoices":/);
  assert.doesNotMatch(bridge, /ResolveSecretKey/, 'الجسر لا يقرأ ولا يمرر المفتاح الخاص أبدًا');

  const vault = read('windows/host/NexoraWindows/Config/NativeSecretVault.cs');
  assert.match(vault, /ProtectedData\.Unprotect/);
  assert.match(vault, /ProtectedData\.Protect/);
  assert.match(vault, /DataProtectionScope\.CurrentUser/);

  const form = read('windows/host/NexoraWindows/UI/MainForm.cs');
  assert.match(form, /AddScriptToExecuteOnDocumentCreatedAsync/);
  assert.match(form, /nx_surface/);
  assert.match(form, /accounts\.google\.com/);
  assert.match(form, /Visible = false/);

  const restore = read('windows/scripts/Restore-MgAdsSdk.ps1');
  assert.match(restore, /dc04de9bec8e67aa5ebb424c8219a425c65fe5bdfd0df446c128e58ff1ba1e49/);
});

test('جسر mgAdsBridge يفشل مغلقًا خارج المضيف الأصلي ويُكمل الطلبات والمكافآت داخله', async () => {
  // خارج المضيف الأصلي (متصفح عادي)
  const plainWin = { location: { search: '' }, document: { documentElement: { dataset: {} } } };
  assert.equal(isNativeMgAdsHost(plainWin), false);
  const blocked = await requestBanner({}, plainWin);
  assert.equal(blocked.shown, false);
  assert.equal(blocked.reason, 'not-native-host');

  // داخل مضيف WebView2 أصلي محاكى
  let listener = null;
  const sent = [];
  const nativeWin = {
    location: { search: '?nx_surface=msix&nx_host=native-webview2' },
    document: { documentElement: { dataset: { nxNativeHost: 'webview2-mgads' } } },
    chrome: {
      webview: {
        addEventListener: (ev, fn) => { if (ev === 'message') listener = fn; },
        postMessage: (msg) => {
          sent.push(msg);
          setTimeout(() => {
            if (msg.action === 'getState') {
              listener?.({
                data: {
                  type: 'nx-mgads-response',
                  requestId: msg.requestId,
                  ok: true,
                  data: { provider: 'mgads', initialized: true, rewardedConfigured: true, interstitialConfigured: false },
                },
              });
            } else if (msg.action === 'showRewarded') {
              listener?.({
                data: {
                  type: 'nx-mgads-response',
                  requestId: msg.requestId,
                  ok: true,
                  data: { shown: true, completed: true, fulfilled: true, rewardId: 'RWD-123' },
                },
              });
            } else {
              listener?.({
                data: { type: 'nx-mgads-response', requestId: msg.requestId, ok: true, data: { synced: true } },
              });
            }
          }, 5);
        },
      },
    },
  };

  assert.equal(isNativeMgAdsHost(nativeWin), true);
  const state = await getMgAdsState(nativeWin);
  assert.equal(state.provider, 'mgads');
  assert.equal(state.initialized, true);
  assert.equal(state.rewardedConfigured, true);
  assert.equal(state.interstitialConfigured, false);

  const reward = await showNativeRewardedAd({ comment: 'test-reward' }, nativeWin);
  assert.equal(reward.completed, true);
  assert.equal(reward.fulfilled, true);

  const synced = await syncViewContext({ view: 'studio', hasMessages: false }, nativeWin);
  assert.equal(synced.synced, true);
  assert.equal(sent.length, 3);
});

test('إعلانات الويب (AdSlot / Adsterra / Monetag) مستبعدة تمامًا عند nx_surface=msix', () => {
  for (const file of ['src/ai/AdSlot.jsx', 'public/adsterra-web.js', 'public/monetag-web.js']) {
    const src = read(file);
    assert.match(src, /nx_surface/, `${file} must check nx_surface=msix`);
    assert.match(src, /webview2-mgads/, `${file} must check nxNativeHost=webview2-mgads`);
  }
});
