/**
 * الصفحة الرئيسية بعد الترطيب يجب أن تبقى صفحة فهرسة حقيقية.
 *
 * المشكلة التي يحرسها هذا الملف: كان index.html يحمل نصًا عربيًا طويلًا داخل
 * <div id="root"> (نسخة تعمل بلا JavaScript)، لكن React يستبدل ذلك كله. بعد
 * الترطيب كان الزائر غير المسجّل يرى نموذج دخول فقط، فتصبح صفحة الجذر — أهم
 * رابط في خريطة الموقع — بلا عنوان h1 ولا محتوى ولا روابط داخلية. غوغل يفهرس
 * DOM بعد التنفيذ، لذلك تظهر الصفحات «جيدة ثم تختفي» من النتائج.
 *
 * الاختبارات هنا تبني التطبيق فعليًا في jsdom بحساب غير مسجّل وتتحقق من أن
 * المحتوى العام يبقى، ومن أن النسخة الساكنة والمُرطَّبة لا تتباعدان.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { build } from 'esbuild';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const read = (p) => readFileSync(p, 'utf8');

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

/** jsdom + الحدود العامة التي تحتاجها React وAIPlatform. */
function installDom(url = 'http://localhost:5173/') {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url,
    pretendToBeVisual: true,
  });
  const { window } = dom;
  globalThis.window = window;
  globalThis.document = window.document;
  Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
  for (const name of ['HTMLElement', 'Element', 'Node', 'Event', 'KeyboardEvent', 'MouseEvent', 'CustomEvent',
    'Window', 'HTMLTextAreaElement', 'HTMLIFrameElement', 'Document', 'HTMLCollection', 'NodeList', 'Range',
    'Text', 'DOMParser', 'FileReader', 'File', 'Blob', 'Image']) {
    globalThis[name] = window[name];
  }
  globalThis.getComputedStyle = window.getComputedStyle.bind(window);
  globalThis.MutationObserver = window.MutationObserver;
  globalThis.DOMRect = window.DOMRect || class { constructor() { this.top = 0; this.left = 0; this.bottom = 0; this.right = 0; this.width = 0; this.height = 0; } };
  globalThis.getSelection = () => window.getSelection();
  globalThis.requestIdleCallback = (cb) => setTimeout(() => cb({ timeRemaining: () => 8, didTimeout: false }), 1);
  window.requestIdleCallback = globalThis.requestIdleCallback;
  window.document.elementFromPoint = () => null;
  window.document.execCommand = () => true;
  globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  Object.defineProperty(globalThis, 'localStorage', { value: window.localStorage, configurable: true });
  Object.defineProperty(window, 'localStorage', { value: window.localStorage, configurable: true });
  window.matchMedia = window.matchMedia || (() => ({
    matches: false, media: '', addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
  }));
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.scrollTo = () => {};
  const rect = () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 600, height: 20, x: 0, y: 0, toJSON() { return this; } });
  if (window.Range) {
    window.Range.prototype.getClientRects = () => ({ length: 0, item: () => null, *[Symbol.iterator]() {} });
    window.Range.prototype.getBoundingClientRect = rect;
  }
  if (window.Element) window.Element.prototype.getBoundingClientRect = rect;
  if (window.Text) window.Text.prototype.getBoundingClientRect = rect;
  window.confirm = () => true;
  window.open = () => null;
  return window;
}

/** كل نداءات /api تفشل كزائر غير مسجّل — وهو ما يراه Googlebot. */
function installAnonymousFetch() {
  const calls = [];
  globalThis.fetch = async (input) => {
    const url = String(typeof input === 'string' ? input : input.url);
    calls.push(url);
    if (url.includes('/api/studio/session')) {
      return jsonResponse({ authenticated: false, user: null, storage: { ok: true, driver: 'sqlite' } });
    }
    if (url.includes('/api/')) {
      const err = new Error('unauthorized');
      err.status = 401;
      return jsonResponse({ error: 'unauthorized' }, 401);
    }
    return jsonResponse({});
  };
  return calls;
}

async function bundle(entry, exports) {
  const dir = join(process.cwd(), '.nexora', 'test-bundle');
  const outfile = join(dir, `homepage-${entry.replaceAll('/', '-')}.mjs`);
  await build({
    stdin: { contents: `export { ${exports} } from './${entry}';`, resolveDir: process.cwd(), loader: 'js' },
    bundle: true,
    format: 'esm',
    platform: 'browser',
    jsx: 'automatic',
    external: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime'],
    target: ['es2020'],
    outfile,
    loader: { '.css': 'empty' },
    define: {
      'process.env.NODE_ENV': '"development"',
      'import.meta.env.BASE_URL': '"/"',
      'import.meta.env.VITE_API_BASE': '""',
      'import.meta.env.VITE_WEB_URL': '"http://localhost"',
      'import.meta.env.VITE_APP_VERSION': '"test"',
      'import.meta.env.VITE_BUILD_ID': '"test"',
    },
    logLevel: 'error',
  });
  return import(pathToFileURL(outfile).href);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, timeout = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (fn()) return true;
    await wait(40);
  }
  return false;
}

const headings = (container) => [...container.querySelectorAll('h2')].map((h) => h.textContent.trim());

test('الزائر غير المسجّل يرى محتوى الصفحة الرئيسية بعد الترطيب، لا نموذج دخول فقط', async () => {
  installDom();
  installAnonymousFetch();
  const { StudioApp } = await bundle('src/studio/StudioApp.jsx', 'default as StudioApp');
  const React = await import('react');
  const { createRoot } = await import('react-dom/client');

  const root = createRoot(document.getElementById('root'));
  try {
    root.render(React.createElement(StudioApp));

    assert.ok(await until(() => document.querySelector('.nxs-auth-card')), 'نموذج الدخول يظهر');
    assert.ok(await until(() => document.querySelector('.nx-ai-public')), 'المحتوى العام يركب مع نموذج الدخول');

    const main = document.querySelector('.nx-ai-public');
    assert.equal(document.querySelectorAll('h1').length, 1, 'عنوان h1 واحد فقط في الصفحة الرئيسية');
    assert.ok(headings(main).length >= 5, 'الصفحة المرئية تحتفظ بأقسام h2 الحقيقية');

    /* روابط داخلية حقيقية إلى بقية الصفحات المفهرسة */
    const hrefs = new Set([...main.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')));
    for (const page of ['/about.html', '/features.html', '/download.html', '/faq.html', '/privacy.html', '/en.html']) {
      assert.ok(hrefs.has(page), `الصفحة الرئيسية المرئية تربط ${page}`);
    }

    const words = (main.textContent || '').trim().split(/\s+/).length;
    assert.ok(words >= 150, `نص كافٍ للفهرسة (${words} كلمة)`);
  } finally {
    root.unmount();
  }
});

test('النسخة الساكنة في index.html والنسخة المُرطَّبة تتفقان على المحتوى والروابط', async () => {
  const staticHeadings = [...read('index.html').matchAll(/<h2>([^<]+)<\/h2>/g)].map((m) => m[1].trim());
  installDom();
  installAnonymousFetch();
  const { StudioApp } = await bundle('src/studio/StudioApp.jsx', 'default as StudioApp');
  const React = await import('react');
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(document.getElementById('root'));
  try {
    root.render(React.createElement(StudioApp));
    assert.ok(await until(() => document.querySelector('.nx-ai-public')), 'المحتوى العام يركب');

    const rendered = headings(document.querySelector('.nx-ai-public'));
    for (const heading of staticHeadings) {
      assert.ok(rendered.includes(heading), `قسم «${heading}» مفقود بعد الترطيب`);
    }
  } finally {
    root.unmount();
  }
});

test('خريطة الموقع المُولَّدة صالحة للقراءة الآلية: XML سليم، رؤوس صحيحة، ولا مسارات ميتة', () => {
  const sitemap = read('public/sitemap.xml');
  const robots = read('public/robots.txt');

  assert.match(sitemap, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.equal((sitemap.match(/<url>/g) || []).length, 12);
  assert.equal((sitemap.match(/<loc>/g) || []).length, 12);
  assert.ok(!/[^\u0000-\u007F]/.test(sitemap.split('<lastmod>')[0] || ''), 'ترويسة خريطة الموقع ASCII');

  /* كل رابط في الخريطة له ملف فعلي في المخرجات، وإلا صار «Couldn't fetch» */
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  for (const path of locs) {
    const target = path === '/' ? 'index.html' : `public${path}`;
    assert.ok(existsSync(target), `${path} مُدرج في الخريطة لكن ${target} غير موجود`);
  }

  /* robots يعلن الخريطة نفسها التي نخدمها فعلًا */
  assert.match(robots, new RegExp(`^Sitemap: https://nexora-social-2026\\.vercel\\.app/sitemap\\.xml$`, 'm'));
  assert.doesNotMatch(robots, /Disallow: \/$/m, 'لا يجوز منع الزحف إلى الجذر');
});

test('مكوّنات الموقع العامة لا تختفي على الويب ولا تظهر داخل تطبيق أندرويد', () => {
  const studio = read('src/studio/StudioApp.jsx');
  const ai = read('src/ai/AIPlatform.jsx');
  const css = read('src/studio/studio.css');

  /* المحتوى العام يركب على الويب فقط — التطبيق الأصلي يبقى كما هو */
  assert.match(studio, /import PublicInfo from '\.\.\/ai\/PublicInfo\.jsx';/);
  assert.match(studio, /\{showPublicContent && <PublicInfo \/>\}/);
  assert.match(studio, /const showPublicContent = !isCapacitorNative\(\);/);
  assert.match(ai, /\{showPublic && <PublicInfo\/>\}/);

  /* الغلاف يسمح بالتمرير، فالمحتوى تحت نموذج الدخول ليس محصورًا خارج الشاشة */
  assert.match(css, /\.nxs-auth-wrap\s*\{[^}]*overflow-y:\s*auto/);
});

test('الملفات العامة لا تحمل تاريخ فهرسة أقدم من صفحاتها', () => {
  const sitemap = read('public/sitemap.xml');
  const index = read('index.html');
  const stamp = /<lastmod>(\d{4}-\d{2}-\d{2})<\/lastmod>/.exec(sitemap)?.[1];
  assert.ok(stamp, 'خريطة الموقع تحمل lastmod');
  assert.ok(index.includes(`"dateModified":"${stamp}"`), 'index.html يحمل نفس تاريخ خريطة الموقع');
  assert.ok(index.includes(`<time datetime="${stamp}">`), 'تاريخ التحديث الظاهر يطابق الخريطة');
  assert.ok(!/2026-11-1[0-8]/.test(index), 'لا تاريخ فهرسة قديم في الصفحة الرئيسية');
});

test('لا أثر لملفات موقع محذوفة في robots أو الخريطة (404 = فشل زحف)', () => {
  const robots = read('public/robots.txt');
  const sitemap = read('public/sitemap.xml');
  for (const dead of ['/becetti', 'sitemap-becetti', 'becetti-sitemap']) {
    assert.ok(!robots.includes(dead), `robots يشير إلى ${dead} المحذوف`);
    assert.ok(!sitemap.includes(dead), `الخريطة تشير إلى ${dead} المحذوف`);
  }
  /* أي ملف sitemap مذكور في robots يجب أن يكون موجودًا فعلًا */
  for (const [, name] of robots.matchAll(/^Sitemap: \S*\/([^/\s]+)$/gm)) {
    assert.ok(readdirSync('public').includes(name), `robots يعلن ${name} وهو غير موجود في public/`);
  }
});
