/**
 * UI smoke test in a real DOM (jsdom).
 * Mounts the actual Studio, drives boot → project open → editor → preview build,
 * and fails on any React error, unhandled rejection or console error.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const PROJECT = {
  id: 7,
  name: 'Counter demo',
  description: '',
  stack: 'static',
  status: 'ready',
  entry: 'index.html',
  files: { 'index.html': '<!doctype html><html><body><h1 id="t">Hello preview</h1></body></html>', 'app.js': 'console.log(1)' },
  plan: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  fileCount: 2,
  bytes: 120,
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

const errors = [];

function installDom() {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost:5173/',
    pretendToBeVisual: true,
  });
  const { window } = dom;
  globalThis.window = window;
  globalThis.document = window.document;
  Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.Element = window.Element;
  globalThis.Node = window.Node;
  globalThis.Event = window.Event;
  globalThis.KeyboardEvent = window.KeyboardEvent;
  globalThis.MouseEvent = window.MouseEvent;
  globalThis.CustomEvent = window.CustomEvent;
  globalThis.getComputedStyle = window.getComputedStyle.bind(window);
  globalThis.MutationObserver = window.MutationObserver;
  globalThis.Window = window.Window;
  globalThis.HTMLTextAreaElement = window.HTMLTextAreaElement;
  globalThis.HTMLIFrameElement = window.HTMLIFrameElement;
  globalThis.Document = window.Document;
  globalThis.HTMLCollection = window.HTMLCollection;
  globalThis.NodeList = window.NodeList;
  globalThis.DOMRect = window.DOMRect || class { constructor() { this.top = 0; this.left = 0; this.bottom = 0; this.right = 0; this.width = 0; this.height = 0; } };
  globalThis.Range = window.Range;
  globalThis.Text = window.Text;
  globalThis.DOMParser = window.DOMParser;
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
  window.onerror = (msg) => { errors.push(String(msg)); };
  window.addEventListener('error', (e) => errors.push(String(e.message)));
  window.addEventListener('unhandledrejection', (e) => errors.push(String(e.reason)));
  return window;
}

const requests = [];
const bodies = [];
let mode = 'existing';
let createAttempts = 0;

function sse(frames) {
  const text = frames.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join('');
  return new Response(text, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

const BUILT_FILES = {
  'index.html': '<!doctype html><html><body><div id="hero">Built by the agent</div><script src="app.js"></script></body></html>',
  'app.js': 'document.getElementById("hero").dataset.ready = "1";',
};

function installFetch() {
  globalThis.fetch = async (input, init = {}) => {
    const url = String(typeof input === 'string' ? input : input.url);
    const method = (init.method || 'GET').toUpperCase();
    requests.push(`${method} ${url}`);
    try { bodies.push({ url, body: init.body ? JSON.parse(init.body) : null }); } catch { bodies.push({ url, body: null }); }
    if (url.includes('/api/studio/session')) {
      return jsonResponse({
        authenticated: true,
        user: { id: 'dev', username: 'studio-dev', fullName: 'Local Studio' },
        dev: true,
        storage: { ok: true, driver: 'sqlite', label: 'SQLite (local)' },
        runtime: { engine: 'local', label: 'Local runner', canRun: true, canDevServer: true, note: 'local' },
        ai: { configured: true, primary: { id: 'openai', label: 'OpenAI', model: 'gpt-4.1-mini', source: 'server' }, providers: [] },
        integrations: { github: { connected: false }, vercel: { connected: false } },
      });
    }
    if (url.match(/\/api\/studio\/projects\/7$/)) {
      return jsonResponse({ project: PROJECT, messages: [{ id: 1, role: 'assistant', kind: 'files', text: 'Built the counter.', meta: {}, createdAt: new Date().toISOString() }], revisions: [], deployments: [] });
    }
    if (url.match(/\/api\/studio\/projects$/)) {
      if (method === 'POST') {
        return jsonResponse({ project: { ...PROJECT, id: 9, name: 'Untitled project', stack: 'static', files: {}, fileCount: 0 } });
      }
      if (mode === 'empty' || mode === 'interrupted') return jsonResponse({ projects: [] });
      return jsonResponse({ projects: [{ ...PROJECT }] });
    }
    if (url.includes('/api/studio/agent')) {
      const body = JSON.parse(init.body || '{}');
      if (mode === 'interrupted' && body.mode !== 'plan') {
        createAttempts += 1;
        if (createAttempts === 1) {
          /* the function is cut off after the first file: no `done` frame */
          return sse([['status', { mode: body.mode }], ['file', { path: 'index.html', content: BUILT_FILES['index.html'], saved: true }]]);
        }
        return sse([
          ['status', { mode: body.mode }],
          ['file', { path: 'app.js', content: BUILT_FILES['app.js'], saved: true }],
          ['done', {
            project: { ...PROJECT, id: 9, name: 'Counter demo', files: BUILT_FILES, status: 'ready', entry: 'index.html', fileCount: 2 },
            plan: { title: 'Counter demo', files: [{ path: 'index.html' }, { path: 'app.js' }] },
            missing: [], pending: 0, changed: ['app.js'],
            provider: 'openai', notes: [],
          }],
        ]);
      }
      const project = { ...PROJECT, id: 9, name: 'Counter demo', files: mode === 'existing' ? PROJECT.files : BUILT_FILES };
      if (body.mode === 'plan') {
        return sse([
          ['status', { mode: 'plan' }],
          ['prose', { text: 'Planning a small counter page.' }],
          ['plan', { plan: { title: 'Counter demo', stack: 'static', files: [{ path: 'index.html' }, { path: 'app.js' }], steps: ['markup', 'behaviour'] } }],
          ['done', { project: { ...project, files: {}, fileCount: 0 }, plan: { title: 'Counter demo' }, missing: ['index.html', 'app.js'], changed: [], provider: 'openai', notes: [] }],
        ]);
      }
      return sse([
        ['status', { mode: body.mode }],
        ['file', { path: 'index.html', content: BUILT_FILES['index.html'] }],
        ['file', { path: 'app.js', content: BUILT_FILES['app.js'] }],
        ['done', {
          project: { ...project, status: 'ready', entry: 'index.html', fileCount: 2, bytes: 300 },
          assistantMessage: { id: 42, role: 'assistant', kind: 'files', text: 'Created the counter page.', meta: {}, createdAt: new Date().toISOString() },
          plan: { title: 'Counter demo' }, missing: [], changed: ['index.html', 'app.js'], provider: 'openai', notes: [],
        }],
      ]);
    }
    if (url.match(/\/api\/studio\/projects\/\d+$/) && (method === 'PATCH' || method === 'GET')) {
      return jsonResponse({ project: PROJECT });
    }
    return jsonResponse({ ok: true });
  };
}

async function bundleApp() {
  // inside the repo so bare React imports resolve to this project's node_modules
  const dir = join(process.cwd(), '.nexora', 'test-bundle');
  mkdirSync(dir, { recursive: true });
  const outfile = join(dir, 'app.mjs');
  await build({
    stdin: {
      contents: "import StudioApp from './src/studio/StudioApp.jsx';\nexport { StudioApp };\n",
      resolveDir: process.cwd(),
      loader: 'js',
    },
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
    },
    logLevel: 'error',
  });
  return import(pathToFileURL(outfile).href);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, timeout = 4000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (fn()) return true;
    await wait(40);
  }
  return false;
}

test('the Studio mounts, loads a project, opens the editor and renders the preview', async () => {
  mode = 'existing';
  errors.length = 0;
  const window = installDom();
  installFetch();
  const { StudioApp } = await bundleApp();
  const React = await import('react');
  const { createRoot } = await import('react-dom/client');

  const root = createRoot(document.getElementById('root'));
  const origError = console.error;
  console.error = (...args) => { errors.push(args.map(String).join(' ')); origError(...args); };
  try {
    root.render(React.createElement(StudioApp));

    assert.ok(await until(() => document.body.textContent.includes('NEXORA')), 'the shell renders');
    assert.ok(await until(() => document.body.textContent.includes('Counter demo')), 'the project list and title load');
    assert.ok(requests.some((r) => r.includes('/api/studio/projects/7')), 'the last project is reopened');

    /* workspace tabs exist */
    assert.ok(await until(() => document.body.textContent.includes('Publish')), 'workspace tabs render');

    /* editor tab shows the CodeMirror surface once opened */
    const codeTab = [...document.querySelectorAll('.nxs-tab')].find((b) => b.textContent.includes('Code'));
    assert.ok(codeTab, 'code tab is available');
    codeTab.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    assert.ok(await until(() => document.querySelector('.cm-editor') || document.querySelector('.nxs-editor')), 'the editor mounts');
    assert.ok(await until(() => document.body.textContent.includes('index.html')), 'the file tree lists project files');

    /* preview builds the real project HTML */
    const previewTab = [...document.querySelectorAll('.nxs-tab')].find((b) => b.textContent.includes('Preview'));
    previewTab.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    assert.ok(await until(() => document.querySelector('iframe.nxs-frame')), 'the preview frame appears');
    const built = await until(() => /Hello preview/.test(document.querySelector('iframe.nxs-frame')?.getAttribute('srcdoc') || ''), 6000);
    const frame = document.querySelector('iframe.nxs-frame');
    assert.ok(built, 'the preview contains the project markup');
    assert.match(frame.getAttribute('sandbox') || '', /allow-scripts/);

    assert.deepEqual(errors, [], 'no React or runtime errors were reported');
  } finally {
    console.error = origError;
    root.unmount();
  }
});

test('a prompt drives plan → create → files → live preview inside the UI', async () => {
  mode = 'empty';
  errors.length = 0;
  requests.length = 0;
  const window = installDom();
  installFetch();
  const { StudioApp } = await bundleApp();
  const React = await import('react');
  const { createRoot } = await import('react-dom/client');

  const root = createRoot(document.getElementById('root'));
  const origError = console.error;
  console.error = (...args) => { errors.push(args.map(String).join(' ')); origError(...args); };
  try {
    root.render(React.createElement(StudioApp));
    assert.ok(await until(() => document.body.textContent.includes('NEXORA')), 'shell renders on an empty account');

    const area = document.querySelector('textarea[aria-label="Message NEXORA Studio"]');
    assert.ok(area, 'the composer is available with no project');
    const setValue = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    setValue.call(area, 'build a counter page');
    area.dispatchEvent(new window.Event('input', { bubbles: true }));

    const sendBtn = await until(() => document.querySelector('button.nxs-send:not(.stop)'));
    assert.ok(sendBtn, 'send button enables');
    document.querySelector('button.nxs-send:not(.stop)').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    assert.ok(await until(() => /build a counter page/.test(document.body.textContent)), 'the prompt appears in the chat');
    assert.ok(await until(() => /Created the counter page/.test(document.body.textContent)), 'the assistant reports what it wrote');
    assert.ok(requests.some((r) => r.includes('/api/studio/agent')), 'the agent endpoint was called');

    const agentCalls = requests.filter((r) => r.includes('/api/studio/agent'));
    assert.ok(agentCalls.length >= 2, 'plan then create were both requested');

    assert.ok(await until(() => /Built by the agent/.test(document.querySelector('iframe.nxs-frame')?.getAttribute('srcdoc') || ''), 8000),
      'the live preview renders the generated app');

    const codeTabButton = [...document.querySelectorAll('.nxs-tab')].find((b) => b.textContent.includes('Code'));
    codeTabButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    assert.ok(await until(() => /index\.html/.test(document.querySelector('.nxs-tree')?.textContent || '')), 'the file explorer lists the generated file');
    assert.ok(await until(() => /Built by the agent/.test(document.querySelector('.cm-content')?.textContent || '')), 'the editor opens the generated file');

    assert.deepEqual(errors, [], 'no React or runtime errors during the build loop');
  } finally {
    console.error = origError;
    root.unmount();
  }
});

test('an interrupted build resumes automatically and keeps the streamed files', async () => {
  mode = 'interrupted';
  errors.length = 0;
  requests.length = 0;
  createAttempts = 0;
  const window = installDom();
  installFetch();
  const { StudioApp } = await bundleApp();
  const React = await import('react');
  const { createRoot } = await import('react-dom/client');

  const root = createRoot(document.getElementById('root'));
  const origError = console.error;
  console.error = (...args) => { errors.push(args.map(String).join(' ')); origError(...args); };
  try {
    root.render(React.createElement(StudioApp));
    assert.ok(await until(() => document.querySelector('textarea[aria-label="Message NEXORA Studio"]')), 'composer ready');

    const area = document.querySelector('textarea[aria-label="Message NEXORA Studio"]');
    const setValue = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    setValue.call(area, 'build a counter page');
    area.dispatchEvent(new window.Event('input', { bubbles: true }));
    await until(() => document.querySelector('button.nxs-send:not(.stop)'));
    document.querySelector('button.nxs-send:not(.stop)').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    const agentCalls = () => requests.filter((r) => r.includes('/api/studio/agent'));
    const retried = await until(() => agentCalls().length >= 3, 8000);
    assert.ok(retried, 'the cut-off round was retried without the user doing anything');
    assert.equal(createAttempts, 2, 'exactly one retry was needed');

    assert.ok(await until(() => /Built by the agent/.test(document.querySelector('iframe.nxs-frame')?.getAttribute('srcdoc') || ''), 8000),
      'the resumed build reaches the live preview');
    assert.ok(await until(() => !/Build interrupted/.test(document.body.textContent) && !/Continue build/.test(document.body.textContent)),
      'the interruption banner is cleared once the build finishes');
    const leftover = [...document.querySelectorAll('.nxs-chip, .nxs-live-note, button')]
      .filter((el) => /\bpending\b|\bcontinue build\b/i.test(el.textContent || ''));
    assert.equal(leftover.length, 0, 'no leftover pending counter');
    assert.deepEqual(errors, [], 'resuming raised no React errors');
  } finally {
    console.error = origError;
    root.unmount();
  }
});

test('the composer offers every build mode and sends the chosen one', async () => {
  mode = 'empty';
  errors.length = 0;
  requests.length = 0;
  bodies.length = 0;
  const window = installDom();
  installFetch();
  const { StudioApp } = await bundleApp();
  const React = await import('react');
  const { createRoot } = await import('react-dom/client');

  const root = createRoot(document.getElementById('root'));
  const origError = console.error;
  console.error = (...args) => { errors.push(args.map(String).join(' ')); origError(...args); };
  try {
    root.render(React.createElement(StudioApp));
    assert.ok(await until(() => document.querySelector('select[aria-label="Build mode"]')), 'the build mode picker is in the composer');
    const picker = document.querySelector('select[aria-label="Build mode"]');
    const ids = [...picker.querySelectorAll('option')].map((o) => o.value);
    assert.deepEqual(ids, ['direct', 'fast', 'precise', 'endless', 'text', 'review']);

    const setValue = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    setValue.call(picker, 'direct');
    picker.dispatchEvent(new window.Event('change', { bubbles: true }));

    const area = document.querySelector('textarea[aria-label="Message NEXORA Studio"]');
    const setText = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    setText.call(area, 'build a tiny page');
    area.dispatchEvent(new window.Event('input', { bubbles: true }));
    await until(() => document.querySelector('button.nxs-send:not(.stop)'));
    document.querySelector('button.nxs-send:not(.stop)').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    assert.ok(await until(() => bodies.some((b) => b.url.includes('/api/studio/agent'))), 'the agent was called');
    const agentCall = bodies.find((b) => b.url.includes('/api/studio/agent'));
    assert.equal(agentCall.body.buildMode, 'direct', 'the selected mode reaches the agent');
    assert.equal(agentCall.body.mode, 'create', 'direct mode starts with create — no plan request');
    assert.deepEqual(errors, []);
  } finally {
    console.error = origError;
    root.unmount();
  }
});
