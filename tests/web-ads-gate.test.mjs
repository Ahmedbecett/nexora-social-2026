import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webAdWindowOpen, webAdMarkShown, webAdClaim, WEB_AD_WINDOW_MS, WEB_AD_HIDE_MS } from '../src/ai/webAdGate.js';

function storageFrom(map) {
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(map, k) ? map[k] : null),
    setItem: (k, v) => { map[k] = String(v); },
  };
}
function withLocalStorage(map, fn) {
  const had = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  globalThis.localStorage = storageFrom(map);
  try { return fn(); } finally {
    if (had) Object.defineProperty(globalThis, 'localStorage', had);
    else delete globalThis.localStorage;
  }
}

test('إيقاع المالك حرفيًا: نافذة 30 دقيقة وإخفاء بعد 15 ثانية', () => {
  assert.equal(WEB_AD_WINDOW_MS, 30 * 60 * 1000);
  assert.equal(WEB_AD_HIDE_MS, 15000);
});

test('المطالبة تنجح مرة واحدة داخل النافذة ثم تُغلق حتى تنقضي الثلاثون دقيقة', () => {
  const map = {};
  withLocalStorage(map, () => {
    assert.equal(webAdWindowOpen(), true, 'أول زيارة: النافذة مفتوحة');
    assert.equal(webAdClaim(), true, 'أول مطالبة تنجح وتحجز النافذة');
    assert.equal(webAdWindowOpen(), false, 'النافذة أُغلقت فور الحجز');
    assert.equal(webAdClaim(), false, 'أي خانة أخرى لا تظهر داخل النافذة');
    webAdMarkShown();
    assert.equal(webAdClaim(), false);
    assert.ok(Number(map.nx_web_ad_last) > 0, 'خُتم وقت الظهور في التخزين');
    /* قبل انقضاء الثلاثين دقيقة بدقيقة: ما زالت مغلقة */
    map.nx_web_ad_last = String(Date.now() - 29 * 60 * 1000);
    assert.equal(webAdWindowOpen(), false);
    /* بعد 31 دقيقة تُفتح من جديد */
    map.nx_web_ad_last = String(Date.now() - 31 * 60 * 1000);
    assert.equal(webAdWindowOpen(), true);
    assert.equal(webAdClaim(), true);
  });
});

test('بدون localStorage (بيئات مقيدة) تعمل البوابة بلا انهيار', () => {
  const had = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  if (!had) {
    assert.equal(webAdWindowOpen(), true);
    assert.equal(webAdClaim(), true);
    webAdMarkShown();
  }
});

test('خانات React تستعمل البوابة نفسها: AdSlot يطالب، وAdsterra يترك الحجز للـ bootstrap', () => {
  const slot = readFileSync('src/ai/AdSlot.jsx', 'utf8');
  const banner = readFileSync('src/ai/AdsterraBanner.jsx', 'utf8');
  const bootstrap = readFileSync('public/adsterra-web.js', 'utf8');
  assert.match(slot, /webAdClaim\(\)/);
  assert.match(slot, /WEB_AD_HIDE_MS/);
  assert.match(slot, /setVisible\(false\)/);
  /* البانر لا يحجز بنفسه وإلا لحجب سكربت الإعلان عن الـ bootstrap */
  assert.doesNotMatch(banner, /webAdClaim/);
  assert.match(bootstrap, /nx_web_ad_last/);
  assert.match(bootstrap, /gateOpen\(\)/);
  assert.match(bootstrap, /HIDE_MS = 15000/);
});
