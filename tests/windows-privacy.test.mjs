/**
 * NEXORA AI — Windows privacy, support and advertising documentation.
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
  assert.match(privacy, /Effective 23 November 2026/);
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

test('الإعلانات موثّقة بدقة: MG Ads C# SDK V1.2.1 وCMP ومنع القياس المزيف واستبعاد إعلانات الويب', () => {
  assert.match(privacy, /MG Ads \(Miracle Games\) C# SDK V1\.2\.1/);
  assert.match(privacy, /Consent Management Platform \(CMP\)/);
  assert.match(privacy, /no empty advertising space is shown/i);
  assert.match(privacy, /never generates fake impressions/i);
  assert.match(privacy, /strictly excluded from the Windows Store MSIX/i);
  assert.match(privacy, /منصة إدارة الموافقة \(CMP\)/);
  assert.match(privacy, /لا يولّد التطبيق انطباعات أو نقرات/i);
});

test('صفحات Windows تقدّم دعمًا ورابط خصوصية وإصدار 4.5.0 صحيحين', () => {
  for (const page of [ar, en]) {
    assert.ok(ids(page).has('support'), 'قسم الدعم مطلوب');
    assert.ok(page.includes('href="/windows/privacy.html"'), 'رابط السياسة');
    assert.ok(page.includes('mailto:ahmedbecetti35@gmail.com'), 'بريد الدعم');
    assert.match(page, /Windows 10/);
    assert.match(page, /4\.5\.0/);
  }
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

test('توثيق الإعلانات وMG Ads يغطي الوحدات الإنتاجية والضوابط الأمنية', () => {
  assert.match(adsDoc, /MG Ads.*C# SDK V1\.2\.1/);
  assert.match(adsDoc, /d461565a9efe49f0ac63ae71048fb594/);
  assert.match(adsDoc, /48f66ca841444050a166841f331b6adb/);
  assert.match(adsDoc, /168ce66592d743bea2c16cdf908165b3/);
  assert.match(adsDoc, /3940256099942544/);
  assert.match(adsDoc, /https:\/\/www\.mg-ads\.com\//);

  const mg = read('docs/windows/MG-ADS-FEASIBILITY.md');
  assert.match(mg, /6b03f6af1f812ea86a26de4f/);
  assert.match(mg, /MiracleGamesAd\.dll/);
  assert.match(mg, /MG_ADS_SECRET_KEY/);
  assert.match(mg, /NexoraWindows\.exe/);
});

test('ملفات التوثيق الأساسية موجودة', () => {
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

test('صفحات Windows محمية من الفهرسة الخاطئة وتربط الترجمة', () => {
  assert.match(ar, /hreflang="en" href="https:\/\/nexora-social-2026\.vercel\.app\/windows\/en\.html"/);
  assert.match(en, /hreflang="ar" href="https:\/\/nexora-social-2026\.vercel\.app\/windows\/"/);
  assert.match(privacy, /hreflang="ar"/);
  assert.match(privacy, /hreflang="en"/);
  assert.match(ar, /<html lang="ar" dir="rtl">/);
  assert.match(en, /<html lang="en" dir="ltr">/);
});
