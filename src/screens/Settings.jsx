import { useState } from 'react';
import { api, WEB_URL } from '../api.js';
import { t, errText } from '../i18n.js';
import { useApp, TopBar, Confirm, Spinner, Wordmark } from '../components.jsx';
import { IUserPlus, IBell, ILock, IShield, IAccount, IHelp, IInfo, IChevron, IGlobe, IBookmark, IArchive, ILogout, ISearch, ICheck } from '../icons.jsx';
import { shareLink } from './Post.jsx';

export const APP_VERSION = '2.0.0';

export default function Settings() {
  const { nav, logout, toast, me } = useApp();
  const [q, setQ] = useState('');
  const [confirmOut, setConfirmOut] = useState(false);
  const items = [
    { id: 'invite', icon: <IUserPlus size={24} />, label: t('inviteFriends'), onClick: async () => { const ok = await shareLink(`${WEB_URL}/?u=${me.username}`, 'Nexora'); if (!ok) toast(t('linkCopied')); } },
    { id: 'notifications', icon: <IBell size={24} />, label: t('notifSettings') },
    { id: 'privacy', icon: <ILock size={24} />, label: t('privacy'), value: me.isPrivate ? t('privateToggle') : '' },
    { id: 'security', icon: <IShield size={24} />, label: t('security') },
    { id: 'account', icon: <IAccount size={24} />, label: t('account') },
    { id: 'language', icon: <IGlobe size={24} />, label: t('languageSetting'), value: t('language') },
    { id: 'saved', icon: <IBookmark size={24} />, label: t('saved') },
    { id: 'archive', icon: <IArchive size={24} />, label: t('archive') },
    { id: 'help', icon: <IHelp size={24} />, label: t('help') },
    { id: 'about', icon: <IInfo size={24} />, label: t('about') },
  ].filter((i) => !q || i.label.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="screen">
      <TopBar title={t('settings')} />
      <div className="scroll">
        <div className="search-box pad"><ISearch size={18} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchPh')} dir="auto" /></div>
        <div className="settings-list">
          {items.map((i) => (
            <button key={i.id} className="settings-item" onClick={i.onClick || (() => nav.push('settingsPage', { page: i.id }))}>
              {i.icon}<span className="flex1">{i.label}</span>{i.value && <span className="muted">{i.value}</span>}<IChevron size={18} className="muted" />
            </button>
          ))}
        </div>
        <div className="settings-list">
          <button className="settings-item danger" onClick={() => setConfirmOut(true)}><ILogout size={24} /><span className="flex1">{t('logout')} <bdi>{me.username}</bdi></span></button>
        </div>
        <div className="settings-foot"><Wordmark size={26} gradient /><span>{t('aboutText', { v: APP_VERSION })}</span></div>
      </div>
      <Confirm open={confirmOut} title={t('logoutConfirm')} okLabel={t('logout')} danger onOk={logout} onClose={() => setConfirmOut(false)} />
    </div>
  );
}

function Toggle({ on, onChange, label, desc, busy }) {
  return (
    <label className="toggle-row">
      <div className="flex1"><div>{label}</div>{desc && <p className="muted small">{desc}</p>}</div>
      {busy ? <Spinner size={18} /> : <span className={`switch ${on ? 'on' : ''}`}><input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} /></span>}
    </label>
  );
}

export function SettingsPage({ page }) {
  const { me, updateMe, toast, lang, setLang, nav, logout } = useApp();
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '' });
  const [delPw, setDelPw] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  const [notifOn, setNotifOn] = useState(localStorage.getItem('nx_notif') !== 'off');
  const titles = { notifications: t('notifSettings'), privacy: t('privacy'), security: t('security'), account: t('account'), language: t('languageSetting'), help: t('help'), about: t('about'), saved: t('saved'), archive: t('archive') };

  const setPrivate = async (v) => {
    setBusy(true);
    try { const r = await api('me', { method: 'PATCH', body: { isPrivate: v } }); updateMe(r.user); } catch (e) { toast(errText(e.code)); }
    setBusy(false);
  };
  const changePw = async () => {
    setBusy(true);
    try { await api('me/password', { method: 'POST', body: pw }); toast(t('passwordChanged')); setPw({ current: '', next: '' }); } catch (e) { toast(errText(e.code)); }
    setBusy(false);
  };
  const deleteAccount = async () => {
    setBusy(true);
    try { await api('me', { method: 'DELETE', body: { password: delPw } }); logout(); } catch (e) { toast(errText(e.code)); }
    setBusy(false);
  };

  if (page === 'saved') { nav.replace('profile', { username: me.username }); return null; }

  return (
    <div className="screen">
      <TopBar title={titles[page]} />
      <div className="scroll">
        {page === 'notifications' && (
          <div className="settings-list">
            <Toggle on={notifOn} label={t('pushToggle')} onChange={(v) => { setNotifOn(v); localStorage.setItem('nx_notif', v ? 'on' : 'off'); }} />
          </div>
        )}
        {page === 'privacy' && (
          <div className="settings-list"><Toggle on={me.isPrivate} busy={busy} label={t('privateToggle')} desc={t('privateDesc')} onChange={setPrivate} /></div>
        )}
        {page === 'security' && (
          <div className="form-pad">
            <h3>{t('changePassword')}</h3>
            <div className="field"><input type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} placeholder={t('currentPassword')} /></div>
            <div className="field"><input type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} placeholder={t('newPassword')} /></div>
            <button className="btn btn-primary btn-lg btn-block" disabled={busy || !pw.current || pw.next.length < 6} onClick={changePw}>{busy ? <Spinner size={20} light /> : t('save')}</button>
          </div>
        )}
        {page === 'account' && (
          <>
            <div className="settings-list">
              <button className="settings-item" onClick={() => nav.push('editProfile')}><IAccount size={24} /><span className="flex1">{t('editProfile')}</span><IChevron size={18} /></button>
              <div className="settings-item static"><span className="flex1 muted">{me.email || me.phone}</span></div>
            </div>
            <div className="form-pad">
              <h3 className="danger-text">{t('deleteAccount')}</h3>
              <p className="muted small">{t('deleteAccountDesc')}</p>
              <div className="field"><input type="password" value={delPw} onChange={(e) => setDelPw(e.target.value)} placeholder={t('password')} /></div>
              <button className="btn btn-danger btn-lg btn-block" disabled={!delPw || busy} onClick={() => setConfirmDel(true)}>{t('deleteAccount')}</button>
            </div>
            <Confirm open={confirmDel} title={t('deleteAccount')} text={t('deleteAccountDesc')} okLabel={t('delete')} danger onOk={deleteAccount} onClose={() => setConfirmDel(false)} />
          </>
        )}
        {page === 'language' && (
          <div className="settings-list">
            {[['ar', 'العربية'], ['en', 'English']].map(([k, l]) => (
              <button key={k} className="settings-item" onClick={() => setLang(k)}><span className="flex1">{l}</span>{lang === k && <ICheck size={20} />}</button>
            ))}
          </div>
        )}
        {page === 'archive' && <Archive />}
        {page === 'help' && <div className="form-pad"><p className="prose">{t('helpText')}</p></div>}
        {page === 'about' && (
          <div className="about">
            <img src="/icon-192.png" alt="" width="88" height="88" />
            <Wordmark size={40} gradient />
            <p className="muted">{t('aboutText', { v: APP_VERSION })}</p>
            <p className="muted small">© 2026 Ahmed Becetti</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Archive() {
  const { me, nav } = useApp();
  const [stories, setStories] = useState(null);
  useState(() => { api('me/stories').then((r) => setStories(r.stories)).catch(() => setStories([])); });
  if (stories === null) return <div className="center-pad"><Spinner /></div>;
  if (!stories.length) return <div className="empty"><p>{t('noArchive')}</p></div>;
  return (
    <div className="grid story-pick">
      {stories.map((s, i) => (
        <div key={s.id} className="grid-item tall" onClick={() => nav.push('stories', { tray: [{ user: me, stories: stories.map((x) => ({ ...x, seen: true })) }], index: 0, highlight: t('archive') })}>
          {s.type === 'video' ? <video disableRemotePlayback src={s.url + '#t=0.3'} muted /> : <img src={s.url} alt="" />}
          <span className="archive-date">{new Date(s.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
        </div>
      ))}
    </div>
  );
}
