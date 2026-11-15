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

function mapProject(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    name: row.name,
    description: row.description || '',
    stack: row.stack || 'static',
    status: row.status || 'draft',
    entry: row.entry || '',
    files: asJson(row.files, {}),
    plan: asJson(row.plan, null),
    createdAt: asIso(row.created_at),
    updatedAt: asIso(row.updated_at),
  };
}

function cleanName(name, fallback = 'Untitled project') {
  const n = String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  return n || fallback;
}

export async function listProjects(ownerId, limit = 100) {
  const rows = await studioQuery(
    `select id, name, description, stack, status, entry, plan, created_at, updated_at,
            (select count(*) from studio_messages m where m.project_id = studio_projects.id) as message_count
       from studio_projects where owner_id = $1 order by updated_at desc limit $2`,
    [String(ownerId), limit],
  );
  return rows.map((r) => ({
    ...mapProject(r),
    messageCount: Number(r.message_count || 0),
    fileCount: undefined,
  }));
}

export async function createProject(ownerId, { name, description = '', stack = '', files = {}, plan = null } = {}) {
  const clean = sanitizeFiles(files);
  const detected = stack || detectStack(clean);
  const entry = guessEntry(clean, detected);
  const now = nowIso();
  const row = await studioOne(
    `insert into studio_projects (owner_id, name, description, stack, status, entry, files, plan, created_at, updated_at)
     values ($1,$2,$3,$4,'draft',$5,$6,$7,$8,$8) returning *`,
    [String(ownerId), cleanName(name), String(description).slice(0, 500), detected, entry, JSON.stringify(clean), plan ? JSON.stringify(plan) : null, now],
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
  const status = patch.status ? String(patch.status).slice(0, 20) : cur.status;
  const plan = patch.plan !== undefined ? patch.plan : cur.plan;
  const now = nowIso();
  const row = await studioOne(
    `update studio_projects set name=$3, description=$4, stack=$5, status=$6, entry=$7, files=$8, plan=$9, updated_at=$10
      where id=$1 and owner_id=$2 returning *`,
    [Number(id), String(ownerId), name, description, stack, status, entry,
      JSON.stringify(files), plan ? JSON.stringify(plan) : null, now],
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
