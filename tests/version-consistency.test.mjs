/**
 * NEXORA AI — اتساق رقم الإصدار بين كل ما يراه المستخدم.
 *
 * سبب هذه الاختبارات: رقم الإصدار كان مكتوبًا يدويًا في خمسة مواضع فتناقض:
 *   زر التحميل v4.0 · SEO 4.3.0 · شاشة «حول» 2.6.0 · الحزمة الحقيقية 4.4.0.
 * المستخدم يرى «v4.0» فيظن أن التحديث لم يصل — وهو ما شكا منه صاحب المشروع.
 *
 * الآن package.json هو المصدر الوحيد، وتُقرأ منه:
 *   - نصوص زر التحميل (عربي/إنجليزي) عبر src/version.js
 *   - بيانات SEO في index.html عبر %APP_VERSION%
 *   - شاشة «حول» عبر APP_VERSION
 * أي عودة إلى رقم مكتوب يدويًا تُفشل هذه الاختبارات.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = (p) => readFileSync(p, 'utf8');
const pkg = JSON.parse(read('package.json'));

/* أرقام إصدار قديمة يُمنع ظهورها في أي نص يراه المستخدم */
const STALE = ['v4.0', 'v4.1', 'v4.2', 'v4.3', '2.6.0', '4.3.0'];

test('package.json هو مصدر الإصدار والترقيم صحيح', () => {
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/, 'version يجب أن يكون x.y.z');
  assert.equal(pkg.version, '4.4.0');
});

test('src/version.js يشتق الرقم من package.json لا من نص ثابت', () => {
  const v = read('src/version.js');
  assert.match(v, /pkg\.version/, 'يجب أن يقرأ الإصدار من package.json');
  assert.match(v, /VITE_APP_VERSION/, 'يجب أن يقبل الحقن وقت البناء');
  // لا رقم إصدار حقيقي مكتوب يدويًا (الاحتياطي '0.0.0' مسموح: لا يوحي بإصدار معيّن)
  const code = v.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(code, /["']0*[1-9]\d*\.\d+\.\d+["']/, 'رقم إصدار مثبّت يدويًا');
});

test('زر التحميل يستخدم الرقم المشتق لا نصًا ثابتًا', () => {
  const i18n = read('src/i18n.js');
  const getAppLines = i18n.split('\n').filter((l) => l.includes('getApp:'));
  assert.equal(getAppLines.length, 2, 'يجب أن يكون هناك نصّان (عربي/إنجليزي)');
  for (const line of getAppLines) {
    assert.match(line, /APP_VERSION_LABEL/, `لا يستخدم الرقم المشتق: ${line.trim()}`);
  }
});

test('شاشة «حول» تعرض الإصدار الحقيقي لا رقمًا قديمًا', () => {
  const settings = read('src/screens/Settings.jsx');
  assert.doesNotMatch(settings, /APP_VERSION\s*=\s*['"]\d+\.\d+\.\d+['"]/);
  assert.match(settings, /from '\.\.\/version\.js'/);
});

test('index.html لا يحمل رقم إصدار مكتوبًا يدويًا', () => {
  const html = read('index.html');
  for (const stale of STALE) {
    assert.ok(!html.includes(stale), `index.html ما زال يحوي رقمًا قديمًا: ${stale}`);
  }
  assert.match(html, /%APP_VERSION%/, 'softwareVersion يجب أن يُحقن وقت البناء');
  assert.match(html, /%APP_TITLE%/, 'عنوان الصفحة يجب أن يُحقن وقت البناء');
});

test('لا رقم إصدار قديم في أي شاشة أو نص', () => {
  const files = [
    'src/i18n.js',
    'src/ai/AIPlatform.jsx',
    'src/screens/Settings.jsx',
    'index.html',
  ];
  for (const f of files) {
    const src = read(f);
    for (const stale of STALE) {
      assert.ok(!src.includes(stale), `${f} يحوي رقمًا قديمًا يراه المستخدم: ${stale}`);
    }
  }
});

test('vite يحقن الإصدار في index.html وفي الويب', () => {
  const cfg = read('vite.config.js');
  assert.match(cfg, /transformIndexHtml/);
  assert.match(cfg, /%APP_VERSION%/);
  assert.match(cfg, /VITE_APP_VERSION/);
});

test('الحزمة المبنية (إن وُجدت) تعرض الإصدار الصحيح', () => {
  if (!existsSync('dist/index.html')) return; // لم يُبنَ بعد
  const html = read('dist/index.html');
  assert.ok(!html.includes('%APP_VERSION%'), 'placeholder لم يُستبدل — البناء ناقص');
  assert.ok(!html.includes('%APP_TITLE%'), 'placeholder للعنوان لم يُستبدل');
  assert.match(html, new RegExp(`"softwareVersion":"${pkg.version}"`));
});
