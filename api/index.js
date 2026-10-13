import { dispatch, HttpError, nxStreamChat } from './_lib/handlers.js';

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

/* الجسم الخام كما وصل — التوقيع يُحسب على البايتات الأصلية لا على JSON مُعاد بناؤه */
async function readRaw(req) {
  if (typeof req.body === 'string') return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    if (chunks.length) return Buffer.concat(chunks).toString('utf8');
  } catch { /* الجثمان مقروء مسبقًا */ }
  if (req.body && typeof req.body === 'object') return JSON.stringify(req.body);
  return '';
}

async function readBody(req) {
  if (req.body !== undefined) {
    if (typeof req.body === 'string') { try { return JSON.parse(req.body || '{}'); } catch { return {}; } }
    return req.body || {};
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }

  const url = new URL(req.url, 'http://localhost');
  const path = (url.searchParams.get('__p') ?? url.pathname.replace(/^\/api\/?/, '')).replace(/^index\/?/, '').replace(/^\/+|\/+$/g, '');
  url.searchParams.delete('__p');
  /* البث الحيّ للمحادثة (SSE) — يُكتب تدريجيًا أثناء توليد النموذج */
  if (req.method === 'POST' && path === 'ai/stream') {
    try { return await nxStreamChat(req, res, await readBody(req)); }
    catch (e) { console.error(e); res.statusCode = 500; return res.end(); }
  }
  /* إشعارات الدفع: نمرّر الجسم الخام إلى المعالج ليتحقق من التوقيع قبل أي تفعيل */
  if (req.method === 'POST' && path.startsWith('payments/webhook/')) {
    try {
      const raw = await readRaw(req);
      const query = Object.fromEntries(url.searchParams);
      const data = await dispatch('POST', path, { headers: req.headers, body: {}, query, rawBody: raw });
      return send(res, 200, data);
    } catch (e) {
      if (e instanceof HttpError) return send(res, e.status, e.detail ? { error: e.code, detail: e.detail } : { error: e.code });
      console.error('NEXORA webhook:', String(e && e.message || e).slice(0, 120));
      return send(res, 500, { error: 'server_error' });
    }
  }
  try {
    const body = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method) ? await readBody(req) : {};
    const data = await dispatch(req.method, path, { headers: req.headers, body, query: Object.fromEntries(url.searchParams) });
    send(res, 200, data);
  } catch (e) {
    if (e instanceof HttpError) return send(res, e.status, e.detail ? { error: e.code, detail: e.detail } : { error: e.code });
    console.error(e);
    send(res, 500, { error: 'server_error' });
  }
}
