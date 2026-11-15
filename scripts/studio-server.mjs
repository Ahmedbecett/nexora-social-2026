#!/usr/bin/env node
/* ============================================================================
   NEXORA Studio — local API server
   ----------------------------------------------------------------------------
   Runs the real `api/index.js` handler on plain Node so the Studio can be used
   end-to-end on one machine:

     • storage  : SQLite at .nexora/studio.sqlite (or STUDIO_DB_PATH)
     • executor : the local runner (real commands, real dev servers)
     • auth     : local single-user workspace (STUDIO_DEV_AUTH=1) unless you pass
                  a bearer token from the deployed app

   Start it with `npm run studio` (it runs together with Vite).
   ============================================================================ */

import http from 'node:http';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const PORT = Number(process.env.STUDIO_API_PORT || process.env.PORT || 3001);
const ROOT = process.cwd();
const DB_PATH = process.env.STUDIO_DB_PATH || join(ROOT, '.nexora', 'studio.sqlite');
mkdirSync(dirname(DB_PATH), { recursive: true });
mkdirSync(join(ROOT, '.nexora'), { recursive: true });

process.env.STUDIO_DEV_AUTH = process.env.STUDIO_DEV_AUTH || '1';
process.env.STUDIO_LOCAL_EXEC = process.env.STUDIO_LOCAL_EXEC || '1';
process.env.STUDIO_DB_PATH = DB_PATH;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'nexora-studio-local-dev-secret';
process.env.STUDIO_SECRET = process.env.STUDIO_SECRET || process.env.JWT_SECRET;

// load .env.local if present (provider keys, tokens) — real developer workflow
const envFile = ['.env.local', '.env.studio'].map((f) => join(ROOT, f)).find((f) => existsSync(f));
if (envFile) {
  const { readFileSync } = await import('node:fs');
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  console.log('  env        : loaded ' + envFile.split('/').pop());
}

const handler = (await import('../api/index.js')).default;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (!url.pathname.startsWith('/api')) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'not_found', hint: 'This server only answers /api/* — the UI is served by Vite.' }));
    return;
  }
  try {
    await handler(req, res);
  } catch (e) {
    console.error('[studio-api]', e);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'server_error', detail: String(e.message || e).slice(0, 300) }));
    } else {
      res.end();
    }
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  NEXORA Studio API`);
  console.log(`  listening  : http://0.0.0.0:${PORT}/api`);
  console.log(`  storage    : ${DB_PATH}`);
  console.log(`  executor   : ${process.env.E2B_API_KEY ? 'e2b' : 'local'}${process.env.E2B_SANDBOX_ID ? ` · preview host ${process.env.E2B_SANDBOX_ID}` : ''}`);
  console.log(`  dev auth   : on (local workspace)\n`);
});

const shutdown = () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 1500); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
