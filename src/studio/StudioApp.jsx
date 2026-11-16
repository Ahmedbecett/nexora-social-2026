import { useEffect, useMemo, useState } from 'react';
import { StudioProvider, useStudio } from './state.jsx';
import { signInToAccount, registerAccount } from './api.js';
import { t } from '../i18n.js';
import ProjectsPanel from './ProjectsPanel.jsx';
import ChatPanel from './ChatPanel.jsx';
import Workspace from './Workspace.jsx';
import AgentWindow from './AgentWindow.jsx';
import SettingsPanel from './SettingsPanel.jsx';
import {
  IconPlus, IconGear, IconSearch, IconSpark, IconSave, IconRocket, IconCommand,
  IconEye, IconCode, IconTerminal, IconPlay, IconLayers, IconWarn, IconRefresh,
  IconUser, IconLink, IconX,
} from './icons.jsx';
import './studio.css';

const STACK_LABEL = { static: 'HTML/CSS/JS', 'vite-react': 'React', node: 'Node', next: 'Next.js' };

/* ---------------------------- account linking ---------------------------- */
const AUTH_ERRORS = {
  invalid_credentials: 'Wrong username or password.',
  missing_credentials: 'Enter your username and password.',
  use_phone_login: 'This account signs in with a phone number.',
  weak_password: 'The password must be at least 6 characters.',
  username_taken: 'That username is taken.',
  email_taken: 'That email is already registered.',
  invalid_username: 'Usernames use letters, numbers, dots and underscores (3–30).',
  invalid_contact: 'Enter a valid email address.',
  network: 'Could not reach the server. Check your connection.',
  account_required: 'Sign in with a NEXORA account to link this workspace.',
  guest_already_claimed: 'This guest workspace is already linked to another account.',
  no_guest_session: 'There is no guest workspace to link.',
};

/**
 * Linking a guest workspace to a NEXORA account.
 * The visitor signs in (or creates an account) and the server moves every
 * guest-owned project, message, revision, run, deployment and key to it.
 */
function AccountLink({ onClose }) {
  const { claimWorkspace, notify, session } = useStudio();
  const [tab, setTab] = useState('login');
  const [form, setForm] = useState({ identifier: '', password: '', fullName: '', username: '', email: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const res = tab === 'login'
        ? await signInToAccount(form.identifier.trim(), form.password)
        : await registerAccount({
          fullName: form.fullName.trim(),
          username: form.username.trim().replace(/^@/, ''),
          email: form.email.trim(),
          password: form.password,
        });
      if (!res?.token) throw Object.assign(new Error('no token'), { code: 'sign_in_failed' });
      const result = await claimWorkspace(res.token, res.user);
      const moved = result?.moved?.projects || 0;
      notify(
        moved
          ? `${moved} project${moved === 1 ? '' : 's'} moved to @${res.user?.username || 'your account'}`
          : `Signed in as @${res.user?.username || 'your account'}`,
        'ok',
      );
      onClose();
    } catch (err) {
      setError(AUTH_ERRORS[err?.code] || err?.detail || err?.message || 'Sign-in failed');
    } finally { setBusy(false); }
  };

  const useLocalAccount = async () => {
    setBusy(true); setError(null);
    try {
      const result = await claimWorkspace('dev-account', { id: 'dev-account', username: 'local-preview', fullName: 'Local preview' });
      const moved = result?.moved?.projects || 0;
      notify(moved ? `${moved} project${moved === 1 ? '' : 's'} moved to the local account` : 'Local account linked', 'ok');
      onClose();
    } catch (err) {
      setError(AUTH_ERRORS[err?.code] || err?.detail || err?.message || 'Could not link the workspace');
    } finally { setBusy(false); }
  };

  return (
    <div className="nxs-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="nxs-modal nxs-link-modal">
        <div className="nxs-modal-head">
          <h3><IconLink size={13} /> {t('studioLinkTitle')}</h3>
          <button className="nxs-btn icon ghost" onClick={onClose} aria-label="Close"><IconX size={13} /></button>
        </div>

        <div className="nxs-modal-body">
          <p className="nxs-muted" style={{ fontSize: 12.5, lineHeight: 1.7, marginTop: 0 }}>
            {t('studioLinkIntro')}
          </p>

          <div className="nxs-seg" style={{ marginBottom: 12 }}>
            <button type="button" className={tab === 'login' ? 'on' : ''} onClick={() => setTab('login')}>{t('studioLinkSignIn')}</button>
            <button type="button" className={tab === 'signup' ? 'on' : ''} onClick={() => setTab('signup')}>{t('studioLinkSignUp')}</button>
          </div>

          {error && <div className="nxs-error-box">{error}</div>}

          <form onSubmit={submit}>
            {tab === 'signup' && (
              <>
                <div className="field">
                  <label htmlFor="nxs-link-name">{t('studioLinkFullName')}</label>
                  <input id="nxs-link-name" className="nxs-input" value={form.fullName} onChange={set('fullName')} autoComplete="name" />
                </div>
                <div className="field">
                  <label htmlFor="nxs-link-user">{t('studioLinkUsername')}</label>
                  <input id="nxs-link-user" className="nxs-input" value={form.username} onChange={set('username')} autoComplete="username" spellCheck={false} />
                </div>
                <div className="field">
                  <label htmlFor="nxs-link-mail">{t('studioLinkEmail')}</label>
                  <input id="nxs-link-mail" className="nxs-input" type="email" value={form.email} onChange={set('email')} autoComplete="email" />
                </div>
              </>
            )}
            {tab === 'login' && (
              <div className="field">
                <label htmlFor="nxs-link-id">{t('studioLinkIdentifier')}</label>
                <input id="nxs-link-id" className="nxs-input" value={form.identifier} onChange={set('identifier')} autoComplete="username" spellCheck={false} />
              </div>
            )}
            <div className="field">
              <label htmlFor="nxs-link-pass">{t('studioLinkPassword')}</label>
              <input id="nxs-link-pass" className="nxs-input" type="password" value={form.password} onChange={set('password')} autoComplete={tab === 'login' ? 'current-password' : 'new-password'} />
            </div>
            <button className="nxs-btn primary" style={{ width: '100%', marginTop: 6 }} disabled={busy || !form.password || (tab === 'login' ? !form.identifier : !(form.fullName && form.username && form.email))}>
              {busy ? t('studioLinkWorking') : (tab === 'login' ? t('studioLinkSubmit') : t('studioLinkSubmitNew'))}
            </button>
          </form>

          {session?.devAccounts && (
            <>
              <div className="nxs-faint" style={{ fontSize: 11.5, margin: '12px 0 8px' }}>{t('studioLinkLocal')}</div>
              <button className="nxs-btn" style={{ width: '100%' }} disabled={busy} onClick={useLocalAccount}>
                {t('studioLinkLocalAction')}
              </button>
            </>
          )}

          <button
            type="button"
            className="nxs-btn ghost"
            style={{ width: '100%', marginTop: 8 }}
            onClick={() => { onClose(); window.dispatchEvent(new CustomEvent('nxs-open-chat')); }}
          >
            {t('studioLinkOther')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ guest banner ----------------------------- */
function GuestBar({ onLink }) {
  const { session, guestLink, projects } = useStudio();
  const [dismissed, setDismissed] = useState(false);
  const guest = Boolean(session?.guest);
  const pending = guestLink?.projects || 0;
  if (dismissed) return null;
  if (!guest && !pending) return null;

  return (
    <div className="nxs-guestbar">
      <IconUser size={13} />
      {guest ? (
        <span className="nxs-guestbar-text">
          <b>{t('studioGuestWorkspace')}</b> — {projects.length === 1 ? t('studioGuestOne') : t('studioGuestMany', { n: projects.length || 0 })}.{' '}
          {t('studioGuestHint')}
        </span>
      ) : (
        <span className="nxs-guestbar-text">
          <b>{pending === 1 ? t('studioGuestPendingOne') : t('studioGuestPendingMany', { n: pending })}</b>
        </span>
      )}
      <button className="nxs-btn sm primary" onClick={onLink}>
        <IconLink size={12} /> {t('studioGuestLink')}
      </button>
      <button className="nxs-btn icon ghost sm" onClick={() => setDismissed(true)} aria-label={t('studioGuestDismiss')}>
        <IconX size={12} />
      </button>
    </div>
  );
}

/* ------------------------------- palette --------------------------------- */
function Palette() {
  const {
    paletteOpen, setPaletteOpen, projects, openProject, createProject, saveNow,
    setTab, setSettingsOpen, setActiveFile, files, startDev, fixWithAI, terminal, agent,
  } = useStudio();
  const [q, setQ] = useState('');
  const [index, setIndex] = useState(0);

  const commands = useMemo(() => {
    const base = [
      { id: 'new', label: 'New project', icon: IconPlus, run: () => createProject({}) },
      { id: 'save', label: 'Save project (restore point)', icon: IconSave, run: () => saveNow() },
      { id: 'preview', label: 'Go to Preview', icon: IconEye, run: () => setTab('preview') },
      { id: 'code', label: 'Go to Code', icon: IconCode, run: () => setTab('code') },
      { id: 'terminal', label: 'Go to Terminal', icon: IconTerminal, run: () => setTab('terminal') },
      { id: 'publish', label: 'Go to Publish', icon: IconRocket, run: () => setTab('publish') },
      { id: 'dev', label: 'Start dev server', icon: IconPlay, run: () => startDev() },
      { id: 'fix', label: 'Fix last failure with AI', icon: IconWarn, run: () => fixWithAI(terminal.logs), disabled: !terminal.error || agent.running },
      { id: 'settings', label: 'Open settings', icon: IconGear, run: () => setSettingsOpen(true) },
    ];
    const filesCmds = Object.keys(files || {}).map((path) => ({
      id: `file:${path}`, label: `Open ${path}`, icon: IconCode, run: () => { setActiveFile(path); setTab('code'); },
    }));
    const projCmds = (projects || []).map((p) => ({
      id: `proj:${p.id}`, label: `Switch to ${p.name}`, icon: IconLayers, run: () => openProject(p.id),
    }));
    return [...base, ...filesCmds, ...projCmds];
  }, [agent.running, createProject, files, fixWithAI, openProject, projects, saveNow, setActiveFile, setSettingsOpen, setTab, startDev, terminal.error, terminal.logs]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = term ? commands.filter((c) => c.label.toLowerCase().includes(term)) : commands;
    return list.slice(0, 40);
  }, [commands, q]);

  useEffect(() => { setIndex(0); }, [q, paletteOpen]);
  if (!paletteOpen) return null;

  const exec = (cmd) => {
    if (!cmd || cmd.disabled) return;
    setPaletteOpen(false);
    setQ('');
    cmd.run();
  };

  return (
    <div className="nxs-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setPaletteOpen(false); }}>
      <div className="nxs-modal nxs-palette" style={{ background: 'transparent', border: 0, boxShadow: 'none' }}>
        <input
          className="nxs-input"
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search commands, files and projects…"
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => Math.min(i + 1, filtered.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => Math.max(i - 1, 0)); }
            if (e.key === 'Enter') { e.preventDefault(); exec(filtered[index]); }
            if (e.key === 'Escape') setPaletteOpen(false);
          }}
        />
        <div className="nxs-palette-list">
          {filtered.map((c, i) => {
            const Icon = c.icon;
            return (
              <button
                key={c.id}
                className={`nxs-palette-item ${i === index ? 'on' : ''}`}
                onMouseEnter={() => setIndex(i)}
                onClick={() => exec(c)}
                disabled={c.disabled}
              >
                <Icon size={13} />
                <span>{c.label}</span>
                {i === index && <kbd>↵</kbd>}
              </button>
            );
          })}
          {filtered.length === 0 && <div className="nxs-palette-item">No match</div>}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- topbar ---------------------------------- */
function TopBar({ onOpenProjects, onLinkAccount }) {
  const { project, renameProject, createProject, setSettingsOpen, session, dirty, saving } = useStudio();
  const [name, setName] = useState(project?.name || '');
  useEffect(() => { setName(project?.name || ''); }, [project?.id, project?.name]);

  const commit = () => {
    const next = name.trim();
    if (project && next && next !== project.name) renameProject(project.id, next);
  };

  const guest = Boolean(session?.guest);

  return (
    <header className="nxs-top">
      <button className="nxs-brand" title="Projects" onClick={onOpenProjects} style={{ background: 'none' }}>
        <span className="nxs-mark">N</span>
        <span style={{ textAlign: 'start' }}>
          <b>NEXORA</b>
          <small>STUDIO</small>
        </span>
      </button>

      <div className="nxs-proj-title">
        {project ? (
          <>
            <input value={name} onChange={(e) => setName(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} aria-label="Project name" />
            <span className="nxs-chip hide-sm">{STACK_LABEL[project.stack] || project.stack}</span>
            <span className={`nxs-chip ${saving ? 'warn' : Object.keys(dirty || {}).length ? 'warn' : 'ok'} hide-sm`}>
              {saving ? 'saving' : Object.keys(dirty || {}).length ? 'editing' : 'saved'}
            </span>
          </>
        ) : <span className="nxs-chip">new workspace</span>}
      </div>

      <div className="nxs-top-actions">
        <button className="nxs-btn sm hide-sm" onClick={() => createProject({})} title="New project">
          <IconPlus size={12} /> New
        </button>
        <button className="nxs-btn sm hide-sm" onClick={() => setSettingsOpen(true)} title="Settings">
          <IconGear size={13} /> Settings
        </button>
        <button className="nxs-btn sm" onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))} title="Command palette (Ctrl+K)">
          <IconCommand size={13} />
        </button>
        {guest ? (
          <button className="nxs-btn sm" onClick={onLinkAccount} title="Link a NEXORA account to this guest workspace">
            <IconUser size={12} /> Guest
          </button>
        ) : session?.user ? (
          <span className="nxs-chip hide-sm" title={session.user.username}>@{session.user.username}</span>
        ) : null}
        <span className="nxs-avatar" title={session?.user?.username || 'workspace'}>
          {session?.user?.avatarUrl
            ? <img src={session.user.avatarUrl} alt="" />
            : (session?.user?.username || 'N').slice(0, 1).toUpperCase()}
        </span>
      </div>
    </header>
  );
}

/* ------------------------------- shell ----------------------------------- */
function Shell() {
  const {
    booting, bootError, boot, session, project, sidebarOpen, setSidebarOpen,
    settingsOpen, toast, setSettingsOpen,
  } = useStudio();
  const [mobile, setMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 980 : false));
  const [mobileView, setMobileView] = useState('chat');
  const [linkOpen, setLinkOpen] = useState(false);

  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth <= 980);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  /* Android and iOS do not all resize the layout viewport when the keyboard
     opens; measuring it keeps the composer above the keyboard everywhere. */
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;
    const apply = () => {
      const covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty('--nxs-kb', `${Math.round(covered)}px`);
      document.documentElement.style.setProperty('--nxs-vvh', `${Math.round(vv.height)}px`);
    };
    apply();
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    return () => { vv.removeEventListener('resize', apply); vv.removeEventListener('scroll', apply); };
  }, []);

  if (booting) {
    return (
      <div className="nxs">
        <div className="nxs-loading">
          <div>
            <div className="spin" />
            Opening the workspace…
          </div>
        </div>
      </div>
    );
  }

  if (bootError?.code === 'unauthorized') {
    return (
      <div className="nxs">
        <div className="nxs-auth">
          <div className="nxs-auth-card">
            <h2>Studio could not start</h2>
            <p>The Studio API did not open a guest session. Retry — no account is needed to build.</p>
            {bootError.detail && <div className="nxs-error-box">{bootError.detail}</div>}
            <button className="nxs-btn primary" onClick={() => boot()} style={{ width: '100%' }}>
              <IconRefresh size={13} /> Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (bootError) {
    return (
      <div className="nxs">
        <div className="nxs-auth">
          <div className="nxs-auth-card">
            <h2>Studio could not start</h2>
            <p>{bootError.code === 'storage_unavailable'
              ? 'The project database is unavailable on this deployment.'
              : 'The Studio API answered with an error.'}</p>
            {bootError.detail && <div className="nxs-error-box">{bootError.detail}</div>}
            <button className="nxs-btn primary" onClick={() => boot()} style={{ width: '100%' }}>
              <IconRefresh size={13} /> Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="nxs">
      <TopBar onOpenProjects={() => setSidebarOpen(!sidebarOpen)} onLinkAccount={() => setLinkOpen(true)} />
      <GuestBar onLink={() => setLinkOpen(true)} />
      <div
        className={`nxs-body ${sidebarOpen ? '' : 'no-sidebar'} ${project ? '' : 'no-project'}`}
        data-mobile={mobileView}
      >
        {sidebarOpen && <ProjectsPanel />}
        <ChatPanel />
        {project && <Workspace onOpenSidebar={() => setSidebarOpen(!sidebarOpen)} />}
      </div>

      {mobile && (
        <div className="nxs-mobile-nav">
          <button className={mobileView === 'chat' ? 'on' : ''} onClick={() => setMobileView('chat')}>
            <IconSpark size={13} /> Chat
          </button>
          <button className={mobileView === 'workspace' ? 'on' : ''} onClick={() => setMobileView('workspace')}>
            <IconCode size={13} /> Build
          </button>
          <button onClick={() => setSidebarOpen(!sidebarOpen)}>
            <IconLayers size={13} /> Projects
          </button>
        </div>
      )}

      <AgentWindow />
      {settingsOpen && <SettingsPanel />}
      <Palette />
      {linkOpen && <AccountLink onClose={() => setLinkOpen(false)} />}
      {toast && <div className={`nxs-toast ${toast.tone}`}>{toast.text}</div>}
    </div>
  );
}

export default function StudioApp() {
  return (
    <StudioProvider>
      <Shell />
    </StudioProvider>
  );
}
