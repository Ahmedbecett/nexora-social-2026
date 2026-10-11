// Deploys the repo to Vercel production through the REST API (works with scoped tokens).
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
const TOKEN = process.env.VC, TEAM = 'team_YCGVFOkWo0Kktd4rv4UYfwVa', PROJECT = 'nexora-social-2026';
const root = path.resolve(import.meta.dirname, '..');
const ignore = new Set(['.git', '.vercel', ...fs.readFileSync(path.join(root, '.vercelignore'), 'utf8').split('\n').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean)]);
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.relative(root, path.join(dir, e.name));
    if (ignore.has(e.name) || ignore.has(rel) || e.name.startsWith('.env.local')) continue;
    if (e.isDirectory()) walk(path.join(dir, e.name)); else files.push(rel);
  }
})(root);
const api = (p, opt = {}) => fetch(`https://api.vercel.com${p}${p.includes('?') ? '&' : '?'}teamId=${TEAM}`, { ...opt, headers: { Authorization: `Bearer ${TOKEN}`, ...(opt.headers || {}) } });
const list = [];
for (const f of files) {
  const buf = fs.readFileSync(path.join(root, f)); const sha = crypto.createHash('sha1').update(buf).digest('hex');
  const r = await api('/v2/files', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'x-vercel-digest': sha, 'Content-Length': String(buf.length) }, body: buf });
  if (!r.ok) throw new Error(`upload ${f}: ${r.status} ${await r.text()}`);
  list.push({ file: f.split(path.sep).join('/'), sha, size: buf.length });
}
console.log('uploaded', list.length, 'files');
const r = await api('/v13/deployments?forceNew=1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: PROJECT, project: PROJECT, target: 'production', files: list }) });
const d = await r.json(); if (!r.ok) throw new Error(JSON.stringify(d));
console.log('deployment', d.id, d.url);
for (let i = 0; i < 90; i++) {
  await new Promise((s) => setTimeout(s, 5000));
  const s = await (await api(`/v13/deployments/${d.id}`)).json();
  if (['READY', 'ERROR', 'CANCELED'].includes(s.readyState)) { console.log('state', s.readyState, s.aliasAssigned ? 'aliased' : '', s.errorMessage || ''); process.exit(s.readyState === 'READY' ? 0 : 1); }
}
console.log('timeout waiting');
