import fs from 'node:fs';
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
const text = fs.readFileSync(new URL('../api/_lib/schema.sql', import.meta.url), 'utf8');
const stmts = text.split(/;\s*\n/).map((s) => s.replace(/^\s*--.*$/gm, '').trim()).filter(Boolean);
for (const s of stmts) await sql.query(s);
console.log('migrated', stmts.length, 'statements');
