import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
const r = await sql.query(process.argv[2], JSON.parse(process.argv[3] || '[]'));
console.log(JSON.stringify(r, null, 0));
