import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { api, getToken, setToken, onUnauthorized } from './api.js';
import { getLang, setLang as saveLang, t } from './i18n.js';
import { AppCtx, Avatar } from './components.jsx';
import { IHome, ISearch, IPlusSquare, IReels } from './icons.jsx';
import { Login, Signup } from './screens/Auth.jsx';
import Feed from './screens/Feed.jsx';
import Search, { TagScreen } from './screens/Search.jsx';
import Reels, { ReelsViewer } from './screens/Reels.jsx';
import Profile, { EditProfile, UserList } from './screens/Profile.jsx';
import Create from './screens/Create.jsx';
import Notifications from './screens/Notifications.jsx';
import { Inbox, Chat } from './screens/Messages.jsx';
import Settings, { SettingsPage } from './screens/Settings.jsx';
import { PostDetail, PostList } from './screens/Post.jsx';
import StoryViewer from './screens/Stories.jsx';

const SCREENS = {
  profile: Profile, editProfile: EditProfile, userList: UserList, create: Create, notifications: Notifications,
  inbox: Inbox, chat: Chat, settings: Settings, settingsPage: SettingsPage, post: PostDetail, postList: PostList,
  stories: StoryViewer, tag: TagScreen, reelsViewer: ReelsViewer,
};

export default function App() {
  const [token, setTok] = useState(getToken());
  const [me, setMe] = useState(() => { try { return JSON.parse(localStorage.getItem('nx_me')); } catch { return null; } });
  const [lang, setLangState] = useState(getLang());
  const [authScreen, setAuthScreen] = useState('login');
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
    setTab('home'); setStack([]);
  }, []);
  const logout = useCallback(() => {
    setToken(null); setTok(null); setMe(null); localStorage.removeItem('nx_me'); setStack([]); setAuthScreen('login');
  }, []);
  const updateMe = useCallback((u) => { setMe(u); localStorage.setItem('nx_me', JSON.stringify(u)); }, []);

  useEffect(() => onUnauthorized(logout), [logout]);

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

  // Android hardware back button
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const h = CapApp.addListener('backButton', () => {
      if (document.querySelector('.sheet-wrap.open, .dialog-wrap')) { document.dispatchEvent(new CustomEvent('nx-close-overlay')); document.querySelector('.sheet-wrap.open, .dialog-wrap')?.click(); return; }
      if (stackRef.current.length) { setStack((s) => s.slice(0, -1)); return; }
      if (tabRef.current !== 'home') { setTab('home'); return; }
      CapApp.exitApp();
    });
    StatusBar.setStyle({ style: Style.Light }).catch(() => {});
    StatusBar.setBackgroundColor?.({ color: '#ffffff' }).catch?.(() => {});
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

  const setLang = (l) => { saveLang(l); setLangState(l); };
  const ctx = { me, updateMe, login, logout, nav, toast, lang, setLang, badges, refreshBadges, setBadges, tab, refreshKey };

  if (!token) {
    return (
      <AppCtx.Provider value={ctx}>
        <div className="app" key={lang}>
          {authScreen === 'login' ? <Login goSignup={() => setAuthScreen('signup')} /> : <Signup goLogin={() => setAuthScreen('login')} />}
          {toastMsg && <div className="toast">{toastMsg}</div>}
        </div>
      </AppCtx.Provider>
    );
  }

  const top = stack[stack.length - 1];
  const darkTab = tab === 'reels' && !top;
  return (
    <AppCtx.Provider value={ctx}>
      <div className={`app ${darkTab ? 'dark-tab' : ''}`} key={lang}>
        <main className="tab-area" hidden={!!top}>
          <div className="tab-pane" hidden={tab !== 'home'}><Feed active={tab === 'home' && !top} refreshKey={refreshKey} /></div>
          <div className="tab-pane" hidden={tab !== 'search'}>{tab === 'search' || visited.has('search') ? <Search active={tab === 'search' && !top} /> : null}</div>
          <div className="tab-pane" hidden={tab !== 'reels'}>{tab === 'reels' ? <Reels active={!top} /> : null}</div>
          <div className="tab-pane" hidden={tab !== 'profile'}>{tab === 'profile' || visited.has('profile') ? <Profile username={me?.username} isTab active={tab === 'profile' && !top} refreshKey={refreshKey} /> : null}</div>
        </main>
        <nav className={`bottom-nav ${darkTab ? 'dark' : ''}`} hidden={!!top && !NAV_SCREENS.has(top.name)}>
          <button onClick={() => nav.tab('home')} aria-label={t('home')}><IHome active={tab === 'home'} size={27} /></button>
          <button onClick={() => { visited.add('search'); nav.tab('search'); }} aria-label={t('search')}><ISearch active={tab === 'search'} size={27} /></button>
          <button onClick={() => nav.push('create')} aria-label={t('create')}><IPlusSquare size={27} /></button>
          <button onClick={() => nav.tab('reels')} aria-label={t('reels')}><IReels active={tab === 'reels'} size={27} /></button>
          <button onClick={() => { visited.add('profile'); nav.tab('profile'); }} aria-label={t('profile')}>
            <span className={`nav-avatar ${tab === 'profile' ? 'active' : ''}`}><Avatar src={me?.avatarUrl} name={me?.username} size={27} /></span>
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
        {toastMsg && <div className="toast">{toastMsg}</div>}
      </div>
    </AppCtx.Provider>
  );
}
const visited = new Set();
const NAV_SCREENS = new Set(['profile', 'post', 'postList', 'tag', 'userList']);
