// "World" reels: real, freely-licensed videos from Wikimedia Commons (CC / public domain),
// fetched live from the Commons API and cached in Postgres. Each item keeps its author,
// licence and source page so it can be credited in the app.
import { q, one } from './db.js';
import { TOPICS, TOPIC_IDS, COMMONS_API, commonsParams, toItem } from '../../shared/world-core.js';

export { TOPICS, pickSource } from '../../shared/world-core.js';
export const isTopic = (t) => TOPIC_IDS.includes(t);
const UA = 'NexoraApp/2.3 (https://nexora-social-2026.vercel.app; ahmedbecetti35@gmail.com)';

async function commonsSearch(term, limit = 40) {
  const params = new URLSearchParams(commonsParams(term, limit));
  const ctl = new AbortController();
  const tm = setTimeout(() => ctl.abort(), 7000);
  try {
    const r = await fetch(`${COMMONS_API}?${params}`, { headers: { 'User-Agent': UA, 'Api-User-Agent': UA }, signal: ctl.signal });
    if (!r.ok) return [];
    const d = await r.json();
    return d?.query?.pages || [];
  } catch { return []; } finally { clearTimeout(tm); }
}

async function store(items) {
  if (!items.length) return 0;
  const cols = ['source', 'source_id', 'topic', 'url', 'poster', 'width', 'height', 'duration', 'title', 'description', 'author', 'license', 'page_url'];
  const vals = [];
  const rows = items.map((it, i) => `(${cols.map((c, j) => { vals.push(it[c]); return `$${i * cols.length + j + 1}`; }).join(',')})`);
  const r = await q(`insert into world_media(${cols.join(',')}) values ${rows.join(',')} on conflict (source, source_id) do nothing returning id`, vals);
  return r.length;
}

/** Pull a fresh batch for a topic from Commons (2 random search terms in parallel). */
export async function refreshTopic(topic) {
  const terms = [...TOPICS[topic]].sort(() => Math.random() - 0.5).slice(0, 2);
  const pages = (await Promise.all(terms.map((t) => commonsSearch(t)))).flat();
  const seen = new Set();
  const perAuthor = {};
  const items = pages.map((p) => toItem(p, topic)).filter((x) => {
    if (!x || seen.has(x.source_id)) return false;
    seen.add(x.source_id);
    perAuthor[x.author] = (perAuthor[x.author] || 0) + 1;
    return perAuthor[x.author] <= 3; // keep the mix varied
  });
  const added = await store(items);
  await q(`insert into world_fetch(topic, fetched_at, runs) values ($1, now(), 1)
           on conflict (topic) do update set fetched_at=now(), runs=world_fetch.runs+1`, [topic]);
  return added;
}

/** Make sure the cache has enough fresh items for this topic (or for the mix). */
export async function ensure(topic) {
  const stats = await q(`select t.topic, coalesce(c.n,0)::int as n, f.fetched_at
    from unnest($1::text[]) as t(topic)
    left join (select topic, count(*) n from world_media group by topic) c on c.topic=t.topic
    left join world_fetch f on f.topic=t.topic`, [TOPIC_IDS]);
  const by = Object.fromEntries(stats.map((s) => [s.topic, s]));
  const stale = (s) => !s.fetched_at || Date.now() - new Date(s.fetched_at).getTime() > 3 * 3600e3;
  let todo = [];
  if (topic === 'mix') {
    const total = stats.reduce((a, s) => a + s.n, 0);
    const sorted = [...stats].sort((a, b) => a.n - b.n);
    if (total < 120) todo = sorted.slice(0, 4).map((s) => s.topic);
    else todo = sorted.filter(stale).slice(0, 1).map((s) => s.topic);
  } else {
    const s = by[topic];
    if (s.n < 40 || stale(s)) todo = [topic];
  }
  if (!todo.length) return;
  const work = Promise.all(todo.map((t) => refreshTopic(t).catch(() => 0)));
  // never let a slow upstream block the response for long when we already have content
  const have = topic === 'mix' ? stats.reduce((a, s) => a + s.n, 0) : by[topic].n;
  if (have >= 12) await Promise.race([work, new Promise((r) => setTimeout(r, 2500))]);
  else await work;
}

export function mapWorld(r) {
  return {
    id: `w${r.id}`, wid: Number(r.id), world: true, kind: 'reel', topic: r.topic,
    media: [{ type: 'video', url: r.url, poster: r.poster, width: r.width, height: r.height }],
    caption: r.title, description: r.description, duration: r.duration,
    source: { name: 'Wikimedia Commons', author: r.author, license: r.license, url: r.page_url },
    likeCount: r.like_count || 0, liked: !!r.liked, commentCount: 0, viewCount: r.view_count || 0,
    user: { id: 0, username: r.author, fullName: 'Wikimedia Commons', avatarUrl: null, verified: false },
  };
}

/** A stable, per-viewer shuffled page of world reels (portrait videos favoured). */
export async function listWorld(userId, { topic = 'mix', seed = '', offset = 0, limit = 8 }) {
  const args = [userId, String(seed).slice(0, 32) || String(Date.now()), Math.max(0, Number(offset) || 0), Math.min(30, Math.max(1, Number(limit) || 8))];
  let where = 'not exists (select 1 from world_hidden h where h.user_id=$1 and h.media_id=w.id)';
  if (topic !== 'mix') { args.push(topic); where += ` and w.topic=$5`; }
  const rows = await q(`select w.*,
      (select count(*) from world_likes l where l.media_id=w.id)::int as like_count,
      exists(select 1 from world_likes l where l.media_id=w.id and l.user_id=$1) as liked,
      (select count(*) from world_views v where v.media_id=w.id)::int as view_count
    from world_media w where ${where}
    order by (('x' || substr(md5(w.id::text || $2), 1, 8))::bit(32)::bigint / 4294967296.0)
             - case when w.height > w.width then 0.35 else 0 end
    offset $3 limit $4`, args);
  return rows.map(mapWorld);
}

/** Keyword search over the stored world videos (title / description / topic). */
export async function searchWorld(userId, term, limit = 30) {
  const words = String(term).toLowerCase().replace(/[%_#@]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 4);
  if (!words.length) return [];
  const args = [userId, Math.min(60, limit)];
  const conds = words.map((w) => { args.push(`%${w}%`); const i = args.length; return `(w.title ilike $${i} or w.description ilike $${i} or w.topic ilike $${i})`; });
  const rows = await q(`select w.*,
      (select count(*) from world_likes l where l.media_id=w.id)::int as like_count,
      exists(select 1 from world_likes l where l.media_id=w.id and l.user_id=$1) as liked,
      (select count(*) from world_views v where v.media_id=w.id)::int as view_count
    from world_media w
    where not exists (select 1 from world_hidden h where h.user_id=$1 and h.media_id=w.id) and ${conds.join(' and ')}
    order by (w.title ilike $3) desc, (w.height > w.width) desc, w.id desc limit $2`, args);
  return rows.map(mapWorld);
}

export async function likeWorld(userId, id, on) {
  if (on) await q('insert into world_likes(user_id, media_id) values ($1,$2) on conflict do nothing', [userId, id]);
  else await q('delete from world_likes where user_id=$1 and media_id=$2', [userId, id]);
  const r = await one('select count(*)::int n from world_likes where media_id=$1', [id]);
  return { liked: on, likeCount: r.n };
}
export async function hideWorld(userId, id) {
  await q('insert into world_hidden(user_id, media_id) values ($1,$2) on conflict do nothing', [userId, id]);
  return { ok: true };
}
/** Remove an item that can no longer be played (deleted upstream). */
export async function dropWorld(id) {
  await q('delete from world_media where id=$1', [id]);
}
