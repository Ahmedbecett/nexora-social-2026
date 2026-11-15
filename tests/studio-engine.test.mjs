/* Real studio engine contracts — no live network, but every behaviour that makes the
   pipeline trustworthy is asserted: strict JSON recovery, file sanitising, completeness
   gates, "no invented code" on failure, and edit-mode merging hints. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseJsonLoose, sanitiseFiles, missingPieces, createStudioEngine, diffSummary } from '../api/_lib/studio.js';

const fakeChat = (answers) => {
  const queue = [...answers];
  const calls = [];
  const chat = async (args) => {
    calls.push(args);
    const next = queue.shift();
    if (typeof next === 'function') return next(args);
    if (next instanceof Error) throw next;
    return { answer: next, provider: 'fake', model: 'fake-1' };
  };
  chat.calls = calls;
  return chat;
};

test('parseJsonLoose reads plain JSON', () => {
  assert.deepEqual(parseJsonLoose('{"a":1}'), { a: 1 });
});

test('parseJsonLoose strips ```json fences', () => {
  assert.deepEqual(parseJsonLoose('```json\n{"a":2}\n```'), { a: 2 });
});

test('parseJsonLoose recovers JSON surrounded by prose', () => {
  assert.deepEqual(parseJsonLoose('Sure! Here is the plan:\n{"title":"x"}\nHope it helps.'), { title: 'x' });
});

test('parseJsonLoose tolerates trailing commas', () => {
  assert.deepEqual(parseJsonLoose('{"a":1,"b":[2,3],}'), { a: 1, b: [2, 3] });
});

test('parseJsonLoose returns null for unusable text', () => {
  assert.equal(parseJsonLoose('totally not json'), null);
  assert.equal(parseJsonLoose(''), null);
});

test('sanitiseFiles rejects traversal, absolute and binary entries', () => {
  const out = sanitiseFiles({
    'index.html': '<h1>ok</h1>',
    '../evil.js': 'x',
    '/etc/passwd': 'x',
    'node_modules/pkg/index.js': 'x',
    'src/app.js': 'console.log(1)',
    'num.js': 42,
  });
  assert.deepEqual(Object.keys(out).sort(), ['index.html', 'src/app.js']);
});

test('sanitiseFiles caps project volume', () => {
  const big = { 'a.txt': 'x'.repeat(200_000), 'b.txt': 'y' };
  const out = sanitiseFiles(big);
  assert.equal(out['a.txt'], undefined, 'an oversized single file is dropped');
  assert.equal(out['b.txt'], 'y', 'small files still pass through');
});

test('missingPieces requires an entry file for static projects', () => {
  assert.deepEqual(missingPieces({ 'styles.css': 'a{}' }, 'static'), ['entry']);
  assert.deepEqual(missingPieces({ 'index.html': '<html></html>' }, 'static'), []);
});

test('missingPieces requires package.json for node frameworks', () => {
  assert.deepEqual(missingPieces({ 'index.html': '<html></html>' }, 'vite'), ['package.json']);
  assert.deepEqual(missingPieces({ 'package.json': '{}', 'src/App.jsx': 'x' }, 'vite'), []);
});

test('plan returns a normalised plan and real provider metadata', async () => {
  const chat = fakeChat(['{"title":"متجر","description":"d","framework":"vite","features":["a","b","c"],"fileStructure":["package.json"],"steps":["s1","s2","s3","s4"]}']);
  const engine = createStudioEngine({ chat });
  const r = await engine.plan({ prompt: 'متجر عطور', lang: 'ar' });
  assert.equal(r.plan.title, 'متجر');
  assert.equal(r.plan.framework, 'vite');
  assert.equal(r.plan.features.length, 3);
  assert.equal(r.provider, 'fake');
  assert.match(chat.calls[0].instructions, /Return ONLY one JSON object/);
  assert.match(chat.calls[0].instructions, /بالعربية/);
});

test('plan repairs a non-JSON answer once instead of inventing a plan', async () => {
  const chat = fakeChat([
    'I cannot answer that in JSON, sorry.',
    '{"title":"ok","framework":"static","features":[],"steps":[],"fileStructure":[]}',
  ]);
  const engine = createStudioEngine({ chat });
  const r = await engine.plan({ prompt: 'landing page' });
  assert.equal(r.plan.title, 'ok');
  assert.equal(chat.calls.length, 2);
  assert.match(chat.calls[1].message, /could not be parsed as JSON/);
});

test('plan throws when the model never returns JSON — no template fallback', async () => {
  const chat = fakeChat(['nope', 'still nope']);
  const engine = createStudioEngine({ chat });
  await assert.rejects(() => engine.plan({ prompt: 'x' }), (e) => e.code === 'ai_invalid_json');
});

test('generate returns sanitised files for a complete project', async () => {
  const chat = fakeChat([JSON.stringify({
    files: { 'index.html': '<!doctype html><html></html>', 'styles.css': 'body{}' },
    summary: 'landing page',
  })]);
  const engine = createStudioEngine({ chat });
  const r = await engine.generate({ prompt: 'landing', plan: { framework: 'static' } });
  assert.deepEqual(Object.keys(r.files).sort(), ['index.html', 'styles.css']);
  assert.equal(r.mode, 'create');
  assert.equal(r.summary, 'landing page');
});

test('generate rejects an incomplete project instead of shipping it', async () => {
  const chat = fakeChat([
    JSON.stringify({ files: { 'styles.css': 'body{}' } }),
    JSON.stringify({ files: { 'styles.css': 'body{}' } }),
  ]);
  const engine = createStudioEngine({ chat });
  await assert.rejects(() => engine.generate({ prompt: 'x', plan: { framework: 'static' } }), (e) => e.code === 'ai_incomplete');
});

test('generate rejects a provider error (never fabricates files)', async () => {
  const boom = Object.assign(new Error('all providers failed'), { code: 'ai_all_providers_failed' });
  const chat = fakeChat([boom, boom]);
  const engine = createStudioEngine({ chat });
  await assert.rejects(() => engine.generate({ prompt: 'x' }), (e) => e.code === 'ai_all_providers_failed');
});

test('edit mode asks the model for changed files only and flags mode=edit', async () => {
  const chat = fakeChat([JSON.stringify({ files: { 'styles.css': 'body{color:red}' }, summary: 'recolour' })]);
  const engine = createStudioEngine({ chat });
  const r = await engine.generate({
    instruction: 'اجعل اللون أحمر',
    files: { 'index.html': '<html></html>', 'styles.css': 'body{}' },
    plan: { framework: 'static' },
  });
  assert.equal(r.mode, 'edit');
  assert.deepEqual(Object.keys(r.files), ['styles.css']);
  assert.match(chat.calls[0].instructions, /EXISTING project/i);
  assert.match(chat.calls[0].message, /Return only the changed files/);
});

test('debug returns a diagnosis, real fixes and a rerun command', async () => {
  const chat = fakeChat([JSON.stringify({
    diagnosis: 'styles.css is missing the closing brace',
    fixes: { 'styles.css': 'body{color:red}' },
    rerun: 'npm run build',
  })]);
  const engine = createStudioEngine({ chat });
  const r = await engine.debug({ files: { 'styles.css': 'body{color:red' }, logs: 'ParseError: Unexpected end of input', command: 'npm run build' });
  assert.match(r.diagnosis, /closing brace/);
  assert.equal(r.fixes['styles.css'], 'body{color:red}');
  assert.equal(r.rerun, 'npm run build');
});

test('debug with an honest empty answer returns no fixes', async () => {
  const chat = fakeChat([JSON.stringify({ diagnosis: 'no actionable error in the logs', fixes: {} })]);
  const engine = createStudioEngine({ chat });
  const r = await engine.debug({ files: { 'a.js': '1' }, logs: 'everything fine' });
  assert.deepEqual(r.fixes, {});
});

test('diffSummary reports added, changed and removed paths', () => {
  const d = diffSummary({ 'a.js': '1', 'b.js': '2' }, { 'a.js': '1', 'b.js': '3', 'c.js': '4' });
  assert.deepEqual(d.added, ['c.js']);
  assert.deepEqual(d.changed, ['b.js']);
  assert.deepEqual(d.removed, []);
});
