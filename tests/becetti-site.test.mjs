import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { BECETTI_LANGUAGES } from '../shared/becetti-catalog.js';
import { execFileSync } from 'node:child_process';

const read = (path) => readFileSync(path, 'utf8');
const pages = ['index.html', 'about.html', 'products.html', 'ai.html', 'game.html', 'business.html', 'security.html', 'tools.html', 'contact.html', 'privacy.html', 'terms.html'];
const canonicalBase = 'https://nexora-social-2026.vercel.app/becetti';
const pagePath = (lang, page) => `${canonicalBase}/${lang === 'ar' ? '' : `${lang}/`}${page}`;
const attr = (tag, name) => new RegExp(`\\b${name}="([^"]+)"`).exec(tag)?.[1];
const byTag = (html, tag, attribute, value) => [...html.matchAll(new RegExp(`<${tag}\\s+[^>]*>`, 'g'))].map(([line]) => line).find((line) => new RegExp(`\\b${attribute}="${value}"`).test(line));
const htmlPath = (lang, page) => `becetti/${lang === 'ar' ? '' : `${lang}/`}${page}`;

test('generated BECETTI copy stays reproducible from the catalogue source', () => {
  execFileSync(process.execPath, ['scripts/generate-becetti-site.mjs', '--check']);
});

test('all requested public pages are pre-rendered in Arabic, English and French with localized SEO', () => {
  for (const lang of BECETTI_LANGUAGES) {
    const titles = new Set();
    for (const page of pages) {
    const html = read(htmlPath(lang, page));
    const title = /<title>([^<]+)<\/title>/.exec(html)?.[1];
    assert.ok(title, `${lang}/${page}: title`);
    assert.ok(!titles.has(title), `${lang}/${page}: repeated title`);
    titles.add(title);
    assert.match(html, new RegExp(`<html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}">`));
    assert.equal(attr(byTag(html, 'link', 'rel', 'canonical'), 'href'), pagePath(lang, page));
    for (const alternate of BECETTI_LANGUAGES) {
      assert.equal(attr(byTag(html, 'link', 'hreflang', alternate), 'href'), pagePath(alternate, page), `${lang}/${page}: ${alternate}`);
    }
    assert.equal((html.match(/<h1\b/g) || []).length, 1, `${lang}/${page}: one H1`);
    assert.ok(html.includes('Technology that works.'), `${lang}/${page}: BECETTI slogan`);
    assert.ok(html.includes('application/ld+json'), `${lang}/${page}: structured metadata`);
    assert.equal((html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || []).length, 1);
    }
  }
});

test('only verified NEXORA AI appears under Android and Windows, with official web links and no fabricated store listings', () => {
  const home = read('becetti/index.html');
  const ai = read('becetti/ai.html');
  const products = read('becetti/products.html');
  assert.match(home, /data-product-id="nexora-ai"/);
  assert.match(ai, /NEXORA AI/);
  for (const [platform, appLink] of [
    ['android', 'https://nexora-social-2026.vercel.app/download/Nexora.apk'],
    ['windows', 'https://nexora-social-2026.vercel.app/windows/index.html'],
  ]) {
    const section = new RegExp(`<section\\b(?=[^>]*id="${platform}-apps")[^>]*>([\\s\\S]*?)<\\/section>`).exec(products)?.[1] || '';
    assert.ok(section, `${platform} section is present`);
    assert.match(section, /data-product-id="nexora-ai"/);
    assert.ok(section.includes('href="https://nexora-social-2026.vercel.app/"'), `${platform} project website link`);
    assert.ok(section.includes(appLink), `${platform} app link`);
  }
  assert.match(products, /id="android-apps"/);
  assert.match(products, /id="windows-apps"/);
  assert.doesNotMatch(products, /href="[^"]+"[^>]*>Google Play/);
  assert.doesNotMatch(products, /href="[^"]+"[^>]*>Microsoft Store/);
  for (const page of ['game', 'business', 'security', 'tools']) {
    const html = read(`becetti/${page}.html`);
    assert.match(html, /No published|لا توجد|Aucun/);
    assert.doesNotMatch(html, /data-product-id="nexora-ai"/);
  }
});

test('the BECETTI landing page follows browser language preferences and falls back consistently to Arabic', () => {
  const arabicHome = read('becetti/index.html');
  const scriptStart = arabicHome.indexOf('<script data-becetti-language-redirect>') + '<script data-becetti-language-redirect>'.length;
  const scriptEnd = arabicHome.indexOf('</script>', scriptStart);
  const code = scriptEnd >= 0 ? arabicHome.slice(scriptStart, scriptEnd) : '';
  assert.ok(code, 'automatic device-language redirect is installed on the Arabic entry page');
  const redirectFor = (languages, { pathname = '/becetti/', search = '?campaign=test', hash = '#products', manualLanguage = '' } = {}) => {
    let destination = '';
    vm.runInNewContext(code, {
      location: { pathname, search, hash, replace: (target) => { destination = target; } },
      navigator: { languages, language: languages?.[0] || '' },
      sessionStorage: { getItem: () => manualLanguage },
    });
    return destination;
  };
  assert.equal(redirectFor(['en-US', 'ar-DZ']), '/becetti/en/index.html?campaign=test#products');
  assert.equal(redirectFor(['fr-CA']), '/becetti/fr/index.html?campaign=test#products');
  assert.equal(redirectFor(['en-US'], { pathname: '/becetti/products.html' }), '/becetti/en/products.html?campaign=test#products');
  assert.equal(redirectFor(['fr-FR'], { pathname: '/becetti/about.html' }), '/becetti/fr/about.html?campaign=test#products');
  assert.equal(redirectFor(['es-ES', 'ar-DZ']), '');
  assert.equal(redirectFor(['es-ES']), '');
  assert.equal(redirectFor(['en-US'], { manualLanguage: 'ar' }), '');
  assert.equal(redirectFor(['en-US'], { manualLanguage: 'fr', pathname: '/becetti/products.html' }), '/becetti/fr/products.html?campaign=test#products');
  assert.match(arabicHome, /data-becetti-language="en"/);
  assert.doesNotMatch(read('becetti/en/index.html'), /data-becetti-language-redirect/);
  assert.doesNotMatch(read('becetti/fr/index.html'), /data-becetti-language-redirect/);
});

test('BECETTI admin page is no-index and admin/write APIs stay outside the public directory', () => {
  const admin = read('becetti/admin.html');
  assert.match(admin, /name="robots" content="noindex, nofollow"/);
  assert.match(admin, /data-admin-root/);
  assert.match(admin, /وصول مقيّد/);
  const sitemap = read('public/becetti-sitemap.xml');
  assert.equal((sitemap.match(/<url>/g) || []).length, 33);
  assert.doesNotMatch(sitemap, /admin\.html/);
});

test('BECETTI pages use the configured API base and keep server credentials out of browser code', () => {
  const client = read('src/becetti/main.js');
  assert.match(client, /const API_BASE = \(import\.meta\.env\.VITE_API_BASE \|\| ''\)/);
  assert.match(client, /fetch\(`\$\{API_BASE\}\/api\/becetti\/catalog`/);
  assert.match(client, /fetch\(`\$\{API_BASE\}\/api\/\$\{path\}`/);
  assert.match(client, /Authorization: `Bearer \$\{accessToken\}`/);
  assert.doesNotMatch(client, /BLOB_READ_WRITE_TOKEN|DATABASE_URL|JWT_SECRET/);
});
