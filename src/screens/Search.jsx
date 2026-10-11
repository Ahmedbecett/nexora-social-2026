import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { t, fmtNum } from '../i18n.js';
import { useApp, Avatar, UserName, Loading, Empty, Tabs, Thumb, TopBar, useAsync, ErrorBox, FollowButton } from '../components.jsx';
import { ISearch, IBack, IClose, IBookmark, IPrefs, IEye } from '../icons.jsx';
import { usePullToRefresh } from './Feed.jsx';
import { TOPICS, topicLabel, TopicSheet, fetchWorld, newSeed } from './Reels.jsx';
import { searchReels } from '../world.js';

/** Instagram-style view counter shown on explore / profile tiles. */
export const ViewCount = ({ n }) => (n > 0 ? <span className="grid-views"><IEye size={15} sw={2.2} /><b>{fmtNum(n)}</b></span> : null);
export function WorldThumb({ post, onClick }) {
  return (
    <div className="grid-item" onClick={onClick}>
      <img src={post.media[0].poster} alt={post.caption} loading="lazy" />
      <ViewCount n={post.viewCount} />
    </div>
  );
}

const RECENT_KEY = 'nx_recent_search';
const norm = (s) => String(s || '').trim().replace(/^@+/, '');

export default function Search({ active }) {
  const { nav, me } = useApp();
  const [explore, setExplore] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [focused, setFocused] = useState(false);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('accounts');
  const [users, setUsers] = useState(null);
  const [reels, setReels] = useState(null);
  const [prefs, setPrefs] = useState(false);
  const [recent, setRecent] = useState(() => { try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch { return []; } });
  const scrollRef = useRef();
  const inputRef = useRef();
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

  // Accounts: server search (username / name, ignoring dots, underscores and spaces) +
  // an exact-username lookup so a typed handle is always found.
  useEffect(() => {
    const term = norm(q);
    if (!term) { setUsers(null); return undefined; }
    setUsers(null);
    let off = false;
    const tm = setTimeout(async () => {
      const [list, exact] = await Promise.all([
        api(`search/users?q=${encodeURIComponent(term)}`).then((r) => r.users).catch(() => []),
        /^[a-z0-9._]{3,30}$/i.test(term) ? api(`users/${encodeURIComponent(term.toLowerCase())}`).then((r) => r.user).catch(() => null) : null,
      ]);
      if (off) return;
      const out = exact ? [exact, ...list.filter((u) => u.id !== exact.id)] : list;
      setUsers(out);
    }, 220);
    return () => { off = true; clearTimeout(tm); };
  }, [q]);
  useEffect(() => {
    const term = norm(q);
    setReels(null);
    if (!term || tab !== 'reels') return undefined;
    let off = false;
    const tm = setTimeout(() => searchReels(term).then((r) => { if (!off) setReels(r); }).catch(() => { if (!off) setReels([]); }), 350);
    return () => { off = true; clearTimeout(tm); };
  }, [q, tab]);

  const tags = useMemo(() => {
    const counts = {};
    (explore || []).forEach((p) => (p.caption.match(/#[\p{L}\p{N}_]+/gu) || []).forEach((h) => { counts[h] = (counts[h] || 0) + 1; }));
    const term = q.trim().replace(/^#/, '').toLowerCase();
    const list = Object.entries(counts).filter(([h]) => !term || h.toLowerCase().includes(term)).sort((a, b) => b[1] - a[1]);
    if (term && /^[\p{L}\p{N}_]+$/u.test(term) && !list.some(([h]) => h.toLowerCase() === '#' + term)) list.unshift(['#' + term, null]);
    return list;
  }, [explore, q]);

  const saveRecent = (list) => { setRecent(list); localStorage.setItem(RECENT_KEY, JSON.stringify(list)); };
  const remember = (u) => saveRecent([u, ...recent.filter((x) => x.id !== u.id)].slice(0, 15));
  const openUser = (u) => { remember({ id: u.id, username: u.username, fullName: u.fullName, avatarUrl: u.avatarUrl, verified: u.verified }); nav.profile(u.username); };
  const more = async () => {
    if (!cursor) { loadWorld(false); return; }
    const c = cursor; setCursor(null);
    try { const r = await api(`explore?cursor=${c}`); setExplore((e) => [...e, ...r.posts]); setCursor(r.nextCursor); } catch { /* */ }
  };
  const openWorld = (p) => nav.push('reelsViewer', { posts: world, startIndex: world.indexOf(p), world: { topic, seed: wpage.current.seed, offset: wpage.current.offset } });
  const searching = focused || q;
  const close = () => { setFocused(false); setQ(''); inputRef.current?.blur(); };

  const userRow = (u, onX) => (
    <div className="user-row" key={u.id} onClick={() => openUser(u)}>
      <Avatar src={u.avatarUrl} name={u.username} size={50} />
      <div className="user-row-text"><UserName user={u} /><span>{u.fullName}{u.followers ? ` · ${fmtNum(u.followers)} ${t('followers')}` : ''}</span></div>
      {onX ? <button className="icon-btn" onClick={(e) => { e.stopPropagation(); onX(); }} aria-label="remove"><IClose size={18} /></button>
        : u.id !== me?.id && u.followStatus !== undefined && <FollowButton user={u} status={u.followStatus} small />}
    </div>
  );

  return (
    <div className="screen">
      <div className="search-header">
        {searching && <button className="icon-btn" onClick={close} aria-label="back"><IBack size={24} /></button>}
        <div className="search-box ig">
          <ISearch size={20} />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setFocused(true)} placeholder={t('searchPh')} dir="auto" autoCapitalize="none" autoCorrect="off" enterKeyHint="search" />
          {q && <button onClick={() => setQ('')} aria-label="clear"><IClose size={16} /></button>}
        </div>
        {!searching && <button className="icon-btn" onClick={() => nav.push('settingsPage', { page: 'saved' })} aria-label={t('saved')}><IBookmark size={28} /></button>}
      </div>
      {searching ? (
        <div className="scroll">
          {!norm(q) ? (
            recent.length > 0 ? (
              <div className="user-list">
                <div className="section-head pad"><b>{t('recent')}</b><button className="text-link strong" onClick={() => saveRecent([])}>{t('clearAll')}</button></div>
                {recent.map((u) => userRow(u, () => saveRecent(recent.filter((x) => x.id !== u.id))))}
              </div>
            ) : <Empty icon={<ISearch size={36} />} sub={t('searchPh')} />
          ) : (
            <>
              <Tabs value={tab} onChange={setTab} tabs={[{ id: 'accounts', label: t('accounts') }, { id: 'reels', label: t('searchReels') }, { id: 'tags', label: t('tags') }]} />
              {tab === 'accounts' ? (
                users === null ? <Loading /> : users.length === 0 ? <Empty sub={t('noAccountsFound', { q: norm(q) })} /> : <div className="user-list">{users.map((u) => userRow(u))}</div>
              ) : tab === 'reels' ? (
                reels === null ? <Loading /> : reels.length === 0 ? <Empty sub={t('noResults')} /> : (
                  <div className="grid explore-grid">
                    {reels.map((p, i) => (p.world
                      ? <WorldThumb key={p.id} post={p} onClick={() => nav.push('reelsViewer', { posts: reels, startIndex: i })} />
                      : <Thumb key={p.id} post={p} onClick={() => nav.push('reelsViewer', { posts: reels, startIndex: i })} />))}
                  </div>
                )
              ) : (
                tags.length === 0 ? <Empty sub={t('noResults')} /> : (
                  <div className="user-list">
                    {tags.map(([h, n]) => (
                      <div className="user-row" key={h} onClick={() => nav.push('tag', { tag: h.slice(1) })}>
                        <span className="tag-icon">#</span>
                        <div className="user-row-text"><b>{h}</b>{n != null && <span>{n} {t('posts')}</span>}</div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </>
          )}
        </div>
      ) : (
        <div className="scroll" ref={scrollRef} onScroll={(e) => { const el = e.currentTarget; if (el.scrollHeight - el.scrollTop - el.clientHeight < 600) more(); }}>
          <div className="ptr" style={{ height: pull }} />
          <div className="explore-chips">
            <button className="chip-icon" onClick={() => setPrefs(true)} aria-label={t('chooseTopics')}><IPrefs size={22} /></button>
            {TOPICS.map((id) => <button key={id} className={topic === id ? 'on' : ''} onClick={() => setTopic(id)}>{topicLabel(id)}</button>)}
          </div>
          {explore === null && !world.length ? <Loading /> : (explore || []).length + world.length === 0 ? <Empty sub={t('noPosts')} /> : (
            <div className="grid explore-grid">
              {(explore || []).map((p) => (
                <Thumb key={p.id} post={p}
                  onClick={() => p.kind === 'reel' ? nav.push('reelsViewer', { posts: explore.filter((x) => x.kind === 'reel'), startIndex: explore.filter((x) => x.kind === 'reel').indexOf(p) }) : nav.push('postList', { posts: explore.filter((x) => x.kind !== 'reel'), startId: p.id, title: t('forYou') })} />
              ))}
              {world.map((p) => <WorldThumb key={p.id} post={p} onClick={() => openWorld(p)} />)}
            </div>
          )}
        </div>
      )}
      <TopicSheet open={prefs} onClose={() => setPrefs(false)} value={topic} onChange={setTopic} />
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
