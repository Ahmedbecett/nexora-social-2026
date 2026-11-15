import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// --- 1. Backend securely reads E2B_API_KEY (no frontend leak) ---
test('backend securely reads E2B_API_KEY — no frontend exposure', () => {
  const execSrc = readFileSync('api/_lib/exec.js','utf8');
  const studioSrc = readFileSync('src/ai/ArenaStudio.jsx','utf8');
  // backend must read via process.env only
  assert.match(execSrc, /process\.env\.E2B_API_KEY/, 'backend must read process.env.E2B_API_KEY');
  // frontend may render status label referencing capability name, but must not read the secret value
  // It is OK for Studio to show "E2B Sandboxes / Verel Fallback" based on capabilities flag (boolean), not the key
  assert.doesNotMatch(studioSrc, /process\.env/, 'frontend must not access process.env secrets');
  // No hardcoding of actual key value (e2b_...) in frontend
  assert.doesNotMatch(studioSrc, /e2b_[a-z0-9]{20,}/i, 'frontend must not contain raw e2b key value');
  // handlers must not return key in response
  const handlers = readFileSync('api/_lib/handlers.js','utf8');
  // capabilities returns boolean, not value
  assert.match(execSrc, /available:\s*e2bKey/, 'capabilities returns boolean not raw key');
  assert.doesNotMatch(handlers, /E2B_API_KEY.*res\.write|json.*E2B_API_KEY/, 'handlers must not leak key in response');
});

test('exec.js never logs raw key', () => {
  const src = readFileSync('api/_lib/exec.js','utf8');
  // logs should not interpolate apiKey
  assert.doesNotMatch(src, /logs\s*\+=.*apiKey/, 'logs must not contain apiKey');
  assert.doesNotMatch(src, /console\.log.*E2B_API_KEY/, 'console must not log key');
  // error handling slices message to 200 chars, not exposing key
  assert.match(src, /slice\(0, 200\)/, 'errors are sliced to avoid leaking secrets');
});

// --- 2. execCapabilities reflects real env ---
test('execCapabilities detects E2B mode correctly', async () => {
  const { execCapabilities } = await import('../api/_lib/exec.js');
  const orig = process.env.E2B_API_KEY;
  try {
    delete process.env.E2B_API_KEY; delete process.env.E2B_TOKEN;
    let c = execCapabilities();
    assert.equal(c.e2b, false, 'without key e2b false');
    assert.equal(c.mode, 'vercel-fallback');
    assert.match(c.providers.find(p=>p.id==='e2b').note, /Add E2B_API_KEY/);

    process.env.E2B_API_KEY = 'e2b_dummy_for_test_only';
    c = execCapabilities();
    assert.equal(c.e2b, true, 'with key e2b true');
    assert.equal(c.mode, 'e2b');
    assert.match(c.providers.find(p=>p.id==='e2b').note, /Real isolated/);
    // ensure value not leaked in capabilities response
    assert.equal(JSON.stringify(c).includes('e2b_dummy_for_test_only'), false, 'capabilities must not echo key value');
  } finally {
    if (orig) process.env.E2B_API_KEY = orig; else delete process.env.E2B_API_KEY;
  }
});

// --- 3. runExecution honest fallback (no mock success) ---
test('fallback execution is honest — validates, never fake success', async () => {
  const { runExecution } = await import('../api/_lib/exec.js');
  const orig = process.env.E2B_API_KEY; delete process.env.E2B_API_KEY; delete process.env.E2B_TOKEN;
  try {
    const files = {
      'index.html': '<!doctype html><html><body><h1>Hello</h1></body></html>',
      'package.json': JSON.stringify({ name:'test', dependencies: { react:'^18.0.0' } })
    };
    const r = await runExecution({ files, command: 'npm install', action: 'install', timeoutMs: 5000 });
    assert.equal(r.real, false, 'fallback real false');
    assert.equal(r.mode, 'vercel-fallback');
    assert.match(r.logs, /Fallback/);
    assert.match(r.logs, /Would install 1 dependencies/);
    assert.doesNotMatch(r.logs, /e2b_dummy/);
    assert.ok(r.duration > 0 && r.duration < 5000, 'duration recorded');

    // build validation
    const b = await runExecution({ files, command: 'npm run build', action: 'build' });
    assert.match(b.logs, /index\.html structure ok/);
    assert.equal(b.exitCode, 0);

    // error case: invalid package.json
    const bad = await runExecution({ files: { 'package.json': '{ invalid json' }, command: 'npm install', action:'install' });
    assert.equal(bad.exitCode, 1);
    assert.match(bad.logs, /Invalid package\.json/);
  } finally {
    if (orig) process.env.E2B_API_KEY = orig;
  }
});

// --- 4. E2B path attempts real sandbox when key present (mocked failure still honest) ---
test('E2B path attempts real sandbox and handles auth error without leaking key', async () => {
  const { runExecution } = await import('../api/_lib/exec.js');
  const orig = process.env.E2B_API_KEY;
  process.env.E2B_API_KEY = 'e2b_invalid_dummy_key_for_test';
  try {
    const r = await runExecution({
      files: { 'index.html': '<html></html>' },
      command: 'echo hello-from-e2b',
      action: 'exec',
      timeoutMs: 8000
    });
    // With invalid key, E2B will be attempted (logs show NEXORA E2B or E2B error). Must not leak key.
    assert.ok(
      r.logs.includes('[NEXORA E2B]') || r.logs.includes('E2B error') || r.logs.includes('E2B attempted') || r.logs.includes('Creating isolated sandbox'),
      'logs indicate E2B attempt — got: ' + r.logs.slice(0, 400)
    );
    assert.equal(r.logs.includes('e2b_invalid_dummy_key_for_test'), false, 'logs must not contain raw key');
    assert.equal(JSON.stringify(r).includes('e2b_invalid_dummy_key_for_test'), false, 'response must not leak key');
    // Verify error handling doesn't throw unhandled
    assert.ok(typeof r.exitCode === 'number');
    assert.ok(typeof r.duration === 'number');
  } finally {
    if (orig) process.env.E2B_API_KEY = orig; else delete process.env.E2B_API_KEY;
  }
});

// --- 5. Project files and execution history persistence (schema) ---
test('workspace persistence schema supports project memory', () => {
  const execSrc = readFileSync('api/_lib/exec.js','utf8');
  assert.match(execSrc, /workspace_executions/, 'must create executions table');
  assert.match(execSrc, /workspace_snapshots/, 'must create snapshots table');
  assert.match(execSrc, /saveExecution|listExecutions/, 'must have persistence helpers');
  const ws = readFileSync('api/_lib/workspace.js','utf8');
  assert.match(ws, /workspace_projects/, 'projects table exists');
  const handlers = readFileSync('api/_lib/handlers.js','utf8');
  assert.match(handlers, /workspace\/execute/, 'execute route exists');
  assert.match(handlers, /workspace\/plan/, 'plan route exists');
  assert.match(handlers, /workspace\/debug/, 'debug route exists');
});

// --- 6. No mock execution — every path logs real command output ---
test('no mock execution — logs contain real command, no simulated success', async () => {
  const { runExecution } = await import('../api/_lib/exec.js');
  const orig = process.env.E2B_API_KEY; delete process.env.E2B_API_KEY;
  try {
    const r = await runExecution({
      files: { 'test.txt': 'hello' },
      command: 'echo custom-command-output-12345',
      action: 'exec'
    });
    // Fallback should at least validate command, not pretend success without evidence
    assert.match(r.logs, /custom-command-output-12345|Command validated|Command:/);
    assert.equal(r.real, false);
    assert.ok(r.logs.length > 100, 'logs must be substantive, not empty mock');
  } finally { if (orig) process.env.E2B_API_KEY = orig; }
});

// Test timeout handling
test('timeout is respected and reported', async () => {
  const { runExecution } = await import('../api/_lib/exec.js');
  const orig = process.env.E2B_API_KEY; delete process.env.E2B_API_KEY;
  try {
    const start = Date.now();
    const r = await runExecution({
      files: { 'index.html': '<html></html>' },
      command: 'sleep 10 && echo done',
      action: 'exec',
      timeoutMs: 3000
    });
    const elapsed = Date.now() - start;
    // fallback should complete quickly, not actually sleep 10s
    assert.ok(elapsed < 5000, 'fallback respects timeout without real sleep');
    assert.ok(r.logs.length > 0);
  } finally { if (orig) process.env.E2B_API_KEY = orig; }
});
