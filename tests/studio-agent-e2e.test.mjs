/**
 * End-to-end test of the Studio agent: a real HTTP model endpoint (an
 * OpenAI-compatible SSE server bound to 127.0.0.1) drives the real route, the
 * real protocol parser and the real SQLite storage. No mocks inside the app.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'nxs-agent-'));
process.env.STUDIO_DB_PATH = join(dir, 'studio.sqlite');
process.env.STUDIO_DEV_AUTH = '1';
process.env.STUDIO_LOCAL_EXEC = '1';
delete process.env.DATABASE_URL;
delete process.env.POSTGRES_URL;

/* --------------------------- fake model server --------------------------- */
const PLAN = {
  title: 'Counter app',
  summary: 'A tiny counter built by the test model.',
  stack: 'static',
  features: ['increment', 'reset'],
  files: [{ path: 'index.html', purpose: 'markup' }, { path: 'app.js', purpose: 'logic' }, { path: 'style.css', purpose: 'styles' }],
  steps: ['plan', 'write', 'run'],
};

function sse(res, chunks) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
  let i = 0;
  const tick = () => {
    if (i >= chunks.length) { res.write('data: [DONE]\n\n'); res.end(); return; }
    const piece = chunks[i++];
    // split into small frames so the client exercises real streaming
    const step = Math.ceil(piece.length / 3);
    for (let j = 0; j < piece.length; j += step) {
      res.write('data: ' + JSON.stringify({ choices: [{ delta: { content: piece.slice(j, j + step) } }] }) + '\n\n');
    }
    setTimeout(tick, 5);
  };
  tick();
}

const server = http.createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => { raw += c; });
  req.on('end', () => {
    let body = {};
    try { body = JSON.parse(raw || '{}'); } catch { /* ignore */ }
    const last = body.messages?.at(-1)?.content || '';
    if (/produce a build plan/.test(last)) {
      sse(res, [`Here is the plan.\n<plan>${JSON.stringify(PLAN)}</plan>\n<message>خطة جاهزة: تطبيق عدّاد صغير.</message>`]);
    } else if (/FILES STILL MISSING/.test(last)) {
      // only hand back the files the prompt says are missing (the real contract)
      if (/- index\.html/.test(last)) {
        sse(res, [`<file path="index.html"><!doctype html><html><body><div id="n">0</div><button id="b">+1</button><script src="app.js"></script><link rel="stylesheet" href="style.css"></body></html></file>`]);
      } else {
        sse(res, ['<file path="app.js">let n=0;document.getElementById("b").onclick=()=>{n+=1;document.getElementById("n").textContent=n};</file>\n<file path="style.css">body{font-family:sans-serif}</file>\n<message>اكتمل المشروع.</message>']);
      }
    } else if (/modify the existing project/.test(last)) {
      sse(res, ['<file path="style.css">body{font-family:system-ui;background:#0b0d12;color:#fff}</file>\n<message>تم تغيير الخلفية.</message>']);
    } else {
      sse(res, ['<message>ok</message>']);
    }
  });
});

await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
process.env.STUDIO_AI_BASE_URL = `http://127.0.0.1:${port}/v1`;
process.env.STUDIO_AI_KEY = 'test-key';
process.env.STUDIO_AI_MODEL = 'fake-model';
process.env.STUDIO_SECRET = 'test-secret';

const { studioAgentStream } = await import('../api/_lib/studio/routes.js');
const { createProject, getProject, listMessages, listRevisions } = await import('../api/_lib/studio/projects.js');

/* ------------------------------ fake req/res ----------------------------- */
function fakeReq() {
  return { method: 'POST', headers: {}, body: {}, on() {}, once() {} };
}
function fakeRes() {
  const chunks = [];
  return {
    statusCode: 200,
    headersSent: false,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    flushHeaders() { this.headersSent = true; },
    write(c) { chunks.push(String(c)); this.headersSent = true; return true; },
    end() { this.ended = true; },
    on() {},
    get text() { return chunks.join(''); },
  };
}

function events(text) {
  return text.split('\n\n')
    .map((frame) => {
      const e = /^event: (.*)$/m.exec(frame);
      const d = /^data: (.*)$/m.exec(frame);
      if (!e || !d) return null;
      try { return { event: e[1], data: JSON.parse(d[1]) }; } catch { return null; }
    })
    .filter(Boolean);
}

test('the agent plans, streams files, persists them and versions the result', async () => {
  const project = await createProject('dev', { name: 'Counter app' });

  /* 1) plan */
  const resPlan = fakeRes();
  await studioAgentStream(fakeReq(), resPlan, { projectId: project.id, mode: 'plan', message: 'build a counter' });
  const planEvents = events(resPlan.text);
  assert.ok(planEvents.some((e) => e.event === 'status'), 'a status frame opens the run');
  const planFrame = planEvents.find((e) => e.event === 'plan');
  assert.equal(planFrame.data.plan.title, 'Counter app');
  const donePlan = planEvents.find((e) => e.event === 'done');
  assert.deepEqual(donePlan.data.missing.sort(), ['app.js', 'index.html', 'style.css']);

  let stored = await getProject('dev', project.id);
  assert.equal(stored.plan.title, 'Counter app');
  assert.equal(stored.name, 'Counter app', 'an untitled project takes the plan title');

  /* 2) create — two rounds, exactly like the client drives it */
  const res1 = fakeRes();
  await studioAgentStream(fakeReq(), res1, { projectId: project.id, mode: 'create', message: 'build a counter' });
  const ev1 = events(res1.text);
  const fileFrames = ev1.filter((e) => e.event === 'file');
  assert.equal(fileFrames[0].data.path, 'index.html');
  assert.match(fileFrames[0].data.content, /<button id="b">/, 'file content arrives complete');

  const res2 = fakeRes();
  await studioAgentStream(fakeReq(), res2, { projectId: project.id, mode: 'create', message: 'build a counter' });
  const ev2 = events(res2.text);
  assert.ok(ev2.filter((e) => e.event === 'file').length >= 2);
  const done2 = ev2.find((e) => e.event === 'done');
  assert.equal(done2.data.missing.length, 0, 'the plan is complete');

  stored = await getProject('dev', project.id);
  assert.deepEqual(Object.keys(stored.files).sort(), ['app.js', 'index.html', 'style.css']);
  assert.match(stored.files['app.js'], /onclick/);
  assert.equal(stored.stack, 'static');
  assert.equal(stored.entry, 'index.html');
  assert.equal(stored.status, 'ready');

  const messages = await listMessages('dev', project.id);
  assert.ok(messages.some((m) => m.role === 'user' && m.text === 'build a counter'));
  assert.ok(messages.some((m) => m.role === 'assistant' && m.kind === 'plan'));
  assert.ok(messages.some((m) => m.role === 'assistant' && m.kind === 'files'));

  const revisions = await listRevisions('dev', project.id);
  assert.ok(revisions.length >= 2, 'each build keeps a restore point');

  /* 3) edit an existing project */
  const resEdit = fakeRes();
  await studioAgentStream(fakeReq(), resEdit, { projectId: project.id, mode: 'edit', message: 'dark background please', selectedFile: 'style.css' });
  const edited = await getProject('dev', project.id);
  assert.match(edited.files['style.css'], /background:#0b0d12/);
  assert.match(edited.files['index.html'], /<button id="b">/, 'unchanged files are preserved');
  assert.match(events(resEdit.text).find((e) => e.event === 'done').data.message, /تم/);
});

test('a failing provider surfaces a typed error and writes no files', async () => {
  const project = await createProject('dev', { name: 'Broken' });
  const saved = process.env.STUDIO_AI_BASE_URL;
  process.env.STUDIO_AI_BASE_URL = 'http://127.0.0.1:1/v1';   // nothing listens here
  try {
    const res = fakeRes();
    await studioAgentStream(fakeReq(), res, { projectId: project.id, mode: 'plan', message: 'hi' });
    const list = events(res.text);
    const err = list.find((e) => e.event === 'error');
    assert.ok(err, 'an error frame is emitted');
    assert.match(String(err.data.detail), /gateway|network/i);
    const stored = await getProject('dev', project.id);
    assert.deepEqual(stored.files, {});
    const msgs = await listMessages('dev', project.id);
    assert.ok(msgs.some((m) => m.role === 'error'), 'the failure is recorded in the chat log');
  } finally {
    process.env.STUDIO_AI_BASE_URL = saved;
  }
});

test.after(() => {
  server.close();
  rmSync(dir, { recursive: true, force: true });
});
