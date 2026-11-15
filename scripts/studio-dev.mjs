#!/usr/bin/env node
/* Runs the Studio API and Vite together for local development. */
import { spawn } from 'node:child_process';

const procs = [];
function run(name, cmd, args, extraEnv = {}) {
  const child = spawn(cmd, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...extraEnv },
    shell: process.platform === 'win32',
  });
  const prefix = name.padEnd(7);
  const pipe = (stream, target) => stream.on('data', (d) => {
    for (const line of String(d).split('\n')) {
      if (line.trim()) target.write(`\x1b[2m${prefix}\x1b[0m ${line}\n`);
    }
  });
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on('exit', (code) => {
    if (code !== 0 && code !== null) console.error(`\x1b[31m${prefix} exited with ${code}\x1b[0m`);
  });
  procs.push(child);
  return child;
}

console.log('\n  NEXORA Studio — starting API + UI\n');
run('api', process.execPath, ['scripts/studio-server.mjs'], { STUDIO_API_PORT: process.env.STUDIO_API_PORT || '3001' });
run('ui', process.execPath, ['node_modules/vite/bin/vite.js', '--host', '0.0.0.0'], { API_PROXY: process.env.API_PROXY || 'http://127.0.0.1:3001' });

const shutdown = () => {
  for (const p of procs) { try { p.kill('SIGTERM'); } catch { /* gone */ } }
  setTimeout(() => process.exit(0), 600);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
