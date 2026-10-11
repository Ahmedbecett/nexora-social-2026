import { useCallback, useEffect, useRef, useState } from 'react';
import { useMedia, setReelsMuted, playSafe } from '../media.js';
import { tapHaptic } from '../theme.js';
import { api } from '../api.js';
import { t, fmtNum, errText } from '../i18n.js';
import { useApp, Avatar, UserName, FollowButton, Spinner, RichText, ActionSheet, Confirm, TopBar, Sheet } from '../components.jsx';
import { IHeart, IComment, ISend, IBookmark, IMoreLines, IPlus, IPrefs, IVolume, IFlag, ITrash, IReels, IGlobe, ILink, IEyeOff, IRepost, ICheck } from '../icons.jsx';
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
  // count a view after 2s of watching (once per item)
  const viewed = useRef(false);
  useEffect(() => {
    if (!active || viewed.current || (world && !post.wid)) return undefined;
    const tm = setTimeout(() => { viewed.current = true; api(world ? `world/${post.wid}/view` : `posts/${post.id}/view`, { method: 'POST' }).catch(() => {}); }, 2000);
    return () => clearTimeout(tm);
  }, [active]); // eslint-disable-line
  const repost = async () => {
    const val = !post.reposted; setPost((p) => ({ ...p, reposted: val }));
    try { await api(`posts/${post.id}/repost`, { method: val ? 'POST' : 'DELETE' }); toast(val ? t('reposted') : t('repostRemoved')); }
    catch (e) { setPost((p) => ({ ...p, reposted: !val })); toast(errText(e.code)); }
  };

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
      onPointerUp={(e) => { clearTimeout(Number(e.currentTarget.dataset.tm)); setPaused(false); }}
      onPointerCancel={(e) => { clearTimeout(Number(e.currentTarget.dataset.tm)); setPaused(false); }}>
      <video disableRemotePlayback ref={vRef} src={m.url} poster={m.poster || undefined} loop playsInline muted={muted} preload={active ? 'auto' : near ? 'metadata' : 'none'}
        className={`reel-video ${wide ? 'contain' : ''}`} onError={() => { if (world && active) hide(); }} />
      {heart > 0 && <span key={heart} className="big-heart"><IHeart filled size={110} /></span>}
      {showMute > 0 && <span key={'m' + showMute} className="mute-flash"><IVolume muted={muted} size={30} /></span>}
      <div className="reel-shade" />
      <div className="reel-side reel-ui">
        {(!world || post.wid) && <button onClick={() => like()} aria-label="like"><IHeart filled={post.liked} size={28} />{post.likeCount > 0 && <span>{fmtNum(post.likeCount)}</span>}</button>}
        {!world && <button onClick={() => setComments(true)} aria-label="comment"><IComment size={28} />{post.commentCount > 0 && <span>{fmtNum(post.commentCount)}</span>}</button>}
        <button onClick={shareIt} aria-label="share"><ISend size={28} /></button>
        {!world && <button onClick={save} aria-label="save"><IBookmark filled={post.saved} size={28} /></button>}
        <button onClick={() => setMenu(true)} aria-label="more"><IMoreLines size={28} /></button>
      </div>
      <div className="reel-info reel-ui">
        {world ? (
          <div className="reel-user" onClick={() => openUrl(post.source.url)}>
            <span className="world-avatar"><IGlobe size={22} /></span>
            <span className="uname"><bdi>{post.source.author}</bdi></span>
          </div>
        ) : (
          <div className="reel-user">
            <Avatar src={post.user.avatarUrl} name={post.user.username} size={40} onClick={() => nav.profile(post.user.username)} />
            <UserName user={post.user} onClick={() => nav.profile(post.user.username)} />
            {!mine && !post.following && <FollowButton user={post.user} status="none" small className="reel-follow" onChange={(s) => setPost((p) => ({ ...p, following: s === 'accepted' }))} />}
          </div>
        )}
        {(post.caption || world) && (
          <div className={`reel-caption ${expanded ? 'open' : ''}`} onClick={() => setExpanded(!expanded)}>
            {post.caption ? <RichText text={post.caption} onTag={(tg) => nav.push('tag', { tag: tg })} onMention={(u) => nav.profile(u)} /> : null}
            {world && expanded && <div className="reel-credit">{t('worldSource')} · {post.source.license}</div>}
            {!expanded && <span className="reel-more">{t('seeMore')}</span>}
          </div>
        )}
      </div>
      <ReelProgress vRef={vRef} />
      {!world && <CommentsSheet open={comments} post={post} onClose={() => setComments(false)} onCount={(n) => setPost((p) => ({ ...p, commentCount: n }))} />}
      {!world && <ShareSheet open={share} post={post} onClose={() => setShare(false)} />}
      <ActionSheet open={menu} onClose={() => setMenu(false)} actions={world ? [
        { label: muted ? t('unmute') : t('mute'), icon: <IVolume muted={!muted} size={22} />, onClick: () => setMuted(!muted) },
        { label: t('viewSource'), icon: <IGlobe size={22} />, onClick: () => openUrl(post.source.url) },
        { label: t('copyLink'), icon: <ILink size={22} />, onClick: shareIt },
        { label: t('notInterested'), icon: <IEyeOff size={22} />, onClick: () => { hide(); toast(t('notInterestedDone')); } },
      ] : [
        !mine && !post.user.isPrivate && { label: post.reposted ? t('removeRepost') : t('repost'), icon: <IRepost size={22} />, onClick: repost },
        { label: t('copyLink'), icon: <ILink size={22} />, onClick: () => setShare(true) },
        { label: muted ? t('unmute') : t('mute'), icon: <IVolume muted={!muted} size={22} />, onClick: () => setMuted(!muted) },
        mine && { label: t('deletePost'), icon: <ITrash size={22} />, danger: true, onClick: () => setConfirmDel(true) },
        !mine && { label: t('report'), icon: <IFlag size={22} />, danger: true, onClick: async () => { await api('reports', { method: 'POST', body: { postId: post.id } }).catch(() => {}); toast(t('reported')); } },
      ]} />
      <Confirm open={confirmDel} title={t('deletePostQ')} okLabel={t('delete')} danger onClose={() => setConfirmDel(false)}
        onOk={async () => { try { await api(`posts/${post.id}`, { method: 'DELETE' }); onDeleted(post.id); } catch (e) { toast(errText(e.code)); } }} />
    </section>
  );
}

export function ReelsFeed({ initial, startIndex = 0, active = true, fetchMore = true, topic = 'mix', world: worldInit, friends = false }) {
  const { nav } = useApp();
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
        const qs = new URLSearchParams(); if (pg.cursor) qs.set('cursor', pg.cursor); if (friends) qs.set('following', '1');
        const r = await api(`reels${qs.toString() ? `?${qs}` : ''}`);
        // friends tab: older servers ignore ?following, so filter on the client too
        add(friends ? r.posts.filter((x) => x.following) : r.posts); pg.cursor = r.nextCursor; if (!r.nextCursor) pg.ownDone = true;
        if (friends) { if (!pg.ownDone && r.posts.length && !r.posts.some((x) => x.following)) { pg.busy = false; return next(); } return; }
        if (r.posts.length >= 3) return;
      }
      if (!pg.worldDone && !friends) {
        const r = await fetchWorld(topic, pg.seed, pg.offset);
        add(r.posts); pg.offset = r.nextOffset ?? pg.offset; if (!r.posts.length) pg.worldDone = true;
      }
    } finally { pg.busy = false; }
  }, [topic, friends]);

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
  if (!posts.length) return friends ? (
    <div className="reels-loading friends-empty"><IReels size={48} /><h3>{t('friendsEmptyTitle')}</h3><p>{t('friendsEmpty')}</p>
      <button className="btn btn-primary" onClick={() => nav.tab('search')}>{t('findPeople')}</button></div>
  ) : <div className="reels-loading"><IReels size={48} /><p>{t('noReels')}</p></div>;
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

/** Topic picker (the "preferences" button in the Reels / Explore header). */
export function TopicSheet({ open, onClose, value, onChange }) {
  return (
    <Sheet open={open} onClose={onClose} title={t('chooseTopics')}>
      <div className="topic-list">
        {TOPICS.map((id) => (
          <button key={id} className={`topic-row ${value === id ? 'on' : ''}`} onClick={() => { onChange(id); onClose(); }}>
            <span>{topicLabel(id)}</span>{value === id && <span className="blue-check"><ICheck size={14} sw={3} /></span>}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

export default function Reels({ active }) {
  const { nav, me } = useApp();
  const [topic, setTopic] = useState('mix');
  const [tab, setTab] = useState('reels');
  const [prefs, setPrefs] = useState(false);
  const [faces, setFaces] = useState([]);
  useEffect(() => {
    if (!me?.username) return;
    api(`users/${encodeURIComponent(me.username)}/following`).then((r) => setFaces((r.users || []).slice(0, 3))).catch(() => {});
  }, [me?.username]);
  return (
    <div className="screen dark">
      <header className="reels-header">
        <button className="icon-btn light" onClick={() => nav.push('create', { mode: 'reel' })} aria-label={t('newReel')}><IPlus size={28} sw={2} /></button>
        <div className="reels-tabs">
          <button className={tab === 'reels' ? 'on' : ''} onClick={() => setTab('reels')}>{t('reels')}</button>
          <button className={tab === 'friends' ? 'on' : ''} onClick={() => setTab('friends')}>
            {t('friends')}
            {faces.length > 0 && <span className="face-stack">{faces.map((u) => <Avatar key={u.id} src={u.avatarUrl} name={u.username} size={24} />)}</span>}
          </button>
        </div>
        <button className="icon-btn light" onClick={() => setPrefs(true)} aria-label={t('chooseTopics')}><IPrefs size={28} /></button>
      </header>
      <ReelsFeed key={tab + topic} active={active} topic={tab === 'friends' ? 'mix' : topic} friends={tab === 'friends'} />
      <TopicSheet open={prefs} onClose={() => setPrefs(false)} value={topic} onChange={(v) => { setTopic(v); setTab('reels'); }} />
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
