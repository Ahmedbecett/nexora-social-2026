import { useCallback, useEffect, useRef, useState } from 'react';
import { tapHaptic } from '../theme.js';
import { api } from '../api.js';
import { t, fmtNum, errText } from '../i18n.js';
import { useApp, Avatar, UserName, FollowButton, Spinner, RichText, ActionSheet, Confirm, TopBar } from '../components.jsx';
import { IHeart, IComment, ISend, IBookmark, IMoreH, ICamera, IMusic, IVolume, IFlag, ITrash, IReels } from '../icons.jsx';
import { CommentsSheet, ShareSheet } from './Post.jsx';

function ReelItem({ post: initial, active, muted, setMuted, onDeleted }) {
  const { me, nav, toast } = useApp();
  const [post, setPost] = useState(initial);
  const [heart, setHeart] = useState(0);
  const [comments, setComments] = useState(false);
  const [share, setShare] = useState(false);
  const [menu, setMenu] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [paused, setPaused] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showMute, setShowMute] = useState(0);
  const vRef = useRef();
  const lastTap = useRef(0);
  const tapTimer = useRef();
  const m = post.media[0];

  useEffect(() => {
    const v = vRef.current; if (!v) return;
    if (active && !paused) { v.play().catch(() => {}); } else v.pause();
  }, [active, paused]);
  useEffect(() => { if (!active && vRef.current) vRef.current.currentTime = 0; }, [active]);

  const like = async (force) => {
    const val = force ? true : !post.liked;
    if (force && post.liked) return;
    if (val) tapHaptic();
    setPost((p) => ({ ...p, liked: val, likeCount: p.likeCount + (val ? 1 : -1) }));
    try { const r = await api(`posts/${post.id}/like`, { method: val ? 'POST' : 'DELETE' }); setPost((p) => ({ ...p, likeCount: r.likeCount, liked: r.liked })); }
    catch (e) { setPost((p) => ({ ...p, liked: !val, likeCount: p.likeCount + (val ? -1 : 1) })); toast(errText(e.code)); }
  };
  const save = async () => {
    const val = !post.saved; setPost((p) => ({ ...p, saved: val }));
    try { await api(`posts/${post.id}/save`, { method: val ? 'POST' : 'DELETE' }); } catch { setPost((p) => ({ ...p, saved: !val })); }
  };
  const tap = (e) => {
    if (e.target.closest('.reel-ui')) return;
    const now = Date.now();
    if (now - lastTap.current < 280) { clearTimeout(tapTimer.current); like(true); setHeart((h) => h + 1); }
    else tapTimer.current = setTimeout(() => { setMuted(!muted); setShowMute((x) => x + 1); }, 290);
    lastTap.current = now;
  };
  const mine = post.user.id === me.id;
  return (
    <section className="reel" onClick={tap}
      onPointerDown={(e) => { if (!e.target.closest('.reel-ui')) { const tm = setTimeout(() => setPaused(true), 250); e.currentTarget.dataset.tm = tm; } }}
      onPointerUp={(e) => { clearTimeout(Number(e.currentTarget.dataset.tm)); setPaused(false); }}>
      <video disableRemotePlayback ref={vRef} src={m.url} poster={m.poster || undefined} loop playsInline muted={muted} preload={active ? 'auto' : 'metadata'} className="reel-video" />
      {heart > 0 && <span key={heart} className="big-heart"><IHeart filled size={110} /></span>}
      {showMute > 0 && <span key={'m' + showMute} className="mute-flash"><IVolume muted={muted} size={30} /></span>}
      <div className="reel-shade" />
      <div className="reel-side reel-ui">
        <button onClick={() => like()}><IHeart filled={post.liked} size={30} /><span>{fmtNum(post.likeCount)}</span></button>
        <button onClick={() => setComments(true)}><IComment size={29} /><span>{fmtNum(post.commentCount)}</span></button>
        <button onClick={() => setShare(true)}><ISend size={28} /><span>{t('share')}</span></button>
        <button onClick={save}><IBookmark filled={post.saved} size={28} /></button>
        <button onClick={() => setMenu(true)}><IMoreH size={26} /></button>
        <span className="reel-disc"><Avatar src={post.user.avatarUrl} name={post.user.username} size={26} /></span>
      </div>
      <div className="reel-info reel-ui">
        <div className="reel-user">
          <Avatar src={post.user.avatarUrl} name={post.user.username} size={36} onClick={() => nav.profile(post.user.username)} />
          <UserName user={post.user} onClick={() => nav.profile(post.user.username)} />
          {!mine && !post.following && <FollowButton user={post.user} status="none" small className="btn-outline-light" onChange={(s) => setPost((p) => ({ ...p, following: s === 'accepted' }))} />}
        </div>
        {post.caption && (
          <div className={`reel-caption ${expanded ? 'open' : ''}`} onClick={() => setExpanded(!expanded)}>
            <RichText text={post.caption} onTag={(tg) => nav.push('tag', { tag: tg })} onMention={(u) => nav.profile(u)} />
          </div>
        )}
        <div className="reel-audio"><IMusic size={14} /><span className="marquee"><span>{post.audio || `${post.user.username} · ${t('original')}`}</span></span></div>
      </div>
      <CommentsSheet open={comments} post={post} onClose={() => setComments(false)} onCount={(n) => setPost((p) => ({ ...p, commentCount: n }))} />
      <ShareSheet open={share} post={post} onClose={() => setShare(false)} />
      <ActionSheet open={menu} onClose={() => setMenu(false)} actions={[
        mine && { label: t('deletePost'), icon: <ITrash size={22} />, danger: true, onClick: () => setConfirmDel(true) },
        !mine && { label: t('report'), icon: <IFlag size={22} />, danger: true, onClick: async () => { await api('reports', { method: 'POST', body: { postId: post.id } }).catch(() => {}); toast(t('reported')); } },
      ]} />
      <Confirm open={confirmDel} title={t('deletePostQ')} okLabel={t('delete')} danger onClose={() => setConfirmDel(false)}
        onOk={async () => { try { await api(`posts/${post.id}`, { method: 'DELETE' }); onDeleted(post.id); } catch (e) { toast(errText(e.code)); } }} />
    </section>
  );
}

export function ReelsFeed({ initial, startIndex = 0, active = true, fetchMore = true }) {
  const [posts, setPosts] = useState(initial || null);
  const [cursor, setCursor] = useState(null);
  const [current, setCurrent] = useState(startIndex);
  const [muted, setMuted] = useState(false);
  const ref = useRef();

  const load = useCallback(async () => {
    const r = await api('reels'); setPosts(r.posts); setCursor(r.nextCursor);
  }, []);
  useEffect(() => { if (!initial) load().catch(() => setPosts([])); }, [initial, load]);
  useEffect(() => {
    if (posts && startIndex && ref.current) ref.current.scrollTop = startIndex * ref.current.clientHeight;
  }, [posts === null]); // eslint-disable-line

  const onScroll = () => {
    const el = ref.current;
    const i = Math.round(el.scrollTop / el.clientHeight);
    if (i !== current) setCurrent(i);
    if (fetchMore && cursor && posts && i >= posts.length - 3) {
      const c = cursor; setCursor(null);
      api(`reels?cursor=${c}`).then((r) => { setPosts((p) => [...p, ...r.posts]); setCursor(r.nextCursor); }).catch(() => {});
    }
  };
  if (posts === null) return <div className="reels-loading"><Spinner light /></div>;
  if (!posts.length) return <div className="reels-loading"><IReels size={48} /><p>{t('noReels')}</p></div>;
  return (
    <div className="reels" ref={ref} onScroll={onScroll}>
      {posts.map((p, i) => (
        <ReelItem key={p.id} post={p} active={active && i === current} muted={muted} setMuted={setMuted}
          onDeleted={(id) => setPosts((l) => l.filter((x) => x.id !== id))} />
      ))}
    </div>
  );
}

export default function Reels({ active }) {
  const { nav } = useApp();
  return (
    <div className="screen dark">
      <header className="reels-header">
        <h1>{t('reels')}</h1>
        <button className="icon-btn light" onClick={() => nav.push('create', { mode: 'reel' })} aria-label="camera"><ICamera size={28} /></button>
      </header>
      <ReelsFeed active={active} />
    </div>
  );
}

export function ReelsViewer({ posts, startIndex }) {
  return (
    <div className="screen dark">
      <TopBar transparent className="dark-bar" title="" />
      <ReelsFeed initial={posts} startIndex={startIndex} fetchMore={false} />
    </div>
  );
}
