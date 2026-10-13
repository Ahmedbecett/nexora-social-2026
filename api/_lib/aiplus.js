/* ============================================================================
   NEXORA AI PLUS — وحدة الذكاء الاصطناعي المتقدمة (محادثات · ملفات · بحث · صوت)
   كل الدوال هنا حقيقية وتعمل على خدمات فعلية؛ لا ردود ثابتة ولا محاكاة.
   ============================================================================ */
import { q, one } from './db.js';
import { put, del as blobDel } from '@vercel/blob';

/* ------------------------------- schema -------------------------------- */
let plusReady = false;
export async function plusEnsure() {
  if (plusReady) return true;
  try {
    await q(`create table if not exists ai_conversations (
      id bigserial primary key,
      user_id bigint not null references users(id) on delete cascade,
      title text not null default 'محادثة جديدة',
      mode text not null default 'chat',
      pinned boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now())`);
    await q(`create index if not exists ai_conv_user_idx on ai_conversations(user_id, updated_at desc)`);
    await q(`create table if not exists ai_messages (
      id bigserial primary key,
      conversation_id bigint not null references ai_conversations(id) on delete cascade,
      user_id bigint not null references users(id) on delete cascade,
      role text not null,
      text text not null default '',
      provider text, model text,
      meta jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now())`);
    await q(`create index if not exists ai_msg_conv_idx on ai_messages(conversation_id, id)`);
    await q(`create table if not exists ai_files (
      id bigserial primary key,
      user_id bigint not null references users(id) on delete cascade,
      name text not null,
      mime text not null,
      size int not null,
      kind text not null,
      blob_url text,
      extracted text,
      created_at timestamptz not null default now())`);
    plusReady = true;
    return true;
  } catch (e) {
    console.error('NEXORA plus: schema', String(e?.message || e).slice(0, 90));
    return false;
  }
}

/* ----------------------------- conversations ---------------------------- */
const CONV_MAX = 300;

export async function convList(userId, limit = 50) {
  await plusEnsure();
  return q(`select c.id, c.title, c.mode, c.pinned, c.updated_at,
                   (select count(*)::int from ai_messages m where m.conversation_id = c.id) as messages,
                   (select left(m.text, 90) from ai_messages m where m.conversation_id = c.id and m.role <> 'error' order by m.id desc limit 1) as preview
            from ai_conversations c where c.user_id = $1
            order by c.pinned desc, c.updated_at desc limit $2`, [userId, limit]);
}

export async function convCreate(userId, { title = '', mode = 'chat' } = {}) {
  await plusEnsure();
  const n = await one('select count(*)::int as c from ai_conversations where user_id=$1', [userId]);
  if ((n?.c || 0) >= CONV_MAX) {
    const old = await one('select id from ai_conversations where user_id=$1 order by updated_at asc limit 1', [userId]);
    if (old) await convDelete(userId, old.id);          // rotate the oldest — real deletion, not a pretend limit
  }
  const row = await one(`insert into ai_conversations(user_id, title, mode) values($1,$2,$3) returning *`,
    [userId, String(title || '').trim().slice(0, 80) || 'محادثة جديدة', String(mode || 'chat').slice(0, 20)]);
  return row;
}

export async function convOwned(userId, id) {
  await plusEnsure();
  return one('select * from ai_conversations where id=$1 and user_id=$2', [id, userId]);
}

export async function convGet(userId, id) {
  const conv = await convOwned(userId, id);
  if (!conv) return null;
  const messages = await q(`select id, role, text, provider, model, meta, created_at
                            from ai_messages where conversation_id=$1 and user_id=$2 order by id asc limit 400`, [id, userId]);
  return { conversation: conv, messages };
}

export async function convPatch(userId, id, patch = {}) {
  const conv = await convOwned(userId, id);
  if (!conv) return null;
  const title = typeof patch.title === 'string' ? patch.title.trim().slice(0, 80) : null;
  const pinned = typeof patch.pinned === 'boolean' ? patch.pinned : null;
  const mode = typeof patch.mode === 'string' ? patch.mode.slice(0, 20) : null;
  return one(`update ai_conversations set
                title = coalesce($3, title), pinned = coalesce($4, pinned), mode = coalesce($5, mode), updated_at = now()
              where id=$1 and user_id=$2 returning *`,
    [id, userId, title, pinned, mode]);
}

export async function convDelete(userId, id) {
  const conv = await convOwned(userId, id);
  if (!conv) return false;
  await q('delete from ai_messages where conversation_id=$1 and user_id=$2', [id, userId]);
  await q('delete from ai_conversations where id=$1 and user_id=$2', [id, userId]);
  return true;
}

export async function convSearch(userId, term, limit = 30) {
  await plusEnsure();
  const t = '%' + String(term || '').replace(/[%_]/g, ' ').trim().slice(0, 60) + '%';
  return q(`select c.id, c.title, c.mode, c.pinned, c.updated_at,
                   (select count(*)::int from ai_messages m where m.conversation_id=c.id) as messages,
                   (select left(m.text, 90) from ai_messages m
                     where m.conversation_id=c.id and m.text ilike $2 order by m.id desc limit 1) as preview
            from ai_conversations c where c.user_id=$1
              and (c.title ilike $2 or exists (select 1 from ai_messages m where m.conversation_id=c.id and m.text ilike $2))
            order by c.updated_at desc limit $3`, [userId, t, limit]);
}

export async function msgAdd(userId, convId, { role, text, provider = null, model = null, meta = {} }) {
  await plusEnsure();
  const row = await one(`insert into ai_messages(conversation_id, user_id, role, text, provider, model, meta)
                         values($1,$2,$3,$4,$5,$6,$7) returning id, created_at`,
    [convId, userId, role, String(text || '').slice(0, 20000), provider, model, JSON.stringify(meta || {})]);
  await q('update ai_conversations set updated_at=now() where id=$1 and user_id=$2', [convId, userId]);
  return row;
}

export async function convTouch(userId, convId, mode) {
  await q('update ai_conversations set updated_at=now(), mode=coalesce($3,mode) where id=$1 and user_id=$2', [convId, userId, mode || null]);
}

export function autoTitle(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, 60) : 'محادثة جديدة';
}

/* -------------------------------- files --------------------------------- */
export const MAX_FILE_BYTES = 3 * 1024 * 1024;      // 3MB خام (قاعدة Vercel للجسم ~4.5MB بعد base64)
export const MAX_USER_FILES = 60;
const DOC_MIMES = new Set([
  'application/pdf',
  'text/plain', 'text/csv', 'text/markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
]);
const IMG_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

export const mimeKind = (mime) => (IMG_MIMES.has(mime) ? 'image' : DOC_MIMES.has(mime) ? 'doc' : null);

/* استخراج نص حقيقي من الملفات — أي فشل يُعلَن بسببه ولا يُخفى */
export async function extractText(mime, buf) {
  if (mime === 'text/plain' || mime === 'text/csv' || mime === 'text/markdown') {
    return buf.toString('utf8').replace(/\u0000/g, '').slice(0, 60000) || null;
  }
  if (mime === 'application/pdf') {
    /* pdfjs-dist مباشرة. حمّل وحدة الـworker أولًا: على دوال Vercel لا يُحزَّم
       ملف pdf.worker.mjs بجانب pdf.mjs، وبتحميله هنا نتجاوز البحث عن الملف على القرص. */
    if (!globalThis.pdfjsWorker) {
      try { globalThis.pdfjsWorker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs'); }
      catch { /* سيُحاول pdf.js البحث عن الملف بنفسه */ }
    }
    let pdfjs;
    try { pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs'); }
    catch (e) { throw new Error('pdfjs_import: ' + String(e?.message || e).slice(0, 100)); }
    let doc;
    try {
      doc = await pdfjs.getDocument({
        data: new Uint8Array(buf), useSystemFonts: true, isEvalSupported: false,
        disableFontFace: true, useWorkerFetch: false, verbosity: 0,
      }).promise;
    } catch (e) { throw new Error('pdf_open: ' + String(e?.message || e).slice(0, 100)); }
    let out = '';
    const pages = Math.min(doc.numPages || 1, 60);
    for (let i = 1; i <= pages; i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      out += tc.items.map((it) => it.str || '').join(' ') + '\n';
    }
    try { await doc.destroy?.(); } catch { /* تنظيف اختياري */ }
    return out.replace(/\u0000/g, '').replace(/[ \t]+/g, ' ').trim().slice(0, 60000) || null;
  }
  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || mime === 'application/msword') {
    let mammoth;
    try { mammoth = (await import('mammoth')).default; }
    catch (e) { throw new Error('mammoth_import: ' + String(e?.message || e).slice(0, 100)); }
    const res = await mammoth.extractRawText({ buffer: buf });
    return String(res?.value || '').replace(/\u0000/g, '').trim().slice(0, 60000) || null;
  }
  return null;
}

export async function fileStore(userId, { name, mime, dataB64 }) {
  await plusEnsure();
  mime = String(mime || '').toLowerCase().split(';')[0].trim();
  const kind = mimeKind(mime);
  if (!kind) throw Object.assign(new Error('unsupported_type'), { status: 415 });
  const buf = Buffer.from(String(dataB64 || ''), 'base64');
  if (!buf.length) throw Object.assign(new Error('empty_file'), { status: 400 });
  if (buf.length > MAX_FILE_BYTES) throw Object.assign(new Error('file_too_large'), { status: 413 });
  const n = await one('select count(*)::int as c from ai_files where user_id=$1', [userId]);
  if ((n?.c || 0) >= MAX_USER_FILES) throw Object.assign(new Error('too_many_files'), { status: 429 });
  const safeName = String(name || 'file').replace(/[^\w.\-؀-ۿ ]/g, '_').slice(0, 120) || 'file';
  let extracted = null, extractError = null;
  if (kind === 'doc') {
    try { extracted = await extractText(mime, buf); }
    catch (e) { extractError = String(e?.message || e).slice(0, 140); }
    if (!extracted && !extractError) extractError = 'no_extractable_text';
  }
  let blobUrl = null;
  try {
    const blob = await put(`ai-files/${userId}/${Date.now()}-${safeName}`, buf, {
      access: 'public', addRandomSuffix: true, contentType: mime,
    });
    blobUrl = blob?.url || null;
  } catch (e) { console.error('NEXORA plus: blob', String(e?.message || e).slice(0, 90)); }
  const row = await one(`insert into ai_files(user_id, name, mime, size, kind, blob_url, extracted)
                         values($1,$2,$3,$4,$5,$6,$7) returning id, name, mime, size, kind, created_at, (extracted is not null) as has_text`,
    [userId, safeName, mime, buf.length, kind, blobUrl, extracted]);
  return extractError ? { ...row, extract_error: extractError } : row;
}

export async function fileList(userId, limit = 50) {
  await plusEnsure();
  return q(`select id, name, mime, size, kind, created_at, (extracted is not null) as has_text
            from ai_files where user_id=$1 order by id desc limit $2`, [userId, limit]);
}

export async function fileOwned(userId, id) {
  await plusEnsure();
  return one('select * from ai_files where id=$1 and user_id=$2', [id, userId]);
}

export async function fileDelete(userId, id) {
  const row = await fileOwned(userId, id);
  if (!row) return false;
  if (row.blob_url) { try { await blobDel(row.blob_url); } catch { /* الحذف من القاعدة أهم */ } }
  await q('delete from ai_files where id=$1 and user_id=$2', [id, userId]);
  return true;
}

/** يحمّل مرفقات الرسالة (ملك المستخدم فقط) ويعيد سياقها النصي */
export async function filesContext(userId, ids) {
  const list = (Array.isArray(ids) ? ids : []).slice(0, 3).map((x) => Number(x)).filter(Boolean);
  const out = { docs: [], images: [], rows: [] };
  for (const id of list) {
    const row = await fileOwned(userId, id);
    if (!row) continue;
    out.rows.push(row);
    if (row.kind === 'doc' && row.extracted) out.docs.push({ name: row.name, text: row.extracted.slice(0, 6000) });
    if (row.kind === 'image') out.images.push(row);
  }
  return out;
}

/* ------------------------------ web search ------------------------------ */
const SEARCH_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';
const decodeEntities = (s) => String(s || '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d));
const stripTags = (s) => decodeEntities(String(s || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

function bingResults(html) {
  const out = [];
  const blocks = html.match(/<li class="b_algo"[\s\S]*?<\/li>/g) || [];
  for (const b of blocks) {
    const a = b.match(/<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!a) continue;
    let url = decodeEntities(a[1]);
    if (/bing\.com\/ck\/a/.test(url)) {
      try {
        const u = new URL(url).searchParams.get('u') || '';
        const p = u.startsWith('a1') ? u.slice(2) : u;
        if (p) url = Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
      } catch { /* keep original */ }
    }
    if (!/^https?:\/\//.test(url)) continue;
    const title = stripTags(a[2]);
    const sn = b.match(/<p[^>]*>([\s\S]*?)<\/p>/);
    out.push({ title, url, snippet: stripTags(sn ? sn[1] : ''), engine: 'bing' });
  }
  return out;
}

function newsResults(xml) {
  const out = [];
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  for (const it of items.slice(0, 8)) {
    const t = it.match(/<title>([\s\S]*?)<\/title>/);
    const l = it.match(/<link>([\s\S]*?)<\/link>/);
    const d = it.match(/<description>([\s\S]*?)<\/description>/);
    if (!t || !l) continue;
    out.push({ title: stripTags(t[1]), url: decodeEntities(l[1]).trim(), snippet: stripTags(d ? d[1] : '').slice(0, 300), engine: 'google-news' });
  }
  return out;
}

async function wikiResults(term) {
  const arabic = /[\u0600-\u06FF]/.test(term);
  const host = arabic ? 'ar.wikipedia.org' : 'en.wikipedia.org';
  const url = `https://${host}/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(term)}&format=json&srlimit=3&origin=*`;
  const res = await fetch(url, { headers: { 'User-Agent': SEARCH_UA, Accept: 'application/json' }, signal: AbortSignal.timeout(6000) });
  if (!res.ok) return [];
  const data = await res.json().catch(() => null);
  const items = data?.query?.search || [];
  return items.map((x) => ({
    title: `${x.title} — ويكيبيديا`, url: `https://${host}/wiki/${encodeURIComponent(String(x.title).replace(/ /g, '_'))}`,
    snippet: stripTags(x.snippet || '').slice(0, 260), engine: 'wikipedia',
  }));
}

/** تحقق فعلي من صلاحية الرابط (HEAD ثم GET جزئي عند الرفض) */
async function verifyUrl(url) {
  const attempt = async (method) => {
    const res = await fetch(url, {
      method, redirect: 'follow',
      headers: { 'User-Agent': SEARCH_UA, ...(method === 'GET' ? { Range: 'bytes=0-1024' } : {}) },
      signal: AbortSignal.timeout(3500),
    });
    return res.status;
  };
  try {
    let s = await attempt('HEAD');
    if (s >= 400) s = await attempt('GET');
    return s < 400 ? true : (s === 403 || s === 405 || s === 429 ? null : false);
  } catch { return null; }
}

/**
 * بحث ويب حقيقي عبر محركات فعلية (Bing HTML · Google News RSS · Wikipedia API).
 * لا يرمي استثناءً: يعيد ما نجح فعلاً ويسمّي المحركات التي استُخدمت.
 */
export async function webSearch(term, { limit = 6 } = {}) {
  const query = String(term || '').trim().slice(0, 220);
  if (!query) return { results: [], engines: [] };
  const clean = query.replace(/\s+/g, ' ');
  const found = [];
  const engines = [];
  const jobs = [
    fetch(`https://www.bing.com/search?q=${encodeURIComponent(clean)}&count=10&setlang=${/[\u0600-\u06FF]/.test(clean) ? 'ar' : 'en'}`, {
      headers: { 'User-Agent': SEARCH_UA, 'Accept-Language': /[\u0600-\u06FF]/.test(clean) ? 'ar,en;q=0.7' : 'en-US,en;q=0.8' },
      signal: AbortSignal.timeout(8000),
    }).then((r) => r.text()).then((html) => {
      const rows = bingResults(html);
      if (rows.length) { found.push(...rows); engines.push('bing'); }
    }).catch(() => { /* محرك واحد فشل — البقية تكمل */ }),
    fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(clean)}&hl=${/[\u0600-\u06FF]/.test(clean) ? 'ar' : 'en-US'}&gl=${/[\u0600-\u06FF]/.test(clean) ? 'DZ' : 'US'}&ceid=${/[\u0600-\u06FF]/.test(clean) ? 'DZ:ar' : 'US:en'}`, {
      headers: { 'User-Agent': SEARCH_UA }, redirect: 'follow', signal: AbortSignal.timeout(8000),
    }).then((r) => r.text()).then((xml) => {
      const rows = newsResults(xml);
      if (rows.length) { found.push(...rows); engines.push('google-news'); }
    }).catch(() => {}),
    wikiResults(clean).then((rows) => {
      if (rows.length) { found.push(...rows); engines.push('wikipedia'); }
    }).catch(() => {}),
  ];
  await Promise.allSettled(jobs);

  const seen = new Set();
  const merged = [];
  for (const r of found) {
    const key = r.url.replace(/[#?].*$/, '').replace(/\/$/, '');
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(r);
    if (merged.length >= limit + 4) break;
  }
  const top = merged.slice(0, limit);
  const checks = await Promise.all(top.map((r) => verifyUrl(r.url).catch(() => null)));
  top.forEach((r, i) => { r.ok = checks[i]; });
  return { results: top, engines, query: clean };
}

/* سياق البحث الذي يُغذّى للنموذج — يميّز المصادر عن الاستنتاج صراحةً */
export function searchContext({ results, engines, query }) {
  if (!results?.length) {
    return '\n\n[بحث الويب] لم تنجح أي محاولة بحث لهذا السؤال. قل ذلك بوضوح ولا تخترع معلومات حديثة.';
  }
  const lines = results.map((r, i) => `[${i + 1}] ${r.title} — ${r.url}\n${r.snippet || ''}`).join('\n');
  return `\n\n[نتائج بحث ويب حقيقية أُجريت الآن عن: "${query}" — المصادر: ${engines.join(', ')}]
${lines}

[تعليمات إلزامية] أجب اعتمادًا على هذه النتائج أولًا. ميّز بوضوح بين:
• ما هو مُسنَد إلى المصادر: اذكر رقم المصدر بين قوسين هكذا [1]، واذكر أن المعلومة من المصادر.
• ما هو استنتاج أو معرفة عامة لديك: سمّه صراحة "استنتاج" أو "معرفة عامة".
إن لم تجد النتائج ما يكفي فقل ذلك ولا تخترع. لا تختلق روابط أو مصادر غير موجودة أعلاه.`;
}

/* ------------------------------ gemini vision --------------------------- */
/* اكتشاف ديناميكي لموديلات المفتاح الفعلية: أسماء مثل gemini-2.x تقاعدت،
   والحد اليومي يُحسب لكل موديل على حدة — لذلك نجرّب عدة موديلات بالترتيب. */
const modelCache = new Map();
async function geminiModels(key) {
  const hit = modelCache.get(key);
  if (hit && Date.now() - hit.t < 600000) return hit.list;
  try {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + encodeURIComponent(key), { signal: AbortSignal.timeout(7000) });
    const data = await res.json().catch(() => null);
    const names = (data?.models || []).map((m) => String(m.name || '').replace('models/', ''));
    modelCache.set(key, { t: Date.now(), list: names });
    return names;
  } catch { modelCache.set(key, { t: Date.now(), list: [] }); return []; }
}
function rankModel(n) {
  if (/tts|embedding|aqa|image-generation/i.test(n)) return 9;
  if (/flash-lite/i.test(n)) return 2;
  if (/flash/i.test(n)) return 1;
  if (/pro/i.test(n)) return 3;
  return 5;
}
async function geminiCandidates(key) {
  const known = ['gemini-3-flash-preview', 'gemini-flash-latest', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'];
  const discovered = (await geminiModels(key)).filter((n) => !/tts|embedding|aqa/i.test(n)).sort((a, b) => rankModel(a) - rankModel(b));
  return [...new Set([...discovered.slice(0, 6), ...known])].slice(0, 8);
}

/** تحليل صورة حقيقي عبر Gemini (inline_data) — يعيد نصًا مستخرَجًا/وصفًا، أو null */
export async function visionExtract({ keys, mime, dataB64, deadline, prompt, timeoutMs = 15000 }) {
  if (!keys?.length) return null;
  const text = prompt || 'حلّل هذه الصورة تحليلًا دقيقًا بالعربية: استخرج كل نص ظاهر فيها حرفيًا (OCR)، ثم صف محتواها وما يهم فيه. أجب نصًا منظمًا فقط.';
  for (const { key } of keys.slice(0, 3)) {
    const candidates = await geminiCandidates(key);
    for (const model of candidates) {
      if (deadline && Date.now() > deadline - 2000) return null;
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ inline_data: { mime_type: mime, data: dataB64 } }, { text }] }],
            generationConfig: { maxOutputTokens: 900 },
          }),
          signal: AbortSignal.timeout(Math.min(timeoutMs, deadline ? Math.max(2500, deadline - Date.now()) : timeoutMs)),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) continue;                       // 404/429 ⇒ الموديل التالي فورًا
        const out = ((data?.candidates || [])[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();
        if (out) return out;
      } catch { /* الموديل التالي */ }
    }
  }
  return null;
}

/* ---------------------------------- TTS --------------------------------- */
/** يحوّل PCM خام (من Gemini TTS) إلى ملف WAV صالح للتشغيل */
export function pcmToWav(pcm, { sampleRate = 24000, channels = 1, bitDepth = 16 } = {}) {
  const byteRate = (sampleRate * channels * bitDepth) / 8;
  const blockAlign = (channels * bitDepth) / 8;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVE', 8);
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22); header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28); header.writeUInt16LE(blockAlign, 32); header.writeUInt16LE(bitDepth, 34);
  header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/** توليد كلام حقيقي عبر Gemini TTS — يعيد {audioB64, mime} أو null */
export async function ttsGenerate({ keys, text, voice = 'Kore', deadline, timeoutMs = 25000 }) {
  if (!keys?.length) return null;
  const clean = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 600);
  if (!clean) return null;
  for (const { key } of keys.slice(0, 3)) {
    const ttsModels = [...new Set(['gemini-2.5-flash-preview-tts', ...(await geminiModels(key)).filter((n) => /tts/i.test(n)).slice(0, 3), 'gemini-2.5-pro-preview-tts'])];
    for (const model of ttsModels) {
      if (deadline && Date.now() > deadline - 2000) return null;
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: clean }] }],
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
            },
          }),
          signal: AbortSignal.timeout(Math.min(timeoutMs, deadline ? Math.max(3000, deadline - Date.now()) : timeoutMs)),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) continue;
        const part = ((data?.candidates || [])[0]?.content?.parts || []).find((p) => p.inlineData || p.inline_data);
        const inline = part?.inlineData || part?.inline_data;
        if (!inline?.data) continue;
        const mime = inline.mimeType || inline.mime_type || 'audio/L16;codec=pcm;rate=24000';
        const rate = Number((mime.match(/rate=(\d+)/) || [])[1] || 24000);
        if (/L16|pcm/i.test(mime)) {
          const wav = pcmToWav(Buffer.from(inline.data, 'base64'), { sampleRate: rate });
          return { audioB64: wav.toString('base64'), mime: 'audio/wav', model };
        }
        return { audioB64: inline.data, mime, model };
      } catch { /* الموديل التالي */ }
    }
  }
  return null;
}

/* ------------------------------- الترجمة -------------------------------- */
export const TTS_VOICES = ['Kore', 'Puck', 'Zephyr', 'Charon', 'Fenrir', 'Aoede'];
