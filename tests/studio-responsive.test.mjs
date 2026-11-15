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

const read = (p) => readFileSync(p, 'utf8');
const studioSrc = read('src/ai/ArenaStudio.jsx');
const editorSrc = read('src/ai/CodeEditor.jsx');
const cssSrc = read('src/ai/ArenaStudio.css');
const workspaceSrc = read('api/_lib/workspace.js');
const execSrc = read('api/_lib/exec.js');
const handlersSrc = read('api/_lib/handlers.js');

/* ─────────────── 1. mobile workspace layout ─────────────── */
test('واجهة الهاتف تعرض المحادثة والملفات والكود والمعاينة', () => {
  assert.match(studioSrc, /\['chat', 'files', 'code', 'preview'\]/);
  assert.match(cssSrc, /\.nxs2-mobile-tabs/);
  assert.match(cssSrc, /\.nxs2-panel\.nxs2-active/);
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
  // الواجهة تتبع اتجاه لغة i18n
  assert.match(studioSrc, /const rtl = isRtl\(\)/);
  assert.match(studioSrc, /dir=\{rtl \? 'rtl' : 'ltr'\}/);
});

test('مسارات الملفات والكود معزولة LTR', () => {
  assert.match(studioSrc, /dir="ltr" className=\{active === name/);
  assert.match(editorSrc, /className="nx-code" dir="ltr"/);
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

test('صورة مكسورة تُستبدل بمخطط بديل بدل أيقونة مكسورة', () => {
  assert.match(IMAGE_FALLBACK_SCRIPT, /addEventListener\('error'/);
  assert.match(IMAGE_FALLBACK_SCRIPT, /nx-img-broken/);
  assert.match(IMAGE_FALLBACK_SCRIPT, /image unavailable/);
  const { html } = buildPreviewDocument({ 'index.html': '<html><body><img src="missing.png" alt="x"></body></html>' });
  assert.match(html, /data-nx-fallback/);
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
test('مستكشف الملفات قابل للتصفح على الهاتف', () => {
  assert.match(studioSrc, /setActive\(name\); setMobileTab\('code'\)/);
  assert.match(cssSrc, /\.nxs2-explorer/);
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

test('الواجهة تحتفظ بوظائف المشروع دون القوالب التجريبية', () => {
  for (const fn of ['saveProject', 'doPlan', 'doGenerate', 'runAction', 'doDebug', 'deleteProject', 'renameFile', 'addFile']) {
    assert.match(studioSrc, new RegExp(`const ${fn} = `), `${fn} ما زالت موجودة`);
  }
});


test('studio opens without demo files and never reloads the old sample', () => {
  assert.doesNotMatch(studioSrc, /DEFAULT_TEMPLATE|TEMPLATES|loadTemplate/);
  assert.match(studioSrc, /stored === 'template'.*files: \{\}/);
  assert.match(studioSrc, /setFiles\(\{\}\)/);
});

test('pipeline passes newly generated files to execution rather than stale React state', () => {
  assert.match(studioSrc, /let currentFiles = gen\.files/);
  assert.match(studioSrc, /files: currentFiles/);
  assert.match(studioSrc, /plan: opts\.plan \?\? plan/);
});

test('execution never returns a preview URL for a closed sandbox and preserves test failure', () => {
  assert.doesNotMatch(execSrc, /previewUrl = `https:\/\/\$\{host/);
  assert.doesNotMatch(handlersSrc, /npm test --if-present 2>&1; echo/);
});

test('user project deployment cannot target the NEXORA application project', () => {
  assert.match(workspaceSrc, /process\.env\.VERCEL_STUDIO_TOKEN/);
  assert.match(workspaceSrc, /nexora-user-\$\{userId\}-project-\$\{projectId\}/);
  assert.doesNotMatch(workspaceSrc, /vercelDeploy\(\{ files: f, name: pname, project: process\.env\.VERCEL_PROJECT_ID/);
  assert.match(workspaceSrc, /if \(!userToken\) return \{ ok: false, real: false/);
});

test('sandbox sessions are scoped to user and project and expose preview only after a listener check', () => {
  assert.match(execSrc, /primary key \(user_id, project_id\)/);
  assert.match(execSrc, /Sandbox\.connect\(session\.sandbox_id/);
  assert.match(execSrc, /socket\.create_connection/);
  assert.match(execSrc, /previewUrl = `https:\/\/\$\{sandbox\.getHost\(port\)\}`/);
  assert.match(handlersSrc, /studio-exec:/);
});

test('sandbox execution rejects unsafe paths', async () => {
  const { runExecution } = await import('../api/_lib/exec.js');
  for (const name of ['../outside', 'folder/$(whoami)', '/absolute']) {
    await assert.rejects(runExecution({ files: { [name]: 'x' }, command: 'echo ok' }), (err) => err.status === 400);
  }
});
