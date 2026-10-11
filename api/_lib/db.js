import { neon } from '@neondatabase/serverless';

let _sql;
export function sql() {
  if (!_sql) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) throw new Error('DATABASE_URL is not configured');
    _sql = neon(url);
  }
  return _sql;
}

/** Run a parameterised query: q('select * from users where id=$1', [id]) */
export async function q(text, params = []) {
  return sql().query(text, params);
}

export async function one(text, params = []) {
  const rows = await q(text, params);
  return rows[0] || null;
}
