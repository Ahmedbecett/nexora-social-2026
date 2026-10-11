import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { t } from '../i18n.js';
import { useApp, Avatar, Wordmark, Spinner, Empty, ErrorBox, Sheet } from '../components.jsx';
import { IHeart, ISend, IPlus, ICheck, IDown, IUsers, IStar } from '../icons.jsx';
import { PostCard, SuggestedUsers } from './Post.jsx';
import { fetchWorld, newSeed } from './Reels.jsx';
import { IGlobe } from '../icons.jsx';

/** Horizontal row of real, freely-licensed reels from around the world (Wikimedia Commons). */
export function WorldStrip({ reloadKey }) {
  const { nav } = useApp();
  const [items, setItems] = useState([]);
  const seed = useRef(newSeed());
  useEffect(() => {
    seed.current = newSeed();
    fetchWorld('mix', seed.current, 0, 12).then((r) => setItems(r.posts)).catch(() => {});
  }, [reloadKey]);
  if (!items.length) return null;
  const open = (i) => nav.push('reelsViewer', { posts: items, startIndex: i, world: { topic: 'mix', seed: seed.current, offset: items.length } });
  return (
    <div className="world-strip">
      <div className="world-strip-head"><b>{t('worldReels')}</b><button className="text-link" onClick={() => nav.tab('reels')}>{t('seeAll')}</button></div>
      <div className="world-strip-row">
        {items.map((p, i) => (
          <div className="world-card" key={p.id} onClick={() => open(i)}>
            <img src={p.media[0].poster} alt="" loading="lazy" />
            <span className="grid-badge"><IGlobe size={16} /></span>
            <span className="world-card-cap">{p.caption}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function usePullToRefresh(ref, onRefresh) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    let startY = null, dist = 0;
    const ts = (e) => { if (el.scrollTop <= 0) startY = e.touches[0].clientY; };
    const tm = (e) => { if (startY == null) return; dist = Math.max(0, Math.min(110, (e.touches[0].clientY - startY) * 0.5)); setPull(dist); };
    const te = async () => {
      if (startY == null) return; startY = null;
      if (dist > 60) { setRefreshing(true); setPull(56); try { await onRefresh(); } finally { setRefreshing(false); } }
      setPull(0); dist = 0;
    };
    el.addEventListener('touchstart', ts, { passive: true }); el.addEventListener('touchmove', tm, { passive: true }); el.addEventListener('touchend', te);
    return () => { el.removeEventListener('touchstart', ts); el.removeEventListener('touchmove', tm); el.removeEventListener('touchend', te); };
  }, [ref, onRefresh]);
  return { pull, refreshing };
}

export function StoriesTray({ tray, onOpen }) {
  const { me, nav } = useApp();
  const mine = tray.find((g) => g.user.id === me.id);
  const others = tray.filter((g) => g.user.id !== me.id);
  return (
    <div className="stories-tray">
      <div className="story-item" onClick={() => mine ? onOpen(tray.indexOf(mine)) : nav.push('create', { mode: 'story' })}>
        <div className="story-avatar-wrap">
          <Avatar src={me.avatarUrl} name={me.username} size={86} ring={mine ? (mine.allSeen ? 'seen' : 'story') : 'none'} />
          <span className="story-plus" onClick={(e) => { e.stopPropagation(); nav.push('create', { mode: 'story' }); }}><IPlus size={15} sw={3} /></span>
        </div>
        <span className="story-name">{t('yourStory')}</span>
      </div>
      {others.map((g) => (
        <div className="story-item" key={g.user.id} onClick={() => onOpen(tray.indexOf(g))}>
          <Avatar src={g.user.avatarUrl} name={g.user.username} size={86} ring={g.allSeen ? 'seen' : g.close ? 'close' : 'story'} />
          <span className="story-name">{g.user.username}</span>
        </div>
      ))}
    </div>
  );
}

export default function Feed({ active, refreshKey }) {
  const { nav, badges, me } = useApp();
  const [posts, setPosts] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [tray, setTray] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestedPosts, setSuggestedPosts] = useState([]);
  const [error, setError] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const scrollRef = useRef();
  const [filter, setFilter] = useState('following');
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef(filter); filterRef.current = filter;
  const feedPath = (cur) => `feed?${filterRef.current === 'favorites' ? 'filter=favorites&' : ''}${cur ? `cursor=${cur}` : ''}`;

  const load = useCallback(async () => {
    setError(null);
    try {
      const [f, s, sg] = await Promise.all([api(feedPath()), api('stories'), api('suggestions').catch(() => ({ users: [] }))]);
      setPosts(f.posts); setCursor(f.nextCursor); setTray(s.tray); setSuggestions(sg.users);
      if (!f.nextCursor) api('explore?suggested=1').then((r) => setSuggestedPosts(r.posts.slice(0, 12))).catch(() => {});
    } catch (e) { setError(e); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (refreshKey) { scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); load(); } }, [refreshKey, load]);
  // reload stories when returning to feed
  useEffect(() => { if (active && posts) api('stories').then((s) => setTray(s.tray)).catch(() => {}); }, [active]); // eslint-disable-line
  useEffect(() => {
    const onNew = () => load();
    window.addEventListener('nx-posted', onNew);
    return () => window.removeEventListener('nx-posted', onNew);
  }, [load]);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const f = await api(feedPath(cursor));
      setPosts((p) => [...p, ...f.posts]); setCursor(f.nextCursor);
      if (!f.nextCursor) api('explore?suggested=1').then((r) => setSuggestedPosts(r.posts.slice(0, 12))).catch(() => {});
    } catch { /* ignore */ }
    setLoadingMore(false);
  };
  const onScroll = (e) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 1200) loadMore();
  };
  const { pull, refreshing } = usePullToRefresh(scrollRef, load);
  const openStories = (index) => nav.push('stories', { tray, index, onSeen: (uid) => setTray((tr) => tr.map((g) => g.user.id === uid ? { ...g, allSeen: true, stories: g.stories.map((s) => ({ ...s, seen: true })) } : g)) });

  return (
    <div className="screen">
      <header className="feed-header">
        <button className="icon-btn" onClick={() => nav.push('create')} aria-label={t('create')}><IPlus size={30} sw={1.8} /></button>
        <button className="feed-logo" onClick={() => setFilterOpen(true)} aria-label={t('followingFeed')}><Wordmark size={36} /></button>
        <div className="feed-header-actions">
          <button className="icon-btn badge-wrap" onClick={() => nav.push('notifications')} aria-label={t('notifications')}>
            <IHeart size={28} />{(badges.notifications > 0 || badges.requests > 0) && <span className="dot-badge" />}
          </button>
        </div>
      </header>
      <div className="scroll" ref={scrollRef} onScroll={onScroll}>
        <div className="ptr" style={{ height: pull }}>{(pull > 20 || refreshing) && <Spinner size={22} />}</div>
        {me && <StoriesTray tray={tray} onOpen={openStories} />}
        {error && !posts ? <ErrorBox error={error} onRetry={load} />
          : posts === null ? <FeedSkeleton />
            : (
              <>
                {filter === 'favorites' && <div className="feed-filter-bar"><IStar size={16} filled /> {t('favorites')}<button className="text-link" onClick={() => { setFilter('following'); filterRef.current = 'following'; setPosts(null); load(); }}>{t('backToFeed')}</button></div>}
                {posts.length === 0 && (filter === 'favorites' ? <Empty icon={<IStar size={36} />} title={t('favorites')} sub={t('noFavoritesFeed')} /> : <Empty title={t('welcome')} sub={t('welcomeSub')} />)}
                {posts.length < 3 && <WorldStrip reloadKey={refreshKey} />}
                {posts.map((p, i) => (
                  <div key={p.id}>
                    <PostCard post={p} onDeleted={(id) => setPosts((l) => l.filter((x) => x.id !== id))} />
                    {i === 2 && <WorldStrip reloadKey={refreshKey} />}
                    {i === 1 && suggestions.length > 0 && <SuggestedUsers users={suggestions} onDismiss={(id) => setSuggestions((s) => s.filter((u) => u.id !== id))} />}
                  </div>
                ))}
                {posts.length < 2 && <SuggestedUsers users={suggestions} onDismiss={(id) => setSuggestions((s) => s.filter((u) => u.id !== id))} />}
                {loadingMore && <div className="center-pad"><Spinner /></div>}
                {!cursor && posts.length > 0 && (
                  <div className="caught-up">
                    <span className="caught-icon"><ICheck size={30} /></span>
                    <h3>{t('caughtUp')}</h3><p>{t('caughtUpSub')}</p>
                  </div>
                )}
                {!cursor && suggestedPosts.length > 0 && (
                  <>
                    <div className="section-head pad"><b>{t('suggestedPosts')}</b></div>
                    {suggestedPosts.map((p) => <PostCard key={'s' + p.id} post={p} />)}
                  </>
                )}
              </>
            )}
      </div>
      <Sheet open={filterOpen} onClose={() => setFilterOpen(false)}>
        <div className="actions">
          {[['following', t('followingFeed'), <IUsers size={24} key="i" />], ['favorites', t('favorites'), <IStar size={24} key="s" />]].map(([k, label, icon]) => (
            <button key={k} className="action" onClick={() => { setFilterOpen(false); if (k !== filter) { setFilter(k); filterRef.current = k; setPosts(null); load(); } }}>
              {icon}<span style={{ flex: 1 }}>{label}</span>{filter === k && <ICheck size={20} />}
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

function FeedSkeleton() {
  return [0, 1].map((i) => (
    <div className="post skeleton" key={i}>
      <div className="post-head"><span className="sk sk-circle" /><span className="sk sk-line" style={{ width: 120 }} /></div>
      <div className="sk sk-media" />
      <div className="post-info"><span className="sk sk-line" style={{ width: 90 }} /><span className="sk sk-line" style={{ width: '70%' }} /></div>
    </div>
  ));
}
