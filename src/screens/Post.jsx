import { useEffect, useRef, useState } from 'react';
import { useMedia, setFeedMuted } from '../media.js';
import { tapHaptic } from '../theme.js';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { api, WEB_URL } from '../api.js';
import { t, errText, fmtNum, timeAgo } from '../i18n.js';
import { useApp, Avatar, UserName, RichText, AutoVideo, Sheet, ActionSheet, Confirm, Spinner, TopBar, Loading, ErrorBox, useAsync, FollowButton } from '../components.jsx';
import { IMusic, IHeart, IComment, ISend, IBookmark, IMoreV, ITrash, IFlag, ILink, IVolume, IEdit, IUser, IHeart as IH } from '../icons.jsx';

export async function shareLink(url, title) {
  try {
    if (Capacitor.isNativePlatform()) { await Share.share({ title, url }); return true; }
    if (navigator.share) { await navigator.share({ title, url }); return true; }
  } catch { return true; }
  try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
  return false;
}

/* ---------------- media carousel ---------------- */
function PostMedia({ post, onDoubleTap }) {
  const [idx, setIdx] = useState(0);
  const { feedMuted: muted } = useMedia();
  const setMuted = setFeedMuted;
  const [heart, setHeart] = useState(0);
  const ref = useRef();
  const lastTap = useRef(0);
  const media = post.media;
  const first = media[0] || {};
  const ratio = Math.max(0.8, Math.min(1.91, first.w && first.h ? first.w / first.h : 1));
  const aspect = post.kind === 'reel' ? 4 / 5 : ratio;

  const tap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) { onDoubleTap(); setHeart((h) => h + 1); }
    lastTap.current = now;
  };
  const onScroll = () => {
    const el = ref.current;
    const i = Math.round(Math.abs(el.scrollLeft) / el.clientWidth);
    if (i !== idx) setIdx(i);
  };
  return (
    <div className="post-media" style={{ aspectRatio: aspect }} onClick={tap}>
      <div className="carousel" ref={ref} onScroll={onScroll}>
        {media.map((m, i) => (
          <div className="slide" key={i}>
            {m.type === 'video'
              ? <AutoVideo src={m.url} poster={m.poster} muted={muted} onForcedMute={() => setFeedMuted(true)} />
              : <img src={m.url} alt="" loading="lazy" />}
          </div>
        ))}
      </div>
      {media.some((m) => m.type === 'video') && (
        <button className="mute-btn" onClick={(e) => { e.stopPropagation(); setMuted(!muted); }}><IVolume muted={muted} size={14} /></button>
      )}
      {media.length > 1 && <span className="media-count">{idx + 1}/{media.length}</span>}
      {heart > 0 && <span key={heart} className="big-heart"><IH filled size={96} /></span>}
      {media.length > 1 && (
        <div className="dots">{media.map((_, i) => <span key={i} className={i === idx ? 'on' : ''} />)}</div>
      )}
    </div>
  );
}

/* ---------------- post card ---------------- */
export function PostCard({ post: initial, onDeleted }) {
  const { me, nav, toast } = useApp();
  const [post, setPost] = useState(initial);
  const [expanded, setExpanded] = useState(false);
  const [menu, setMenu] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  useEffect(() => setPost(initial), [initial]);
  const mine = post.user.id === me?.id;

  const toggleLike = async (force) => {
    const like = force === true ? true : !post.liked;
    if (force === true && post.liked) return;
    if (like) tapHaptic();
    setPost((p) => ({ ...p, liked: like, likeCount: p.likeCount + (like ? 1 : -1) }));
    try {
      const r = await api(`posts/${post.id}/like`, { method: like ? 'POST' : 'DELETE' });
      setPost((p) => ({ ...p, liked: r.liked, likeCount: r.likeCount }));
    } catch (e) { setPost((p) => ({ ...p, liked: !like, likeCount: p.likeCount + (like ? -1 : 1) })); toast(errText(e.code)); }
  };
  const toggleSave = async () => {
    const save = !post.saved;
    setPost((p) => ({ ...p, saved: save }));
    try { await api(`posts/${post.id}/save`, { method: save ? 'POST' : 'DELETE' }); }
    catch (e) { setPost((p) => ({ ...p, saved: !save })); toast(errText(e.code)); }
  };
  const del = async () => {
    try { await api(`posts/${post.id}`, { method: 'DELETE' }); onDeleted?.(post.id); toast(t('delete') + ' ✓'); }
    catch (e) { toast(errText(e.code)); }
  };
  const report = async () => { try { await api('reports', { method: 'POST', body: { postId: post.id, reason: 'inappropriate' } }); toast(t('reported')); } catch (e) { toast(errText(e.code)); } };
  const link = `${WEB_URL}/?p=${post.id}`;
  const caption = post.caption || '';
  const long = caption.length > 110;

  return (
    <article className="post">
      <div className="post-head">
        <Avatar src={post.user.avatarUrl} name={post.user.username} size={34} onClick={() => nav.profile(post.user.username)} />
        <div className="post-head-text" onClick={() => nav.profile(post.user.username)}>
          <UserName user={post.user} />
          {post.audio || post.kind === 'reel'
            ? <span className="post-audio"><IMusic size={13} /><span>{post.audio || `${post.user.username} · ${t('original')}`}</span></span>
            : post.location && <span className="post-loc">{post.location}</span>}
        </div>
        <button className="icon-btn" onClick={() => setMenu(true)} aria-label="more"><IMoreV size={22} /></button>
      </div>
      <PostMedia post={post} onDoubleTap={() => toggleLike(true)} />
      <div className="post-actions">
        <button className={`icon-btn ${post.liked ? 'pop' : ''}`} onClick={() => toggleLike()} aria-label="like"><IHeart filled={post.liked} size={27} /></button>
        <button className="icon-btn" onClick={() => setCommentsOpen(true)} aria-label="comment"><IComment size={26} /></button>
        <button className="icon-btn" onClick={() => setShareOpen(true)} aria-label="share"><ISend size={25} /></button>
        <span className="flex1" />
        <button className="icon-btn" onClick={toggleSave} aria-label="save"><IBookmark filled={post.saved} size={26} /></button>
      </div>
      <div className="post-info">
        {post.likeCount > 0 && (
          <button className="likes" onClick={() => nav.push('userList', { kind: 'likes', id: post.id, title: t('likesTab') })}>
            {post.likeCount === 1 && post.lastLiker
              ? <><Avatar src={post.lastLiker.avatarUrl} name={post.lastLiker.username} size={18} /> <span>{t('likedBy')} <b>{post.lastLiker.username}</b></span></>
              : post.likeCount === 1 ? t('like1') : `${fmtNum(post.likeCount)} ${t('likes')}`}
          </button>
        )}
        {caption && (
          <div className={`caption ${expanded ? 'open' : ''}`}>
            <b className="cap-user" onClick={() => nav.profile(post.user.username)}>{post.user.username}</b>{' '}
            <RichText text={expanded || !long ? caption : caption.slice(0, 100) + '…'} onTag={(tg) => nav.push('tag', { tag: tg })} onMention={(u) => nav.profile(u)} />
            {long && !expanded && <button className="more-btn" onClick={() => setExpanded(true)}>{t('more')}</button>}
          </div>
        )}
        {post.commentCount > 0 && (
          <button className="muted-btn" onClick={() => setCommentsOpen(true)}>{t('viewAllComments', { n: fmtNum(post.commentCount) })}</button>
        )}
        <div className="add-comment-row" onClick={() => setCommentsOpen(true)}>
          <Avatar src={me?.avatarUrl} name={me?.username} size={24} /><span>{t('addComment')}</span>
        </div>
        <time className="post-time">{timeAgo(post.createdAt, true)}</time>
      </div>

      <ActionSheet open={menu} onClose={() => setMenu(false)} actions={[
        mine && { label: t('edit'), icon: <IEdit size={22} />, onClick: () => setEditing(true) },
        mine && { label: t('deletePost'), icon: <ITrash size={22} />, danger: true, onClick: () => setConfirmDel(true) },
        !mine && { label: t('viewProfile'), icon: <IUser size={22} />, onClick: () => nav.profile(post.user.username) },
        { label: t('copyLink'), icon: <ILink size={22} />, onClick: async () => { const shared = await shareLink(link, 'Nexora'); if (!shared) toast(t('linkCopied')); } },
        !mine && { label: t('report'), icon: <IFlag size={22} />, danger: true, onClick: report },
      ]} />
      <Confirm open={confirmDel} title={t('deletePostQ')} okLabel={t('delete')} danger onOk={del} onClose={() => setConfirmDel(false)} />
      <CommentsSheet open={commentsOpen} post={post} onClose={() => setCommentsOpen(false)}
        onCount={(n) => setPost((p) => ({ ...p, commentCount: n }))} />
      <ShareSheet open={shareOpen} post={post} onClose={() => setShareOpen(false)} />
      {editing && <EditPostSheet post={post} onClose={() => setEditing(false)} onSaved={(c, l) => setPost((p) => ({ ...p, caption: c, location: l }))} />}
    </article>
  );
}

function EditPostSheet({ post, onClose, onSaved }) {
  const { toast } = useApp();
  const [caption, setCaption] = useState(post.caption);
  const [location, setLocation] = useState(post.location);
  const save = async () => {
    try { await api(`posts/${post.id}`, { method: 'PATCH', body: { caption, location } }); onSaved(caption, location); onClose(); }
    catch (e) { toast(errText(e.code)); }
  };
  return (
    <Sheet open onClose={onClose} title={t('edit')}>
      <div className="form-pad">
        <textarea className="textarea" rows={4} value={caption} onChange={(e) => setCaption(e.target.value)} dir="auto" />
        <div className="field"><input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t('addLocation')} dir="auto" /></div>
        <button className="btn btn-primary btn-lg" onClick={save}>{t('save')}</button>
      </div>
    </Sheet>
  );
}

/* ---------------- comments ---------------- */
export function CommentsSheet({ open, post, onClose, onCount }) {
  const { me, nav, toast } = useApp();
  const [list, setList] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef();
  useEffect(() => {
    if (!open) return;
    setList(null);
    api(`posts/${post.id}/comments`).then((r) => setList(r.comments)).catch(() => setList([]));
  }, [open, post.id]);
  const send = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const r = await api(`posts/${post.id}/comments`, { method: 'POST', body: { text } });
      const nl = [...(list || []), r.comment];
      setList(nl); onCount?.(nl.length); setText('');
    } catch (e) { toast(errText(e.code)); }
    setBusy(false);
  };
  const del = async (c) => {
    try { await api(`comments/${c.id}`, { method: 'DELETE' }); const nl = list.filter((x) => x.id !== c.id); setList(nl); onCount?.(nl.length); }
    catch (e) { toast(errText(e.code)); }
  };
  return (
    <Sheet open={open} onClose={onClose} title={t('comments')} full>
      <div className="comments">
        {list === null ? <div className="center-pad"><Spinner /></div>
          : list.length === 0 ? <div className="empty small"><h3>{t('noComments')}</h3><p>{t('startConversation')}</p></div>
            : list.map((c) => (
              <div className="comment" key={c.id}>
                <Avatar src={c.user.avatarUrl} name={c.user.username} size={34} onClick={() => { onClose(); nav.profile(c.user.username); }} />
                <div className="comment-body">
                  <div className="comment-meta"><UserName user={c.user} /> <span className="muted">{timeAgo(c.createdAt)}</span></div>
                  <div className="comment-text"><RichText text={c.text} onTag={(tg) => { onClose(); nav.push('tag', { tag: tg }); }} onMention={(u) => { onClose(); nav.profile(u); }} /></div>
                  {(c.user.id === me.id || post.user.id === me.id) && <button className="muted-btn small" onClick={() => del(c)}>{t('delete')}</button>}
                </div>
              </div>
            ))}
      </div>
      <div className="quick-emojis">
        {['❤️', '🙌', '🔥', '👏', '😢', '😍', '😮', '😂'].map((e) => <button key={e} onClick={() => { setText((x) => x + e); inputRef.current?.focus(); }}>{e}</button>)}
      </div>
      <div className="composer">
        <Avatar src={me?.avatarUrl} name={me?.username} size={34} />
        <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('addComment')} dir="auto"
          onKeyDown={(e) => e.key === 'Enter' && send()} />
        <button className="text-link strong" disabled={!text.trim() || busy} onClick={send}>{t('post')}</button>
      </div>
    </Sheet>
  );
}

/* ---------------- share to DM ---------------- */
export function ShareSheet({ open, post, onClose }) {
  const { toast } = useApp();
  const [users, setUsers] = useState(null);
  const [q, setQ] = useState('');
  const [sent, setSent] = useState({});
  useEffect(() => {
    if (!open) return;
    setSent({});
    Promise.all([api('conversations').catch(() => ({ conversations: [] })), api('suggestions').catch(() => ({ users: [] }))])
      .then(([c, s]) => {
        const map = new Map();
        c.conversations.forEach((x) => map.set(x.user.id, x.user));
        s.users.forEach((u) => { if (!map.has(u.id)) map.set(u.id, u); });
        setUsers([...map.values()]);
      });
  }, [open]);
  useEffect(() => {
    if (!open || !q.trim()) return;
    const tm = setTimeout(() => api(`search/users?q=${encodeURIComponent(q)}`).then((r) => setUsers(r.users)).catch(() => {}), 300);
    return () => clearTimeout(tm);
  }, [q, open]);
  const send = async (u) => {
    setSent((s) => ({ ...s, [u.id]: 'busy' }));
    try { await api(`messages/${u.id}`, { method: 'POST', body: { postId: post.id } }); setSent((s) => ({ ...s, [u.id]: 'ok' })); }
    catch (e) { setSent((s) => ({ ...s, [u.id]: null })); toast(errText(e.code)); }
  };
  return (
    <Sheet open={open} onClose={onClose} title={t('sendTo')} full>
      <div className="search-box sheet-search"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchPh')} dir="auto" /></div>
      <div className="share-grid">
        {users === null ? <div className="center-pad"><Spinner /></div> : users.map((u) => (
          <button key={u.id} className="share-user" onClick={() => !sent[u.id] && send(u)}>
            <Avatar src={u.avatarUrl} name={u.username} size={60} />
            <span className="share-name">{u.fullName || u.username}</span>
            <span className={`share-state ${sent[u.id] === 'ok' ? 'ok' : ''}`}>{sent[u.id] === 'ok' ? t('sent') : sent[u.id] === 'busy' ? '…' : t('send')}</span>
          </button>
        ))}
      </div>
      <div className="share-row">
        <button className="btn btn-secondary btn-block" onClick={async () => { const shared = await shareLink(`${WEB_URL}/?p=${post.id}`, 'Nexora'); if (!shared) toast(t('linkCopied')); }}>
          <ILink size={18} /> {t('copyLink')}
        </button>
      </div>
    </Sheet>
  );
}

/* ---------------- single post screen ---------------- */
export function PostDetail({ id }) {
  const { nav } = useApp();
  const { loading, data, error, reload } = useAsync(() => api(`posts/${id}`), [id]);
  return (
    <div className="screen">
      <TopBar title={t('posts')} />
      <div className="scroll">
        {loading ? <Loading /> : error ? <ErrorBox error={error} onRetry={reload} /> : <PostCard post={data.post} onDeleted={() => nav.pop()} />}
      </div>
    </div>
  );
}

/* ---------------- list of posts starting at a given one (profile grid → feed view) ---------------- */
export function PostList({ posts: initial, startId, title }) {
  const [posts, setPosts] = useState(initial);
  const ref = useRef();
  useEffect(() => {
    const el = ref.current?.querySelector(`[data-pid="${startId}"]`);
    if (el) el.scrollIntoView({ block: 'start' });
  }, [startId]);
  return (
    <div className="screen">
      <TopBar title={title || t('posts')} />
      <div className="scroll" ref={ref}>
        {posts.map((p) => <div key={p.id} data-pid={p.id}><PostCard post={p} onDeleted={(pid) => setPosts((l) => l.filter((x) => x.id !== pid))} /></div>)}
      </div>
    </div>
  );
}

export function SuggestedUsers({ users, onDismiss }) {
  const { nav } = useApp();
  if (!users?.length) return null;
  return (
    <div className="suggested">
      <div className="section-head"><b>{t('suggested')}</b></div>
      <div className="suggested-row">
        {users.map((u) => (
          <div className="sugg-card" key={u.id} onClick={() => nav.profile(u.username)}>
            <button className="sugg-x" onClick={(e) => { e.stopPropagation(); onDismiss?.(u.id); }}>×</button>
            <Avatar src={u.avatarUrl} name={u.username} size={76} />
            <UserName user={u} className="sugg-name" />
            <span className="sugg-sub">{u.followsYou ? t('followsYou') : u.fullName}</span>
            <FollowButton user={u} status={u.followStatus} small className="btn-block" />
          </div>
        ))}
      </div>
    </div>
  );
}
