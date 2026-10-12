p='/home/user/repo/api/_lib/schema.sql'; s=open(p).read()
if 'comment_likes' not in s:
    s+='''
-- 2.4.6 — comment replies and comment likes
alter table comments add column if not exists parent_id bigint references comments(id) on delete cascade;
create index if not exists comments_parent_idx on comments(parent_id);
create table if not exists comment_likes (
  comment_id bigint not null references comments(id) on delete cascade,
  user_id    bigint not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
'''
    open(p,'w').write(s)
p='/home/user/repo/api/_lib/handlers.js'; s=open(p).read()
def rep(old,new):
    global s
    assert old in s, old[:90]
    s=s.replace(old,new,1)
rep("const NOTIF_PREF = { like: 'likes', repost: 'likes', comment: 'comments',","const NOTIF_PREF = { like: 'likes', repost: 'likes', comment_like: 'likes', comment: 'comments', reply: 'comments',")
rep("""  let rows = await q(`select c.id, c.text, c.created_at, c.user_id, u.id as uid, u.username, u.avatar_url, u.verified,
      exists(select 1 from user_lists r where r.owner_id=$2 and r.target_id=c.user_id and r.kind='restrict') as restricted""",
"""  let rows = await q(`select c.id, c.text, c.created_at, c.user_id, c.parent_id, u.id as uid, u.username, u.avatar_url, u.verified,
      (select count(*) from comment_likes cl where cl.comment_id=c.id)::int as like_count,
      exists(select 1 from comment_likes cl where cl.comment_id=c.id and cl.user_id=$3) as liked,
      exists(select 1 from comment_likes cl where cl.comment_id=c.id and cl.user_id=$2) as owner_liked,
      exists(select 1 from user_lists r where r.owner_id=$2 and r.target_id=c.user_id and r.kind='restrict') as restricted""")
rep("""  return { comments: rows.map((c) => ({ id: Number(c.id), text: c.text, createdAt: c.created_at, user: { id: Number(c.uid), username: c.username, avatarUrl: c.avatar_url, verified: c.verified } })) };
});""","""  const visible = new Set(rows.map((c) => Number(c.id)));
  rows = rows.filter((c) => !c.parent_id || visible.has(Number(c.parent_id)));
  return { comments: rows.map((c) => ({ id: Number(c.id), text: c.text, createdAt: c.created_at, parentId: c.parent_id ? Number(c.parent_id) : null,
    likeCount: c.like_count, liked: c.liked, ownerLiked: c.owner_liked,
    user: { id: Number(c.uid), username: c.username, avatarUrl: c.avatar_url, verified: c.verified } })) };
});""")
rep("""  const c = await one('insert into comments(post_id, user_id, text) values ($1,$2,$3) returning id, created_at', [p.id, me.id, text]);
  if (!containsHidden(text, hiddenWordList(settingsOf(owner)))) await notify(p.user_id, me.id, 'comment', p.id, text);
  await notifyMentions(text, me.id, p.id, p.user_id);
  return { comment: { id: Number(c.id), text, createdAt: c.created_at, user: { id: Number(me.id), username: me.username, avatarUrl: me.avatar_url, verified: me.verified } } };""",
"""  // replies are one level deep (like Instagram): a reply to a reply attaches to the top-level comment
  let parent = null, replyTo = null;
  if (body.parentId) {
    parent = await one('select id, user_id, post_id, parent_id from comments where id=$1', [body.parentId]);
    if (!parent || Number(parent.post_id) !== Number(p.id)) throw new HttpError(404, 'comment_not_found');
    replyTo = parent;
    if (parent.parent_id) parent = (await one('select id, user_id, post_id, parent_id from comments where id=$1', [parent.parent_id])) || parent;
  }
  const c = await one('insert into comments(post_id, user_id, text, parent_id) values ($1,$2,$3,$4) returning id, created_at', [p.id, me.id, text, parent ? parent.id : null]);
  const hidden = containsHidden(text, hiddenWordList(settingsOf(owner)));
  if (!hidden) await notify(p.user_id, me.id, 'comment', p.id, text);
  if (replyTo && Number(replyTo.user_id) !== Number(p.user_id)) await notify(replyTo.user_id, me.id, 'reply', p.id, text);
  await notifyMentions(text, me.id, p.id, replyTo ? replyTo.user_id : p.user_id);
  return { comment: { id: Number(c.id), text, createdAt: c.created_at, parentId: parent ? Number(parent.id) : null, likeCount: 0, liked: false, ownerLiked: false,
    user: { id: Number(me.id), username: me.username, avatarUrl: me.avatar_url, verified: me.verified } } };""")
rep("""route('DELETE', 'comments/:id', async ({ req, params }) => {""","""route('POST', 'comments/:id/like', async ({ req, params }) => {
  const me = await authUser(req);
  const c = await one(`select c.id, c.user_id, c.text, c.post_id, ow.id as owner_id, ow.is_private
    from comments c join posts p on p.id=c.post_id join users ow on ow.id=p.user_id where c.id=$1`, [params.id]);
  if (!c || !(await canSee(me.id, { id: c.owner_id, is_private: c.is_private }))) throw new HttpError(404, 'comment_not_found');
  const r = await q('insert into comment_likes(comment_id, user_id) values ($1,$2) on conflict do nothing returning comment_id', [c.id, me.id]);
  if (r.length) await notify(c.user_id, me.id, 'comment_like', c.post_id, c.text);
  const n = await one('select count(*)::int as n from comment_likes where comment_id=$1', [c.id]);
  return { liked: true, likeCount: n.n };
});
route('DELETE', 'comments/:id/like', async ({ req, params }) => {
  const me = await authUser(req);
  await q('delete from comment_likes where comment_id=$1 and user_id=$2', [params.id, me.id]);
  const n = await one('select count(*)::int as n from comment_likes where comment_id=$1', [params.id]);
  return { liked: false, likeCount: n?.n || 0 };
});
route('DELETE', 'comments/:id', async ({ req, params }) => {""")
open(p,'w').write(s)
print('backend ok')
