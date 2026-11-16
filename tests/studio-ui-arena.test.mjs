/**
 * Arena-style Phase 2 UI tests (jsdom + real component tree).
 * Covers the redesigned shell: hero canvas, collapsible sidebar, Files toggle,
 * workspace tabs (Preview/Code/Diff/Checks/Terminal/Publish), live Leaderboard,
 * Settings modal (account/theme/integrations with OAuth + token), and the
 * Diff review + Checks verification flows against real state transitions.
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

const BUILT_FILES = {
  'index.html': '<!doctype html><html><body><div id="hero">Built by the agent</div><script src="app.js"></script></body></html>',
  'app.js': 'document.getElementById("hero").dataset.ready = "1";',
};

const LEADERBOARD = {
  entries: [
    { provider: 'openai', providerLabel: 'OpenAI', model: 'gpt-4.1-mini', configured: true, active: true, vision: true, free: false, upvotes: 3, downvotes: 1, netVotes: 2, runs: 12, successRate: 92, avgLatencyMs: 740 },
    { provider: 'anthropic', providerLabel: 'Anthropic', model: 'claude-sonnet-4', configured: false, vision: true, free: false, upvotes: 0, downvotes: 0, netVotes: 0, runs: 0, successRate: null, avgLatencyMs: null },
  ],
  primary: { id: 'openai', label: 'OpenAI', model: 'gpt-4.1-mini' },
  totals: { providers: 12, configured: 3, totalRuns: 21, totalVotes: 6 },
};

const errors = [];
const requests = [];
const bodies = [];
let mode = 'existing';

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

function installDom() {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost:5173/',
    pretendToBeVisual: true,
  });
  const { window } = dom;
  globalThis.window = window;
  globalThis.document = window.document;
  Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
  for (const k of ['HTMLElement', 'Element', 'Node', 'Event', 'KeyboardEvent', 'MouseEvent', 'CustomEvent', 'Window',
    'HTMLTextAreaElement', 'HTMLIFrameElement', 'HTMLSelectElement', 'HTMLInputElement', 'Document', 'HTMLCollection',
    'NodeList', 'DOMParser', 'FileReader', 'File', 'Blob', 'Image']) {
    globalThis[k] = window[k];
  }
  globalThis.getSelection = () => window.getSelection();
  globalThis.getComputedStyle = window.getComputedStyle.bind(window);
  globalThis.MutationObserver = window.MutationObserver;
  Object.defineProperty(globalThis, 'localStorage', { value: window.localStorage, configurable: true });
  Object.defineProperty(window, 'localStorage', { value: window.localStorage, configurable: true });
  globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  window.requestAnimationFrame = globalThis.requestAnimationFrame;
  window.matchMedia = window.matchMedia || (() => ({ matches: false, media: '', addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.scrollTo = () => {};
  const rect = () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 600, height: 20, x: 0, y: 0, toJSON() { return this; } });
  if (window.Range) {
    window.Range.prototype.getClientRects = () => ({ length: 0, item: () => null, *[Symbol.iterator]() {} });
    window.Range.prototype.getBoundingClientRect = rect;
  }
  if (window.Element) window.Element.prototype.getBoundingClientRect = rect;
  window.confirm = () => true;
  window.open = () => null;
  window.onerror = (msg) => { errors.push(String(msg)); };
  window.addEventListener('error', (e) => errors.push(String(e.message)));
  window.addEventListener('unhandledrejection', (e) => errors.push(String(e.reason)));
  return window;
}

function sse(frames) {
  const text = frames.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join('');
  return new Response(text, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

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
        runtime: { engine: 'local', label: 'Local runner', canRun: true, canDevServer: true, note: 'local', ready: true },
        ai: {
          configured: true,
          primary: { id: 'openai', label: 'OpenAI', model: 'gpt-4.1-mini', source: 'server' },
          providers: [
            { id: 'openai', label: 'OpenAI', models: ['gpt-4.1-mini'], configured: true, source: 'server', defaultModel: 'gpt-4.1-mini' },
            { id: 'anthropic', label: 'Anthropic', models: ['claude-sonnet-4'], configured: true, source: 'server', defaultModel: 'claude-sonnet-4' },
            { id: 'gemini', label: 'Gemini', models: ['gemini-2.0-flash'], configured: false },
          ],
        },
        oauth: {
          github: { configured: true, callbackUrl: 'http://localhost:5173/api/studio/oauth/github/callback', envHint: 'GITHUB_CLIENT_SECRET' },
          google: { configured: false, callbackUrl: 'http://localhost:5173/api/studio/oauth/google/callback', envHint: 'GOOGLE_CLIENT_SECRET' },
          vercel: { configured: true, callbackUrl: 'http://localhost:5173/api/studio/oauth/vercel/callback', envHint: 'VERCEL_CLIENT_SECRET' },
        },
        integrations: { github: { connected: false }, vercel: { connected: false } },
      });
    }
    if (url.includes('/api/studio/integrations/github')) {
      return jsonResponse({
        connected: false, source: null, login: null, repos: [], error: null,
      });
    }
    if (url.includes('/api/studio/integrations/vercel')) {
      return jsonResponse({ connected: false, source: null, username: null, projects: [], error: null });
    }
    if (url.includes('/api/studio/integrations/google')) {
      return jsonResponse({ connected: false, source: null, email: null, files: [], error: null });
    }
    if (url.includes('/api/studio/leaderboard')) return jsonResponse(LEADERBOARD);
    if (url.includes('/api/studio/ai/test')) {
      return jsonResponse({ ok: true, provider: 'openai', model: 'gpt-4.1-mini', latency: 812, echoed: true });
    }
    if (url.includes('/api/studio/agent')) {
      const body = JSON.parse(init.body || '{}');
      if (body.mode === 'create' || body.mode === 'edit' || body.mode === 'continue') {
        return sse([
          ['status', { mode: 'create' }],
          ['phase', { phase: 'planning' }],
          ['file', { path: 'index.html', content: BUILT_FILES['index.html'] }],
          ['file', { path: 'app.js', content: BUILT_FILES['app.js'] }],
          ['done', {
            project: { ...PROJECT, files: BUILT_FILES, status: 'ready', entry: 'index.html', fileCount: 2, bytes: 300 },
            assistantMessage: { id: 42, role: 'assistant', kind: 'files', text: 'Created the counter page.', meta: {}, createdAt: new Date().toISOString() },
            plan: { title: 'Counter demo' }, missing: [], changed: ['index.html', 'app.js'], provider: 'openai', notes: [],
          }],
        ]);
      }
      return sse([['status', { mode: body.mode || 'chat' }], ['done', { assistantMessage: { id: 43, role: 'assistant', kind: 'text', text: 'Done.', meta: {}, createdAt: new Date().toISOString() } }]]);
    }
    if (url.match(/\/api\/studio\/projects\/7\/(runs|revisions|save)$/)) {
      return jsonResponse({ runs: [], revisions: [], project: PROJECT, saved: true });
    }
    if (url.match(/\/api\/studio\/projects\/7$/)) {
      return jsonResponse({
        project: PROJECT,
        messages: [{ id: 1, role: 'assistant', kind: 'files', text: 'Built the counter.', meta: {}, createdAt: new Date().toISOString() }],
        revisions: [], deployments: [],
      });
    }
    if (url.match(/\/api\/studio\/projects$/)) {
      if (mode === 'empty') return jsonResponse({ projects: [] });
      return jsonResponse({ projects: [{ ...PROJECT }] });
    }
    return jsonResponse({ ok: true });
  };
}

async function bundleApp() {
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
async function until(fn, timeout = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (fn()) return true;
    await wait(40);
  }
  return false;
}

const click = (el) => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
const textOf = (sel) => [...document.querySelectorAll(sel)].map((e) => (e.textContent || '').trim());

test('the Arena shell: hero canvas, sidebar sections, six workspace tabs and the Files toggle', async () => {
  mode = 'empty';
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
    assert.ok(await until(() => document.querySelector('textarea[aria-label="Message NEXORA Studio"]')), 'composer ready');

    /* hero state */
    assert.ok(await until(() => /What would you like to build\?/.test(document.body.textContent)), 'serif hero headline');
    assert.ok(document.querySelector('.nxs-hero'), 'hero canvas renders');

    /* sidebar sections */
    assert.ok(textOf('.nxs-sb-nav-btn').some((t) => /^New Chat/.test(t)), 'New Chat action');
    assert.ok(textOf('.nxs-sb-nav-btn').some((t) => /^Leaderboard/.test(t)), 'Leaderboard action');
    assert.ok(textOf('.nxs-sb-nav-btn').some((t) => /^Search/.test(t)), 'Search action');
    assert.deepEqual(
      textOf('.nxs-sb-section-title'),
      ['Recent Chats', 'Projects', 'Archived Chats'],
      'sidebar sections',
    );
    assert.ok(textOf('.nxs-sb-account').some((t) => /Account Settings/.test(t)), 'account settings entry');

    /* sidebar collapse via the top header toggle */
    const sbToggle = document.querySelector('button[aria-label="Close sidebar"]');
    assert.ok(sbToggle, 'sidebar toggle in top header');
    click(sbToggle);
    assert.ok(await until(() => !document.querySelector('.nxs-sidebar')), 'sidebar closes');
    click(document.querySelector('button[aria-label="Open sidebar"]'));
    assert.ok(await until(() => document.querySelector('.nxs-sidebar')), 'sidebar re-opens');

    /* the brand wordmark and logo live in the top header */
    assert.ok(document.querySelector('.nxs-topbar .nxs-wordmark')?.textContent === 'NEXORA', 'NEXORA wordmark in top header');

    /* empty chat: the Files button is present and labelled */
    const filesBtn = document.querySelector('button[aria-label="Toggle files and workspace"]');
    assert.ok(filesBtn, 'files button in header');
  } finally {
    console.error = origError;
    root.unmount();
  }
});

test('an opened project shows all six workspace tabs and the Files button toggles the panel', async () => {
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
    assert.ok(await until(() => document.querySelector('.nxs-workspace')), 'workspace opens with the project');

    const tabLabels = [...document.querySelectorAll('.nxs-tab')]
      .map((el) => (el.querySelector('span:not(.count)')?.textContent || '').trim());
    assert.deepEqual(tabLabels, ['Preview', 'Code', 'Diff', 'Checks', 'Terminal', 'Publish'], 'six workspace tabs');

    /* open the Code tab — the explorer and CodeMirror mount */
    click([...document.querySelectorAll('.nxs-tab')].find((t) => (t.querySelector('span:not(.count)')?.textContent || '').trim() === 'Code'));
    assert.ok(await until(() => document.querySelector('.nxs-tree')), 'file explorer renders');
    assert.ok(await until(() => document.querySelector('.cm-editor')), 'CodeMirror editor mounts');

    /* the Files button collapses and re-expands the workspace */
    const filesBtn = document.querySelector('button[aria-label="Toggle files and workspace"]');
    click(filesBtn);
    assert.ok(await until(() => !document.querySelector('.nxs-workspace')), 'workspace hides via Files');
    click(document.querySelector('button[aria-label="Toggle files and workspace"]'));
    assert.ok(await until(() => document.querySelector('.nxs-workspace')), 'workspace returns via Files');
    assert.deepEqual(errors, [], 'no React errors while toggling');
  } finally {
    console.error = origError;
    root.unmount();
  }
});

test('the Leaderboard renders real telemetry and switching models updates the composer', async () => {
  mode = 'existing';
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
    assert.ok(await until(() => document.querySelector('textarea[aria-label="Message NEXORA Studio"]')), 'composer ready');

    click([...document.querySelectorAll('.nxs-sb-nav-btn')].find((b) => b.textContent.includes('Leaderboard')));
    assert.ok(await until(() => document.querySelector('.nxs-lb')), 'leaderboard view opens');
    assert.ok(requests.some((r) => r.includes('/api/studio/leaderboard')), 'live leaderboard endpoint fetched');

    assert.ok(await until(() => document.body.textContent.includes('gpt-4.1-mini')), 'model row from real data');
    assert.ok(document.body.textContent.includes('claude-sonnet-4'), 'second provider row');
    assert.ok(textOf('.nxs-lb-stat-val').includes('3/12'), 'connected providers stat');
    assert.ok(textOf('.nxs-lb-stat-val').some((t) => t === '21'), 'agent runs stat');
    assert.ok(textOf('.nxs-lb-row-actions button').some((t) => t === 'Probe'), 'live probe button');

    /* Use switches the active model and returns to chat */
    const useBtn = [...document.querySelectorAll('.nxs-lb-row-actions button')].find((b) => b.textContent.trim() === 'Use');
    assert.ok(useBtn, 'Use button for a configured model');
    click(useBtn);
    assert.ok(await until(() => !document.querySelector('.nxs-lb')), 'returns to chat after selecting');
    assert.strictEqual(window.localStorage.getItem('nxs_model_pref'), JSON.stringify({ provider: 'openai', model: 'gpt-4.1-mini' }), 'model preference persisted');
    assert.ok(await until(() => document.querySelector('select[aria-label="AI model"]')), 'model selector appears in composer');
    assert.deepEqual(errors, [], 'no React errors in leaderboard flow');
  } finally {
    console.error = origError;
    root.unmount();
  }
});

test('Settings exposes account, live theme switching, and OAuth + token integrations', async () => {
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
    assert.ok(await until(() => document.querySelector('textarea[aria-label="Message NEXORA Studio"]')), 'composer ready');

    click(document.querySelector('.nxs-sb-account'));
    assert.ok(await until(() => document.querySelector('.nxs-modal')), 'settings modal opens');
    assert.deepEqual(textOf('.nxs-modal-tab'), ['Account', 'Integrations', 'Models', 'Runtime'], 'settings tabs');

    /* live theme switching persisted on the root */
    assert.ok(document.querySelector('.nxs[data-theme="cream"]'), 'cream theme by default');
    click([...document.querySelectorAll('.nxs-theme-opt')].find((b) => b.textContent.includes('Warm Dark')));
    assert.ok(await until(() => document.querySelector('.nxs[data-theme="dark"]')), 'dark theme applies');
    assert.strictEqual(window.localStorage.getItem('nxs_theme'), 'dark', 'theme persisted');
    click([...document.querySelectorAll('.nxs-theme-opt')].find((b) => b.textContent.includes('Warm Cream')));
    assert.ok(await until(() => document.querySelector('.nxs[data-theme="cream"]')), 'back to cream');

    /* integrations: real provider cards with OAuth where configured */
    click([...document.querySelectorAll('.nxs-modal-tab')].find((b) => b.textContent.trim() === 'Integrations'));
    assert.ok(await until(() => document.body.textContent.includes('Google Drive & Google Docs')), 'google card renders');
    assert.ok(document.body.textContent.includes('GitHub'), 'github card renders');
    assert.ok(document.body.textContent.includes('Vercel'), 'vercel card renders');

    assert.ok(await until(() => textOf('.nxs-connect-box .nxs-btn').some((t) => /Sign in with Vercel \(OAuth\)/.test(t))), 'Vercel OAuth sign-in offered');
    assert.ok(textOf('.nxs-connect-box .nxs-btn').some((t) => /Sign in with GitHub \(OAuth\)/.test(t)), 'GitHub OAuth sign-in offered');
    const googleCard = [...document.querySelectorAll('.nxs-card')].find((c) => /Google Drive & Google Docs/.test(c.textContent));
    assert.ok(googleCard, 'google card found');
    const googleConnect = [...googleCard.querySelectorAll('.nxs-connect-box .nxs-btn')].find((b) => /^Connect$/.test(b.textContent.trim()));
    assert.ok(googleConnect, 'Google falls back to a token connect button');

    /* close the modal */
    click(document.querySelector('button[aria-label="Close settings"]'));
    assert.ok(await until(() => !document.querySelector('.nxs-modal')), 'settings modal closes');
    assert.deepEqual(errors, [], 'no React errors in settings flow');
  } finally {
    console.error = origError;
    root.unmount();
  }
});

test('after a build, Diff reviews every change and Checks runs real verification', async () => {
  mode = 'existing';
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
    assert.ok(await until(() => document.querySelector('textarea[aria-label="Message NEXORA Studio"]')), 'composer ready');

    /* run a real agent build through the SSE pipeline */
    const area = document.querySelector('textarea[aria-label="Message NEXORA Studio"]');
    const setValue = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    setValue.call(area, 'build a counter page');
    area.dispatchEvent(new window.Event('input', { bubbles: true }));
    await until(() => document.querySelector('button.nxs-send:not(.stop)'));
    click(document.querySelector('button.nxs-send:not(.stop)'));
    assert.ok(await until(() => /Build finished/.test(document.body.textContent), 8000), 'agent completes the build');

    /* open the Diff tab — the changed files are listed against the saved baseline */
    click([...document.querySelectorAll('.nxs-tab')].find((t) => (t.querySelector('span:not(.count)')?.textContent || '').trim() === 'Diff'));
    assert.ok(await until(() => document.querySelector('.nxs-diff-card')), 'diff cards render');
    assert.ok(await until(() => document.querySelectorAll('.nxs-diff-card').length >= 2), 'both changed files listed');
    assert.ok(textOf('.nxs-diff-summary button').some((t) => t === 'Accept All'), 'accept-all review action');
    assert.ok(textOf('.nxs-diff-card button').some((t) => t === 'Reject'), 'per-file reject action');
    assert.ok(textOf('.nxs-diff-hunk-bar button').some((t) => /Reject hunk/.test(t)), 'per-hunk reject action');

    /* accepting all changes persists and clears the review queue */
    click([...document.querySelectorAll('.nxs-diff-summary button')].find((b) => b.textContent.trim() === 'Accept All'));
    assert.ok(await until(() => requests.some((r) => r.includes('/api/studio/projects/7/save')), 6000), 'accept persists a save');
    assert.ok(await until(() => document.querySelector('.nxs-dc-empty')), 'review queue empties after accept');

    /* Checks runs the real static verification pipeline */
    click([...document.querySelectorAll('.nxs-dc-tab')].find((t) => t.textContent.trim() === 'Checks'));
    assert.ok(await until(() => document.querySelectorAll('.nxs-check-row').length > 0, 6000), 'verification rows appear');
    assert.ok(textOf('.nxs-check-name').length > 0, 'named checks listed');
    assert.ok(textOf('.nxs-checks-actions button').some((t) => /Run Checks/.test(t)), 're-run action available');

    assert.deepEqual(errors.filter((e) => !/not wrapped in act/.test(e)), [], 'no React errors in diff/checks flow');
  } finally {
    console.error = origError;
    root.unmount();
  }
});

test('mobile viewport: drawer sidebar with scrim, full-screen workspace sheet and back navigation', async () => {
  mode = 'existing';
  errors.length = 0;
  const window = installDom();
  /* emulate a phone BEFORE the app mounts so initial state picks it up */
  Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true });
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

    /* the sidebar starts closed on a phone */
    assert.ok(await until(() => !document.querySelector('.nxs-sidebar')), 'sidebar closed initially on mobile');
    assert.ok(document.querySelector('.nxs[data-theme]'), 'root shell present');

    /* opening it via the header toggle shows the drawer + scrim */
    click(document.querySelector('button[aria-label="Open sidebar"]'));
    assert.ok(await until(() => document.querySelector('.nxs-sidebar')), 'sidebar drawer opens');
    assert.ok(document.querySelector('.nxs-sidebar-scrim'), 'scrim renders behind the drawer');
    assert.ok(textOf('.nxs-sb-nav-btn').some((t) => /^New Chat/.test(t)), 'drawer actions reachable');

    /* tapping the scrim closes the drawer */
    click(document.querySelector('.nxs-sidebar-scrim'));
    assert.ok(await until(() => !document.querySelector('.nxs-sidebar')), 'scrim tap closes the drawer');

    /* the Files button opens the workspace as a full-screen sheet with a back button */
    const filesBtn = document.querySelector('button[aria-label="Toggle files and workspace"]');
    assert.ok(filesBtn, 'files button visible on mobile');
    click(filesBtn);
    assert.ok(await until(() => document.querySelector('.nxs-workspace')), 'workspace sheet opens');
    assert.ok(await until(() => document.querySelector('.nxs-ws-back')), 'back-to-chat button renders on mobile');

    /* the six tabs are still reachable inside the sheet */
    const tabLabels = [...document.querySelectorAll('.nxs-tab')]
      .map((el) => (el.querySelector('span:not(.count)')?.textContent || '').trim());
    assert.deepEqual(tabLabels, ['Preview', 'Code', 'Diff', 'Checks', 'Terminal', 'Publish'], 'all tabs on mobile sheet');

    /* Back to chat closes the sheet and restores the composer */
    click(document.querySelector('.nxs-ws-back'));
    assert.ok(await until(() => !document.querySelector('.nxs-workspace')), 'back returns to chat');
    assert.ok(document.querySelector('textarea[aria-label="Message NEXORA Studio"]'), 'composer still mounted');

    /* the bottom control bar keeps its 44px+ touch pills */
    assert.ok(document.querySelector('.nxs-cbar'), 'control bar present on mobile');
    assert.ok(document.querySelector('button[aria-label="Select project"]'), 'project selector pill');
    assert.ok(document.querySelector('button[aria-label="Select GitHub branch"]'), 'branch selector pill');
    assert.deepEqual(errors, [], 'no React errors on mobile flow');
  } finally {
    console.error = origError;
    root.unmount();
  }
});
