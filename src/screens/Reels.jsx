import { useCallback, useEffect, useRef, useState } from 'react';
import { useMedia, setReelsMuted, playSafe } from '../media.js';
import { tapHaptic } from '../theme.js';
import { api } from '../api.js';
import { t, fmtNum, errText } from '../i18n.js';
import { useApp, Avatar, UserName, FollowButton, Spinner, RichText, ActionSheet, Confirm, TopBar } from '../components.jsx';
import { IHeart, IComment, ISend, IBookmark, IMoreH, ICamera, IMusic, IVolume, IFlag, ITrash, IReels, IGlobe, ILink, IEyeOff } from '../icons.jsx';
import { CommentsSheet, ShareSheet, shareLink } from './Post.jsx';
import { openUrl } from '../native.js';
import { fetchWorld } from '../world.js';

export const TOPICS = ['mix', 'nature', 'animals', 'space', 'ocean', 'city', 'sports', 'dance', 'music', 'food', 'travel'];
export const topicLabel = (id) => (id === 'mix' ? t('forYou') : t('topic_' + id));
export const newSeed = () => Math.random().toString(36).slice(2, 10);
export { fetchWorld } from '../world.js';

/** Thin progress bar at the bottom of a reel; drag / tap to seek. */
function ReelProgress({ vRef }) {
  const bar = useRef();
  useEffect(() => {
    const v = vRef.current; if (!v) return undefined;
    let raf;
    const tick = () => { if (bar.current && v.duration) bar.current.style.transform = `scaleX(${v.currentTime / v.duration})`; raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [vRef]);
  const seek = (e) => {
    const v = vRef.current; if (!v || !v.duration) return;
    const r = e.currentTarget.getBoundingClientRect();
    const rtl = getComputedStyle(e.currentTarget).direction === 'rtl';
    let x = (e.clientX - r.left) / r.width; if (rtl) x = 1 - x;
    v.currentTime = Math.max(0, Math.min(0.999, x)) * v.duration;
  };
  return (
    <div className="reel-progress reel-ui" onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); seek(e); }} onPointerMove={(e) => { if (e.buttons) seek(e); }}>
      <div className="reel-progress-track"><i ref={bar} /></div>
    </div>
  );
}

function ReelItem({ post: initial, active, near, muted, setMuted, onDeleted }) {
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
  const world = !!post.world;
  const wide = m.width && m.height && m.width > m.height * 1.05;

  const { appActive } = useMedia();
  useEffect(() => { if (vRef.current) vRef.current.muted = muted; }, [muted]);
  useEffect(() => {
    const v = vRef.current; if (!v) return;
    if (active && !paused && appActive) { v.muted = muted; playSafe(v, () => setMuted(true)); } else v.pause();
  }, [active, paused, appActive]); // eslint-disable-line
  useEffect(() => { if (!active && vRef.current) vRef.current.currentTime = 0; }, [active]);

  const like = async (force) => {
    if (world && !post.wid) return;
    const val = force ? true : !post.liked;
    if (force && post.liked) return;
    if (val) tapHaptic();
    setPost((p) => ({ ...p, liked: val, likeCount: p.likeCount + (val ? 1 : -1) }));
    try { const r = await api(world ? `world/${post.wid}/like` : `posts/${post.id}/like`, { method: val ? 'POST' : 'DELETE' }); setPost((p) => ({ ...p, likeCount: r.likeCount, liked: r.liked })); }
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
  const mine = !world && post.user.id === me.id;
  const hide = async () => { onDeleted(post.id); if (post.wid) api(`world/${post.wid}/hide`, { method: 'POST' }).catch(() => {}); };
  const shareIt = async () => { if (!world) { setShare(true); return; } const ok = await shareLink(post.source.url, post.caption); if (!ok) toast(t('linkCopied')); };
  return (
    <section className="reel" onClick={tap}
      onPointerDown={(e) => { if (!e.target.closest('.reel-ui')) { const tm = setTimeout(() => setPaused(true), 250); e.currentTarget.dataset.tm = tm; } }}
      onPointerUp={(e) => { clearTimeout(Number(e.currentTarget.dataset.tm)); setPaused(false); }}>
      {wide && m.poster && <img className="reel-backdrop" src={m.poster} alt="" />}
      <video disableRemotePlayback ref={vRef} src={m.url} poster={m.poster || undefined} loop playsInline muted={muted} preload={active ? 'auto' : near ? 'metadata' : 'none'}
        className={`reel-video ${wide ? 'contain' : ''}`} onError={() => { if (world && active) hide(); }} />
      {heart > 0 && <span key={heart} className="big-heart"><IHeart filled size={110} /></span>}
      {showMute > 0 && <span key={'m' + showMute} className="mute-flash"><IVolume muted={muted} size={30} /></span>}
      <div className="reel-shade" />
      <div className="reel-side reel-ui">
        {(!world || post.wid) && <button onClick={() => like()}><IHeart filled={post.liked} size={30} /><span>{fmtNum(post.likeCount)}</span></button>}
        {!world && <button onClick={() => setComments(true)}><IComment size={29} /><span>{fmtNum(post.commentCount)}</span></button>}
        <button onClick={shareIt}><ISend size={28} /><span>{t('share')}</span></button>
        {!world && <button onClick={save}><IBookmark filled={post.saved} size={28} /></button>}
        <button onClick={() => setMenu(true)}><IMoreH size={26} /></button>
        {world ? <span className="reel-disc world"><IGlobe size={18} /></span> : <span className="reel-disc"><Avatar src={post.user.avatarUrl} name={post.user.username} size={26} /></span>}
      </div>
      <div className="reel-info reel-ui">
        {world ? (
          <div className="reel-user" onClick={() => openUrl(post.source.url)}>
            <span className="world-avatar"><IGlobe size={20} /></span>
            <div className="world-credit"><b>{post.source.author}</b><span>{t('worldSource')} · {post.source.license}</span></div>
          </div>
        ) : (
        <div className="reel-user">
          <Avatar src={post.user.avatarUrl} name={post.user.username} size={36} onClick={() => nav.profile(post.user.username)} />
          <UserName user={post.user} onClick={() => nav.profile(post.user.username)} />
          {!mine && !post.following && <FollowButton user={post.user} status="none" small className="btn-outline-light" onChange={(s) => setPost((p) => ({ ...p, following: s === 'accepted' }))} />}
        </div>
        )}
        {post.caption && (
          <div className={`reel-caption ${expanded ? 'open' : ''}`} onClick={() => setExpanded(!expanded)}>
            <RichText text={post.caption} onTag={(tg) => nav.push('tag', { tag: tg })} onMention={(u) => nav.profile(u)} />
          </div>
        )}
        <div className="reel-audio"><IMusic size={14} /><span className="marquee"><span>{world ? `${post.source.author} · ${t('original')}` : post.audio || `${post.user.username} · ${t('original')}`}</span></span></div>
      </div>
      <ReelProgress vRef={vRef} />
      {!world && <CommentsSheet open={comments} post={post} onClose={() => setComments(false)} onCount={(n) => setPost((p) => ({ ...p, commentCount: n }))} />}
      {!world && <ShareSheet open={share} post={post} onClose={() => setShare(false)} />}
      <ActionSheet open={menu} onClose={() => setMenu(false)} actions={world ? [
        { label: t('viewSource'), icon: <IGlobe size={22} />, onClick: () => openUrl(post.source.url) },
        { label: t('copyLink'), icon: <ILink size={22} />, onClick: shareIt },
        { label: t('notInterested'), icon: <IEyeOff size={22} />, onClick: () => { hide(); toast(t('notInterestedDone')); } },
      ] : [
        mine && { label: t('deletePost'), icon: <ITrash size={22} />, danger: true, onClick: () => setConfirmDel(true) },
        !mine && { label: t('report'), icon: <IFlag size={22} />, danger: true, onClick: async () => { await api('reports', { method: 'POST', body: { postId: post.id } }).catch(() => {}); toast(t('reported')); } },
      ]} />
      <Confirm open={confirmDel} title={t('deletePostQ')} okLabel={t('delete')} danger onClose={() => setConfirmDel(false)}
        onOk={async () => { try { await api(`posts/${post.id}`, { method: 'DELETE' }); onDeleted(post.id); } catch (e) { toast(errText(e.code)); } }} />
    </section>
  );
}

export function ReelsFeed({ initial, startIndex = 0, active = true, fetchMore = true, topic = 'mix', world: worldInit }) {
  const [posts, setPosts] = useState(initial || null);
  const [current, setCurrent] = useState(startIndex);
  const { reelsMuted: muted } = useMedia();
  const setMuted = setReelsMuted;
  const ref = useRef();
  // paging: own reels first (cursor), then world reels (offset)
  const page = useRef({ cursor: null, ownDone: topic !== 'mix', seed: worldInit?.seed || newSeed(), offset: worldInit?.offset ?? 0, worldDone: false, busy: false });

  const add = (list) => setPosts((p) => {
    const have = new Set((p || []).map((x) => x.id));
    return [...(p || []), ...list.filter((x) => !have.has(x.id))];
  });
  const next = useCallback(async () => {
    const pg = page.current;
    if (pg.busy) return;
    pg.busy = true;
    try {
      if (!pg.ownDone) {
        const r = await api(`reels${pg.cursor ? `?cursor=${pg.cursor}` : ''}`);
        add(r.posts); pg.cursor = r.nextCursor; if (!r.nextCursor) pg.ownDone = true;
        if (r.posts.length >= 3) return;
      }
      if (!pg.worldDone) {
        const r = await fetchWorld(topic, pg.seed, pg.offset);
        add(r.posts); pg.offset = r.nextOffset ?? pg.offset; if (!r.posts.length) pg.worldDone = true;
      }
    } finally { pg.busy = false; }
  }, [topic]);

  useEffect(() => {
    if (initial) return;
    setPosts(null);
    next().then(() => setPosts((p) => p || [])).catch(() => setPosts((p) => p || []));
  }, [initial, next]);
  useEffect(() => {
    if (posts && startIndex && ref.current) ref.current.scrollTop = startIndex * ref.current.clientHeight;
  }, [posts === null]); // eslint-disable-line

  const onScroll = () => {
    const el = ref.current;
    const i = Math.round(el.scrollTop / el.clientHeight);
    if (i !== current) setCurrent(i);
    if (fetchMore && posts && i >= posts.length - 3) next().catch(() => {});
  };
  if (posts === null) return <div className="reels-loading"><Spinner light /></div>;
  if (!posts.length) return <div className="reels-loading"><IReels size={48} /><p>{t('noReels')}</p></div>;
  return (
    <div className="reels" ref={ref} onScroll={onScroll}>
      {posts.map((p, i) => (
        <ReelItem key={p.id} post={p} active={active && i === current} near={Math.abs(i - current) <= 1} muted={muted} setMuted={setMuted}
          onDeleted={(id) => setPosts((l) => l.filter((x) => x.id !== id))} />
      ))}
    </div>
  );
}

export function TopicChips({ value, onChange, dark }) {
  return (
    <div className={`topic-chips ${dark ? 'dark' : ''}`}>
      {TOPICS.map((id) => (
        <button key={id} className={value === id ? 'on' : ''} onClick={() => onChange(id)}>{topicLabel(id)}</button>
      ))}
    </div>
  );
}

export default function Reels({ active }) {
  const { nav } = useApp();
  const [topic, setTopic] = useState('mix');
  return (
    <div className="screen dark">
      <header className="reels-header">
        <h1>{t('reels')}</h1>
        <button className="icon-btn light" onClick={() => nav.push('create', { mode: 'reel' })} aria-label="camera"><ICamera size={28} /></button>
        <TopicChips value={topic} onChange={setTopic} dark />
      </header>
      <ReelsFeed key={topic} active={active} topic={topic} />
    </div>
  );
}

export function ReelsViewer({ posts, startIndex, world }) {
  return (
    <div className="screen dark">
      <TopBar transparent className="dark-bar" title="" />
      <ReelsFeed initial={posts} startIndex={startIndex} fetchMore={!!world} topic={world?.topic || 'mix'} world={world} />
    </div>
  );
}
