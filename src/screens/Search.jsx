import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { t, fmtNum } from '../i18n.js';
import { useApp, Avatar, UserName, Loading, Empty, Tabs, Thumb, TopBar, useAsync, ErrorBox, FollowButton } from '../components.jsx';
import { ISearch, IBack, IClose } from '../icons.jsx';
import { usePullToRefresh } from './Feed.jsx';
import { TopicChips, fetchWorld, newSeed } from './Reels.jsx';

const REEL_BADGE = <span className="grid-badge"><svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm2.6 7.5v7l5.5-3.5Z" /></svg></span>;
export function WorldThumb({ post, tall, onClick }) {
  return (
    <div className={`grid-item ${tall ? 'tall' : ''}`} onClick={onClick}>
      <img src={post.media[0].poster} alt={post.caption} loading="lazy" />
      {REEL_BADGE}
    </div>
  );
}

const RECENT_KEY = 'nx_recent_search';

export default function Search({ active }) {
  const { nav } = useApp();
  const [explore, setExplore] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [focused, setFocused] = useState(false);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('accounts');
  const [users, setUsers] = useState(null);
  const [recent, setRecent] = useState(() => { try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch { return []; } });
  const scrollRef = useRef();
  const [topic, setTopic] = useState('mix');
  const [world, setWorld] = useState([]);
  const wpage = useRef({ seed: newSeed(), offset: 0, done: false, busy: false });
  const topicRef = useRef(topic); topicRef.current = topic;
  const loadWorld = async (reset) => {
    const pg = wpage.current;
    if (reset) { pg.seed = newSeed(); pg.offset = 0; pg.done = false; }
    if (pg.done || pg.busy) return;
    pg.busy = true;
    try {
      const tp = topicRef.current;
      const r = await fetchWorld(tp, pg.seed, pg.offset, 24);
      if (tp !== topicRef.current) return;
      setWorld((w) => { const base = reset ? [] : w; const have = new Set(base.map((x) => x.id)); return [...base, ...r.posts.filter((x) => !have.has(x.id))]; });
      pg.offset = r.nextOffset ?? pg.offset; if (!r.posts.length) pg.done = true;
    } catch { /* offline */ } finally { pg.busy = false; }
  };
  const loadExplore = async () => {
    const own = topicRef.current === 'mix' ? api('explore').then((r) => { setExplore(r.posts); setCursor(r.nextCursor); }).catch(() => setExplore([])) : Promise.resolve(setExplore([]));
    wpage.current.busy = false;
    await Promise.all([own, loadWorld(true)]);
  };
  useEffect(() => { setExplore(null); setWorld([]); loadExplore(); }, [topic]); // eslint-disable-line
  const { pull } = usePullToRefresh(scrollRef, loadExplore);

  useEffect(() => {
    if (!q.trim()) { setUsers(null); return; }
    const tm = setTimeout(() => api(`search/users?q=${encodeURIComponent(q)}`).then((r) => setUsers(r.users)).catch(() => setUsers([])), 250);
    return () => clearTimeout(tm);
  }, [q]);

  const tags = useMemo(() => {
    const counts = {};
    (explore || []).forEach((p) => (p.caption.match(/#[\p{L}\p{N}_]+/gu) || []).forEach((h) => { counts[h] = (counts[h] || 0) + 1; }));
    const term = q.trim().replace(/^#/, '').toLowerCase();
    return Object.entries(counts).filter(([h]) => !term || h.toLowerCase().includes(term)).sort((a, b) => b[1] - a[1]);
  }, [explore, q]);

  const remember = (u) => {
    const list = [u, ...recent.filter((x) => x.id !== u.id)].slice(0, 12);
    setRecent(list); localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  };
  const openUser = (u) => { remember({ id: u.id, username: u.username, fullName: u.fullName, avatarUrl: u.avatarUrl, verified: u.verified }); nav.profile(u.username); };
  const more = async () => {
    if (!cursor) { loadWorld(false); return; }
    const c = cursor; setCursor(null);
    try { const r = await api(`explore?cursor=${c}`); setExplore((e) => [...e, ...r.posts]); setCursor(r.nextCursor); } catch { /* */ }
  };
  const openWorld = (p) => nav.push('reelsViewer', { posts: world, startIndex: world.indexOf(p), world: { topic, seed: wpage.current.seed, offset: wpage.current.offset } });
  const searching = focused || q;

  return (
    <div className="screen">
      <div className="search-header">
        {searching && <button className="icon-btn" onClick={() => { setFocused(false); setQ(''); }}><IBack size={24} /></button>}
        <div className="search-box">
          <ISearch size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setFocused(true)} placeholder={t('searchPh')} dir="auto" autoCapitalize="none" />
          {q && <button onClick={() => setQ('')}><IClose size={16} /></button>}
        </div>
      </div>
      {searching ? (
        <div className="scroll">
          <Tabs value={tab} onChange={setTab} tabs={[{ id: 'accounts', label: t('accounts') }, { id: 'tags', label: t('tags') }]} />
          {tab === 'accounts' ? (
            !q.trim() ? (
              recent.length > 0 && (
                <div className="user-list">
                  <div className="section-head pad"><b>{t('recent')}</b></div>
                  {recent.map((u) => (
                    <div className="user-row" key={u.id} onClick={() => openUser(u)}>
                      <Avatar src={u.avatarUrl} name={u.username} size={50} />
                      <div className="user-row-text"><UserName user={u} /><span>{u.fullName}</span></div>
                      <button className="icon-btn" onClick={(e) => { e.stopPropagation(); const l = recent.filter((x) => x.id !== u.id); setRecent(l); localStorage.setItem(RECENT_KEY, JSON.stringify(l)); }}><IClose size={18} /></button>
                    </div>
                  ))}
                </div>
              )
            ) : users === null ? <Loading /> : users.length === 0 ? <Empty sub={t('noResults')} /> : (
              <div className="user-list">
                {users.map((u) => (
                  <div className="user-row" key={u.id} onClick={() => openUser(u)}>
                    <Avatar src={u.avatarUrl} name={u.username} size={50} />
                    <div className="user-row-text"><UserName user={u} /><span>{u.fullName}{u.followers ? ` · ${fmtNum(u.followers)} ${t('followers')}` : ''}</span></div>
                    <FollowButton user={u} status={u.followStatus} small />
                  </div>
                ))}
              </div>
            )
          ) : (
            tags.length === 0 ? <Empty sub={t('noResults')} /> : (
              <div className="user-list">
                {tags.map(([h, n]) => (
                  <div className="user-row" key={h} onClick={() => nav.push('tag', { tag: h.slice(1) })}>
                    <span className="tag-icon">#</span>
                    <div className="user-row-text"><b>{h}</b><span>{n} {t('posts')}</span></div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      ) : (
        <div className="scroll" ref={scrollRef} onScroll={(e) => { const el = e.currentTarget; if (el.scrollHeight - el.scrollTop - el.clientHeight < 600) more(); }}>
          <div className="ptr" style={{ height: pull }} />
          <TopicChips value={topic} onChange={setTopic} />
          {explore === null && !world.length ? <Loading /> : (explore || []).length + world.length === 0 ? <Empty sub={t('noPosts')} /> : (
            <div className="grid explore-grid">
              {(explore || []).map((p, i) => (
                <Thumb key={p.id} post={p} tall={p.kind === 'reel' || i % 10 === 2 || i % 10 === 5}
                  onClick={() => p.kind === 'reel' ? nav.push('reelsViewer', { posts: explore.filter((x) => x.kind === 'reel'), startIndex: explore.filter((x) => x.kind === 'reel').indexOf(p) }) : nav.push('postList', { posts: explore.filter((x) => x.kind !== 'reel'), startId: p.id, title: t('forYou') })} />
              ))}
              {world.map((p, i) => <WorldThumb key={p.id} post={p} tall={i % 10 === 2 || i % 10 === 5} onClick={() => openWorld(p)} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function TagScreen({ tag }) {
  const { nav } = useApp();
  const { loading, data, error, reload } = useAsync(() => api(`tags/${encodeURIComponent(tag)}`), [tag]);
  return (
    <div className="screen">
      <TopBar title={`#${tag}`} />
      <div className="scroll">
        <div className="tag-header">
          <span className="tag-icon big">#</span>
          <div><h2>#{tag}</h2><span className="muted">{data ? `${data.posts.length} ${t('posts')}` : ''}</span></div>
        </div>
        {loading ? <Loading /> : error ? <ErrorBox error={error} onRetry={reload} /> : data.posts.length === 0 ? <Empty sub={t('noResults')} /> : (
          <div className="grid">
            {data.posts.map((p) => <Thumb key={p.id} post={p} onClick={() => nav.push('postList', { posts: data.posts, startId: p.id, title: `#${tag}` })} />)}
          </div>
        )}
      </div>
    </div>
  );
}
