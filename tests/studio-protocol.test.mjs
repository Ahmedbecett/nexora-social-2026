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

test('inspect announcements stream live, dedupe, and stay out of prose', async () => {
  const { parseAgentOutput, createProtocolStreamer } = await import('../api/_lib/studio/agent.js');
  const seen = [];
  const streamer = createProtocolStreamer({ onInspect: (i) => seen.push(i.path) });
  streamer.push('Reading first.\n<inspect>src/App.jsx</inspect>\n<inspect path="package.json"/>\n<inspect>src/App.jsx</inspect>\n');
  assert.deepEqual(seen, ['src/App.jsx', 'package.json'], 'each inspected file is announced once, both tag forms work');

  const out = streamer.flush();
  assert.deepEqual(out.inspects, ['src/App.jsx', 'package.json']);
  assert.equal(out.ops.length, 0, 'inspections are never file operations');
  assert.ok(!out.prose.includes('inspect'), 'inspect tags do not leak into the prose');

  const parsed = parseAgentOutput('<inspect>index.html</inspect><file path="index.html">x</file>');
  assert.deepEqual(parsed.inspects, ['index.html']);
  assert.equal(parsed.ops.length, 1);
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

test('the status probe never throws and reports missing tokens plainly', async () => {
  const { connectionProbe } = await import('../api/_lib/studio/deploy.js');
  const saved = {};
  const names = ['GITHUB_STUDIO_TOKEN', 'GITHUB_TOKEN', 'GH_TOKEN', 'VERCEL_STUDIO_TOKEN', 'VERCEL_TOKEN', 'VERCEL_API_TOKEN'];
  for (const n of names) { saved[n] = process.env[n]; delete process.env[n]; }
  try {
    const probe = await connectionProbe();
    assert.deepEqual(Object.keys(probe).sort(), ['github', 'vercel']);
    assert.equal(probe.github.configured, false);
    assert.equal(probe.github.valid, false);
    assert.match(probe.github.error, /no token configured/);
    assert.equal(probe.vercel.configured, false);
    assert.match(probe.vercel.error, /no token configured/);

    /* with a token but no network/permission it degrades to a message, never a throw */
    process.env.GITHUB_STUDIO_TOKEN = 'ghp_invalid_probe';
    process.env.VERCEL_STUDIO_TOKEN = 'invalid-probe';
    const probe2 = await connectionProbe();
    assert.equal(probe2.github.configured, true);
    assert.equal(probe2.github.valid, false);
    assert.ok(probe2.github.error);
    assert.equal(probe2.vercel.configured, true);
    assert.equal(probe2.vercel.valid, false);
  } finally {
    for (const n of names) {
      if (saved[n] === undefined) delete process.env[n];
      else process.env[n] = saved[n];
    }
  }
});

test('an append block continues the same file instead of replacing it', async () => {
  const { parseAgentOutput, createProtocolStreamer } = await import('../api/_lib/studio/agent.js');
  const out = parseAgentOutput('<file path="a.md">one</file>\n<file path="a.md" append>two</file>');
  assert.equal(out.ops.length, 2);
  assert.equal(out.ops[0].append, false);
  assert.equal(out.ops[1].append, true, 'the append attribute is part of the parsed op');

  const { files, changed } = applyOps({ 'a.md': 'one' }, [out.ops[1]]);
  assert.equal(files['a.md'], 'one\n\ntwo');
  assert.deepEqual(changed, [{ path: 'a.md', op: 'append' }]);

  const seen = [];
  const streamer = createProtocolStreamer({ onFile: (f) => seen.push(f) });
  streamer.push('<file path="a.md" append>two</file>');
  streamer.push('<file path="a.md" append>two</file>');
  assert.deepEqual(seen, [{ path: 'a.md', content: 'two', append: true }]);
  assert.equal(applyOps({ 'a.md': 'one\n' }, [{ op: 'write', path: 'a.md', content: 'two', append: true }]).files['a.md'], 'one\ntwo');
});

test('build modes are a shared contract with real, bounded behaviour', async () => {
  const { BUILD_MODES, DEFAULT_BUILD_MODE, buildModeConfig, textTargetPath } = await import('../api/_lib/studio/modes.js');
  assert.deepEqual(BUILD_MODES.map((m) => m.id), ['direct', 'fast', 'precise', 'endless', 'text', 'review']);
  assert.equal(buildModeConfig('nope').id, DEFAULT_BUILD_MODE);
  for (const m of BUILD_MODES) {
    assert.ok(m.batch >= 1 && m.batch <= 6, `${m.id}: batch is inside the server clamp`);
    assert.ok(m.rounds >= 1 && m.rounds <= 40, `${m.id}: rounds are bounded`);
    assert.equal(typeof m.hint, 'string');
    assert.ok(m.hint.length > 20, `${m.id}: the hint explains the real behaviour`);
  }
  assert.equal(buildModeConfig('direct').plan, false);
  assert.equal(buildModeConfig('text').append, true);
  assert.equal(buildModeConfig('review').review, true);
  assert.equal(textTargetPath('اكتب لي مقال عن الذكاء الاصطناعي'), 'article.md');
  assert.equal(textTargetPath('write story.md for me'), 'story.md');
});

test('attachments are sanitised and only the valid ones are kept', async () => {
  const { sanitizeImages, IMAGE_LIMITS } = await import('../api/_lib/studio/files.js');
  const { attachImages } = await import('../api/_lib/studio/agent.js');
  const good = 'iVBORw0KGgoAAAANSUhEUg==';

  assert.equal(sanitizeImages([{ mime: 'image/png', data: good }]).length, 1);
  assert.equal(sanitizeImages([{ mime: 'image/svg+xml', data: good }]).length, 0, 'svg is refused');
  assert.equal(sanitizeImages([{ mime: 'image/png', data: 'not base64!!' }]).length, 0, 'only base64 is accepted');
  assert.equal(sanitizeImages([{ mime: 'image/png', data: 'a'.repeat(IMAGE_LIMITS.maxBytes + 10) }]).length, 0, 'oversized is refused');
  assert.equal(sanitizeImages(new Array(9).fill({ mime: 'image/jpeg', data: 'aGk=' })).length, IMAGE_LIMITS.maxCount, 'count is capped');
  assert.equal(sanitizeImages('nope').length, 0, 'a non-array is ignored');
  assert.equal(sanitizeImages([{ mime: 'image/png', data: `data:image/png;base64,${good}` }])[0].data, good, 'a data URL prefix is stripped');

  const prompt = { instructions: 'i', messages: [{ role: 'user', content: 'TASK: build it' }] };
  const withImages = attachImages(prompt, [{ mime: 'image/png', data: good }]);
  assert.equal(withImages.messages.length, 1);
  assert.equal(withImages.messages[0].images.length, 1);
  assert.match(withImages.messages[0].content, /attached 1 image/);
  assert.equal(prompt.messages[0].images, undefined, 'the original prompt is not mutated');
  assert.equal(attachImages(prompt, []), prompt, 'no images means no change');
});
