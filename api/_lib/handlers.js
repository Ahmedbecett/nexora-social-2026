import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client';
import { q, one } from './db.js';

export class HttpError extends Error {
  constructor(status, message, code) { super(message); this.status = status; this.code = code || message; }
}
const bad = (msg, code) => new HttpError(400, msg, code);

const JWT_SECRET = () => {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is not configured');
  return s;
};

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */
const USERNAME_RE = /^[a-z0-9._]{3,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9 ]{8,16}$/;

function publicUser(u) {
  if (!u) return null;
  return {
    id: Number(u.id), username: u.username, fullName: u.full_name, avatarUrl: u.avatar_url,
    verified: !!u.verified, isPrivate: !!u.is_private,
  };
}
function selfUser(u) {
  return { ...publicUser(u), bio: u.bio, website: u.website, email: u.email, phone: u.phone, createdAt: u.created_at };
}
function sign(user) {
  return jwt.sign({ sub: String(user.id) }, JWT_SECRET(), { expiresIn: '180d' });
}
async function authUser(req, required = true) {
  const h = req.headers['authorization'] || '';
  const m = h.match(/^Bearer (.+)$/);
  if (!m) { if (required) throw new HttpError(401, 'unauthorized'); return null; }
  let payload;
  try { payload = jwt.verify(m[1], JWT_SECRET()); } catch { throw new HttpError(401, 'unauthorized'); }
  const u = await one('select * from users where id=$1', [payload.sub]);
  if (!u) throw new HttpError(401, 'unauthorized');
  return u;
}
function cleanText(s, max) { return String(s ?? '').replace(/\u0000/g, '').trim().slice(0, max); }
function isMediaUrl(url) {
  return typeof url === 'string' && /^https:\/\/[a-z0-9.-]+\.(public\.blob\.vercel-storage\.com)\//i.test(url);
}

// Visibility rule for posts / stories owned by user alias `u` for viewer $1
const VISIBLE = `(u.is_private = false or u.id = $1 or exists (select 1 from follows f where f.follower_id=$1 and f.following_id=u.id and f.status='accepted'))`;

const POST_SELECT = `
  select p.id, p.kind, p.media, p.caption, p.location, p.audio, p.created_at,
         u.id as uid, u.username, u.full_name, u.avatar_url, u.verified, u.is_private,
         (select count(*) from likes l where l.post_id=p.id)::int as like_count,
         (select count(*) from comments c where c.post_id=p.id)::int as comment_count,
         exists(select 1 from likes l where l.post_id=p.id and l.user_id=$1) as liked,
         exists(select 1 from saves s where s.post_id=p.id and s.user_id=$1) as saved,
         exists(select 1 from follows f where f.follower_id=$1 and f.following_id=u.id and f.status='accepted') as following,
         (select json_build_object('username', lu.username, 'avatarUrl', lu.avatar_url)
            from likes l2 join users lu on lu.id=l2.user_id
            where l2.post_id=p.id order by l2.created_at desc limit 1) as last_liker,
         (select json_build_object('username', cu.username, 'text', c2.text)
            from comments c2 join users cu on cu.id=c2.user_id
            where c2.post_id=p.id order by c2.created_at desc limit 1) as last_comment
  from posts p join users u on u.id = p.user_id`;

function mapPost(r) {
  return {
    id: Number(r.id), kind: r.kind, media: r.media || [], caption: r.caption, location: r.location,
    audio: r.audio, createdAt: r.created_at,
    user: { id: Number(r.uid), username: r.username, fullName: r.full_name, avatarUrl: r.avatar_url, verified: !!r.verified },
    likeCount: r.like_count, commentCount: r.comment_count, liked: r.liked, saved: r.saved,
    following: r.following, lastLiker: r.last_liker, lastComment: r.last_comment,
  };
}
function cursorClause(cursor, idx) {
  return cursor ? ` and p.id < $${idx}` : '';
}
async function notify(userId, actorId, type, postId = null, text = '') {
  if (Number(userId) === Number(actorId)) return;
  await q('insert into notifications(user_id, actor_id, type, post_id, text) values ($1,$2,$3,$4,$5)', [userId, actorId, type, postId, text.slice(0, 200)]);
}
async function notifyMentions(text, actorId, postId) {
  const names = [...new Set((text.match(/@([a-z0-9._]{3,30})/gi) || []).map((m) => m.slice(1).toLowerCase()))].slice(0, 10);
  if (!names.length) return;
  const users = await q('select id from users where username = any($1)', [names]);
  for (const u of users) await notify(u.id, actorId, 'mention', postId, text);
}
async function getUserByName(username) {
  const u = await one('select * from users where username=$1', [String(username).toLowerCase()]);
  if (!u) throw new HttpError(404, 'user_not_found');
  return u;
}
async function canSee(viewerId, owner) {
  if (!owner.is_private || Number(owner.id) === Number(viewerId)) return true;
  const f = await one(`select 1 from follows where follower_id=$1 and following_id=$2 and status='accepted'`, [viewerId, owner.id]);
  return !!f;
}

/* ------------------------------------------------------------------ */
/* routes                                                              */
/* ------------------------------------------------------------------ */
const routes = [];
const route = (method, pattern, fn) => {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
  routes.push({ method, re, keys, fn });
};

export async function dispatch(method, path, req) {
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = path.match(r.re);
    if (!m) continue;
    const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    return r.fn({ req, params, body: req.body || {}, query: req.query || {} });
  }
  throw new HttpError(404, 'not_found');
}

route('GET', 'health', async () => {
  const r = await one('select count(*)::int as users from users');
  return { ok: true, users: r.users, blob: !!process.env.BLOB_READ_WRITE_TOKEN, time: new Date().toISOString() };
});

/* ---------- auth ---------- */
route('POST', 'auth/register', async ({ body }) => {
  const fullName = cleanText(body.fullName, 60);
  const username = cleanText(body.username, 30).toLowerCase().replace(/^@/, '');
  const contact = cleanText(body.contact, 120).toLowerCase();
  const password = String(body.password || '');
  if (!fullName) throw bad('full_name_required');
  if (!USERNAME_RE.test(username)) throw bad('invalid_username');
  let email = null, phone = null;
  if (EMAIL_RE.test(contact)) email = contact;
  else if (PHONE_RE.test(contact)) phone = contact.replace(/\s/g, '');
  else throw bad('invalid_contact');
  if (password.length < 6) throw bad('weak_password');
  if (await one('select 1 from users where username=$1', [username])) throw new HttpError(409, 'username_taken');
  if (email && await one('select 1 from users where email=$1', [email])) throw new HttpError(409, 'email_taken');
  if (phone && await one('select 1 from users where phone=$1', [phone])) throw new HttpError(409, 'phone_taken');
  const hash = await bcrypt.hash(password, 10);
  const u = await one('insert into users(username, full_name, email, phone, password_hash) values ($1,$2,$3,$4,$5) returning *', [username, fullName, email, phone, hash]);
  return { token: sign(u), user: selfUser(u) };
});

route('POST', 'auth/login', async ({ body }) => {
  const id = cleanText(body.identifier, 120).toLowerCase().replace(/^@/, '');
  const password = String(body.password || '');
  if (!id || !password) throw bad('missing_credentials');
  const u = await one('select * from users where username=$1 or email=$1 or phone=$2', [id, id.replace(/\s/g, '')]);
  if (!u || !(await bcrypt.compare(password, u.password_hash))) throw new HttpError(401, 'invalid_credentials');
  return { token: sign(u), user: selfUser(u) };
});

route('GET', 'auth/check-username', async ({ query }) => {
  const username = String(query.u || '').toLowerCase();
  if (!USERNAME_RE.test(username)) return { available: false, valid: false };
  const ex = await one('select 1 from users where username=$1', [username]);
  return { available: !ex, valid: true };
});

/* ---------- me ---------- */
route('GET', 'me', async ({ req }) => {
  const u = await authUser(req);
  return { user: selfUser(u) };
});

route('PATCH', 'me', async ({ req, body }) => {
  const u = await authUser(req);
  const fullName = body.fullName !== undefined ? cleanText(body.fullName, 60) : u.full_name;
  const bio = body.bio !== undefined ? cleanText(body.bio, 300) : u.bio;
  const website = body.website !== undefined ? cleanText(body.website, 120) : u.website;
  const isPrivate = body.isPrivate !== undefined ? !!body.isPrivate : u.is_private;
  let avatarUrl = u.avatar_url;
  if (body.avatarUrl !== undefined) {
    if (body.avatarUrl && !isMediaUrl(body.avatarUrl)) throw bad('invalid_media');
    avatarUrl = body.avatarUrl || null;
  }
  let username = u.username;
  if (body.username !== undefined && body.username.toLowerCase() !== u.username) {
    username = cleanText(body.username, 30).toLowerCase();
    if (!USERNAME_RE.test(username)) throw bad('invalid_username');
    if (await one('select 1 from users where username=$1', [username])) throw new HttpError(409, 'username_taken');
  }
  const nu = await one('update users set full_name=$2, bio=$3, website=$4, is_private=$5, avatar_url=$6, username=$7 where id=$1 returning *',
    [u.id, fullName, bio, website, isPrivate, avatarUrl, username]);
  if (u.is_private && !isPrivate) {
    await q(`update follows set status='accepted' where following_id=$1 and status='pending'`, [u.id]);
  }
  return { user: selfUser(nu) };
});

route('POST', 'me/password', async ({ req, body }) => {
  const u = await authUser(req);
  if (!(await bcrypt.compare(String(body.current || ''), u.password_hash))) throw bad('wrong_password');
  if (String(body.next || '').length < 6) throw bad('weak_password');
  await q('update users set password_hash=$2 where id=$1', [u.id, await bcrypt.hash(String(body.next), 10)]);
  return { ok: true };
});

route('DELETE', 'me', async ({ req, body }) => {
  const u = await authUser(req);
  if (!(await bcrypt.compare(String(body.password || ''), u.password_hash))) throw bad('wrong_password');
  await q('delete from users where id=$1', [u.id]);
  return { ok: true };
});

route('GET', 'me/saved', async ({ req }) => {
  const u = await authUser(req);
  const rows = await q(`${POST_SELECT} join saves sv on sv.post_id=p.id and sv.user_id=$1 where ${VISIBLE} order by sv.created_at desc limit 60`, [u.id]);
  return { posts: rows.map(mapPost) };
});

route('GET', 'me/stories', async ({ req }) => {
  const u = await authUser(req);
  const rows = await q('select id, media_url, media_type, created_at from stories where user_id=$1 order by created_at desc limit 100', [u.id]);
  return { stories: rows.map((s) => ({ id: Number(s.id), url: s.media_url, type: s.media_type, createdAt: s.created_at })) };
});

route('GET', 'me/badges', async ({ req }) => {
  const u = await authUser(req);
  const r = await one(`select
      (select count(*) from notifications where user_id=$1 and read=false)::int as notifications,
      (select count(distinct sender_id) from messages where receiver_id=$1 and read=false)::int as messages,
      (select count(*) from follows where following_id=$1 and status='pending')::int as requests`, [u.id]);
  return r;
});

/* ---------- uploads (Vercel Blob client tokens) ---------- */
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm'];
route('POST', 'upload/token', async ({ req, body }) => {
  const u = await authUser(req);
  const contentType = String(body.contentType || '');
  if (!ALLOWED_TYPES.includes(contentType)) throw bad('unsupported_type');
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm' }[contentType];
  const pathname = `u/${u.id}/${Date.now().toString(36)}.${ext}`;
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new HttpError(500, 'storage_not_configured');
  const clientToken = await generateClientTokenFromReadWriteToken({
    token: process.env.BLOB_READ_WRITE_TOKEN,
    pathname,
    allowedContentTypes: [contentType],
    maximumSizeInBytes: contentType.startsWith('video/') ? 100 * 1024 * 1024 : 15 * 1024 * 1024,
    addRandomSuffix: true,
    validUntil: Date.now() + 10 * 60 * 1000,
  });
  return { clientToken, pathname };
});

/* ---------- users ---------- */
route('GET', 'users/:username', async ({ req, params }) => {
  const me = await authUser(req);
  const u = await getUserByName(params.username);
  const r = await one(`select
      (select count(*) from posts where user_id=$2)::int as posts,
      (select count(*) from follows where following_id=$2 and status='accepted')::int as followers,
      (select count(*) from follows where follower_id=$2 and status='accepted')::int as following,
      (select status from follows where follower_id=$1 and following_id=$2) as my_status,
      exists(select 1 from follows where follower_id=$2 and following_id=$1 and status='accepted') as follows_you,
      exists(select 1 from stories where user_id=$2 and created_at > now() - interval '24 hours') as has_story,
      (select json_agg(json_build_object('username', mu.username, 'avatarUrl', mu.avatar_url))
         from (select x.username, x.avatar_url from follows a join follows b on b.follower_id=a.following_id and b.following_id=$2 and b.status='accepted'
               join users x on x.id=a.following_id where a.follower_id=$1 and a.status='accepted' limit 3) mu) as mutuals`, [me.id, u.id]);
  return {
    user: { ...publicUser(u), bio: u.bio, website: u.website },
    stats: { posts: r.posts, followers: r.followers, following: r.following },
    followStatus: r.my_status || 'none', followsYou: r.follows_you, hasStory: r.has_story,
    isMe: Number(u.id) === Number(me.id), canView: await canSee(me.id, u), mutuals: r.mutuals || [],
  };
});

route('GET', 'users/:username/posts', async ({ req, params, query }) => {
  const me = await authUser(req);
  const u = await getUserByName(params.username);
  if (!(await canSee(me.id, u))) return { posts: [], private: true };
  const kind = query.kind === 'reel' ? 'reel' : null;
  const args = [me.id, u.id];
  let where = 'where p.user_id=$2';
  if (kind) { args.push(kind); where += ` and p.kind=$${args.length}`; }
  if (query.cursor) { args.push(query.cursor); where += ` and p.id < $${args.length}`; }
  const rows = await q(`${POST_SELECT} ${where} order by p.id desc limit 30`, args);
  return { posts: rows.map(mapPost) };
});

route('GET', 'users/:username/highlights', async ({ req, params }) => {
  const me = await authUser(req);
  const u = await getUserByName(params.username);
  if (!(await canSee(me.id, u))) return { highlights: [] };
  const rows = await q('select id, title, items from highlights where user_id=$1 order by created_at', [u.id]);
  return { highlights: rows.map((h) => ({ id: Number(h.id), title: h.title, items: h.items })) };
});

async function followList(meId, userId, dir) {
  const join = dir === 'followers' ? 'f.follower_id' : 'f.following_id';
  const where = dir === 'followers' ? 'f.following_id' : 'f.follower_id';
  const rows = await q(`select u.*, (select status from follows x where x.follower_id=$1 and x.following_id=u.id) as my_status
      from follows f join users u on u.id=${join} where ${where}=$2 and f.status='accepted' order by f.created_at desc limit 200`, [meId, userId]);
  return rows.map((r) => ({ ...publicUser(r), followStatus: r.my_status || 'none' }));
}
route('GET', 'users/:username/followers', async ({ req, params }) => {
  const me = await authUser(req); const u = await getUserByName(params.username);
  if (!(await canSee(me.id, u))) return { users: [] };
  return { users: await followList(me.id, u.id, 'followers') };
});
route('GET', 'users/:username/following', async ({ req, params }) => {
  const me = await authUser(req); const u = await getUserByName(params.username);
  if (!(await canSee(me.id, u))) return { users: [] };
  return { users: await followList(me.id, u.id, 'following') };
});

route('POST', 'users/:id/follow', async ({ req, params }) => {
  const me = await authUser(req);
  const target = await one('select * from users where id=$1', [params.id]);
  if (!target) throw new HttpError(404, 'user_not_found');
  if (Number(target.id) === Number(me.id)) throw bad('cannot_follow_self');
  const status = target.is_private ? 'pending' : 'accepted';
  const ins = await q('insert into follows(follower_id, following_id, status) values ($1,$2,$3) on conflict do nothing returning status', [me.id, target.id, status]);
  if (ins.length) await notify(target.id, me.id, status === 'pending' ? 'follow_request' : 'follow');
  const cur = await one('select status from follows where follower_id=$1 and following_id=$2', [me.id, target.id]);
  return { followStatus: cur?.status || 'none' };
});
route('DELETE', 'users/:id/follow', async ({ req, params }) => {
  const me = await authUser(req);
  await q('delete from follows where follower_id=$1 and following_id=$2', [me.id, params.id]);
  await q(`delete from notifications where actor_id=$1 and user_id=$2 and type in ('follow','follow_request')`, [me.id, params.id]);
  return { followStatus: 'none' };
});
route('POST', 'follow-requests/:id/:action', async ({ req, params }) => {
  const me = await authUser(req);
  if (params.action === 'accept') {
    await q(`update follows set status='accepted' where follower_id=$1 and following_id=$2`, [params.id, me.id]);
    await q(`update notifications set type='follow' where actor_id=$1 and user_id=$2 and type='follow_request'`, [params.id, me.id]);
    await notify(params.id, me.id, 'follow_accepted');
  } else {
    await q(`delete from follows where follower_id=$1 and following_id=$2 and status='pending'`, [params.id, me.id]);
    await q(`delete from notifications where actor_id=$1 and user_id=$2 and type='follow_request'`, [params.id, me.id]);
  }
  return { ok: true };
});
route('DELETE', 'followers/:id', async ({ req, params }) => {
  const me = await authUser(req);
  await q('delete from follows where follower_id=$1 and following_id=$2', [params.id, me.id]);
  return { ok: true };
});

route('GET', 'search/users', async ({ req, query }) => {
  const me = await authUser(req);
  const term = cleanText(query.q, 40).toLowerCase().replace(/^@/, '');
  if (!term) return { users: [] };
  const rows = await q(`select u.*, (select status from follows x where x.follower_id=$1 and x.following_id=u.id) as my_status,
      (select count(*) from follows f where f.following_id=u.id and f.status='accepted')::int as followers
    from users u where u.username ilike $2 or u.full_name ilike $2
    order by (u.username ilike $3) desc, followers desc limit 30`, [me.id, `%${term}%`, `${term}%`]);
  return { users: rows.map((r) => ({ ...publicUser(r), followStatus: r.my_status || 'none', followers: r.followers })) };
});

route('GET', 'suggestions', async ({ req }) => {
  const me = await authUser(req);
  const rows = await q(`select u.*, (select count(*) from follows f where f.following_id=u.id and f.status='accepted')::int as followers,
      exists(select 1 from follows f where f.follower_id=u.id and f.following_id=$1) as follows_you
    from users u where u.id <> $1 and not exists (select 1 from follows f where f.follower_id=$1 and f.following_id=u.id)
    order by follows_you desc, followers desc, u.created_at desc limit 15`, [me.id]);
  return { users: rows.map((r) => ({ ...publicUser(r), followers: r.followers, followsYou: r.follows_you, followStatus: 'none' })) };
});

/* ---------- posts ---------- */
route('GET', 'feed', async ({ req, query }) => {
  const me = await authUser(req);
  const args = [me.id];
  let cur = '';
  if (query.cursor) { args.push(query.cursor); cur = ` and p.id < $2`; }
  const rows = await q(`${POST_SELECT}
    where (p.user_id=$1 or exists (select 1 from follows f where f.follower_id=$1 and f.following_id=p.user_id and f.status='accepted'))
    ${cur} order by p.id desc limit 15`, args);
  return { posts: rows.map(mapPost), nextCursor: rows.length === 15 ? Number(rows[rows.length - 1].id) : null };
});

route('GET', 'explore', async ({ req, query }) => {
  const me = await authUser(req);
  const args = [me.id];
  let cur = '';
  if (query.cursor) { args.push(query.cursor); cur = ` and p.id < $2`; }
  const excludeFollowed = query.suggested ? ` and p.user_id <> $1 and not exists (select 1 from follows f where f.follower_id=$1 and f.following_id=p.user_id)` : '';
  const rows = await q(`${POST_SELECT} where u.is_private=false ${excludeFollowed} ${cur} order by p.id desc limit 30`, args);
  return { posts: rows.map(mapPost), nextCursor: rows.length === 30 ? Number(rows[rows.length - 1].id) : null };
});

route('GET', 'tags/:tag', async ({ req, params }) => {
  const me = await authUser(req);
  const tag = '#' + cleanText(params.tag, 50).replace(/^#/, '');
  const rows = await q(`${POST_SELECT} where ${VISIBLE} and p.caption ~* $2 order by p.id desc limit 60`, [me.id, `${tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$|[^\\w])`]);
  return { posts: rows.map(mapPost), tag };
});

route('GET', 'reels', async ({ req, query }) => {
  const me = await authUser(req);
  const args = [me.id];
  let cur = '';
  if (query.cursor) { args.push(query.cursor); cur = ` and p.id < $2`; }
  const rows = await q(`${POST_SELECT} where p.kind='reel' and ${VISIBLE} ${cur} order by p.id desc limit 10`, args);
  return { posts: rows.map(mapPost), nextCursor: rows.length === 10 ? Number(rows[rows.length - 1].id) : null };
});

route('POST', 'posts', async ({ req, body }) => {
  const me = await authUser(req);
  const kind = body.kind === 'reel' ? 'reel' : 'post';
  const media = Array.isArray(body.media) ? body.media.slice(0, 10) : [];
  if (!media.length) throw bad('media_required');
  const clean = media.map((m) => {
    if (!isMediaUrl(m.url)) throw bad('invalid_media');
    return { url: m.url, type: m.type === 'video' ? 'video' : 'image', w: Number(m.w) || null, h: Number(m.h) || null, poster: isMediaUrl(m.poster) ? m.poster : null };
  });
  if (kind === 'reel' && clean[0].type !== 'video') throw bad('reel_requires_video');
  const caption = cleanText(body.caption, 2200);
  const p = await one('insert into posts(user_id, kind, media, caption, location, audio) values ($1,$2,$3,$4,$5,$6) returning id',
    [me.id, kind, JSON.stringify(clean), caption, cleanText(body.location, 80), cleanText(body.audio, 80)]);
  await notifyMentions(caption, me.id, p.id);
  if (body.alsoStory && clean[0]) {
    await q('insert into stories(user_id, media_url, media_type) values ($1,$2,$3)', [me.id, clean[0].url, clean[0].type]);
  }
  const row = await one(`${POST_SELECT} where p.id=$2`, [me.id, p.id]);
  return { post: mapPost(row) };
});

route('GET', 'posts/:id', async ({ req, params }) => {
  const me = await authUser(req);
  const row = await one(`${POST_SELECT} where p.id=$2 and ${VISIBLE}`, [me.id, params.id]);
  if (!row) throw new HttpError(404, 'post_not_found');
  return { post: mapPost(row) };
});

route('PATCH', 'posts/:id', async ({ req, params, body }) => {
  const me = await authUser(req);
  const r = await one('update posts set caption=$3, location=$4 where id=$1 and user_id=$2 returning id', [params.id, me.id, cleanText(body.caption, 2200), cleanText(body.location, 80)]);
  if (!r) throw new HttpError(404, 'post_not_found');
  return { ok: true };
});

route('DELETE', 'posts/:id', async ({ req, params }) => {
  const me = await authUser(req);
  const r = await one('delete from posts where id=$1 and user_id=$2 returning id', [params.id, me.id]);
  if (!r) throw new HttpError(404, 'post_not_found');
  return { ok: true };
});

route('POST', 'posts/:id/like', async ({ req, params }) => {
  const me = await authUser(req);
  const p = await one('select id, user_id from posts where id=$1', [params.id]);
  if (!p) throw new HttpError(404, 'post_not_found');
  const ins = await q('insert into likes(user_id, post_id) values ($1,$2) on conflict do nothing returning post_id', [me.id, p.id]);
  if (ins.length) await notify(p.user_id, me.id, 'like', p.id);
  const c = await one('select count(*)::int as n from likes where post_id=$1', [p.id]);
  return { liked: true, likeCount: c.n };
});
route('DELETE', 'posts/:id/like', async ({ req, params }) => {
  const me = await authUser(req);
  await q('delete from likes where user_id=$1 and post_id=$2', [me.id, params.id]);
  await q(`delete from notifications where actor_id=$1 and post_id=$2 and type='like'`, [me.id, params.id]);
  const c = await one('select count(*)::int as n from likes where post_id=$1', [params.id]);
  return { liked: false, likeCount: c.n };
});
route('GET', 'posts/:id/likes', async ({ req, params }) => {
  const me = await authUser(req);
  const rows = await q(`select u.*, (select status from follows x where x.follower_id=$1 and x.following_id=u.id) as my_status
    from likes l join users u on u.id=l.user_id where l.post_id=$2 order by l.created_at desc limit 200`, [me.id, params.id]);
  return { users: rows.map((r) => ({ ...publicUser(r), followStatus: r.my_status || 'none' })) };
});
route('POST', 'posts/:id/save', async ({ req, params }) => {
  const me = await authUser(req);
  await q('insert into saves(user_id, post_id) values ($1,$2) on conflict do nothing', [me.id, params.id]);
  return { saved: true };
});
route('DELETE', 'posts/:id/save', async ({ req, params }) => {
  const me = await authUser(req);
  await q('delete from saves where user_id=$1 and post_id=$2', [me.id, params.id]);
  return { saved: false };
});

route('GET', 'posts/:id/comments', async ({ req, params }) => {
  await authUser(req);
  const rows = await q(`select c.id, c.text, c.created_at, u.id as uid, u.username, u.avatar_url, u.verified
    from comments c join users u on u.id=c.user_id where c.post_id=$1 order by c.created_at asc limit 300`, [params.id]);
  return { comments: rows.map((c) => ({ id: Number(c.id), text: c.text, createdAt: c.created_at, user: { id: Number(c.uid), username: c.username, avatarUrl: c.avatar_url, verified: c.verified } })) };
});
route('POST', 'posts/:id/comments', async ({ req, params, body }) => {
  const me = await authUser(req);
  const text = cleanText(body.text, 1000);
  if (!text) throw bad('empty_comment');
  const p = await one('select id, user_id from posts where id=$1', [params.id]);
  if (!p) throw new HttpError(404, 'post_not_found');
  const c = await one('insert into comments(post_id, user_id, text) values ($1,$2,$3) returning id, created_at', [p.id, me.id, text]);
  await notify(p.user_id, me.id, 'comment', p.id, text);
  await notifyMentions(text, me.id, p.id);
  return { comment: { id: Number(c.id), text, createdAt: c.created_at, user: { id: Number(me.id), username: me.username, avatarUrl: me.avatar_url, verified: me.verified } } };
});
route('DELETE', 'comments/:id', async ({ req, params }) => {
  const me = await authUser(req);
  await q('delete from comments c using posts p where c.id=$1 and p.id=c.post_id and (c.user_id=$2 or p.user_id=$2)', [params.id, me.id]);
  return { ok: true };
});

route('POST', 'reports', async ({ req, body }) => {
  const me = await authUser(req);
  await q('insert into reports(reporter_id, post_id, user_id, reason) values ($1,$2,$3,$4)', [me.id, body.postId || null, body.userId || null, cleanText(body.reason, 200)]);
  return { ok: true };
});

/* ---------- stories ---------- */
route('GET', 'stories', async ({ req }) => {
  const me = await authUser(req);
  const rows = await q(`select s.id, s.media_url, s.media_type, s.created_at, u.id as uid, u.username, u.avatar_url, u.verified,
      exists(select 1 from story_views v where v.story_id=s.id and v.user_id=$1) as seen
    from stories s join users u on u.id=s.user_id
    where s.created_at > now() - interval '24 hours'
      and (u.id=$1 or exists (select 1 from follows f where f.follower_id=$1 and f.following_id=u.id and f.status='accepted')
           or (u.is_private=false and u.verified=true))
    order by s.created_at asc`, [me.id]);
  const groups = new Map();
  for (const r of rows) {
    const k = Number(r.uid);
    if (!groups.has(k)) groups.set(k, { user: { id: k, username: r.username, avatarUrl: r.avatar_url, verified: r.verified }, stories: [] });
    groups.get(k).stories.push({ id: Number(r.id), url: r.media_url, type: r.media_type, createdAt: r.created_at, seen: r.seen });
  }
  const list = [...groups.values()].map((g) => ({ ...g, allSeen: g.stories.every((s) => s.seen) }));
  list.sort((a, b) => (a.user.id === Number(me.id) ? -1 : b.user.id === Number(me.id) ? 1 : (a.allSeen - b.allSeen)));
  return { tray: list };
});
route('POST', 'stories', async ({ req, body }) => {
  const me = await authUser(req);
  if (!isMediaUrl(body.url)) throw bad('invalid_media');
  const s = await one('insert into stories(user_id, media_url, media_type) values ($1,$2,$3) returning id', [me.id, body.url, body.type === 'video' ? 'video' : 'image']);
  return { id: Number(s.id) };
});
route('POST', 'stories/:id/view', async ({ req, params }) => {
  const me = await authUser(req);
  await q('insert into story_views(story_id, user_id) values ($1,$2) on conflict do nothing', [params.id, me.id]);
  return { ok: true };
});
route('GET', 'stories/:id/viewers', async ({ req, params }) => {
  const me = await authUser(req);
  const rows = await q(`select u.* from story_views v join stories s on s.id=v.story_id join users u on u.id=v.user_id
     where v.story_id=$1 and s.user_id=$2 order by v.created_at desc`, [params.id, me.id]);
  return { users: rows.map(publicUser) };
});
route('DELETE', 'stories/:id', async ({ req, params }) => {
  const me = await authUser(req);
  await q('delete from stories where id=$1 and user_id=$2', [params.id, me.id]);
  return { ok: true };
});

route('POST', 'highlights', async ({ req, body }) => {
  const me = await authUser(req);
  const title = cleanText(body.title, 30) || 'Highlights';
  const ids = (Array.isArray(body.storyIds) ? body.storyIds : []).map(Number).filter(Boolean).slice(0, 50);
  if (!ids.length) throw bad('stories_required');
  const st = await q('select media_url, media_type from stories where user_id=$1 and id = any($2) order by created_at', [me.id, ids]);
  const items = st.map((s) => ({ url: s.media_url, type: s.media_type }));
  const h = await one('insert into highlights(user_id, title, items) values ($1,$2,$3) returning id', [me.id, title, JSON.stringify(items)]);
  return { id: Number(h.id) };
});
route('DELETE', 'highlights/:id', async ({ req, params }) => {
  const me = await authUser(req);
  await q('delete from highlights where id=$1 and user_id=$2', [params.id, me.id]);
  return { ok: true };
});

/* ---------- notifications ---------- */
route('GET', 'notifications', async ({ req }) => {
  const me = await authUser(req);
  const rows = await q(`select n.id, n.type, n.text, n.read, n.created_at, n.post_id,
      u.id as uid, u.username, u.avatar_url, u.verified,
      p.media as post_media,
      (select status from follows x where x.follower_id=$1 and x.following_id=u.id) as my_status
    from notifications n join users u on u.id=n.actor_id left join posts p on p.id=n.post_id
    where n.user_id=$1 order by n.created_at desc limit 100`, [me.id]);
  return {
    notifications: rows.map((n) => ({
      id: Number(n.id), type: n.type, text: n.text, read: n.read, createdAt: n.created_at,
      postId: n.post_id ? Number(n.post_id) : null, postThumb: n.post_media?.[0] ? (n.post_media[0].poster || n.post_media[0].url) : null,
      postThumbType: n.post_media?.[0]?.poster ? 'image' : n.post_media?.[0]?.type || null,
      actor: { id: Number(n.uid), username: n.username, avatarUrl: n.avatar_url, verified: n.verified },
      followStatus: n.my_status || 'none',
    })),
  };
});
route('POST', 'notifications/read', async ({ req }) => {
  const me = await authUser(req);
  await q('update notifications set read=true where user_id=$1 and read=false', [me.id]);
  return { ok: true };
});

/* ---------- messages ---------- */
route('GET', 'conversations', async ({ req }) => {
  const me = await authUser(req);
  const rows = await q(`select distinct on (partner) partner, m.id, m.text, m.media_url, m.post_id, m.created_at, m.sender_id, m.read,
        u.username, u.full_name, u.avatar_url, u.verified,
        (select count(*) from messages x where x.sender_id=partner and x.receiver_id=$1 and x.read=false)::int as unread
     from (select *, case when sender_id=$1 then receiver_id else sender_id end as partner from messages where sender_id=$1 or receiver_id=$1) m
     join users u on u.id=m.partner
     order by partner, m.id desc`, [me.id]);
  rows.sort((a, b) => Number(b.id) - Number(a.id));
  return {
    conversations: rows.map((r) => ({
      user: { id: Number(r.partner), username: r.username, fullName: r.full_name, avatarUrl: r.avatar_url, verified: r.verified },
      last: { text: r.text, media: !!r.media_url, post: !!r.post_id, mine: Number(r.sender_id) === Number(me.id), createdAt: r.created_at },
      unread: r.unread,
    })),
  };
});
route('GET', 'messages/:userId', async ({ req, params, query }) => {
  const me = await authUser(req);
  const after = Number(query.after) || 0;
  const rows = await q(`select m.id, m.sender_id, m.text, m.media_url, m.post_id, m.read, m.created_at,
        p.media as post_media, pu.username as post_user
      from messages m left join posts p on p.id=m.post_id left join users pu on pu.id=p.user_id
      where ((m.sender_id=$1 and m.receiver_id=$2) or (m.sender_id=$2 and m.receiver_id=$1)) and m.id > $3
      order by m.id desc limit 200`, [me.id, params.userId, after]);
  await q('update messages set read=true where sender_id=$2 and receiver_id=$1 and read=false', [me.id, params.userId]);
  const partner = await one('select * from users where id=$1', [params.userId]);
  return {
    user: publicUser(partner),
    messages: rows.reverse().map((m) => ({
      id: Number(m.id), mine: Number(m.sender_id) === Number(me.id), text: m.text, mediaUrl: m.media_url,
      post: m.post_id ? { id: Number(m.post_id), thumb: m.post_media?.[0]?.poster || m.post_media?.[0]?.url, type: m.post_media?.[0]?.poster ? 'image' : m.post_media?.[0]?.type, username: m.post_user } : null,
      read: m.read, createdAt: m.created_at,
    })),
  };
});
route('POST', 'messages/:userId', async ({ req, params, body }) => {
  const me = await authUser(req);
  const text = cleanText(body.text, 2000);
  const mediaUrl = body.mediaUrl && isMediaUrl(body.mediaUrl) ? body.mediaUrl : null;
  const postId = Number(body.postId) || null;
  if (!text && !mediaUrl && !postId) throw bad('empty_message');
  const target = await one('select id from users where id=$1', [params.userId]);
  if (!target) throw new HttpError(404, 'user_not_found');
  const m = await one('insert into messages(sender_id, receiver_id, text, media_url, post_id) values ($1,$2,$3,$4,$5) returning id, created_at', [me.id, target.id, text, mediaUrl, postId]);
  return { message: { id: Number(m.id), mine: true, text, mediaUrl, post: postId ? { id: postId } : null, createdAt: m.created_at } };
});
