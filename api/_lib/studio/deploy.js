/* ============================================================================
   NEXORA Studio — publishing
   ----------------------------------------------------------------------------
   Real calls to the Vercel REST API (v13 deployments) and the GitHub Git Data
   API (blobs → tree → commit → ref). Tokens come from the account vault or the
   server environment; when none exists the call fails with a clear message and
   the UI sends the user to the connection panel.
   ============================================================================ */

import { StudioError } from './db.js';
import { getIntegrationSecret } from './ai.js';
import { sanitizeFiles } from './files.js';

const GH_API = 'https://api.github.com';
const VERCEL_API = 'https://api.vercel.com';

const slug = (s) => String(s || 'nexora-app')
  .toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'nexora-app';

/* -------------------------------- GitHub --------------------------------- */
async function gh(token, path, { method = 'GET', body } = {}) {
  const res = await fetch(GH_API + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'NEXORA-Studio',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(25_000),
  });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text.slice(0, 300) }; }
  return { ok: res.ok, status: res.status, data };
}

export async function githubToken(ownerId) {
  const mine = await getIntegrationSecret(ownerId, 'github').catch(() => null);
  if (mine?.key) return { token: mine.key, source: 'account' };
  const env = process.env.GITHUB_STUDIO_TOKEN || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (env) return { token: env, source: 'server' };
  return null;
}

export async function githubStatus(ownerId) {
  const t = await githubToken(ownerId).catch(() => null);
  if (!t) return { connected: false };
  const me = await gh(t.token, '/user');
  if (!me.ok) return { connected: false, error: 'token ' + me.status };
  return { connected: true, source: t.source, login: me.data.login, avatar: me.data.avatar_url };
}

/**
 * Create (or reuse) a repository and push the whole file set as one commit.
 */
export async function pushToGitHub(ownerId, { files, repoName, isPrivate = true, message = 'NEXORA Studio: publish project', branch = 'main', projectName = '' }) {
  const auth = await githubToken(ownerId);
  if (!auth) throw new StudioError(400, 'github_not_connected', 'connect a GitHub token in Studio settings');
  const safeFiles = sanitizeFiles(files, { maxFiles: 120, maxFileBytes: 400_000, maxTotalBytes: 2_000_000 });
  const paths = Object.keys(safeFiles);
  if (!paths.length) throw new StudioError(400, 'files_required');

  const me = await gh(auth.token, '/user');
  if (!me.ok) throw new StudioError(401, 'github_auth_failed', `GitHub rejected the token (${me.status})`);
  const owner = me.data.login;
  const name = slug(repoName || projectName || 'nexora-app');

  // 1) repository
  let repo = await gh(auth.token, `/repos/${owner}/${name}`);
  let created = false;
  if (!repo.ok) {
    const create = await gh(auth.token, '/user/repos', {
      method: 'POST',
      body: { name, private: Boolean(isPrivate), description: 'Built with NEXORA Studio', auto_init: false },
    });
    if (!create.ok) throw new StudioError(502, 'github_repo_failed', (create.data?.message || 'cannot create repository') + ` (${create.status})`);
    repo = { ok: true, data: create.data };
    created = true;
  }

  // 2) head commit (empty repo has none)
  const ref = await gh(auth.token, `/repos/${owner}/${name}/git/ref/heads/${branch}`);
  const parentSha = ref.ok ? ref.data?.object?.sha : null;

  // 3) blobs
  const tree = [];
  for (const path of paths.slice(0, 120)) {
    const blob = await gh(auth.token, `/repos/${owner}/${name}/git/blobs`, {
      method: 'POST',
      body: { content: safeFiles[path], encoding: 'utf-8' },
    });
    if (!blob.ok) throw new StudioError(502, 'github_blob_failed', `${path}: ${blob.data?.message || blob.status}`);
    tree.push({ path, mode: '100644', type: 'blob', sha: blob.data.sha });
  }

  // 4) tree + commit
  const newTree = await gh(auth.token, `/repos/${owner}/${name}/git/trees`, { method: 'POST', body: { tree } });
  if (!newTree.ok) throw new StudioError(502, 'github_tree_failed', newTree.data?.message || String(newTree.status));
  const commit = await gh(auth.token, `/repos/${owner}/${name}/git/commits`, {
    method: 'POST',
    body: { message, tree: newTree.data.sha, parents: parentSha ? [parentSha] : [] },
  });
  if (!commit.ok) throw new StudioError(502, 'github_commit_failed', commit.data?.message || String(commit.status));

  // 5) move the branch
  let refUpdate;
  if (parentSha) {
    refUpdate = await gh(auth.token, `/repos/${owner}/${name}/git/refs/heads/${branch}`, { method: 'PATCH', body: { sha: commit.data.sha, force: true } });
  } else {
    refUpdate = await gh(auth.token, `/repos/${owner}/${name}/git/refs`, { method: 'POST', body: { ref: `refs/heads/${branch}`, sha: commit.data.sha } });
  }
  if (!refUpdate.ok) throw new StudioError(502, 'github_ref_failed', refUpdate.data?.message || String(refUpdate.status));

  return {
    provider: 'github',
    repo: `${owner}/${name}`,
    branch,
    created,
    commitSha: commit.data.sha,
    commitUrl: commit.data.html_url,
    url: `https://github.com/${owner}/${name}`,
    files: tree.length,
    account: me.data.login,
  };
}

/* -------------------------------- Vercel --------------------------------- */
async function vc(token, path, { method = 'GET', body } = {}) {
  const team = process.env.VERCEL_TEAM_ID ? `${path.includes('?') ? '&' : '?'}teamId=${encodeURIComponent(process.env.VERCEL_TEAM_ID)}` : '';
  const res = await fetch(VERCEL_API + path + team, {
    method,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text.slice(0, 300) }; }
  return { ok: res.ok, status: res.status, data };
}

export async function vercelToken(ownerId) {
  const mine = await getIntegrationSecret(ownerId, 'vercel').catch(() => null);
  if (mine?.key) return { token: mine.key, source: 'account' };
  const env = process.env.VERCEL_STUDIO_TOKEN || process.env.VERCEL_TOKEN || process.env.VERCEL_API_TOKEN;
  if (env) return { token: env, source: 'server' };
  return null;
}

export async function vercelStatus(ownerId) {
  const t = await vercelToken(ownerId).catch(() => null);
  if (!t) return { connected: false };
  const me = await vc(t.token, '/v2/user');
  if (!me.ok) return { connected: false, error: 'token ' + me.status };
  return { connected: true, source: t.source, username: me.data?.user?.username || me.data?.user?.name || '', team: process.env.VERCEL_TEAM_ID || null };
}

/**
 * Deploy the files as a static/Vite build. Vercel runs the framework build when
 * a package.json is present; plain HTML projects are served directly.
 */
export async function deployToVercel(ownerId, { files, projectName, stack = 'static', target = 'production' }) {
  const auth = await vercelToken(ownerId);
  if (!auth) throw new StudioError(400, 'vercel_not_connected', 'connect a Vercel token in Studio settings');
  const safeFiles = sanitizeFiles(files, { maxFiles: 150, maxFileBytes: 400_000, maxTotalBytes: 3_000_000 });
  const entries = Object.entries(safeFiles);
  if (!entries.length) throw new StudioError(400, 'files_required');

  const name = slug(projectName);
  const payloadFiles = entries.map(([file, content]) => ({
    file: file.replace(/^\/+/, ''),
    data: Buffer.from(content, 'utf8').toString('base64'),
    encoding: 'base64',
  }));
  const framework = stack === 'vite-react' ? 'vite' : stack === 'next' ? 'nextjs' : null;
  const body = {
    name,
    files: payloadFiles,
    target,
    projectSettings: framework
      ? { framework, buildCommand: null, outputDirectory: null, installCommand: null, devCommand: null }
      : { framework: null, buildCommand: null, outputDirectory: null, installCommand: null, devCommand: null },
  };
  let res = await vc(auth.token, '/v13/deployments', { method: 'POST', body });
  if (!res.ok && res.status === 409) {          // project name taken by another scope → suffix it
    body.name = `${name}-${Math.random().toString(36).slice(2, 6)}`;
    res = await vc(auth.token, '/v13/deployments', { method: 'POST', body });
  }
  if (!res.ok) {
    const msg = res.data?.error?.message || res.data?.message || ('vercel ' + res.status);
    throw new StudioError(502, 'vercel_deploy_failed', String(msg).slice(0, 240));
  }
  const deployment = res.data || {};
  return {
    provider: 'vercel',
    id: deployment.id,
    url: deployment.url ? `https://${deployment.url}` : null,
    inspectorUrl: deployment.inspectorUrl || null,
    state: deployment.readyState || deployment.status || 'QUEUED',
    project: deployment.name || body.name,
    target,
  };
}

export async function vercelDeploymentState(ownerId, deploymentId) {
  const auth = await vercelToken(ownerId);
  if (!auth) throw new StudioError(400, 'vercel_not_connected');
  const res = await vc(auth.token, `/v13/deployments/${encodeURIComponent(deploymentId)}`);
  if (!res.ok) throw new StudioError(502, 'vercel_status_failed', res.data?.error?.message || String(res.status));
  const d = res.data || {};
  return { state: d.readyState || d.status, url: d.url ? `https://${d.url}` : null, alias: (d.alias || [])[0] || null };
}
