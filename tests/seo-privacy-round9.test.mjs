/**
 * الجولة التاسعة: تحسين صفحات الفهرسة وسياسة الخصوصية.
 *
 * ما تحميه هذه الاختبارات:
 *   1) صفحات الفهرسة الاثنتا عشرة تحمل بيانات منظمة كاملة (منظمة + موقع + صفحة
 *      + مسار تصفح + تاريخ تحديث)، وبصمة صور المشاركة، وتوجيهات زحف صريحة.
 *   2) سياسة الخصوصية صارت صفحة مُولَّدة من المصدر الواحد (لا تُحرَّر يدويًا)،
 *      وفيها فهرس داخلي تعمل روابطه كلها، والإفصاحات القانونية اللازمة:
 *      الأساس القانوني، المزوّدون، ملفات تعريف الارتباط، مدة الاحتفاظ، الحقوق،
 *      حذف الحساب، الأطفال، والنقل الدولي.
 *   3) النسختان العربية والإنجليزية متطابقتان في البنية (نفس الأقسام والفهرس).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pairs, LAST_UPDATED } from '../scripts/generate-seo-pages.mjs';

const base = 'https://nexora-social-2026.vercel.app';
const read = (p) => readFileSync(p, 'utf8');
const file = (path) => (path === '/' ? 'index.html' : `public${path}`);
const pages = Object.values(pairs).flatMap((pair) => [pair.ar, pair.en]);
const graph = (html) => {
  const script = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
  return JSON.parse(script[1])['@graph'];
};
const node = (html, type) => graph(html).find((item) => item['@type'] === type);
const sectionIds = (html) => [...html.matchAll(/<section id="([a-z-]+)"/g)].map((m) => m[1]);
const tocTargets = (html) => [...html.matchAll(/<li><a href="#([a-z-]+)"/g)].map((m) => m[1]);

const AR = 'public/privacy.html';
const EN = 'public/en/privacy.html';

test('كل صفحة فهرسة تحمل رسمًا بيانيًا كاملًا وبيانات مشاركة صحيحة', () => {
  for (const path of pages) {
    const html = read(file(path));
    const head = html.split('</head>')[0];
    const org = node(html, 'Organization');
    const site = node(html, 'WebSite');
    const page = node(html, 'WebPage') || node(html, 'FAQPage') || node(html, 'AboutPage');

    assert.equal(org['@id'], `${base}/#organization`, path);
    assert.ok(org.logo?.url === `${base}/icon-512.png`, `${path}: organization logo`);
    assert.equal(site['@id'], `${base}/#website`, path);
    assert.deepEqual(site.inLanguage, ['ar', 'en'], path);
    assert.equal(page.url, base + path, `${path}: page url`);
    assert.equal(page.dateModified, LAST_UPDATED.iso, `${path}: freshness`);
    assert.equal(page.publisher['@id'], `${base}/#organization`, `${path}: publisher`);
    assert.ok(page.primaryImageOfPage?.url === `${base}/og-image.jpg`, `${path}: primary image`);

    // مسار التصفح في الصفحات الداخلية، ومرجع التطبيق في الرئيسية
    if (path !== '/' && path !== '/en.html') {
      const crumbs = node(html, 'BreadcrumbList');
      assert.equal(crumbs['@id'], `${base}${path}#breadcrumb`, `${path}: breadcrumb id`);
      assert.equal(crumbs.itemListElement.length, 2, path);
    }
    if (path === '/' || path === '/en.html' || path.endsWith('/download.html') || path === '/download.html') {
      const app = graph(html).find((item) => item['@type'] === 'SoftwareApplication');
      assert.equal(app['@id'], `${base}/#app`, `${path}: app node`);
      assert.equal(app.operatingSystem, 'Web, Android', path);
    }

    // وسوم المشاركة والزحف
    assert.match(head, /<meta property="og:image:type" content="image\/jpeg" \/>/, `${path}: og:image:type`);
    assert.match(head, /<meta name="twitter:image:alt" content="[^"]+" \/>/, `${path}: twitter alt`);
    assert.match(head, /max-snippet:-1/, `${path}: snippet control`);
    assert.match(head, /<meta name="author" content="Ahmed Becetti" \/>/, `${path}: author`);
    assert.match(html, new RegExp(`<time datetime="${LAST_UPDATED.iso}">`), `${path}: visible update date`);
  }
});

test('سياسة الخصوصية: 17 قسمًا وفهرس داخلي تعمل كل روابطه في اللغتين', () => {
  for (const path of [AR, EN]) {
    const html = read(path);
    const ids = sectionIds(html);
    const targets = tocTargets(html);
    assert.ok(ids.length >= 17, `${path}: ${ids.length} sections`);
    assert.deepEqual(targets, ids, `${path}: TOC must list every section in order`);
    const single = new Set(ids);
    assert.equal(single.size, ids.length, `${path}: duplicate section ids`);
    for (const id of single) assert.match(html, new RegExp(`<section id="${id}">`), `${path}: ${id}`);
  }
});

test('سياسة الخصوصية تكشف المعالجة والمزوّدين والحقوق (عربي/إنجليزي)', () => {
  const ar = read(AR);
  const en = read(EN);

  // الأساس القانوني والحقوق والاحتفاظ
  for (const term of ['الأساس القانوني', 'حقوقك', 'مدة الاحتفاظ', 'ANPDP', '30 يومًا', '90 يومًا', 'النقل الدولي']) {
    assert.ok(ar.includes(term), `privacy ar missing: ${term}`);
  }
  for (const term of ['Legal bases', 'Your rights', 'How long we keep data', 'ANPDP', '30 days', '90 days', 'International transfers']) {
    assert.ok(en.includes(term), `privacy en missing: ${term}`);
  }

  // المزوّدون الفعليون المعالِجون للبيانات
  for (const provider of ['Vercel', 'Neon', 'Firebase', 'Brevo', 'OpenAI', 'Gemini', 'PayPal']) {
    assert.ok(ar.includes(provider), `privacy ar provider: ${provider}`);
    assert.ok(en.includes(provider), `privacy en provider: ${provider}`);
  }

  // ملفات تعريف الارتباط والإعلانات والأطفال والحذف
  for (const term of ['nx_theme', 'Global Privacy Control', 'AdMob', 'UMP', '13']) assert.ok(ar.includes(term), term);
  for (const term of ['nx_theme', 'Global Privacy Control', 'AdMob', 'UMP', '13']) assert.ok(en.includes(term), term);
  assert.match(ar, /حذف حسابي وكل بياناتي نهائيًا/);
  assert.match(en, /Delete my account and all my data/);

  // لا ادعاء بحفظ بيانات البطاقات
  assert.match(ar, /لا نحفظ أرقام البطاقات/);
  assert.match(en, /never store card numbers/);

  // التاريخ الحالي فقط، ولا تاريخ قديم متبقٍ
  assert.ok(ar.includes(LAST_UPDATED.ar), 'السياسة العربية تحمل تاريخ التحديث الحالي');
  assert.ok(en.includes(LAST_UPDATED.en), 'السياسة الإنجليزية تحمل تاريخ التحديث الحالي');
  const year = LAST_UPDATED.iso.slice(0, 4);
  assert.doesNotMatch(ar, new RegExp(`(1[5-9]|2[0-2]) نوفمبر ${year}`), 'لا تاريخ قديم في السياسة العربية');
  assert.doesNotMatch(en, new RegExp(`(1[5-9]|2[0-2]) November ${year}`), 'لا تاريخ قديم في السياسة الإنجليزية');
});

test('سياسة الخصوصية ليست FAQPage ولا تتنكّر لبيانات وصفية مكرّرة', () => {
  for (const path of [AR, EN]) {
    const html = read(path);
    assert.equal(node(html, 'FAQPage'), undefined, path);
    assert.equal((html.match(/<h1\b/g) || []).length, 1, path);
    const page = node(html, 'WebPage');
    assert.equal(page.inLanguage, path === AR ? 'ar' : 'en', path);
    assert.ok(page.description && page.description.length > 80, `${path}: real description`);
  }
});

test('خريطة الموقع وrobots: تاريخ اليوم، منع الأصول الثنائية، وإتاحة كل الصفحات', () => {
  const sitemap = read('public/sitemap.xml');
  assert.equal((sitemap.match(/<url>/g) || []).length, 12);
  assert.equal((sitemap.match(new RegExp(`<lastmod>${LAST_UPDATED.iso}<\\/lastmod>`, 'g')) || []).length, 12);
  assert.doesNotMatch(sitemap, /<lastmod>2026-11-(0\d|1\d|2[0-3])<\/lastmod>/, 'لا تاريخ قديم في خريطة الموقع');

  const robots = read('public/robots.txt');
  assert.equal(robots, read('public/robots-webapp.txt'));
  assert.match(robots, /^Allow: \/$/m);
  assert.match(robots, /^Disallow: \/download\/$/m);
  assert.match(robots, /^Disallow: \/api\/$/m);
  assert.match(robots, /^Sitemap: https:\/\/nexora-social-2026\.vercel\.app\/sitemap\.xml$/m);
});

test('الأسئلة الشائعة: 10 أسئلة ظاهرة ومطابقة للبيانات المنظمة', () => {
  for (const [path, lang] of [[pairs.faq.ar, 'ar'], [pairs.faq.en, 'en']]) {
    const html = read(file(path));
    const faq = node(html, 'FAQPage');
    assert.equal(faq.mainEntity.length, 10, path);
    const questions = new Set(faq.mainEntity.map((item) => item.name));
    assert.equal(questions.size, 10, `${path}: duplicate questions`);
    for (const item of faq.mainEntity) {
      assert.ok(html.includes(`<h3>${item.name.replaceAll('&', '&amp;')}</h3>`), `${path}: visible question`);
    }
  }
});

test('الصفحة الرئيسية (index.html) تحمل نفس مستوى البيانات المنظمة والوسوم', () => {
  const html = read('index.html');
  const page = node(html, 'WebPage');
  assert.equal(page.dateModified, LAST_UPDATED.iso);
  assert.equal(page.publisher['@id'], `${base}/#organization`);
  const app = graph(html).find((item) => item['@type'] === 'SoftwareApplication');
  assert.equal(app.offers.price, '0');
  assert.ok(app.publisher['@id'] === `${base}/#organization`);
  assert.match(html, /max-snippet:-1/);
  assert.match(html, /<meta property="og:image:type" content="image\/jpeg" \/>/);
  // صفحة الهبوط بلا JavaScript يجب أن تصل إلى سياسة الخصوصية
  assert.match(html, /href="\/privacy.html">سياسة الخصوصية وملفات تعريف الارتباط<\/a>/);
});

test('السياسة مُولَّدة من المصدر الواحد (يمكن إعادة توليدها بلا فروق)', async () => {
  const { execFileSync } = await import('node:child_process');
  execFileSync(process.execPath, ['scripts/generate-seo-pages.mjs', '--check']);
});
