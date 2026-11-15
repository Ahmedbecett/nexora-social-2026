/**
 * The live preview must show the real project. Static apps are composed from
 * their own HTML; React/TS apps are compiled with esbuild-wasm. Both paths are
 * exercised here, including a failing build and the ZIP export.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import esbuildWasm from 'esbuild-wasm';
import { buildPreview, previewKind, zipFiles } from '../src/studio/preview/bundler.js';

await esbuildWasm.initialize({});

const STATIC = {
  'index.html': '<!doctype html><html><head><title>Store</title><link rel="stylesheet" href="style.css"></head><body><h1>Hello</h1><script src="app.js"></script></body></html>',
  'style.css': 'h1{color:tomato}',
  'app.js': 'document.querySelector("h1").addEventListener("click", () => console.log("clicked"));',
};

const REACT = {
  'package.json': JSON.stringify({ name: 'demo', dependencies: { react: '^18.3.1' } }),
  'index.html': '<!doctype html><html><body><div id="root"></div></body></html>',
  'src/main.jsx': "import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App.jsx';\nimport './styles.css';\ncreateRoot(document.getElementById('root')).render(<App />);\n",
  'src/App.jsx': "import { useState } from 'react';\nexport default function App() {\n  const [n, setN] = useState(0);\n  return <button className=\"counter\" onClick={() => setN(n + 1)}>count {n}</button>;\n}\n",
  'src/styles.css': '.counter{font:inherit;padding:8px 14px}',
};

test('preview kind decides the strategy', () => {
  assert.equal(previewKind({}), 'empty');
  assert.equal(previewKind(STATIC), 'static');
  assert.equal(previewKind(REACT), 'bundle');
  assert.equal(previewKind({ 'app/page.tsx': '' }), 'server');
});

test('static projects are composed from their own files', async () => {
  const out = await buildPreview(STATIC, { title: 'Store' });
  assert.equal(out.kind, 'static');
  assert.match(out.html, /h1\{color:tomato\}/, 'stylesheets are inlined');
  assert.match(out.html, /addEventListener\("click"/, 'scripts are inlined');
  assert.match(out.html, /nxs-preview/, 'the console bridge is injected');
  assert.match(out.html, /<h1>Hello<\/h1>/);
});

test('missing references are reported instead of silently dropped', async () => {
  const out = await buildPreview({ 'index.html': '<html><head><link rel="stylesheet" href="nope.css"></head><body></body></html>' });
  assert.ok(out.warnings.some((w) => /nope\.css/.test(w)));
});

test('React projects are compiled to a runnable module bundle', async () => {
  const out = await buildPreview(REACT, { esbuild: esbuildWasm });
  assert.equal(out.kind, 'bundle');
  assert.match(out.html, /type="importmap"/);
  assert.match(out.html, /\/studio\/vendor\/react\.js/, 'react resolves to the local vendor build');
  assert.match(out.html, /\/studio\/vendor\/react-dom-client\.js/);
  assert.match(out.html, /counter/, 'the component code is in the bundle');
  assert.match(out.html, /\.counter\s*\{[^}]*font:\s*inherit/, 'imported CSS is emitted');
  assert.match(out.html, /id="root"/);
});

test('a broken React file produces a readable compile error', async () => {
  const broken = { ...REACT, 'src/App.jsx': 'export default function App(){ return <div>oops </div>; ' };
  await assert.rejects(() => buildPreview(broken, { esbuild: esbuildWasm }), /src\/App\.jsx|Expected|Unexpected/i);
});

test('unresolved imports fail loudly', async () => {
  const missing = { ...REACT, 'src/App.jsx': "import x from './missing.jsx'; export default () => x;" };
  await assert.rejects(() => buildPreview(missing, { esbuild: esbuildWasm }), /missing\.jsx/);
});

test('server-only projects are refused with an explanation', async () => {
  await assert.rejects(() => buildPreview({ 'app/page.tsx': 'export default () => null' }), /dev server/i);
});

test('the ZIP export is a valid archive with the project files', async () => {
  const blob = zipFiles({ 'index.html': '<h1>x</h1>', 'src/app.js': 'console.log(1)' });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.equal(String.fromCharCode(bytes[0], bytes[1]), 'PK', 'zip signature');
  const text = new TextDecoder().decode(bytes);
  assert.match(text, /index\.html/);
  assert.match(text, /src\/app\.js/);
});
