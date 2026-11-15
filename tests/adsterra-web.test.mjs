import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { pairs } from '../scripts/generate-seo-pages.mjs';

const loader = readFileSync('public/adsterra-web.js', 'utf8');
const zone = '5641403c5558334d50a26de1c90fe61d';
const containerId = `container-${zone}`;
const tag = '<script src="/adsterra-web.js" defer></script>';

function runLoader({ host = 'nexora-social-2026.vercel.app', protocol = 'https:', userAgent = '',
  gpc = false, capacitor = false, capacitorThrows = false, nativeClass = false,
  app = true, container = true, readyState = 'complete' } = {}) {
  const nodes = new Map();
  const scripts = [];
  const observers = [];
  const listeners = new Map();
  const root = app ? { id: 'root' } : null;
  if (root) nodes.set(root.id, root);
  const mountContainer = () => {
    const parent = {
      insertBefore(script, next) {
        assert.equal(next, this.container);
        script.nextSibling = next;
        script.remove = () => { script.removed = true; nodes.delete(script.id); };
        nodes.set(script.id, script);
        scripts.push(script);
        return script;
      },
    };
    const slot = { id: containerId, parentNode: parent };
    parent.container = slot;
    nodes.set(containerId, slot);
    return slot;
  };
  if (container) mountContainer();
  class Observer {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe(target, options) { this.target = target; this.options = options; }
    notify() { this.callback(); }
  }
  const document = {
    readyState,
    documentElement: { classList: { contains: (name) => nativeClass && name === 'native' } },
    getElementById: (id) => nodes.get(id) || null,
    addEventListener: (event, callback, options) => listeners.set(event, { callback, options }),
    createElement(name) {
      assert.equal(name, 'script');
      return { attributes: {}, setAttribute(key, value) { this.attributes[key] = value; } };
    },
  };
  const context = {
    location: { hostname: host, protocol },
    navigator: { userAgent, globalPrivacyControl: gpc },
    window: { Capacitor: capacitor || capacitorThrows
      ? { isNativePlatform: () => { if (capacitorThrows) throw Error('native probe failed'); return true; } }
      : undefined },
    document,
    MutationObserver: Observer,
  };
  const execute = () => runInNewContext(loader, context, { filename: 'adsterra-web.js' });
  execute();
  return { scripts, observers, listeners, root, nodes, mountContainer, execute };
}

test('every HTML entry references the guarded Adsterra bootstrap, with one in-body static container', () => {
  const paths = Object.values(pairs).flatMap((pair) => [pair.ar, pair.en]);
  assert.equal(paths.length, 12);
  for (const path of paths) {
    const source = path === '/' ? 'index.html' : `public${path}`;
    const html = readFileSync(source, 'utf8');
    assert.equal(html.split('</head>')[0].split(tag).length - 1, 1, `${source}: one bootstrap`);
    assert.equal(html.split(`id="${containerId}"`).length - 1, path === '/' ? 0 : 1,
      `${source}: SPA uses React; static pages have exactly one container`);
    if (path !== '/') assert.ok(html.indexOf(`id="${containerId}"`) > html.indexOf('<body'), source);
    assert.ok(!html.includes('bauval.org'), `${source}: raw vendor script would bypass the web/native guard`);
    if (existsSync('dist/index.html')) {
      const built = readFileSync(path === '/' ? 'dist/index.html' : `dist${path}`, 'utf8');
      assert.equal(built.split(tag).length - 1, 1, `dist${path}: bootstrap survives build`);
      assert.equal(built.split(`id="${containerId}"`).length - 1, path === '/' ? 0 : 1);
    }
  }
  if (existsSync('dist/index.html')) assert.equal(readFileSync('dist/adsterra-web.js', 'utf8'), loader);
});

test('loads the owner-provided async Native Banner script immediately before its container once per view', () => {
  const { scripts, listeners, nodes, observers, execute } = runLoader({ readyState: 'loading' });
  assert.equal(scripts.length, 0);
  assert.equal(listeners.get('DOMContentLoaded').options.once, true);
  listeners.get('DOMContentLoaded').callback();
  assert.equal(scripts.length, 1);
  const script = scripts[0];
  assert.equal(script.src, `https://bauval.org/21/${zone}`);
  assert.equal(script.async, true);
  assert.equal(script.attributes['data-cfasync'], 'false');
  assert.equal(script.referrerPolicy, 'strict-origin-when-cross-origin');
  assert.equal(script.nextSibling, nodes.get(containerId));
  assert.equal(observers[0].target, nodes.get('root'));
  observers[0].notify();
  execute();
  assert.equal(scripts.length, 1, 'SPA updates and a duplicate bootstrap cannot reload one view');
});

test('SPA waits for React and requests again only after a real auth-view container change', () => {
  const app = runLoader({ container: false });
  assert.equal(app.scripts.length, 0);
  assert.equal(app.observers.length, 1);
  const signIn = app.mountContainer();
  app.observers[0].notify();
  assert.equal(app.scripts.length, 1);
  assert.equal(app.scripts[0].nextSibling, signIn);
  app.observers[0].notify(); // login -> registration or home -> chat keeps the same container
  assert.equal(app.scripts.length, 1);
  const signedIn = app.mountContainer();
  app.observers[0].notify();
  assert.equal(app.scripts.length, 2);
  assert.equal(app.scripts[0].removed, true);
  assert.equal(app.scripts[1].nextSibling, signedIn);
  app.observers[0].notify();
  assert.equal(app.scripts.length, 2);

  const staticPage = runLoader({ app: false });
  assert.equal(staticPage.observers.length, 0);
  assert.equal(staticPage.scripts.length, 1, 'static HTML needs no React observer');
});

test('no Adsterra vendor request on native Android, local/preview hosts, HTTP or GPC', () => {
  const denied = [
    { host: 'localhost' },
    { host: 'nexora-social-2026-git-main-ahmed-d33b.vercel.app' },
    { protocol: 'http:' },
    { protocol: 'file:', host: '' },
    { userAgent: 'NexoraAI/4.4.0' },
    { nativeClass: true },
    { capacitor: true },
    { capacitorThrows: true },
    { gpc: true },
  ];
  for (const options of denied) {
    const page = runLoader(options);
    assert.equal(page.scripts.length, 0, JSON.stringify(options));
    assert.equal(page.observers.length, 0, JSON.stringify(options));
  }
});

test('React banner is separate from retained AdSense and privacy notices cover both networks', () => {
  const component = readFileSync('src/ai/AIPlatform.jsx', 'utf8');
  const banner = readFileSync('src/ai/AdsterraBanner.jsx', 'utf8');
  assert.match(banner, new RegExp(containerId));
  assert.match(component, /<AuthFlow\/>\{showPublic&&<AdsterraBanner\/>\}/);
  assert.match(component, /<section className=\{'nx-ai-content '[^\n]*\n\s*\{!Capacitor\.isNativePlatform\(\)&&<AdsterraBanner\/>\}/);
  assert.match(component, /<AdSlot name="home"\/>/);
  assert.match(component, /<AdSlot name="chat" className="chat"\/>/);
  assert.match(readFileSync('src/ai/AdSlot.jsx', 'utf8'), /adsbygoogle\.js/);
  for (const path of ['public/privacy.html', 'public/en/privacy.html']) {
    const html = readFileSync(path, 'utf8');
    for (const term of ['Adsterra', 'Monetag', 'AdSense', 'Native Banner', 'Global Privacy Control', 'AdMob']) {
      assert.ok(html.includes(term), `${path}: ${term}`);
    }
  }
  const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
  assert.ok(config.headers.some(({ source, headers }) => source === '/adsterra-web.js' &&
    headers.some(({ key, value }) => key === 'Cache-Control' && value === 'no-cache, must-revalidate')));
});
