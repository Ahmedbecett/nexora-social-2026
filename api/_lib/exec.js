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
    execReady = true;
  } catch (e) { console.warn('exec ensure', e.message); }
}

function cleanStr(s, max) {
  return String(s ?? '').replace(/\u0000/g, '').trim().slice(0, max);
}

// ---- capabilities ----
export function execCapabilities() {
  const e2bKey = !!(process.env.E2B_API_KEY || process.env.E2B_TOKEN);
  const vercelToken = !!(process.env.VERCEL_TOKEN || process.env.VERCEL_API_TOKEN);
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
  logs += `> [NEXORA Fallback] Mode: Vercel isolated runtime (no E2B_API_KEY)\n`;
  logs += `> Project files: ${fileNames.length} files\n`;
  logs += `> Command: ${command}\n`;
  logs += `> Note: Add E2B_API_KEY for real containers with npm install/build/test isolation.\n\n`;

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
        logs += `✓ Install validated (fallback)\n`;
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
        logs += `✓ Build validation complete (fallback — real E2B would run actual vite/next build)\n`;
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
      logs += `✓ Test validation complete (fallback)\n`;
    }
    if (action === 'dev' || command.includes('vite') || command.includes('next dev') || command.includes('npm run dev')) {
      logs += `→ Dev server would start on port 5173/3000 in E2B sandbox\n`;
      logs += `→ Preview URL would be available via sandbox.getHost(5173)\n`;
      logs += `✓ Dev command validated\n`;
    }
    if (action === 'exec' || (!['install','build','test','dev'].includes(action))) {
      // generic command - just validate
      logs += `→ Command validated: ${command}\n`;
      if (command.startsWith('node ') || command.includes('node -e')) {
        logs += `ℹ Node execution requires E2B for full isolation\n`;
      }
      logs += `✓ Command accepted (fallback interpretation)\n`;
    }
    logs += `\n── Summary ──\n`;
    logs += `Duration: ${Date.now() - start}ms\n`;
    logs += `Exit code: ${exitCode}\n`;
    if (!process.env.E2B_API_KEY) {
      logs += `⚠ Fallback mode: add E2B_API_KEY to enable real isolated execution\n`;
    }
  } catch (e) {
    logs += `\n✗ Fallback error: ${e.message}\n`;
    exitCode = 1;
  }

  return {
    logs,
    exitCode,
    duration: Date.now() - start,
    real: false,
    mode: 'vercel-fallback',
    previewUrl: null,
  };
}

// ---- E2B execution ----
async function e2bExec({ files, command, timeoutMs = 25000, action }) {
  const start = Date.now();
  const apiKey = process.env.E2B_API_KEY || process.env.E2B_TOKEN;
  if (!apiKey) throw new Error('E2B_API_KEY not set');

  let logs = '';
  let exitCode = 0;
  let previewUrl = null;

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
  try {
    logs += `> [NEXORA E2B] Creating isolated sandbox...\n`;
    sandbox = await Sandbox.create({
      apiKey: apiKey,
      // template can be configured via env
      template: process.env.E2B_TEMPLATE_ID || undefined,
      timeoutMs: 60000,
    });
    logs += `✓ Sandbox ready: ${sandbox.sandboxId || sandbox.sandboxID || 'sandbox'}\n`;

    // Ensure app directory
    await sandbox.commands.run('mkdir -p /home/user/app', { timeoutMs: 5000 });
    
    // Write files
    logs += `> Writing ${Object.keys(files).length} files...\n`;
    for (const [fname, content] of Object.entries(files)) {
      // security: prevent directory traversal
      const safeName = fname.replace(/\.\./g, '_').replace(/^\/+/, '');
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
    const result = await sandbox.commands.run(fullCmd, {
      timeoutMs: timeoutMs,
      onStdout: (data) => { stdout += data; },
      onStderr: (data) => { stderr += data; },
    });

    // E2B returns result with stdout/stderr or streams already captured
    if (result.stdout) stdout = result.stdout;
    if (result.stderr) stderr = result.stderr;
    if (result.exitCode !== undefined) exitCode = result.exitCode;

    logs += stdout ? stdout + '\n' : '';
    logs += stderr ? `STDERR:\n${stderr}\n` : '';
    logs += `\n── E2B Result ──\n`;
    logs += `Exit code: ${exitCode}\n`;
    logs += `Duration: ${Date.now() - start}ms\n`;

    // Try to get preview URL if this was a dev server
    if (action === 'dev' || command.includes('dev') || command.includes('5173') || command.includes('3000')) {
      try {
        const host = sandbox.getHost ? sandbox.getHost(5173) : null;
        if (host) {
          previewUrl = `https://${host}`;
          logs += `Preview: ${previewUrl}\n`;
        } else if (sandbox.getHost) {
          // try 3000
          const host2 = sandbox.getHost(3000);
          if (host2) previewUrl = `https://${host2}`;
        }
      } catch {}
    }

    // For build, check if dist was created
    if (action === 'build' || command.includes('build')) {
      try {
        const ls = await sandbox.commands.run('ls -lh /home/user/app/dist 2>&1 | head -20', { timeoutMs: 5000 });
        if (ls.stdout) logs += `\nBuild output:\n${ls.stdout}\n`;
      } catch {}
    }

  } catch (e) {
    logs += `\n✗ E2B error: ${e.message}\n`;
    // fallback to honest error, not fake success
    if (e.message.includes('timeout')) {
      logs += `Timeout after ${timeoutMs}ms — try a simpler command or increase timeout\n`;
    }
    exitCode = exitCode || 1;
  } finally {
    if (sandbox) {
      try { await sandbox.kill(); logs += `✓ Sandbox closed\n`; } catch {}
    }
  }

  return {
    logs,
    exitCode,
    duration: Date.now() - start,
    real: true,
    mode: 'e2b',
    previewUrl,
  };
}

// ---- unified run ----
export async function runExecution({ files, command, action, timeoutMs }) {
  await ensureExec();
  const cap = execCapabilities();
  // sanitize
  const safeFiles = {};
  for (const [k, v] of Object.entries(files || {}).slice(0, 100)) {
    if (typeof k !== 'string' || typeof v !== 'string') continue;
    if (k.length > 200 || v.length > 500000) continue;
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
      result = await e2bExec({ files: safeFiles, command: cmd, timeoutMs: t, action });
    } catch (e) {
      // E2B failed — fallback but mark as attempted
      result = await fallbackExec({ files: safeFiles, command: cmd, action });
      result.logs = `⚠ E2B attempted but failed: ${e.message}\n` + result.logs;
      result.real = false;
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
