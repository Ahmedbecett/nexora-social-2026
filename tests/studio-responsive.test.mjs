/**
 * NEXORA Studio — اختبارات التصميم المتجاوب وسلامة البيانات.
 *
 * سبب وجود هذه الاختبارات (من تقرير المستخدم):
 *  - على شاشة هاتف ضيقة كان التصميم ثلاثي الأعمدة يُضغط بدل أن يتكيّف.
 *  - المعاينة كانت تعرض صوراً مكسورة لأن ملفات CSS/JS/الصور لم تكن تُضمَّن.
 *  - كان يُعرض «نجاح تنفيذ» وروابط نشر وهمية بينما لا شيء نُفِّذ أو نُشِر فعلاً.
 * أي عودة إلى أحد هذه السلوكيات تُفشل الاختبارات هنا.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildPreviewDocument,
  entryFile,
  resolveProjectFile,
  fileLang,
  highlightLang,
  assetDataUri,
  sampleNoteHtml,
  noPreviewDocument,
  IMAGE_FALLBACK_SCRIPT,
} from '../src/ai/studioPreview.js';
import { TEMPLATES, DEFAULT_TEMPLATE } from '../src/ai/studioTemplates.js';

const read = (p) => readFileSync(p, 'utf8');
const studioSrc = read('src/ai/ArenaStudio.jsx');
const editorSrc = read('src/ai/CodeEditor.jsx');
const cssSrc = read('src/ai/ArenaStudio.css');
const workspaceSrc = read('api/_lib/workspace.js');
const execSrc = read('api/_lib/exec.js');
const handlersSrc = read('api/_lib/handlers.js');

/* ─────────────── 1. mobile workspace layout ─────────────── */
test('تبويبات الهاتف الثلاثة موجودة: Files / Code Editor / Live Preview', () => {
  assert.match(studioSrc, /t\('filesTab'\)/);
  assert.match(studioSrc, /t\('codeTab'\)/);
  assert.match(studioSrc, /t\('previewTab'\)/);
  assert.match(studioSrc, /className="nx-s-tabs"[\s\S]*?filesTab[\s\S]*?codeTab[\s\S]*?previewTab/);
  const strings = read('src/ai/studioStrings.js');
  assert.match(strings, /filesTab: 'الملفات'/);
  assert.match(strings, /codeTab: 'محرر الكود'/);
  assert.match(strings, /previewTab: 'المعاينة الحية'/);
  assert.match(strings, /filesTab: 'Files'/);
  assert.match(strings, /codeTab: 'Code Editor'/);
  assert.match(strings, /previewTab: 'Live Preview'/);
});

test('لوحة واحدة تُعرض على الهاتف مع إبقاء الأخريات في DOM (حفظ حالة المعاينة)', () => {
  // التبديل عبر visibility فقط — لا unmount ولا display:none للوحة، فلا يُعاد تحميل الـ iframe
  assert.match(cssSrc, /\.nx-s-workspace\.is-mobile \.nx-s-panel:not\(\.is-active\):not\(\.is-open\)\s*\{[^}]*visibility:\s*hidden/);
  assert.match(cssSrc, /\.nx-s-workspace\.is-mobile\s*\{[^}]*display:\s*block/);
  // مساحة العمل نفسها لا يجب أن تُخفى بـ display:none
  assert.doesNotMatch(cssSrc, /\.nx-s-preview[^{]*\{[^}]*display:\s*none/);
  assert.doesNotMatch(cssSrc, /\.nx-s-editor[^{]*\{[^}]*display:\s*none/);
});

test('الحاسوب يحتفظ بتصميم ثلاثة أعمدة', () => {
  assert.match(cssSrc, /\.nx-s-workspace\s*\{[^}]*display:\s*flex/);
  assert.match(cssSrc, /\.nx-s-files\s*\{[^}]*width:\s*238px/);
  assert.match(cssSrc, /\.nx-s-preview\s*\{[^}]*width:\s*42%/);
  // الاستعلام الوحيد الذي يغيّر التخطيط هو شاشات <= 900px
  assert.match(cssSrc, /@media \(max-width: 900px\)/);
});

/* ─────────────── 2. code editor ─────────────── */
test('المحرر يستخدم highlight.js مع أرقام أسطر وبدون التفاف', () => {
  assert.match(editorSrc, /highlight\.js\/lib\/core/);
  assert.match(editorSrc, /hljs\.highlight\(/);
  assert.match(editorSrc, /className="nx-code-gutter"/);
  assert.match(editorSrc, /wrap="off"/);
  // الطبقة الملوّنة والطبقة القابلة للتحرير متطابقتان في المقاسات
  assert.match(cssSrc, /\.nx-code-highlight,\s*\n\.nx-code-input\s*\{[^}]*white-space:\s*pre/);
  assert.match(cssSrc, /\.nx-code-input\s*\{[^}]*overflow:\s*auto/);
  assert.doesNotMatch(cssSrc, /\.nx-code-input\s*\{[^}]*overflow-wrap:\s*break-word/);
});

test('المحرر يدعم الإزاحة والتمرير الأفقي ومفاتيح Android/الحاسوب', () => {
  assert.match(editorSrc, /key === 'Tab'/);
  assert.match(editorSrc, /indentBlock\(e\.shiftKey\)/);
  assert.match(editorSrc, /newlineWithIndent/);
  assert.match(editorSrc, /onScroll=\{syncScroll\}/);
  assert.match(editorSrc, /key === 's'/);
});

test('الكود دائماً LTR مع عزل ثنائي الاتجاه للواجهة العربية', () => {
  assert.match(editorSrc, /className="nx-code" dir="ltr"/);
  assert.match(editorSrc, /direction: ltr|dir="ltr"/);
  assert.match(cssSrc, /\.nx-code \{[^}]*direction:\s*ltr[^}]*unicode-bidi:\s*isolate/);
  assert.match(cssSrc, /\.nx-s \.ltr \{ direction:\s*ltr; unicode-bidi:\s*isolate; \}/);
  // الواجهة تتبع اتجاه لغة i18n
  assert.match(studioSrc, /const rtl = isRtl\(\)/);
  assert.match(studioSrc, /dir=\{rtl \? 'rtl' : 'ltr'\}/);
});

test('أسماء الملفات والمسارات معزولة LTR داخل واجهة RTL', () => {
  assert.match(studioSrc, /<span dir="ltr">\{name\}<\/span>/);
  assert.match(studioSrc, /dir="auto"/);
  assert.match(cssSrc, /\.nx-s-file-name > span:last-child \{[^}]*direction:\s*ltr[^}]*unicode-bidi:\s*isolate/);
});

/* ─────────────── 3. live preview ─────────────── */
test('المعاينة مبنية كمستند واحد مكتفٍ بذاته (CSS + JS + أصول مضمّنة)', () => {
  const files = {
    'index.html': '<!doctype html><html><head><link rel="stylesheet" href="styles.css"></head><body><img src="assets/logo.svg" alt="logo"><script src="app.js"></script></body></html>',
    'styles.css': 'body{color:red}',
    'app.js': 'console.log("hi");',
    'assets/logo.svg': '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
  };
  const { html, entry, inlined } = buildPreviewDocument(files);
  assert.equal(entry, 'index.html');
  assert.match(html, /<style data-nx-file="styles\.css">/);
  assert.match(html, /<script  data-nx-file="app\.js">|data-nx-file="app\.js"/);
  assert.match(html, /src="data:image\/svg\+xml;base64,/);
  assert.doesNotMatch(html, /href="styles\.css"/);
  assert.doesNotMatch(html, /src="app\.js"/);
  assert.ok(inlined.includes('styles.css'));
  assert.ok(inlined.includes('assets/logo.svg'));
});

test('كل قالب جاهز يُعاين بدون شبكة ولا صور خارجية', () => {
  for (const tpl of TEMPLATES) {
    for (const [name, content] of Object.entries(tpl.files)) {
      assert.doesNotMatch(content, /https?:\/\/(images|source)\.unsplash\.com/, `${tpl.id}/${name} لا يستخدم Unsplash`);
      if (/\.html$/.test(name)) {
        assert.doesNotMatch(content, /<img[^>]+src="https?:\/\//i, `${tpl.id}/${name} لا يحتوي صوراً خارجية`);
      }
    }
    const { html, entry } = buildPreviewDocument(tpl.files, { sample: true });
    assert.ok(entry, `${tpl.id} له صفحة HTML`);
    assert.match(html, /data-nx-fallback/, `${tpl.id} يحصل على سكربت احتياط الصور`);
    assert.doesNotMatch(html, /<link[^>]+href="(?!https?:|data:)[^"]+\.css"/i, `${tpl.id}: CSS مضمّن لا رابط خارجي`);
  }
});

test('صورة مكسورة تُستبدل بمخطط بديل بدل أيقونة مكسورة', () => {
  assert.match(IMAGE_FALLBACK_SCRIPT, /addEventListener\('error'/);
  assert.match(IMAGE_FALLBACK_SCRIPT, /nx-img-broken/);
  assert.match(IMAGE_FALLBACK_SCRIPT, /image unavailable/);
  const { html } = buildPreviewDocument({ 'index.html': '<html><body><img src="missing.png" alt="x"></body></html>' });
  assert.match(html, /data-nx-fallback/);
  assert.match(cssSrc, /nx-s-preview-loading/);
});

test('المعاينة تحتوي viewport لتعمل بعرض كامل على الهاتف', () => {
  const { html } = buildPreviewDocument({ 'index.html': '<p>hi</p>' });
  assert.match(html, /name="viewport"/);
});

test('لا صفحة HTML ⇒ رسالة صادقة بدل معاينة وهمية', () => {
  const doc = noPreviewDocument({ 'server.js': 'x' }, 'ar');
  assert.match(doc, /لا توجد صفحة HTML للمعاينة/);
  const res = buildPreviewDocument({ 'server.js': 'x' });
  assert.equal(res.entry, null);
  assert.match(res.html, /index\.html/);
});

test('أدوات المعاينة: تحديث وفتح في نافذة جديدة', () => {
  assert.match(studioSrc, /const refreshPreview = \(\) => \{[\s\S]*setPreviewNonce/);
  assert.match(studioSrc, /const openPreview = \(\) =>/);
  assert.match(studioSrc, /onClick=\{refreshPreview\}/);
  assert.match(studioSrc, /onClick=\{openPreview\}/);
});

/* ─────────────── 4. file explorer drawer ─────────────── */
test('مستكشف الملفات يصبح درجاً قابلاً للفتح/الإغلاق على الهاتف', () => {
  assert.match(cssSrc, /\.nx-s-workspace\.is-mobile \.nx-s-files\s*\{[^}]*position|\.nx-s-workspace\.is-mobile \.nx-s-files\s*\{/);
  assert.match(cssSrc, /\.nx-s-workspace\.is-mobile \.nx-s-files\s*\{[^}]*transform:\s*translateX\(-104%\)/);
  assert.match(cssSrc, /\.nx-s-files\.is-open \{ transform: none; visibility: visible; \}/);
  assert.match(cssSrc, /\.nx-s-backdrop/);
  assert.match(studioSrc, /className="nx-s-backdrop"/);
  // اختيار ملف يغلق الدرج ويحفظ التحرير
  assert.match(studioSrc, /setActive\(name\); setDrawerOpen\(false\)/);
});

/* ─────────────── 5. sample vs production data ─────────────── */
test('البيانات التجريبية معلَّمة بوضوح ولا تُقدَّم كمخزون حقيقي', () => {
  assert.match(sampleNoteHtml(), /بيانات/);
  assert.match(sampleNoteHtml(), /ليست مخزوناً حقيقياً/);
  const { html } = buildPreviewDocument(DEFAULT_TEMPLATE.files, { sample: true });
  assert.match(html, /id="nx-sample-note"/);
  const plain = buildPreviewDocument(DEFAULT_TEMPLATE.files, { sample: false });
  assert.doesNotMatch(plain.html, /id="nx-sample-note"/);
  // القوالب تُوسم بوسم sample في البيانات
  for (const tpl of TEMPLATES) assert.equal(tpl.sample, true, `${tpl.id} موسوم كقالب تجريبي`);
  // الواجهة تعرض شارة المصدر
  assert.match(studioSrc, /originTemplateNote/);
  assert.match(studioSrc, /className=\{'nx-s-origin ' \+ originMeta\.cls\}/);
});

test('لا وعود اتصال وهمية عند تعذّر قراءة حالة الخدمات', () => {
  // الافتراضي الآن: غير معروف/غير متصل — وليس connected:true كما كان
  assert.doesNotMatch(studioSrc, /vercel:\s*\{\s*connected:\s*true/);
  assert.doesNotMatch(studioSrc, /github:\s*\{\s*connected:\s*true/);
  assert.match(studioSrc, /setIntegrations\(\{ unavailable: true \}\)/);
  assert.match(studioSrc, /capabilities\.offline/);
});

/* ─────────────── 6. no fake execution / deployment ─────────────── */
test('خادم النشر لا يُرجع رابط نشر وهمي', () => {
  assert.doesNotMatch(workspaceSrc, /preview\/' \+ Date\.now\(\)/);
  assert.doesNotMatch(workspaceSrc, /const previewUrl = 'https:\/\/nexora-social-2026/);
  assert.match(workspaceSrc, /deployed: false/);
  assert.match(workspaceSrc, /url: null/);
});

test('واجهة النشر لا تفتح رابطاً إلا إذا كان النشر حقيقياً', () => {
  assert.match(studioSrc, /if \(r\?\.real && r\?\.url\)/);
  assert.match(studioSrc, /setDeployState\('not-deployed'\)/);
  assert.doesNotMatch(studioSrc, /if \(r\.url\) window\.open/);
});

test('التنفيذ الاحتياطي يُعلَن كتحقق فقط لا كنجاح', () => {
  assert.match(execSrc, /validatedOnly: true/);
  assert.match(execSrc, /executed: false/);
  assert.match(execSrc, /VALIDATION ONLY/);
  assert.match(handlersSrc, /result\.real \? 'success' : 'validated'/);
  assert.match(studioSrc, /setExecStatus\(r\.exitCode === 0 \? \(real \? 'success' : 'validated'\) : 'failed'\)/);
  assert.match(studioSrc, /execNotReal/);
});

test('فشل GitHub/Drive لا يُعرض كنجاح', () => {
  assert.match(studioSrc, /t\('githubNotPushed'\)/);
  assert.match(studioSrc, /t\('driveNotSaved'\)/);
  assert.doesNotMatch(studioSrc, /✅ ' \+ \(r\.message/);
});

/* ─────────────── 7. helper sanity ─────────────── */
test('أدوات الملفات: اللغة والأيقونة والمسارات', () => {
  assert.equal(fileLang('a.html'), 'html');
  assert.equal(fileLang('a.jsx'), 'javascript');
  assert.equal(fileLang('a.css'), 'css');
  assert.equal(highlightLang('index.html'), 'xml');
  assert.equal(highlightLang('x.bin'), null);
  assert.equal(entryFile({ 'a.css': '', 'b.html': '' }), 'b.html');
  assert.equal(entryFile({ 'a.css': '' }), null);
  const f = resolveProjectFile({ 'src/app.js': 'x' }, './app.js');
  assert.equal(f.name, 'src/app.js');
  assert.equal(resolveProjectFile({}, 'https://x.com/a.png'), null);
  assert.match(assetDataUri('logo.svg', '<svg/>'), /^data:image\/svg\+xml;base64,/);
  assert.equal(assetDataUri('logo.png', '<svg/>'), null);
});

test('الواجهة تحتفظ بوظائف المشروع الأصلية (حفظ/توليد/تنفيذ/قوالب)', () => {
  for (const fn of ['saveProject', 'doPlan', 'doGenerate', 'runAction', 'doDebug', 'loadTemplate', 'deleteProject', 'renameFile', 'addFile']) {
    assert.match(studioSrc, new RegExp(`const ${fn} = `), `${fn} ما زالت موجودة`);
  }
});
