/**
 * The execution engine must be real: real processes, real output, real exit
 * codes, real dev servers, real timeouts. Nothing here asserts a simulated log.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'nxs-exec-'));
process.env.STUDIO_WORK_DIR = join(dir, 'work');
process.env.STUDIO_LOCAL_EXEC = '1';
delete process.env.E2B_API_KEY;

const exec = await import('../api/_lib/studio/exec.js');

const files = {
  'index.html': '<!doctype html><html><body><h1>hello</h1></body></html>',
  'app.js': 'console.log("from-app")\n',
  'server.js': 'import http from "node:http";\nhttp.createServer((q,s)=>{s.end("dev-server-ok")}).listen(process.env.PORT||0,"0.0.0.0");\n',
};

test('capabilities reflect the configured engine', () => {
  const caps = exec.execCapabilities();
  assert.equal(caps.engine, 'local');
  assert.equal(caps.canRun, true);
  assert.equal(caps.canDevServer, true);
});

test('a real command runs and its stdout is returned verbatim', async () => {
  const logs = [];
  const result = await exec.runCommand({
    ownerId: 'test', projectId: 'p1', files, command: 'ls && node -e "console.log(40+2)"', kind: 'exec', onLog: (t) => logs.push(t),
  });
  assert.equal(result.exitCode, 0, result.logs);
  assert.match(result.logs, /index\.html/);
  assert.match(result.logs, /42/);
  assert.equal(result.engine, 'local');
  assert.ok(logs.length > 0, 'output is streamed to the caller');
  assert.ok(result.durationMs >= 0);
});

test('files land in the workspace before the command runs', async () => {
  const result = await exec.runCommand({ ownerId: 'test', projectId: 'p2', files, command: 'cat app.js', kind: 'exec' });
  assert.match(result.logs, /from-app/);
});

test('a failing command reports its real exit code', async () => {
  const result = await exec.runCommand({ ownerId: 'test', projectId: 'p3', files, command: 'node -e "process.exit(3)"', kind: 'exec' });
  assert.equal(result.exitCode, 3);
});

test('the timeout kills the process instead of waiting forever', async () => {
  const started = Date.now();
  const result = await exec.runCommand({ ownerId: 'test', projectId: 'p4', files, command: 'sleep 10', kind: 'exec', timeoutMs: 1200 });
  const elapsed = Date.now() - started;
  assert.ok(elapsed < 6000, `took ${elapsed}ms`);
  assert.ok(result.killed, 'the process was killed');
  assert.ok(result.exitCode !== 0);
});

test('syntax errors in generated files are caught by a real node check', async () => {
  const bad = { ...files, 'broken.js': 'function (){ const = ; }' };
  const result = await exec.runCommand({ ownerId: 'test', projectId: 'p5', files: bad, command: 'node --check broken.js', kind: 'exec' });
  assert.notEqual(result.exitCode, 0);
  assert.match(result.logs, /SyntaxError|Unexpected token/i);
});

test('a dev server starts, answers over HTTP, and stops', async () => {
  const started = await exec.startDevServer({ projectId: 'p6', files, command: 'node server.js' });
  assert.equal(started.engine, 'local');
  assert.ok(started.port > 0);
  const res = await fetch(`http://127.0.0.1:${started.port}/`);
  assert.equal(await res.text(), 'dev-server-ok');
  const status = exec.devServerStatus('p6');
  assert.equal(status.running, true);
  assert.equal(status.port, started.port);
  await exec.stopDevServer('p6');
  assert.equal(exec.devServerStatus('p6').running, false);
});

test('commands are required and long commands are clamped', async () => {
  await assert.rejects(() => exec.runCommand({ ownerId: 'test', projectId: 'p7', files, command: '   ' }), /command_required/);
  const long = 'echo ' + 'a'.repeat(5000);
  const r = await exec.runCommand({ ownerId: 'test', projectId: 'p8', files, command: long });
  assert.equal(r.exitCode, 0);
});

test.after(async () => {
  await exec.stopDevServer('p6');
  rmSync(dir, { recursive: true, force: true });
});
