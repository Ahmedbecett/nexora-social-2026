// "World" reels: real, freely-licensed videos from Wikimedia Commons (CC / public domain),
// fetched live from the Commons API and cached in Postgres. Each item keeps its author,
// licence and source page so it can be credited in the app.
import { q, one } from './db.js';

const UA = 'NexoraApp/2.3 (https://nexora-social-2026.vercel.app; ahmedbecetti35@gmail.com)';
const API = 'https://commons.wikimedia.org/w/api.php';

export const TOPICS = {
  nature: ['waterfall', 'forest', 'mountain', 'sunset', 'sunrise', 'river', 'flowers', 'clouds', 'snow', 'autumn', 'lake', 'volcano', 'rainbow', 'storm', 'desert'],
  animals: ['cat', 'kitten', 'dog', 'puppy', 'bird', 'horse', 'elephant', 'monkey', 'squirrel', 'butterfly', 'lion', 'parrot', 'bee', 'owl', 'penguin', 'giraffe', 'fox', 'duck'],
  space: ['vertical video', 'rocket launch', 'space station', 'aurora', 'Earth from space', 'Mars', 'eclipse', 'galaxy', 'Moon', 'astronaut', 'Hubble'],
  ocean: ['ocean', 'waves', 'coral', 'underwater', 'beach', 'dolphin', 'whale', 'turtle', 'jellyfish', 'shark', 'seal'],
  city: ['timelapse', 'skyline', 'night city', 'train', 'tram', 'street', 'drone', 'bridge', 'fireworks', 'metro'],
  sports: ['football', 'skateboard', 'surfing', 'basketball', 'cycling', 'parkour', 'skiing', 'gymnastics', 'climbing', 'snowboard', 'tennis', 'karate'],
  dance: ['dance', 'dancing', 'dancers', 'ballet', 'folk dance', 'traditional dance'],
  music: ['musician', 'guitar', 'drum', 'violin', 'piano', 'singing', 'flute', 'concert', 'choir', 'busker'],
  food: ['cooking', 'street food', 'bread', 'coffee', 'tea', 'fruit market', 'pizza', 'cake', 'grill', 'couscous', 'chocolate'],
  travel: ['festival', 'market', 'desert', 'village', 'old town', 'harbour', 'Sahara', 'carnival', 'castle', 'temple', 'boat'],
};
const TOPIC_IDS = Object.keys(TOPICS);
export const isTopic = (t) => TOPIC_IDS.includes(t);

const BLOCK = /\b(nud(e|ity|ist)|naked|topless|sex|porn|erotic|breast|penis|vagin\w*|genital\w*|masturbat\w*|autopsy|surg(ery|ical)|corpse|dead(?! sea)|death|killed|execution|slaughter|gore|blood|wound\w*|injur\w*|behead\w*|war|military|army|soldiers?|weapons?|guns?|rifle|shoot\w*|bomb\w*|explos\w*|missiles?|attack\w*|protest\w*|riot|police|arrest|prison|politic\w*|election|candidate|senate|parliament|campaign\w*|president|minister|drugs?|weed|thc|cannabis|marijuana|cocaine|heroin|smok\w*|cigar\w*|vape|alcohol|drunk|lecture|webinar|screencast|tutorial|interview\w*|presentations?|slides|conference|podcast|speech|test ?pattern|test video|sample|countdown|blank|hotel|suite|advert\w*|commercial|promo|trailer|youtube|vlog|unboxing|cira|navy|usn|army|air force|airmen|airman|marines?|corps|sgt|sergeant|seaman|sailors?|potus|white house|times of india|covid\w*|lockdown|pandemic|coronavirus|čsla|nato|himawari|goes-\d+|imagery|typhoon|hurricane|cyclone|tropical storm|analysis|comparative|method|study|experiment\w*|specimens?|journal|supplementa\w*|figure|movie s\d+|video s\d+|herdenking|memorial|funeral|fire|burning|accident|crash|flood|disaster|news|broadcast|documentary|episodes?|full movie|film \(\d{4}\))\b/i;

const strip = (h) => String(h || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const cleanTitle = (t) => String(t || '').replace(/^File:/, '').replace(/\.(webm|ogv|ogg|mp4|mpg|mpeg|mov)$/i, '').replace(/[_]+/g, ' ').replace(/\s*\((?:SVS)?\d{4,}[^)]*\)\s*/g, ' ').replace(/\.(theora|ogv|webm|vp9)\b/gi, '').replace(/^\d{6,8}[-_ ]?/, '').replace(/\b(DSC|IMG|VID|MVI|MOV|GOPR|P)\d{3,}\b/gi, '').replace(/\s+/g, ' ').trim();

/** Best playable WebM transcode: around 480p on the short side (light on mobile data). */
export function pickSource(v) {
  const ders = (v.derivatives || []).filter((d) => /^video\/webm/.test(d.type) && d.src && d.width && d.height);
  if (!ders.length) return null;
  const short = (d) => Math.min(d.width, d.height);
  const ok = ders.filter((d) => short(d) >= 360 && short(d) <= 1080);
  const pool = ok.length ? ok : ders;
  pool.sort((a, b) => Math.abs(short(a) - 480) - Math.abs(short(b) - 480));
  return pool[0];
}

async function commonsSearch(term, limit = 40) {
  const params = new URLSearchParams({
    action: 'query', format: 'json', formatversion: '2', generator: 'search', gsrnamespace: '6',
    gsrsearch: `filetype:video intitle:"${term}"`, gsrlimit: String(limit), gsrsort: 'random',
    prop: 'videoinfo', viprop: 'url|size|mime|derivatives|extmetadata', viurlwidth: '640',
    viextmetadatafilter: 'Artist|LicenseShortName|ImageDescription|ObjectName|Restrictions',
  });
  const ctl = new AbortController();
  const tm = setTimeout(() => ctl.abort(), 7000);
  try {
    const r = await fetch(`${API}?${params}`, { headers: { 'User-Agent': UA, 'Api-User-Agent': UA }, signal: ctl.signal });
    if (!r.ok) return [];
    const d = await r.json();
    return d?.query?.pages || [];
  } catch { return []; } finally { clearTimeout(tm); }
}

function toItem(page, topic) {
  const v = page.videoinfo?.[0];
  if (!v || !v.thumburl) return null;
  const dur = Number(v.duration || 0);
  if (dur < 4 || dur > 150) return null;
  if (Math.min(v.width || 0, v.height || 0) < 480) return null;
  const m = v.extmetadata || {};
  let title = cleanTitle(strip(m.ObjectName?.value) || page.title);
  const description = strip(m.ImageDescription?.value).replace(/^(English|en|Français|fr|Deutsch|de|Español|es)\s*:\s*/i, '').slice(0, 600);
  const letters = (title.match(/\p{L}/gu) || []).length;
  if (letters < 6 || letters / title.length < 0.5) title = description.split(/(?<=[.!?])\s/)[0].slice(0, 120);
  if (!title) return null;
  if (/ČSLA|CSLA/i.test(strip(m.Artist?.value))) return null;
  if (BLOCK.test(`${page.title} ${title} ${description} ${strip(m.Artist?.value)}`)) return null;
  const authorRaw = strip(m.Artist?.value);
  if (/^([A-Z][\w'-]+ [A-Z]{1,2}, ){2,}/.test(authorRaw + ', ')) return null; // scientific-paper supplements
  const src = pickSource(v);
  if (!src) return null;
  const author = strip(m.Artist?.value).replace(/^Uploaded by\s*/i, '').slice(0, 80) || 'Wikimedia Commons';
  return {
    source: 'commons', source_id: String(page.pageid), topic, url: src.src, poster: v.thumburl,
    width: src.width, height: src.height, duration: dur, title: title.slice(0, 200), description,
    author, license: strip(m.LicenseShortName?.value).slice(0, 40) || 'CC', page_url: v.descriptionurl,
  };
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
    likeCount: r.like_count || 0, liked: !!r.liked, commentCount: 0,
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
      exists(select 1 from world_likes l where l.media_id=w.id and l.user_id=$1) as liked
    from world_media w where ${where}
    order by (('x' || substr(md5(w.id::text || $2), 1, 8))::bit(32)::bigint / 4294967296.0)
             - case when w.height > w.width then 0.35 else 0 end
    offset $3 limit $4`, args);
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
