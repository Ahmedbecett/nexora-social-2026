/**
 * سلامة الروابط: لا رابط داخلي مكسور، ولا مسار قديم يعطي 404.
 *
 * خلفية: تقرير Search Console («Discovered – currently not indexed») عرض مسارات
 * قديمة مثل /blog/apk و/use/chat و/use/voice لم تكن موجودة في الموقع، فكانت
 * ترجع 404 وتستهلك ميزانية الزحف. هذه الاختبارات تمنع تكرار ذلك:
 *
 *   1) كل href/src داخلي في الصفحات المنشورة يشير إلى ملف موجود فعلًا.
 *   2) كل مرساة (#fragment) داخلية — في نفس الصفحة أو عبر صفحة أخرى — لها هدف.
 *   3) لا يوجد id مكرَّر في أي صفحة (كان يكسر رابط «تخطَّ إلى المحتوى»).
 *   4) vercel.json يوجّه المسارات القديمة (blog/use/…) بـ 301 إلى صفحات حقيقية،
 *      وكل هدف توجيه داخلي موجود.
 *   5) كل رابط في خريطة الموقع له ملف مقابل، والعكس: كل صفحة قابلة للفهرسة
 *      مذكورة في الخريطة.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pairs } from '../scripts/generate-seo-pages.mjs';

const read = (p) => readFileSync(p, 'utf8');
const vercel = JSON.parse(read('vercel.json'));

/** الصفحات المنشورة فعليًا في الجذر وفي public/ — مع مسارها في الـ URL. */
const pages = () => {
  const list = new Map([['/', 'index.html']]);
  for (const file of readdirSync('public')) {
    if (file.endsWith('.html')) list.set(`/${file}`, `public/${file}`);
  }
  for (const file of readdirSync('public/en')) {
    if (file.endsWith('.html')) list.set(`/en/${file}`, `public/en/${file}`);
  }
  return list;
};

/** مسار URL → ملف على القرص، أو null إذا لم يوجد. */
const toFile = (url) => {
  const clean = url.replace(/[?#].*$/, '');
  if (!clean || clean === '/') return existsSync('index.html') ? 'index.html' : null;
  const target = clean.startsWith('/') ? `public${clean}` : resolve(dirname('index.html'), clean);
  return existsSync(target) ? target : null;
};

/** أنماط Vercel (:path* و :slug) → تعبير نمطي. */
const toRegex = (source) =>
  new RegExp(`^${source.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/:[a-zA-Z]+\*/g, '.*').replace(/:[a-zA-Z]+/g, '[^/]+')}$`);

const matchRule = (rules, path) => rules.find((rule) => toRegex(rule.source).test(path));

const ids = (html) => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));

const internalTargets = (html) =>
  [...html.matchAll(/(?:href|src)="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((url) => !/^(?:[a-z]+:|\/\/|#|data:|javascript:)/i.test(url));

test('لا رابط داخلي مكسور في الصفحات المنشورة', () => {
  const broken = [];
  for (const [url, file] of pages()) {
    for (const target of internalTargets(read(file))) {
      if (target === '/src/main.jsx') continue; // نقطة دخول Vite، تُحلّ وقت البناء
      if (!toFile(target.startsWith('/') ? target : new URL(target, `https://x${url}`).pathname)) {
        broken.push(`${file} → ${target}`);
      }
    }
  }
  assert.deepEqual(broken, [], `روابط داخلية مكسورة:\n${broken.join('\n')}`);
});

test('كل مرساة داخلية لها هدف موجود', () => {
  const broken = [];
  for (const [url, file] of pages()) {
    const html = read(file);
    for (const [, target] of html.matchAll(/href="([^"]*#[^"]*)"/g)) {
      if (/^https?:/i.test(target)) continue; // إلى موقع آخر
      const [path, fragment] = target.startsWith('#') ? [url, target.slice(1)] : target.split('#');
      const pageFile = path.startsWith('/') ? toFile(path) : toFile(new URL(path, `https://x${url}`).pathname);
      if (!pageFile || !ids(read(pageFile)).has(fragment)) broken.push(`${file} → ${target}`);
    }
  }
  assert.deepEqual(broken, [], `مراسٍ مكسورة:\n${broken.join('\n')}`);
});

test('لا يوجد id مكرَّر في أي صفحة', () => {
  for (const [, file] of pages()) {
    const all = [...read(file).matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    const duplicates = all.filter((id, i) => all.indexOf(id) !== i);
    assert.deepEqual([...new Set(duplicates)], [], `${file}: ids مكرّرة`);
  }
});

test('مسارات Search Console القديمة كلها تُوجَّه بـ 301 إلى صفحات موجودة', () => {
  // القائمة الحرفية من تقرير «Discovered – currently not indexed».
  const legacy = [
    '/blog/apk',
    '/blog/earn',
    '/blog/merchants',
    '/blog/students',
    '/use/chat',
    '/use/code',
    '/use/image',
    '/use/translate',
    '/use/voice',
  ];
  for (const path of legacy) {
    const rule = matchRule(vercel.redirects, path);
    assert.ok(rule, `${path}: لا يوجد توجيه — سيعود 404 ويستهلك ميزانية الزحف`);
    assert.equal(rule.permanent, true, `${path}: يجب أن يكون توجيهًا دائمًا (301)`);
    assert.ok(toFile(rule.destination), `${path} → ${rule.destination}: الهدف غير موجود`);
  }
  // النسخ الإنجليزية والجذر أيضًا.
  for (const path of ['/blog', '/use', '/en/blog', '/en/use', '/en/blog/apk', '/en/use/chat']) {
    assert.ok(matchRule(vercel.redirects, path), `${path}: لا يوجد توجيه`);
  }
});

test('كل توجيه داخلي في vercel.json يشير إلى صفحة موجودة ولمرة واحدة', () => {
  const seen = new Set();
  for (const rule of vercel.redirects) {
    assert.ok(!seen.has(rule.source), `${rule.source}: توجيه مكرَّر`);
    seen.add(rule.source);
    assert.equal(rule.permanent, true, `${rule.source}: توجيه غير دائم`);
    if (/^https?:/.test(rule.destination)) continue;
    assert.ok(toFile(rule.destination), `${rule.source} → ${rule.destination}: الهدف غير موجود`);
    assert.ok(!matchRule(vercel.redirects.filter((r) => r !== rule), rule.destination), `${rule.source}: يوجّه إلى مسار مُوجَّه أصلًا`);
  }
});

test('خريطة الموقع تطابق الملفات المنشورة في الاتجاهين', () => {
  const sitemap = read('public/sitemap.xml');
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname.replace(/\/$/, '/'));
  assert.equal(locs.length, 12, 'خريطة الموقع يجب أن تحمل 12 رابطًا (6 صفحات × لغتين)');
  assert.equal(new Set(locs).size, locs.length, 'روابط مكرّرة في الخريطة');
  for (const loc of locs) assert.ok(toFile(loc), `${loc}: في الخريطة بلا ملف`);

  for (const [, file] of pages()) {
    if (/google[0-9a-f]+\.html$/.test(file)) continue; // ملف تحقّق Google
    const url = file === 'index.html' ? '/' : `/${file.replace(/^public\//, '')}`;
    assert.ok(locs.includes(url), `${url}: صفحة منشورة غير مذكورة في الخريطة`);
  }
});

test('أيقونات manifest موجودة', () => {
  const manifest = JSON.parse(read('public/manifest.webmanifest'));
  for (const icon of manifest.icons || []) {
    assert.ok(existsSync(`public${icon.src.replace(/^\//, '/')}`), `أيقونة مفقودة: ${icon.src}`);
  }
  for (const [, file] of pages()) {
    for (const [, href] of read(file).matchAll(/<link rel="(?:icon|apple-touch-icon|manifest)"[^>]*href="([^"]+)"/g)) {
      assert.ok(toFile(href), `${file}: مرجع مفقود ${href}`);
    }
  }
});

test('index.html بلا وسوم meta مكرّرة', () => {
  const head = read('index.html').split('</head>')[0];
  const keys = [...head.matchAll(/<meta\s+(name|property)="([^"]+)"/g)].map((m) => `${m[1]}:${m[2]}`);
  const duplicates = [...new Set(keys.filter((key, i) => keys.indexOf(key) !== i))];
  assert.deepEqual(duplicates, [], `وسوم meta مكرّرة في index.html: ${duplicates.join(', ')}`);
});

test('نص الصفحة الرئيسية الظاهر بعد الترطيب يطابق النسخة الساكنة', () => {
  // غوغل يفهرس DOM بعد تنفيذ React ويسقط HTML الأولي، فلا يجوز أن تكون النسخة
  // المرئية أضعف من النسخة الساكنة (كانت 124 كلمة مقابل 300 في النسخة الإنجليزية).
  const staticHeads = [...read('index.html').matchAll(/<h2>([^<]+)<\/h2>/g)].map((m) => m[1].trim());
  const info = read('src/ai/PublicInfo.jsx');
  const renderedHeads = [...info.matchAll(/<h2[^>]*>([^<]+)<\/h2>/g)].map((m) => m[1].trim());
  assert.ok(staticHeads.length >= 5, 'الصفحة الرئيسية الساكنة تحتاج أقسام h2 حقيقية');
  for (const heading of staticHeads) {
    assert.ok(renderedHeads.includes(heading), `قسم «${heading}» موجود في HTML الساكن دون النسخة المُرطَّبة`);
  }
  for (const page of ['/about.html', '/features.html', '/download.html', '/faq.html', '/privacy.html']) {
    assert.ok(read('index.html').includes(`href="${page}"`), `الصفحة الرئيسية لا تربط ${page}`);
    assert.ok(info.includes(`href="${page}"`), `نسخة React لا تربط ${page}`);
  }
});
