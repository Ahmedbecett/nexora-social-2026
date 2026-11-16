import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { aiStreamOpen } from '../api/_lib/handlers.js';

/* اختبار حقيقي لدالة البث الجديدة ضد خادم SSE محلي: القص القديم كان يقتل أي جواب
   أطول من مهلة AbortSignal.timeout مهما كانت بطيئة المقاطع — هنا نثبت السلوك الجديد. */

function startServer(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => resolve({
      url: `http://127.0.0.1:${server.address().port}`,
      /* close() وحدها لا تكفي: اتصالات keep-alive تمنع خروج العملية */
      stop: () => { try { server.close(); server.closeAllConnections?.(); } catch { /* أفضل جهد */ } },
    }));
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** نفس منطق تجميع المقاطع المستعمل في مسارات المزوّدين */
async function collectSse(chunks, onData) {
  let buf = '', acc = '';
  for await (const text of chunks) {
    buf += text;
    const lines = buf.split('\n'); buf = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (!raw || raw === '[DONE]') continue;
      try { const j = JSON.parse(raw); const piece = j.choices?.[0]?.delta?.content; if (piece) { acc += piece; onData?.(acc); } }
      catch { /* سطر جزئي */ }
    }
  }
  return acc;
}

test('بث أطول من المهلة القديمة (6 ثوان) يكتمل كاملًا — لا قص في المنتصف', async () => {
  const { url, stop } = await startServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', Connection: 'close' });
    let i = 0;
    const words = ['مرحبا', 'بك', 'في', 'نكسورا', 'هذا', 'بث', 'طويل', 'يعمل', 'بلا', 'قص'];
    const tick = () => {
      if (i >= words.length) { res.write('data: [DONE]\n\n'); res.end(); return; }
      res.write(`data: {"choices":[{"delta":{"content":"${words[i]} "}}]}\n\n`);
      i += 1;
      setTimeout(tick, 750);            /* 10 مقاطع × 750ms = 7.5 ثانية */
    };
    setTimeout(tick, 50);
  });
  try {
    const t0 = Date.now();
    const { res, chunks } = await aiStreamOpen(url, { payload: {}, connectMs: 3000, idleMs: 20000, hardCapMs: 20000 });
    assert.equal(res.ok, true);
    assert.ok(chunks);
    const acc = await collectSse(chunks);
    assert.ok(Date.now() - t0 >= 7000, 'البث عاش أطول من المهلة القديمة');
    assert.equal(acc, 'مرحبا بك في نكسورا هذا بث طويل يعمل بلا قص ');
  } finally { stop(); }
});

test('فجوة صمت قصيرة بين المقاطع (2.5 ث) لا تقتل البث — الخمول يُصفَّر مع كل مقطع', async () => {
  const { url, stop } = await startServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', Connection: 'close' });
    res.write('data: {"choices":[{"delta":{"content":"جزء-1 "}}]}\n\n');
    setTimeout(() => {
      res.write('data: {"choices":[{"delta":{"content":"جزء-2 "}}]}\n\n');
      setTimeout(() => { res.write('data: {"choices":[{"delta":{"content":"جزء-3"}}]}\n\n'); res.write('data: [DONE]\n\n'); res.end(); }, 2500);
    }, 2500);
  });
  try {
    const { chunks } = await aiStreamOpen(url, { payload: {}, connectMs: 3000, idleMs: 20000, hardCapMs: 20000 });
    const acc = await collectSse(chunks);
    assert.equal(acc, 'جزء-1 جزء-2 جزء-3');
  } finally { stop(); }
});

test('اتصال ميت بلا بايتات يُجهض خلال نافذة الاتصال — لا تعليق أبدًا', async () => {
  const { url, stop } = await startServer(() => { /* يقبل الاتصال ولا يرد أبدًا */ });
  try {
    const t0 = Date.now();
    await assert.rejects(
      () => aiStreamOpen(url, { payload: {}, connectMs: 700, idleMs: 20000, hardCapMs: 20000 }),
      (e) => { assert.match(e?.name || '', /Abort/); return true; }
    );
    assert.ok(Date.now() - t0 < 3500, 'أُجهض بسرعة لا بعد السقف الكامل');
  } finally { stop(); }
});

test('السقف الكريم يوقف البث اللانهائي، والنص المتراكم يبقى بيد المنادي (جواب جزئي)', async () => {
  const { url, stop } = await startServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', Connection: 'close' });
    let stopped = false;
    res.on('close', () => { stopped = true; });   /* لا سلسلة مؤقتات بعد الإغلاق */
    const tick = () => {
      if (stopped || res.destroyed) return;
      res.write('data: {"choices":[{"delta":{"content":"كلمة "}}]}\n\n');
      setTimeout(tick, 100);
    };
    tick();
  });
  try {
    const { chunks } = await aiStreamOpen(url, { payload: {}, connectMs: 3000, idleMs: 20000, hardCapMs: 1600 });
    await assert.rejects(
      () => collectSse(chunks),
      (e) => { assert.match(e?.name || '', /Abort/); return true; }
    );
  } finally { stop(); }
});
