import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pairs } from '../scripts/generate-seo-pages.mjs';

const base = 'https://nexora-social-2026.vercel.app';
const pages = Object.values(pairs).flatMap((pair) => [pair.ar, pair.en]);
const read = (p) => readFileSync(p, 'utf8');
const file = (path) => path === '/' ? 'index.html' : `public${path}`;
const tag = (html, name, attribute, value) =>
  [...html.matchAll(new RegExp(`<${name}\\s+[^>]*>`, 'g'))].map(([s]) => s)
    .find((s) => new RegExp(`\\b${attribute}="${value}"`).test(s));
const attr = (html, attribute) => new RegExp(`\\b${attribute}="([^"]+)"`).exec(html)?.[1];
const htmlEsc = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const schema = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));

test('committed bilingual pages and sitemap match the single-source generator', () => {
  execFileSync(process.execPath, ['scripts/generate-seo-pages.mjs', '--check']);
});

test('all 12 public pages have self-canonicals, distinct metadata, headings and reciprocal hreflang', () => {
  assert.equal(pages.length, 12);
  const titles = new Set();
  const descriptions = new Set();
  for (const [key, pair] of Object.entries(pairs)) {
    for (const [lang, path] of Object.entries(pair)) {
      const html = read(file(path));
      const head = html.split('</head>')[0];
      const title = /<title>([^<]+)<\/title>/.exec(head)?.[1];
      const description = attr(tag(head, 'meta', 'name', 'description'), 'content');
      assert.ok(title && description && (path === '/' ? title === '%APP_TITLE%' : title.includes('NEXORA AI')), `${path}: title/description`);
      assert.ok(!titles.has(title), `${path}: repeated title`);
      assert.ok(!descriptions.has(description), `${path}: repeated description`);
      titles.add(title); descriptions.add(description);
      assert.match(html, new RegExp(`<html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}">`));
      assert.equal(attr(tag(head, 'link', 'rel', 'canonical'), 'href'), base + path, `${path}: canonical`);
      for (const [language, target] of Object.entries({ ar: pair.ar, en: pair.en, 'x-default': pair.en })) {
        assert.equal(attr(tag(head, 'link', 'hreflang', language), 'href'), base + target, `${path}: hreflang ${language}`);
      }
      assert.equal(attr(tag(head, 'meta', 'property', 'og:url'), 'content'), base + path, `${path}: og:url`);
      assert.equal(attr(tag(head, 'meta', 'name', 'twitter:card'), 'content'), 'summary_large_image');
      assert.equal(attr(tag(head, 'meta', 'name', 'robots'), 'content')?.includes('index'), true);
      assert.ok(!head.includes('noindex'), `${path}: must be indexable`);
      assert.equal((html.match(/<h1\b/g) || []).length, 1, `${path}: one H1`);
      assert.ok((html.match(/<h2\b/g) || []).length >= 1, `${path}: H2 content`);
      assert.ok(schema(head).length > 0, `${path}: structured data`);
      if (key === 'features' || key === 'faq') assert.ok((html.match(/<h3\b/g) || []).length >= 1, `${path}: H3 content`);
      if (path !== '/') assert.ok(!html.includes('src="/src/main.jsx"'), `${path}: no app bundle on content pages`);
    }
  }
});

test('FAQ answers are real visible copy; other pages never advertise FAQPage without visible answers', () => {
  for (const path of pages) {
    const html = read(file(path));
    const objects = schema(html).flatMap((s) => s['@graph'] || [s]);
    const faq = objects.find((item) => item['@type'] === 'FAQPage');
    if (path.endsWith('/faq.html') || path === '/faq.html') {
      assert.ok(faq?.mainEntity?.length >= 5, path);
      for (const question of faq.mainEntity) {
        assert.ok(html.includes(`<h3>${htmlEsc(question.name)}</h3>`), `${path}: missing visible question`);
        assert.ok(html.includes(`<p>${htmlEsc(question.acceptedAnswer.text)}</p>`), `${path}: missing visible answer`);
      }
    } else assert.equal(faq, undefined, `${path}: FAQ schema is reserved for visible FAQ pages`);
  }
});

test('sitemap includes only canonical public URLs, with valid localized alternate links', () => {
  const sitemap = read('public/sitemap.xml');
  assert.equal(sitemap, read('public/sitemap-webapp.xml'));
  const urls = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)];
  assert.equal(urls.length, pages.length);
  assert.deepEqual(new Set(urls.map(([, block]) => /<loc>([^<]+)<\/loc>/.exec(block)?.[1])), new Set(pages.map((path) => base + path)));
  for (const [, block] of urls) {
    const path = new URL(/<loc>([^<]+)<\/loc>/.exec(block)?.[1]).pathname;
    const pair = Object.values(pairs).find((p) => p.ar === path || p.en === path);
    assert.ok(pair, path);
    for (const [lang, p] of Object.entries({ ...pair, 'x-default': pair.en })) {
      assert.ok(block.includes(`hreflang="${lang}" href="${base + p}"`), `${path}: ${lang}`);
    }
    assert.match(block, /<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
  }
  assert.doesNotMatch(sitemap, /Nexora\.apk|\/api\//);
  assert.match(read('public/robots.txt'), /Sitemap: https:\/\/nexora-social-2026\.vercel\.app\/sitemap\.xml/);
  assert.equal(read('public/robots.txt'), read('public/robots-webapp.txt'));
  assert.doesNotMatch(read('public/robots.txt'), /Disallow: \/$/m);
});

test('public links and referenced images/styles resolve to local assets', () => {
  for (const path of pages) {
    const html = read(file(path));
    for (const [, target] of html.matchAll(/(?:href|src)="(\/[^"#?]+)(?:[?#][^"]*)?"/g)) {
      assert.ok(existsSync(target === '/src/main.jsx' ? 'src/main.jsx' : file(target)), `${path} -> ${target} is broken`);
    }
    assert.equal(attr(tag(html, 'meta', 'property', 'og:image'), 'content'), `${base}/og-image.jpg`);
  }
  assert.ok(existsSync('public/download/Nexora.apk'));
  const info = read('src/ai/PublicInfo.jsx');
  for (const [, target] of info.matchAll(/href="(\/[^"#?]+)"/g)) assert.ok(existsSync(file(target)), `app public intro -> ${target}`);
});

test('Vercel keeps API/download behavior, normalizes friendly URLs and avoids indexing API responses', () => {
  const config = JSON.parse(read('vercel.json'));
  assert.equal(config.outputDirectory, 'dist');
  assert.equal(config.rewrites.find((r) => r.source === '/api/:path*')?.destination, '/api/index?__p=:path*');
  for (const redirect of config.redirects) {
    assert.ok(redirect.permanent, redirect.source);
    assert.ok(existsSync(file(redirect.destination)), redirect.destination);
  }
  const api = config.headers.find((h) => h.source === '/api/(.*)');
  const apk = config.headers.find((h) => h.source === '/download/(.*)');
  assert.ok(api?.headers?.some((h) => h.key === 'X-Robots-Tag' && h.value.includes('noindex')));
  assert.ok(apk?.headers?.some((h) => h.key === 'Content-Disposition' && h.value === 'attachment'));
  assert.ok(apk?.headers?.some((h) => h.key === 'X-Robots-Tag' && h.value === 'noindex'));
});

test('small web images replace oversized originals without deleting native/icon assets', () => {
  const sizes = ['mascot.png', 'mascot-ui.webp', 'mascot-avatar.png', 'mascot-avatar.webp', 'og-image.png', 'og-image.jpg']
    .map((name) => statSync(`public/${name}`).size);
  assert.ok(sizes[1] < sizes[0] * 0.15, 'hero image optimized');
  assert.ok(sizes[3] < sizes[2] * 0.15, 'chat avatar optimized');
  assert.ok(sizes[5] < sizes[4] * 0.3, 'social image optimized');
  assert.ok(statSync('public/seo.css').size < 10_000, 'public pages use a small stylesheet');
  assert.doesNotMatch(read('index.html'), /pagead2\.googlesyndication\.com/); // deferred until authenticated slot
  assert.match(read('src/ai/AdSlot.jsx'), /adsbygoogle\.js/); // the real ads still work
});

test('production build, when present, ships every static page and substitutes the app version', () => {
  if (!existsSync('dist/index.html')) return;
  const html = read('dist/index.html');
  const version = JSON.parse(read('package.json')).version;
  assert.ok(html.includes(`"softwareVersion":"${version}"`));
  assert.ok(!html.includes('%APP_TITLE%'));
  for (const path of pages.filter((p) => p !== '/')) {
    assert.ok(existsSync(`dist${path}`), `missing dist${path}`);
    assert.equal(read(`dist${path}`), read(file(path)), `dist${path} changed unexpectedly`);
  }
  assert.ok(existsSync('dist/robots.txt') && existsSync('dist/sitemap.xml'));
});
