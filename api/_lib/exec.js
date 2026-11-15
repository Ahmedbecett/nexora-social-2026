import { q, one } from './db.js';
import { HttpError } from './errors.js';

let execReady = false;
async function ensureExec() {
  if (execReady) return;
  try {
    await q(`create table if not exists workspace_executions (
      id bigserial primary key,
      project_id bigint references workspace_projects(id) on delete cascade,
      user_id bigint not null references users(id) on delete cascade,
      action text not null,
      command text,
      status text not null default 'running',
      logs text,
      exit_code int,
      duration_ms int,
      created_at timestamptz not null default now()
    )`);
    await q(`create index if not exists ws_exec_proj_idx on workspace_executions(project_id, created_at desc)`);
    await q(`create index if not exists ws_exec_user_idx on workspace_executions(user_id, created_at desc)`);
    await q(`create table if not exists workspace_snapshots (
      id bigserial primary key,
      project_id bigint references workspace_projects(id) on delete cascade,
      user_id bigint not null references users(id) on delete cascade,
      files jsonb not null,
      message text,
      created_at timestamptz not null default now()
    )`);
    await q(`create index if not exists ws_snap_proj_idx on workspace_snapshots(project_id, created_at desc)`);
    await q(`create table if not exists workspace_sandboxes (
      user_id bigint not null references users(id) on delete cascade,
      project_id bigint not null references workspace_projects(id) on delete cascade,
      sandbox_id text not null, updated_at timestamptz not null default now(),
      primary key (user_id, project_id)
    )`);
    execReady = true;
  } catch (e) { console.warn('exec ensure', e.message); }
}

function cleanStr(s, max) {
  return String(s ?? '').replace(/\u0000/g, '').trim().slice(0, max);
}

// ---- capabilities ----
export function execCapabilities() {
  const e2bKey = !!(process.env.E2B_API_KEY || process.env.E2B_TOKEN);
  const vercelToken = !!process.env.VERCEL_STUDIO_TOKEN;
  return {
    e2b: e2bKey,
    vercel: true, // always available as fallback
    vercelDeploy: vercelToken,
    providers: [
      { id: 'e2b', name: 'E2B Sandboxes', available: e2bKey, note: e2bKey ? 'Real isolated containers — npm install/build/test with live preview' : 'Add E2B_API_KEY in Vercel env for real containers' },
      { id: 'vercel', name: 'Vercel Isolated Runtime', available: true, note: 'Strict fallback — validates static builds, simulates Node within 30s limit' },
    ],
    mode: e2bKey ? 'e2b' : 'vercel-fallback',
  };
}

// ---- fallback execution (honest, never fake success) ----
async function fallbackExec({ files, command, action }) {
  const start = Date.now();
  let logs = '';
  let exitCode = 0;
  const fileNames = Object.keys(files || {});
  logs += `> [NEXORA Fallback] VALIDATION ONLY — no container is created and the command is NOT executed.\n`;
  logs += `> Project files: ${fileNames.length} files\n`;
  logs += `> Command: ${command}\n`;
  logs += `> Add E2B_API_KEY to run real install/build/test/dev commands.\n\n`;

  try {
    if (action === 'install' || command.includes('npm install')) {
      const pkg = files['package.json'];
      if (!pkg) {
        logs += `ℹ No package.json — skipping install (static project)\n`;
      } else {
        try { JSON.parse(pkg); logs += `✓ package.json is valid JSON\n`; } catch (e) { logs += `✗ Invalid package.json: ${e.message}\n`; exitCode = 1; }
        const parsed = JSON.parse(pkg);
        const deps = { ...(parsed.dependencies || {}), ...(parsed.devDependencies || {}) };
        logs += `→ Would install ${Object.keys(deps).length} dependencies in real E2B sandbox\n`;
        logs += `→ Dependencies: ${Object.keys(deps).slice(0, 10).join(', ') || 'none'}\n`;
        // simulate install time
        await new Promise(r => setTimeout(r, 300));
        logs += `✓ package.json validated — install NOT executed (fallback)\n`;
      }
    }
    if (action === 'build' || command.includes('npm run build') || command.includes('vite build') || command.includes('next build')) {
      if (!files['index.html'] && !files['src/main.jsx'] && !files['package.json']) {
        logs += `✗ No entry file found (index.html or src/main.jsx)\n`; exitCode = 1;
      } else {
        // basic HTML validation for static
        if (files['index.html']) {
          const html = files['index.html'];
          if (!html.includes('<html') || !html.includes('</html>')) logs += `⚠ index.html missing html tags\n`;
          else logs += `✓ index.html structure ok (${html.length} bytes)\n`;
          // check for script errors: count brackets
          const open = (html.match(/{/g) || []).length;
          const close = (html.match(/}/g) || []).length;
          if (Math.abs(open - close) > 3) logs += `⚠ Possible unclosed braces in inline JS\n`;
        }
        if (files['package.json']) {
          try { JSON.parse(files['package.json']); logs += `✓ package.json valid\n`; } catch(e){ logs+=`✗ package.json parse error\n`; exitCode=1; }
        }
        // check for common errors
        const allContent = Object.values(files).join('\n');
        if (allContent.includes('undefined is not')) logs += `⚠ Found 'undefined' patterns — check code\n`;
        logs += `✓ File validation complete — no vite/next build was executed (fallback)\n`;
      }
    }
    if (action === 'test' || command.includes('npm test') || command.includes('npm run test')) {
      logs += `→ Running tests...\n`;
      const hasTests = fileNames.some(f => f.includes('.test.') || f.includes('__tests__'));
      if (files['package.json']) {
        const pkg = JSON.parse(files['package.json']);
        if (pkg.scripts && pkg.scripts.test) {
          logs += `→ Found test script: ${pkg.scripts.test}\n`;
          // basic test count simulation
          if (hasTests) logs += `✓ Test files found — would execute in E2B sandbox\n`;
          else logs += `⚠ No test files found, but package has test script\n`;
        } else {
          logs += `ℹ No test script in package.json\n`;
        }
      } else {
        logs += hasTests ? `✓ Test files present\n` : `ℹ No test configuration\n`;
      }
      logs += `✓ Test files inspected — tests NOT executed (fallback)\n`;
    }
    if (action === 'dev' || command.includes('vite') || command.includes('next dev') || command.includes('npm run dev')) {
      logs += `→ Dev server would start on port 5173/3000 in E2B sandbox\n`;
      logs += `→ Preview URL would be available via sandbox.getHost(5173)\n`;
      logs += `✓ Dev command inspected — server NOT started (fallback)\n`;
    }
    if (action === 'exec' || (!['install','build','test','dev'].includes(action))) {
      // generic command - just validate
      logs += `→ Command validated: ${command}\n`;
      if (command.startsWith('node ') || command.includes('node -e')) {
        logs += `ℹ Node execution requires E2B for full isolation\n`;
      }
      logs += `✓ Command accepted for validation only — nothing was executed (fallback)\n`;
    }
    logs += `\n── Summary ──\n`;
    logs += `Validation: ${exitCode === 0 ? 'passed' : 'failed'}\n`;
    logs += `Duration: ${Date.now() - start}ms\n`;
    logs += `Executed: NO (fallback validation only)\n`;
    logs += `⚠ Add E2B_API_KEY to enable real isolated execution with actual command output\n`;
  } catch (e) {
    logs += `\n✗ Fallback error: ${e.message}\n`;
    exitCode = 1;
  }

  return {
    logs,
    exitCode,
    duration: Date.now() - start,
    real: false,
    executed: false, // never claim a command ran in fallback mode
    validatedOnly: true,
    mode: 'vercel-fallback',
    previewUrl: null,
  };
}

// ---- E2B execution ----
async function e2bExec({ files, command, timeoutMs = 25000, action, userId, projectId }) {
  const start = Date.now();
  const apiKey = process.env.E2B_API_KEY || process.env.E2B_TOKEN;
  if (!apiKey) throw new Error('E2B_API_KEY not set');

  let logs = '';
  let exitCode = 0;
  let previewUrl = null;
  let executed = false;

  // Lazy import to avoid crash when not installed or misconfigured
  let Sandbox;
  try {
    const mod = await import('e2b');
    Sandbox = mod.Sandbox || mod.default?.Sandbox;
    if (!Sandbox) throw new Error('Sandbox export not found');
  } catch (e) {
    throw new Error('E2B SDK failed to load: ' + e.message);
  }

  let sandbox = null;
  let keepSandbox = false;
  try {
    if (userId && projectId) {
      const session = await one('select sandbox_id from workspace_sandboxes where user_id=$1 and project_id=$2', [userId, projectId]);
      if (session) {
        try { sandbox = await Sandbox.connect(session.sandbox_id, { apiKey, timeoutMs: 600000 }); }
        catch { await q('delete from workspace_sandboxes where user_id=$1 and project_id=$2 and sandbox_id=$3', [userId, projectId, session.sandbox_id]); }
      }
    }
    if (!sandbox) {
    logs += `> [NEXORA E2B] Creating isolated sandbox...\n`;
    const sandboxOptions = { apiKey, timeoutMs: userId && projectId ? 600000 : 60000 };
    sandbox = process.env.E2B_TEMPLATE_ID
      ? await Sandbox.create(process.env.E2B_TEMPLATE_ID, sandboxOptions)
      : await Sandbox.create(sandboxOptions);
    if (userId && projectId) {
      const row = await one(`insert into workspace_sandboxes(user_id, project_id, sandbox_id) values ($1,$2,$3)
        on conflict (user_id, project_id) do update set sandbox_id=workspace_sandboxes.sandbox_id returning sandbox_id`, [userId, projectId, sandbox.sandboxId]);
      if (row.sandbox_id !== sandbox.sandboxId) {
        await sandbox.kill();
        sandbox = await Sandbox.connect(row.sandbox_id, { apiKey, timeoutMs: 600000 });
      }
    }
    }
    keepSandbox = !!(userId && projectId);
    logs += `✓ Sandbox ready: ${sandbox.sandboxId || sandbox.sandboxID || 'sandbox'}\n`;

    // Ensure app directory
    await sandbox.commands.run('mkdir -p /home/user/app', { timeoutMs: 5000 });
    
    // Sync the project, keeping installed dependencies between commands.
    await sandbox.commands.run("cd /home/user/app && find . -mindepth 1 -maxdepth 1 ! -name node_modules -exec rm -rf -- {} +", { timeoutMs: 5000 });
    // Write files
    logs += `> Writing ${Object.keys(files).length} files...\n`;
    for (const [fname, content] of Object.entries(files)) {
      // security: prevent directory traversal
      const safeName = fname; // paths were validated in runExecution
      const fullPath = `/home/user/app/${safeName}`;
      const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
      if (dir && dir !== '/home/user/app') {
        await sandbox.commands.run(`mkdir -p "${dir.replace(/"/g, '\\"')}"`, { timeoutMs: 5000 });
      }
      await sandbox.files.write(fullPath, String(content));
    }
    logs += `✓ Files written\n`;

    // If action is install and there's package.json, do npm install
    // But command already contains full intent, so just run it
    const workdir = '/home/user/app';
    const fullCmd = `cd ${workdir} && ${command}`;
    logs += `> Executing: ${command}\n`;
    logs += `> Timeout: ${timeoutMs}ms\n\n`;

    let stdout = '';
    let stderr = '';
    let result;
    if (action === 'dev') {
      if (!keepSandbox) throw new Error('Save the project before starting a persistent preview');
      const port = command.includes('3000') ? 3000 : 5173;
      executed = true;
      await sandbox.commands.run(fullCmd, { background: true, timeoutMs: 0 });
      // Verify a real listener inside the sandbox before publishing its URL.
      await sandbox.commands.run(`python3 -c 'import socket,time; p=${port}; end=time.time()+12; s=None
while time.time()<end:
 try:
  s=socket.create_connection(("127.0.0.1",p),timeout=1); break
 except OSError: time.sleep(.3)
if not s: raise SystemExit("Preview server did not start")
s.close()'`, { timeoutMs: 15000 });
      previewUrl = `https://${sandbox.getHost(port)}`;
      result = { exitCode: 0, stdout: 'Preview server is listening.' };
    } else {
      executed = true;
      result = await sandbox.commands.run(fullCmd, {
        timeoutMs: timeoutMs,
        onStdout: (data) => { stdout += data; },
        onStderr: (data) => { stderr += data; },
      });
    }

    // E2B returns result with stdout/stderr or streams already captured
    if (result.stdout) stdout = result.stdout;
    if (result.stderr) stderr = result.stderr;
    if (result.exitCode !== undefined) exitCode = result.exitCode;

    logs += stdout ? stdout + '\n' : '';
    logs += stderr ? `STDERR:\n${stderr}\n` : '';
    logs += `\n── E2B Result ──\n`;
    logs += `Exit code: ${exitCode}\n`;
    logs += `Duration: ${Date.now() - start}ms\n`;

    // This sandbox is closed below. Never return a URL that cannot remain live.
    // For build, check if dist was created
    if (action === 'build' || command.includes('build')) {
      try {
        const ls = await sandbox.commands.run('ls -lh /home/user/app/dist 2>&1 | head -20', { timeoutMs: 5000 });
        if (ls.stdout) logs += `\nBuild output:\n${ls.stdout}\n`;
      } catch {}
    }

  } catch (e) {
    if (e.stdout) logs += String(e.stdout).slice(0, 12000) + '\n';
    if (e.stderr) logs += String(e.stderr).slice(0, 12000) + '\n';
    logs += `\n✗ E2B error: ${e.message}\n`;
    // fallback to honest error, not fake success
    if (e.message.includes('timeout')) {
      logs += `Timeout after ${timeoutMs}ms — try a simpler command or increase timeout\n`;
    }
    exitCode = exitCode || 1;
  } finally {
    if (sandbox && !keepSandbox) {
      try { await sandbox.kill(); logs += `✓ Sandbox closed\n`; } catch {}
    }
  }

  return {
    logs,
    exitCode,
    duration: Date.now() - start,
    real: executed,
    executed,
    mode: 'e2b',
    previewUrl,
  };
}

// ---- unified run ----
export async function runExecution({ files, command, action, timeoutMs, userId, projectId }) {
  await ensureExec();
  const cap = execCapabilities();
  // sanitize
  const safeFiles = {};
  for (const [k, v] of Object.entries(files || {}).slice(0, 100)) {
    if (typeof k !== 'string' || typeof v !== 'string') continue;
    if (k.length > 200 || v.length > 500000) continue;
    // Paths are later used inside a shell command; reject traversal and shell syntax.
    if (!/^[a-zA-Z0-9_@.+\-/]+$/.test(k) || k.startsWith('/') || k.split('/').some(part => !part || part === '.' || part === '..')) {
      throw new HttpError(400, 'invalid_file_path');
    }
    safeFiles[k] = v;
  }
  if (!Object.keys(safeFiles).length) throw new HttpError(400, 'files_required');
  if (!command || typeof command !== 'string') throw new HttpError(400, 'command_required');
  const cmd = command.slice(0, 2000).trim();
  if (!cmd) throw new HttpError(400, 'command_required');
  const t = Math.min(Math.max(Number(timeoutMs) || 25000, 3000), 55000); // respect Vercel 30s + margin for fallback

  let result;
  if (cap.e2b) {
    try {
      result = await e2bExec({ files: safeFiles, command: cmd, timeoutMs: t, action, userId, projectId });
    } catch (e) {
      // E2B failed — fallback but mark as attempted
      result = await fallbackExec({ files: safeFiles, command: cmd, action });
      result.logs = `⚠ E2B attempted but failed: ${e.message}\n` + result.logs;
      result.real = false;
      result.executed = false;
      result.e2bError = e.message.slice(0, 200);
    }
  } else {
    result = await fallbackExec({ files: safeFiles, command: cmd, action });
  }
  return result;
}

// ---- persistence ----
export async function saveExecution({ userId, projectId, action, command, logs, exitCode, duration, status }) {
  await ensureExec();
  const row = await one(`insert into workspace_executions(user_id, project_id, action, command, status, logs, exit_code, duration_ms)
                         values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
    [userId, projectId || null, cleanStr(action, 40) || 'exec', cleanStr(command, 2000), status || (exitCode === 0 ? 'success' : 'failed'), logs.slice(0, 20000), exitCode, duration]);
  return row;
}

export async function listExecutions(userId, projectId, limit=20) {
  await ensureExec();
  if (projectId) {
    return q(`select * from workspace_executions where user_id=$1 and project_id=$2 order by created_at desc limit $3`, [userId, projectId, limit]);
  }
  return q(`select * from workspace_executions where user_id=$1 order by created_at desc limit $2`, [userId, limit]);
}

export async function getExecution(userId, id) {
  await ensureExec();
  const row = await one(`select * from workspace_executions where id=$1 and user_id=$2`, [id, userId]);
  if (!row) throw new HttpError(404, 'execution_not_found');
  return row;
}

export async function createSnapshot(userId, projectId, files, message) {
  await ensureExec();
  const row = await one(`insert into workspace_snapshots(user_id, project_id, files, message) values ($1,$2,$3,$4) returning *`,
    [userId, projectId, JSON.stringify(files), cleanStr(message, 200) || 'snapshot']);
  return row;
}

export async function listSnapshots(userId, projectId, limit=20) {
  await ensureExec();
  return q(`select id, message, created_at from workspace_snapshots where user_id=$1 and project_id=$2 order by created_at desc limit $3`, [userId, projectId, limit]);
}

export async function getSnapshot(userId, id) {
  await ensureExec();
  const row = await one(`select * from workspace_snapshots where id=$1 and user_id=$2`, [id, userId]);
  if (!row) throw new HttpError(404, 'snapshot_not_found');
  return row;
}
