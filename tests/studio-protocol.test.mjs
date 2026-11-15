import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAgentOutput, createProtocolStreamer, buildEditPrompt,
} from '../api/_lib/studio/agent.js';
import {
  sanitizeFiles, detectStack, guessEntry, applyOps, normalizePath, pickContext,
} from '../api/_lib/studio/files.js';

test('paths are normalised and traversal attempts are refused', () => {
  assert.equal(normalizePath('/src/App.jsx'), 'src/App.jsx');
  assert.equal(normalizePath('./index.html'), 'index.html');
  assert.equal(normalizePath('src/../index.html'), null);
  assert.equal(normalizePath('node_modules/x/index.js'), null);
  assert.equal(normalizePath(''), null);
  assert.equal(normalizePath('a\u0000b'), null);
});

test('sanitizeFiles drops unsafe and oversized entries but keeps real ones', () => {
  const files = sanitizeFiles({
    'index.html': '<h1>x</h1>',
    '../evil.js': 'nope',
    'src/App.jsx': 'export default () => null',
    'big.js': 'x'.repeat(500_000),
  });
  assert.deepEqual(Object.keys(files).sort(), ['index.html', 'src/App.jsx']);
});

test('stack detection matches the preview strategy', () => {
  assert.equal(detectStack({ 'index.html': '<html></html>' }), 'static');
  assert.equal(detectStack({ 'src/App.jsx': 'x', 'index.html': '' }), 'vite-react');
  assert.equal(detectStack({ 'package.json': JSON.stringify({ dependencies: { next: '14' } }), 'app/page.tsx': '' }), 'next');
  assert.equal(detectStack({ 'server.js': 'x', 'package.json': JSON.stringify({ dependencies: { express: '4' } }) }), 'node');
  assert.equal(guessEntry({ 'src/App.jsx': '', 'index.html': '' }), 'src/App.jsx');
});

test('applyOps writes, deletes and reports changes', () => {
  const { files, changed } = applyOps({ 'a.js': '1' }, [
    { op: 'write', path: 'a.js', content: '2' },
    { op: 'write', path: 'b/c.css', content: 'body{}' },
    { op: 'delete', path: 'a.js' },
    { op: 'write', path: '../nope.js', content: 'x' },
  ]);
  assert.deepEqual(files, { 'b/c.css': 'body{}' });
  assert.deepEqual(changed.map((c) => c.path).sort(), ['a.js', 'b/c.css']);
});

test('parseAgentOutput reads plans, files, deletes and prose', () => {
  const raw = `I will build it now.
<plan>{"title":"Notes app","summary":"A small app","stack":"vite-react","features":["search","tags"],"files":[{"path":"src/App.jsx","purpose":"ui"}],"steps":["plan","write"]}</plan>
<file path="src/App.jsx">
\`\`\`jsx
export default function App(){ return <div>hi</div>; }
\`\`\`
</file>
<file path='src/styles.css'>body{color:red}</file>
<delete path="old.css"/>
<message>Done — two files written.</message>`;
  const out = parseAgentOutput(raw);
  assert.equal(out.plan.title, 'Notes app');
  assert.equal(out.plan.stack, 'vite-react');
  assert.equal(out.plan.files.length, 1);
  assert.equal(out.ops.length, 3);
  assert.equal(out.ops[0].content.includes('```'), false, 'code fences are stripped');
  assert.equal(out.ops[1].path, 'src/styles.css');
  assert.equal(out.ops[2].op, 'delete');
  assert.equal(out.message, 'Done — two files written.');
  assert.match(out.prose, /I will build it now/);
});

test('JSON fallback protocol is understood for models that ignore tags', () => {
  const raw = '```json\n{"title":"T","stack":"static","files":[{"path":"index.html","content":"<h1>x</h1>"}]}\n```';
  const out = parseAgentOutput(raw);
  assert.equal(out.ops.length, 1);
  assert.equal(out.ops[0].path, 'index.html');
  assert.equal(out.plan.title, 'T');
});

test('streaming parser emits a file as soon as its closing tag arrives', () => {
  const files = [];
  const plans = [];
  const prose = [];
  const streamer = createProtocolStreamer({
    onFile: (f) => files.push(f.path),
    onPlan: (p) => plans.push(p.title),
    onProse: (p) => prose.push(p),
  });
  streamer.push('<plan>{"title":"Streamed","stack":"static","files":[]}</plan>\nWorking…\n<file path="index.html"><h1>a</h1></file>\n<file path="b.css">bo');
  assert.deepEqual(plans, ['Streamed']);
  assert.deepEqual(files, ['index.html'], 'complete blocks land immediately, partial ones wait');
  streamer.push('<plan>{"title":"Streamed","stack":"static","files":[]}</plan>\nWorking…\n<file path="index.html"><h1>a</h1></file>\n<file path="b.css">body{}</file>');
  assert.deepEqual(files, ['index.html', 'b.css']);
  assert.ok(prose.join('').includes('Working'), 'prose outside tags reaches the UI');
});

test('edit prompt carries the file tree and the selected file, within the context budget', () => {
  const project = {
    name: 'P', stack: 'static', entry: 'index.html',
    files: { 'index.html': '<h1>one</h1>', 'app.js': 'console.log(1)', 'big.css': 'x'.repeat(50_000) },
  };
  const prompt = buildEditPrompt({ project, userMessage: 'change the title', selectedPath: 'index.html' });
  const body = prompt.messages.at(-1).content;
  assert.match(body, /index\.html/);
  assert.match(body, /change the title/);
  assert.ok(body.length < 80_000, 'context is bounded');
  const ctx = pickContext(project.files, { maxChars: 60, prefer: ['index.html'] });
  assert.match(ctx.text, /index\.html/);
  assert.equal(ctx.skipped >= 1, true);
});
