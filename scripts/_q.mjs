import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
console.log(await sql.query("select kind, count(*) from posts group by kind"));
console.log(await sql.query("select p.id, p.kind, u.username, p.media->0->>'type' t, left(p.media->0->>'url',90) url, p.created_at from posts p join users u on u.id=p.user_id order by p.id desc limit 10"));
console.log(await sql.query("select id, username, created_at from users order by id"));
console.log(await sql.query("select count(*) from stories"));
