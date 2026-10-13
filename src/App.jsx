import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { api, getToken, setToken, onUnauthorized, getAccounts, upsertAccount, forgetAccount, dropAccountToken } from './api.js';
import { getLang, setLang as saveLang, t } from './i18n.js';
import { AppCtx, Avatar, Splash } from './components.jsx';
import { IHome, ISearch, IReels, ISend } from './icons.jsx';
import { applyTheme, onThemeChange } from './theme.js';
import AuthFlow from './screens/Auth.jsx';
import { addUsage, limitReminderDue } from './usage.js';
import { initAds, setAdSlot } from './ads.js';
import Feed from './screens/Feed.jsx';
import Search, { TagScreen } from './screens/Search.jsx';
import Reels, { ReelsViewer } from './screens/Reels.jsx';
import Profile, { EditProfile, UserList } from './screens/Profile.jsx';
import Create from './screens/Create.jsx';
import Notifications, { FollowRequests } from './screens/Notifications.jsx';
import { Inbox, Chat } from './screens/Messages.jsx';
import Settings, { SettingsPage } from './screens/Settings.jsx';
import { PostDetail, PostList } from './screens/Post.jsx';
import { CallCenter } from './chatkit/calls.jsx';
import StoryViewer from './screens/Stories.jsx';
import AIPlatform from './ai/AIPlatform.jsx';

const SCREENS = {
  profile: Profile, editProfile: EditProfile, userList: UserList, create: Create, notifications: Notifications,
  inbox: Inbox, chat: Chat, settings: Settings, settingsPage: SettingsPage, post: PostDetail, postList: PostList,
  stories: StoryViewer, tag: TagScreen, reelsViewer: ReelsViewer, followRequests: FollowRequests,
};

function SocialApp() {
  const [token, setTok] = useState(getToken());
  const [me, setMe] = useState(() => { try { return JSON.parse(localStorage.getItem('nx_me')); } catch { return null; } });
  const [lang, setLangState] = useState(getLang());
  const [adding, setAdding] = useState(false);
  const [booting, setBooting] = useState(true);
  const [session, setSession] = useState(0);
  const [tab, setTab] = useState('home');
  const [stack, setStack] = useState([]);
  const [toastMsg, setToastMsg] = useState(null);
  const [badges, setBadges] = useState({ notifications: 0, messages: 0, requests: 0 });
  const [refreshKey, setRefreshKey] = useState(0);
  const toastTimer = useRef();
  const stackRef = useRef(stack); stackRef.current = stack;
  const tabRef = useRef(tab); tabRef.current = tab;

  const toast = useCallback((msg) => {
    setToastMsg(msg); clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2600);
  }, []);

  const login = useCallback((tk, user) => {
    setToken(tk); setTok(tk); setMe(user); localStorage.setItem('nx_me', JSON.stringify(user));
    upsertAccount(user, tk);
    visited.clear(); setAdding(false); setTab('home'); setStack([]); setBadges({ notifications: 0, messages: 0, requests: 0 }); setSession((n) => n + 1);
  }, []);
  /** Log out of the current account. `remember` keeps one-tap login on this device. */
  const logout = useCallback(({ remember = true, all = false } = {}) => {
    const cur = JSON.parse(localStorage.getItem('nx_me') || 'null');
    if (all) getAccounts().forEach((a) => dropAccountToken(a.id));
    else if (cur) { if (remember) upsertAccount(cur, getToken()); else forgetAccount(cur.id); }
    // stay signed in with another account if one is available
    const next = all ? null : getAccounts().find((a) => a.token && a.id !== cur?.id);
    if (next) { setToken(next.token); setTok(next.token); setMe(next); localStorage.setItem('nx_me', JSON.stringify(next)); setSession((n) => n + 1); }
    else { setToken(null); setTok(null); setMe(null); localStorage.removeItem('nx_me'); }
    visited.clear(); setStack([]); setTab('home'); setAdding(false);
  }, []);
  const switchAccount = useCallback((acc) => {
    if (!acc?.token) return;
    setToken(acc.token); setTok(acc.token); setMe(acc); localStorage.setItem('nx_me', JSON.stringify(acc));
    visited.clear(); setStack([]); setTab('home'); setBadges({ notifications: 0, messages: 0, requests: 0 }); setSession((n) => n + 1);
  }, []);
  const updateMe = useCallback((u) => { setMe(u); localStorage.setItem('nx_me', JSON.stringify(u)); upsertAccount(u); }, []);

  useEffect(() => onUnauthorized(() => {
    const cur = JSON.parse(localStorage.getItem('nx_me') || 'null');
    if (cur) dropAccountToken(cur.id);
    setToken(null); setTok(null); setMe(null); localStorage.removeItem('nx_me'); setStack([]); setAdding(false);
  }), []);

  useEffect(() => { const tm = setTimeout(() => setBooting(false), 1100); return () => clearTimeout(tm); }, []);

  // on-device time tracking + daily limit reminder (Settings → Time management)
  useEffect(() => {
    if (!token) return;
    const iv = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      const mins = addUsage(30);
      if (limitReminderDue(mins)) toast(t('limitReached'));
    }, 30000);
    return () => clearInterval(iv);
  }, [token, toast]);

  // refresh profile on start
  useEffect(() => {
    if (!token) return;
    api('me').then((r) => updateMe(r.user)).catch(() => {});
  }, [token, updateMe]);

  const refreshBadges = useCallback(() => {
    if (!getToken()) return;
    api('me/badges').then(setBadges).catch(() => {});
  }, []);
  useEffect(() => {
    if (!token) return;
    refreshBadges();
    const iv = setInterval(refreshBadges, 20000);
    return () => clearInterval(iv);
  }, [token, refreshBadges]);

  const nav = useMemo(() => ({
    push: (name, props = {}) => setStack((s) => [...s, { name, props, key: Date.now() + Math.random() }]),
    pop: () => setStack((s) => s.slice(0, -1)),
    replace: (name, props = {}) => setStack((s) => [...s.slice(0, -1), { name, props, key: Date.now() }]),
    reset: () => setStack([]),
    tab: (name) => { setStack([]); if (tabRef.current === name) setRefreshKey((k) => k + 1); setTab(name); },
    profile: (username) => setStack((s) => [...s, { name: 'profile', props: { username }, key: Date.now() }]),
  }), []);

  const [themeTick, setThemeTick] = useState(0);
  useEffect(() => onThemeChange(() => setThemeTick((n) => n + 1)), []);
  const topName = stack[stack.length - 1]?.name;
  useEffect(() => {
    const immersive = (!topName && tab === 'reels') || topName === 'stories' || topName === 'reelsViewer' || (topName === 'create');
    applyTheme({ immersive });
  }, [tab, topName, themeTick, token, booting]);

  // AdMob banner: only on the Home / Search / Profile tabs (never on Reels, stories, chats or open screens)
  useEffect(() => { if (token && !booting && !adding) initAds(); }, [token, booting, adding]);
  useEffect(() => {
    setAdSlot(!!token && !booting && !adding && !topName && (tab === 'home' || tab === 'search' || tab === 'profile'));
  }, [token, booting, adding, tab, topName]);

  // native feel: no browser long-press menu (copy / select all / web search) outside text fields
  useEffect(() => {
    const h = (e) => { const el = e.target; if (!(el.closest && el.closest('input, textarea, [contenteditable="true"]'))) e.preventDefault(); };
    document.addEventListener('contextmenu', h);
    return () => document.removeEventListener('contextmenu', h);
  }, []);

  // Android hardware back button
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const h = CapApp.addListener('backButton', () => {
      if (document.querySelector('.msg-menu-wrap, .media-viewer, .sheet-wrap.open, .dialog-wrap, .ck-sheet-wrap.open, .ck-drawer.open, .ck-aimenu-wrap')) { document.dispatchEvent(new CustomEvent('nx-close-overlay')); document.querySelector('.sheet-wrap.open, .dialog-wrap, .ck-sheet-wrap.open, .ck-aimenu-wrap')?.click(); return; }
      if (stackRef.current.length) { setStack((s) => s.slice(0, -1)); return; }
      if (tabRef.current !== 'home') { setTab('home'); return; }
      CapApp.exitApp();
    });
    return () => { h.then((x) => x.remove()); };
  }, []);

  // open shared profile links ?u=username
  useEffect(() => {
    if (!token) return;
    const sp = new URLSearchParams(location.search);
    const u = sp.get('u'), p = sp.get('p');
    if (u) nav.profile(u);
    else if (p) nav.push('post', { id: p });
    if (u || p) history.replaceState(null, '', location.pathname);
  }, [token, nav]);

  const setLang = async (l) => { await saveLang(l); setLangState(l); };
  const ctx = { me, updateMe, login, logout, switchAccount, addAccount: () => setAdding(true), nav, toast, lang, setLang, badges, refreshBadges, setBadges, tab, refreshKey };

  if (booting) return <Splash />;
  if (!token || adding) {
    return (
      <AppCtx.Provider value={ctx}>
        <div className="app" key={lang}>
          <AuthFlow onCancel={token ? () => setAdding(false) : null} key={`auth-${session}-${adding}`} />
        {toastMsg && <div className="toast">{toastMsg}</div>}
        </div>
      </AppCtx.Provider>
    );
  }

  const top = stack[stack.length - 1];
  const darkTab = (tab === 'reels' && !top) || top?.name === 'stories' || top?.name === 'reelsViewer';
  return (
    <AppCtx.Provider value={ctx}>
      <div className={`app ${darkTab ? 'dark-tab' : ''}`} key={`${lang}-${session}`}>
        <main className="tab-area" hidden={!!top}>
          <div className="tab-pane" hidden={tab !== 'home'}><Feed active={tab === 'home' && !top} refreshKey={refreshKey} /></div>
          <div className="tab-pane" hidden={tab !== 'reels'}>{tab === 'reels' ? <Reels active={!top} /> : null}</div>
          <div className="tab-pane" hidden={tab !== 'messages'}>{tab === 'messages' || visited.has('messages') ? <Inbox isTab active={tab === 'messages' && !top} /> : null}</div>
          <div className="tab-pane" hidden={tab !== 'search'}>{tab === 'search' || visited.has('search') ? <Search active={tab === 'search' && !top} /> : null}</div>
          <div className="tab-pane" hidden={tab !== 'profile'}>{tab === 'profile' || visited.has('profile') ? <Profile username={me?.username} isTab active={tab === 'profile' && !top} refreshKey={refreshKey} /> : null}</div>
        </main>
        <nav className={`bottom-nav ${darkTab ? 'dark' : ''}`} hidden={!!top && !NAV_SCREENS.has(top.name)}>
          <button onClick={() => nav.tab('home')} aria-label={t('home')}><IHome active={tab === 'home' && !top} size={27} /></button>
          <button onClick={() => nav.tab('reels')} aria-label={t('reels')}><IReels active={tab === 'reels' && !top} size={27} /></button>
          <button className="badge-wrap" onClick={() => { visited.add('messages'); nav.tab('messages'); }} aria-label={t('messages')}>
            <ISend size={27} active={tab === 'messages' && !top} />{badges.messages > 0 && <span className="num-badge">{badges.messages}</span>}
          </button>
          <button onClick={() => { visited.add('search'); nav.tab('search'); }} aria-label={t('search')}><ISearch active={tab === 'search' && !top} size={27} /></button>
          <button onClick={() => { visited.add('profile'); nav.tab('profile'); }} aria-label={t('profile')}>
            <span className={`nav-avatar ${tab === 'profile' && !top ? 'active' : ''}`}><Avatar src={me?.avatarUrl} name={me?.username} size={27} /></span>
          </button>
        </nav>
        {stack.map((s, i) => {
          const C = SCREENS[s.name];
          return (
            <div key={s.key} className={`stack-screen ${s.name === 'stories' ? 'no-anim' : ''} ${NAV_SCREENS.has(s.name) ? 'with-nav' : ''}`} style={{ zIndex: 20 + i }} hidden={i < stack.length - 1}>
              <C {...s.props} active={i === stack.length - 1} />
            </div>
          );
        })}
        <CallCenter />
        {toastMsg && <div className="toast">{toastMsg}</div>}
      </div>
    </AppCtx.Provider>
  );
}
const visited = new Set();
const NAV_SCREENS = new Set(['profile', 'post', 'postList', 'tag', 'userList']);


// Website becomes NEXORA AI; native Android source remains independent.
export default function App() {
  return Capacitor.isNativePlatform() ? <SocialApp /> : <AIPlatform />;
}
