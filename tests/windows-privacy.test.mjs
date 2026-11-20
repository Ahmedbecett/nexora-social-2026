/**
 * NEXORA AI — Windows privacy, support and advertising documentation.
 *
 * Microsoft Store requires a reachable privacy policy and support contact.
 * The advertising investigation must say plainly that nothing is live, and no
 * document may promise a signed package, Store ID or ad revenue that does not
 * exist yet.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (p) => readFileSync(p, 'utf8');
const ar = read('public/windows/index.html');
const en = read('public/windows/en.html');
const privacy = read('public/windows/privacy.html');
const adsDoc = read('docs/windows/ADS-INTEGRATION.md');

const ids = (html) => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));

test('سياسة الخصوصية العامة لـ Windows موجودة وقابلة للنشر', () => {
  for (const file of ['public/windows/index.html', 'public/windows/en.html', 'public/windows/privacy.html', 'public/windows/ads-config.json']) {
    assert.ok(existsSync(file), file);
  }
  assert.match(privacy, /<link rel="canonical" href="https:\/\/nexora-social-2026\.vercel\.app\/windows\/privacy\.html"/);
  assert.match(privacy, /Effective 19 November 2026/);
  assert.match(privacy, /ahmedbecetti35@gmail\.com/);
  assert.match(privacy, /Microsoft Store/);
  assert.match(privacy, /PWA/);
  assert.match(privacy, /MSIX/);
});

test('السياسة تغطي البيانات والتخزين المحلي والأمان والحذف والحقوق', () => {
  for (const id of ['who', 'data', 'local', 'use', 'sharing', 'ads', 'store', 'security', 'retention', 'rights', 'children', 'ai', 'transfers', 'changes', 'contact']) {
    assert.ok(ids(privacy).has(id), `قسم مفقود: #${id}`);
  }
  for (const key of ['nx_token', 'nx_accounts', 'nx_ads_consent', 'nx_surface', 'nx_theme']) {
    assert.ok(privacy.includes(key), key);
  }
  assert.match(privacy, /HTTPS/);
  assert.match(privacy, /Delete|حذف الحساب/);
  assert.match(privacy, /rights|حقوقك/);
  assert.match(privacy, /credential vault|خزنة اعتماد/);
});

test('الإعلانات مذكورة بصدق: لا مزوّد مفعّل، ولا قياس مزيف', () => {
  assert.match(privacy, /no third-party advertising network is enabled/i);
  assert.match(privacy, /no ad request is sent/i);
  assert.match(privacy, /Impressions and clicks will be measured by that provider/i);
  assert.match(privacy, /Google AdSense is used on the public website only/i);
  assert.match(privacy, /current MG Ads SDK for UWP cannot be attached/i);
  assert.match(privacy, /لا توجد شبكة إعلانات طرف ثالث مفعّلة/i);
  assert.match(privacy, /لا يولّد التطبيق انطباعات أو نقرات/i);
  assert.doesNotMatch(privacy, /ads are (now )?(live|working|operational)/i);
});

test('صفحات Windows تقدّم دعوى دعم ورابط خصوصية صحيحين', () => {
  for (const page of [ar, en]) {
    assert.ok(ids(page).has('support'), 'قسم الدعم مطلوب');
    assert.ok(page.includes('href="/windows/privacy.html"'), 'رابط السياسة');
    assert.ok(page.includes('mailto:ahmedbecetti35@gmail.com'), 'بريد الدعم');
    assert.match(page, /Windows 10/);
    assert.match(page, /4\.4\.1/);
  }
  // نقطة الدعم التي يستخدمها المتجر موجودة في الصفحة العربية
  assert.ok(ids(ar).has('support'));
  assert.match(ar, /قبل أن تراسلنا/);
  assert.match(en, /Before contacting us/);
});

test('لا رابط متجر وهمي ولا Product ID مخترع في أي صفحة عامة', () => {
  for (const page of [ar, en, privacy]) {
    assert.doesNotMatch(page, /apps\.microsoft\.com\/store\/detail/i);
    assert.doesNotMatch(page, /9NBLGGH4R315/);
    assert.doesNotMatch(page, /9[A-Z0-9]{11}\b/);
  }
  assert.match(ar, /لا يوجد رابط متجر رسمي|لا تستخدم أي رابط متجر آخر/);
  assert.match(en, /no official Store link|do not use any other Store link/i);
});

test('تحقيق الإعلانات يوثّق MG Ads وAdSense وAdMob بوضوح', () => {
  assert.match(adsDoc, /Status: not operational/i);
  assert.match(adsDoc, /MG Ads SDK for UWP/);
  assert.match(adsDoc, /C\+\+ SDK/);
  assert.match(adsDoc, /Win32\/WebView2/);
  assert.match(adsDoc, /AdMob.*Windows desktop/s);
  assert.match(adsDoc, /AdSense/);
  assert.match(adsDoc, /Monetag/);
  assert.match(adsDoc, /allowInMsix/);
  assert.match(adsDoc, /3940256099942544/);
  assert.match(adsDoc, /do not change|لا تغيّر/i);
  assert.match(adsDoc, /written verification|تحقق كتابي/i);
  assert.match(adsDoc, /https:\/\/www\.mg-ads\.com\//);
});

test('الاختبار والتقرير والقيود موجودة وتقول ما لم يُختبر على Windows', () => {
  for (const doc of [
    'docs/windows/README.md',
    'docs/windows/BUILD-AND-DEPLOY.md',
    'docs/windows/MSIX.md',
    'docs/windows/ADS-INTEGRATION.md',
    'docs/windows/MG-ADS-FEASIBILITY.md',
    'docs/windows/STORE-LISTING.md',
    'docs/windows/TEST-REPORT.md',
    'docs/windows/UNSUPPORTED.md',
    'docs/windows/RELEASE-CHECKLIST.md',
    'docs/windows/SCREENSHOTS.md',
  ]) {
    assert.ok(existsSync(doc), doc);
  }
});

test('تحقيق MG Ads يثبت عدم التوافق مع نوع الحزمة الحالي', () => {
  const mg = read('docs/windows/MG-ADS-FEASIBILITY.md');
  assert.match(mg, /MG Ads SDK for UWP/);
  assert.match(mg, /MiracleGames\.Sdk\.Uwp/);
  assert.match(mg, /UAP 10\.0/);
  assert.match(mg, /Win32\/WebView2/);
  assert.match(mg, /AdvertisingManager\.ShowAd/);
  assert.match(mg, /2\.8\.7\.0/);
  assert.match(mg, /C\+\+ SDK/);
  assert.match(mg, /H5 SDK/);
  assert.match(mg, /V1\.2\.6\.6/);
  assert.match(mg, /cannot be integrated|لا يتم دمج/i);
  assert.match(mg, /Draft|مسودة/);
  assert.doesNotMatch(mg, /ads are (now )?(live|working|operational)/i);
});

test('صفحات Windows محمية من الفهرسة الخاطئة وتربط الترجمة', () => {
  assert.match(ar, /hreflang="en" href="https:\/\/nexora-social-2026\.vercel\.app\/windows\/en\.html"/);
  assert.match(en, /hreflang="ar" href="https:\/\/nexora-social-2026\.vercel\.app\/windows\/"/);
  assert.match(privacy, /hreflang="ar"/);
  assert.match(privacy, /hreflang="en"/);
  assert.match(ar, /<html lang="ar" dir="rtl">/);
  assert.match(en, /<html lang="en" dir="ltr">/);
});
