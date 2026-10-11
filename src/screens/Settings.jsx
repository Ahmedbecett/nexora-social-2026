import { useEffect, useMemo, useState } from 'react';
import { openUrl } from '../native.js';
import { api, WEB_URL, getAccounts } from '../api.js';
import { t, errText, LANGUAGES, timeAgo } from '../i18n.js';
import { useApp, TopBar, Confirm, Spinner, Avatar, UserName, Loading, Empty, Tabs, Thumb, Glyph, FromBrand, Sheet } from '../components.jsx';
import {
  IUserPlus, IBell, ILock, IAccount, IChevron, IGlobe, IBookmark, IArchive, ISearch, ICheck, IActivity, IClock, IStar, IStarCircle,
  IPaperPlane, IAt, IComment, IRepeat, IRestrict, ILimit, IAa, IBellOff, ILifebuoy, IShieldStar, IPerson, IInfo, IBlock, IKey, IPhone,
  IMail, IDoc, IHeart, ICheckCircle, ITrash, IUsers, IClose, IMoon,
} from '../icons.jsx';
import { getThemePref, setThemePref } from '../theme.js';
import { shareLink, SuggestedUsers } from './Post.jsx';
import { LanguageList } from './Auth.jsx';
import { usageDays, getDailyLimit, setDailyLimit } from '../usage.js';

export const APP_VERSION = '2.4.3';
export const OFFICIAL_USERNAME = 'official.nexora';

/* ------------------------------------------------------------------ */
/* shared settings state                                              */
/* ------------------------------------------------------------------ */
let cache = null;
function useSettings() {
  const { toast } = useApp();
  const [data, setData] = useState(cache);
  useEffect(() => { api('me/settings').then((r) => { cache = r; setData(r); }).catch(() => {}); }, []);
  const patch = async (p) => {
    const prev = data;
    setData((d) => ({ ...d, settings: { ...d.settings, ...p } }));
    try { const r = await api('me/settings', { method: 'PATCH', body: p }); cache = { ...cache, settings: r.settings }; setData((d) => ({ ...d, settings: r.settings })); }
    catch (e) { setData(prev); toast(errText(e.code)); }
  };
  return { s: data?.settings, counts: data?.counts, patch, reload: () => api('me/settings').then((r) => { cache = r; setData(r); }) };
}

function Row({ icon, label, sub, value, onClick, danger, blue, chevron = true }) {
  return (
    <button className={`settings-item ${danger ? 'danger' : ''} ${blue ? 'blue' : ''}`} onClick={onClick}>
      {icon}
      <span className="flex1 si-text"><span>{label}</span>{sub && <small className="muted">{sub}</small>}</span>
      {value !== undefined && value !== null && value !== '' && <span className="muted si-value">{value}</span>}
      {chevron && <IChevron size={18} className="muted" />}
    </button>
  );
}
function Section({ title, right, children }) {
  return (
    <section className="settings-section">
      {title && <div className="settings-section-title"><span>{title}</span>{right}</div>}
      {children}
    </section>
  );
}
function Toggle({ on, onChange, label, desc, busy }) {
  return (
    <label className="toggle-row">
      <div className="flex1"><div>{label}</div>{desc && <p className="muted small">{desc}</p>}</div>
      {busy ? <Spinner size={18} /> : <span className={`switch ${on ? 'on' : ''}`}><input type="checkbox" checked={!!on} onChange={(e) => onChange(e.target.checked)} /></span>}
    </label>
  );
}
function Radio({ value, options, onChange, title, desc }) {
  return (
    <div className="radio-group">
      {title && <h4>{title}</h4>}
      {desc && <p className="muted small pad-x">{desc}</p>}
      {options.map(([v, label]) => (
        <label key={v} className="radio-row" onClick={() => onChange(v)}>
          <span className="flex1">{label}</span>
          <span className={`radio ${value === v ? 'on' : ''}`} />
        </label>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Settings and activity (main list)                                  */
/* ------------------------------------------------------------------ */
export default function Settings() {
  const { nav, logout, me, lang, addAccount } = useApp();
  const { s, counts } = useSettings();
  const [q, setQ] = useState('');
  const [confirmOut, setConfirmOut] = useState(false);
  const [remember, setRemember] = useState(true);
  const go = (page) => () => nav.push('settingsPage', { page });
  const audience = (v) => ({ everyone: t('everyone'), following: t('peopleYouFollow'), followers: t('yourFollowers'), none: t('noOne') }[v] || '');
  const curLang = LANGUAGES.find((l) => l[0] === lang);

  const sections = [
    { title: t('yourAccount'), right: <span className="brand-mini"><Glyph size={18} />Nexora</span>, items: [
      { id: 'accountsCenter', icon: <IAccount size={26} />, label: t('accountsCenter'), sub: t('accountsCenterSub') },
    ] },
    { title: t('howYouUse'), items: [
      { id: 'saved', icon: <IBookmark size={26} />, label: t('saved') },
      { id: 'archive', icon: <IArchive size={26} />, label: t('archive') },
      { id: 'activity', icon: <IActivity size={26} />, label: t('yourActivity') },
      { id: 'notifications', icon: <IBell size={26} />, label: t('notifSettings'), value: s?.pauseAll ? t('paused') : '' },
      { id: 'time', icon: <IClock size={26} />, label: t('timeManagement') },
    ] },
    { title: t('whoCanSee'), items: [
      { id: 'privacy', icon: <ILock size={26} />, label: t('accountPrivacy'), value: me.isPrivate ? t('private') : t('public') },
      { id: 'close', icon: <IStarCircle size={26} />, label: t('closeFriends'), value: counts?.close ?? '' },
      { id: 'blocked', icon: <IBlock size={26} />, label: t('blocked'), value: counts?.blocked ?? '' },
    ] },
    { title: t('howOthersInteract'), items: [
      { id: 'messagesPriv', icon: <IPaperPlane size={26} />, label: t('messagesStoryReplies') },
      { id: 'mentions', icon: <IAt size={26} />, label: t('tagsMentions') },
      { id: 'comments', icon: <IComment size={26} />, label: t('commentsSetting') },
      { id: 'sharing', icon: <IRepeat size={26} />, label: t('sharing') },
      { id: 'restricted', icon: <IRestrict size={26} />, label: t('restricted'), value: counts?.restricted ?? '' },
      { id: 'limit', icon: <ILimit size={26} />, label: t('limitInteractions'), value: s ? (s.limit.enabled ? t('on') : t('off')) : '' },
      { id: 'hiddenWords', icon: <IAa size={26} />, label: t('hiddenWords') },
      { id: 'invite', icon: <IUserPlus size={26} />, label: t('inviteFriends') },
    ] },
    { title: t('whatYouSee'), items: [
      { id: 'favorites', icon: <IStar size={26} />, label: t('favorites'), value: counts?.favorites ?? '' },
      { id: 'muted', icon: <IBellOff size={26} />, label: t('mutedAccounts'), value: counts?.muted ?? '' },
    ] },
    { title: t('yourAppMedia'), items: [
      { id: 'language', icon: <IGlobe size={26} />, label: t('languageSetting'), value: curLang?.[1] },
      { id: 'theme', icon: <IMoon size={26} />, label: t('theme'), value: t({ dark: 'themeDark', light: 'themeLight', system: 'themeSystem' }[getThemePref()]) },
    ] },
    { title: t('moreInfoSupport'), items: [
      { id: 'help', icon: <ILifebuoy size={26} />, label: t('help') },
      { id: 'privacyCenter', icon: <IShieldStar size={26} />, label: t('privacyCenter') },
      { id: 'status', icon: <IPerson size={26} />, label: t('accountStatus') },
      { id: 'about', icon: <IInfo size={26} />, label: t('about') },
    ] },
  ];
  const ql = q.trim().toLowerCase();
  const visible = sections.map((sec) => ({ ...sec, items: sec.items.filter((i) => !ql || `${i.label} ${i.sub || ''}`.toLowerCase().includes(ql)) })).filter((sec) => sec.items.length);
  void audience;

  return (
    <div className="screen">
      <TopBar title={t('settings')} className="start-title" />
      <div className="scroll settings-scroll">
        <div className="search-box pad"><ISearch size={20} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchPh')} dir="auto" /></div>
        {visible.map((sec) => (
          <Section key={sec.title} title={sec.title} right={sec.right}>
            {sec.items.map((i) => <Row key={i.id} {...i} onClick={i.id === 'saved' ? () => nav.push('settingsPage', { page: 'saved' }) : go(i.id)} />)}
          </Section>
        ))}
        {!ql && (
          <Section title={t('loginSection')}>
            <button className="settings-link blue" onClick={addAccount}>{t('addAccount')}</button>
            <button className="settings-link red" onClick={() => setConfirmOut(true)}>{t('logout')}</button>
            {getAccounts().filter((a) => a.token).length > 1 && <button className="settings-link red" onClick={() => logout({ all: true })}>{t('logoutAll')}</button>}
          </Section>
        )}
        <div className="settings-foot"><FromBrand small /><span className="muted small">{t('aboutText', { v: APP_VERSION })}</span></div>
      </div>
      {confirmOut && (
        <div className="dialog-wrap" onClick={() => setConfirmOut(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>{t('logoutOf', { u: me.username })}</h3>
            <label className="remember-row"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /><span>{t('rememberLogin')}</span></label>
            <p className="small muted">{t('rememberDesc')}</p>
            <button className="dialog-btn danger" onClick={() => { setConfirmOut(false); logout({ remember }); }}>{t('logout')}</button>
            <button className="dialog-btn" onClick={() => setConfirmOut(false)}>{t('cancel')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-pages                                                          */
/* ------------------------------------------------------------------ */
const TITLES = () => ({
  accountsCenter: t('accountsCenter'), accounts: t('accountsOnDevice'), personal: t('personalDetails'), password: t('passwordSecurity'), deleteAccount: t('deleteAccount'),
  notifications: t('notifSettings'), time: t('timeManagement'), activity: t('yourActivity'), privacy: t('accountPrivacy'),
  close: t('closeFriends'), blocked: t('blocked'), messagesPriv: t('messagesStoryReplies'), mentions: t('tagsMentions'),
  comments: t('commentsSetting'), sharing: t('sharing'), restricted: t('restricted'), limit: t('limitInteractions'),
  hiddenWords: t('hiddenWords'), invite: t('inviteFriends'), favorites: t('favorites'), muted: t('mutedAccounts'),
  language: t('languageSetting'), theme: t('theme'), help: t('help'), privacyCenter: t('privacyCenter'), status: t('accountStatus'), about: t('about'),
  archive: t('archive'), saved: t('saved'), terms: t('termsOfUse'), policy: t('privacyPolicy'),
});

export function SettingsPage({ page }) {
  const C = PAGES[page];
  return (
    <div className="screen">
      <TopBar title={TITLES()[page]} />
      <div className="scroll">{C ? <C /> : null}</div>
    </div>
  );
}

function AccountsCenter() {
  const { me, nav } = useApp();
  const go = (page) => () => nav.push('settingsPage', { page });
  return (
    <>
      <div className="ac-head">
        <span className="brand-mini big"><Glyph size={26} />Nexora</span>
        <p className="muted small">{t('accountsCenterDesc')}</p>
      </div>
      <div className="ac-card">
        <div className="ac-profile"><Avatar src={me.avatarUrl} name={me.username} size={44} /><span className="flex1"><b>{me.fullName}</b><small className="muted"><bdi>{me.username}</bdi></small></span></div>
        <button className="ac-link" onClick={() => nav.push('editProfile')}>{t('editProfile')}</button>
      </div>
      <Section title={t('accountSettings')}>
        <Row icon={<IKey size={24} />} label={t('passwordSecurity')} onClick={go('password')} />
        <Row icon={<IDoc size={24} />} label={t('personalDetails')} onClick={go('personal')} />
        <Row icon={<IUsers size={24} />} label={t('accountsOnDevice')} value={getAccounts().length} onClick={go('accounts')} />
      </Section>
    </>
  );
}

function AccountsOnDevice() {
  const { me, switchAccount, addAccount } = useApp();
  const [list, setList] = useState(getAccounts());
  return (
    <>
      <div className="settings-list">
        {list.map((a) => (
          <div key={a.id} className="settings-item static">
            <Avatar src={a.avatarUrl} name={a.username} size={44} />
            <span className="flex1 si-text"><b><bdi>{a.username}</bdi></b><small className="muted">{a.id === me.id ? t('currentAccount') : a.token ? t('loggedIn') : t('loginAgain')}</small></span>
            {a.id !== me.id && a.token && <button className="btn btn-secondary btn-sm" onClick={() => switchAccount(a)}>{t('switch')}</button>}
            {a.id !== me.id && !a.token && <button className="icon-btn" onClick={() => { import('../api.js').then((m) => { m.forgetAccount(a.id); setList(m.getAccounts()); }); }}><IClose size={20} /></button>}
          </div>
        ))}
      </div>
      <button className="settings-link blue" onClick={addAccount}>{t('addAccount')}</button>
    </>
  );
}

function PersonalDetails() {
  const { me, nav } = useApp();
  return (
    <>
      <p className="muted small pad-x">{t('personalDesc')}</p>
      <div className="settings-list">
        <Row icon={<IPerson size={24} />} label={t('fullName')} sub={me.fullName} onClick={() => nav.push('editProfile')} />
        <Row icon={<IAt size={24} />} label={t('username')} sub={me.username} onClick={() => nav.push('editProfile')} />
        {me.email && <Row icon={<IMail size={24} />} label={t('email')} sub={me.email} chevron={false} />}
        {me.phone && <Row icon={<IPhone size={24} />} label={t('phoneNumber')} sub={me.phone} chevron={false} />}
        <Row icon={<IClock size={24} />} label={t('joined')} sub={new Date(me.createdAt).toLocaleDateString(document.documentElement.lang, { year: 'numeric', month: 'long', day: 'numeric' })} chevron={false} />
      </div>
      <Section title={t('accountOwnership')}>
        <Row icon={<ITrash size={24} />} label={t('deleteAccount')} danger onClick={() => nav.push('settingsPage', { page: 'deleteAccount' })} />
      </Section>
    </>
  );
}

function PasswordSecurity() {
  const { me, toast, updateMe } = useApp();
  const [pw, setPw] = useState({ current: '', next: '' });
  const [busy, setBusy] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const changePw = async () => {
    setBusy(true);
    try {
      const r = await api('me/password', { method: 'POST', body: pw });
      const { setToken, upsertAccount } = await import('../api.js');
      setToken(r.token); upsertAccount(me, r.token); updateMe(me);
      toast(t('passwordChanged')); setPw({ current: '', next: '' });
    } catch (e) { toast(errText(e.code)); }
    setBusy(false);
  };
  const sendReset = async () => {
    try { await api('me/password-reset', { method: 'POST' }); toast(t('resetSentShort')); } catch (e) { toast(errText(e.code)); }
  };
  const logoutAll = async () => {
    try {
      const r = await api('me/logout-all', { method: 'POST' });
      const { setToken, upsertAccount } = await import('../api.js');
      setToken(r.token); upsertAccount(me, r.token);
      toast(t('loggedOutOthers'));
    } catch (e) { toast(errText(e.code)); }
  };
  return (
    <>
      {(me.email || me.hasPassword) ? (
        <div className="form-pad">
          <h3>{t('changePassword')}</h3>
          <div className="field"><input type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} placeholder={t('currentPassword')} autoComplete="current-password" /></div>
          <div className="field"><input type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} placeholder={t('newPassword')} autoComplete="new-password" /></div>
          <button className="btn btn-primary btn-lg btn-block" disabled={busy || !pw.current || pw.next.length < 6} onClick={changePw}>{busy ? <Spinner size={20} light /> : t('changePassword')}</button>
          {me.email && <button className="text-link" onClick={sendReset}>{t('forgot')}</button>}
        </div>
      ) : <p className="muted small pad-x">{t('phoneOnlyPassword')}</p>}
      <Section title={t('loginMethods')}>
        {me.email && <Row icon={<IMail size={24} />} label={t('emailPassword')} sub={me.email} chevron={false} />}
        {me.phone && <Row icon={<IPhone size={24} />} label={t('phoneNumber')} sub={me.phone} chevron={false} />}
        {me.email && <Row icon={<IShieldStar size={24} />} label={t('googleLogin')} sub={t('googleLoginDesc')} chevron={false} />}
      </Section>
      <Section title={t('securityChecks')}>
        <Row icon={<ILock size={24} />} label={t('logoutOtherDevices')} sub={t('logoutOtherDesc')} onClick={() => setConfirmAll(true)} />
      </Section>
      <Confirm open={confirmAll} title={t('logoutOtherDevices')} text={t('logoutOtherDesc')} okLabel={t('logout')} danger onOk={logoutAll} onClose={() => setConfirmAll(false)} />
    </>
  );
}

function DeleteAccount() {
  const { me, toast, logout } = useApp();
  const [confirm, setConfirm] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(false);
  const del = async () => {
    setBusy(true);
    try { await api('me', { method: 'DELETE', body: { confirm, password } }); logout({ remember: false }); }
    catch (e) { toast(errText(e.code)); }
    setBusy(false);
  };
  return (
    <div className="form-pad">
      <h3 className="danger-text">{t('deleteAccount')}</h3>
      <p className="muted small">{t('deleteAccountDesc')}</p>
      <div className="field"><input value={confirm} onChange={(e) => setConfirm(e.target.value.toLowerCase())} placeholder={t('typeUsername', { u: me.username })} autoCapitalize="none" dir="ltr" /></div>
      {(me.hasPassword ?? me.email) && <div className="field"><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('password')} /></div>}
      <button className="btn btn-danger btn-lg btn-block" disabled={busy || confirm !== me.username || (!me.email && me.hasPassword && !password)} onClick={() => setAsk(true)}>{busy ? <Spinner size={20} light /> : t('deleteAccount')}</button>
      <Confirm open={ask} title={t('deleteAccount')} text={t('deleteAccountDesc')} okLabel={t('delete')} danger onOk={del} onClose={() => setAsk(false)} />
    </div>
  );
}

function NotificationsSettings() {
  const { s, patch } = useSettings();
  if (!s) return <Loading />;
  const set = (k) => (v) => patch({ notif: { ...s.notif, [k]: v } });
  return (
    <>
      <div className="settings-list"><Toggle on={s.pauseAll} label={t('pauseAll')} desc={t('pauseAllDesc')} onChange={(v) => patch({ pauseAll: v })} /></div>
      <Section title={t('notifTypes')}>
        <Toggle on={s.notif.likes} label={t('likesTab')} onChange={set('likes')} />
        <Toggle on={s.notif.comments} label={t('commentsTab')} onChange={set('comments')} />
        <Toggle on={s.notif.mentions} label={t('mentionsTab')} onChange={set('mentions')} />
        <Toggle on={s.notif.follows} label={t('newFollowers')} onChange={set('follows')} />
        <Toggle on={s.notif.requests} label={t('followRequests')} desc={t('requestsAlways')} onChange={set('requests')} />
        <Toggle on={s.notif.messages} label={t('messages')} onChange={set('messages')} />
      </Section>
    </>
  );
}

function TimeManagement() {
  const { toast } = useApp();
  const days = usageDays(7);
  const [limit, setLimit] = useState(getDailyLimit());
  const max = Math.max(1, ...days.map((d) => d.minutes));
  const avg = Math.round(days.reduce((a, d) => a + d.minutes, 0) / days.length);
  const fmt = (m) => (m >= 60 ? `${Math.floor(m / 60)}${t('hShort')} ${m % 60}${t('mShort')}` : `${m}${t('mShort')}`);
  return (
    <>
      <div className="usage">
        <div className="usage-avg"><b>{fmt(avg)}</b><span className="muted small">{t('dailyAverage')}</span></div>
        <div className="usage-bars">
          {days.map((d) => (
            <div key={d.key} className={`usage-bar ${d.today ? 'today' : ''}`}>
              <span style={{ height: `${Math.max(3, (d.minutes / max) * 100)}%` }} title={fmt(d.minutes)} />
              <small>{d.label}</small>
            </div>
          ))}
        </div>
        <p className="muted small">{t('usageNote')}</p>
      </div>
      <Radio title={t('dailyLimit')} desc={t('dailyLimitDesc')} value={limit} onChange={(v) => { setLimit(v); setDailyLimit(v); toast(t('saved2')); }}
        options={[[0, t('off')], [15, fmt(15)], [30, fmt(30)], [45, fmt(45)], [60, fmt(60)], [120, fmt(120)], [180, fmt(180)]]} />
    </>
  );
}

function YourActivity() {
  const { nav } = useApp();
  const [tab, setTab] = useState('likes');
  const [likes, setLikes] = useState(null);
  const [comments, setComments] = useState(null);
  useEffect(() => {
    if (tab === 'likes' && !likes) api('me/activity/likes').then((r) => setLikes(r.posts)).catch(() => setLikes([]));
    if (tab === 'comments' && !comments) api('me/activity/comments').then((r) => setComments(r.comments)).catch(() => setComments([]));
  }, [tab]); // eslint-disable-line
  return (
    <>
      <Row icon={<IClock size={24} />} label={t('timeSpent')} onClick={() => nav.push('settingsPage', { page: 'time' })} />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'likes', label: t('likesTab') }, { id: 'comments', label: t('commentsTab') }]} />
      {tab === 'likes' && (likes === null ? <Loading /> : likes.length === 0 ? <Empty icon={<IHeart size={36} />} sub={t('noLikesYet')} /> : (
        <div className="grid">{likes.map((p) => <Thumb key={p.id} post={p} onClick={() => nav.push('postList', { posts: likes, startId: p.id, title: t('likesTab') })} />)}</div>
      ))}
      {tab === 'comments' && (comments === null ? <Loading /> : comments.length === 0 ? <Empty icon={<IComment size={36} />} sub={t('noCommentsYet')} /> : (
        <div className="settings-list">
          {comments.map((c) => (
            <button key={c.id} className="settings-item" onClick={() => nav.push('post', { id: c.postId })}>
              <span className="flex1 si-text"><span dir="auto">{c.text}</span><small className="muted"><bdi>{c.postUser}</bdi> · {timeAgo(c.createdAt)}</small></span>
              {c.thumb && (c.thumbType === 'video' ? <video disableRemotePlayback className="notif-thumb" src={c.thumb + '#t=0.3'} muted /> : <img className="notif-thumb" src={c.thumb} alt="" />)}
            </button>
          ))}
        </div>
      ))}
    </>
  );
}

function Privacy() {
  const { me, updateMe, toast } = useApp();
  const [busy, setBusy] = useState(false);
  const setPrivate = async (v) => {
    setBusy(true);
    try { const r = await api('me', { method: 'PATCH', body: { isPrivate: v } }); updateMe(r.user); } catch (e) { toast(errText(e.code)); }
    setBusy(false);
  };
  return (
    <div className="settings-list">
      <Toggle on={me.isPrivate} busy={busy} label={t('privateToggle')} desc={me.isPrivate ? t('privateDesc') : t('publicDesc')} onChange={setPrivate} />
    </div>
  );
}

/** Generic list of users for a relationship kind with a remove/undo button per row. */
function UserListPage({ kind, empty, actionLabel, desc, addFrom }) {
  const { nav, toast } = useApp();
  const [users, setUsers] = useState(null);
  const [removed, setRemoved] = useState({});
  const [adding, setAdding] = useState(false);
  const load = () => api(`me/lists/${kind}`).then((r) => setUsers(r.users)).catch(() => setUsers([]));
  useEffect(() => { load(); }, []); // eslint-disable-line
  const toggle = async (u) => {
    const isRemoved = removed[u.id];
    try {
      await api(`users/${u.id}/${kind}`, { method: isRemoved ? 'POST' : 'DELETE' });
      setRemoved((r) => ({ ...r, [u.id]: !isRemoved }));
      cache = null;
    } catch (e) { toast(errText(e.code)); }
  };
  return (
    <>
      {desc && <p className="muted small pad-x">{desc}</p>}
      {addFrom && <button className="settings-link blue" onClick={() => setAdding(true)}>{t('addPeople')}</button>}
      {users === null ? <Loading /> : users.length === 0 ? <Empty sub={empty} /> : (
        <div className="user-list">
          {users.map((u) => (
            <div key={u.id} className="user-row">
              <Avatar src={u.avatarUrl} name={u.username} size={48} onClick={() => nav.profile(u.username)} />
              <div className="user-row-text" onClick={() => nav.profile(u.username)}><UserName user={u} /><span className="muted">{u.fullName}</span></div>
              <button className={`btn btn-sm ${removed[u.id] ? 'btn-primary' : 'btn-secondary'}`} onClick={() => toggle(u)}>{removed[u.id] ? t('undo') : actionLabel}</button>
            </div>
          ))}
        </div>
      )}
      {addFrom && <AddPeopleSheet open={adding} kind={kind} onClose={() => setAdding(false)} onAdded={load} />}
    </>
  );
}

function AddPeopleSheet({ open, kind, onClose, onAdded }) {
  const { me, toast } = useApp();
  const [users, setUsers] = useState(null);
  const [q, setQ] = useState('');
  const [added, setAdded] = useState({});
  const source = kind === 'favorite' ? 'following' : 'followers';
  useEffect(() => { if (open) api(`users/${encodeURIComponent(me.username)}/${source}`).then((r) => setUsers(r.users)).catch(() => setUsers([])); }, [open]); // eslint-disable-line
  const add = async (u) => {
    try { await api(`users/${u.id}/${kind}`, { method: 'POST' }); setAdded((a) => ({ ...a, [u.id]: true })); onAdded(); } catch (e) { toast(errText(e.code)); }
  };
  const list = (users || []).filter((u) => !q || `${u.username} ${u.fullName}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Sheet open={open} onClose={onClose} title={source === 'following' ? t('following') : t('followers')} full>
      <div className="search-box pad"><ISearch size={18} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchPh')} dir="auto" /></div>
      {users === null ? <Loading /> : list.length === 0 ? <Empty sub={t('noFollowersYet')} /> : (
        <div className="user-list">
          {list.map((u) => (
            <div key={u.id} className="user-row">
              <Avatar src={u.avatarUrl} name={u.username} size={44} />
              <div className="user-row-text"><UserName user={u} /><span className="muted">{u.fullName}</span></div>
              <button className="btn btn-sm btn-primary" disabled={added[u.id]} onClick={() => add(u)}>{added[u.id] ? <ICheck size={16} /> : t('add')}</button>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}

function AudiencePage({ field, title, desc, options }) {
  const { s, patch } = useSettings();
  if (!s) return <Loading />;
  return <Radio title={title} desc={desc} value={s[field]} onChange={(v) => patch({ [field]: v })} options={options} />;
}

function MessagesPrivacy() {
  const opts3 = [['everyone', t('everyone')], ['following', t('peopleYouFollow')], ['none', t('noOne')]];
  return (
    <>
      <AudiencePage field="messages" title={t('whoCanMessage')} desc={t('whoCanMessageDesc')} options={opts3} />
      <AudiencePage field="storyReplies" title={t('whoCanReplyStory')} options={opts3} />
    </>
  );
}
function Mentions() {
  return <AudiencePage field="mentions" title={t('whoCanMention')} desc={t('whoCanMentionDesc')} options={[['everyone', t('everyone')], ['following', t('peopleYouFollow')], ['none', t('noOne')]]} />;
}
function CommentsSettings() {
  const { nav } = useApp();
  return (
    <>
      <AudiencePage field="comments" title={t('whoCanComment')} options={[['everyone', t('everyone')], ['followers', t('yourFollowers')], ['none', t('noOne')]]} />
      <Row icon={<IAa size={24} />} label={t('hiddenWords')} onClick={() => nav.push('settingsPage', { page: 'hiddenWords' })} />
    </>
  );
}
function Sharing() {
  const { s, patch } = useSettings();
  if (!s) return <Loading />;
  return <div className="settings-list"><Toggle on={s.allowSharing} label={t('allowSharing')} desc={t('allowSharingDesc')} onChange={(v) => patch({ allowSharing: v })} /></div>;
}
function Limit() {
  const { s, patch } = useSettings();
  if (!s) return <Loading />;
  return (
    <>
      <div className="limit-hero"><ILimit size={48} /><p>{t('limitDesc')}</p></div>
      <div className="settings-list"><Toggle on={s.limit.enabled} label={t('limitInteractions')} desc={t('limitToggleDesc')} onChange={(v) => patch({ limit: { enabled: v } })} /></div>
    </>
  );
}
function HiddenWords() {
  const { s, patch } = useSettings();
  const [word, setWord] = useState('');
  if (!s) return <Loading />;
  const custom = s.hiddenWords.custom || [];
  const add = () => {
    const w = word.trim(); if (!w) return;
    patch({ hiddenWords: { ...s.hiddenWords, custom: [...new Set([...custom, ...w.split(',').map((x) => x.trim()).filter(Boolean)])] } });
    setWord('');
  };
  return (
    <>
      <div className="settings-list"><Toggle on={s.hiddenWords.enabled} label={t('hideOffensive')} desc={t('hideOffensiveDesc')} onChange={(v) => patch({ hiddenWords: { ...s.hiddenWords, enabled: v } })} /></div>
      <Section title={t('customWords')}>
        <p className="muted small pad-x">{t('customWordsDesc')}</p>
        <div className="form-pad row-gap">
          <div className="field flex1"><input value={word} onChange={(e) => setWord(e.target.value)} placeholder={t('addWords')} dir="auto" onKeyDown={(e) => e.key === 'Enter' && add()} /></div>
          <button className="btn btn-primary" onClick={add} disabled={!word.trim()}>{t('add')}</button>
        </div>
        <div className="chips">
          {custom.map((w) => <span key={w} className="chip">{w}<button onClick={() => patch({ hiddenWords: { ...s.hiddenWords, custom: custom.filter((x) => x !== w) } })}><IClose size={14} /></button></span>)}
        </div>
      </Section>
    </>
  );
}
function Invite() {
  const { me, toast } = useApp();
  const [sugg, setSugg] = useState([]);
  useEffect(() => { api('suggestions').then((r) => setSugg(r.users)).catch(() => {}); }, []);
  const invite = async () => { const ok = await shareLink(`${WEB_URL}/?u=${me.username}`, t('inviteText')); if (!ok) toast(t('linkCopied')); };
  return (
    <>
      <div className="settings-list">
        <Row icon={<IUserPlus size={24} />} label={t('inviteByLink')} onClick={invite} />
      </div>
      {sugg.length > 0 ? <SuggestedUsers users={sugg} onDismiss={(id) => setSugg((x) => x.filter((u) => u.id !== id))} /> : null}
    </>
  );
}
function Language() {
  const { setLang } = useApp();
  return <LanguageList onPick={(k) => setLang(k)} />;
}
function Theme() {
  const [v, setV] = useState(getThemePref());
  const pick = (x) => { setV(x); setThemePref(x); };
  return <Radio value={v} onChange={pick} desc={t('themeDesc')} options={[['dark', t('themeDark')], ['light', t('themeLight')], ['system', t('themeSystem')]]} />;
}
function Help() {
  const { nav, toast } = useApp();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try { await api('support', { method: 'POST', body: { text } }); setText(''); toast(t('problemSent')); } catch (e) { toast(errText(e.code)); }
    setBusy(false);
  };
  const chat = async () => {
    try { const r = await api(`users/${OFFICIAL_USERNAME}`); nav.push('chat', { user: r.user }); } catch (e) { toast(errText(e.code)); }
  };
  return (
    <>
      <div className="settings-list">
        <Row icon={<IPaperPlane size={24} />} label={t('chatSupport')} sub={`@${OFFICIAL_USERNAME}`} onClick={chat} />
      </div>
      <Section title={t('helpCenter')}>
        {['faq1', 'faq2', 'faq3', 'faq4', 'faq5'].map((k) => (
          <details key={k} className="faq"><summary>{t(`${k}q`)}</summary><p>{t(`${k}a`)}</p></details>
        ))}
      </Section>
      <Section title={t('reportProblem')}>
        <div className="form-pad">
          <textarea className="textarea" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('reportProblemPh')} dir="auto" maxLength={1000} />
          <button className="btn btn-primary btn-block" disabled={busy || !text.trim()} onClick={send}>{busy ? <Spinner size={18} light /> : t('send')}</button>
        </div>
      </Section>
    </>
  );
}
function PrivacyCenter() {
  const { nav } = useApp();
  return (
    <>
      <div className="limit-hero"><IShieldStar size={48} /><p>{t('privacyCenterDesc')}</p></div>
      <div className="settings-list">
        <Row icon={<IDoc size={24} />} label={t('privacyPolicy')} onClick={() => nav.push('settingsPage', { page: 'policy' })} />
        <Row icon={<ILock size={24} />} label={t('accountPrivacy')} onClick={() => nav.push('settingsPage', { page: 'privacy' })} />
        <Row icon={<IBlock size={24} />} label={t('blocked')} onClick={() => nav.push('settingsPage', { page: 'blocked' })} />
        <Row icon={<IKey size={24} />} label={t('passwordSecurity')} onClick={() => nav.push('settingsPage', { page: 'password' })} />
      </div>
    </>
  );
}
function Policy() { return <div className="form-pad prose">{t('policyText').split('\n').map((p, i) => <p key={i}>{p}</p>)}</div>; }
function Terms() { return <div className="form-pad prose">{t('termsText').split('\n').map((p, i) => <p key={i}>{p}</p>)}</div>; }
function Status() {
  const { me } = useApp();
  const [st, setSt] = useState(null);
  useEffect(() => { api('me/status').then(setSt).catch(() => setSt({})); }, []);
  if (!st) return <Loading />;
  return (
    <>
      <div className="status-hero">
        <Avatar src={me.avatarUrl} name={me.username} size={72} />
        <b><bdi>{me.username}</bdi></b>
        <span className={`status-pill ${st.standing === 'good' ? 'ok' : 'warn'}`}><ICheckCircle size={18} />{st.standing === 'good' ? t('statusGood') : t('statusReview')}</span>
        <p className="muted small">{st.standing === 'good' ? t('statusGoodDesc') : t('statusReviewDesc')}</p>
      </div>
      <div className="settings-list">
        <Row icon={<IClock size={24} />} label={t('joined')} sub={st.createdAt ? new Date(st.createdAt).toLocaleDateString(document.documentElement.lang) : ''} chevron={false} />
        <Row icon={<ILock size={24} />} label={t('accountPrivacy')} sub={st.isPrivate ? t('private') : t('public')} chevron={false} />
        <Row icon={<ICheckCircle size={24} />} label={t('verified')} sub={st.verified ? t('yes') : t('no')} chevron={false} />
        <Row icon={<IDoc size={24} />} label={t('reportsOnContent')} sub={String(st.reports ?? 0)} chevron={false} />
      </div>
    </>
  );
}
function About() {
  const { nav } = useApp();
  return (
    <>
      <div className="about">
        <Glyph size={88} />
        <b className="about-name">Nexora</b>
        <p className="muted">{t('aboutText', { v: APP_VERSION })}</p>
      </div>
      <div className="settings-list">
        <Row icon={<IDoc size={24} />} label={t('termsOfUse')} onClick={() => nav.push('settingsPage', { page: 'terms' })} />
        <Row icon={<IShieldStar size={24} />} label={t('privacyPolicy')} onClick={() => nav.push('settingsPage', { page: 'policy' })} />
        <Row icon={<IGlobe size={24} />} label={t('website')} sub={WEB_URL.replace('https://', '')} onClick={() => openUrl(WEB_URL)} />
      </div>
      <p className="muted small center">© 2026 Ahmed Becetti</p>
    </>
  );
}
function Saved() {
  const { nav } = useApp();
  const [posts, setPosts] = useState(null);
  useEffect(() => { api('me/saved').then((r) => setPosts(r.posts)).catch(() => setPosts([])); }, []);
  if (posts === null) return <Loading />;
  if (!posts.length) return <Empty icon={<IBookmark size={36} />} title={t('saved')} sub={t('noSaved')} />;
  return <div className="grid">{posts.map((p) => <Thumb key={p.id} post={p} onClick={() => nav.push('postList', { posts, startId: p.id, title: t('saved') })} />)}</div>;
}
function Archive() {
  const { me, nav } = useApp();
  const [stories, setStories] = useState(null);
  useEffect(() => { api('me/stories').then((r) => setStories(r.stories)).catch(() => setStories([])); }, []);
  if (stories === null) return <Loading />;
  if (!stories.length) return <Empty icon={<IArchive size={36} />} title={t('archive')} sub={t('noArchive')} />;
  return (
    <div className="grid story-pick">
      {stories.map((s, i) => (
        <div key={s.id} className="grid-item tall" onClick={() => nav.push('stories', { tray: [{ user: me, stories: stories.slice(i).map((x) => ({ ...x, seen: true })) }], index: 0, highlight: t('archive') })}>
          {s.type === 'video' ? <video disableRemotePlayback src={s.url + '#t=0.3'} muted /> : <img src={s.url} alt="" />}
          <span className="archive-date">{new Date(s.createdAt).toLocaleDateString(document.documentElement.lang, { day: 'numeric', month: 'short' })}</span>
        </div>
      ))}
    </div>
  );
}

const PAGES = {
  accountsCenter: AccountsCenter, accounts: AccountsOnDevice, personal: PersonalDetails, password: PasswordSecurity, deleteAccount: DeleteAccount,
  notifications: NotificationsSettings, time: TimeManagement, activity: YourActivity, privacy: Privacy,
  close: () => <UserListPage kind="close" empty={t('noCloseFriends')} actionLabel={t('remove')} desc={t('closeFriendsDesc')} addFrom />,
  blocked: () => <UserListPage kind="block" empty={t('noBlocked')} actionLabel={t('unblock')} desc={t('blockedDesc')} />,
  restricted: () => <UserListPage kind="restrict" empty={t('noRestricted')} actionLabel={t('unrestrict')} desc={t('restrictedDesc')} />,
  favorites: () => <UserListPage kind="favorite" empty={t('noFavorites')} actionLabel={t('remove')} desc={t('favoritesDesc')} addFrom />,
  muted: () => <UserListPage kind="mute" empty={t('noMuted')} actionLabel={t('unmute')} desc={t('mutedDesc')} />,
  messagesPriv: MessagesPrivacy, mentions: Mentions, comments: CommentsSettings, sharing: Sharing, limit: Limit, hiddenWords: HiddenWords,
  invite: Invite, language: Language, theme: Theme, help: Help, privacyCenter: PrivacyCenter, status: Status, about: About, saved: Saved, archive: Archive,
  policy: Policy, terms: Terms,
};
void useMemo;
