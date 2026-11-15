/* ============================================================================
   NEXORA Studio — storage layer
   ----------------------------------------------------------------------------
   Production (Vercel): Neon Postgres through DATABASE_URL / POSTGRES_URL.
   Local development / preview: a real SQLite database (node:sqlite) so the
   workspace keeps projects, messages, revisions and runs between restarts.

   Both drivers are driven by ONE SQL dialect subset ($1 placeholders). The
   SQLite driver translates placeholders and JSON columns — no mock rows and no
   in-memory fallbacks: if neither driver is available the API says so plainly.
   ============================================================================ */

import { neon } from '@neondatabase/serverless';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

let _pg = null;
import { HttpError } from '../errors.js';

let _sqlite = null;
let _sqliteTried = false;
let _ready = null;

export class StudioError extends HttpError {
  constructor(status, code, detail = '') {
    /* extends the app-wide HttpError so the dispatcher keeps the real status and
       code instead of collapsing every Studio failure into a 500 server_error */
    super(status, code, code, detail);
    this.status = status;
    this.code = code;
    this.detail = String(detail || '').slice(0, 400);
  }
}

const PG_URL = () => process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
export const studioDriver = () => (PG_URL() ? 'postgres' : 'sqlite');

function sqlitePath() {
  const explicit = process.env.STUDIO_DB_PATH;
  if (explicit) return explicit;
  if (process.env.VERCEL) return '/tmp/nexora-studio.sqlite';     // serverless: ephemeral but real
  return join(process.cwd(), '.nexora', 'studio.sqlite');
}

async function openSqlite() {
  if (_sqlite) return _sqlite;
  if (_sqliteTried && !_sqlite) throw new StudioError(500, 'storage_unavailable', 'SQLite is not available in this Node build');
  _sqliteTried = true;
  const file = sqlitePath();
  try { mkdirSync(dirname(file), { recursive: true }); } catch { /* /tmp always exists */ }
  let DatabaseSync;
  try {
    // node:sqlite is experimental in Node 22 — the runtime warning is expected.
    ({ DatabaseSync } = await import('node:sqlite'));
  } catch (e) {
    throw new StudioError(500, 'storage_unavailable', 'cannot load node:sqlite: ' + e.message);
  }
  _sqlite = new DatabaseSync(file);
  _sqlite.exec('PRAGMA journal_mode = WAL');
  _sqlite.exec('PRAGMA foreign_keys = ON');
  return _sqlite;
}

export function storageLabel() {
  if (studioDriver() === 'postgres') return 'Neon Postgres';
  return process.env.VERCEL ? 'SQLite (ephemeral on this deployment)' : 'SQLite (local)';
}

/* ---- SQLite placeholder translation -------------------------------------
   $1 style placeholders become ? and the parameter list is expanded in the
   order the placeholders appear, so a query that reuses $1 twice binds it twice. */
function sqliteBind(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'bigint') return Number(v);
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}

function prepareSqlite(text, params = []) {
  const bound = [];
  const sql = String(text).replace(/\$(\d+)/g, (_m, n) => {
    bound.push(sqliteBind(params[Number(n) - 1]));
    return '?';
  });
  return { sql, params: bound };
}

/**
 * Run one parameterised statement. Always resolve to an array of plain rows.
 */
export async function studioQuery(text, params = []) {
  await studioEnsure();
  if (studioDriver() === 'postgres') {
    if (!_pg) _pg = neon(PG_URL());
    const rows = await _pg.query(text, params.map((v) => (v === undefined ? null : typeof v === 'object' && v !== null ? JSON.stringify(v) : v)));
    return rows.map((r) => normalizeRow(r));
  }
  const db = await openSqlite();
  const bound = prepareSqlite(text, params);
  const stmt = db.prepare(bound.sql);
  const out = stmt.all(...bound.params);
  return out.map((r) => normalizeRow(r));
}

export async function studioOne(text, params = []) {
  const rows = await studioQuery(text, params);
  return rows[0] || null;
}

function normalizeRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row || {})) {
    if (typeof v === 'bigint') out[k] = Number(v);
    else out[k] = v;
  }
  return out;
}

export const nowIso = () => new Date().toISOString();

/* ------------------------------- schema ---------------------------------- */
const PG_DDL = `
create table if not exists studio_projects (
  id bigserial primary key,
  owner_id text not null,
  name text not null,
  description text not null default '',
  stack text not null default 'static',
  status text not null default 'draft',
  entry text not null default 'index.html',
  files jsonb not null default '{}'::jsonb,
  plan jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists studio_projects_owner_idx on studio_projects(owner_id, updated_at desc);
create table if not exists studio_messages (
  id bigserial primary key,
  project_id bigint not null,
  owner_id text not null,
  role text not null,
  kind text not null default 'text',
  text text not null default '',
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists studio_messages_project_idx on studio_messages(project_id, id);
create table if not exists studio_revisions (
  id bigserial primary key,
  project_id bigint not null,
  owner_id text not null,
  label text not null default '',
  files jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists studio_revisions_project_idx on studio_revisions(project_id, id desc);
create table if not exists studio_runs (
  id bigserial primary key,
  project_id bigint,
  owner_id text not null,
  kind text not null default 'exec',
  command text not null default '',
  status text not null default 'running',
  exit_code integer,
  logs text not null default '',
  duration_ms integer,
  preview_url text,
  engine text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists studio_runs_project_idx on studio_runs(project_id, id desc);
create table if not exists studio_deployments (
  id bigserial primary key,
  project_id bigint not null,
  owner_id text not null,
  provider text not null,
  status text not null default 'queued',
  url text,
  external_id text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists studio_deployments_project_idx on studio_deployments(project_id, id desc);
create table if not exists studio_keys (
  id bigserial primary key,
  owner_id text not null,
  provider text not null,
  secret text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists studio_keys_owner_provider_idx on studio_keys(owner_id, provider);
`;

const SQLITE_DDL = `
create table if not exists studio_projects (
  id integer primary key autoincrement,
  owner_id text not null,
  name text not null,
  description text not null default '',
  stack text not null default 'static',
  status text not null default 'draft',
  entry text not null default 'index.html',
  files text not null default '{}',
  plan text,
  created_at text not null,
  updated_at text not null
);
create index if not exists studio_projects_owner_idx on studio_projects(owner_id, updated_at desc);
create table if not exists studio_messages (
  id integer primary key autoincrement,
  project_id integer not null,
  owner_id text not null,
  role text not null,
  kind text not null default 'text',
  text text not null default '',
  meta text not null default '{}',
  created_at text not null
);
create index if not exists studio_messages_project_idx on studio_messages(project_id, id);
create table if not exists studio_revisions (
  id integer primary key autoincrement,
  project_id integer not null,
  owner_id text not null,
  label text not null default '',
  files text not null default '{}',
  created_at text not null
);
create index if not exists studio_revisions_project_idx on studio_revisions(project_id, id desc);
create table if not exists studio_runs (
  id integer primary key autoincrement,
  project_id integer,
  owner_id text not null,
  kind text not null default 'exec',
  command text not null default '',
  status text not null default 'running',
  exit_code integer,
  logs text not null default '',
  duration_ms integer,
  preview_url text,
  engine text not null default '',
  created_at text not null
);
create index if not exists studio_runs_project_idx on studio_runs(project_id, id desc);
create table if not exists studio_deployments (
  id integer primary key autoincrement,
  project_id integer not null,
  owner_id text not null,
  provider text not null,
  status text not null default 'queued',
  url text,
  external_id text,
  meta text not null default '{}',
  created_at text not null
);
create index if not exists studio_deployments_project_idx on studio_deployments(project_id, id desc);
create table if not exists studio_keys (
  id integer primary key autoincrement,
  owner_id text not null,
  provider text not null,
  secret text not null,
  meta text not null default '{}',
  created_at text not null,
  updated_at text not null
);
create unique index if not exists studio_keys_owner_provider_idx on studio_keys(owner_id, provider);
`;

export async function studioEnsure() {
  if (_ready) return _ready;
  _ready = (async () => {
    const ddl = studioDriver() === 'postgres' ? PG_DDL : SQLITE_DDL;
    if (studioDriver() === 'postgres') {
      if (!_pg) _pg = neon(PG_URL());
      for (const stmt of ddl.split(';').map((s) => s.trim()).filter(Boolean)) {
        await _pg.query(stmt, []);
      }
    } else {
      const db = await openSqlite();
      db.exec(ddl);
    }
    return true;
  })().catch((e) => {
    _ready = null;
    throw new StudioError(500, 'storage_unavailable', e.message);
  });
  return _ready;
}

/** Health probe used by /api/studio/session — never throws. */
export async function studioHealth() {
  const ephemeral = studioDriver() === 'sqlite' && Boolean(process.env.VERCEL);
  try {
    await studioEnsure();
    return {
      ok: true, driver: studioDriver(), label: storageLabel(), ephemeral,
      hint: ephemeral ? 'set DATABASE_URL to keep projects between deployments' : undefined,
    };
  } catch (e) {
    return { ok: false, driver: studioDriver(), label: storageLabel(), ephemeral, error: e.message };
  }
}
