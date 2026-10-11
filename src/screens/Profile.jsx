import { useEffect, useRef, useState } from 'react';
import { openUrl } from '../native.js';
import { api, uploadMedia, WEB_URL, getAccounts } from '../api.js';
import { t, fmtNum, errText } from '../i18n.js';
import { useApp, Avatar, UserName, FollowButton, Loading, ErrorBox, Empty, TopBar, Tabs, Thumb, Sheet, Spinner, useAsync, ActionSheet, Confirm, ThemeToggle } from '../components.jsx';
import { IGrid, IReels, IBookmark, IPlusSquare, IMenu, IPlus, ILock, IDown, IUserPlus, ICamera, ILink, ICheck, IFlag, IBlock, IBellOff, IRestrict, IStar, IStarCircle } from '../icons.jsx';
import { shareLink, SuggestedUsers } from './Post.jsx';
import { usePullToRefresh } from './Feed.jsx';

export default function Profile({ username, isTab, active, refreshKey }) {
  const { me, nav, toast } = useApp();
  const uname = isTab ? me?.username : username;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('grid');
  const [posts, setPosts] = useState(null);
  const [highlights, setHighlights] = useState([]);
  const [showSugg, setShowSugg] = useState(false);
  const [sugg, setSugg] = useState([]);
  const [hlOpen, setHlOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [switcher, setSwitcher] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const scrollRef = useRef();

  const load = async () => {
    setError(null);
    try {
      const d = await api(`users/${encodeURIComponent(uname)}`);
      setData(d);
      if (d.canView) api(`users/${encodeURIComponent(uname)}/highlights`).then((r) => setHighlights(r.highlights)).catch(() => {});
    } catch (e) { setError(e); }
  };
  const loadPosts = async (which = tab) => {
    setPosts(null);
    try {
      if (which === 'saved') { const r = await api('me/saved'); setPosts(r.posts); }
      else { const r = await api(`users/${encodeURIComponent(uname)}/posts${which === 'reels' ? '?kind=reel' : ''}`); setPosts(r.posts); }
    } catch { setPosts([]); }
  };
  useEffect(() => { if (uname) { load(); loadPosts(); } }, [uname, refreshKey]); // eslint-disable-line
  useEffect(() => { if (active && isTab && data) { load(); loadPosts(); } }, [active]); // eslint-disable-line
  useEffect(() => {
    const h = () => { if (isTab) { load(); loadPosts(); } };
    window.addEventListener('nx-posted', h); return () => window.removeEventListener('nx-posted', h);
  }); // eslint-disable-line
  const { pull } = usePullToRefresh(scrollRef, async () => { await load(); await loadPosts(); });

  const switchTab = (k) => { setTab(k); loadPosts(k); };
  const openPost = (p) => {
    if (tab === 'reels') nav.push('reelsViewer', { posts, startIndex: posts.indexOf(p) });
    else nav.push('postList', { posts, startId: p.id, title: tab === 'saved' ? t('saved') : t('posts') });
  };
  const openStory = async () => {
    try {
      const r = await api('stories');
      const idx = r.tray.findIndex((g) => g.user.id === data.user.id);
      if (idx >= 0) nav.push('stories', { tray: [r.tray[idx]], index: 0 });
    } catch { /* ignore */ }
  };
  const openHighlight = (h) => nav.push('stories', { tray: [{ user: data.user, stories: h.items.map((it, i) => ({ ...it, id: null, key: i })) }], index: 0, highlight: h.title });
  const toggleSugg = async () => {
    if (!showSugg && !sugg.length) { try { const r = await api('suggestions'); setSugg(r.users); } catch { /* */ } }
    setShowSugg(!showSugg);
  };
  const shareProfile = async () => { const ok = await shareLink(`${WEB_URL}/?u=${data.user.username}`, data.user.fullName); if (!ok) toast(t('linkCopied')); };

  if (error) return <div className="screen">{!isTab && <TopBar title={uname} />}<ErrorBox error={error} onRetry={load} /></div>;
  if (!data) return <div className="screen">{!isTab && <TopBar title={uname} />}<Loading /></div>;
  const { user, stats, isMe, canView, followStatus } = data;
  const rel = data.relation || {};
  const toggleRel = async (kind, msgOn, msgOff) => {
    const on = !rel[kind];
    try {
      await api(`users/${user.id}/${kind}`, { method: on ? 'POST' : 'DELETE' });
      toast(on ? msgOn : msgOff);
      load(); if (kind === 'block') loadPosts();
    } catch (e) { toast(errText(e.code)); }
  };

  const header = isTab ? (
    <header className="profile-header">
      <button className="profile-uname" onClick={() => setSwitcher(true)}>
        {user.isPrivate && <ILock size={16} />}<span>{user.username}</span><IDown size={18} />
      </button>
      <div className="feed-header-actions">
        <ThemeToggle />
        <button className="icon-btn" onClick={() => nav.push('create')} aria-label="create"><IPlusSquare size={27} /></button>
        <button className="icon-btn" onClick={() => nav.push('settings')} aria-label="settings"><IMenu size={27} /></button>
      </div>
    </header>
  ) : <TopBar title={<span className="tb-uname">{user.isPrivate && <ILock size={14} />}<UserName user={user} /></span>} right={!isMe && <button className="icon-btn" onClick={() => setMenu(true)}>⋯</button>} />;

  return (
    <div className="screen">
      {header}
      <div className="scroll" ref={scrollRef}>
        <div className="ptr" style={{ height: pull }}>{pull > 20 && <Spinner size={22} />}</div>
        <div className="profile-top">
          <div className="profile-avatar" onClick={data.hasStory ? openStory : isMe ? () => nav.push('editProfile') : undefined}>
            <Avatar src={user.avatarUrl} name={user.username} size={86} ring={data.hasStory ? 'story' : null} />
            {isMe && !data.hasStory && <span className="story-plus big" onClick={(e) => { e.stopPropagation(); nav.push('create', { mode: 'story' }); }}><IPlus size={16} sw={3} /></span>}
          </div>
          <div className="profile-stats">
            <div><b>{fmtNum(stats.posts)}</b><span>{t('posts')}</span></div>
            <button onClick={() => canView && nav.push('userList', { kind: 'followers', username: user.username, title: t('followers') })}><b>{fmtNum(stats.followers)}</b><span>{t('followers')}</span></button>
            <button onClick={() => canView && nav.push('userList', { kind: 'following', username: user.username, title: t('following') })}><b>{fmtNum(stats.following)}</b><span>{t('following')}</span></button>
          </div>
        </div>
        <div className="profile-bio">
          <b className="profile-name">{user.fullName}</b>
          {user.bio && <p dir="auto">{user.bio}</p>}
          {user.website && <a className="profile-link" href={user.website.startsWith('http') ? user.website : `https://${user.website}`} onClick={(e) => { e.preventDefault(); openUrl(e.currentTarget.href); }}><ILink size={14} /> {user.website.replace(/^https?:\/\//, '')}</a>}
          {!isMe && data.mutuals?.length > 0 && (
            <div className="mutuals">
              <span className="mutual-avatars">{data.mutuals.map((m) => <Avatar key={m.username} src={m.avatarUrl} name={m.username} size={20} />)}</span>
              <span>{t('mutualsFollowedBy', { u: data.mutuals.map((m) => m.username).join('، ') })}</span>
            </div>
          )}
        </div>
        <div className="profile-buttons">
          {isMe ? (
            <>
              <button className="btn btn-secondary flex1" onClick={() => nav.push('editProfile')}>{t('editProfile')}</button>
              <button className="btn btn-secondary flex1" onClick={shareProfile}>{t('shareProfile')}</button>
              <button className={`btn btn-secondary btn-square ${showSugg ? 'on' : ''}`} onClick={toggleSugg}><IUserPlus size={18} /></button>
            </>
          ) : rel.block ? (
            <button className="btn btn-secondary flex1" onClick={() => toggleRel('block', t('blockedToast'), t('unblockedToast'))}>{t('unblock')}</button>
          ) : (
            <>
              <FollowButton user={user} status={followStatus} className="flex1" onChange={() => load()} />
              {data.canMessage && <button className="btn btn-secondary flex1" onClick={() => nav.push('chat', { user })}>{t('message')}</button>}
              <button className={`btn btn-secondary btn-square ${showSugg ? 'on' : ''}`} onClick={toggleSugg}><IUserPlus size={18} /></button>
            </>
          )}
        </div>
        {showSugg && <SuggestedUsers users={sugg} onDismiss={(id) => setSugg((s) => s.filter((u) => u.id !== id))} />}
        {canView && (highlights.length > 0 || isMe) && (
          <div className="highlights">
            {isMe && (
              <div className="hl-item" onClick={() => setHlOpen(true)}>
                <span className="hl-new"><IPlus size={30} sw={1.5} /></span><span>{t('new')}</span>
              </div>
            )}
            {highlights.map((h) => (
              <div className="hl-item" key={h.id} onClick={() => openHighlight(h)}>
                <span className="hl-cover">{h.items[0]?.type === 'video' ? <video disableRemotePlayback src={h.items[0].url + '#t=0.3'} muted /> : <img src={h.items[0]?.url} alt="" />}</span>
                <span>{h.title}</span>
              </div>
            ))}
          </div>
        )}
        {canView ? (
          <>
            <Tabs icons value={tab} onChange={switchTab} tabs={[
              { id: 'grid', icon: <IGrid size={24} /> },
              { id: 'reels', icon: <IReels size={24} /> },
              ...(isMe ? [{ id: 'saved', icon: <IBookmark size={24} /> }] : []),
            ]} />
            {posts === null ? <Loading /> : posts.length === 0 ? (
              tab === 'saved' ? <Empty icon={<IBookmark size={36} />} title={t('saved')} sub={t('noSaved')} />
                : <Empty icon={<ICamera size={36} />} title={t('noPosts')} sub={isMe ? t('noPostsSub') : ''}
                  action={isMe && <button className="text-link strong" onClick={() => nav.push('create', { mode: tab === 'reels' ? 'reel' : 'post' })}>{t('sharePhotos')}</button>} />
            ) : (
              <div className={`grid ${tab === 'reels' ? 'reels-grid' : ''}`}>
                {posts.map((p) => <Thumb key={p.id} post={p} onClick={() => openPost(p)} />)}
              </div>
            )}
          </>
        ) : (
          <div className="private-box">
            <span className="private-icon"><ILock size={34} /></span>
            <h3>{t('privateAccount')}</h3><p>{t('privateSub')}</p>
          </div>
        )}
      </div>
      <Confirm open={confirmBlock} title={t('blockQ', { u: user.username })} text={t('blockDesc')} okLabel={t('block')} danger
        onOk={() => toggleRel('block', t('blockedToast'), '')} onClose={() => setConfirmBlock(false)} />
      {isTab && <AccountSwitcher open={switcher} onClose={() => setSwitcher(false)} />}
      {isMe && <NewHighlight open={hlOpen} onClose={() => setHlOpen(false)} onCreated={() => api(`users/${uname}/highlights`).then((r) => setHighlights(r.highlights))} />}
      <ActionSheet open={menu} onClose={() => setMenu(false)} actions={[
        { label: t('shareProfile'), icon: <ILink size={22} />, onClick: shareProfile },
        !rel.block && followStatus === 'accepted' && { label: rel.favorite ? t('removeFavorite') : t('addFavorite'), icon: <IStar size={22} filled={rel.favorite} />, onClick: () => toggleRel('favorite', t('addedFavorite'), t('removedFavorite')) },
        !rel.block && { label: rel.close ? t('removeCloseFriend') : t('addCloseFriend'), icon: <IStarCircle size={22} />, onClick: () => toggleRel('close', t('addedCloseFriend'), t('removedCloseFriend')) },
        !rel.block && { label: rel.mute ? t('unmute') : t('mute'), icon: <IBellOff size={22} />, onClick: () => toggleRel('mute', t('mutedToast'), t('unmutedToast')) },
        !rel.block && { label: rel.restrict ? t('unrestrict') : t('restrict'), icon: <IRestrict size={22} />, onClick: () => toggleRel('restrict', t('restrictedToast'), t('unrestrictedToast')) },
        { label: rel.block ? t('unblock') : t('block'), icon: <IBlock size={22} />, danger: !rel.block, onClick: () => (rel.block ? toggleRel('block', '', t('unblockedToast')) : setConfirmBlock(true)) },
        { label: t('report'), icon: <IFlag size={22} />, danger: true, onClick: async () => { await api('reports', { method: 'POST', body: { userId: user.id } }).catch(() => {}); toast(t('reported')); } },
      ]} />
    </div>
  );
}

function NewHighlight({ open, onClose, onCreated }) {
  const { toast } = useApp();
  const [stories, setStories] = useState(null);
  const [sel, setSel] = useState([]);
  const [title, setTitle] = useState('');
  useEffect(() => { if (open) { setSel([]); setTitle(''); api('me/stories').then((r) => setStories(r.stories)).catch(() => setStories([])); } }, [open]);
  const create = async () => {
    try { await api('highlights', { method: 'POST', body: { title, storyIds: sel } }); onCreated(); onClose(); }
    catch (e) { toast(errText(e.code)); }
  };
  return (
    <Sheet open={open} onClose={onClose} title={t('newHighlight')} full>
      <div className="form-pad">
        <div className="field"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('highlightTitle')} dir="auto" maxLength={30} /></div>
        <div className="muted small">{t('chooseStories')}</div>
      </div>
      {stories === null ? <Loading /> : stories.length === 0 ? <Empty sub={t('noArchive')} /> : (
        <div className="grid story-pick">
          {stories.map((s) => (
            <div key={s.id} className={`grid-item tall ${sel.includes(s.id) ? 'picked' : ''}`} onClick={() => setSel((x) => x.includes(s.id) ? x.filter((i) => i !== s.id) : [...x, s.id])}>
              {s.type === 'video' ? <video disableRemotePlayback src={s.url + '#t=0.3'} muted /> : <img src={s.url} alt="" />}
              <span className="pick-mark">{sel.includes(s.id) && <ICheck size={14} sw={3} />}</span>
            </div>
          ))}
        </div>
      )}
      <div className="sheet-footer"><button className="btn btn-primary btn-lg btn-block" disabled={!sel.length || !title.trim()} onClick={create}>{t('done')}</button></div>
    </Sheet>
  );
}

export function EditProfile() {
  const { me, updateMe, nav, toast } = useApp();
  const [f, setF] = useState({ fullName: me.fullName || '', username: me.username, bio: me.bio || '', website: me.website || '' });
  const [avatar, setAvatar] = useState(me.avatarUrl);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoMenu, setPhotoMenu] = useState(false);
  const fileRef = useRef();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const pick = async (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    setUploading(true);
    try { const m = await uploadMedia(file); setAvatar(m.url); } catch (err) { toast(errText(err.code || 'server_error')); }
    setUploading(false);
  };
  const save = async () => {
    setBusy(true);
    try { const r = await api('me', { method: 'PATCH', body: { ...f, avatarUrl: avatar || '' } }); updateMe(r.user); nav.pop(); window.dispatchEvent(new Event('nx-posted')); }
    catch (e) { toast(errText(e.code)); }
    setBusy(false);
  };
  return (
    <div className="screen">
      <TopBar title={t('editProfile')} right={busy ? <Spinner size={20} /> : <button className="text-link strong" onClick={save}>{t('done')}</button>} />
      <div className="scroll">
        <div className="edit-avatar" onClick={() => setPhotoMenu(true)}>
          <div className="edit-avatar-img">{uploading ? <Spinner /> : <Avatar src={avatar} name={me.username} size={90} />}</div>
          <button className="text-link strong">{t('changePhoto')}</button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={pick} />
        <div className="form-list">
          <label><span>{t('fullName')}</span><input value={f.fullName} onChange={set('fullName')} dir="auto" maxLength={60} /></label>
          <label><span>{t('username')}</span><input value={f.username} onChange={(e) => setF({ ...f, username: e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, '') })} dir="ltr" maxLength={30} /></label>
          <label><span>{t('website')}</span><input value={f.website} onChange={set('website')} dir="ltr" inputMode="url" /></label>
          <label><span>{t('bio')}</span><textarea value={f.bio} onChange={set('bio')} rows={3} dir="auto" maxLength={300} /></label>
        </div>
      </div>
      <ActionSheet open={photoMenu} onClose={() => setPhotoMenu(false)} actions={[
        { label: t('selectFromGallery'), onClick: () => fileRef.current?.click() },
        avatar && { label: t('removePhoto'), danger: true, onClick: () => setAvatar(null) },
      ]} />
    </div>
  );
}

export function UserList({ kind, username, id, title }) {
  const { nav, me } = useApp();
  const path = kind === 'likes' ? `posts/${id}/likes` : `users/${encodeURIComponent(username)}/${kind}`;
  const { loading, data, error, reload } = useAsync(() => api(path), [path]);
  const [q, setQ] = useState('');
  const users = (data?.users || []).filter((u) => !q || u.username.includes(q.toLowerCase()) || (u.fullName || '').toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="screen">
      <TopBar title={title} />
      <div className="scroll">
        <div className="search-box pad"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchPh')} dir="auto" /></div>
        {loading ? <Loading /> : error ? <ErrorBox error={error} onRetry={reload} /> : users.length === 0 ? <Empty sub={t('noResults')} /> : (
          <div className="user-list">
            {users.map((u) => (
              <div className="user-row" key={u.id} onClick={() => nav.profile(u.username)}>
                <Avatar src={u.avatarUrl} name={u.username} size={50} />
                <div className="user-row-text"><UserName user={u} /><span>{u.fullName}</span></div>
                {u.id !== me.id && <FollowButton user={u} status={u.followStatus} small />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Instagram-style account switcher (opened from the username in the profile header). */
export function AccountSwitcher({ open, onClose }) {
  const { me, switchAccount, addAccount, nav } = useApp();
  const [accounts, setAccounts] = useState([]);
  const [badges, setBadges] = useState({});
  useEffect(() => {
    if (!open) return;
    const list = getAccounts();
    setAccounts(list);
    list.forEach((a) => {
      if (!a.token || a.id === me.id) return;
      api('me/badges', { token: a.token }).then((b) => setBadges((x) => ({ ...x, [a.id]: b }))).catch(() => {});
    });
  }, [open]); // eslint-disable-line
  const status = (b) => {
    if (!b) return null;
    if (b.messages) return t('nChats', { n: b.messages });
    const n = b.notifications + b.requests;
    return n ? t('nNotifications', { n }) : null;
  };
  return (
    <Sheet open={open} onClose={onClose}>
      <div className="switcher">
        <div className="switch-card">
          {accounts.map((a) => (
            <button key={a.id} className="switch-row" onClick={() => {
              onClose();
              if (a.id === me.id) return;
              if (a.token) switchAccount(a); else addAccount();
            }}>
              <Avatar src={a.id === me.id ? me.avatarUrl : a.avatarUrl} name={a.username} size={56} />
              <span className="flex1 switch-meta">
                <bdi>{a.id === me.id ? me.username : a.username}</bdi>
                {a.id !== me.id && !a.token && <small className="muted">{t('loginAgain')}</small>}
                {a.id !== me.id && status(badges[a.id]) && <small className="muted"><i className="red-dot" />{status(badges[a.id])}</small>}
              </span>
              {a.id === me.id && <span className="blue-check"><ICheck size={16} sw={3} /></span>}
            </button>
          ))}
          <button className="switch-row" onClick={() => { onClose(); addAccount(); }}>
            <span className="switch-plus"><IPlus size={26} /></span><span className="flex1">{t('addNexoraAccount')}</span>
          </button>
        </div>
        <button className="btn btn-outline btn-lg btn-block pill" onClick={() => { onClose(); nav.push('settingsPage', { page: 'accountsCenter' }); }}>{t('goAccountsCenter')}</button>
      </div>
    </Sheet>
  );
}
