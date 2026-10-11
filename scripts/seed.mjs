// Seeds demo accounts + content. Usage: DATABASE_URL=... BLOB_READ_WRITE_TOKEN=... SEED_DIR=... node scripts/seed.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { put } from '@vercel/blob';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);
const DIR = process.env.SEED_DIR;
const cache = {};
async function up(file) {
  if (cache[file]) return cache[file];
  const p = path.join(DIR, file);
  const ct = file.endsWith('.mp4') ? 'video/mp4' : file.endsWith('.png') ? 'image/png' : 'image/jpeg';
  const r = await put(`seed/${file}`, fs.readFileSync(p), { access: 'public', contentType: ct, addRandomSuffix: true, token: process.env.BLOB_READ_WRITE_TOKEN });
  console.log('uploaded', file);
  return (cache[file] = r.url);
}
const dim = { p1: [928, 1152], p2: [768, 1376], p3: [1408, 768], p4: [768, 1376], p5: [1408, 768], r1: [768, 1376], r2: [768, 1376] };
const img = async (n) => ({ url: await up(`up/${n}.jpg`), type: 'image', w: dim[n][0], h: dim[n][1] });
const vid = async (v, poster) => ({ url: await up(`vid/${v}.mp4`), type: 'video', w: 720, h: 1280, poster: await up(`up/${poster}.jpg`) });

const users = [
  { username: 'nexora', full_name: 'Nexora', bio: 'الحساب الرسمي لتطبيق نيكسورا ✨\nشارك لحظاتك مع العالم', avatar: 'up/nexora.png', verified: true },
  { username: 'nora.official', full_name: 'Nora Benali', bio: 'Dreamer | Traveler | Photographer\n📍 Algiers, Algeria\n✨ Good vibes only', avatar: 'up/a1.jpg', verified: true },
  { username: 'lama.khaled', full_name: 'Lama Khaled', bio: 'مصوّرة هاوية 📷 | الجزائر العاصمة', avatar: 'up/a3.jpg' },
  { username: 'skater.jamal', full_name: 'Jamal Skate', bio: 'Skateboarding 🛹 | Oran ↔ Algiers', avatar: 'up/a2.jpg', verified: true },
  { username: 'sarah.ahmed', full_name: 'Sarah Ahmed', bio: 'Food lover 🍲 | Constantine' },
  { username: 'omar_22', full_name: 'Omar Belkacem', bio: 'Sahara explorer 🐪 Djanet' },
];

const ids = {};
for (const u of users) {
  const ex = await sql`select id from users where username=${u.username}`;
  if (ex.length) { ids[u.username] = ex[0].id; continue; }
  const hash = await bcrypt.hash(crypto.randomBytes(18).toString('base64url'), 10);
  const avatar = u.avatar ? await up(u.avatar) : null;
  const r = await sql`insert into users(username, full_name, email, password_hash, bio, avatar_url, verified)
    values (${u.username}, ${u.full_name}, ${u.username + '@seed.nexora.app'}, ${hash}, ${u.bio}, ${avatar}, ${!!u.verified}) returning id`;
  ids[u.username] = r[0].id;
}
const have = await sql`select count(*)::int n from posts`;
if (have[0].n > 0) { console.log('posts exist, skipping content'); process.exit(0); }

const posts = [
  ['omar_22', 'post', [await img('p4')], 'غروب الشمس في كثبان جانت لا يُنسى 🏜️ #djanet #sahara #algeria', 'Djanet, Algeria', '', 52],
  ['sarah.ahmed', 'post', [await img('p5')], 'كسكسي الجمعة عند الوالدة ❤️ لا شيء يضاهيه #algerianfood #couscous', 'Constantine, Algeria', '', 40],
  ['nora.official', 'reel', [await vid('reel2', 'r2')], 'Palm trees and blue skies 🌴☀️ #summer #algeria', 'Algiers, Algeria', 'Summer Breeze · Lofi', 30],
  ['omar_22', 'reel', [await vid('reel3', 'p4')], 'Walking the dunes at golden hour 🐪 #sahara', 'Djanet, Algeria', 'Desert Wind · Ambient', 26],
  ['nora.official', 'post', [await img('p3'), await img('p2')], 'Tipaza blues & Casbah whites 💙🤍 swipe ➡️ #tipaza #casbah #travel', 'Tipaza, Algeria', '', 20],
  ['nexora', 'post', [await img('p2')], 'مرحباً بكم في نيكسورا! 🎉 شاركوا صوركم ومقاطعكم وقصصكم مع أصدقائكم. استخدموا الوسم #nexora لتظهر منشوراتكم هنا ✨', 'Algiers, Algeria', '', 14],
  ['skater.jamal', 'reel', [await vid('reel1', 'r1')], 'Chasing better days 🌅 #skate #sunset', 'Algiers, Algeria', 'Good Vibes · Chill Beats', 8],
  ['lama.khaled', 'reel', [await vid('reel4', 'p1')], 'Algiers from above at sunset ✨ #algiers', 'Algiers, Algeria', '', 5],
  ['lama.khaled', 'post', [await img('p1')], 'Sometimes the best views are the ones you work for 🌅 #algeria #sunset #travel', 'Algiers, Algeria', '', 2],
];
const pid = [];
for (const [u, kind, media, caption, loc, audio, hoursAgo] of posts) {
  const r = await sql`insert into posts(user_id, kind, media, caption, location, audio, created_at)
    values (${ids[u]}, ${kind}, ${JSON.stringify(media)}, ${caption}, ${loc}, ${audio}, now() - make_interval(hours => ${hoursAgo})) returning id`;
  pid.push(r[0].id);
}
const names = Object.keys(ids);
for (const a of names) for (const b of names) if (a !== b) await sql`insert into follows(follower_id, following_id) values (${ids[a]}, ${ids[b]}) on conflict do nothing`;
for (const p of pid) for (const u of names) if (Math.random() < 0.7) await sql`insert into likes(user_id, post_id) values (${ids[u]}, ${p}) on conflict do nothing`;
const comments = [[8, 'nora.official', 'What a view 😍'], [8, 'skater.jamal', 'المنظر خيالي 🔥'], [4, 'lama.khaled', 'Tipaza is my favourite place 💙'], [6, 'nora.official', 'Sick trick 🛹🔥'], [0, 'sarah.ahmed', 'نحلم نزور جانت يوماً ما ✨'], [1, 'omar_22', 'بالصحة! 😋'], [5, 'lama.khaled', 'تطبيق رائع 👏']];
for (const [i, u, text] of comments) await sql`insert into comments(post_id, user_id, text) values (${pid[i]}, ${ids[u]}, ${text})`;
const stories = [['nora.official', 'r2'], ['nora.official', 'p3'], ['lama.khaled', 'p1'], ['skater.jamal', 'r1'], ['omar_22', 'p4']];
const sids = {};
for (const [u, n] of stories) {
  const r = await sql`insert into stories(user_id, media_url, media_type, created_at) values (${ids[u]}, ${await up(`up/${n}.jpg`)}, 'image', now() - interval '3 hours') returning id`;
  sids[u + n] = r[0].id;
}
const hl = [['Travel', ['p2', 'p3']], ['Nature', ['r2', 'p4']], ['Friends', ['p1']], ['Life', ['p5']]];
for (const [title, list] of hl) {
  const items = []; for (const n of list) items.push({ url: await up(`up/${n}.jpg`), type: 'image' });
  await sql`insert into highlights(user_id, title, items) values (${ids['nora.official']}, ${title}, ${JSON.stringify(items)})`;
}
console.log('seed done', ids);
