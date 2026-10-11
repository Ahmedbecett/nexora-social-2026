// World reels: served by our API (cached, with likes). If the API is unreachable or older than
// the app, fall back to querying Wikimedia Commons directly from the device — same real,
// freely-licensed videos and the same safety filter, just without server-side likes.
import { api } from './api.js';
import { TOPICS, TOPIC_IDS, COMMONS_API, commonsParams, toItem } from '../shared/world-core.js';

let serverOk = null;
const queues = new Map();

function toPost(it) {
  return {
    id: `c${it.source_id}`, wid: null, world: true, kind: 'reel', topic: it.topic,
    media: [{ type: 'video', url: it.url, poster: it.poster, width: it.width, height: it.height }],
    caption: it.title, description: it.description, duration: it.duration,
    source: { name: 'Wikimedia Commons', author: it.author, license: it.license, url: it.page_url },
    likeCount: 0, liked: false, commentCount: 0,
    user: { id: 0, username: it.author, fullName: 'Wikimedia Commons', avatarUrl: null, verified: false },
  };
}

async function commons(topic) {
  const terms = TOPICS[topic];
  const term = terms[Math.floor(Math.random() * terms.length)];
  const qs = new URLSearchParams({ ...commonsParams(term, 40), origin: '*' });
  const r = await fetch(`${COMMONS_API}?${qs}`);
  if (!r.ok) return [];
  const d = await r.json();
  return (d?.query?.pages || []).map((p) => toItem(p, topic)).filter(Boolean);
}

async function direct(topic, seed, limit) {
  const key = `${topic}:${seed}`;
  let st = queues.get(key);
  if (!st) { st = { items: [], seen: new Set(), empty: 0 }; queues.set(key, st); }
  while (st.items.length < limit && st.empty < 3) {
    const topics = topic === 'mix' ? [...TOPIC_IDS].sort(() => Math.random() - 0.5).slice(0, 2) : [topic];
    const got = (await Promise.all(topics.map((tp) => commons(tp).catch(() => [])))).flat().sort(() => Math.random() - 0.5);
    const fresh = got.filter((it) => !st.seen.has(it.source_id) && st.seen.add(it.source_id));
    if (!fresh.length) st.empty += 1;
    st.items.push(...fresh.map(toPost));
  }
  return st.items.splice(0, limit);
}

export async function fetchWorld(topic, seed, offset = 0, limit = 8) {
  if (serverOk !== false) {
    try {
      const r = await api(`world/reels?topic=${topic}&seed=${seed}&offset=${offset}&limit=${limit}`);
      serverOk = true;
      return r;
    } catch (e) {
      if (!(e?.status === 404 || e?.status >= 500)) throw e;
      if (e.status === 404) serverOk = false;
    }
  }
  const posts = await direct(topic, seed, limit);
  return { posts, nextOffset: posts.length ? offset + posts.length : null };
}
