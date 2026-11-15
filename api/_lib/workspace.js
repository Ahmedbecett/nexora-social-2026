import { q, one } from './db.js';
import { HttpError } from './errors.js';

let wsReady = false;
async function ensure() {
  if (wsReady) return;
  try {
    await q(`create table if not exists workspace_projects (
      id bigserial primary key,
      user_id bigint not null references users(id) on delete cascade,
      name text not null,
      description text not null default '',
      files jsonb not null default '{}'::jsonb,
      framework text not null default 'static',
      vercel_url text,
      vercel_deployment_id text,
      github_repo text,
      github_branch text not null default 'main',
      drive_file_id text,
      drive_url text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )`);
    await q(`create index if not exists ws_proj_user_idx on workspace_projects(user_id, updated_at desc)`);
    await q(`create table if not exists workspace_oauth (
      user_id bigint not null references users(id) on delete cascade,
      provider text not null check (provider in ('github','google')),
      access_token text not null,
      refresh_token text,
      expiry timestamptz,
      meta jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now(),
      primary key (user_id, provider)
    )`);
    await q(`create table if not exists workspace_deployments (
      id bigserial primary key,
      project_id bigint not null references workspace_projects(id) on delete cascade,
      provider text not null default 'vercel',
      url text,
      deployment_id text,
      status text not null default 'ready',
      created_at timestamptz not null default now()
    )`);
    wsReady = true;
  } catch (e) { console.warn('workspace ensure', e.message); }
}

function cleanStr(s, max) {
  return String(s ?? '').replace(/\u0000/g, '').trim().slice(0, max);
}

// ---- Vercel deploy (real API) ----
async function vercelDeploy({ files, name, project }) {
  const token = process.env.VERCEL_TOKEN || process.env.VERCEL_API_TOKEN || '';
  if (!token) return null; // no token -> simulate
  const fileEntries = Object.entries(files || {}).slice(0, 50);
  if (!fileEntries.length) throw new HttpError(400, 'files_required');
  // Vercel API expects array of { file, data, encoding }
  const payloadFiles = fileEntries.map(([fname, content]) => {
    const data = Buffer.from(String(content), 'utf8').toString('base64');
    return { file: fname, data, encoding: 'base64' };
  });
  const body = {
    name: (name || 'nexora-studio').toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 50) || 'nexora-studio',
    files: payloadFiles,
    projectSettings: { framework: null, buildCommand: null, outputDirectory: null, installCommand: null },
  };
  if (project) body.project = project;
  // teamId if set
  const qs = process.env.VERCEL_TEAM_ID ? '?teamId=' + encodeURIComponent(process.env.VERCEL_TEAM_ID) : '';
  const res = await fetch('https://api.vercel.com/v13/deployments' + qs, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || data?.error?.code || ('vercel ' + res.status);
    throw new HttpError(502, 'vercel_failed', msg.slice(0, 200));
  }
  return {
    url: data.url ? 'https://' + data.url : null,
    id: data.id || null,
    inspector: data.inspectorUrl || null,
  };
}

// ---- GitHub push (real API via Contents) ----
async function githubPush({ files, repo, message, branch, tokenOverride }) {
  const token = tokenOverride || process.env.GITHUB_TOKEN || '';
  if (!token) return null;
  const targetRepo = cleanStr(repo, 100) || process.env.GITHUB_DEFAULT_REPO || 'Ahmedbecett/nexora-social-2026';
  const targetBranch = cleanStr(branch, 60) || 'main';
  const msg = cleanStr(message, 200) || 'Arena Studio: update via NEXORA AI';
  // For each file, do PUT /repos/{owner}/{repo}/contents/{path}
  const [owner, repoName] = targetRepo.split('/');
  if (!owner || !repoName) throw new HttpError(400, 'invalid_repo');
  let lastSha = null;
  for (const [path, content] of Object.entries(files || {}).slice(0, 30)) {
    const b64 = Buffer.from(String(content), 'utf8').toString('base64');
    // check existing
    let sha = null;
    try {
      const get = await fetch('https://api.github.com/repos/' + owner + '/' + repoName + '/contents/' + encodeURIComponent(path) + '?ref=' + encodeURIComponent(targetBranch), {
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'User-Agent': 'NEXORA-AI' },
        signal: AbortSignal.timeout(15000),
      });
      if (get.ok) { const j = await get.json(); sha = j.sha; }
    } catch {}
    const put = await fetch('https://api.github.com/repos/' + owner + '/' + repoName + '/contents/' + encodeURIComponent(path), {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Accept: 'application/vnd.github+json', 'User-Agent': 'NEXORA-AI' },
      body: JSON.stringify({ message: msg, content: b64, branch: targetBranch, sha: sha || undefined }),
      signal: AbortSignal.timeout(20000),
    });
    const j = await put.json().catch(() => ({}));
    if (!put.ok) throw new HttpError(502, 'github_failed', (j.message || 'github ' + put.status).slice(0, 200));
    lastSha = j.commit?.sha || lastSha;
  }
  return { repo: targetRepo, branch: targetBranch, sha: lastSha, url: 'https://github.com/' + targetRepo + '/tree/' + targetBranch };
}

async function googleDriveSave({ files, name, tokenOverride }) {
  const token = tokenOverride || process.env.GOOGLE_DRIVE_TOKEN || '';
  if (!token) return null;
  // create folder or file via multipart
  const firstFile = Object.entries(files || {})[0];
  if (!firstFile) throw new HttpError(400, 'files_required');
  const [fname, content] = firstFile;
  const meta = { name: cleanStr(name, 120) || fname, mimeType: 'text/html' };
  const boundary = 'nexora_' + Math.random().toString(36).slice(2);
  const body =
    '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) +
    '\r\n--' + boundary + '\r\nContent-Type: text/html\r\n\r\n' + String(content) +
    '\r\n--' + boundary + '--';
  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'multipart/related; boundary=' + boundary },
    body,
    signal: AbortSignal.timeout(20000),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(502, 'drive_failed', (j.error?.message || 'drive ' + res.status).slice(0, 200));
  return { id: j.id, url: 'https://drive.google.com/file/d/' + j.id };
}

export async function wsStatus(userId) {
  await ensure();
  const vercelToken = !!process.env.VERCEL_TOKEN || !!process.env.VERCEL_API_TOKEN;
  const githubToken = !!process.env.GITHUB_TOKEN;
  const driveToken = !!process.env.GOOGLE_DRIVE_TOKEN;
  // user oauth
  let ghOAuth = null, gOAuth = null;
  try {
    ghOAuth = await one('select provider from workspace_oauth where user_id=$1 and provider=$2', [userId, 'github']);
    gOAuth = await one('select provider from workspace_oauth where user_id=$1 and provider=$2', [userId, 'google']);
  } catch {}
  const count = await one('select count(*)::int as c from workspace_projects where user_id=$1', [userId]).catch(() => ({ c: 0 }));
  return {
    vercel: { connected: vercelToken, project: process.env.VERCEL_PROJECT_ID || 'nexora-social-2026', team: process.env.VERCEL_TEAM_ID || null },
    github: { connected: githubToken || !!ghOAuth, repo: process.env.GITHUB_DEFAULT_REPO || 'Ahmedbecett/nexora-social-2026', branch: 'main', oauth: !!ghOAuth },
    drive: { connected: driveToken || !!gOAuth, oauth: !!gOAuth },
    projects: count.c,
    env: { vercel: vercelToken, github: githubToken, drive: driveToken },
  };
}

export async function wsList(userId) {
  await ensure();
  const rows = await q('select * from workspace_projects where user_id=$1 order by updated_at desc limit 50', [userId]);
  return rows;
}

export async function wsCreate(userId, { name, description, files, framework }) {
  await ensure();
  const n = cleanStr(name, 80) || 'مشروع NEXORA ' + new Date().toISOString().slice(0, 10);
  const d = cleanStr(description, 300);
  const f = files && typeof files === 'object' ? files : { 'index.html': '<!doctype html><html><body><h1>مرحبا</h1></body></html>' };
  const fw = ['static', 'next', 'vite', 'react'].includes(framework) ? framework : 'static';
  const row = await one('insert into workspace_projects(user_id, name, description, files, framework) values ($1,$2,$3,$4,$5) returning *', [userId, n, d, JSON.stringify(f), fw]);
  return row;
}

export async function wsGet(userId, id) {
  await ensure();
  const row = await one('select * from workspace_projects where id=$1 and user_id=$2', [id, userId]);
  if (!row) throw new HttpError(404, 'project_not_found');
  return row;
}

export async function wsUpdate(userId, id, patch) {
  await ensure();
  const cur = await wsGet(userId, id);
  const name = patch.name !== undefined ? cleanStr(patch.name, 80) : cur.name;
  const description = patch.description !== undefined ? cleanStr(patch.description, 300) : cur.description;
  const files = patch.files !== undefined ? patch.files : cur.files;
  const framework = patch.framework !== undefined ? patch.framework : cur.framework;
  const row = await one('update workspace_projects set name=$3, description=$4, files=$5, framework=$6, updated_at=now() where id=$1 and user_id=$2 returning *', [id, userId, name, description, JSON.stringify(files), framework]);
  return row;
}

export async function wsDelete(userId, id) {
  await ensure();
  await q('delete from workspace_projects where id=$1 and user_id=$2', [id, userId]);
  return { ok: true };
}

export async function wsDeploy(userId, { projectId, files, name }) {
  await ensure();
  let f = files;
  let pname = name;
  if (projectId) {
    const p = await wsGet(userId, projectId);
    f = f || p.files;
    pname = pname || p.name;
  }
  if (!f || !Object.keys(f).length) throw new HttpError(400, 'files_required');
  // try real vercel
  let real = null;
  try { real = await vercelDeploy({ files: f, name: pname, project: process.env.VERCEL_PROJECT_ID }); } catch (e) { if (e instanceof HttpError) throw e; throw new HttpError(502, 'vercel_failed', String(e.message).slice(0, 200)); }
  if (real) {
    if (projectId) await q('update workspace_projects set vercel_url=$2, vercel_deployment_id=$3, updated_at=now() where id=$1', [projectId, real.url, real.id]);
    await q('insert into workspace_deployments(project_id, provider, url, deployment_id, status) values ($1,$2,$3,$4,$5)', [projectId || null, 'vercel', real.url, real.id, 'ready']);
    return { ok: true, url: real.url, id: real.id, inspector: real.inspector, real: true };
  }
  // fallback: store and return fake preview (still useful for local testing)
  const previewUrl = 'https://nexora-social-2026.vercel.app/preview/' + Date.now();
  if (projectId) await q('update workspace_projects set vercel_url=$2, updated_at=now() where id=$1', [projectId, previewUrl]);
  return { ok: true, url: previewUrl, real: false, note: 'Vercel token not configured — preview saved locally. Add VERCEL_TOKEN in Vercel env to enable real deploys.' };
}

export async function wsGithubPush(userId, { projectId, files, repo, message, branch }) {
  await ensure();
  let f = files;
  if (projectId) { const p = await wsGet(userId, projectId); f = f || p.files; }
  if (!f || !Object.keys(f).length) throw new HttpError(400, 'files_required');
  // try user oauth token first
  let userToken = null;
  try { const r = await one('select access_token from workspace_oauth where user_id=$1 and provider=$2', [userId, 'github']); userToken = r?.access_token || null; } catch {}
  let real = null;
  try { real = await githubPush({ files: f, repo, message, branch, tokenOverride: userToken || undefined }); } catch (e) { if (e instanceof HttpError) throw e; throw new HttpError(502, 'github_failed', String(e.message).slice(0, 200)); }
  if (real) {
    if (projectId) await q('update workspace_projects set github_repo=$2, github_branch=$3, updated_at=now() where id=$1', [projectId, real.repo, real.branch]);
    return { ok: true, repo: real.repo, branch: real.branch, url: real.url, real: true };
  }
  return { ok: true, real: false, note: 'GITHUB_TOKEN not set — files prepared for GitHub. Connect GitHub in settings or add token env.' };
}

export async function wsDriveSave(userId, { projectId, files, name }) {
  await ensure();
  let f = files;
  if (projectId) { const p = await wsGet(userId, projectId); f = f || p.files; }
  if (!f || !Object.keys(f).length) throw new HttpError(400, 'files_required');
  let userToken = null;
  try { const r = await one('select access_token from workspace_oauth where user_id=$1 and provider=$2', [userId, 'google']); userToken = r?.access_token || null; } catch {}
  let real = null;
  try { real = await googleDriveSave({ files: f, name, tokenOverride: userToken || undefined }); } catch (e) { if (e instanceof HttpError) throw e; throw new HttpError(502, 'drive_failed', String(e.message).slice(0, 200)); }
  if (real) {
    if (projectId) await q('update workspace_projects set drive_file_id=$2, drive_url=$3, updated_at=now() where id=$1', [projectId, real.id, real.url]);
    return { ok: true, id: real.id, url: real.url, real: true };
  }
  return { ok: true, real: false, note: 'Drive not connected — add GOOGLE_DRIVE_TOKEN or connect via OAuth.' };
}

export async function wsDriveFiles(userId) {
  const token = process.env.GOOGLE_DRIVE_TOKEN;
  let userToken = null;
  try { const r = await one('select access_token from workspace_oauth where user_id=$1 and provider=$2', [userId, 'google']); userToken = r?.access_token || null; } catch {}
  const t = userToken || token;
  if (!t) return { files: [], connected: false };
  try {
    const res = await fetch('https://www.googleapis.com/drive/v3/files?pageSize=20&fields=files(id,name,mimeType,webViewLink,createdTime)&q=mimeType%20contains%20%27text%27%20or%20mimeType%20contains%20%27html%27', {
      headers: { Authorization: 'Bearer ' + t },
      signal: AbortSignal.timeout(15000),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error?.message || res.status);
    return { files: j.files || [], connected: true };
  } catch (e) { return { files: [], connected: true, error: String(e.message).slice(0, 100) }; }
}

// GitHub OAuth helpers
export function githubAuthUrl(state) {
  const id = process.env.GITHUB_CLIENT_ID;
  if (!id) throw new HttpError(503, 'github_oauth_not_configured', 'Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in Vercel env');
  const redirect = process.env.GITHUB_REDIRECT_URI || (process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL + '/api/workspace/github/callback' : 'https://nexora-social-2026.vercel.app/api/workspace/github/callback');
  return 'https://github.com/login/oauth/authorize?client_id=' + encodeURIComponent(id) + '&scope=repo&state=' + encodeURIComponent(state) + '&redirect_uri=' + encodeURIComponent(redirect);
}

export async function githubOAuthCallback(code) {
  const id = process.env.GITHUB_CLIENT_ID;
  const secret = process.env.GITHUB_CLIENT_SECRET;
  if (!id || !secret) throw new HttpError(503, 'github_oauth_not_configured');
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: id, client_secret: secret, code }),
    signal: AbortSignal.timeout(15000),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.access_token) throw new HttpError(502, 'github_oauth_failed', (j.error_description || j.error || 'oauth failed').slice(0, 120));
  return j.access_token;
}

export function googleAuthUrl(state) {
  const id = process.env.GOOGLE_CLIENT_ID;
  if (!id) throw new HttpError(503, 'google_oauth_not_configured', 'Set GOOGLE_CLIENT_ID/SECRET in env');
  const redirect = process.env.GOOGLE_REDIRECT_URI || (process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL + '/api/workspace/google/callback' : 'https://nexora-social-2026.vercel.app/api/workspace/google/callback');
  return 'https://accounts.google.com/o/oauth2/v2/auth?client_id=' + encodeURIComponent(id) + '&redirect_uri=' + encodeURIComponent(redirect) + '&response_type=code&scope=' + encodeURIComponent('https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly') + '&access_type=offline&prompt=consent&state=' + encodeURIComponent(state);
}

export async function googleOAuthCallback(code) {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!id || !secret) throw new HttpError(503, 'google_oauth_not_configured');
  const redirect = process.env.GOOGLE_REDIRECT_URI || (process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL + '/api/workspace/google/callback' : 'https://nexora-social-2026.vercel.app/api/workspace/google/callback');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: id, client_secret: secret, redirect_uri: redirect, grant_type: 'authorization_code' }),
    signal: AbortSignal.timeout(15000),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.access_token) throw new HttpError(502, 'google_oauth_failed', (j.error_description || j.error || 'oauth failed').slice(0, 120));
  return { access: j.access_token, refresh: j.refresh_token || null, expiry: j.expires_in ? new Date(Date.now() + j.expires_in * 1000) : null };
}

export async function saveOAuth(userId, provider, access, refresh, expiry, meta) {
  await ensure();
  await q(`insert into workspace_oauth(user_id, provider, access_token, refresh_token, expiry, meta)
           values ($1,$2,$3,$4,$5,$6) on conflict (user_id, provider) do update set access_token=$3, refresh_token=coalesce($4, workspace_oauth.refresh_token), expiry=$5, meta=$6, updated_at=now()`,
    [userId, provider, access, refresh || null, expiry || null, JSON.stringify(meta || {})]);
}

export async function disconnectOAuth(userId, provider) {
  await ensure();
  await q('delete from workspace_oauth where user_id=$1 and provider=$2', [userId, provider]);
  return { ok: true };
}
