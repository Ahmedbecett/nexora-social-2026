/**
 * The live preview loads React from /studio/vendor/*.js through an import map.
 * This test reproduces that module graph exactly: the same four files, the same
 * bare specifiers rewritten to relative ones (what an import map does), then it
 * renders a real component with hooks and a click. A default-only export, a
 * "Dynamic require of react" stub, or two React instances all fail here.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

const vendorSrc = join(process.cwd(), 'public', 'studio', 'vendor');
const graphDir = join(process.cwd(), '.nexora', 'vendor-graph');

execFileSync(process.execPath, ['scripts/studio-vendor.mjs'], { stdio: 'ignore' });

function buildGraph() {
  rmSync(graphDir, { recursive: true, force: true });
  mkdirSync(graphDir, { recursive: true });
  const map = {
    'react.js': [['react', './react.js']],
    'react-dom.js': [['react', './react.js']],
    'react-dom-client.js': [['react-dom/client', './react-dom-client.js'], ['react', './react.js'], ['react-dom', './react-dom.js']],
    'jsx-runtime.js': [['react', './react.js']],
  };
  for (const [file, rewrites] of Object.entries(map)) {
    let code = readFileSync(join(vendorSrc, file), 'utf8');
    for (const [from, to] of rewrites) {
      code = code.split(`"${from}"`).join(`"${to}"`).split(`'${from}'`).join(`'${to}'`);
    }
    // never leave a bare framework specifier behind
    assert.doesNotMatch(code, /from\s*["'](react|react-dom|react-dom\/client|react\/jsx-runtime)["']/, `${file}: bare specifier left`);
    writeFileSync(join(graphDir, file), code);
  }
  writeFileSync(join(graphDir, 'entry.js'), [
    "import React, { useState } from './react.js';",
    "import ReactDOM from './react-dom.js';",
    "import { createRoot } from './react-dom-client.js';",
    "import { jsx, jsxs, Fragment } from './jsx-runtime.js';",
    'export { React, ReactDOM, createRoot, jsx, jsxs, Fragment, useState };',
  ].join('\n'));
}

function installDom() {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
  const { window } = dom;
  globalThis.window = window;
  globalThis.document = window.document;
  Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.Element = window.Element;
  globalThis.Node = window.Node;
  globalThis.Event = window.Event;
  globalThis.MouseEvent = window.MouseEvent;
  globalThis.getComputedStyle = window.getComputedStyle.bind(window);
  globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  return window;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, timeout = 3000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (fn()) return true;
    await wait(25);
  }
  return false;
}

test('vendor react/react-dom build renders with hooks through an import-map graph', async () => {
  buildGraph();
  const window = installDom();
  const mod = await import(pathToFileURL(join(graphDir, 'entry.js')).href);
  const { React, ReactDOM, createRoot, jsx, useState } = mod;

  assert.equal(typeof React.createElement, 'function');
  assert.equal(typeof useState, 'function');
  assert.equal(typeof createRoot, 'function');
  assert.equal(typeof ReactDOM.createPortal, 'function');
  assert.equal(jsx('div', { id: 'x' }).type, 'div', 'jsx-runtime produces elements');
  assert.equal(React.version.split('-')[0].slice(0, 2), ReactDOM.version.split('-')[0].slice(0, 2), 'react and react-dom majors match');

  function Counter() {
    const [n, setN] = useState(0);
    return React.createElement('button', { id: 'c', onClick: () => setN(n + 1) }, `count ${n}`);
  }

  const root = createRoot(document.getElementById('root'));
  root.render(React.createElement(Counter));

  assert.ok(await until(() => document.body.textContent.includes('count 0')), 'the component rendered');
  document.getElementById('c').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.ok(await until(() => document.body.textContent.includes('count 1')), 'hooks update state');
  root.unmount();
});

test('the vendor files expose the named exports a generated app imports', async () => {
  buildGraph();
  const react = await import(pathToFileURL(join(graphDir, 'react.js')).href);
  const client = await import(pathToFileURL(join(graphDir, 'react-dom-client.js')).href);
  const runtime = await import(pathToFileURL(join(graphDir, 'jsx-runtime.js')).href);
  for (const name of ['useState', 'useEffect', 'useMemo', 'useRef', 'useCallback', 'createElement', 'Fragment', 'memo', 'lazy', 'Suspense']) {
    assert.ok(name in react, `react exports ${name}`);
  }
  assert.ok('createRoot' in client && 'hydrateRoot' in client);
  assert.ok('jsx' in runtime && 'jsxs' in runtime && 'Fragment' in runtime);
});
