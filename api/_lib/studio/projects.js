/* ============================================================================
   NEXORA Studio — repositories (projects, messages, revisions, runs, deploys)
   ============================================================================ */

import { studioQuery, studioOne, nowIso, StudioError } from './db.js';
import { sanitizeFiles, detectStack, guessEntry } from './files.js';

const asJson = (v, fallback) => {
  if (v === null || v === undefined) return fallback;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return fallback; }
};
const asIso = (v) => (v instanceof Date ? v.toISOString() : (typeof v === 'string' ? v : ''));

function cleanMeta(raw, base = {}) {
  const src = { ...(base && typeof base === 'object' ? base : {}), ...(raw && typeof raw === 'object' ? raw : {}) };
  const out = {};
  if (src.archived !== undefined) out.archived = Boolean(src.archived);
  if (src.archivedAt) out.archivedAt = String(src.archivedAt).slice(0, 40);
  if (src.archived === false) delete out.archivedAt;
  if (typeof src.repo === 'string') out.repo = src.repo.trim().slice(0, 140);
  if (typeof src.branch === 'string') out.branch = src.branch.trim().slice(0, 140);
  if (typeof src.defaultBranch === 'string') out.defaultBranch = src.defaultBranch.trim().slice(0, 140);
  if (typeof src.vercelProjectId === 'string') out.vercelProjectId = src.vercelProjectId.trim().slice(0, 120);
  if (typeof src.vercelProjectName === 'string') out.vercelProjectName = src.vercelProjectName.trim().slice(0, 120);
  if (typeof src.kind === 'string' && ['chat', 'project'].includes(src.kind)) out.kind = src.kind;
  if (Number.isFinite(Number(src.acceptedRevId)) && Number(src.acceptedRevId) > 0) out.acceptedRevId = Number(src.acceptedRevId);
  return out;
}

function mapProject(row) {
  if (!row) return null;
  const meta = cleanMeta(asJson(row.meta, {}));
  return {
    id: Number(row.id),
    name: row.name,
    description: row.description || '',
    stack: row.stack || 'static',
    status: row.status || 'draft',
    entry: row.entry || '',
    files: asJson(row.files, {}),
    plan: asJson(row.plan, null),
    meta,
    archived: Boolean(meta.archived || row.status === 'archived'),
    createdAt: asIso(row.created_at),
    updatedAt: asIso(row.updated_at),
  };
}

function cleanName(name, fallback = 'Untitled project') {
  const n = String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  return n || fallback;
}

export async function listProjects(ownerId, limit = 150) {
  const rows = await studioQuery(
    `select id, name, description, stack, status, entry, files, plan, meta, created_at, updated_at,
            (select count(*) from studio_messages m where m.project_id = studio_projects.id) as message_count
       from studio_projects where owner_id = $1 order by updated_at desc limit $2`,
    [String(ownerId), limit],
  );
  return rows.map((r) => {
    const mapped = mapProject(r);
    const fileCount = Object.keys(mapped.files || {}).length;
    return {
      ...mapped,
      files: undefined,
      messageCount: Number(r.message_count || 0),
      fileCount,
    };
  });
}

export async function createProject(ownerId, { name, description = '', stack = '', files = {}, plan = null, meta = {} } = {}) {
  const clean = sanitizeFiles(files);
  const detected = stack || detectStack(clean);
  const entry = guessEntry(clean, detected);
  const metaObj = cleanMeta(meta);
  const now = nowIso();
  const row = await studioOne(
    `insert into studio_projects (owner_id, name, description, stack, status, entry, files, plan, meta, created_at, updated_at)
     values ($1,$2,$3,$4,'draft',$5,$6,$7,$8,$9,$9) returning *`,
    [String(ownerId), cleanName(name), String(description).slice(0, 500), detected, entry,
      JSON.stringify(clean), plan ? JSON.stringify(plan) : null, JSON.stringify(metaObj), now],
  );
  return mapProject(row);
}

export async function getProject(ownerId, id) {
  const row = await studioOne('select * from studio_projects where id = $1 and owner_id = $2', [Number(id), String(ownerId)]);
  if (!row) throw new StudioError(404, 'project_not_found');
  return mapProject(row);
}

export async function updateProject(ownerId, id, patch = {}) {
  const cur = await getProject(ownerId, id);
  const files = patch.files !== undefined ? sanitizeFiles(patch.files) : cur.files;
  const stack = patch.stack || detectStack(files) || cur.stack;
  const entry = patch.entry !== undefined ? patch.entry : guessEntry(files, stack);
  const name = patch.name !== undefined ? cleanName(patch.name, cur.name) : cur.name;
  const description = patch.description !== undefined ? String(patch.description).slice(0, 500) : cur.description;
  const plan = patch.plan !== undefined ? patch.plan : cur.plan;
  const now = nowIso();
  const nextMetaInput = { ...(patch.meta && typeof patch.meta === 'object' ? patch.meta : {}) };
  if (patch.archived !== undefined) {
    nextMetaInput.archived = Boolean(patch.archived);
    nextMetaInput.archivedAt = patch.archived ? now : '';
  }
  const meta = cleanMeta(nextMetaInput, cur.meta);
  let status = patch.status ? String(patch.status).slice(0, 20) : cur.status;
  if (patch.archived === true) status = 'archived';
  else if (patch.archived === false && status === 'archived') status = Object.keys(files).length ? 'ready' : 'draft';
  const row = await studioOne(
    `update studio_projects set name=$3, description=$4, stack=$5, status=$6, entry=$7, files=$8, plan=$9, meta=$10, updated_at=$11
      where id=$1 and owner_id=$2 returning *`,
    [Number(id), String(ownerId), name, description, stack, status, entry,
      JSON.stringify(files), plan ? JSON.stringify(plan) : null, JSON.stringify(meta), now],
  );
  if (!row) throw new StudioError(404, 'project_not_found');
  return mapProject(row);
}

export async function deleteProject(ownerId, id) {
  await getProject(ownerId, id);
  const owner = String(ownerId);
  const pid = Number(id);
  await studioQuery('delete from studio_messages where project_id=$1 and owner_id=$2', [pid, owner]);
  await studioQuery('delete from studio_revisions where project_id=$1 and owner_id=$2', [pid, owner]);
  await studioQuery('delete from studio_deployments where project_id=$1 and owner_id=$2', [pid, owner]);
  await studioQuery('update studio_runs set project_id=null where project_id=$1 and owner_id=$2', [pid, owner]);
  await studioQuery('update studio_model_events set project_id=null where project_id=$1 and owner_id=$2', [pid, owner]);
  await studioQuery('delete from studio_projects where id=$1 and owner_id=$2', [pid, owner]);
  return { ok: true };
}

/* ------------------------------- messages -------------------------------- */
function mapMessage(row) {
  return {
    id: Number(row.id),
    projectId: Number(row.project_id),
    role: row.role,
    kind: row.kind || 'text',
    text: row.text || '',
    meta: asJson(row.meta, {}),
    createdAt: asIso(row.created_at),
  };
}

export async function addMessage(ownerId, projectId, { role, text = '', kind = 'text', meta = {} } = {}) {
  const now = nowIso();
  const row = await studioOne(
    `insert into studio_messages (project_id, owner_id, role, kind, text, meta, created_at)
     values ($1,$2,$3,$4,$5,$6,$7) returning *`,
    [Number(projectId), String(ownerId), String(role).slice(0, 20), String(kind).slice(0, 20), String(text).slice(0, 200_000), JSON.stringify(meta || {}), now],
  );
  return mapMessage(row);
}

export async function listMessages(ownerId, projectId, limit = 200) {
  const rows = await studioQuery(
    'select * from studio_messages where project_id=$1 and owner_id=$2 order by id asc limit $3',
    [Number(projectId), String(ownerId), limit],
  );
  return rows.map(mapMessage);
}

/* ------------------------------- revisions ------------------------------- */
export async function addRevision(ownerId, projectId, files, label = '') {
  const now = nowIso();
  const row = await studioOne(
    `insert into studio_revisions (project_id, owner_id, label, files, created_at)
     values ($1,$2,$3,$4,$5) returning id, created_at`,
    [Number(projectId), String(ownerId), String(label).slice(0, 120), JSON.stringify(files || {}), now],
  );
  // keep the latest 40 revisions per project — real pruning, not a pretend cap
  await studioQuery(
    `delete from studio_revisions where owner_id=$1 and project_id=$2 and id not in
       (select id from studio_revisions where owner_id=$1 and project_id=$2 order by id desc limit 40)`,
    [String(ownerId), Number(projectId)],
  );
  return { id: Number(row.id), createdAt: asIso(row.created_at), label };
}

export async function listRevisions(ownerId, projectId, limit = 40) {
  const rows = await studioQuery(
    'select id, label, created_at from studio_revisions where project_id=$1 and owner_id=$2 order by id desc limit $3',
    [Number(projectId), String(ownerId), limit],
  );
  return rows.map((r) => ({ id: Number(r.id), label: r.label, createdAt: asIso(r.created_at) }));
}

export async function getRevision(ownerId, projectId, revisionId) {
  const row = await studioOne(
    'select * from studio_revisions where id=$1 and project_id=$2 and owner_id=$3',
    [Number(revisionId), Number(projectId), String(ownerId)],
  );
  if (!row) throw new StudioError(404, 'revision_not_found');
  return { id: Number(row.id), files: asJson(row.files, {}), label: row.label, createdAt: asIso(row.created_at) };
}

/* --------------------------------- runs ---------------------------------- */
export async function addRun(ownerId, { projectId = null, kind = 'exec', command = '', engine = '', status = 'running' } = {}) {
  const row = await studioOne(
    `insert into studio_runs (project_id, owner_id, kind, command, status, logs, engine, created_at)
     values ($1,$2,$3,$4,$5,'',$6,$7) returning id`,
    [projectId ? Number(projectId) : null, String(ownerId), String(kind).slice(0, 20), String(command).slice(0, 2000), status, engine, nowIso()],
  );
  return Number(row.id);
}

export async function finishRun(ownerId, runId, { status = 'success', exitCode = 0, logs = '', durationMs = 0, previewUrl = null } = {}) {
  await studioQuery(
    `update studio_runs set status=$3, exit_code=$4, logs=$5, duration_ms=$6, preview_url=$7
      where id=$1 and owner_id=$2`,
    [Number(runId), String(ownerId), status, Number(exitCode) || 0, String(logs).slice(0, 200_000), Number(durationMs) || 0, previewUrl],
  );
}

export async function listRuns(ownerId, projectId = null, limit = 30) {
  const rows = projectId
    ? await studioQuery('select id, project_id, kind, command, status, exit_code, duration_ms, preview_url, engine, created_at from studio_runs where owner_id=$1 and project_id=$2 order by id desc limit $3', [String(ownerId), Number(projectId), limit])
    : await studioQuery('select id, project_id, kind, command, status, exit_code, duration_ms, preview_url, engine, created_at from studio_runs where owner_id=$1 order by id desc limit $2', [String(ownerId), limit]);
  return rows.map((r) => ({
    id: Number(r.id), projectId: r.project_id ? Number(r.project_id) : null, kind: r.kind, command: r.command,
    status: r.status, exitCode: r.exit_code, durationMs: r.duration_ms, previewUrl: r.preview_url, engine: r.engine,
    createdAt: asIso(r.created_at),
  }));
}

export async function getRun(ownerId, runId) {
  const row = await studioOne('select * from studio_runs where id=$1 and owner_id=$2', [Number(runId), String(ownerId)]);
  if (!row) throw new StudioError(404, 'run_not_found');
  return { ...row, id: Number(row.id), logs: row.logs || '', createdAt: asIso(row.created_at) };
}

/* ------------------------------ deployments ------------------------------ */
export async function addDeployment(ownerId, projectId, { provider, status = 'queued', url = null, externalId = null, meta = {} } = {}) {
  const row = await studioOne(
    `insert into studio_deployments (project_id, owner_id, provider, status, url, external_id, meta, created_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning id, created_at`,
    [Number(projectId), String(ownerId), provider, status, url, externalId, JSON.stringify(meta || {}), nowIso()],
  );
  return { id: Number(row.id), provider, status, url, createdAt: asIso(row.created_at) };
}

export async function updateDeployment(ownerId, id, patch = {}) {
  const cur = await studioOne('select * from studio_deployments where id=$1 and owner_id=$2', [Number(id), String(ownerId)]);
  if (!cur) throw new StudioError(404, 'deployment_not_found');
  await studioQuery(
    'update studio_deployments set status=$3, url=$4, external_id=$5, meta=$6 where id=$1 and owner_id=$2',
    [Number(id), String(ownerId), patch.status || cur.status, patch.url || cur.url, patch.externalId || cur.external_id,
      JSON.stringify({ ...asJson(cur.meta, {}), ...(patch.meta || {}) })],
  );
}

export async function listDeployments(ownerId, projectId, limit = 20) {
  const rows = await studioQuery(
    'select * from studio_deployments where project_id=$1 and owner_id=$2 order by id desc limit $3',
    [Number(projectId), String(ownerId), limit],
  );
  return rows.map((r) => ({
    id: Number(r.id), provider: r.provider, status: r.status, url: r.url, externalId: r.external_id,
    meta: asJson(r.meta, {}), createdAt: asIso(r.created_at),
  }));
}

/* ----------------------------- leaderboard ------------------------------- */
export async function recordModelEvent(ownerId, {
  projectId = null, messageId = null, provider, model, mode = 'agent',
  durationMs = 0, filesChanged = 0, ok = true, vote = 0,
} = {}) {
  if (!provider) return null;
  const row = await studioOne(
    `insert into studio_model_events (owner_id, project_id, message_id, provider, model, mode, duration_ms, files_changed, ok, vote, created_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id`,
    [
      String(ownerId),
      projectId ? Number(projectId) : null,
      messageId ? Number(messageId) : null,
      String(provider).slice(0, 40),
      String(model || provider).slice(0, 120),
      String(mode || 'agent').slice(0, 30),
      Math.max(0, Math.round(Number(durationMs) || 0)),
      Math.max(0, Math.round(Number(filesChanged) || 0)),
      ok ? 1 : 0,
      vote > 0 ? 1 : (vote < 0 ? -1 : 0),
      nowIso(),
    ],
  );
  return row ? Number(row.id) : null;
}

export async function voteMessage(ownerId, messageId, rawVote) {
  const mid = Number(messageId);
  const owner = String(ownerId);
  const vote = rawVote > 0 ? 1 : (rawVote < 0 ? -1 : 0);
  const msg = await studioOne('select * from studio_messages where id=$1 and owner_id=$2', [mid, owner]);
  if (!msg) throw new StudioError(404, 'message_not_found');
  const meta = { ...asJson(msg.meta, {}), vote };
  await studioQuery('update studio_messages set meta=$3 where id=$1 and owner_id=$2', [mid, owner, JSON.stringify(meta)]);
  const ev = await studioOne('select id from studio_model_events where message_id=$1 and owner_id=$2 order by id desc limit 1', [mid, owner]);
  if (ev) {
    await studioQuery('update studio_model_events set vote=$3 where id=$1 and owner_id=$2', [Number(ev.id), owner, vote]);
  } else if (meta.provider) {
    await recordModelEvent(owner, {
      projectId: Number(msg.project_id) || null,
      messageId: mid,
      provider: meta.provider,
      model: meta.model || meta.provider,
      mode: 'vote',
      ok: true,
      vote,
    });
  }
  return { id: mid, vote };
}

export async function listModelStats() {
  const rows = await studioQuery(
    `select provider, model, mode, duration_ms, files_changed, ok, vote, created_at
       from studio_model_events order by id desc limit 2000`,
    [],
  );
  const buckets = new Map();
  for (const r of rows) {
    const key = `${r.provider}::${r.model}`;
    let b = buckets.get(key);
    if (!b) {
      b = {
        provider: r.provider,
        model: r.model,
        runs: 0,
        successful: 0,
        benchmarks: 0,
        filesChanged: 0,
        totalMs: 0,
        timedRuns: 0,
        lastLatencyMs: null,
        upvotes: 0,
        downvotes: 0,
        lastUsedAt: asIso(r.created_at),
      };
      buckets.set(key, b);
    }
    if (r.mode === 'benchmark') {
      b.benchmarks += 1;
      if (Number(r.ok)) {
        const ms = Number(r.duration_ms) || 0;
        if (ms > 0) {
          if (b.lastLatencyMs === null) b.lastLatencyMs = ms;
          b.totalMs += ms;
          b.timedRuns += 1;
        }
      }
    } else if (r.mode !== 'vote') {
      b.runs += 1;
      if (Number(r.ok)) b.successful += 1;
      b.filesChanged += Number(r.files_changed) || 0;
      const ms = Number(r.duration_ms) || 0;
      if (ms > 0) {
        if (b.lastLatencyMs === null) b.lastLatencyMs = ms;
        b.totalMs += ms;
        b.timedRuns += 1;
      }
    }
    const v = Number(r.vote) || 0;
    if (v > 0) b.upvotes += 1;
    if (v < 0) b.downvotes += 1;
  }
  return [...buckets.values()].map((b) => ({
    provider: b.provider,
    model: b.model,
    runs: b.runs,
    successful: b.successful,
    successRate: b.runs ? Math.round((b.successful / b.runs) * 100) : null,
    benchmarks: b.benchmarks,
    filesChanged: b.filesChanged,
    avgLatencyMs: b.timedRuns ? Math.round(b.totalMs / b.timedRuns) : null,
    lastLatencyMs: b.lastLatencyMs,
    upvotes: b.upvotes,
    downvotes: b.downvotes,
    netVotes: b.upvotes - b.downvotes,
    lastUsedAt: b.lastUsedAt,
  }));
}
