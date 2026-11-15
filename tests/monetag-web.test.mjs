import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { pairs } from '../scripts/generate-seo-pages.mjs';

const loader = readFileSync('public/monetag-web.js', 'utf8');
const tag = '<script src="/monetag-web.js" defer></script>';

function runLoader({ host = 'nexora-social-2026.vercel.app', protocol = 'https:', userAgent = '',
  capacitor = false, nativeClass = false, gpc = false, readyState = 'complete' } = {}) {
  const nodes = new Map();
  const listeners = new Map();
  const document = {
    readyState,
    documentElement: { classList: { contains: (name) => nativeClass && name === 'native' } },
    getElementById: (id) => nodes.get(id) || null,
    createElement: (element) => {
      assert.equal(element, 'script');
      return { dataset: {}, attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } };
    },
    head: { appendChild(node) { nodes.set(node.id, node); return node; } },
    addEventListener: (name, callback, options) => listeners.set(name, { callback, options }),
  };
  const context = {
    location: { hostname: host, protocol },
    navigator: { userAgent, globalPrivacyControl: gpc },
    window: { Capacitor: capacitor ? { isNativePlatform: () => true } : undefined },
    document,
  };
  const execute = () => runInNewContext(loader, context, { filename: 'monetag-web.js' });
  execute();
  return { nodes, listeners, execute };
}

test('every public HTML page (including sign-in and both privacy pages) loads the same web-only bootstrap', () => {
  const paths = Object.values(pairs).flatMap((pair) => [pair.ar, pair.en]);
  assert.equal(paths.length, 12);
  for (const path of paths) {
    const source = path === '/' ? 'index.html' : `public${path}`;
    const html = readFileSync(source, 'utf8');
    assert.equal(html.split('</head>')[0].split(tag).length - 1, 1, `${source}: one head bootstrap`);
    assert.ok(!html.includes('quge5.com'), `${source}: third-party JS must pass the native/preview guard`);
    if (existsSync('dist/index.html')) {
      const built = readFileSync(path === '/' ? 'dist/index.html' : `dist${path}`, 'utf8');
      assert.equal(built.split(tag).length - 1, 1, `dist${path}: bootstrap survives production build`);
    }
  }
  assert.ok(existsSync('public/monetag-web.js'));
  if (existsSync('dist/index.html')) assert.equal(readFileSync('dist/monetag-web.js', 'utf8'), loader);
});

test('production browser injects the exact owner-provided async zone once, after HTML parses', () => {
  const { nodes, listeners, execute } = runLoader({ readyState: 'loading' });
  assert.equal(nodes.size, 0);
  assert.equal(listeners.get('DOMContentLoaded').options.once, true);
  listeners.get('DOMContentLoaded').callback();
  assert.equal(nodes.size, 1);
  const script = nodes.get('nx-monetag-onclick');
  assert.equal(script.src, 'https://quge5.com/88/tag.min.js');
  assert.equal(script.dataset.zone, '310646');
  assert.equal(script.async, true);
  assert.equal(script.attributes['data-cfasync'], 'false');
  assert.equal(script.referrerPolicy, 'strict-origin-when-cross-origin');
  execute();
  assert.equal(nodes.size, 1, 'a second bootstrap never duplicates the zone');
  const interactive = runLoader({ readyState: 'interactive' });
  assert.equal(interactive.nodes.size, 1, 'deferred bootstrap also works after parsing');
});

test('no Monetag request in Android WebView, preview/local hosts, or browsers signaling GPC', () => {
  const denied = [
    { host: 'localhost' },
    { host: 'nexora-social-2026-git-main-ahmed-d33b.vercel.app' },
    { protocol: 'http:' },
    { protocol: 'file:', host: '' }, // Capacitor's packaged WebView
    { userAgent: 'NexoraAI/4.4.0' },
    { nativeClass: true },
    { capacitor: true },
    { gpc: true },
  ];
  for (const options of denied) {
    const { nodes, listeners } = runLoader(options);
    assert.equal(nodes.size, 0, JSON.stringify(options));
    assert.equal(listeners.size, 0, JSON.stringify(options));
  }
});

test('privacy disclosures mention OnClick, web sessions, and third-party page access in both languages', () => {
  for (const path of ['public/privacy.html', 'public/en/privacy.html']) {
    const html = readFileSync(path, 'utf8');
    assert.match(html, /Monetag/);
    assert.match(html, /OnClick\/Popunder/);
    assert.match(html, /Global Privacy Control/);
    assert.match(html, /AdMob/);
  }
  const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
  assert.ok(config.headers.some(({ source, headers }) => source === '/monetag-web.js' &&
    headers.some(({ key, value }) => key === 'Cache-Control' && value === 'no-cache, must-revalidate')));
});
