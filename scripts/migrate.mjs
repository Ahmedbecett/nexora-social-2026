import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
const text = readFileSync(new URL('../api/_lib/schema.sql', import.meta.url), 'utf8').replace(/--.*$/gm, '');
const stmts = text.split(';').map((s) => s.trim()).filter(Boolean);
for (const s of stmts) await sql.query(s);
console.log('migrated', stmts.length, 'statements');
