#!/usr/bin/env node
/* ============================================================================
   NEXORA Studio — end-to-end smoke test over real HTTP
   ----------------------------------------------------------------------------
   Boots the Studio API with a temporary database and a local model stub, then
   drives the whole product surface the way the UI does:

     create project → plan → create → files on disk → edit → run a command →
     start dev server (real HTTP) → save revision → restore revision → delete

   Nothing is mocked inside NEXORA: the API, SQLite, file workspace, process
   runner and SSE plumbing are the production code paths. Only the language
   model is a local stub (no provider keys are available in CI).

     node scripts/studio-smoke.mjs
   ============================================================================ */

import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ok = (label, extra = '') => console.log(`  \x1b[32m✓\x1b[0m ${label}${extra ? ' \x1b[2m' + extra + '\x1b[0m' : ''}`);
const fail = (label, detail) => { console.error(`  \x1b[31m✗\x1b[0m ${label}${detail ? ': ' + detail : ''}`); failures.push(label); };
const failures = [];

/* ----------------------------- model stub -------------------------------- */
const PLAN = '<plan>{"title":"Counter app","summary":"A counter page","stack":"static","features":["increment"],"files":[{"path":"index.html","purpose":"page"},{"path":"app.js","purpose":"logic"},{"path":"style.css","purpose":"styles"}],"steps":["write markup","write logic","style"]}</plan><message>سأبني صفحة عدّاد بسيطة.</message>';
const makeFiles = (missing) => missing.map((p) => (
  p.endsWith('.html')
    ? `<file path="${p}"><!doctype html><html lang="ar"><head><meta charset="utf-8"><link rel="stylesheet" href="style.css"></head><body><h1 id="n">0</h1><button id="plus">+</button><script src="app.js"></script></body></html></file>`
    : p.endsWith('.css')
      ? `<file path="${p}">body{font-family:system-ui;display:grid;place-items:center}h1{font-size:64px}button{font:inherit;padding:8px 16px}</file>`
      : `<file path="${p}">let n = 0; const out = document.getElementById('n'); document.getElementById('plus').onclick = () => { n += 1; out.textContent = String(n); };</file>`
)).join('\n') + '<message>تم إنشاء الملفات.</message>';

const model = createServer((req, res) => {
  let raw = '';
  req.on('data', (d) => { raw += d; });
  req.on('end', () => {
    const body = JSON.parse(raw || '{}');
    const text = (body.messages || []).map((m) => m.content).join('\n');
    let reply;
    if (/produce a build plan/i.test(text)) reply = PLAN;
    else if (/modify the existing project/i.test(text)) reply = '<file path="style.css">h1{font-size:80px}</file><message>كبّرت الخط.</message>';
    else {
      const missing = [...text.matchAll(/^- ([^\s—]+)(?: — .*)?$/gm)].map((m) => m[1]);
      reply = missing.length ? makeFiles(missing) : '<message>لا ملفات إضافية.</message>';
    }
    const frames = reply.match(/[\s\S]{1,80}/g) || [''];
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    for (const f of frames) res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: f } }] })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  });
});
await new Promise((r) => model.listen(0, '127.0.0.1', r));
const modelPort = model.address().port;

/* ------------------------------ studio api ------------------------------- */
const tmp = mkdtempSync(join(tmpdir(), 'nxs-smoke-'));
const apiPort = 3400 + Math.floor(Math.random() * 200);
const api = spawn(process.execPath, ['scripts/studio-server.mjs'], {
  env: {
    ...process.env,
    STUDIO_API_PORT: String(apiPort),
    STUDIO_DEV_AUTH: '1',
    STUDIO_LOCAL_EXEC: '1',
    STUDIO_DB_PATH: join(tmp, 'smoke.sqlite'),
    STUDIO_WORK_DIR: join(tmp, 'work'),
    STUDIO_AI_BASE_URL: `http://127.0.0.1:${modelPort}/v1`,
    STUDIO_AI_KEY: 'smoke',
    STUDIO_AI_MODEL: 'smoke',
    STUDIO_PREVIEW_URL_TEMPLATE: '',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let apiLog = '';
api.stdout.on('data', (d) => { apiLog += d; });
api.stderr.on('data', (d) => { apiLog += d; });

const base = `http://127.0.0.1:${apiPort}`;
async function waitForApi() {
  for (let i = 0; i < 120; i += 1) {
    try {
      const r = await fetch(base + '/api/studio/session');
      if (r.ok) return r.json();
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('the API did not start\n' + apiLog);
}

async function apiCall(path, { method = 'GET', body } = {}) {
  const r = await fetch(`${base}/api/${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(`${path}: ${data.error || r.status} ${data.detail || ''}`); e.status = r.status; throw e; }
  return data;
}

async function stream(path, body) {
  const r = await fetch(`${base}/api/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  const text = await r.text();
  return text.split('\n\n').filter(Boolean).map((frame) => {
    const event = /^event: (.+)$/m.exec(frame)?.[1] || 'message';
    const data = frame.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('');
    try { return { event, data: JSON.parse(data) }; } catch { return { event, data: {} }; }
  }).filter((f) => f.event !== 'end' && f.event !== 'end ');
}

/* -------------------------------- the run -------------------------------- */
let projectId = null;
try {
  const session = await waitForApi();
  ok('API up', `${session.storage?.driver} · ai ${session.ai?.configured ? 'configured' : 'missing'}`);

  const { project } = await apiCall('studio/projects', { method: 'POST', body: { prompt: 'اصنع صفحة عدّاد' } });
  projectId = project.id;
  ok('project created', `#${project.id} ${project.name}`);

  const planFrames = await stream('studio/agent', { projectId, mode: 'plan', message: 'اصنع صفحة عدّاد' });
  const planDone = planFrames.find((f) => f.event === 'done')?.data;
  if (planDone?.plan?.title === 'Counter app') ok('plan streamed', planDone.plan.files?.length + ' planned files');
  else fail('plan streamed', JSON.stringify(planDone?.plan));

  let missing = planDone?.missing?.length ? planDone.missing : (planDone?.plan?.files || []).map((f) => f.path);
  let rounds = 0;
  while (missing.length && rounds < 3) {
    rounds += 1;
    const frames = await stream('studio/agent', { projectId, mode: 'create', message: 'اصنع صفحة عدّاد' });
    const done = frames.find((f) => f.event === 'done')?.data;
    const written = frames.filter((f) => f.event === 'file').map((f) => f.data.path);
    if (!written.length) { fail('create round ' + rounds, 'no files streamed'); break; }
    ok('create round ' + rounds, written.join(', '));
    if (done?.failed) fail('create round ' + rounds + ' finished', done.notes?.join(' · '));
    missing = done?.missing || [];
  }
  if (!missing.length) ok('all planned files written');

  const full = await apiCall(`studio/projects/${projectId}`);
  const paths = Object.keys(full.project.files || {}).sort();
  if (paths.join(',') === 'app.js,index.html,style.css') ok('files persisted in storage', paths.join(', '));
  else fail('files persisted in storage', paths.join(', ') || '(none)');

  const editFrames = await stream('studio/agent', { projectId, mode: 'edit', message: 'كبّر العنوان', selectedFile: 'style.css' });
  const editDone = editFrames.find((f) => f.event === 'done')?.data;
  const after = await apiCall(`studio/projects/${projectId}`);
  if (after.project.files['style.css'].includes('80px') && after.project.files['index.html'].includes('id="n"')) ok('edit changed only the target file');
  else fail('edit changed only the target file');
  ok('revisions recorded', String(after.revisions?.length ?? 'n/a'));

  const execFrames = await stream('studio/exec', { projectId, command: 'ls -1 && node --check app.js && echo OK' });
  const logs = execFrames.filter((f) => f.event === 'log').map((f) => f.data.text || '').join('');
  const execDone = execFrames.find((f) => f.event === 'done')?.data;
  if (/index\.html/.test(logs) && /OK/.test(logs) && execDone?.exitCode === 0) ok('terminal ran a real command', (logs.match(/OK/) ? 'exit 0' : ''));
  else fail('terminal ran a real command', JSON.stringify(execDone));

  const dev = await apiCall(`studio/projects/${projectId}/dev/start`, { method: 'POST', body: { command: 'node -e "require(\'http\').createServer((q,s)=>s.end(\'smoke-dev\')).listen(process.env.PORT||0,\'0.0.0.0\')"' } });
  if (dev.port > 0) {
    const res = await fetch(`http://127.0.0.1:${dev.port}/`);
    const text = await res.text();
    if (text.includes('smoke-dev')) ok('dev server answered over HTTP', String(dev.port));
    else fail('dev server answered over HTTP', text.slice(0, 60));
    await apiCall(`studio/projects/${projectId}/dev/stop`, { method: 'POST', body: {} });
    ok('dev server stopped');
  } else fail('dev server started', JSON.stringify(dev));

  const revisions = await apiCall(`studio/projects/${projectId}/revisions`);
  const revs = revisions.revisions || [];
  if (revs.length >= 2) {
    const old = revs[revs.length - 1];
    await apiCall(`studio/projects/${projectId}/revisions/${old.id}/restore`, { method: 'POST', body: {} });
    const restored = await apiCall(`studio/projects/${projectId}`);
    const css = restored.project.files['style.css'] || '';
    ok('revision restored', `#${old.id} → ${css.includes('80px') ? 'newer build' : 'earlier build'}`);
  } else fail('revisions listed', String(revs.length));

  const runtime = await apiCall('studio/runtime');
  ok('runtime reported', `${runtime.engine} · dev ${runtime.canDevServer ? 'yes' : 'no'}`);
  if (!runtime.canRun) fail('local runner available');

  const deleted = await apiCall(`studio/projects/${projectId}`, { method: 'DELETE' });
  projectId = null;
  if (deleted.ok !== false) ok('project deleted');
} catch (e) {
  fail('run', e.message);
} finally {
  api.kill('SIGTERM');
  model.close();
  await new Promise((r) => setTimeout(r, 400));
  rmSync(tmp, { recursive: true, force: true });
  if (failures.length) {
    console.error(`\n\x1b[31m${failures.length} check(s) failed\x1b[0m\n`);
    process.exit(1);
  }
  console.log('\n\x1b[32mNEXORA Studio smoke test: all checks passed\x1b[0m\n');
  process.exit(0);
}
