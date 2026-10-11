import { dispatch, HttpError } from './_lib/handlers.js';

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
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
  try {
    const body = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method) ? await readBody(req) : {};
    const data = await dispatch(req.method, path, { headers: req.headers, body, query: Object.fromEntries(url.searchParams) });
    send(res, 200, data);
  } catch (e) {
    if (e instanceof HttpError) return send(res, e.status, { error: e.code });
    console.error(e);
    send(res, 500, { error: 'server_error' });
  }
}
