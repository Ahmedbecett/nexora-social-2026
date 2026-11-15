/* ============================================================================
   NEXORA Studio — execution engine
   ----------------------------------------------------------------------------
   Two real engines, one interface:

   • local  — a Node process on the same host as the API. Used by `npm run
              studio` (and by the sandbox preview): commands really run, dev
              servers really listen, and the URL is proxied back to the browser.
   • e2b    — a remote isolated sandbox, used on serverless deployments when
              E2B_API_KEY is set. Files are uploaded, commands execute inside
              the VM and the dev-server port is exposed by E2B.

   If neither is available the engine says so; it never prints a fabricated
   "build succeeded".
   ============================================================================ */

import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile, readdir, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import net from 'node:net';
import { StudioError } from './db.js';
import { normalizePath } from './files.js';

const WORK_ROOT = process.env.STUDIO_WORK_DIR || join(process.cwd(), '.nexora', 'studio', 'work');
const MAX_COMMAND = 2000;
const DEFAULT_TIMEOUT = 60_000;
const devServers = new Map();  // projectId -> { proc, port, url, logs, startedAt, kind }
const activeRuns = new Map();  // ownerId -> count

export function execEngine() {
  if (process.env.E2B_API_KEY) return 'e2b';
  if (String(process.env.STUDIO_LOCAL_EXEC || '1') !== '0') return 'local';
  return 'none';
}

export function execCapabilities() {
  const engine = execEngine();
  return {
    engine,
    label: engine === 'e2b' ? 'E2B sandbox' : engine === 'local' ? 'Local runner' : 'Unavailable',
    canRun: engine !== 'none',
    canDevServer: engine !== 'none',
    workdir: engine === 'local' ? WORK_ROOT : null,
    note: engine === 'e2b'
      ? 'Commands run in a remote isolated sandbox.'
      : engine === 'local'
        ? 'Commands run on the Studio host in an isolated project folder.'
        : 'Set E2B_API_KEY to enable real execution on this deployment.',
  };
}

/* --------------------------- public preview URL --------------------------- */
export function publicPreviewUrl(port) {
  const tpl = process.env.STUDIO_PREVIEW_URL_TEMPLATE;
  if (tpl) return tpl.replace('{port}', String(port));
  if (process.env.E2B_SANDBOX_ID) return `https://${port}-${process.env.E2B_SANDBOX_ID}.e2b.app`;
  return `http://127.0.0.1:${port}`;
}

/* ------------------------------ local helpers ----------------------------- */
function workspaceDir(projectId) {
  const id = String(projectId || 'scratch').replace(/[^\w-]/g, '');
  return resolve(WORK_ROOT, id);
}

async function writeProjectFiles(dir, files) {
  await mkdir(dir, { recursive: true });
  for (const [rawPath, content] of Object.entries(files || {})) {
    const p = normalizePath(rawPath);
    if (!p) continue;
    const full = resolve(dir, p);
    if (!full.startsWith(resolve(dir))) continue;        // no traversal
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, String(content), 'utf8');
  }
}

export async function resetWorkspace(projectId) {
  const dir = workspaceDir(projectId);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  return dir;
}

async function listWorkspace(dir, root = dir, depth = 0) {
  if (depth > 3) return [];
  const out = [];
  let entries = [];
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries.slice(0, 60)) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const full = join(dir, e.name);
    const rel = full.slice(root.length + 1);
    if (e.isDirectory()) out.push({ path: rel + '/', type: 'dir' });
    else {
      const s = await stat(full).catch(() => null);
      out.push({ path: rel, type: 'file', size: s?.size || 0 });
    }
  }
  return out;
}

/* ------------------------------- command run ------------------------------ */
function limitFor(ownerId) {
  const max = Number(process.env.STUDIO_MAX_CONCURRENT_RUNS || 2);
  return Math.max(1, max);
}

/**
 * Run one command against the project's files and stream its real output.
 */
export async function runCommand({ ownerId, projectId, files, command, kind = 'exec', timeoutMs = DEFAULT_TIMEOUT, onLog }) {
  const cmd = String(command || '').trim().slice(0, MAX_COMMAND);
  if (!cmd) throw new StudioError(400, 'command_required');
  const engine = execEngine();
  if (engine === 'none') throw new StudioError(503, 'exec_unavailable', 'no execution engine is configured on this deployment');

  const running = activeRuns.get(String(ownerId)) || 0;
  if (running >= limitFor(ownerId)) throw new StudioError(429, 'too_many_runs', 'another command is still running — wait for it to finish');
  activeRuns.set(String(ownerId), running + 1);

  const started = Date.now();
  try {
    if (engine === 'e2b') return await runE2B({ projectId, files, command: cmd, timeoutMs, onLog, kind });
    return await runLocal({ projectId, files, command: cmd, timeoutMs, onLog, kind });
  } finally {
    const left = (activeRuns.get(String(ownerId)) || 1) - 1;
    if (left <= 0) activeRuns.delete(String(ownerId)); else activeRuns.set(String(ownerId), left);
    void started;
  }
}

function runLocal({ projectId, files, command, timeoutMs, onLog, kind }) {
  return new Promise(async (resolvePromise) => {
    const dir = workspaceDir(projectId);
    try {
      await writeProjectFiles(dir, files);
    } catch (e) {
      resolvePromise({ logs: `✗ cannot write workspace: ${e.message}\n`, exitCode: 1, engine: 'local', durationMs: 0, previewUrl: null });
      return;
    }
    const started = Date.now();
    const logs = [];
    const push = (chunk) => {
      const text = String(chunk);
      logs.push(text);
      if (onLog) onLog(text);
    };
    const shell = process.platform === 'win32' ? 'cmd' : 'bash';
    const args = process.platform === 'win32' ? ['/d', '/s', '/c', command] : ['-lc', command];
    push(`$ ${command}\n`);
    let child;
    try {
      child = spawn(shell, args, { cwd: dir, env: { ...process.env, CI: '1', FORCE_COLOR: '0', NO_COLOR: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      resolvePromise({ logs: `✗ cannot start command: ${e.message}\n`, exitCode: 1, engine: 'local', durationMs: Date.now() - started, previewUrl: null });
      return;
    }
    let killed = false;
    const timer = setTimeout(() => { killed = true; try { child.kill('SIGKILL'); } catch { /* gone */ } }, timeoutMs);
    child.stdout.on('data', (d) => push(d.toString('utf8')));
    child.stderr.on('data', (d) => push(d.toString('utf8')));
    child.on('error', (e) => push(`✗ ${e.message}\n`));
    child.on('close', (code) => {
      clearTimeout(timer);
      const durationMs = Date.now() - started;
      const tail = `\n[exit ${code}${killed ? ' · killed after timeout' : ''} · ${durationMs}ms]\n`;
      push(tail);
      resolvePromise({
        logs: logs.join(''),
        exitCode: code === null ? 1 : code,
        engine: 'local',
        durationMs,
        killed,
        previewUrl: kind === 'dev' ? findPortInLogs(logs.join('')) : null,
      });
    });
  });
}

async function runE2B({ projectId, files, command, timeoutMs, onLog, kind }) {
  const started = Date.now();
  let sandbox = null;
  const logs = [];
  const push = (t) => { logs.push(t); if (onLog) onLog(t); };
  try {
    const { Sandbox } = await import('e2b');
    push(`> creating E2B sandbox…\n`);
    sandbox = await Sandbox.create({ apiKey: process.env.E2B_API_KEY, timeoutMs: Math.max(timeoutMs + 30_000, 90_000), template: process.env.E2B_TEMPLATE_ID || undefined });
    push(`✓ sandbox ${sandbox.sandboxId || ''}\n`);
    const dir = '/home/user/app';
    await sandbox.commands.run(`mkdir -p ${dir}`);
    for (const [rawPath, content] of Object.entries(files || {})) {
      const p = normalizePath(rawPath);
      if (!p) continue;
      const full = `${dir}/${p}`;
      const parent = full.slice(0, full.lastIndexOf('/'));
      if (parent !== dir) await sandbox.commands.run(`mkdir -p "${parent}"`);
      await sandbox.files.write(full, String(content));
    }
    push(`> ${command}\n`);
    const res = await sandbox.commands.run(`cd ${dir} && ${command}`, {
      timeoutMs,
      onStdout: (d) => push(typeof d === 'string' ? d : d?.stdout || ''),
      onStderr: (d) => push(typeof d === 'string' ? d : d?.stderr || ''),
    });
    const out = `${res?.stdout || ''}${res?.stderr || ''}`;
    if (out) push(out);
    const exitCode = res?.exitCode ?? 0;
    push(`\n[exit ${exitCode} · ${Date.now() - started}ms · e2b]\n`);
    let previewUrl = null;
    if (kind === 'dev') {
      const port = findPortInLogs(logs.join('')) || 5173;
      try { previewUrl = `https://${sandbox.getHost(port)}`; } catch { previewUrl = null; }
    }
    return { logs: logs.join(''), exitCode, engine: 'e2b', durationMs: Date.now() - started, previewUrl };
  } catch (e) {
    push(`\n✗ E2B error: ${e.message}\n`);
    return { logs: logs.join(''), exitCode: 1, engine: 'e2b', durationMs: Date.now() - started, previewUrl: null };
  } finally {
    if (sandbox && !kind.startsWith('dev')) { try { await sandbox.kill(); } catch { /* expired */ } }
  }
}

export function findPortInLogs(text) {
  const m = String(text).match(/https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):(\d{2,5})/i);
  if (m) return Number(m[1]);
  const m2 = String(text).match(/port\s+(\d{2,5})/i);
  return m2 ? Number(m2[1]) : null;
}

/* ------------------------------- dev servers ------------------------------ */
function freePort(start = 4300) {
  return new Promise((resolvePort) => {
    const srv = net.createServer();
    srv.listen(0, '0.0.0.0', () => {
      const p = srv.address().port;
      srv.close(() => resolvePort(p));
    });
    srv.on('error', () => resolvePort(start));
  });
}

function waitForPort(port, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolveReady) => {
    const attempt = () => {
      const sock = net.connect({ host: '127.0.0.1', port });
      sock.once('connect', () => { sock.destroy(); resolveReady(true); });
      sock.once('error', () => {
        sock.destroy();
        if (Date.now() > deadline) resolveReady(false);
        else setTimeout(attempt, 700);
      });
    };
    attempt();
  });
}

/**
 * Start the project's dev server (local engine) and return a browser-reachable URL.
 */
export async function startDevServer({ projectId, files, command, timeoutMs = 90_000 }) {
  const engine = execEngine();
  if (engine === 'none') throw new StudioError(503, 'exec_unavailable', 'no execution engine is configured');
  if (engine === 'e2b') {
    const { Sandbox } = await import('e2b');
    const sandbox = await Sandbox.create({ apiKey: process.env.E2B_API_KEY, timeoutMs: 30 * 60_000, template: process.env.E2B_TEMPLATE_ID || undefined });
    const dir = '/home/user/app';
    for (const [rawPath, content] of Object.entries(files || {})) {
      const p = normalizePath(rawPath);
      if (!p) continue;
      await sandbox.files.write(`${dir}/${p}`, String(content)).catch(async () => {
        const parent = `${dir}/${p}`.slice(0, `${dir}/${p}`.lastIndexOf('/'));
        await sandbox.commands.run(`mkdir -p "${parent}"`);
        await sandbox.files.write(`${dir}/${p}`, String(content));
      });
    }
    if (files['package.json']) await sandbox.commands.run(`cd ${dir} && npm install --no-audit --no-fund`, { timeoutMs: 180_000 });
    const cmd = command || defaultDevCommand(files);
    const handle = await sandbox.commands.run(`cd ${dir} && ${cmd}`, { background: true, timeoutMs });
    const port = Number(process.env.STUDIO_DEV_PORT || 5173);
    const ready = await waitPortRemote(sandbox, port, timeoutMs);
    const url = `https://${sandbox.getHost(port)}`;
    devServers.set(String(projectId), { kind: 'e2b', sandbox, handle, port, url, startedAt: Date.now(), command: cmd, ready });
    return { url, port, engine: 'e2b', ready, command: cmd };
  }

  // local engine
  await stopDevServer(projectId);
  const dir = workspaceDir(projectId);
  await writeProjectFiles(dir, files);
  const cmd = command || defaultDevCommand(files);
  const port = await freePort();
  const fullEnv = { ...process.env, PORT: String(port), CI: '1', FORCE_COLOR: '0', NO_COLOR: '1', BROWSER: 'none' };
  const shell = process.platform === 'win32' ? 'cmd' : 'bash';
  const args = process.platform === 'win32' ? ['/d', '/s', '/c', cmd] : ['-lc', cmd];
  const proc = spawn(shell, args, { cwd: dir, env: fullEnv, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
  const logs = [];
  const capture = (d) => { logs.push(d.toString('utf8')); if (logs.length > 400) logs.splice(0, 100); };
  proc.stdout.on('data', capture);
  proc.stderr.on('data', capture);
  const readyOnChosen = waitForPort(port, 40_000);
  const logPort = await new Promise((resolvePort) => {
    const timer = setTimeout(() => resolvePort(null), 12_000);
    const watcher = setInterval(() => {
      const p = findPortInLogs(logs.join(''));
      if (p) { clearTimeout(timer); clearInterval(watcher); resolvePort(p); }
    }, 300);
    proc.on('close', () => { clearTimeout(timer); clearInterval(watcher); resolvePort(null); });
    readyOnChosen.then((ok) => { if (ok) { clearTimeout(timer); clearInterval(watcher); resolvePort(null); } });
  });
  const usePort = logPort || port;
  const ready = logPort ? await waitForPort(usePort, 40_000) : await readyOnChosen;
  const url = publicPreviewUrl(usePort);
  devServers.set(String(projectId), { kind: 'local', proc, port: usePort, url, startedAt: Date.now(), command: cmd, logs, ready });
  return { url, port: usePort, engine: 'local', ready, command: cmd, logs: logs.join('').slice(-4000) };
}

function waitPortRemote(sandbox, port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return (async () => {
    while (Date.now() < deadline) {
      try {
        const out = await sandbox.commands.run(`(command -v curl >/dev/null && curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:${port}) || echo 000`, { timeoutMs: 5000 });
        const code = String(out?.stdout || '').trim().slice(-3);
        if (code && code !== '000') return true;
      } catch { /* not yet */ }
      await new Promise((r) => setTimeout(r, 1500));
    }
    return false;
  })();
}

export async function stopDevServer(projectId) {
  const entry = devServers.get(String(projectId));
  if (!entry) return { stopped: false };
  try {
    if (entry.kind === 'local' && entry.proc) {
      try { process.kill(-entry.proc.pid, 'SIGKILL'); } catch { try { entry.proc.kill('SIGKILL'); } catch { /* gone */ } }
    } else if (entry.kind === 'e2b') {
      try { await entry.sandbox.kill(); } catch { /* expired */ }
    }
  } finally {
    devServers.delete(String(projectId));
  }
  return { stopped: true };
}

export function devServerStatus(projectId) {
  const e = devServers.get(String(projectId));
  if (!e) return { running: false };
  const alive = e.kind === 'local' ? !e.proc.killed : true;
  return {
    running: alive, url: e.url, port: e.port, engine: e.kind, command: e.command,
    startedAt: e.startedAt, logs: (e.logs || []).join('').slice(-4000),
  };
}

export function defaultDevCommand(files) {
  const keys = Object.keys(files || {});
  let pkg = {};
  try { pkg = JSON.parse(files['package.json'] || '{}'); } catch { pkg = {}; }
  if (pkg.scripts?.dev) return 'npm run dev -- --host 0.0.0.0 --port $PORT';
  if (pkg.scripts?.start) return 'npm start';
  if (keys.some((p) => /^next\.config\./.test(p))) return 'npx next dev -p $PORT -H 0.0.0.0';
  if (keys.includes('server.js')) return 'node server.js';
  return 'npx --yes serve -l $PORT .';
}

export async function workspaceListing(projectId) {
  return listWorkspace(workspaceDir(projectId));
}
