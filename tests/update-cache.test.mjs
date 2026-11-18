/**
 * NEXORA AI — «ما زالت تظهر الصفحة القديمة» بعد كل تحديث.
 *
 * سبب الشكوى: الخادم يقدّم أحدث نسخة، لكن المتصفح (أو متصفح تطبيق تواصل
 * اجتماعي) يعرض نسخة محفوظة من صفحة الدخول والحزمة. لا شيء في المشروع كان
 * يكشف ذلك للمستخدم أو يصحّحه.
 *
 * هذه الاختبارات تحمي الحل بثلاث طبقات:
 *   1) ترويسات الكاش: HTML و/version.json بلا كاش، والحزم المُبصّمة تبقى immutable.
 *   2) معرّف بناء يُكتب في dist/version.json ويُحقن في JS.
 *   3) كاشف تحديثات في الواجهة يقارن المعرّف ويعيد التحميل برابط جديد ?v=.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = (p) => readFileSync(p, 'utf8');
const NO_STORE = 'no-store, max-age=0, must-revalidate';

test('vercel: صفحات HTML وحدها بلا كاش، والحزم المُبصّمة تبقى immutable', () => {
  const config = JSON.parse(read('vercel.json'));
  const rule = (source) => config.headers.find((h) => h.source === source);
  const cacheOf = (source) => rule(source)?.headers.find((h) => h.key === 'Cache-Control')?.value;

  assert.equal(cacheOf('/'), NO_STORE, 'صفحة الدخول يجب أن تُقرأ من الشبكة دائمًا');
  assert.equal(cacheOf('/(.*).html'), NO_STORE, 'الصفحات العامة الثابتة كذلك');
  assert.equal(cacheOf('/version.json'), NO_STORE, 'ملف نسخة النشر لا يُخزَّن');
  assert.equal(cacheOf('/assets/(.*)'), 'public, max-age=31536000, immutable', 'الحزم المُبصّمة تبقى سريعة');
  assert.ok(rule('/version.json').headers.some((h) => h.key === 'Content-Type' && h.value.startsWith('application/json')));
  // لا يتحول الـ HTML إلى no-store عبر قاعدة شاملة تلوث الأصول
  assert.ok(!config.headers.some((h) => h.source === '/(.*)' && h.headers.some((x) => x.key === 'Cache-Control')));
});

test('firebase hosting يتبع نفس سياسة الكاش لصفحة الدخول', () => {
  const config = JSON.parse(read('firebase.json'));
  const headers = config.hosting.headers;
  const cacheOf = (source) => headers.find((h) => h.source === source)?.headers.find((h) => h.key === 'Cache-Control')?.value;
  assert.equal(cacheOf('/'), NO_STORE);
  assert.equal(cacheOf('/version.json'), NO_STORE);
  assert.equal(cacheOf('/assets/**'), 'public, max-age=31536000, immutable');
});

test('vite يكتب dist/version.json ويحقن معرّف البناء في الحزمة', () => {
  const config = read('vite.config.js');
  assert.match(config, /fileName:\s*'version\.json'/, 'لا بد من إخراج version.json مع كل بناء');
  assert.match(config, /buildId:\s*BUILD_ID/);
  assert.match(config, /VERCEL_GIT_COMMIT_SHA/, 'معرّف البناء يجب أن يتبع commit النشر');
  assert.match(config, /'import\.meta\.env\.VITE_BUILD_ID':\s*JSON\.stringify\(BUILD_ID\)/);
  assert.match(config, /name:\s*'nexora-build-manifest'/);
});

test('كاشف التحديثات: مقارنة آمنة وإعادة تحميل برابط جديد', () => {
  const src = read('src/updates.js');
  assert.match(src, /export const BUILD_ID = import\.meta\.env\.VITE_BUILD_ID \|\| 'dev'/);
  for (const fn of ['fetchLatestBuild', 'isStale', 'reloadWithLatest', 'watchForUpdates', 'isNativeShell']) {
    assert.match(src, new RegExp(`export (async )?function ${fn}`), fn);
  }
  assert.match(src, /cache: 'no-store'/, 'الفحص نفسه يجب ألا يُخدَم من الكاش');
  assert.match(src, /searchParams\.set\('v'/, 'إعادة التحميل بـ ?v= تتجاوز النسخة المحفوظة');
  assert.match(src, /return latest\.buildId !== current/, 'النسخة القديمة تُكتشف باختلاف المعرّف');
  assert.match(src, /'dev'\) return false/, 'البناء المحلي بلا معرّف لا يطلق تنبيهات كاذبة');
  assert.match(src, /isNativeShell\(\)\) return \(\) => \{\}/, 'تطبيق أندرويد لا يفحص الشبكة');
});

test('الواجهة تعرض شريط «تحديث جديد متاح» وتحدّث بضغطة واحدة', () => {
  const notice = read('src/UpdateNotice.jsx');
  assert.match(notice, /watchForUpdates\(setLatest\)/);
  assert.match(notice, /reloadWithLatest\(latest\.buildId\)/);
  assert.match(notice, /تحديث جديد متاح/);
  assert.match(notice, /Update now/);

  const app = read('src/App.jsx');
  assert.match(app, /import UpdateNotice from '\.\/UpdateNotice\.jsx'/);
  assert.equal((app.match(/<UpdateNotice \/>/g) || []).length, 2, 'يظهر في مساري Studio والمحادثة');

  assert.match(read('src/main.jsx'), /import '\.\/update-notice\.css'/);
  // بصمة النسخة على <html> حتى يمكن التحقق فورًا من البناء المعروض
  assert.match(read('src/main.jsx'), /dataset\.build = BUILD_ID/);
  assert.match(read('src/update-notice.css'), /\.nx-update-bar[\s\S]*position:\s*fixed/);
});

test('البناء الحقيقي (إن وُجد dist) يحمل version.json صالحًا', () => {
  if (!existsSync('dist/version.json')) return;
  const manifest = JSON.parse(read('dist/version.json'));
  const version = JSON.parse(read('package.json')).version;
  assert.equal(manifest.version, version);
  assert.ok(typeof manifest.buildId === 'string' && manifest.buildId.length > 0);
  assert.ok(!Number.isNaN(Date.parse(manifest.builtAt)));
});
