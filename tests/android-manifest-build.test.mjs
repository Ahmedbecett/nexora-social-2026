/**
 * NEXORA AI — اختبارات تهيئة Firebase/Google وبنية المانيفست.
 *
 * خلفية: محاولة البناء الأولى للنسخة 44 سقطت في خطوة `assembleRelease`
 * لأن <intent-filter> كُتب مباشرة تحت <application> (غير صالح في AAPT2)،
 * ولأن المانيفست أشار إلى @integer/google_play_services_version يدويًا.
 *
 * هذه الاختبارات تمنع تكرار الخطأ قبل أن يصل إلى CI:
 *  1. بنية المانيفست: كل intent-filter داخل مكوّن، والوسوم متوازنة، ولا مراجع موارد غير مضمونة.
 *  2. google-services.json: المشروع والحزمة صحيحان، وهناك Web client + Android client ببصمة.
 *     (بلا Web client يفشل Google Sign-In بخطأ 10 / DEFAULT_WEB_CLIENT.)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = (p) => readFileSync(p, 'utf8');
const MANIFEST = 'android/app/src/main/AndroidManifest.xml';
const stripComments = (s) => s.replace(/<!--[\s\S]*?-->/g, '');

test('المانيفست: <intent-filter> لا يقع مباشرة تحت <application>', () => {
  const xml = stripComments(read(MANIFEST));
  const appBlock = /<application[\s\S]*?<\/application>/.exec(xml)?.[0] || '';
  const withoutComponents = appBlock
    .replace(/<activity[\s\S]*?<\/activity>/g, '')
    .replace(/<service[\s\S]*?<\/service>/g, '')
    .replace(/<receiver[\s\S]*?<\/receiver>/g, '')
    .replace(/<provider[\s\S]*?<\/provider>/g, '');
  assert.doesNotMatch(withoutComponents, /<intent-filter/, 'intent-filter خارج أي مكوّن يفشل AAPT2');
});

test('المانيفست: الوسوم الأساسية متوازنة', () => {
  const xml = stripComments(read(MANIFEST));
  for (const tag of ['application', 'activity', 'provider', 'intent-filter']) {
    const open = (xml.match(new RegExp(`<${tag}\\b`, 'g')) || []).length;
    const close = (xml.match(new RegExp(`</${tag}>`, 'g')) || []).length;
    assert.equal(open, close, `<${tag}> غير متوازن (${open}/${close})`);
  }
});

test('المانيفست: لا مرجع يدوي لـ @integer/google_play_services_version', () => {
  // يُضاف تلقائيًا عند دمج Play Services؛ المرجع اليدوي قد يُفشل التحقق في AAPT2
  assert.doesNotMatch(stripComments(read(MANIFEST)), /@integer\/google_play_services_version/);
});

test('المانيفست: متوافق مع Fire OS (لا اشتراط لشاشة لمس/كاميرا) وAdMob محفوظ', () => {
  const xml = stripComments(read(MANIFEST));
  for (const f of ['touchscreen', 'microphone', 'camera', 'location']) {
    assert.match(xml, new RegExp(`android:name="android\\.hardware\\.${f}"\\s+android:required="false"`));
  }
  assert.match(xml, /com\.amazon\.venezia\.category\.MAIN/);
  // معرّف AdMob الإنتاجي يجب ألّا يُفقد
  assert.match(xml, /ca-app-pub-6858364141205978~7081673739/);
});

test('google-services.json: المشروع والحزمة صحيحان', () => {
  const path = 'android/app/google-services.json';
  if (!existsSync(path)) return; // الملف خارج Git عمدًا (بيانات مشروع) — يُوفَّر عبر السر
  const cfg = JSON.parse(read(path));
  assert.equal(cfg.project_info.project_id, 'nexora-social-2026');
  const client = (cfg.client || []).find(
    (c) => c?.client_info?.android_client_info?.package_name === 'com.ahmedbecetti.nexora',
  );
  assert.ok(client, 'لا يوجد عميل أندرويد للحزمة com.ahmedbecetti.nexora');
});

test('google-services.json: Web client موجود (وإلا فشل Google بخطأ 10)', () => {
  const path = 'android/app/google-services.json';
  if (!existsSync(path)) return;
  const cfg = JSON.parse(read(path));
  const client = cfg.client.find(
    (c) => c.client_info.android_client_info.package_name === 'com.ahmedbecetti.nexora',
  );
  const web = (client.oauth_client || []).find((o) => o.client_type === 3);
  assert.ok(web, 'غياب client_type 3 يعني DEFAULT_WEB_CLIENT عند تسجيل الدخول');
  assert.match(web.client_id, /\.apps\.googleusercontent\.com$/);
});

test('google-services.json: بصمة SHA-1 لمفتاح التوقيع المنشور مسجّلة', (t) => {
  // SHA-1 لشهادة الحزمة المنشورة (public/download/Nexora.apk)، مأخوذة من CERT.RSA
  const RELEASE_SHA1 = '1d2aa8a1eaadef1cf3d0813bd7f1572d88610973';
  const path = 'android/app/google-services.json';
  if (!existsSync(path)) return;
  const cfg = JSON.parse(read(path));
  const hashes = cfg.client
    .flatMap((c) => c.oauth_client || [])
    .filter((o) => o.client_type === 1)
    .map((o) => String(o?.android_info?.certificate_hash || '').toLowerCase());
  if (!hashes.includes(RELEASE_SHA1)) {
    // ليست مسألة كود: يجب تسجيل البصمة في لوحة Firebase (Project settings → Android app).
    // لا نُفبرك عميل OAuth لبصمة غير مسجّلة، ولا ندّعي أن Google سيعمل.
    t.skip(
      `بصمة مفتاح التوقيع المنشور ${RELEASE_SHA1} (SHA-1) غير مسجّلة في Firebase. `
      + 'يجب إضافتها: Firebase Console → nexora-social-2026 → Project settings → تطبيق أندرويد '
      + 'com.ahmedbecetti.nexora → Add fingerprint → ثم أعد تنزيل google-services.json. '
      + 'بدونها يفشل Google Sign-In على الحزمة الموقّعة بالإنتاج بخطأ 10 (DEVELOPER_ERROR).',
    );
    return;
  }
  assert.ok(hashes.includes(RELEASE_SHA1));
});

test('gate في Gradle: Google لا يُشحن بلا تهيئة (حماية Fire OS)', () => {
  const app = read('android/app/build.gradle');
  const root = read('android/build.gradle');
  assert.match(app, /rgcfaIncludeGoogle/);
  assert.match(root, /rgcfaIncludeGoogle\s*=\s*hasFirebaseConfig/);
});

/* ==========================================================================
   الإعلانات (AdMob) — شرط المستخدم الصريح: لا تُفقد في نسخة الإصلاح.
   الخلل الأكثر ترجيحًا بعد تغيير بناء Firebase هو سقوط إضافة google-services،
   وهي التي تزوّد AdMob بمعرّف التطبيق وقت التشغيل.
   ========================================================================== */
test('AdMob: معرّف التطبيق في المانيفست هو الإنتاجي', () => {
  const xml = stripComments(read(MANIFEST));
  assert.match(xml, /com\.google\.android\.gms\.ads\.APPLICATION_ID/);
  assert.match(xml, /ca-app-pub-6858364141205978~7081673739/);
});

test('AdMob: معرّفات الوحدات الإنتاجية موجودة في src/ads.js', () => {
  const ads = read('src/ads.js');
  assert.match(ads, /ca-app-pub-6858364141205978\/1001361442/); // banner
  assert.match(ads, /ca-app-pub-6858364141205978\/2374152863/); // interstitial
  assert.match(ads, /ca-app-pub-6858364141205978\/5160098300/); // rewarded
  // معرّفات الاختبار لا تُستخدم إلا في بناء التطوير
  const prodBlock = /const PROD_UNITS = \{[\s\S]*?\};/.exec(ads)?.[0] || '';
  assert.doesNotMatch(prodBlock, /3940256099942544/);
});

test('AdMob: ملفات ads.txt وapp-ads.txt تُصرّح بمعرّف الناشر', () => {
  for (const f of ['public/ads.txt', 'public/app-ads.txt']) {
    assert.match(read(f), /pub-6858364141205978/);
  }
});
